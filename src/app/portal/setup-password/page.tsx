'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Lock, ShieldCheck, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';
import { setCustomerPermanentPassword } from '@/app/actions/customer-auth';
import { toast } from 'sonner';

export default function SetupPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters long');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsSubmitting(true);
    const formData = new FormData();
    formData.append('password', password);

    const res = await setCustomerPermanentPassword(formData);
    setIsSubmitting(false);

    if (res.success) {
      setIsCompleted(true);
      toast.success('Your permanent account has been activated!');
      setTimeout(() => {
        router.push('/portal/dashboard');
        router.refresh();
      }, 1500);
    } else {
      toast.error(res.error || 'Failed to set password');
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-neutral-200 rounded-3xl p-8 shadow-xl relative overflow-hidden">
        <div className="w-12 h-12 bg-blue-50 border border-blue-200 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Lock className="w-6 h-6" />
        </div>

        <h1 className="text-2xl font-bold text-center text-neutral-900 tracking-tight">
          Create Your Permanent Password
        </h1>
        <p className="text-sm text-center text-neutral-500 mt-2 mb-6">
          Set a secure password so you can return to your customer portal anytime using your email.
        </p>

        {isCompleted ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center space-y-3">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
            <h3 className="font-semibold text-emerald-900">Account Permanently Activated!</h3>
            <p className="text-xs text-emerald-700">Redirecting you to your portal dashboard...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1">
                New Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                placeholder="At least 8 characters"
                className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                placeholder="Repeat your password"
                className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Activating...
                  </>
                ) : (
                  <>
                    Activate Permanent Account <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>

            <div className="text-center pt-2">
              <Link
                href="/portal/dashboard"
                className="text-xs text-neutral-400 hover:text-neutral-700 transition"
              >
                Skip for now & go to dashboard
              </Link>
            </div>
          </form>
        )}

        <div className="mt-6 pt-4 border-t border-neutral-100 flex items-center justify-center gap-1.5 text-[11px] text-neutral-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Multi-Tenant End-to-End Encrypted Identity
        </div>
      </div>
    </div>
  );
}
