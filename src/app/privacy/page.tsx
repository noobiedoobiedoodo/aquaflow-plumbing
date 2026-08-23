import React from 'react';
import Link from 'next/link';
import { Shield, Lock, ArrowLeft, Trash2, CheckCircle2, FileText } from 'lucide-react';

export const metadata = {
  title: 'Privacy Policy | AquaFlow Plumbing Operating System',
  description: 'PIPEDA and Quebec Law 25 Compliant Privacy Policy for AquaFlow Plumbing Operating System in Canada.',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-[#06090E] text-slate-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* TOP NAVIGATION */}
        <div className="flex items-center justify-between pb-6 border-b border-slate-800">
          <Link href="/" className="inline-flex items-center gap-2 text-cyan-400 text-xs font-bold hover:underline">
            <ArrowLeft className="w-4 h-4" />
            <span>Return to AquaFlow</span>
          </Link>
          <span className="text-xs text-slate-500 font-mono">Effective: August 2026</span>
        </div>

        {/* HEADER */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 text-xs font-bold uppercase tracking-wider">
            <Shield className="w-3.5 h-3.5" /> PIPEDA & Quebec Law 25 Compliant
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            AquaFlow Privacy & Data Protection Policy
          </h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            AquaFlow is dedicated to protecting the privacy, security, and confidentiality of plumbing contractors, technicians, and their residential and commercial customers across Canada and the United States.
          </p>
        </div>

        {/* CONTENT SECTIONS */}
        <div className="glass rounded-3xl p-6 sm:p-10 border border-slate-800 space-y-8 text-xs sm:text-sm text-slate-300 leading-relaxed">
          
          {/* Section 1 */}
          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-400 text-xs flex items-center justify-center font-mono">1</span>
              Compliance with Canadian Privacy Legislation
            </h2>
            <p>
              AquaFlow complies with the <em>Personal Information Protection and Electronic Documents Act</em> (<strong>PIPEDA</strong>), Alberta’s <em>Personal Information Protection Act</em> (<strong>PIPA</strong>), British Columbia’s <strong>PIPA</strong>, and Quebec’s <strong>Law 25</strong> (<em>An Act to modernize legislative provisions as regards the protection of personal information</em>).
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-400 text-xs flex items-center justify-center font-mono">2</span>
              Information We Collect & Purpose
            </h2>
            <p>We collect only the minimum necessary information required to deliver field dispatch, automated customer notifications, and invoicing services:</p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
              <li><strong>Contractor Account Information:</strong> Company name, owner/administrator contact name, business address, email, phone number, and fleet size.</li>
              <li><strong>Customer & Work Order Records:</strong> Homeowner/property contact details, service location address, plumbing job description, equipment serial numbers, and job history.</li>
              <li><strong>Billing & Payment Tokens:</strong> Payment transactions are tokenized directly via Stripe (PCI-DSS Level 1 certified). AquaFlow never stores raw credit card numbers.</li>
            </ul>
          </section>

          {/* Section 3: Right to Deletion & Erasure */}
          <section className="space-y-3 p-5 rounded-2xl bg-slate-900/80 border border-cyan-500/30">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-cyan-400" />
              <span>3. Your Right to Deletion, Rectification & Erasure</span>
            </h2>
            <p>
              Under Canadian privacy law and Quebec Law 25, you and your customers have the permanent <strong>Right to Erasure</strong>:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
              <li><strong>1-Click Deletion:</strong> Organizations can permanently delete applications, cold outreach records, technician accounts, and customer profiles directly from the administrative console.</li>
              <li><strong>Complete Tenant Purge:</strong> If a contractor cancels their subscription, all associated job records, customer databases, and uploaded photos can be permanently expunged upon request.</li>
              <li><strong>Erasure Requests:</strong> To request complete data erasure, contact our Data Privacy Officer at <a href="mailto:privacy@aquaflowplumbing.com" className="text-cyan-400 underline">privacy@aquaflowplumbing.com</a>. Requests are fulfilled within 30 business days.</li>
            </ul>
          </section>

          {/* Section 4: Data Residency & Security */}
          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-400 text-xs flex items-center justify-center font-mono">4</span>
              Data Storage & Security Safeguards
            </h2>
            <p>
              All personal data is encrypted in transit using <strong>TLS 1.3</strong> and at rest using <strong>AES-256</strong>. Databases are hosted in secure, isolated multi-tenant environments with strict role-based access control (RBAC). Canadian organizations have the option for primary data storage hosted in AWS Canada Central (<code>ca-central-1</code> - Montreal).
            </p>
          </section>

          {/* Section 5: CASL & Communications */}
          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-400 text-xs flex items-center justify-center font-mono">5</span>
              CASL (Canada’s Anti-Spam Legislation) Compliance
            </h2>
            <p>
              All automated dispatch emails, homeowner appointment reminders, and promotional updates include transparent sender identification and instant 1-click unsubscribe mechanisms. We never sell, rent, or trade your data to third parties.
            </p>
          </section>

          {/* Section 6: Contact Privacy Officer */}
          <section className="space-y-3 pt-4 border-t border-slate-800">
            <h2 className="text-base sm:text-lg font-bold text-white">6. Designated Privacy Officer Contact</h2>
            <p>
              If you have any questions regarding your data or wish to exercise your rights under PIPEDA or Quebec Law 25, please contact:
            </p>
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-1 font-mono">
              <div className="text-white font-bold">AquaFlow Data Protection & Privacy Office</div>
              <div className="text-slate-400">Email: <a href="mailto:privacy@aquaflowplumbing.com" className="text-cyan-400">privacy@aquaflowplumbing.com</a></div>
              <div className="text-slate-400">Jurisdiction: Canada / PIPEDA Compliance</div>
            </div>
          </section>

        </div>

        {/* FOOTER */}
        <div className="text-center text-xs text-slate-500 space-x-4">
          <Link href="/terms" className="hover:text-cyan-400 transition-colors">Terms of Service</Link>
          <span>•</span>
          <Link href="/pilot" className="hover:text-cyan-400 transition-colors">Founding Pilot Program</Link>
          <span>•</span>
          <Link href="/login" className="hover:text-cyan-400 transition-colors">Client Portal</Link>
        </div>
      </div>
    </div>
  );
}
