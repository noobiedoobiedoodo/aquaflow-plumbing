'use client';

import React from 'react';
import { ArrowRight, CheckCircle2, ShieldCheck, Sparkles, PhoneCall, Calendar, Truck, UserCheck, Wrench, FileCheck, CreditCard, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';

const LIFECYCLE_STEPS = [
  { label: 'BOOKED', icon: Calendar, color: 'from-blue-500 to-cyan-500' },
  { label: 'DISPATCHED', icon: Truck, color: 'from-cyan-500 to-teal-500' },
  { label: 'EN ROUTE', icon: PhoneCall, color: 'from-teal-500 to-emerald-500' },
  { label: 'ARRIVED', icon: UserCheck, color: 'from-emerald-500 to-green-500' },
  { label: 'WORKING', icon: Wrench, color: 'from-amber-500 to-orange-500' },
  { label: 'COMPLETED', icon: FileCheck, color: 'from-blue-600 to-indigo-600' },
  { label: 'PAID', icon: CreditCard, color: 'from-emerald-400 to-teal-400', highlight: true },
];

export function PilotHero() {
  return (
    <section className="relative min-h-[92vh] pt-32 pb-20 overflow-hidden flex flex-col justify-center bg-[#05080B]">
      {/* Background Glows & Water Effect Gradients */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[650px] bg-gradient-to-br from-blue-600/20 via-cyan-500/15 to-transparent rounded-full blur-[140px] pointer-events-none -z-10" />
      <div className="absolute top-2/3 right-10 w-[400px] h-[400px] bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none -z-10" />
      <div className="absolute bottom-10 left-10 w-[350px] h-[350px] bg-blue-700/10 rounded-full blur-[100px] pointer-events-none -z-10" />

      {/* Grid Pattern Overlay */}
      <div
        className="absolute inset-0 bg-[linear-gradient(to_right,#1A233215_1px,transparent_1px),linear-gradient(to_bottom,#1A233215_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_40%,#000_70%,transparent_100%)] pointer-events-none -z-10"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
        {/* Scarcity / Founding Pilot Pill */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-gradient-to-r from-blue-950/80 via-slate-900/90 to-cyan-950/80 border border-cyan-500/40 shadow-[0_0_25px_rgba(0,229,255,0.2)] mb-8"
        >
          <span className="flex h-2.5 w-2.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
          </span>
          <span className="text-xs sm:text-sm font-semibold tracking-wide text-cyan-300">
            FOUNDING PILOT — <span className="text-white font-bold">$199/MONTH</span> • FIRST 3 COMPANIES ONLY
          </span>
        </motion.div>

        {/* Hero Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-4xl sm:text-6xl lg:text-7xl font-extrabold text-white tracking-tight max-w-5xl mx-auto leading-[1.08]"
        >
          Stop Running Your Plumbing Business{' '}
          <span className="bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-500 bg-clip-text text-transparent drop-shadow-[0_0_35px_rgba(0,229,255,0.4)]">
            From Your Phone.
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-6 text-lg sm:text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed font-normal"
        >
          AquaFlow gives growing plumbing companies <span className="text-white font-semibold">one unified operating system</span> to manage bookings, dispatch, technicians, customers, invoices, payments, and automated follow-ups — without stitching together five disconnected apps.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-5"
        >
          <a
            href="#apply"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl bg-gradient-to-r from-blue-600 via-cyan-500 to-cyan-400 text-slate-950 font-bold text-base shadow-[0_0_35px_rgba(0,229,255,0.5)] hover:shadow-[0_0_50px_rgba(0,229,255,0.8)] hover:scale-[1.03] active:scale-[0.98] transition-all"
          >
            <span>Apply for the $199/month Pilot</span>
            <ArrowRight className="w-5 h-5" />
          </a>

          <a
            href="#how-it-works"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-2xl bg-slate-900/80 hover:bg-slate-800/80 border border-slate-700/80 text-white font-semibold text-base backdrop-blur-md hover:border-cyan-500/50 hover:shadow-[0_0_25px_rgba(0,136,255,0.2)] transition-all"
          >
            <span>See How AquaFlow Works</span>
            <ChevronRight className="w-4 h-4 text-cyan-400" />
          </a>
        </motion.div>

        {/* High-touch reassurance banner */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-6 flex flex-wrap items-center justify-center gap-y-2 gap-x-6 text-xs sm:text-sm text-slate-400"
        >
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-cyan-400" />
            <span>High-Touch Founder Onboarding</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-cyan-400" />
            <span>No Long-Term Contract Required</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-cyan-400" />
            <span>Dedicated Direct Phone & Slack Support</span>
          </div>
        </motion.div>

        {/* CENTERPIECE: The Animated Operational Flow Ribbon */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="mt-16 relative"
        >
          <div className="text-xs uppercase tracking-widest text-cyan-400 font-bold mb-4 flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4" />
            THE COMPLETE AQUAFLOW OPERATIONAL LIFECYCLE
          </div>

          <div className="glass rounded-3xl p-4 sm:p-6 border border-cyan-500/20 shadow-[0_20px_50px_rgba(0,0,0,0.8)] relative overflow-hidden">
            {/* Top glowing ambient line */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 sm:gap-3">
              {LIFECYCLE_STEPS.map((step, idx) => {
                const Icon = step.icon;
                return (
                  <div
                    key={step.label}
                    className={`relative flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl border transition-all ${
                      step.highlight
                        ? 'bg-gradient-to-b from-emerald-950/60 to-cyan-950/60 border-emerald-400/50 shadow-[0_0_20px_rgba(16,185,129,0.25)]'
                        : 'bg-slate-900/50 hover:bg-slate-800/60 border-slate-800 hover:border-cyan-500/30'
                    }`}
                  >
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-950/80 border border-slate-800 mb-2">
                      <Icon className={`w-4 h-4 ${step.highlight ? 'text-emerald-400' : 'text-cyan-400'}`} />
                    </div>
                    <span className="text-[10px] sm:text-xs font-bold tracking-wider text-slate-200">
                      {step.label}
                    </span>
                    <span className="text-[9px] text-slate-500 mt-0.5">Step 0{idx + 1}</span>
                  </div>
                );
              })}
            </div>

            {/* Bottom Outcome Caption */}
            <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-2">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Live Job Automation: Every phase synced in real-time across dispatcher, tech, and customer.
              </span>
              <span className="font-semibold text-cyan-300">
                Zero Lost Jobs • Zero Paperwork • Instant Invoicing
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
