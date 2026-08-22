'use client';

import React from 'react';
import { Check, ArrowRight, Sparkles, ShieldCheck, DollarSign, X, HelpCircle, Users } from 'lucide-react';
import { motion } from 'framer-motion';

const INCLUDED_FEATURES = [
  'Full Drag-and-Drop Scheduling & Calendar',
  'Real-Time Dispatch Console & Fleet Visibility',
  'Mobile Technician App (iOS & Android)',
  'White-Label Customer Booking Portal',
  'Automated Invoicing & Stripe Payment Processing',
  'On-Site Digital Signatures & Photo Attachments',
  'Automated SMS & Email Appointment Reminders',
  'Dedicated Direct Founder Onboarding & Support',
  'Unlimited Jobs, Customers & Estimates',
  'Zero Setup Fees & No Long-Term Contract Required',
];

export function PilotPricingOffer() {
  return (
    <section id="pricing" className="py-24 bg-[#070C12] relative overflow-hidden border-t border-slate-900">
      {/* Glow ambient background */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-gradient-to-r from-cyan-600/15 via-blue-600/15 to-transparent rounded-full blur-[160px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-950/40 border border-cyan-500/30 text-cyan-400 text-xs font-bold uppercase tracking-wider mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            Transparent Founding Pricing
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
            Simple, honest pricing for the founding cohort.
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-300">
            No complicated enterprise sales calls. No hidden per-seat fees. Apply, we&apos;ll review your workflow, and if you&apos;re a fit we will personally onboard your company.
          </p>
        </div>

        {/* Pricing & ROI Comparison Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch max-w-6xl mx-auto">
          {/* MAIN PRICING CARD (7 cols) */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="lg:col-span-7 rounded-3xl p-8 sm:p-10 bg-gradient-to-b from-slate-900 via-slate-900/90 to-cyan-950/40 border-2 border-cyan-500/50 shadow-[0_25px_60px_rgba(0,229,255,0.2)] flex flex-col justify-between relative overflow-hidden"
          >
            {/* Top Scarcity Ribbon */}
            <div className="absolute top-0 right-0 bg-gradient-to-l from-cyan-500 to-blue-600 text-slate-950 text-[11px] font-extrabold px-6 py-1.5 rounded-bl-2xl uppercase tracking-wider shadow-md">
              Only 3 Companies Accepted
            </div>

            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-400 mb-2">
                <Users className="w-4 h-4" />
                Commercial Founding Pilot
              </div>

              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-5xl sm:text-6xl font-extrabold text-white tracking-tight">$199</span>
                <span className="text-slate-400 text-lg font-medium">/ month</span>
              </div>

              <p className="mt-4 text-sm sm:text-base text-slate-300">
                Everything you need to run an organized, modern plumbing company without the enterprise price tag.
              </p>

              <div className="mt-8 pt-6 border-t border-slate-800 space-y-3.5">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Everything Included in the Pilot:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  {INCLUDED_FEATURES.map((item) => (
                    <div key={item} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-200">
                      <div className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="w-3 h-3" />
                      </div>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-10 pt-6 border-t border-slate-800">
              <a
                href="#apply"
                className="w-full inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl bg-gradient-to-r from-blue-600 via-cyan-500 to-cyan-400 text-slate-950 font-bold text-base shadow-[0_0_35px_rgba(0,229,255,0.4)] hover:shadow-[0_0_50px_rgba(0,229,255,0.7)] hover:scale-[1.02] transition-all"
              >
                <span>Apply for the $199/mo Pilot</span>
                <ArrowRight className="w-5 h-5" />
              </a>
              <div className="mt-3 text-center text-xs text-slate-400">
                High-touch founder onboarding • 3 pilot spots only • No enterprise contract lock-in
              </div>
            </div>
          </motion.div>

          {/* THE ROI MATH CARD (5 cols) */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="lg:col-span-5 rounded-3xl p-8 sm:p-10 bg-slate-900/50 border border-slate-800 flex flex-col justify-between"
          >
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-4">
                <DollarSign className="w-3.5 h-3.5" />
                The Honest Economics
              </div>

              <h3 className="text-2xl font-bold text-white leading-snug">
                What does one missed emergency service call cost you?
              </h3>

              <p className="mt-3 text-sm text-slate-300 leading-relaxed">
                In plumbing, a single emergency service call (such as a water heater replacement or main line clearing) typically yields <span className="text-white font-semibold">$350 to $1,500+</span> in revenue.
              </p>

              <div className="mt-6 space-y-3">
                <div className="p-4 rounded-2xl bg-red-950/20 border border-red-500/20">
                  <div className="flex items-center justify-between text-xs font-bold text-red-400 mb-1">
                    <span>1 Missed Emergency Call (Example)</span>
                    <span>-$450.00</span>
                  </div>
                  <p className="text-xs text-slate-400">Homeowner calls another plumber when unreachable.</p>
                </div>

                <div className="p-4 rounded-2xl bg-cyan-950/30 border border-cyan-500/30">
                  <div className="flex items-center justify-between text-xs font-bold text-cyan-300 mb-1">
                    <span>AquaFlow Monthly Pilot</span>
                    <span>$199.00 / mo</span>
                  </div>
                  <p className="text-xs text-slate-300">Instant booking, 30-sec dispatch, and automated customer follow-ups.</p>
                </div>
              </div>
            </div>

            <div className="mt-8 p-5 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300">
              <strong className="text-white block mb-1">Illustrative ROI Scenario:</strong>
              You don&apos;t need to recover dozens of jobs for AquaFlow to pay for itself. Recovering just <span className="text-cyan-400 font-semibold">one typical service call</span> covers the entire monthly software investment.
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
