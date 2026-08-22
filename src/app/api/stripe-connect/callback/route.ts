import { NextResponse } from 'next/server';
import { requireRoleInOrg } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/constants';
import { prisma } from '@/lib/db';
import { stripe } from '@/lib/stripe';

export async function GET(req: Request) {
  const { getServerBaseUrl } = await import('@/lib/config/url');
  const baseUrl = await getServerBaseUrl();

  try {
    const { user, organizationId } = await requireRoleInOrg(ADMIN_ROLES);

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!org) {
      return NextResponse.redirect(`${baseUrl}/onboarding`);
    }

    if (!org.stripeAccountId) {
      return NextResponse.redirect(`${baseUrl}/onboarding`);
    }

    // Verify the account status with Stripe
    const account = await stripe.accounts.retrieve(org.stripeAccountId);

    if (account.details_submitted) {
      await prisma.organization.update({
        where: { id: org.id },
        data: {
          stripeConnectionStatus: 'ACTIVE',
          onboardingStatus: 'ONBOARDING_COMPLETE',
        },
      });
      return NextResponse.redirect(`${baseUrl}/dashboard`);
    } else {
      // Still pending
      return NextResponse.redirect(`${baseUrl}/onboarding`);
    }
  } catch (err: any) {
    console.error('Stripe Connect Callback Error:', err);
    return NextResponse.redirect(`${baseUrl}/onboarding?error=connect_failed`);
  }
}
