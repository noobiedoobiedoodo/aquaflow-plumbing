import { requireAuth } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import Link from 'next/link';
import { MapPin, Clock, Wrench } from 'lucide-react';

export const metadata = {
  title: 'Today | AquaFlow Tech',
};

function formatTime(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: 'numeric',
    hour12: true,
  }).format(date);
}

export default async function TechDashboard() {
  const { user } = await requireAuth();

  // Look up technician profile linked to this user
  const technician = await prisma.technician.findFirst({
    where: { userId: user.id },
  });

  // Fetch jobs assigned to this technician profile
  const jobs = technician ? await prisma.job.findMany({
    where: {
      technicianId: technician.id,
      organizationId: technician.organizationId,
      status: { in: ['ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'WORKING'] },
    },
    include: {
      appointment: {
        include: { property: true, service: true },
      },
    },
    orderBy: {
      appointment: { startTime: 'asc' },
    },
  }) : [];

  const activeJob = jobs.find((j) => ['EN_ROUTE', 'ARRIVED', 'WORKING'].includes(j.status));
  const pendingJobs = jobs.filter((j) => j.id !== activeJob?.id);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="p-6 pt-12 pb-8 bg-gradient-to-b from-primary-blue/20 to-transparent">
        <h1 className="text-sm font-bold text-primary-blue tracking-widest uppercase mb-1">
          Good Morning
        </h1>
        <h2 className="text-3xl font-bold text-white tracking-tight">
          {user.firstName || 'Technician'}
        </h2>
      </header>

      <div className="px-4 space-y-8 pb-32">
        
        {/* Active Job Widget */}
        {activeJob && (
          <section>
            <div className="flex items-center gap-2 mb-4 px-2">
              <div className="w-2 h-2 rounded-full bg-water-cyan animate-pulse"></div>
              <h3 className="text-sm font-bold text-muted-text uppercase tracking-widest">
                Current Job
              </h3>
            </div>
            
            <Link href={`/tech/jobs/${activeJob.id}`} className="block">
              <div className="glass rounded-2xl border border-primary-blue/30 p-1 shadow-2xl shadow-primary-blue/5 overflow-hidden relative">
                <div className="absolute top-0 right-0 p-4">
                  <span className="bg-primary-blue/20 text-primary-blue px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                    {activeJob.status.replace('_', ' ')}
                  </span>
                </div>
                
                <div className="bg-secondary-bg/50 rounded-xl p-5">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary-blue/10 flex items-center justify-center shrink-0">
                      <Wrench className="w-6 h-6 text-primary-blue" />
                    </div>
                    <div>
                      <h4 className="text-xl font-bold text-white mb-1">
                        {activeJob.appointment.service?.name || 'Service Call'}
                      </h4>
                      <div className="flex items-center gap-2 text-muted-text text-sm mb-1">
                        <MapPin className="w-4 h-4" />
                        <span className="truncate">{activeJob.appointment.property.address}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-text text-sm">
                        <Clock className="w-4 h-4" />
                        <span>Started {formatTime(activeJob.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-6">
                    <div className="w-full bg-primary-blue text-white text-center py-3 rounded-lg font-bold">
                      Open Workspace
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          </section>
        )}

        {/* Pending Jobs List */}
        <section>
          <div className="flex items-center justify-between mb-4 px-2">
            <h3 className="text-sm font-bold text-muted-text uppercase tracking-widest">
              Up Next
            </h3>
            <span className="text-sm text-muted-text font-medium">{pendingJobs.length} Jobs</span>
          </div>
          
          <div className="space-y-3">
            {pendingJobs.length === 0 ? (
              <div className="glass rounded-2xl p-8 text-center border border-border/50">
                <p className="text-muted-text">No more jobs scheduled for today.</p>
              </div>
            ) : (
              pendingJobs.map((job) => (
                <Link key={job.id} href={`/tech/jobs/${job.id}`}>
                  <div className="glass rounded-xl border border-border/50 p-4 hover:bg-white/5 transition-colors flex items-center gap-4">
                    <div className="w-14 h-14 rounded-lg bg-secondary-bg flex flex-col items-center justify-center shrink-0 border border-white/5">
                      <span className="text-xs font-bold text-muted-text uppercase">{new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(new Date(job.appointment.date))}</span>
                      <span className="text-sm font-bold text-white">{job.appointment.startTime}</span>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h4 className="text-base font-bold text-white truncate">
                        {job.appointment.service?.name || 'Service Call'}
                      </h4>
                      <p className="text-sm text-muted-text truncate">
                        {job.appointment.property.address}
                      </p>
                    </div>
                    
                    {job.appointment.isEmergency && (
                      <div className="w-2 h-2 rounded-full bg-danger shrink-0 mr-2"></div>
                    )}
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>

      </div>
    </div>
  );
}
