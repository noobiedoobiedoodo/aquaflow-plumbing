import { useFormContext } from 'react-hook-form';
import { BookingSubmitInput } from '@/lib/validation/booking.schema';
import { ServiceDisplay } from '../BookingWizard';
import { AlertTriangle, Calendar, Clock, MapPin, User, FileText } from 'lucide-react';

interface ReviewSubmitStepProps {
  services: ServiceDisplay[];
}

export function ReviewSubmitStep({ services }: ReviewSubmitStepProps) {
  const { getValues } = useFormContext<BookingSubmitInput>();
  const values = getValues();
  
  const selectedService = services.find(s => s.id === values.serviceId);
  const isEmergency = values.urgency === 'EMERGENCY' || values.urgency === 'HIGH';

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl mx-auto">
      <div className="text-center mb-10">
        <h2 className="text-3xl font-bold text-white mb-3">Review & Submit</h2>
        <p className="text-muted-text">Please review your request details before submitting.</p>
      </div>

      <div className="space-y-6">
        
        {/* Service & Urgency Summary */}
        <div className="glass rounded-2xl p-6 border border-border/50">
          <div className="flex items-start justify-between mb-4 pb-4 border-b border-border/50">
            <div>
              <h3 className="text-sm font-semibold text-muted-text uppercase tracking-wider mb-1">Service Requested</h3>
              <div className="text-xl font-bold text-white">{selectedService?.name || 'Standard Plumbing Service'}</div>
            </div>
            <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
              isEmergency ? 'bg-danger/20 text-danger border-danger/30' : 'bg-primary-blue/20 text-primary-blue border-primary-blue/30'
            }`}>
              {values.urgency}
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <FileText className="w-5 h-5 text-muted-text shrink-0 mt-0.5" />
            <p className="text-white/90 text-sm leading-relaxed">
              "{values.problemDescription}"
            </p>
          </div>
        </div>

        {/* Schedule & Location Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="glass rounded-2xl p-6 border border-border/50 space-y-4">
            <h3 className="text-sm font-semibold text-muted-text uppercase tracking-wider mb-2">Schedule</h3>
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-primary-blue" />
              <span className="text-white font-medium">{values.date}</span>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-primary-blue" />
              <span className="text-white font-medium">{values.startTime} - {values.endTime}</span>
            </div>
          </div>

          <div className="glass rounded-2xl p-6 border border-border/50 space-y-4">
            <h3 className="text-sm font-semibold text-muted-text uppercase tracking-wider mb-2">Location</h3>
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-water-cyan shrink-0 mt-0.5" />
              <div className="text-white font-medium text-sm">
                {values.address} {values.unit && `Apt/Unit ${values.unit}`}<br />
                {values.city}, {values.province} {values.postalCode}
              </div>
            </div>
          </div>
        </div>

        {/* Customer Info */}
        <div className="glass rounded-2xl p-6 border border-border/50 space-y-4">
           <h3 className="text-sm font-semibold text-muted-text uppercase tracking-wider mb-2">Contact Info</h3>
           <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-copper-light shrink-0" />
              <div className="text-white font-medium text-sm">
                {values.firstName} {values.lastName} <span className="text-muted-text mx-2">•</span> {values.phone} <span className="text-muted-text mx-2">•</span> {values.email}
              </div>
           </div>
        </div>

        {isEmergency && (
          <div className="p-4 rounded-xl bg-danger/10 border border-danger/30 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-danger shrink-0 mt-0.5 animate-pulse" />
            <p className="text-sm text-danger/90">
              <strong>Emergency Dispatch:</strong> By submitting this request, a dispatcher will be alerted immediately and will call you to confirm dispatch.
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
