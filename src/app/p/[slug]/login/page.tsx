'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, User, Shield, CheckCircle } from 'lucide-react';
import { useParams } from 'next/navigation';

export default function PlumberPortalLogin() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;

  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setStatus('loading');
    try {
      const res = await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, organizationSlug: slug }),
      });

      if (res.ok) {
        const data = await res.json();
        setStatus('success');
        setMessage(data.message);
      } else {
        const text = await res.text();
        setStatus('error');
        setMessage(text || 'An error occurred. Please try again.');
      }
    } catch (err) {
      setStatus('error');
      setMessage('Network error. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-[140px] -z-10 pointer-events-none"></div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link
          href={`/p/${slug}`}
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition mb-6 font-medium"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Company Page
        </Link>
        <div className="w-12 h-12 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <User className="w-6 h-6" />
        </div>
        <h2 className="text-center text-3xl font-extrabold text-white tracking-tight">Customer Portal</h2>
        <p className="mt-2 text-center text-sm text-slate-400">
          Sign in to view your service history, estimates, and invoices.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-slate-900/80 border border-slate-800 py-8 px-6 shadow-2xl rounded-2xl sm:px-10">
          {status === 'success' ? (
            <div className="bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 rounded-xl p-6 text-center">
              <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-3 text-emerald-400">
                <CheckCircle className="w-6 h-6" />
              </div>
              <p className="font-semibold text-white">{message}</p>
              <p className="text-xs text-emerald-400 mt-2">Check your email for your secure sign-in link.</p>
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

              {status === 'error' && (
                <div className="text-xs text-rose-400 bg-rose-950/40 border border-rose-900/50 p-3 rounded-lg font-medium">
                  {message}
                </div>
              )}

              <button
                type="submit"
                disabled={status === 'loading'}
                className="w-full py-3 px-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold rounded-xl text-sm shadow-lg shadow-cyan-500/25 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {status === 'loading' ? 'Sending Link...' : 'Email Sign-in Link'}
              </button>

              <div className="flex items-center gap-2 justify-center text-[11px] text-slate-500 pt-2 border-t border-slate-800">
                <Shield className="w-3.5 h-3.5" /> Passwordless Magic Link Authentication
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
