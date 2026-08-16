'use client';

import { useState } from 'react';
import { MapPin, Phone, MessageSquare, Clock, ArrowRight, CheckCircle, Wrench, Camera, FileText } from 'lucide-react';
import { updateJobState, toggleTimeClock } from '@/app/actions/tech';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
// (For brevity, assuming these client components exist or will be built)
import { SignaturePad } from './SignaturePad';
import { PartsTab } from './PartsTab';
import { NotesTab } from './NotesTab';
import { PhotosTab } from './PhotosTab';

export function JobWorkspace({ job, user }: { job: any; user: any }) {
  const [activeTab, setActiveTab] = useState<'DETAILS' | 'NOTES' | 'PARTS' | 'PHOTOS'>('DETAILS');
  const [isUpdating, setIsUpdating] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);

  const handleStateTransition = async (newState: string) => {
    setIsUpdating(true);
    try {
      await updateJobState(job.id, newState);
      toast.success(`Job marked as ${newState.replace('_', ' ')}`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleClockToggle = async () => {
    setIsUpdating(true);
    try {
      const res = await toggleTimeClock(job.id);
      toast.success(`Time clock ${res.status}`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const hasOpenTimeEntry = job.timeEntries.some((e: any) => !e.endedAt);
  const totalWorkedSeconds = job.timeEntries.reduce((acc: number, entry: any) => acc + (entry.durationSeconds || 0), 0);

  // If completion workflow is active
  if (showCompletion) {
    return <SignaturePad job={job} onCancel={() => setShowCompletion(false)} />;
  }

  const serviceTitle = job.appointment.service?.name || job.appointment.serviceName || 'Service Call';

  return (
    <div className="flex flex-col min-h-screen pb-24">
      {/* Header Info */}
      <header className="bg-secondary-bg/80 border-b border-border/50 p-4 sticky top-0 z-20 backdrop-blur-xl">
        <div className="flex items-start justify-between mb-3">
          <div>
            <span className="inline-block px-2 py-0.5 rounded-full bg-primary-blue/20 text-primary-blue text-xs font-bold tracking-widest mb-1">
              {job.status.replace('_', ' ')}
            </span>
            <h1 className="text-xl font-bold text-white leading-tight">
              {serviceTitle}
            </h1>
          </div>
        </div>

        <div className="space-y-2 mt-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center shrink-0">
              <MapPin className="w-4 h-4 text-water-cyan" />
            </div>
            <a 
              href={`geo:0,0?q=${encodeURIComponent(job.appointment.property.address)}`} 
              className="text-sm font-medium text-white hover:text-water-cyan flex-1"
            >
              {job.appointment.property.address}
            </a>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center shrink-0">
              <Phone className="w-4 h-4 text-water-cyan" />
            </div>
            <div className="flex items-center gap-4 flex-1">
              <span className="text-sm font-medium text-white">
                {job.appointment.customer.firstName} {job.appointment.customer.lastName}
              </span>
              <div className="flex items-center gap-2 ml-auto">
                <a href={`tel:${job.appointment.customer.phone}`} className="p-2 rounded-lg bg-primary-blue/20 text-primary-blue">
                  <Phone className="w-4 h-4" />
                </a>
                <a href={`sms:${job.appointment.customer.phone}`} className="p-2 rounded-lg bg-primary-blue/20 text-primary-blue">
                  <MessageSquare className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* State Machine Actions */}
      <section className="p-4 border-b border-border/50 bg-background/50">
        {job.status === 'ASSIGNED' && (
          <Button onClick={() => handleStateTransition('EN_ROUTE')} disabled={isUpdating} className="w-full py-6 text-lg font-bold">
            <ArrowRight className="w-5 h-5 mr-2" /> Mark En Route
          </Button>
        )}
        {job.status === 'EN_ROUTE' && (
          <Button onClick={() => handleStateTransition('ARRIVED')} disabled={isUpdating} className="w-full py-6 text-lg font-bold bg-water-cyan hover:bg-water-cyan/90 text-black">
            <MapPin className="w-5 h-5 mr-2" /> I Have Arrived
          </Button>
        )}
        {job.status === 'ARRIVED' && (
          <Button onClick={() => handleStateTransition('WORKING')} disabled={isUpdating} className="w-full py-6 text-lg font-bold">
            <Wrench className="w-5 h-5 mr-2" /> Start Work
          </Button>
        )}
        {job.status === 'WORKING' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between glass p-4 rounded-xl border border-primary-blue/20">
              <div>
                <div className="text-sm font-medium text-muted-text">Time Tracked</div>
                <div className="text-2xl font-bold text-white font-mono mt-1">
                  {Math.floor(totalWorkedSeconds / 3600)}h {Math.floor((totalWorkedSeconds % 3600) / 60)}m
                </div>
              </div>
              <Button 
                variant={hasOpenTimeEntry ? "secondary" : "default"}
                onClick={handleClockToggle} 
                disabled={isUpdating}
              >
                <Clock className="w-4 h-4 mr-2" /> {hasOpenTimeEntry ? 'Pause Clock' : 'Resume Clock'}
              </Button>
            </div>
            
            <Button 
              onClick={() => setShowCompletion(true)} 
              disabled={isUpdating || hasOpenTimeEntry} 
              className="w-full py-6 text-lg font-bold bg-success hover:bg-success/90 text-white"
            >
              <CheckCircle className="w-5 h-5 mr-2" /> Complete Job
            </Button>
            {hasOpenTimeEntry && (
              <p className="text-xs text-center text-muted-text">You must pause the clock before completing the job.</p>
            )}
          </div>
        )}
        {job.status === 'COMPLETED' && (
          <div className="glass p-4 rounded-xl border border-success/30 flex items-center justify-center text-success font-bold">
            <CheckCircle className="w-5 h-5 mr-2" /> Job Completed
          </div>
        )}
      </section>

      {/* Workspace Tabs */}
      <div className="flex border-b border-border/50 sticky top-[210px] bg-background z-10 overflow-x-auto no-scrollbar">
        {[
          { id: 'DETAILS', label: 'Details', icon: FileText },
          { id: 'NOTES', label: `Notes (${job.notes.length})`, icon: MessageSquare },
          { id: 'PARTS', label: `Parts (${job.parts.length})`, icon: Wrench },
          { id: 'PHOTOS', label: `Photos (${job.photos.length})`, icon: Camera },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-4 px-4 font-bold text-sm transition-colors min-w-[120px]",
                activeTab === tab.id ? "text-primary-blue border-b-2 border-primary-blue" : "text-muted-text hover:text-white"
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="p-4 flex-1">
        {activeTab === 'DETAILS' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-bold text-muted-text uppercase tracking-widest mb-2">Problem Description</h3>
              <div className="glass p-4 rounded-xl border border-border/50">
                <p className="text-white/90 leading-relaxed whitespace-pre-wrap">{job.appointment.problemDescription}</p>
              </div>
            </div>
            
            {job.diagnosis && (
              <div>
                <h3 className="text-sm font-bold text-muted-text uppercase tracking-widest mb-2">Diagnosis</h3>
                <div className="glass p-4 rounded-xl border border-border/50">
                  <p className="text-white/90 leading-relaxed whitespace-pre-wrap">{job.diagnosis}</p>
                </div>
              </div>
            )}
          </div>
        )}
        
        {activeTab === 'NOTES' && <NotesTab job={job} />}
        {activeTab === 'PARTS' && <PartsTab job={job} />}
        {activeTab === 'PHOTOS' && <PhotosTab job={job} />}
      </div>

    </div>
  );
}
