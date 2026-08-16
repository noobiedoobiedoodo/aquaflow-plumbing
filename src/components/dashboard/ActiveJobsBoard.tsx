import { prisma } from '@/lib/db';
import { Clock, MapPin, CheckCircle2, HardHat, Navigation } from 'lucide-react';
import { cn } from '@/lib/utils';

export async function ActiveJobsBoard() {
  const activeJobs = await prisma.job.findMany({
    where: {
      status: { in: ['ASSIGNED', 'EN_ROUTE', 'WORKING'] }
    },
    include: {
      appointment: {
        include: {
          service: true,
          property: true,
        }
      },
      technician: true,
    },
    orderBy: {
      updatedAt: 'desc'
    }
  });

  const columns = [
    { id: 'ASSIGNED', title: 'Assigned / Scheduled', icon: Clock, color: 'text-primary-blue', bg: 'bg-primary-blue/10' },
    { id: 'EN_ROUTE', title: 'En Route', icon: Navigation, color: 'text-water-cyan', bg: 'bg-water-cyan/10' },
    { id: 'WORKING', title: 'In Progress', icon: Wrench, color: 'text-warning', bg: 'bg-warning/10' },
  ];

  return (
    <div className="flex h-full gap-4 min-w-[800px]">
      {columns.map((col) => {
        const columnJobs = activeJobs.filter(j => j.status === col.id);
        
        return (
          <div key={col.id} className="flex-1 flex flex-col h-full bg-background/50 rounded-xl border border-border/50 overflow-hidden">
            <div className={cn("p-3 border-b border-border/50 flex items-center gap-2", col.bg)}>
              <col.icon className={cn("w-4 h-4", col.color)} />
              <h3 className={cn("font-bold text-sm tracking-wider uppercase", col.color)}>{col.title}</h3>
              <div className="ml-auto text-xs font-bold bg-background/50 text-white px-2 py-0.5 rounded-full">
                {columnJobs.length}
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {columnJobs.length === 0 ? (
                <div className="h-24 flex items-center justify-center text-sm text-muted-text opacity-50">
                  No jobs in this phase
                </div>
              ) : (
                columnJobs.map((job) => (
                  <div key={job.id} className="glass p-3 rounded-lg border border-border hover:border-white/20 transition-colors cursor-pointer group">
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-bold text-white text-sm">{job.appointment.service.name}</div>
                      {job.appointment.isEmergency && (
                        <div className="w-2 h-2 rounded-full bg-danger animate-pulse mt-1" title="Emergency"></div>
                      )}
                    </div>
                    
                    <div className="text-xs text-muted-text font-mono mb-3">{job.appointment.appointmentNumber}</div>
                    
                    <div className="space-y-1.5 mb-3">
                      <div className="flex items-center gap-1.5 text-xs text-white/80">
                        <MapPin className="w-3 h-3 text-muted-text" />
                        <span className="truncate">{job.appointment.property.city}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-white/80">
                        <Clock className="w-3 h-3 text-muted-text" />
                        <span>{job.appointment.startTime}</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-border/50 flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-secondary-bg flex items-center justify-center text-muted-text group-hover:text-primary-blue transition-colors">
                        <HardHat className="w-3 h-3" />
                      </div>
                      <span className="text-xs font-semibold text-white/90">
                        {job.technician?.firstName} {job.technician?.lastName?.charAt(0)}.
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Need to import Wrench locally since it wasn't in the top level import
import { Wrench } from 'lucide-react';
