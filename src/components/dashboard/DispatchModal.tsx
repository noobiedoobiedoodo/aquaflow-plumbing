'use client';

import { useState } from 'react';
import { useDispatchStore } from './dispatchStore';
import { assignJob } from '@/app/actions/dispatch';
import { Button } from '@/components/ui/button';
import { X, User, CheckCircle2, HardHat } from 'lucide-react';
import { cn } from '@/lib/utils';

export function DispatchModal({ technicians }: { technicians: any[] }) {
  const { isOpen, selectedJob, closeModal } = useDispatchStore();
  const [selectedTechId, setSelectedTechId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !selectedJob) return null;

  const handleDispatch = async () => {
    if (!selectedTechId) return;
    setIsSubmitting(true);
    setError(null);

    const result = await assignJob(selectedJob.id, selectedTechId);
    
    setIsSubmitting(false);
    if (result.success) {
      closeModal();
    } else {
      setError(result.error || 'Failed to dispatch job');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="bg-secondary-bg border border-border rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-border flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-xl font-bold text-white">Dispatch Technician</h2>
            <p className="text-sm text-muted-text">Assigning Job {selectedJob.appointment.appointmentNumber}</p>
          </div>
          <button onClick={closeModal} className="p-2 rounded-lg hover:bg-white/5 text-muted-text hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {error && (
            <div className="p-4 rounded-xl bg-danger/10 border border-danger/30 text-danger text-sm">
              {error}
            </div>
          )}

          {/* Job Summary */}
          <div className="glass p-4 rounded-xl border border-border/50">
            <h3 className="text-sm font-semibold text-primary-blue uppercase tracking-wider mb-2">Request Details</h3>
            <p className="text-white font-medium mb-1">
              {selectedJob.appointment.service.name} 
              {selectedJob.appointment.isEmergency && <span className="ml-2 text-xs font-bold bg-danger/20 text-danger px-2 py-0.5 rounded uppercase">Emergency</span>}
            </p>
            <p className="text-sm text-muted-text mb-3">"{selectedJob.appointment.problemDescription}"</p>
            <div className="text-sm text-white/80">
              <span className="font-semibold text-white">Location:</span> {selectedJob.appointment.property.address}, {selectedJob.appointment.property.city}
            </div>
            <div className="text-sm text-white/80">
              <span className="font-semibold text-white">Customer:</span> {selectedJob.appointment.customer.firstName} {selectedJob.appointment.customer.lastName} ({selectedJob.appointment.customer.phone})
            </div>
          </div>

          {/* Technician Selection */}
          <div>
            <h3 className="text-sm font-semibold text-muted-text uppercase tracking-wider mb-3">Available Technicians</h3>
            <div className="space-y-3">
              {technicians.map((tech) => {
                const isAvailable = tech.availabilityStatus === 'AVAILABLE';
                const activeJobs = tech.jobs?.length || 0;
                
                return (
                  <div 
                    key={tech.id}
                    onClick={() => isAvailable && setSelectedTechId(tech.id)}
                    className={cn(
                      "p-4 rounded-xl border flex items-center justify-between transition-all",
                      !isAvailable ? "opacity-50 cursor-not-allowed bg-background/30 border-border/30" : "cursor-pointer",
                      selectedTechId === tech.id 
                        ? "bg-primary-blue/20 border-primary-blue shadow-[0_0_15px_rgba(0,136,255,0.15)]" 
                        : isAvailable ? "bg-background/50 border-border/50 hover:bg-secondary-bg hover:border-primary-blue/30" : ""
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center",
                        selectedTechId === tech.id ? "bg-primary-blue text-white" : "bg-secondary-bg text-muted-text"
                      )}>
                        <HardHat className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-bold text-white">{tech.firstName} {tech.lastName}</div>
                        <div className="text-xs text-muted-text flex items-center gap-2">
                          <span className={cn("w-2 h-2 rounded-full", isAvailable ? "bg-success" : "bg-warning")}></span>
                          {tech.availabilityStatus}
                          {activeJobs > 0 && <span className="ml-2">• {activeJobs} active jobs</span>}
                        </div>
                      </div>
                    </div>
                    {selectedTechId === tech.id && <CheckCircle2 className="w-6 h-6 text-primary-blue" />}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border flex justify-end gap-3 shrink-0">
          <Button variant="ghost" onClick={closeModal} disabled={isSubmitting}>Cancel</Button>
          <Button 
            onClick={handleDispatch} 
            disabled={!selectedTechId || isSubmitting}
            className="min-w-[150px]"
          >
            {isSubmitting ? 'Dispatching...' : 'Confirm Dispatch'}
          </Button>
        </div>

      </div>
    </div>
  );
}
