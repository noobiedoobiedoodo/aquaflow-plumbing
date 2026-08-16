import { useFormContext, Controller } from 'react-hook-form';
import { BookingSubmitInput } from '@/lib/validation/booking.schema';
import { ServiceDisplay } from '../BookingWizard';
import { Wrench, Droplets, Droplet, Bath, Thermometer, AlertTriangle, ArrowDownToLine, ScanLine, Waves } from 'lucide-react';
import { cn } from '@/lib/utils';

const iconMap: Record<string, React.ElementType> = {
  AlertTriangle,
  ArrowDownToLine,
  ScanLine,
  Thermometer,
  Wrench,
  Droplets,
  Droplet,
  Bath,
  Waves
};

interface ServiceStepProps {
  services: ServiceDisplay[];
  onNext: () => void;
}

export function ServiceStep({ services, onNext }: ServiceStepProps) {
  const { control, formState: { errors } } = useFormContext<BookingSubmitInput>();

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center mb-10">
        <h2 className="text-3xl font-bold text-white mb-3">What can we help you with?</h2>
        <p className="text-muted-text">Select the service that best describes your needs.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Controller
          name="serviceId"
          control={control}
          render={({ field }) => (
            <>
              {services.map((service) => {
                const IconComponent = service.icon && iconMap[service.icon] ? iconMap[service.icon] : Wrench;
                const isSelected = field.value === service.id;
                
                return (
                  <div
                    key={service.id}
                    onClick={() => {
                      field.onChange(service.id);
                      // Auto advance on selection
                      setTimeout(onNext, 300);
                    }}
                    className={cn(
                      "relative cursor-pointer rounded-2xl p-6 transition-all duration-300 border text-left",
                      isSelected 
                        ? "bg-primary-blue/10 border-primary-blue shadow-[0_0_20px_rgba(0,136,255,0.2)]" 
                        : "bg-background/50 border-border/50 hover:bg-secondary-bg hover:border-primary-blue/30"
                    )}
                  >
                    {service.isEmergency && (
                      <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-danger/10 border border-danger/20 text-[10px] uppercase font-bold text-danger">
                        <span className="w-1.5 h-1.5 rounded-full bg-danger animate-pulse"></span>
                        Emergency
                      </div>
                    )}
                    
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-colors",
                      isSelected ? "bg-primary-blue text-white" : "bg-secondary-bg text-muted-text border border-border"
                    )}>
                      <IconComponent className="w-6 h-6" />
                    </div>
                    
                    <h3 className={cn(
                      "text-lg font-bold mb-2",
                      isSelected ? "text-primary-blue" : "text-white"
                    )}>{service.name}</h3>
                    <p className="text-sm text-muted-text line-clamp-2">
                      {service.shortDescription}
                    </p>
                  </div>
                );
              })}
            </>
          )}
        />
      </div>

      {errors.serviceId && (
        <p className="text-danger text-sm text-center mt-6 animate-pulse">
          {errors.serviceId.message}
        </p>
      )}
    </div>
  );
}
