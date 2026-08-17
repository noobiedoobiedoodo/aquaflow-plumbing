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
          <Link href="/book" className="text-sm font-medium text-muted-text hover:text-white transition-colors">
            Contact
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm font-medium text-muted-text hover:text-white transition-colors">
            Sign In
          </Link>
          <Link
            href="/signup"
            className="hidden md:inline-flex text-xs font-semibold px-3 py-1.5 rounded-lg border border-primary-blue/30 text-water-cyan bg-primary-blue/10 hover:bg-primary-blue/20 transition-colors"
          >
            Plumber Sign Up
          </Link>
          <Button asChild className="hidden sm:flex">
            <Link href="/book">Book Service</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
