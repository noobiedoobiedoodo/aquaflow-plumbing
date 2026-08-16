import { requireAuth } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function OnboardingPage() {
  const { user } = await requireAuth();

  const orgMembership = await prisma.organizationMember.findFirst({
    where: { userId: user.id },
    include: { organization: true },
  });

  if (!orgMembership) {
    redirect('/signup');
  }

  const org = orgMembership.organization;
  const status = org.onboardingStatus;

  // If already complete, redirect to dashboard
  if (status === 'ONBOARDING_COMPLETE') {
    redirect('/dashboard');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-lg space-y-8 bg-white p-8 shadow rounded-lg">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
            AquaFlow Setup
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Let's get {org.name} ready for business.
          </p>
        </div>

        <div className="mt-8">
          <ul className="space-y-4">
            {/* Step 1: Account Created */}
            <li className="flex items-center gap-3">
              <svg className="h-6 w-6 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              <span className="text-gray-700 line-through">Company & Account created</span>
            </li>

            {/* Step 2: Subscription */}
            <li className="flex items-center gap-3">
              {['STRIPE_SUBSCRIPTION_PENDING'].includes(status) ? (
                <div className="h-6 w-6 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
              ) : (
                <svg className="h-6 w-6 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              )}
              <span className={`text-gray-700 ${!['STRIPE_SUBSCRIPTION_PENDING'].includes(status) ? 'line-through' : 'font-medium'}`}>
                Activate Subscription
              </span>
              {status === 'STRIPE_SUBSCRIPTION_PENDING' && (
                <form action="/api/checkout/subscribe" method="POST" className="ml-auto">
                  <button type="submit" className="rounded-md bg-blue-600 px-3 py-1 text-sm font-semibold text-white shadow-sm hover:bg-blue-500">
                    Subscribe
                  </button>
                </form>
              )}
            </li>

            {/* Step 3: Stripe Connect */}
            <li className="flex items-center gap-3">
              {['STRIPE_SUBSCRIPTION_PENDING', 'SUBSCRIPTION_ACTIVE', 'STRIPE_CONNECT_PENDING'].includes(status) ? (
                status === 'STRIPE_CONNECT_PENDING' || status === 'SUBSCRIPTION_ACTIVE' ? (
                  <div className="h-6 w-6 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
                ) : (
                  <div className="h-6 w-6 rounded-full border-2 border-gray-300" />
                )
              ) : (
                <svg className="h-6 w-6 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              )}
              <span className={`text-gray-700 ${status === 'STRIPE_CONNECTED' ? 'line-through' : status === 'STRIPE_CONNECT_PENDING' || status === 'SUBSCRIPTION_ACTIVE' ? 'font-medium' : 'opacity-50'}`}>
                Connect Stripe Account
              </span>
              {(status === 'STRIPE_CONNECT_PENDING' || status === 'SUBSCRIPTION_ACTIVE') && (
                <form action="/api/stripe-connect" method="POST" className="ml-auto">
                  <button type="submit" className="rounded-md bg-blue-600 px-3 py-1 text-sm font-semibold text-white shadow-sm hover:bg-blue-500">
                    Connect
                  </button>
                </form>
              )}
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
