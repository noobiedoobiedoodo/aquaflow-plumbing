'use client';

import React, { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const FAQS = [
  {
    q: 'What is AquaFlow?',
    a: 'AquaFlow is a unified operations platform built specifically for residential and commercial plumbing companies. It centralizes customer booking, route dispatch, technician mobile workflows, digital signatures, invoicing, and Stripe payments into one intuitive system.',
  },
  {
    q: 'Who is AquaFlow designed for?',
    a: 'AquaFlow is built for owner-operators and growing plumbing companies with 1 to 25+ technicians who are tired of losing jobs to missed calls, juggling paper invoices, texting addresses back and forth, or paying thousands of dollars for bloated legacy enterprise software.',
  },
  {
    q: 'Why is the founding pilot only $199/month?',
    a: 'We are keeping the founding pilot price at $199/month because our primary goal right now is close operational partnership with 3 commercial plumbing companies. We want to work directly with you to ensure every aspect of your daily dispatch and billing runs flawlessly.',
  },
  {
    q: 'How many plumbing companies are being accepted?',
    a: 'Exactly three (3). This is not artificial marketing scarcity. We are deliberately limiting the founding cohort to 3 companies so the founding engineering team can provide high-touch, white-glove onboarding and direct support.',
  },
  {
    q: 'What happens after I apply?',
    a: 'We review your application within 24 hours. If your company is a good fit for the pilot, a founder will reach out directly to schedule a 20-minute setup call, walk through your existing workflow, and personally configure your team.',
  },
  {
    q: 'Do you help with onboarding and setup?',
    a: 'Yes. You receive 100% white-glove setup directly from the engineering founders. We configure your company profile, technician logins, service menu, pricing rates, and Stripe payment account with you.',
  },
  {
    q: 'Can AquaFlow handle multiple technicians and vans?',
    a: 'Yes. AquaFlow supports solo operators as well as multi-technician fleets. You can schedule jobs across multiple technicians, track real-time job statuses, and route calls with zero per-seat penalty fees during the pilot.',
  },
  {
    q: 'Can customers pay invoices online via credit card?',
    a: 'Yes. AquaFlow includes native Stripe Connect integration. Customers can pay invoices instantly on-site via the technician workspace or through their self-service customer portal. Funds settle directly into your verified bank account.',
  },
  {
    q: 'Can my technicians use AquaFlow from their phones?',
    a: 'Yes. AquaFlow is 100% mobile-optimized for iPhone and Android. Technicians do not need special tablets or expensive hardware — they simply log into their secure technician workspace from their mobile browser.',
  },
  {
    q: 'Is there a long-term contract or cancellation fee?',
    a: 'No. The pilot is billed on a month-to-month basis at $199/month. You can cancel at any time with zero cancellation fees or penalties.',
  },
];

export function PilotFAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <section id="faq" className="py-24 bg-[#070C12] relative overflow-hidden border-t border-slate-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-950/40 border border-cyan-500/30 text-cyan-400 text-xs font-bold uppercase tracking-wider mb-4">
            <HelpCircle className="w-3.5 h-3.5" />
            Frequently Asked Questions
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
            Everything you need to know about the pilot.
          </h2>
          <p className="mt-4 text-base text-slate-300">
            Straight answers to common questions about the founding cohort, setup process, and software capabilities.
          </p>
        </div>

        {/* Accordion List */}
        <div className="space-y-4">
          {FAQS.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={faq.q}
                className="rounded-2xl bg-slate-900/40 border border-slate-800 overflow-hidden transition-colors hover:border-slate-700"
              >
                <button
                  onClick={() => toggle(idx)}
                  className="w-full p-6 text-left flex items-center justify-between gap-4 cursor-pointer"
                >
                  <span className="text-base sm:text-lg font-bold text-white">
                    {faq.q}
                  </span>
                  <div
                    className={`w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center shrink-0 transition-transform ${
                      isOpen ? 'rotate-180 bg-cyan-500/20 text-cyan-400' : 'text-slate-400'
                    }`}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </button>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25 }}
                    >
                      <div className="px-6 pb-6 pt-1 text-sm sm:text-base text-slate-300 leading-relaxed border-t border-slate-800/60 mt-1">
                        {faq.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
