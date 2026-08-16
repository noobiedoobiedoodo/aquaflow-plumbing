import { Metadata } from 'next';
import { getCustomerSession } from '@/lib/auth/customer-session';
import Link from 'next/link';
import { Home, Calendar, FileText, CreditCard, LogOut, Wrench, HelpCircle, User } from 'lucide-react';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Customer Portal | AquaFlow',
};

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCustomerSession();

  // If not authenticated, we still render the layout but without the sidebar.
  // The login page itself handles its own rendering.
  if (!session) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
        {children}
      </div>
    );
  }

  const navItems = [
    { label: 'Dashboard', href: '/portal/dashboard', icon: Home },
    { label: 'Request Service', href: '/portal/book', icon: Wrench },
    { label: 'My Jobs', href: '/portal/jobs', icon: Calendar },
    { label: 'Estimates', href: '/portal/estimates', icon: FileText },
    { label: 'Billing', href: '/portal/billing', icon: CreditCard },
    { label: 'Support', href: '/portal/support', icon: HelpCircle },
    { label: 'Profile', href: '/portal/profile', icon: User },
  ];

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden bg-white border-b border-neutral-200 p-4 flex items-center justify-between">
        <span className="font-bold text-blue-600 text-lg tracking-tight">AquaFlow Portal</span>
        <form action="/api/auth/logout" method="POST">
          <button type="submit" className="p-2 text-neutral-500 hover:text-neutral-900 rounded-md">
            <LogOut className="h-5 w-5" />
          </button>
        </form>
      </div>

      {/* Sidebar */}
      <div className="hidden md:flex w-64 bg-white border-r border-neutral-200 flex-col">
        <div className="p-6 border-b border-neutral-200">
          <div className="font-bold text-blue-600 text-xl tracking-tight">AquaFlow</div>
          <div className="text-sm text-neutral-500 mt-1">Customer Portal</div>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg text-neutral-700 hover:text-blue-600 hover:bg-blue-50 transition-colors"
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-neutral-200">
          <div className="px-3 py-2 text-sm font-medium text-neutral-900 truncate">
            {session.customer.firstName} {session.customer.lastName}
          </div>
          <form action="/api/auth/logout" method="POST" className="mt-1">
            <input type="hidden" name="type" value="customer" />
            <button
              type="submit"
              className="flex w-full items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </form>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
