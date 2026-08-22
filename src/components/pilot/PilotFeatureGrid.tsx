'use client';

import React from 'react';
import { Calendar, Truck, Smartphone, Globe, PenTool, CreditCard, Zap, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';

const FEATURES = [
  {
    icon: Calendar,
    title: 'Smart Scheduling',
    headline: 'Stop playing calendar Tetris.',
    description: 'Visual drag-and-drop calendar designed for emergency plumbing calls. Quickly slot in 2-hour windows, prevent double-bookings, and keep your crews fully utilized.',
    benefit: 'Saves 5+ hours of scheduling confusion each week',
  },
  {
    icon: Truck,
    title: 'Live Fleet & Dispatch',
    headline: 'Know where every technician is in real-time.',
    description: 'Assign jobs based on technician location, skillset, and vehicle inventory. See who is en route, who is under a sink, and who is ready for the next call.',
    benefit: 'Cut response times and eliminate technician phone tag',
  },
  {
    icon: Smartphone,
    title: 'Technician Mobile Workflow',
    headline: 'Give your crew answers before they ask.',
    description: 'A mobile-optimized field app that works seamlessly on any iPhone or Android. Gate codes, customer notes, parts tracking, and job history right in their pocket.',
    benefit: 'No special hardware or tablet purchases required',
  },
  {
    icon: Globe,
    title: 'White-Label Customer Portal',
    headline: 'Give homeowners a 5-star digital experience.',
    description: 'Your customers get a branded portal to book appointments, view service technician ETAs, approve job estimates, and view paid receipts.',
    benefit: 'Builds immediate homeowner trust and premium perception',
  },
  {
    icon: PenTool,
    title: 'Digital Signatures on Glass',
    headline: 'Finish jobs without chasing lost paperwork.',
    description: 'Capture signed customer authorizations on the technician’s phone before starting work and after completion. Automatically archived in secure cloud storage.',
    benefit: 'Zero liability disputes & bulletproof proof-of-work',
  },
  {
    icon: CreditCard,
    title: 'Instant Invoicing & Stripe Payments',
    headline: 'Get the job finished — and get paid on the spot.',
    description: 'Generate accurate PDF invoices with calculated sales tax in seconds. Collect credit card payments on site or send a direct payment link via SMS.',
    benefit: 'Eliminates 30-day payment delays and improves cash flow',
  },
  {
    icon: Zap,
    title: 'Autonomous Operational Triggers',
    headline: 'Automate follow-ups while you sleep.',
    description: 'AquaFlow automatically sends booking confirmations, technician en-route SMS alerts, invoice reminders, and review requests without manual intervention.',
    benefit: 'Operate like a 20-truck enterprise from day one',
  },
];

export function PilotFeatureGrid() {
  return (
    <section id="features" className="py-24 bg-[#05080B] relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/2 right-1/4 w-[600px] h-[600px] bg-cyan-600/10 rounded-full blur-[160px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-950/40 border border-cyan-500/30 text-cyan-400 text-xs font-bold uppercase tracking-wider mb-4">
            <Zap className="w-3.5 h-3.5" />
            Engineered For Plumbing Companies
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
            Every feature drives a measurable business outcome.
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-300">
            We didn&apos;t build generic software with a plumbing logo slapped on it. AquaFlow is purpose-built to solve the specific bottlenecks that slow down plumbing operations.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((feat, idx) => {
            const Icon = feat.icon;
            const isFeatured = idx === 0 || idx === 5;
            return (
              <motion.div
                key={feat.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.08 }}
                className={`rounded-3xl p-7 flex flex-col justify-between transition-all border ${
                  isFeatured
                    ? 'bg-gradient-to-b from-slate-900/90 via-slate-900/60 to-cyan-950/40 border-cyan-500/40 shadow-[0_15px_40px_rgba(0,229,255,0.15)]'
                    : 'bg-slate-900/40 hover:bg-slate-900/70 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <div className="w-12 h-12 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center shadow-md">
                      <Icon className="w-6 h-6 text-cyan-400" />
                    </div>
                    <span className="text-xs font-mono font-semibold text-slate-500">0{idx + 1}</span>
                  </div>

                  <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                    {feat.title}
                  </span>
                  <h3 className="text-xl font-bold text-white mt-1 mb-3">
                    {feat.headline}
                  </h3>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    {feat.description}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center gap-2 text-xs font-semibold text-emerald-400">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{feat.benefit}</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
