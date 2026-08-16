import { prisma } from '@/lib/db';
import { MapPin } from 'lucide-react';
import { AnimatedSection, AnimatedStagger, AnimatedItem } from '@/components/ui/animated-section';

export async function ServiceAreas() {
  const areas = await prisma.serviceArea.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  });

  if (areas.length === 0) return null;

  return (
    <section className="py-24 bg-background relative border-t border-border/50">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <AnimatedSection>
            <h2 className="text-sm font-bold tracking-wider text-copper-light uppercase mb-3">Service Areas</h2>
            <h3 className="text-3xl md:text-5xl font-bold text-white mb-6">Local Experts, Regional Reach</h3>
            <p className="text-muted-text text-lg mb-8 leading-relaxed">
              We provide rapid-response plumbing services across the greater metropolitan area. Our dispatch system ensures the closest available technician is routed directly to your location.
            </p>
            
            <AnimatedStagger className="grid grid-cols-2 gap-4">
              {areas.map((area) => (
                <AnimatedItem key={area.id} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-secondary-bg flex items-center justify-center border border-border">
                    <MapPin className="w-4 h-4 text-copper-light" />
                  </div>
                  <span className="text-white font-medium">{area.name}</span>
                </AnimatedItem>
              ))}
            </AnimatedStagger>
          </AnimatedSection>

          <AnimatedSection delay={0.2} className="relative h-[500px] w-full glass rounded-3xl overflow-hidden border border-border/50">
             {/* Placeholder for an actual interactive map component in the future */}
             <div className="absolute inset-0 bg-[url('https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/-97.1384,49.8951,10,0/800x600?access_token=pk.eyJ1IjoiZHVtbXkiLCJhIjoiZHVtbXkifQ.dummy')] bg-cover bg-center opacity-40 mix-blend-luminosity grayscale"></div>
             
             {/* Simulated radar/ping effect on the map */}
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                <div className="relative flex items-center justify-center">
                  <div className="absolute w-32 h-32 bg-primary-blue/20 rounded-full animate-ping" style={{ animationDuration: '3s' }}></div>
                  <div className="absolute w-16 h-16 bg-primary-blue/30 rounded-full animate-ping" style={{ animationDuration: '3s', animationDelay: '0.5s' }}></div>
                  <div className="relative w-6 h-6 bg-primary-blue rounded-full border-4 border-background z-10 shadow-[0_0_15px_rgba(0,136,255,0.8)]"></div>
                </div>
             </div>

             <div className="absolute bottom-6 left-6 right-6 p-6 glass rounded-2xl border-white/10 flex items-center justify-between">
                <div>
                  <div className="text-sm text-muted-text mb-1">Current Active Techs</div>
                  <div className="text-2xl font-bold text-white flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-success animate-pulse"></span>
                    14 En Route
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-muted-text mb-1">Avg Response</div>
                  <div className="text-2xl font-bold text-water-cyan">38 mins</div>
                </div>
             </div>
          </AnimatedSection>
        </div>
      </div>
    </section>
  );
}
