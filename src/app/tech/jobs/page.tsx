import { requireRoleInOrg } from '@/lib/auth/session';
import { TECH_ROLES } from '@/lib/constants';
import { prisma } from '@/lib/db';
import Link from 'next/link';

export const metadata = {
  title: 'All Assigned Jobs | AquaFlow Tech',
};

export default async function TechAllJobsPage() {
  const { user, organizationId } = await requireRoleInOrg(TECH_ROLES);

  const technician = await prisma.technician.findFirst({
    where: { userId: user.id, organizationId }
  });

  const jobs = technician ? await prisma.job.findMany({
    where: { technicianId: technician.id, organizationId },
    include: {
      appointment: {
        include: { property: true, service: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  }) : [];

  return (
    <div className="flex flex-col min-h-screen">
      <header className="p-6 pt-12 pb-6 bg-secondary-bg/80 border-b border-border/50 sticky top-0 z-10 backdrop-blur-xl">
        <h1 className="text-2xl font-bold text-white tracking-tight">All Assignments</h1>
      </header>

      <div className="p-4 space-y-3">
        {jobs.length === 0 ? (
          <div className="glass p-8 text-center rounded-xl border border-border/50">
            <p className="text-muted-text">You have no assigned jobs history.</p>
          </div>
        ) : (
          jobs.map((job) => (
            <Link key={job.id} href={`/tech/jobs/${job.id}`} className="block">
              <div className="glass rounded-xl border border-border/50 p-4 hover:bg-white/5 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="text-base font-bold text-white">
                    {job.appointment.service?.name || 'Service Call'}
                  </h4>
                  <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-primary-blue/20 text-primary-blue">
                    {job.status.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-sm text-muted-text truncate">{job.appointment.property.address}</p>
                <div className="mt-2 text-xs text-muted-text font-medium">
                  {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(job.createdAt)}
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
