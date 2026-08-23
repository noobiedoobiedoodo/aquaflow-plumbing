import React from 'react';
import Link from 'next/link';
import { FileText, ShieldCheck, ArrowLeft, CheckCircle2 } from 'lucide-react';

export const metadata = {
  title: 'Terms of Service | AquaFlow Plumbing Operating System',
  description: 'Commercial Terms of Service and Master Subscription Agreement for AquaFlow Plumbing Operating System.',
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-[#06090E] text-slate-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* TOP NAVIGATION */}
        <div className="flex items-center justify-between pb-6 border-b border-slate-800">
          <Link href="/" className="inline-flex items-center gap-2 text-cyan-400 text-xs font-bold hover:underline">
            <ArrowLeft className="w-4 h-4" />
            <span>Return to AquaFlow</span>
          </Link>
          <span className="text-xs text-slate-500 font-mono">Last Updated: August 2026</span>
        </div>

        {/* HEADER */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 text-xs font-bold uppercase tracking-wider">
            <ShieldCheck className="w-3.5 h-3.5" /> Commercial SaaS Agreement
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            AquaFlow Terms of Service
          </h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            These Terms of Service govern the use of the AquaFlow software platform, mobile dispatch tools, scheduling engine, and invoicing infrastructure for plumbing contractors and commercial clients.
          </p>
        </div>

        {/* CONTENT SECTIONS */}
        <div className="glass rounded-3xl p-6 sm:p-10 border border-slate-800 space-y-8 text-xs sm:text-sm text-slate-300 leading-relaxed">
          
          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-400 text-xs flex items-center justify-center font-mono">1</span>
              Subscription & Founding Pilot Terms
            </h2>
            <p>
              AquaFlow is provided on a monthly subscription basis. Organizations enrolled under the <strong>Founding Partner Pilot Cohort</strong> lock in a lifetime rate of \$199/month USD/CAD with unlimited dispatch and zero per-technician seat licenses, provided their subscription remains active and in good standing.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-400 text-xs flex items-center justify-center font-mono">2</span>
              Customer Data Ownership & Deletion Rights
            </h2>
            <p>
              <strong>You own 100% of your data.</strong> All customer lists, work orders, service histories, pricing matrices, and technician logs uploaded to AquaFlow remain the exclusive intellectual property of the contractor. You maintain the permanent right to export your complete database or request full data deletion at any time.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-400 text-xs flex items-center justify-center font-mono">3</span>
              Payment Processing & Stripe Connect
            </h2>
            <p>
              Payment processing services for contractors on AquaFlow are provided by Stripe and are subject to the Stripe Connected Account Agreement. By accepting these terms, you agree to comply with Stripe’s service terms. AquaFlow does not take custody of customer invoice funds.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-400 text-xs flex items-center justify-center font-mono">4</span>
              Governing Law & Jurisdiction
            </h2>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of the Province of Manitoba and the federal laws of Canada applicable therein, without giving effect to any principles of conflicts of law.
            </p>
          </section>

          <section className="space-y-3 pt-4 border-t border-slate-800">
            <h2 className="text-base sm:text-lg font-bold text-white">5. Contact Information</h2>
            <p>
              For legal or contractual inquiries, please contact:
            </p>
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-1 font-mono">
              <div className="text-white font-bold">AquaFlow Legal & Compliance</div>
              <div className="text-slate-400">Email: <a href="mailto:support@aquaflowplumbing.com" className="text-cyan-400">support@aquaflowplumbing.com</a></div>
            </div>
          </section>

        </div>

        {/* FOOTER */}
        <div className="text-center text-xs text-slate-500 space-x-4">
          <Link href="/privacy" className="hover:text-cyan-400 transition-colors">Privacy Policy</Link>
          <span>•</span>
          <Link href="/pilot" className="hover:text-cyan-400 transition-colors">Founding Pilot Program</Link>
          <span>•</span>
          <Link href="/login" className="hover:text-cyan-400 transition-colors">Client Portal</Link>
        </div>
      </div>
    </div>
  );
}
