'use client';

import { useState } from 'react';
import Link from 'next/link';
import { registerTenant } from '@/app/actions/onboarding';
import { Droplets, Building2, User, Mail, Lock, ArrowRight, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function SignupPage() {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData(e.currentTarget);
      const result = await registerTenant(formData);

      if (result.success) {
        // Direct full-page load ensures cookies are sent immediately with server requests
        window.location.href = '/dashboard';
      } else {
        const errorDetails = result.details?.fieldErrors
          ? Object.values(result.details.fieldErrors).flat().join(', ')
          : '';
        setError(errorDetails || result.error || 'Signup failed. Please try again.');
        setIsLoading(false);
      }
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred during signup.');
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12 relative overflow-hidden">
      {/* Background glow elements */}
      <div className="absolute -top-40 -left-40 w-80 h-80 bg-primary-blue/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-80 h-80 bg-water-cyan/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md space-y-8 relative z-10">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <Link href="/" className="inline-flex items-center gap-2 group mb-2">
            <div className="relative flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-primary-blue to-water-cyan p-0.5 shadow-lg shadow-primary-blue/20">
              <div className="absolute inset-0 bg-card rounded-xl m-[1px]" />
              <Droplets className="w-6 h-6 text-water-cyan relative z-10 group-hover:scale-110 transition-transform duration-300" />
            </div>
            <span className="font-sans font-bold text-2xl tracking-tight text-white">
              Aqua<span className="text-water-cyan">Flow</span>
            </span>
          </Link>
          <h2 className="text-3xl font-bold tracking-tight text-white">
            Start using AquaFlow
          </h2>
          <p className="text-sm text-muted-text max-w-sm mx-auto">
            The modern operating system & dispatch platform for plumbing companies.
          </p>
        </div>

        {/* Signup Card */}
        <div className="bg-card border border-border/80 rounded-2xl p-8 shadow-2xl backdrop-blur-sm space-y-6">
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-sm text-red-400 flex items-start gap-3">
              <span className="text-red-400 font-bold">!</span>
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="companyName" className="block text-xs font-semibold uppercase tracking-wider text-muted-text mb-2">
                Company Name
              </label>
              <div className="relative">
                <Building2 className="w-5 h-5 text-muted-text/60 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="companyName"
                  name="companyName"
                  type="text"
                  required
                  placeholder="Apex Plumbing & Heating"
                  className="w-full bg-background border border-border rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder:text-muted-text/40 focus:outline-none focus:border-primary-blue focus:ring-1 focus:ring-primary-blue transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="firstName" className="block text-xs font-semibold uppercase tracking-wider text-muted-text mb-2">
                  First Name
                </label>
                <div className="relative">
                  <User className="w-5 h-5 text-muted-text/60 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="firstName"
                    name="firstName"
                    type="text"
                    required
                    placeholder="John"
                    className="w-full bg-background border border-border rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder:text-muted-text/40 focus:outline-none focus:border-primary-blue focus:ring-1 focus:ring-primary-blue transition-all"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="lastName" className="block text-xs font-semibold uppercase tracking-wider text-muted-text mb-2">
                  Last Name
                </label>
                <input
                  id="lastName"
                  name="lastName"
                  type="text"
                  required
                  placeholder="Doe"
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-white placeholder:text-muted-text/40 focus:outline-none focus:border-primary-blue focus:ring-1 focus:ring-primary-blue transition-all"
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-muted-text mb-2">
                Work Email Address
              </label>
              <div className="relative">
                <Mail className="w-5 h-5 text-muted-text/60 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="john@apexplumbing.com"
                  className="w-full bg-background border border-border rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder:text-muted-text/40 focus:outline-none focus:border-primary-blue focus:ring-1 focus:ring-primary-blue transition-all"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-muted-text mb-2">
                Password (min. 8 characters)
              </label>
              <div className="relative">
                <Lock className="w-5 h-5 text-muted-text/60 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  placeholder="••••••••••••"
                  className="w-full bg-background border border-border rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder:text-muted-text/40 focus:outline-none focus:border-primary-blue focus:ring-1 focus:ring-primary-blue transition-all"
                />
              </div>
            </div>

            <Button
              type="submit"
              size="lg"
              disabled={isLoading}
              className="w-full mt-4 bg-primary-blue hover:bg-primary-blue/90 text-white font-medium py-3 rounded-xl transition-all shadow-lg shadow-primary-blue/20 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Creating Company Account...</span>
                </>
              ) : (
                <>
                  <span>Create Account & Start Trial</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </form>

          <div className="pt-4 border-t border-border/50 text-center space-y-3">
            <p className="text-xs text-muted-text">
              Already have an account?{' '}
              <Link href="/login" className="text-primary-blue hover:text-water-cyan font-medium transition-colors">
                Sign in
              </Link>
            </p>
            <div className="flex items-center justify-center gap-2 text-xs text-muted-text/60">
              <ShieldCheck className="w-4 h-4 text-success" />
              <span>Instant Setup • No Long-Term Contracts • 256-bit Encryption</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
