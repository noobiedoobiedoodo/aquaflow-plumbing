'use client';

import { useState } from 'react';
import * as Sentry from '@sentry/nextjs';

export default function SentryExamplePage() {
  const [serverStatus, setServerStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const triggerClientError = () => {
    const error = new Error('Sentry Frontend Test Error - AquaFlow Client Verification');
    Sentry.captureException(error);
    throw error;
  };

  const triggerServerError = async () => {
    setLoading(true);
    setServerStatus(null);
    try {
      const res = await fetch('/api/sentry-example-api');
      if (!res.ok) {
        setServerStatus('Server error triggered successfully (HTTP 500). Sentry captured the backend exception.');
      } else {
        setServerStatus('Server responded with 200 OK.');
      }
    } catch (err: any) {
      setServerStatus(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="max-w-lg w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-indigo-500/10 text-indigo-400 rounded-xl flex items-center justify-center font-bold text-lg border border-indigo-500/20">
            S
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Sentry Verification Page</h1>
            <p className="text-xs text-slate-400">Org: <span className="text-indigo-400 font-mono">stephan-sabeski</span> | Project: <span className="text-indigo-400 font-mono">javascript-nextjs</span></p>
          </div>
        </div>

        {!process.env.NEXT_PUBLIC_SENTRY_DSN && (
          <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 space-y-1">
            <p className="font-semibold flex items-center space-x-1.5">
              <span>⚠️</span>
              <span>NEXT_PUBLIC_SENTRY_DSN is missing in your .env</span>
            </p>
            <p className="text-amber-400/90 leading-relaxed">
              Sentry cannot send errors without a DSN. Add <code>NEXT_PUBLIC_SENTRY_DSN=...</code> from your Sentry dashboard to your <code>.env</code> file.
            </p>
          </div>
        )}

        <p className="text-sm text-slate-300 leading-relaxed">
          Use the buttons below to trigger test exceptions and verify that error monitoring, stack traces, and breadcrumbs are arriving in your Sentry dashboard.
        </p>

        <div className="space-y-3 pt-2">
          <button
            onClick={triggerClientError}
            className="w-full py-3 px-4 bg-red-600/90 hover:bg-red-600 text-white font-medium rounded-xl transition-all shadow-lg shadow-red-600/20 flex items-center justify-center space-x-2 active:scale-98"
          >
            <span>💥 Trigger Client-Side Error</span>
          </button>

          <button
            onClick={triggerServerError}
            disabled={loading}
            className="w-full py-3 px-4 bg-indigo-600/90 hover:bg-indigo-600 text-white font-medium rounded-xl transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center space-x-2 active:scale-98 disabled:opacity-50"
          >
            <span>{loading ? 'Triggering...' : '⚡ Trigger Server API Error'}</span>
          </button>
        </div>

        {serverStatus && (
          <div className="p-4 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-slate-200">
            {serverStatus}
          </div>
        )}

        <div className="pt-4 border-t border-slate-800 text-xs text-slate-500 text-center">
          After clicking, check your <a href="https://sentry.io" target="_blank" rel="noreferrer" className="text-indigo-400 underline hover:text-indigo-300">Sentry Issues</a> tab.
        </div>
      </div>
    </div>
  );
}
