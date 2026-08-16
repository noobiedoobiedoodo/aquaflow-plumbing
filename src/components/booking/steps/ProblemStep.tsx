import { useFormContext } from 'react-hook-form';
import { BookingSubmitInput } from '@/lib/validation/booking.schema';
import { AlertTriangle, Clock, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';

export function ProblemStep() {
  const { register, watch, setValue, formState: { errors } } = useFormContext<BookingSubmitInput>();
  const urgency = watch('urgency');

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl mx-auto">
      <div className="text-center mb-10">
        <h2 className="text-3xl font-bold text-white mb-3">Tell us what's happening.</h2>
        <p className="text-muted-text">Provide a brief description of the issue so we can send the right tools.</p>
      </div>

      <div className="space-y-8">
        <div className="space-y-3">
          <label className="text-sm font-semibold text-white uppercase tracking-wider block">Problem Description</label>
          <Textarea 
            {...register('problemDescription')}
            placeholder="e.g. The water heater is leaking from the bottom and making a strange noise..."
            className="h-32 resize-none bg-background/50 text-white"
          />
          {errors.problemDescription && (
            <p className="text-danger text-sm">{errors.problemDescription.message}</p>
          )}
        </div>

        <div className="space-y-4">
          <label className="text-sm font-semibold text-white uppercase tracking-wider block">Urgency Level</label>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div 
              onClick={() => setValue('urgency', 'NORMAL', { shouldValidate: true })}
              className={cn(
                "cursor-pointer rounded-xl p-4 border transition-all flex items-start gap-4",
                urgency === 'NORMAL' || urgency === 'LOW' 
                  ? "bg-primary-blue/10 border-primary-blue shadow-md" 
                  : "bg-background/50 border-border/50 hover:bg-secondary-bg"
              )}
            >
              <div className={cn("p-2 rounded-lg", urgency === 'NORMAL' || urgency === 'LOW' ? "bg-primary-blue/20 text-primary-blue" : "bg-secondary-bg text-muted-text")}>
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <div className="font-semibold text-white mb-1">Standard Service</div>
                <div className="text-xs text-muted-text">Within 24-48 hours. Best for routine issues.</div>
              </div>
            </div>

            <div 
              onClick={() => setValue('urgency', 'EMERGENCY', { shouldValidate: true })}
              className={cn(
                "cursor-pointer rounded-xl p-4 border transition-all flex items-start gap-4",
                urgency === 'EMERGENCY' || urgency === 'HIGH'
                  ? "bg-danger/10 border-danger shadow-md shadow-danger/10" 
                  : "bg-background/50 border-border/50 hover:bg-secondary-bg"
              )}
            >
              <div className={cn("p-2 rounded-lg", urgency === 'EMERGENCY' || urgency === 'HIGH' ? "bg-danger text-white animate-pulse" : "bg-secondary-bg text-muted-text")}>
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <div className="font-semibold text-white mb-1">Emergency</div>
                <div className="text-xs text-muted-text">Immediate dispatch. Active leaks or critical damage.</div>
              </div>
            </div>
          </div>
          
          {errors.urgency && (
            <p className="text-danger text-sm">{errors.urgency.message}</p>
          )}
        </div>

        {urgency === 'EMERGENCY' && (
          <div className="p-4 rounded-xl bg-danger/10 border border-danger/30 flex gap-3 animate-in fade-in slide-in-from-top-2">
            <Info className="w-5 h-5 text-danger shrink-0 mt-0.5" />
            <p className="text-sm text-danger/90">
              <strong>Emergency rates may apply.</strong> Please locate your main water shut-off valve if you have an active leak. Our dispatcher will call you immediately after submission.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
