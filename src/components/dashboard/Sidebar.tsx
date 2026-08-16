'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, CalendarCheck, Users, HardHat, Settings, LogOut, History, Receipt, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Sidebar() {
  const pathname = usePathname();

  const navItems = [
    { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Active Jobs', href: '/dashboard/jobs', icon: CalendarCheck },
    { label: 'Technicians', href: '/dashboard/techs', icon: HardHat },
    { label: 'Customers', href: '/dashboard/customers', icon: Users },
    { label: 'Invoices', href: '/dashboard/invoices', icon: Receipt },
    { label: 'Communications', href: '/communications', icon: Mail },
    { label: 'Audit Log', href: '/dashboard/audit', icon: History },
  ];

  return (
    <aside className="w-64 border-r border-border/50 glass shrink-0 flex flex-col h-full">
      <div className="p-6 border-b border-border/50">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="relative w-8 h-8 flex items-center justify-center">
            <div className="absolute inset-0 bg-primary-blue rounded-lg rotate-45 group-hover:rotate-90 transition-transform duration-500 opacity-20"></div>
            <div className="absolute inset-1 bg-gradient-to-tr from-primary-blue to-water-cyan rounded-md rotate-12"></div>
            <div className="absolute w-2 h-2 bg-background rounded-full"></div>
          </div>
          <span className="font-bold text-xl text-white tracking-tight">AquaFlow</span>
        </Link>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        <div className="text-xs font-semibold text-muted-text uppercase tracking-wider mb-4 px-3">Dispatch</div>
        
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group",
                isActive 
                  ? "bg-primary-blue/10 text-white" 
                  : "text-muted-text hover:bg-secondary-bg hover:text-white"
              )}
            >
              <Icon className={cn("w-5 h-5", isActive ? "text-primary-blue" : "text-muted-text group-hover:text-white")} />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border/50 space-y-2">
        <Link
          href="/dashboard/settings"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-text hover:bg-secondary-bg hover:text-white transition-all duration-200 group"
        >
          <Settings className="w-5 h-5 text-muted-text group-hover:text-white" />
          <span className="font-medium">Settings</span>
        </Link>
        <button
          onClick={() => {
            fetch('/api/auth/logout', { method: 'POST' }).then(() => window.location.href = '/');
          }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-danger hover:bg-danger/10 transition-all duration-200 group"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Logout</span>
        </button>
      </div>
    </aside>
  );
}
