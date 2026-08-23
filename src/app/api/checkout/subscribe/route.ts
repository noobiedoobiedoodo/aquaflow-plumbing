import { NextResponse } from 'next/server';
import { requireRoleInOrg } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/constants';
import { prisma } from '@/lib/db';
import { stripe } from '@/lib/stripe';

export async function POST(req: Request) {
  try {
    const { user, organizationId } = await requireRoleInOrg(ADMIN_ROLES);

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: 'Stripe is not configured.' }, { status: 500 });
    }

    // In a real app, you would look up the Price ID from a config or database
    // For MVP, we'll assume a dummy price ID or use an ad-hoc price.
    // If you don't have a price ID, you can use price_data inline
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [
        {
          price_data: {
            currency: 'cad',
            product_data: {
              name: 'AquaFlow Core Operating System',
              description: 'Full access to scheduling, dispatch, billing, and intelligent operations.',
              tax_code: 'txcd_10103000',
            },
            unit_amount: 19900, // $199.00 / month
            recurring: {
              interval: 'month',
            },
          },
          quantity: 1,
        },
      ],
      client_reference_id: org.id, // Links the session back to our Organization
      customer_email: org.email || user.email,
      success_url: `${await (await import('@/lib/config/url')).getServerBaseUrl()}/onboarding?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${await (await import('@/lib/config/url')).getServerBaseUrl()}/onboarding`,
    });

    // We can't use redirect() inside an API route easily depending on the client,
    // so we return a 303 Redirect which browsers follow automatically for form POSTs.
    return NextResponse.redirect(checkoutSession.url!, 303);

  } catch (err: any) {
    console.error('Stripe Checkout Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
