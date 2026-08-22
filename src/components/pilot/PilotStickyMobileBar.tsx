'use client';

import React from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';

export function PilotStickyMobileBar() {
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 p-3 bg-[#05080B]/95 backdrop-blur-xl border-t border-cyan-500/30 shadow-[0_-10px_30px_rgba(0,0,0,0.8)]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5 text-xs font-bold text-white">
            <span>Founding Pilot</span>
            <span className="px-1.5 py-0.2 text-[10px] bg-cyan-500/20 text-cyan-400 rounded">3 Spots</span>
          </div>
          <span className="text-[11px] text-cyan-300 font-semibold">$199 / month</span>
        </div>
        <a
          href="#apply"
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-slate-950 font-bold text-xs shadow-lg"
        >
          <span>Apply Now</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
}
