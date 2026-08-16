import { requireCustomerSession } from '@/lib/auth/customer-session';
import { prisma } from '@/lib/db';
import Link from 'next/link';
import { ArrowRight, Wrench } from 'lucide-react';

export default async function PortalJobsList() {
  const { customerId } = await requireCustomerSession();

  const jobs = await prisma.job.findMany({
    where: { appointment: { customerId } },
    orderBy: { createdAt: 'desc' },
    include: {
      appointment: { include: { service: true } },
      technician: { include: { user: true } },
    }
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">My Jobs</h1>
        <p className="text-neutral-500 mt-1">View your past and current service jobs.</p>
      </div>

      <div className="bg-white border border-neutral-200 shadow-sm rounded-xl overflow-hidden">
        <div className="divide-y divide-neutral-100">
          {jobs.length === 0 ? (
            <div className="p-8 text-center text-neutral-500">No jobs found.</div>
          ) : (
            jobs.map((job) => (
              <div key={job.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-neutral-50 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="mt-1">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      job.status === 'COMPLETED' ? 'bg-green-100 text-green-600' :
                      job.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-600' :
                      job.status === 'CANCELLED' ? 'bg-red-100 text-red-600' :
                      'bg-neutral-100 text-neutral-500'
                    }`}>
                      <Wrench className="h-5 w-5" />
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-neutral-900">
                      {job.appointment.service?.name || 'Service Call'}
                    </h3>
                    <div className="text-sm text-neutral-500 mt-1 flex items-center gap-2">
                      <span>Job #{job.id.substring(0,8).toUpperCase()}</span>
                      <span>•</span>
                      <span>{new Date(job.createdAt).toLocaleDateString()}</span>
                    </div>
                    {job.technician && (
                      <div className="text-sm text-neutral-600 mt-2">
                        Technician: {job.technician.user.firstName} {job.technician.user.lastName}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                    job.status === 'COMPLETED' ? 'bg-green-50 text-green-700 border-green-200' :
                    job.status === 'IN_PROGRESS' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                    job.status === 'CANCELLED' ? 'bg-red-50 text-red-700 border-red-200' :
                    'bg-neutral-50 text-neutral-700 border-neutral-200'
                  }`}>
                    {job.status.replace('_', ' ')}
                  </span>
                  <Link href={`/portal/jobs/${job.id}`} className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1">
                    View <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
