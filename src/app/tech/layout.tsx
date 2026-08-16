import { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth/session';
import { ROLES, ADMIN_ROLES } from '@/lib/constants';
import { BottomNav } from '@/components/tech/BottomNav';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Technician Portal | AquaFlow',
  description: 'Mobile-first job execution workspace for field technicians.',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0',
};

export default async function TechLayout({ children }: { children: ReactNode }) {
  // Enforce server-side RBAC for technicians
  // Admins and Dispatchers can also access this for testing/viewing
  try {
    const allowedRoles = [...ADMIN_ROLES, ROLES.TECHNICIAN];
    await requireRole(allowedRoles);
  } catch (error) {
    // If not authenticated or not authorized, kick them out
    redirect('/login?redirect=/tech/dashboard');
  }

  return (
    <div className="min-h-screen bg-background text-white pb-24">
      {/* 
        pb-24 ensures that the content does not hide behind the fixed BottomNav.
        We don't use a Sidebar here because this is heavily optimized for mobile.
      */}
      <main className="w-full max-w-lg mx-auto min-h-screen relative shadow-2xl bg-secondary-bg/20">
        {children}
      </main>

      <div className="w-full max-w-lg mx-auto">
        <BottomNav />
      </div>
    </div>
  );
}
