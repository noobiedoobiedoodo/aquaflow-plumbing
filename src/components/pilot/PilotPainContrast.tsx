'use client';

import React from 'react';
import { XCircle, CheckCircle2, AlertTriangle, TrendingUp, DollarSign, Clock, ShieldAlert } from 'lucide-react';
import { motion } from 'framer-motion';

export function PilotPainContrast() {
  return (
    <section className="py-24 bg-[#070C12] relative overflow-hidden border-t border-slate-900">
      {/* Glow ambient background */}
      <div className="absolute top-1/2 left-0 w-96 h-96 bg-red-600/5 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-1/2 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-red-950/40 border border-red-500/30 text-red-400 text-xs font-bold uppercase tracking-wider mb-4">
            <AlertTriangle className="w-3.5 h-3.5" />
            The Hidden Cost of Disorganization
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
            Every job you lose costs more than the invoice.
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-300">
            Plumbing companies don&apos;t fail because they lack plumbing skills. They lose revenue through operational friction: missed calls, delayed callbacks, chaotic scheduling, and unpaid invoices sitting in email inboxes.
          </p>
        </div>

        {/* Comparison Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
          {/* THE CHAOS CARD */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="rounded-3xl p-8 bg-gradient-to-b from-red-950/20 via-slate-900/60 to-slate-950/80 border border-red-500/30 shadow-[0_20px_50px_rgba(0,0,0,0.6)] flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between pb-6 border-b border-red-500/20">
                <div>
                  <span className="text-xs uppercase tracking-wider font-bold text-red-400">The Daily Headache</span>
                  <h3 className="text-2xl font-bold text-white mt-1">Running on Phone Calls & Spreadsheets</h3>
                </div>
                <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400">
                  <ShieldAlert className="w-7 h-7" />
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-red-950/20 border border-red-500/10">
                  <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-sm font-semibold text-white">Missed Emergency Calls</strong>
                    <p className="text-xs text-slate-400 mt-0.5">You&apos;re under a sink. A homeowner with a burst pipe calls, gets voicemail, and calls your competitor in 30 seconds.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-red-950/20 border border-red-500/10">
                  <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-sm font-semibold text-white">Technician Phone Tag</strong>
                    <p className="text-xs text-slate-400 mt-0.5">Technicians texting constantly: &quot;What&apos;s the gate code?&quot;, &quot;What parts do I need?&quot;, &quot;Where am I going next?&quot;</p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-red-950/20 border border-red-500/10">
                  <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-sm font-semibold text-white">Lost Paperwork & Delayed Invoices</strong>
                    <p className="text-xs text-slate-400 mt-0.5">Jobs finished on Tuesday aren&apos;t invoiced until Sunday evening. Cash flow slows down and payments drag for 30–60 days.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-red-950/20 border border-red-500/10">
                  <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-sm font-semibold text-white">Administrative Night Shifts</strong>
                    <p className="text-xs text-slate-400 mt-0.5">Spending 2 hours every night reconciling job notes, calculating labor time, and playing calendar Tetris.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Financial Impact Box */}
            <div className="mt-8 p-5 rounded-2xl bg-red-950/40 border border-red-500/30 flex items-center justify-between">
              <div>
                <span className="text-xs uppercase tracking-wider font-semibold text-red-300">Estimated Revenue Bleed</span>
                <div className="text-2xl sm:text-3xl font-extrabold text-red-400 mt-0.5">-$800 to -$2,500+</div>
                <span className="text-[11px] text-slate-400">Lost per month in missed calls & billing delays</span>
              </div>
              <span className="text-3xl">📉</span>
            </div>
          </motion.div>

          {/* THE AQUAFLOW SOLUTION CARD */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="rounded-3xl p-8 bg-gradient-to-b from-cyan-950/30 via-slate-900/70 to-slate-950/90 border border-cyan-500/40 shadow-[0_20px_50px_rgba(0,229,255,0.15)] flex flex-col justify-between relative"
          >
            {/* Best Value Badge */}
            <div className="absolute -top-3.5 right-8 px-4 py-1 rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 text-slate-950 font-extrabold text-xs tracking-wider uppercase shadow-lg">
              The AquaFlow Way
            </div>

            <div>
              <div className="flex items-center justify-between pb-6 border-b border-cyan-500/20">
                <div>
                  <span className="text-xs uppercase tracking-wider font-bold text-cyan-400">One Unified System</span>
                  <h3 className="text-2xl font-bold text-white mt-1">Autonomous Operations Engine</h3>
                </div>
                <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                  <TrendingUp className="w-7 h-7" />
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-cyan-950/20 border border-cyan-500/10">
                  <CheckCircle2 className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-sm font-semibold text-white">Instant Booking & Route Optimization</strong>
                    <p className="text-xs text-slate-300 mt-0.5">Customers book online 24/7 or your team books in 30 seconds. Jobs auto-assign to the closest technician.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-cyan-950/20 border border-cyan-500/10">
                  <CheckCircle2 className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-sm font-semibold text-white">Live Mobile Technician Workspace</strong>
                    <p className="text-xs text-slate-300 mt-0.5">Technicians see exact addresses, gate codes, parts required, and customer history on their phones.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-cyan-950/20 border border-cyan-500/10">
                  <CheckCircle2 className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-sm font-semibold text-white">On-Site Signatures & Instant Payments</strong>
                    <p className="text-xs text-slate-300 mt-0.5">Customers sign digitally on glass. Invoices generate with calculated taxes, and payment is collected via Stripe on the spot.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-cyan-950/20 border border-cyan-500/10">
                  <CheckCircle2 className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-sm font-semibold text-white">Evenings Reclaimed</strong>
                    <p className="text-xs text-slate-300 mt-0.5">Everything is logged automatically during the workday. When you clock out, your administrative work is already done.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Financial Impact Box */}
            <div className="mt-8 p-5 rounded-2xl bg-gradient-to-r from-cyan-950/60 to-blue-950/60 border border-cyan-500/40 flex items-center justify-between shadow-[0_0_20px_rgba(0,229,255,0.2)]">
              <div>
                <span className="text-xs uppercase tracking-wider font-semibold text-cyan-300">Founding Pilot Cost</span>
                <div className="text-2xl sm:text-3xl font-extrabold text-white mt-0.5">
                  $199 <span className="text-sm font-normal text-slate-300">/ month</span>
                </div>
                <span className="text-[11px] text-cyan-300">Less than what you earn on a single minor service call</span>
              </div>
              <span className="text-3xl">🚀</span>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
