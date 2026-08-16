import { NextResponse } from 'next/server';
import { requireRoleInOrg } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/constants';
import { prisma } from '@/lib/db';
import { stripe } from '@/lib/stripe';

export async function POST(req: Request) {
  try {
    // Enforce verified organization membership with admin role
    const { user, organizationId } = await requireRoleInOrg(ADMIN_ROLES);

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    let accountId = org.stripeAccountId;

    // 1. Create a Stripe Connected Account if one doesn't exist
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'standard',
        email: org.email || user.email,
        business_profile: {
          name: org.name,
          url: org.domain ? `https://${org.domain}` : undefined,
        },
      });
      accountId = account.id;

      await prisma.organization.update({
        where: { id: org.id },
        data: {
          stripeAccountId: accountId,
          stripeConnectionStatus: 'PENDING',
        },
      });
    }

    // 2. Create an AccountLink for onboarding
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${baseUrl}/api/stripe-connect/refresh`,
      return_url: `${baseUrl}/api/stripe-connect/callback`,
      type: 'account_onboarding',
    });

    return NextResponse.redirect(accountLink.url, 303);
  } catch (err: any) {
    console.error('Stripe Connect Error:', err);
    if (err.message === 'Unauthorized' || err.message === 'Forbidden') {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
