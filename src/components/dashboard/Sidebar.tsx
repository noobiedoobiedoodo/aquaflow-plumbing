'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, CalendarCheck, Users, HardHat, Settings, LogOut, History, Receipt, Mail, HelpCircle, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BrandLogo } from '@/components/layout/BrandLogo';

export function Sidebar() {
  const pathname = usePathname();

  const navItems = [
    { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Schedule & Dispatch', href: '/dashboard/jobs', icon: CalendarCheck },
    { label: 'Invoices & Billing', href: '/dashboard/invoices', icon: Receipt },
    { label: 'Cold Prospecting', href: '/pilot/admin', icon: Sparkles },
    { label: 'Automated Outreach', href: '/dashboard/communications', icon: Mail },
    { label: 'Customers', href: '/dashboard/customers', icon: Users },
    { label: 'Technicians', href: '/dashboard/techs', icon: HardHat },
    { label: 'Customer Support', href: '/dashboard/support', icon: HelpCircle },
    { label: 'Settings', href: '/dashboard/settings', icon: Settings },
    { label: 'Audit Log', href: '/dashboard/audit', icon: History },
  ];

  return (
    <aside className="w-64 border-r border-border/50 glass shrink-0 flex flex-col h-full">
      <div className="p-6 border-b border-border/50">
        <Link href="/dashboard" className="flex items-center group">
          <BrandLogo size="sm" />
        </Link>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        <div className="text-xs font-semibold text-muted-text uppercase tracking-wider mb-3 px-3">Dispatch Hub</div>
        
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group text-sm",
                isActive 
                  ? "bg-primary-blue/10 text-white font-semibold" 
                  : "text-muted-text hover:bg-secondary-bg hover:text-white font-medium"
              )}
            >
              <Icon className={cn("w-4 h-4", isActive ? "text-primary-blue" : "text-muted-text group-hover:text-white")} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border/50 space-y-1">
        <Link
          href="/dashboard/settings"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-text hover:bg-secondary-bg hover:text-white transition-all duration-200 group font-medium"
        >
          <Settings className="w-4 h-4 text-muted-text group-hover:text-white" />
          <span>Settings</span>
        </Link>
        <button
          onClick={() => {
            fetch('/api/auth/logout', { method: 'POST' }).then(() => window.location.href = '/');
          }}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-rose-400 hover:bg-rose-500/10 transition-all duration-200 group font-medium"
        >
          <LogOut className="w-4 h-4" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
