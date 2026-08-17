import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/db';
import { FINANCE_EVENTS } from '@/lib/constants';
import Stripe from 'stripe';

export async function POST(req: NextRequest) {
  // NOTE: Do NOT rate-limit Stripe webhooks by IP. Stripe sends from shared IPs
  // and IP-based limiting would block legitimate webhooks under load.
  // Security is enforced via signature verification below.

  const payload = await req.text();
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    return new NextResponse('Missing Stripe signature', { status: 400 });
  }

  let event: Stripe.Event;

  try {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('STRIPE_WEBHOOK_SECRET is not configured.');
      return new NextResponse('Webhook secret misconfigured', { status: 500 });
    }
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`Webhook signature verification failed: ${message}`);
    return new NextResponse(`Webhook Error: ${message}`, { status: 400 });
  }

  // Handle the event
  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const invoiceId = paymentIntent.metadata.invoiceId;

    if (!invoiceId) {
      console.warn('PaymentIntent succeeded but missing invoiceId metadata:', paymentIntent.id);
      return new NextResponse('Missing invoiceId metadata', { status: 200 });
    }

    try {
      await prisma.$transaction(async (tx) => {
        // 1. Idempotency Check & Atomic Claim
        const existingEvent = await tx.stripeWebhookEvent.findUnique({
          where: { stripeEventId: event.id }
        });

        if (existingEvent) {
          console.log(`Stripe webhook event ${event.id} already processed. Skipping.`);
          return;
        }

        try {
          await tx.stripeWebhookEvent.create({
            data: {
              stripeEventId: event.id,
              type: event.type,
            }
          });
        } catch (eventErr: any) {
          if (eventErr.code === 'P2002' || eventErr.message?.includes('Unique constraint')) {
            console.log(`Stripe webhook event ${event.id} already claimed concurrently. Skipping.`);
            return;
          }
          throw eventErr;
        }

        const existingPayment = await tx.payment.findUnique({
          where: { providerPaymentId: paymentIntent.id }
        });

        if (existingPayment) {
          console.log(`Payment ${paymentIntent.id} already processed under a different event. Skipping.`);
          return;
        }

        const invoice = await tx.invoice.findUnique({
          where: { id: invoiceId },
          include: { organization: { select: { stripeAccountId: true } } }
        });
        if (!invoice) throw new Error('Invoice not found');

        // CROSS-TENANT SPOOFING PREVENTION (FAIL-CLOSED):
        // For connected customer payment intents, the organization MUST have a configured stripeAccountId,
        // and the event.account MUST match that exact account.
        const stripeConnectedAccount = (event as Stripe.Event & { account?: string }).account;
        if (!invoice.organization.stripeAccountId || stripeConnectedAccount !== invoice.organization.stripeAccountId) {
          console.error(
            `SECURITY: Stripe account verification failed! Event account: ${stripeConnectedAccount}, Invoice org account: ${invoice.organization.stripeAccountId}`
          );
          throw new Error('Stripe account mismatch or unconfigured connected account.');
        }

        const amountPaidDollars = Number((paymentIntent.amount / 100).toFixed(2));

        // 2. Create Payment Record
        const payment = await tx.payment.create({
          data: {
            invoiceId,
            type: 'CHARGE',
            amount: amountPaidDollars,
            currency: paymentIntent.currency,
            status: 'SUCCEEDED',
            provider: 'stripe',
            providerPaymentId: paymentIntent.id,
            idempotencyKey: `pi_${paymentIntent.id}_success`, // unique for this success event
            paidAt: new Date(),
          }
        });

        // 3. Update Invoice Balance
        const newAmountPaid = Number((invoice.amountPaid + amountPaidDollars).toFixed(2));
        let newStatus = invoice.status;

        if (newAmountPaid >= invoice.total) {
          newStatus = 'PAID';
        } else if (newAmountPaid > 0) {
          newStatus = 'PARTIALLY_PAID';
        }

        await tx.invoice.update({
          where: { id: invoiceId },
          data: {
            amountPaid: newAmountPaid,
            status: newStatus,
          }
        });

        // 4. Log Financial Activity
        await tx.financialActivity.create({
          data: {
            invoiceId,
            paymentId: payment.id,
            event: FINANCE_EVENTS.PAYMENT_SUCCEEDED,
            metadata: JSON.stringify({ amount: amountPaidDollars, providerId: paymentIntent.id }),
          }
        });
        // 5. OUTBOX: Generate Event
        await tx.event.create({
          data: {
            organizationId: invoice.organizationId,
            type: 'payment.succeeded',
            entityType: 'Payment',
            entityId: payment.id,
            data: JSON.stringify({
              invoiceId: invoice.id,
              amount: amountPaidDollars,
            }),
          }
        });
      });
    } catch (dbError: any) {
      // If it's a unique constraint violation, it's a safe race condition we can ignore
      if (dbError.code === 'P2002') {
        console.log(`Duplicate webhook delivery prevented for ${paymentIntent.id}`);
        return new NextResponse('Already processed', { status: 200 });
      }

      if (dbError.message?.includes('Stripe account mismatch') || dbError.message?.includes('unconfigured connected account')) {
        return new NextResponse(`Security Rejection: ${dbError.message}`, { status: 400 });
      }

      console.error(`Database error processing webhook:`, dbError);
      return new NextResponse('Internal Server Error', { status: 500 }); // 500 will make Stripe retry
    }
  }

  if (event.type === 'payment_intent.payment_failed') {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const invoiceId = paymentIntent.metadata.invoiceId;

    if (invoiceId) {
      // Best effort log the failure
      try {
        await prisma.$transaction(async (tx) => {
          const existingEvent = await tx.stripeWebhookEvent.findUnique({
            where: { stripeEventId: event.id }
          });

          if (existingEvent) return;

          await tx.stripeWebhookEvent.create({
            data: {
              stripeEventId: event.id,
              type: event.type,
            }
          });

          await tx.financialActivity.create({
            data: {
              invoiceId,
              event: FINANCE_EVENTS.PAYMENT_FAILED,
              metadata: JSON.stringify({ error: paymentIntent.last_payment_error?.message }),
            }
          });
          // We need the organizationId to generate the event
          const invoice = await tx.invoice.findUnique({
            where: { id: invoiceId },
            select: { organizationId: true }
          });

          if (invoice) {
            await tx.event.create({
              data: {
                organizationId: invoice.organizationId,
                type: 'payment.failed',
                entityType: 'Invoice',
                entityId: invoiceId,
                data: JSON.stringify({
                  error: paymentIntent.last_payment_error?.message,
                }),
              }
            });
          }
        });
      } catch (e) {
        console.error('Failed to log payment failure', e);
      }
    }
  }

  // ==========================================
  // SaaS Subscriptions (AquaFlow Billing)
  // ==========================================
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.mode === 'subscription' && session.client_reference_id) {
      const orgId = session.client_reference_id;
      try {
        await prisma.organization.update({
          where: { id: orgId },
          data: {
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: session.subscription as string,
            subscriptionStatus: 'ACTIVE',
            onboardingStatus: 'STRIPE_CONNECT_PENDING',
          }
        });
      } catch (e) {
        console.error('Failed to update organization on checkout completion', e);
      }
    }
  }

  if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as Stripe.Subscription;
    try {
      await prisma.organization.updateMany({
        where: { stripeSubscriptionId: subscription.id },
        data: { subscriptionStatus: subscription.status.toUpperCase() }
      });
    } catch (e) {
      console.error('Failed to sync subscription status', e);
    }
  }

  // ==========================================
  // Stripe Connect Accounts (Plumber Onboarding)
  // ==========================================
  if (event.type === 'account.updated') {
    const account = event.data.object as Stripe.Account;
    try {
      const org = await prisma.organization.findFirst({
        where: { stripeAccountId: account.id }
      });

      if (org) {
        const isComplete = account.details_submitted;
        await prisma.organization.update({
          where: { id: org.id },
          data: {
            stripeConnectionStatus: isComplete ? 'ACTIVE' : 'PENDING',
            onboardingStatus: isComplete ? 'ONBOARDING_COMPLETE' : org.onboardingStatus,
          }
        });
      }
    } catch (e) {
      console.error('Failed to sync connected account status', e);
    }
  }

  // Return a 200 response to acknowledge receipt of the event
  return new NextResponse('Webhook received', { status: 200 });
}
