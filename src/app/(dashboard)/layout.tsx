import { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/constants';
import { Sidebar } from '@/components/dashboard/Sidebar';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Dispatch Dashboard | AquaFlow',
  description: 'Operational control plane for dispatchers and administrators.',
};

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  // Enforce server-side RBAC
  try {
    await requireRole(ADMIN_ROLES);
  } catch (error) {
    // If not authenticated or not authorized, kick them out
    redirect('/login?redirect=/dashboard');
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Subtle background glow for the dashboard area */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary-blue/5 rounded-full blur-[100px] -z-10 pointer-events-none"></div>

        {/* Topbar Placeholder */}
        <header className="h-16 border-b border-border/50 glass flex items-center justify-between px-6 shrink-0 z-10">
          <div className="font-semibold text-white">Dispatcher Command Center</div>
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-full bg-secondary-bg border border-border flex items-center justify-center text-sm font-bold text-primary-blue">
              AD
            </div>
          </div>
        </header>

        {/* Scrollable Workspace */}
        <main className="flex-1 overflow-y-auto p-6 z-10">
          <div className="max-w-[1600px] mx-auto h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
