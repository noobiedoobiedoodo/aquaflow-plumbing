'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Lock, Mail } from 'lucide-react';
import Link from 'next/link';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get('redirect') || '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to login');
      }

      // If explicit redirect param is present, respect it
      if (searchParams.get('redirect')) {
        window.location.href = redirectPath;
        return;
      }

      // Role-aware destination: technicians go to /tech/dashboard, admins to /dashboard
      const isAdmin = data.memberships?.some((m: any) =>
        ['SUPER_ADMIN', 'ADMIN', 'DISPATCHER'].includes(m.role)
      );
      const isTech = data.memberships?.some((m: any) => m.role === 'TECHNICIAN');

      if (isTech && !isAdmin) {
        window.location.href = '/tech/dashboard';
      } else {
        window.location.href = '/dashboard';
      }
    } catch (err: any) {
      setError(err.message);
      setIsLoading(false);
    }
  };

  return (
    <div className="glass rounded-2xl border border-border p-8 shadow-2xl relative z-10">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-white mb-2">Welcome Back</h1>
        <p className="text-muted-text">Sign in to access your dashboard</p>
      </div>

      <form onSubmit={handleLogin} className="space-y-5">
        {error && (
          <div className="p-3 rounded-lg bg-danger/10 border border-danger/30 text-danger text-sm text-center">
            {error}
          </div>
        )}

        <div className="space-y-1">
          <label className="text-sm font-medium text-white/80 pl-1">Email Address</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Mail className="w-5 h-5 text-muted-text" />
            </div>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-secondary-bg/50 border border-border rounded-xl text-white focus:outline-none focus:border-primary-blue focus:ring-1 focus:ring-primary-blue transition-all"
              placeholder="admin@aquaflowplumbing.com"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-white/80 pl-1">Password</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Lock className="w-5 h-5 text-muted-text" />
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-secondary-bg/50 border border-border rounded-xl text-white focus:outline-none focus:border-primary-blue focus:ring-1 focus:ring-primary-blue transition-all"
              placeholder="••••••••"
            />
          </div>
        </div>

        <Button
          type="submit"
          disabled={isLoading}
          className="w-full py-6 text-base font-bold tracking-wide mt-2"
        >
          {isLoading ? 'Authenticating...' : 'Sign In'}
        </Button>
      </form>

      <div className="mt-6 pt-6 border-t border-border/50 text-center text-sm">
        <span className="text-muted-text">New plumbing business? </span>
        <Link href="/signup" className="text-water-cyan hover:underline font-semibold">
          Create an AquaFlow Account
        </Link>
      </div>

      <div className="mt-4 text-center text-xs text-muted-text">
        For development demo access, use <br/>
        <code className="text-primary-blue bg-primary-blue/10 px-1 py-0.5 rounded mt-1 inline-block">admin@aquaflowplumbing.com</code> / <code className="text-primary-blue bg-primary-blue/10 px-1 py-0.5 rounded">admin123</code>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-blue/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-water-cyan/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="relative w-10 h-10 flex items-center justify-center">
              <div className="absolute inset-0 bg-primary-blue rounded-lg rotate-45 group-hover:rotate-90 transition-transform duration-500 opacity-20"></div>
              <div className="absolute inset-1 bg-gradient-to-tr from-primary-blue to-water-cyan rounded-md rotate-12"></div>
              <div className="absolute w-2.5 h-2.5 bg-background rounded-full"></div>
            </div>
            <span className="font-bold text-2xl text-white tracking-tight">AquaFlow</span>
          </Link>
        </div>

        <Suspense fallback={<div className="glass rounded-2xl border border-border p-8 text-center text-white">Loading...</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
