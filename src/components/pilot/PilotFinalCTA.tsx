'use client';

import React from 'react';
import { ArrowRight, Sparkles, Droplets } from 'lucide-react';
import { motion } from 'framer-motion';

export function PilotFinalCTA() {
  return (
    <section className="py-28 bg-[#05080B] relative overflow-hidden text-center border-t border-slate-900">
      {/* Background Water Flow & Glow Effects */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-gradient-to-tr from-blue-600/25 via-cyan-500/20 to-teal-500/10 rounded-full blur-[160px] pointer-events-none -z-10" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="glass rounded-3xl p-10 sm:p-16 border border-cyan-500/30 shadow-[0_30px_90px_rgba(0,229,255,0.2)]"
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-950/60 border border-cyan-500/40 text-cyan-300 text-xs font-bold uppercase tracking-wider mb-6">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            Join the 3-Company Founding Pilot
          </div>

          <h2 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-tight max-w-3xl mx-auto">
            Your plumbing business is already busy.{' '}
            <span className="bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-500 bg-clip-text text-transparent">
              Your software shouldn&apos;t make it harder.
            </span>
          </h2>

          <p className="mt-6 text-base sm:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
            AquaFlow brings your jobs, technicians, customers, invoices, and payments into one seamless operating system.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="#apply"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-10 py-5 rounded-2xl bg-gradient-to-r from-blue-600 via-cyan-500 to-cyan-400 text-slate-950 font-extrabold text-lg shadow-[0_0_40px_rgba(0,229,255,0.6)] hover:shadow-[0_0_60px_rgba(0,229,255,0.9)] hover:scale-[1.03] transition-all"
            >
              <span>Apply for the Founding Pilot</span>
              <ArrowRight className="w-5 h-5" />
            </a>
          </div>

          <div className="mt-6 text-xs text-slate-400 font-medium">
            3 founding pilot companies • $199/month • Direct founder onboarding & Slack support
          </div>
        </motion.div>
      </div>
    </section>
  );
}
