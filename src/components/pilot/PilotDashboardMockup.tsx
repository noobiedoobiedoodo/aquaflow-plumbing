'use client';

import React, { useState } from 'react';
import { DollarSign, CheckCircle, Clock, Users, MapPin, Truck, ChevronRight, Activity, Bell, Search, Filter } from 'lucide-react';
import { motion } from 'framer-motion';

const MOCK_JOBS = [
  {
    id: 'JOB-2026-01',
    time: '9:00 AM',
    customer: 'Smith Residence',
    address: '428 Riverbend Rd',
    service: 'Main Drain Jetting',
    tech: 'Mike Reynolds',
    techAvatar: 'MR',
    status: 'EN_ROUTE',
    statusColor: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    amount: '$350.00',
  },
  {
    id: 'JOB-2026-02',
    time: '11:30 AM',
    customer: 'Johnson Commercial',
    address: '1050 Main St #4',
    service: 'Commercial Water Heater',
    tech: 'Dave Kowalski',
    techAvatar: 'DK',
    status: 'WORKING',
    statusColor: 'bg-blue-500/10 text-cyan-400 border-cyan-500/30',
    amount: '$1,250.00',
  },
  {
    id: 'JOB-2026-03',
    time: '2:00 PM',
    customer: 'Wilson Home',
    address: '89 Willow Creek Way',
    service: 'Garbage Disposal Replacement',
    tech: 'Chris Vance',
    techAvatar: 'CV',
    status: 'SCHEDULED',
    statusColor: 'bg-slate-500/10 text-slate-300 border-slate-700',
    amount: '$225.00',
  },
  {
    id: 'JOB-2026-04',
    time: '4:15 PM',
    customer: 'Maplewood Estates',
    address: '2204 Maplewood Dr',
    service: 'Emergency Sump Pump',
    tech: 'Alex Rivera',
    techAvatar: 'AR',
    status: 'PAID',
    statusColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    amount: '$551.25',
  },
];

export function PilotDashboardMockup() {
  const [filter, setFilter] = useState('ALL');

  const filteredJobs = MOCK_JOBS.filter((job) => {
    if (filter === 'ALL') return true;
    return job.status === filter;
  });

  return (
    <section id="dashboard-preview" className="py-24 bg-[#070C12] relative overflow-hidden border-t border-slate-900">
      {/* Ambient background glows */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-gradient-to-r from-blue-600/15 via-cyan-500/10 to-transparent rounded-full blur-[160px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-950/40 border border-cyan-500/30 text-cyan-400 text-xs font-bold uppercase tracking-wider mb-4">
            <Activity className="w-3.5 h-3.5" />
            Live Platform Demonstration
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
            One command center. Zero operational chaos.
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-300">
            See how AquaFlow gives you real-time visibility into today&apos;s revenue, active technician statuses, and instant customer payments.
          </p>
        </div>

        {/* MOCKUP CONTAINER */}
        <div className="rounded-3xl p-1 bg-gradient-to-b from-cyan-500/30 via-slate-800/40 to-slate-900/60 shadow-[0_30px_90px_rgba(0,0,0,0.9)]">
          <div className="bg-[#05080B] rounded-[22px] overflow-hidden border border-slate-800/80">
            {/* Top Mock Window Bar */}
            <div className="px-6 py-4 bg-[#0A1016] border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                <span className="ml-4 text-xs font-mono text-slate-400 hidden sm:inline">
                  aquaflow.app/dispatch-console
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Live Dispatch Feed</span>
                </div>
                <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400">
                  <Bell className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* Dashboard Inner Body */}
            <div className="p-6 sm:p-8 space-y-8">
              {/* 4 Metric Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Metric 1 */}
                <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Revenue Today</span>
                    <DollarSign className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="mt-3">
                    <div className="text-2xl sm:text-3xl font-extrabold text-white">$4,825.00</div>
                    <div className="text-xs text-emerald-400 font-semibold mt-1 flex items-center gap-1">
                      <span>↑ +$1,250 today</span>
                    </div>
                  </div>
                </div>

                {/* Metric 2 */}
                <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Jobs Completed</span>
                    <CheckCircle className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div className="mt-3">
                    <div className="text-2xl sm:text-3xl font-extrabold text-white">14</div>
                    <div className="text-xs text-slate-400 font-semibold mt-1">100% on-time</div>
                  </div>
                </div>

                {/* Metric 3 */}
                <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Outstanding</span>
                    <Clock className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="mt-3">
                    <div className="text-2xl sm:text-3xl font-extrabold text-white">$1,240.00</div>
                    <div className="text-xs text-slate-400 font-semibold mt-1">2 invoices pending</div>
                  </div>
                </div>

                {/* Metric 4 */}
                <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Technicians Active</span>
                    <Users className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="mt-3">
                    <div className="text-2xl sm:text-3xl font-extrabold text-white">4 / 4</div>
                    <div className="text-xs text-cyan-400 font-semibold mt-1">All in field</div>
                  </div>
                </div>
              </div>

              {/* Table Filter Tabs */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2">
                <div>
                  <h3 className="text-lg font-bold text-white">Today&apos;s Active Jobs</h3>
                  <p className="text-xs text-slate-400">Real-time technician tracking & dispatch lifecycle</p>
                </div>
                <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs">
                  {['ALL', 'EN_ROUTE', 'WORKING', 'SCHEDULED', 'PAID'].map((st) => (
                    <button
                      key={st}
                      onClick={() => setFilter(st)}
                      className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                        filter === st
                          ? 'bg-cyan-500 text-slate-950 shadow-md'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Jobs Table */}
              <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/60">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-[11px] uppercase tracking-wider bg-slate-900/50">
                      <th className="py-3 px-4 font-semibold">Time</th>
                      <th className="py-3 px-4 font-semibold">Customer & Address</th>
                      <th className="py-3 px-4 font-semibold">Service</th>
                      <th className="py-3 px-4 font-semibold">Assigned Tech</th>
                      <th className="py-3 px-4 font-semibold">Status</th>
                      <th className="py-3 px-4 font-semibold text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-200">
                    {filteredJobs.map((job) => (
                      <tr key={job.id} className="hover:bg-slate-900/40 transition-colors">
                        <td className="py-4 px-4 font-mono text-cyan-300 font-bold whitespace-nowrap">
                          {job.time}
                        </td>
                        <td className="py-4 px-4">
                          <div className="font-bold text-white">{job.customer}</div>
                          <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3 text-slate-500" />
                            {job.address}
                          </div>
                        </td>
                        <td className="py-4 px-4 text-slate-300">
                          {job.service}
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-blue-600 to-cyan-500 text-[10px] font-bold text-white flex items-center justify-center">
                              {job.techAvatar}
                            </div>
                            <span className="font-medium text-slate-200">{job.tech}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${job.statusColor}`}
                          >
                            {job.status}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right font-mono font-bold text-white whitespace-nowrap">
                          {job.amount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Bottom Console Status Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800/80 gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-400" />
                  <span>Stripe Connected & Automated Invoicing: Active</span>
                </div>
                <span className="text-slate-500 font-mono">Simulated Operational Preview</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
