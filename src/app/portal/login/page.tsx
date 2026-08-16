'use client';

import { useState } from 'react';

export default function PortalLogin() {
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
        body: JSON.stringify({ email }),
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
    <div className="w-full max-w-md mx-auto mt-20">
      <div className="bg-white border border-neutral-200 rounded-2xl p-8 shadow-xl shadow-neutral-200/50">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-blue-600 tracking-tight">AquaFlow</h1>
          <h2 className="text-xl font-semibold text-neutral-900 mt-4">Customer Portal</h2>
          <p className="text-sm text-neutral-500 mt-2">Sign in to view your jobs, estimates, and invoices.</p>
        </div>

        {status === 'success' ? (
          <div className="bg-green-50 border border-green-200 text-green-800 rounded-xl p-6 text-center">
            <p className="font-medium">{message}</p>
            <p className="text-sm mt-2">You can close this window and open the link from your email.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-neutral-700 mb-1">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                placeholder="you@example.com"
              />
            </div>

            {status === 'error' && (
              <div className="text-sm text-red-600 font-medium">{message}</div>
            )}

            <button
              type="submit"
              disabled={status === 'loading'}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status === 'loading' ? 'Sending...' : 'Send Login Link'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
