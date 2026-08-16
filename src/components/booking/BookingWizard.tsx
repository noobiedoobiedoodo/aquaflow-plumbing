'use client';

import { useState } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { bookingSubmitSchema, BookingSubmitInput } from '@/lib/validation/booking.schema';
import { ServiceStep } from './steps/ServiceStep';
import { ProblemStep } from './steps/ProblemStep';
import { AppointmentStep } from './steps/AppointmentStep';
import { LocationCustomerStep } from './steps/LocationCustomerStep';
import { ReviewSubmitStep } from './steps/ReviewSubmitStep';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';

export type ServiceDisplay = {
  id: string;
  name: string;
  shortDescription: string | null;
  icon: string | null;
  isEmergency: boolean;
};

interface BookingWizardProps {
  services: ServiceDisplay[];
}

export function BookingWizard({ services }: BookingWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{ appointmentNumber: string } | null>(null);

  const methods = useForm({
    resolver: zodResolver(bookingSubmitSchema),
    defaultValues: {
      urgency: 'NORMAL',
      province: 'MB',
    },
    mode: 'onTouched',
  });

  const { trigger, getValues, handleSubmit } = methods;

  const totalSteps = 5;

  const handleNext = async () => {
    let fieldsToValidate: any[] = [];
    
    if (currentStep === 1) fieldsToValidate = ['serviceId'];
    if (currentStep === 2) fieldsToValidate = ['problemDescription', 'urgency'];
    if (currentStep === 3) fieldsToValidate = ['date', 'startTime', 'endTime'];
    if (currentStep === 4) fieldsToValidate = ['firstName', 'lastName', 'email', 'phone', 'address', 'unit', 'city', 'province', 'postalCode'];
    
    const isValid = await trigger(fieldsToValidate as any);
    
    if (isValid) {
      setCurrentStep((prev) => Math.min(prev + 1, totalSteps));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const onSubmit = async (data: any) => {
    setIsSubmitting(true);
    setSubmitError(null);
    
    try {
      const response = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to submit booking');
      }
      
      setSuccessResult({ appointmentNumber: result.appointmentNumber });
    } catch (err: any) {
      setSubmitError(err.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render Success State
  if (successResult) {
    return (
      <div className="glass rounded-2xl p-8 md:p-12 text-center border-success/30 shadow-[0_0_40px_rgba(34,197,94,0.1)]">
        <div className="w-20 h-20 bg-success/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-10 h-10 text-success" />
        </div>
        <h2 className="text-3xl font-bold text-white mb-4">Booking Request Received!</h2>
        <p className="text-muted-text text-lg mb-8 max-w-lg mx-auto">
          Your request <strong className="text-white">#{successResult.appointmentNumber}</strong> has been received and securely logged in our dispatch system. We will contact you shortly to confirm your appointment.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button asChild variant="secondary">
            <a href="/">Return Home</a>
          </Button>
          <Button asChild>
            <a href={`/book`}>Book Another Service</a>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="glass rounded-3xl p-6 md:p-10 border border-border/50 shadow-2xl relative">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex justify-between text-xs font-medium text-muted-text mb-2 px-1">
          <span>Service</span>
          <span>Details</span>
          <span>Time</span>
          <span>Location</span>
          <span>Review</span>
        </div>
        <div className="w-full h-2 bg-background rounded-full overflow-hidden flex">
          <div 
            className="h-full bg-gradient-to-r from-primary-blue to-water-cyan transition-all duration-500 ease-out"
            style={{ width: `${((currentStep - 1) / (totalSteps - 1)) * 100}%` }}
          />
        </div>
      </div>

      <FormProvider {...methods}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          
          <div className="min-h-[400px]">
            {currentStep === 1 && <ServiceStep services={services} onNext={handleNext} />}
            {currentStep === 2 && <ProblemStep />}
            {currentStep === 3 && <AppointmentStep />}
            {currentStep === 4 && <LocationCustomerStep />}
            {currentStep === 5 && <ReviewSubmitStep services={services} />}
          </div>

          {submitError && (
            <div className="p-4 rounded-xl bg-danger/10 border border-danger/30 text-danger text-sm">
              {submitError}
            </div>
          )}

          <div className="flex items-center justify-between pt-6 border-t border-border/50">
            <Button
              type="button"
              variant="ghost"
              onClick={handleBack}
              disabled={currentStep === 1 || isSubmitting}
              className={currentStep === 1 ? 'invisible' : ''}
            >
              <ArrowLeft className="w-4 h-4 mr-2" /> Back
            </Button>

            {currentStep < totalSteps ? (
              <Button type="button" onClick={handleNext}>
                Next Step
              </Button>
            ) : (
              <Button type="submit" size="lg" disabled={isSubmitting} className="min-w-[200px]">
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"></span>
                    Processing...
                  </span>
                ) : (
                  'Request Appointment'
                )}
              </Button>
            )}
          </div>
        </form>
      </FormProvider>
    </div>
  );
}
