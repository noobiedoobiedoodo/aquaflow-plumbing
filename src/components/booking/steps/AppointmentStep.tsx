import { useFormContext } from 'react-hook-form';
import { BookingSubmitInput } from '@/lib/validation/booking.schema';
import { Input } from '@/components/ui/input';
import { Calendar as CalendarIcon, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

export function AppointmentStep() {
  const { register, watch, setValue, formState: { errors } } = useFormContext<BookingSubmitInput>();
  
  const startTime = watch('startTime');

  const timeSlots = [
    { start: '08:00', end: '10:00', label: 'Morning (8AM - 10AM)' },
    { start: '10:00', end: '12:00', label: 'Late Morning (10AM - 12PM)' },
    { start: '12:00', end: '14:00', label: 'Afternoon (12PM - 2PM)' },
    { start: '14:00', end: '16:00', label: 'Late Afternoon (2PM - 4PM)' },
    { start: '16:00', end: '18:00', label: 'Evening (4PM - 6PM)' },
  ];

  // Get tomorrow's date formatted as YYYY-MM-DD for the minimum date
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split('T')[0];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl mx-auto">
      <div className="text-center mb-10">
        <h2 className="text-3xl font-bold text-white mb-3">When would you like us to come?</h2>
        <p className="text-muted-text">Select your preferred date and time. We will confirm availability shortly.</p>
      </div>

      <div className="space-y-8">
        <div className="space-y-3">
          <label className="text-sm font-semibold text-white uppercase tracking-wider block flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-primary-blue" /> Preferred Date
          </label>
          <div className="relative">
            <Input 
              type="date" 
              min={minDate}
              {...register('date')}
              className="w-full bg-background/50 h-12 text-lg px-4 [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert"
            />
          </div>
          {errors.date && (
            <p className="text-danger text-sm">{errors.date.message}</p>
          )}
        </div>

        <div className="space-y-4">
          <label className="text-sm font-semibold text-white uppercase tracking-wider block flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary-blue" /> Preferred Arrival Window
          </label>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {timeSlots.map((slot) => {
              const isSelected = startTime === slot.start;
              return (
                <div 
                  key={slot.start}
                  onClick={() => {
                    setValue('startTime', slot.start, { shouldValidate: true });
                    setValue('endTime', slot.end, { shouldValidate: true });
                  }}
                  className={cn(
                    "cursor-pointer rounded-xl p-4 border text-center transition-all",
                    isSelected 
                      ? "bg-primary-blue/20 border-primary-blue text-white shadow-[0_0_15px_rgba(0,136,255,0.15)]" 
                      : "bg-background/50 border-border/50 text-muted-text hover:bg-secondary-bg hover:text-white"
                  )}
                >
                  <div className="font-medium">{slot.label}</div>
                </div>
              );
            })}
          </div>
          
          {(errors.startTime || errors.endTime) && (
            <p className="text-danger text-sm text-center">Please select a preferred time slot.</p>
          )}
        </div>

        <div className="p-4 rounded-xl bg-primary-blue/5 border border-primary-blue/20 text-center">
          <p className="text-sm text-primary-blue/80">
            This is a <strong>preferred</strong> arrival window. A dispatcher will contact you to confirm the exact time based on technician availability in your area.
          </p>
        </div>
      </div>
    </div>
  );
}
