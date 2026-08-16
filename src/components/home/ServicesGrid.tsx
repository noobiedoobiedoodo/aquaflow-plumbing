import { DEFAULT_SERVICES, ServiceDefinition } from '@/lib/constants';
import Link from 'next/link';
import { ArrowRight, Wrench, Droplets, Droplet, Bath, Thermometer, AlertTriangle, ArrowDownToLine, ScanLine, Waves, Flame, Zap, Search } from 'lucide-react';
import { AnimatedSection, AnimatedStagger, AnimatedItem } from '@/components/ui/animated-section';

// Icon Map for dynamic rendering from string
const iconMap: Record<string, React.ElementType> = {
  AlertTriangle,
  ArrowDownToLine,
  ScanLine,
  Thermometer,
  Wrench,
  Droplets,
  Droplet,
  Bath,
  Waves,
  Flame,
  Zap,
  Search,
};

export async function ServicesGrid() {
  const services: ServiceDefinition[] = DEFAULT_SERVICES.slice(0, 6);

  return (
    <section className="py-24 bg-background relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/2 left-0 -translate-y-1/2 w-[600px] h-[600px] bg-primary-blue/5 rounded-full blur-[100px] -z-10 pointer-events-none"></div>

      <div className="container mx-auto px-4">
        <AnimatedSection className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-sm font-bold tracking-wider text-primary-blue uppercase mb-3">Our Expertise</h2>
          <h3 className="text-3xl md:text-5xl font-bold text-white mb-6">Comprehensive Plumbing Solutions</h3>
          <p className="text-muted-text text-lg">
            From routine maintenance to complex installations and emergency repairs, our licensed technicians deliver premium service.
          </p>
        </AnimatedSection>

        <AnimatedStagger className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service) => {
            const IconComponent = service.icon && iconMap[service.icon] ? iconMap[service.icon] : Wrench;
            
            return (
              <AnimatedItem key={service.slug}>
                <Link href="/book" className="block h-full group">
                  <div className="glass rounded-2xl p-8 h-full transition-all duration-300 hover:bg-secondary-bg/80 hover:border-primary-blue/30 relative overflow-hidden">
                    {/* Hover gradient effect */}
                    <div className="absolute inset-0 bg-gradient-to-br from-primary-blue/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
                    
                    <div className="w-14 h-14 rounded-xl bg-background border border-border/50 flex items-center justify-center mb-6 text-white group-hover:text-water-cyan group-hover:border-water-cyan/30 transition-colors duration-300 shadow-lg relative z-10">
                      <IconComponent className="w-7 h-7" />
                    </div>
                    
                    <h4 className="text-xl font-bold text-white mb-3 relative z-10">{service.name}</h4>
                    <p className="text-muted-text mb-6 relative z-10 line-clamp-2">
                      {service.shortDescription || service.description}
                    </p>
                    
                    <div className="flex items-center text-primary-blue font-medium text-sm mt-auto relative z-10 group-hover:translate-x-2 transition-transform duration-300">
                      Book Service <ArrowRight className="w-4 h-4 ml-2" />
                    </div>
                  </div>
                </Link>
              </AnimatedItem>
            );
          })}
        </AnimatedStagger>
        
        <AnimatedSection delay={0.4} className="mt-12 text-center">
          <Link href="/book" className="inline-flex items-center justify-center h-11 px-8 rounded-md border border-border bg-transparent text-white hover:bg-secondary-bg hover:text-white transition-colors">
            Book an Appointment
          </Link>
        </AnimatedSection>
      </div>
    </section>
  );
}
