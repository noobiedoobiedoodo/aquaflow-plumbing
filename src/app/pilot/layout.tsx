import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AquaFlow Founding Pilot | $199/mo Plumbing Operations Platform',
  description:
    'Stop running your plumbing business from your phone. AquaFlow gives growing plumbing companies one place to manage bookings, dispatch, technicians, customers, invoices, and payments. Apply for the 3-company founding pilot at $199/month.',
  openGraph: {
    title: 'AquaFlow Founding Pilot — $199/Month Commercial Launch',
    description:
      'Stop running your plumbing company from your phone. 3 commercial plumbing companies accepted for high-touch founder onboarding at $199/month.',
    url: 'https://aquaflow-plumbing-theta.vercel.app/pilot',
    siteName: 'AquaFlow Plumbing Operations Platform',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AquaFlow Founding Pilot — $199/Month',
    description: 'Stop running your plumbing company from your phone. Apply for the 3-company founding pilot.',
  },
};

export default function PilotLayout({ children }: { children: React.ReactNode }) {
  return <div className="bg-[#05080B] text-slate-100 min-h-screen selection:bg-cyan-500 selection:text-black">{children}</div>;
}
