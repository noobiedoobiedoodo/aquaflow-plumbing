import React from 'react';
import { Metadata } from 'next';
import { PilotNavbar } from '@/components/pilot/PilotNavbar';
import { PilotHero } from '@/components/pilot/PilotHero';
import { PilotPainContrast } from '@/components/pilot/PilotPainContrast';
import { PilotOperationalJourney } from '@/components/pilot/PilotOperationalJourney';
import { PilotDashboardMockup } from '@/components/pilot/PilotDashboardMockup';
import { PilotFeatureGrid } from '@/components/pilot/PilotFeatureGrid';
import { PilotPricingOffer } from '@/components/pilot/PilotPricingOffer';
import { PilotApplicationForm } from '@/components/pilot/PilotApplicationForm';
import { PilotFAQ } from '@/components/pilot/PilotFAQ';
import { PilotFinalCTA } from '@/components/pilot/PilotFinalCTA';
import { PilotStickyMobileBar } from '@/components/pilot/PilotStickyMobileBar';

export const metadata: Metadata = {
  title: 'FlowLoop OS | The Operating System for Modern Plumbing Contractors',
  description: 'Automate dispatch, eliminate missed calls with AI, streamline technician routing, and collect payment instantly. Join the FlowLoop OS Founding Commercial Pilot for $199/mo.',
  openGraph: {
    title: 'FlowLoop OS | Next-Generation Plumbing Operating System',
    description: 'Automate dispatch, streamline technician routing, and collect payments instantly.',
    images: ['/brand/flowloop-pro-dark.png'],
  },
};

export default function HomePage() {
  return (
    <main className="relative bg-[#05080B] min-h-screen text-slate-100 overflow-x-hidden">
      {/* Sticky Navigation */}
      <PilotNavbar />

      {/* Hero Section */}
      <PilotHero />

      {/* Emotional Problem & Revenue Bleed Contrast */}
      <PilotPainContrast />

      {/* "Built for Plumbers" Operational Journey */}
      <PilotOperationalJourney />

      {/* Interactive Mock Dashboard Visualization */}
      <PilotDashboardMockup />

      {/* Outcome-Driven Feature Cards */}
      <PilotFeatureGrid />

      {/* Pricing & $199 ROI Math */}
      <PilotPricingOffer />

      {/* Pilot Application Form */}
      <PilotApplicationForm />

      {/* FAQ Section */}
      <PilotFAQ />

      {/* Final Cinematic CTA Banner */}
      <PilotFinalCTA />

      {/* Mobile Fixed Bottom CTA Bar */}
      <PilotStickyMobileBar />

      {/* Footer */}
      <footer className="py-12 bg-[#030508] border-t border-slate-900 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 space-y-3">
          <p>© {new Date().getFullYear()} FlowLoop OS. All rights reserved.</p>
          <p className="text-[11px] text-slate-600">
            FlowLoop OS Founding Commercial Pilot • Multi-Tenant Plumbing Operations Engine
          </p>
        </div>
      </footer>
    </main>
  );
}
