'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PhoneCall, Calendar, Navigation, Clock, PenTool, Receipt, CreditCard, Sparkles, CheckCircle2, ArrowRight } from 'lucide-react';

const JOURNEY_STAGES = [
  {
    step: '01',
    title: 'Customer Calls or Books Online',
    icon: PhoneCall,
    tagline: 'Never lose a high-value emergency job again',
    description: 'Homeowner requests service via your customized booking link or phone. Customer record, address, and job details are captured immediately.',
    detail: 'Instant intake • Zero double-entry • Automated SMS confirmation',
    mockVisual: {
      type: 'intake',
      badge: 'New Booking',
      time: '2 mins ago',
      title: 'Emergency Main Line Drain Backup',
      customer: 'Sarah Jenkins • 742 Evergreen Terrace',
      amount: '$250.00 Base Rate',
    },
  },
  {
    step: '02',
    title: 'Dispatch Assigns & Routes in 30 Seconds',
    icon: Calendar,
    tagline: 'Stop playing calendar Tetris',
    description: 'Dispatch sees technician availability, current locations, and skills. Assign the closest technician with one click.',
    detail: 'Visual calendar • GPS distance estimation • Automated schedule sync',
    mockVisual: {
      type: 'dispatch',
      badge: 'Dispatched',
      time: '1 min ago',
      title: 'Assigned to Mike (Lead Tech)',
      customer: 'Vehicle #3 • ETA 18 mins',
      amount: 'Optimal Route Selected',
    },
  },
  {
    step: '03',
    title: 'Technician Gets All Notes on Mobile',
    icon: Navigation,
    tagline: 'No more texting gate codes and addresses',
    description: 'Technician receives instant mobile notification with driving directions, customer notes, historical service records, and parts list.',
    detail: 'One-tap GPS navigation • Gate codes & photos • Mobile clock-in',
    mockVisual: {
      type: 'mobile',
      badge: 'Technician Workspace',
      time: 'En Route',
      title: 'Status: EN_ROUTE ➔ ARRIVED',
      customer: 'Gate Code: #4829 • Dog in Backyard',
      amount: 'Clocked In: 10:14 AM',
    },
  },
  {
    step: '04',
    title: 'Work Completed & Signature Captured',
    icon: PenTool,
    tagline: 'Proof of work before leaving the driveway',
    description: 'Technician logs parts used, clocks out labor, takes before/after job photos, and captures customer sign-off directly on glass.',
    detail: 'Digital signature on glass • Encrypted S3 photo archive • Legal proof of completion',
    mockVisual: {
      type: 'signature',
      badge: 'Signed & Approved',
      time: 'Just now',
      title: 'Customer Signature Verified',
      customer: 'Signed by: Sarah Jenkins',
      amount: 'Labor: 1.5 hrs + 2x P-Trap Kit',
    },
  },
  {
    step: '05',
    title: 'Invoice Generated & Payment Collected',
    icon: CreditCard,
    tagline: 'Get paid immediately without chasing accounts',
    description: 'AquaFlow calculates labor, materials, and taxes automatically. Customer pays via tap/card or customer portal. Funds route directly to your bank via Stripe.',
    detail: 'Automated tax math • Instant Stripe settlement • Zero unpaid invoices',
    mockVisual: {
      type: 'payment',
      badge: 'PAID ($437.50 CAD)',
      time: 'Settled',
      title: 'Invoice #INV-2026-8841',
      customer: 'Paid via Visa (•••• 4242)',
      amount: 'Status: 100% PAID IN FULL',
    },
  },
];

export function PilotOperationalJourney() {
  const [activeStage, setActiveStage] = useState(0);
  const current = JOURNEY_STAGES[activeStage];
  const IconComponent = current.icon;

  return (
    <section id="how-it-works" className="py-24 bg-[#05080B] relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-blue-600/10 rounded-full blur-[160px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-950/40 border border-cyan-500/30 text-cyan-400 text-xs font-bold uppercase tracking-wider mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            Built Specifically For Plumbing Operations
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
            From the first customer call to the final payment.
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-300">
            AquaFlow keeps the entire job moving through a single, seamless lifecycle. No lost paper slips, no duplicate data entry, and no forgotten invoices.
          </p>
        </div>

        {/* Interactive Stepper Navigation */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-10">
          {JOURNEY_STAGES.map((stage, idx) => {
            const StageIcon = stage.icon;
            const isActive = idx === activeStage;
            return (
              <button
                key={stage.step}
                onClick={() => setActiveStage(idx)}
                className={`flex flex-col items-start p-4 rounded-2xl border text-left transition-all relative ${
                  isActive
                    ? 'bg-gradient-to-b from-cyan-950/60 to-slate-900/90 border-cyan-400 shadow-[0_0_25px_rgba(0,229,255,0.25)]'
                    : 'bg-slate-900/40 hover:bg-slate-800/50 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-3">
                  <span className={`text-xs font-mono font-bold ${isActive ? 'text-cyan-400' : 'text-slate-500'}`}>
                    STAGE {stage.step}
                  </span>
                  <StageIcon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`} />
                </div>
                <span className={`text-xs sm:text-sm font-bold line-clamp-1 ${isActive ? 'text-white' : 'text-slate-300'}`}>
                  {stage.title.split(' ')[0]} {stage.title.split(' ')[1]}
                </span>
                {isActive && (
                  <motion.div
                    layoutId="active-indicator"
                    className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 to-cyan-400"
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Interactive Stage Showcase Card */}
        <div className="glass rounded-3xl p-8 sm:p-12 border border-cyan-500/30 shadow-[0_25px_60px_rgba(0,0,0,0.8)] relative">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left Content Column */}
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold">
                <IconComponent className="w-3.5 h-3.5" />
                Stage {current.step} — {current.tagline}
              </div>

              <h3 className="text-2xl sm:text-3xl font-extrabold text-white leading-snug">
                {current.title}
              </h3>

              <p className="text-slate-300 text-base sm:text-lg leading-relaxed">
                {current.description}
              </p>

              <div className="flex items-center gap-2 text-sm text-cyan-300 font-medium pt-2">
                <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>{current.detail}</span>
              </div>

              <div className="pt-4 flex items-center gap-4">
                <button
                  onClick={() => setActiveStage((prev) => (prev + 1) % JOURNEY_STAGES.length)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold border border-slate-700 hover:border-cyan-500/50 transition-all"
                >
                  <span>Next Stage</span>
                  <ArrowRight className="w-4 h-4 text-cyan-400" />
                </button>
                <span className="text-xs text-slate-500">
                  {activeStage + 1} of {JOURNEY_STAGES.length} operational phases
                </span>
              </div>
            </div>

            {/* Right Mock UI Card */}
            <div className="lg:col-span-5">
              <AnimatePresence mode="wait">
                <motion.div
                  key={current.step}
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="rounded-2xl p-6 bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 shadow-2xl relative overflow-hidden"
                >
                  <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                    <span className="px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-400 text-xs font-bold border border-cyan-500/20">
                      {current.mockVisual.badge}
                    </span>
                    <span className="text-xs text-slate-500">{current.mockVisual.time}</span>
                  </div>

                  <div className="mt-5 space-y-3">
                    <div className="text-lg font-bold text-white">
                      {current.mockVisual.title}
                    </div>
                    <div className="text-sm text-slate-300 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                      {current.mockVisual.customer}
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-between text-xs">
                      <span className="text-slate-400">Operational Sync:</span>
                      <span className="font-semibold text-emerald-400">{current.mockVisual.amount}</span>
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
                    <span>AquaFlow Cloud Sync</span>
                    <span className="text-cyan-400">100% Real-Time</span>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
