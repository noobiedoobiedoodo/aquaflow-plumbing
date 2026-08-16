import { prisma } from '@/lib/db';
import { AlertTriangle, Clock, MapPin } from 'lucide-react';
import { DispatchButton } from './DispatchButton';
import { AutoRefresh } from './AutoRefresh';

export async function IncomingRequests() {
  const pendingJobs = await prisma.job.findMany({
    where: { 
      status: 'CREATED',
      technicianId: null,
    },
    include: {
      appointment: {
        include: {
          customer: true,
          property: true,
          service: true,
        }
      }
    },
    orderBy: {
      createdAt: 'asc'
    }
  });

  if (pendingJobs.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-6 opacity-50">
        <AutoRefresh intervalMs={15000} />
        <Clock className="w-12 h-12 text-muted-text mb-4" />
        <p className="text-white font-medium">No incoming requests.</p>
        <p className="text-sm text-muted-text">Waiting for new bookings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <AutoRefresh intervalMs={15000} />
      {pendingJobs.map((job) => {
        const isEmergency = job.appointment.isEmergency;
        
        return (
          <div 
            key={job.id} 
            className={`p-4 rounded-xl border ${isEmergency ? 'bg-danger/5 border-danger/30' : 'bg-background/50 border-border/50 hover:border-primary-blue/30'} transition-all`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                {isEmergency && <AlertTriangle className="w-4 h-4 text-danger animate-pulse" />}
                <span className={`font-bold text-sm uppercase tracking-wider ${isEmergency ? 'text-danger' : 'text-primary-blue'}`}>
                  {job.appointment.service.name}
                </span>
              </div>
              <span className="text-xs font-mono text-muted-text bg-secondary-bg px-2 py-1 rounded">
                {job.appointment.appointmentNumber}
              </span>
            </div>

            <div className="space-y-2 mb-4">
              <div className="flex items-start gap-2 text-sm text-white">
                <MapPin className="w-4 h-4 text-muted-text shrink-0 mt-0.5" />
                <span>
                  {job.appointment.property.address} {job.appointment.property.unit && `Apt ${job.appointment.property.unit}`}<br/>
                  <span className="text-muted-text">{job.appointment.property.city}</span>
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-white">
                <Clock className="w-4 h-4 text-muted-text shrink-0" />
                <span>Requested: <span className="font-semibold">{job.appointment.startTime} - {job.appointment.endTime}</span></span>
              </div>
            </div>

            <DispatchButton job={job} />
          </div>
        );
      })}
    </div>
  );
}
