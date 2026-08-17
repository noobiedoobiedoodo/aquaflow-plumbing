import { prisma } from '../../src/lib/db';
import { randomBytes, randomUUID } from 'crypto';
import { hashToken } from '../../src/lib/auth/customer-session';
import { GET as verifyHandler } from '../../src/app/auth/verify/route';
import { POST as resetPasswordHandler } from '../../src/app/api/auth/reset-password/route';
import { POST as stripeWebhookHandler } from '../../src/app/api/webhooks/stripe/route';
import { SimulatedClient } from './client';
import { TestRegistry } from './registry';
import { MetricsCollector } from './metrics';
import { stripe } from '../../src/lib/stripe';

export class RaceConditionSuite {
  constructor(
    private registry: TestRegistry,
    private metrics: MetricsCollector
  ) {}

  public async runAllRaceTests(): Promise<boolean> {
    console.log('[Races] Running Concurrency & Race Condition Suite...');

    const r1 = await this.testConcurrentMagicLinkRedemption();
    const r2 = await this.testConcurrentPasswordResetRedemption();
    const r3 = await this.testConcurrentStripeWebhookDeduplication();

    return r1 && r2 && r3;
  }

  /**
   * Race 1: 15 Simultaneous Magic Link Redemptions
   */
  public async testConcurrentMagicLinkRedemption(): Promise<boolean> {
    const company = this.registry.getAllCompanies()[0];
    const customer = company.customers[0];
    if (!customer) return true;

    const rawToken = randomBytes(32).toString('base64url');
    const tokenHash = hashToken(rawToken);

    await prisma.magicLinkToken.create({
      data: {
        tokenHash,
        userId: customer.userId,
        organizationId: company.organizationId,
        customerId: customer.customerId,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    const CONCURRENCY = 15;
    const promises = Array.from({ length: CONCURRENCY }, () => {
      const client = new SimulatedClient();
      return client.dispatch(verifyHandler, `http://localhost:3000/auth/verify?token=${rawToken}`);
    });

    const results = await Promise.all(promises);
    const successCount = results.filter((r) => r.status === 307).length;
    const rejectedCount = results.filter((r) => r.status === 400).length;

    if (successCount !== 1) {
      this.metrics.tokenReplaySuccesses += Math.max(0, successCount - 1);
      console.error(`[Race Failure] Expected exactly 1 magic link redemption, got: ${successCount}`);
      return false;
    }

    return true;
  }

  /**
   * Race 2: 15 Simultaneous Password Reset Consumptions
   */
  public async testConcurrentPasswordResetRedemption(): Promise<boolean> {
    const company = this.registry.getAllCompanies()[0];
    const customer = company.customers[0];
    if (!customer) return true;

    const rawToken = randomBytes(32).toString('base64url');
    const tokenHash = hashToken(rawToken);

    await prisma.passwordResetToken.create({
      data: {
        userId: customer.userId,
        organizationId: company.organizationId,
        tokenHash,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    const CONCURRENCY = 15;
    const promises = Array.from({ length: CONCURRENCY }, (_, i) => {
      const client = new SimulatedClient();
      return client.dispatch(resetPasswordHandler, 'http://localhost:3000/api/auth/reset-password', {
        method: 'POST',
        body: {
          token: rawToken,
          newPassword: `ConcurrentRacePassword${i}888!`,
        },
      });
    });

    const results = await Promise.all(promises);
    const successCount = results.filter((r) => r.status === 200).length;
    const rejectedCount = results.filter((r) => r.status === 400).length;

    if (successCount !== 1) {
      this.metrics.tokenReplaySuccesses += Math.max(0, successCount - 1);
      console.error(`[Race Failure] Expected exactly 1 password reset consumption, got: ${successCount}`);
      return false;
    }

    return true;
  }

  /**
   * Race 3: 20 Identical Concurrent Stripe Webhooks
   */
  public async testConcurrentStripeWebhookDeduplication(): Promise<boolean> {
    const company = this.registry.getAllCompanies()[0];
    const invoice = company.invoices[0];
    if (!invoice) return true;

    const paymentIntentId = `pi_race_${randomUUID().slice(0, 12)}`;
    const eventId = `evt_race_${randomUUID().slice(0, 12)}`;

    const webhookPayload = JSON.stringify({
      id: eventId,
      object: 'event',
      api_version: '2023-10-16',
      created: Math.floor(Date.now() / 1000),
      type: 'payment_intent.succeeded',
      account: company.stripeAccountId,
      data: {
        object: {
          id: paymentIntentId,
          object: 'payment_intent',
          amount: Math.round(invoice.total * 100),
          currency: 'cad',
          status: 'succeeded',
          metadata: {
            invoiceId: invoice.id,
          },
        },
      },
    });

    const secret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_secret_for_acceptance_harness';
    const signature = stripe.webhooks.generateTestHeaderString({
      payload: webhookPayload,
      secret,
    });

    const CONCURRENCY = 20;
    const promises = Array.from({ length: CONCURRENCY }, () => {
      const client = new SimulatedClient();
      return client.dispatch(stripeWebhookHandler, 'http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        headers: {
          'stripe-signature': signature,
        },
        body: webhookPayload,
      });
    });

    await Promise.all(promises);

    // Deep Database Invariant Assertion: Exactly 1 Payment record created
    const paymentRecords = await prisma.payment.findMany({
      where: { providerPaymentId: paymentIntentId },
    });

    if (paymentRecords.length !== 1) {
      this.metrics.duplicatePayments += Math.max(0, paymentRecords.length - 1);
      console.error(`[Race Failure] Duplicate payments created: ${paymentRecords.length}`);
      return false;
    }

    const webhookEvents = await prisma.stripeWebhookEvent.findMany({
      where: { stripeEventId: eventId },
    });

    if (webhookEvents.length !== 1) {
      this.metrics.duplicateWebhookEffects += Math.max(0, webhookEvents.length - 1);
      console.error(`[Race Failure] Duplicate webhook events created: ${webhookEvents.length}`);
      return false;
    }

    return true;
  }
}
