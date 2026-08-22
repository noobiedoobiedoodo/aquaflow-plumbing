import Link from 'next/link';
import { Droplets } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-md glass">
      <div className="container mx-auto px-4 h-20 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-primary-blue to-water-cyan p-0.5">
            <div className="absolute inset-0 bg-background rounded-xl m-[1px]"></div>
            <Droplets className="w-5 h-5 text-water-cyan relative z-10 group-hover:scale-110 transition-transform duration-300" />
          </div>
          <span className="font-sans font-bold text-xl tracking-tight text-white">
            Aqua<span className="text-water-cyan">Flow</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          <Link href="/pilot" className="text-sm font-semibold text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1.5">
            <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 rounded-full">
              Founding Pilot
            </span>
            $199/mo Offer
          </Link>
          <Link href="/book" className="text-sm font-medium text-muted-text hover:text-white transition-colors">
            Services
          </Link>
          <Link href="/book" className="text-sm font-medium text-danger hover:text-danger/80 transition-colors flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-danger opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-danger"></span>
            </span>
            Emergency 24/7
          </Link>
          <Link href="/book" className="text-sm font-medium text-muted-text hover:text-white transition-colors">
            About Us
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm font-medium text-muted-text hover:text-white transition-colors">
            Sign In
          </Link>
          <Link
            href="/pilot"
            className="hidden sm:inline-flex text-xs font-bold px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-slate-950 shadow-[0_0_15px_rgba(0,229,255,0.4)] hover:shadow-[0_0_25px_rgba(0,229,255,0.6)] transition-all"
          >
            Apply for $199 Pilot
          </Link>
          <Button asChild className="hidden sm:flex">
            <Link href="/book">Book Service</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
