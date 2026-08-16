'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight, Phone, ShieldCheck, Clock, PenTool as Tool } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Hero() {
  return (
    <section className="relative min-h-[90vh] flex items-center pt-20 pb-32 overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 bg-background -z-20"></div>
      
      {/* Abstract Water/Pipe Graphic Background */}
      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[800px] h-[800px] opacity-10 pointer-events-none -z-10 hidden lg:block">
        <motion.div 
          animate={{ 
            rotate: [0, 5, 0, -5, 0],
            scale: [1, 1.02, 1, 1.02, 1]
          }}
          transition={{ 
            duration: 20, 
            repeat: Infinity,
            ease: "easeInOut" 
          }}
          className="w-full h-full rounded-full border-[40px] border-primary-blue/30 blur-3xl absolute"
        />
        <motion.div 
          animate={{ 
            rotate: [0, -10, 0, 10, 0],
          }}
          transition={{ 
            duration: 25, 
            repeat: Infinity,
            ease: "easeInOut" 
          }}
          className="w-[600px] h-[600px] left-[100px] top-[100px] rounded-full border-[20px] border-water-cyan/20 blur-2xl absolute"
        />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          
          {/* Left Column: Content */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="max-w-2xl"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-blue/10 border border-primary-blue/20 text-primary-blue text-sm font-medium mb-6">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-blue opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-blue"></span>
              </span>
              24/7 Emergency Dispatch Available
            </div>
            
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-white mb-6 leading-[1.1]">
              Next-Generation <br />
              <span className="text-gradient-blue">Plumbing Solutions</span>
            </h1>
            
            <p className="text-lg sm:text-xl text-muted-text mb-10 leading-relaxed max-w-xl">
              Engineered precision meets exceptional service. From emergency repairs to advanced installations, we deliver uncompromising quality for your home and business.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center gap-4 mb-12">
              <Button size="xl" asChild className="w-full sm:w-auto shadow-[0_0_20px_rgba(0,136,255,0.3)] hover:shadow-[0_0_30px_rgba(0,136,255,0.5)] transition-shadow">
                <Link href="/book" className="flex items-center gap-2">
                  Book Service <ArrowRight className="w-5 h-5" />
                </Link>
              </Button>
              <Button size="xl" variant="emergency" asChild className="w-full sm:w-auto">
                <Link href="tel:204-555-0911" className="flex items-center gap-2">
                  <Phone className="w-5 h-5" /> (204) 555-0911
                </Link>
              </Button>
            </div>

            {/* Trust Indicators */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 pt-8 border-t border-border/50">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-white font-medium">
                  <ShieldCheck className="w-5 h-5 text-success" />
                  <span>Licensed</span>
                </div>
                <span className="text-sm text-muted-text">& Insured</span>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-white font-medium">
                  <Clock className="w-5 h-5 text-water-cyan" />
                  <span>Rapid</span>
                </div>
                <span className="text-sm text-muted-text">Response Time</span>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-white font-medium">
                  <Tool className="w-5 h-5 text-copper-light" />
                  <span>Premium</span>
                </div>
                <span className="text-sm text-muted-text">Craftsmanship</span>
              </div>
            </div>
          </motion.div>

          {/* Right Column: Visual / Interactive Element */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
            className="hidden lg:block relative h-[600px] w-full"
          >
            {/* Glassmorphic Display Card */}
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[500px] h-[500px] glass rounded-3xl p-8 shadow-2xl flex flex-col justify-between overflow-hidden group">
              {/* Animated 'water level' background effect */}
              <motion.div 
                className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-primary-blue/20 to-transparent -z-10"
                initial={{ height: "0%" }}
                animate={{ height: "60%" }}
                transition={{ duration: 2, ease: "easeOut", delay: 0.5 }}
              />
              
              <div className="flex items-start justify-between">
                <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-md border border-white/10">
                  <Droplets className="w-6 h-6 text-water-cyan" />
                </div>
                <div className="px-3 py-1 rounded-full bg-success/20 text-success text-xs font-semibold border border-success/30">
                  SYSTEM ONLINE
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-white">Smart Dispatch</h3>
                  <p className="text-muted-text">Real-time technician tracking and automated scheduling for maximum efficiency.</p>
                </div>
                
                {/* Simulated UI element */}
                <div className="p-4 rounded-xl bg-background/50 border border-border/50 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-text">Status</span>
                    <span className="text-sm text-white font-medium">En Route</span>
                  </div>
                  <div className="w-full h-2 bg-secondary-bg rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-gradient-to-r from-primary-blue to-water-cyan"
                      initial={{ width: "0%" }}
                      animate={{ width: "75%" }}
                      transition={{ duration: 1.5, delay: 1, ease: "easeOut" }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-text">Est. Arrival</span>
                    <span className="text-xs text-water-cyan font-medium">12 mins</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
          
        </div>
      </div>
    </section>
  );
}

// Dummy Droplets since it's used in the right side card above
function Droplets(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z" />
    </svg>
  );
}
