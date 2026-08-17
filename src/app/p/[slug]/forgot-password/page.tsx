'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, KeyRound, CheckCircle2, Loader2, Shield } from 'lucide-react';
import { useParams } from 'next/navigation';
import { requestCustomerPasswordReset } from '@/app/actions/customer-auth';

export default function CustomerForgotPasswordPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug || '';

  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsSubmitting(true);
    await requestCustomerPasswordReset({ email, slug });
    setIsSubmitting(false);
    setIsSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-[140px] -z-10 pointer-events-none"></div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link
          href={`/p/${slug}/login`}
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition mb-6 font-medium"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Sign In
        </Link>
        <div className="w-12 h-12 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <KeyRound className="w-6 h-6" />
        </div>
        <h2 className="text-center text-3xl font-extrabold text-white tracking-tight">Reset Password</h2>
        <p className="mt-2 text-center text-sm text-slate-400">
          Enter the email associated with your customer account to receive reset instructions.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-slate-900/80 border border-slate-800 py-8 px-6 shadow-2xl rounded-2xl sm:px-10">
          {isSubmitted ? (
            <div className="bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 rounded-xl p-6 text-center space-y-3">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
              <h3 className="font-semibold text-white">Instructions Sent</h3>
              <p className="text-xs text-emerald-300/90 leading-relaxed">
                If an active customer account exists for <strong>{email}</strong> with this company, a secure reset link has been dispatched to your inbox.
              </p>
              <div className="pt-2">
                <Link
                  href={`/p/${slug}/login`}
                  className="inline-block text-xs text-cyan-400 hover:text-cyan-300 underline font-medium"
                >
                  Return to Sign In
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="name@example.com"
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-sm transition"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 px-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold rounded-xl text-sm shadow-lg shadow-cyan-500/25 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Sending...
                  </>
                ) : (
                  'Send Reset Link'
                )}
              </button>

              <div className="flex items-center gap-2 justify-center text-[11px] text-slate-500 pt-2 border-t border-slate-800">
                <Shield className="w-3.5 h-3.5" /> Anti-Enumeration Zero-Knowledge Security
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
