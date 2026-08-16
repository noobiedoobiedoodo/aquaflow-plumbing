import { prisma } from '@/lib/db';
import { requireRoleInOrg } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/constants';
import Link from 'next/link';
import { Wrench, Calendar, MapPin, User, ArrowRight, Clock, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default async function JobsPage() {
  const { organizationId } = await requireRoleInOrg(ADMIN_ROLES);

  const jobs = await prisma.job.findMany({
    where: { organizationId },
    include: {
      appointment: {
        include: {
          service: true,
          customer: true,
          property: true,
        },
      },
      technician: true,
    },
    orderBy: { updatedAt: 'desc' },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Wrench className="w-6 h-6 text-primary-blue" /> Dispatch Jobs Operations
          </h1>
          <p className="text-sm text-muted-text mt-1">
            Monitor, assign, and track field jobs across your service team.
          </p>
        </div>
      </div>

      <div className="glass rounded-2xl border border-border/50 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-secondary-bg/60 border-b border-border/50 text-xs uppercase tracking-wider text-muted-text font-semibold">
              <tr>
                <th className="px-6 py-4">Job & Service</th>
                <th className="px-6 py-4">Customer & Location</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Technician</th>
                <th className="px-6 py-4">Appointment</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-text">
                    <Wrench className="w-8 h-8 mx-auto mb-2 opacity-40 text-muted-text" />
                    No active or completed jobs found in your organization.
                  </td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-white">
                        {job.appointment.service?.name || 'General Plumbing'}
                      </div>
                      <div className="text-xs text-muted-text mt-0.5 flex items-center gap-2">
                        <span>Job #{job.id.slice(-6)}</span>
                        {job.appointment.isEmergency && (
                          <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-400 text-[10px] font-bold">
                            EMERGENCY
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-6 py-4 text-xs space-y-1">
                      <div className="font-medium text-slate-200 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-muted-text" />
                        {job.appointment.customer.firstName} {job.appointment.customer.lastName}
                      </div>
                      <div className="text-muted-text flex items-center gap-1.5 truncate max-w-xs">
                        <MapPin className="w-3.5 h-3.5 text-muted-text shrink-0" />
                        <span>{job.appointment.property.address}, {job.appointment.property.city}</span>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        job.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                        job.status === 'WORKING' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                        job.status === 'EN_ROUTE' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' :
                        job.status === 'ASSIGNED' ? 'bg-blue-500/10 text-primary-blue border border-primary-blue/20' :
                        'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                      }`}>
                        {job.status.replace('_', ' ')}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-xs">
                      {job.technician ? (
                        <div className="text-slate-200 font-medium">
                          {job.technician.firstName} {job.technician.lastName}
                        </div>
                      ) : (
                        <span className="text-amber-400 font-medium flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" /> Unassigned
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-xs text-muted-text">
                      <div className="text-slate-300">{new Date(job.appointment.date).toLocaleDateString()}</div>
                      <div>{job.appointment.startTime} - {job.appointment.endTime}</div>
                    </td>

                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/dashboard/jobs/${job.id}`}
                        className="text-xs font-semibold text-primary-blue hover:text-cyan-400 inline-flex items-center gap-1 transition"
                      >
                        Details <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
