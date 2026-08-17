import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { stripe } from '@/lib/stripe';

export async function GET(req: Request) {
  const { getServerBaseUrl } = await import('@/lib/config/url');
  const baseUrl = await getServerBaseUrl();

  try {
    const { user } = await requireAuth();

    const membership = await prisma.organizationMember.findFirst({
      where: { userId: user.id },
      include: { organization: true },
    });

    if (!membership) {
      return NextResponse.redirect(`${baseUrl}/login`);
    }

    const org = membership.organization;

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
