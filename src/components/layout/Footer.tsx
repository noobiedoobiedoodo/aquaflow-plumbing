import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-border/50 bg-secondary-bg pt-16 pb-8">
      <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
        <div className="space-y-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="font-sans font-bold text-xl tracking-tight text-white">
              Aqua<span className="text-water-cyan">Flow</span>
            </span>
          </Link>
          <p className="text-muted-text text-sm leading-relaxed max-w-xs">
            Premium plumbing solutions for residential and commercial properties. Advanced technology meets expert craftsmanship.
          </p>
        </div>
        
        <div>
          <h3 className="font-semibold text-white mb-4">Services</h3>
          <ul className="space-y-3">
            <li><Link href="/book" className="text-muted-text hover:text-water-cyan text-sm transition-colors">Emergency Response</Link></li>
            <li><Link href="/book" className="text-muted-text hover:text-water-cyan text-sm transition-colors">Drain Clearing</Link></li>
            <li><Link href="/book" className="text-muted-text hover:text-water-cyan text-sm transition-colors">Water Heaters</Link></li>
            <li><Link href="/book" className="text-muted-text hover:text-water-cyan text-sm transition-colors">New Installations</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="font-semibold text-white mb-4">Company</h3>
          <ul className="space-y-3">
            <li><Link href="/book" className="text-muted-text hover:text-white text-sm transition-colors">About Us</Link></li>
            <li><Link href="/book" className="text-muted-text hover:text-white text-sm transition-colors">Careers</Link></li>
            <li><Link href="/book" className="text-muted-text hover:text-white text-sm transition-colors">Privacy Policy</Link></li>
            <li><Link href="/book" className="text-muted-text hover:text-white text-sm transition-colors">Terms of Service</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="font-semibold text-white mb-4">Contact</h3>
          <ul className="space-y-3">
            <li className="text-muted-text text-sm">123 Main Street<br/>Winnipeg, MB R3C 1A1</li>
            <li className="text-muted-text text-sm">Emergency: (204) 555-0911</li>
            <li className="text-muted-text text-sm">Office: (204) 555-0199</li>
            <li className="text-muted-text text-sm">info@aquaflowplumbing.com</li>
          </ul>
        </div>
      </div>
      
      <div className="container mx-auto px-4 pt-8 border-t border-border/50 text-center">
        <p className="text-muted-text text-sm">
          &copy; {new Date().getFullYear()} AquaFlow Plumbing. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
