'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, CalendarCheck, UserCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export function BottomNav() {
  const pathname = usePathname();

  const navItems = [
    { label: 'Today', href: '/dashboard', icon: LayoutDashboard },
    { label: 'All Jobs', href: '/jobs', icon: CalendarCheck },
    { label: 'Profile', href: '/profile', icon: UserCircle },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 glass border-t border-border/50 pb-safe pt-2 px-4 z-50">
      <div className="flex justify-around items-center">
        {navItems.map((item) => {
          // Normalize paths for matching. E.g., if we are in /tech/jobs/123, 'All Jobs' should probably still highlight.
          const isDashboard = item.href === '/dashboard' && pathname === '/dashboard';
          const isJobs = item.href === '/jobs' && pathname.startsWith('/jobs');
          const isProfile = item.href === '/profile' && pathname.startsWith('/profile');
          const isActive = isDashboard || isJobs || isProfile;
          
          const Icon = item.icon;
          
          return (
            <Link
              key={item.href}
              href={`/tech${item.href}`}
              className={cn(
                "flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-200 min-w-[70px]",
                isActive 
                  ? "text-primary-blue" 
                  : "text-muted-text hover:text-white"
              )}
            >
              <div className={cn(
                "p-1.5 rounded-full mb-1 transition-colors",
                isActive ? "bg-primary-blue/20" : ""
              )}>
                <Icon className={cn("w-6 h-6", isActive ? "text-primary-blue" : "text-muted-text")} />
              </div>
              <span className={cn(
                "text-[10px] font-medium tracking-wide",
                isActive ? "text-white" : ""
              )}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
