'use client';

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Lock, CheckCircle2, Loader2, ShieldCheck, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token') || '';
  const slug = searchParams.get('slug') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      toast.error('Missing reset token');
      return;
    }
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      });

      const data = await res.json();
      setIsSubmitting(false);

      if (res.ok && data.success) {
        setIsSuccess(true);
        toast.success('Password reset successfully!');
      } else {
        setErrorMessage(data.error || 'Failed to reset password');
        toast.error(data.error || 'Failed to reset password');
      }
    } catch {
      setIsSubmitting(false);
      setErrorMessage('Network error. Please try again.');
    }
  };

  const loginRedirect = slug ? `/p/${slug}/login` : '/login';

  return (
    <div className="w-full max-w-md bg-white border border-neutral-200 rounded-3xl p-8 shadow-xl relative overflow-hidden">
      <div className="w-12 h-12 bg-blue-50 border border-blue-200 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <Lock className="w-6 h-6" />
      </div>

      <h1 className="text-2xl font-bold text-center text-neutral-900 tracking-tight">
        Set New Password
      </h1>
      <p className="text-sm text-center text-neutral-500 mt-2 mb-6">
        Enter a new secure password for your account.
      </p>

      {isSuccess ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center space-y-4">
          <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
          <h3 className="font-semibold text-emerald-900">Password Successfully Updated!</h3>
          <p className="text-xs text-emerald-700 leading-relaxed">
            All previous sessions have been safely invalidated. You can now sign in with your new password.
          </p>
          <div className="pt-2">
            <Link
              href={loginRedirect}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm shadow-md transition"
            >
              Sign In Now <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {!token && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">
              Invalid or missing password reset link. Please request a new reset email.
            </div>
          )}

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
              Confirm New Password
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

          {errorMessage && (
            <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 p-3 rounded-lg font-medium">
              {errorMessage}
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting || !token}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Updating...
                </>
              ) : (
                'Save New Password'
              )}
            </button>
          </div>
        </form>
      )}

      <div className="mt-6 pt-4 border-t border-neutral-100 flex items-center justify-center gap-1.5 text-[11px] text-neutral-400">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Cryptographic Single-Use Token Verification
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
      <Suspense fallback={<div className="text-sm text-neutral-500">Loading reset form...</div>}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
