import { prisma } from '@/lib/db';
import { requireRoleInOrg } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/constants';
import { HardHat, Phone, Mail, CheckCircle2, Clock, MapPin, Wrench } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default async function TechsPage() {
  const { organizationId } = await requireRoleInOrg(ADMIN_ROLES);

  const techs = await prisma.technician.findMany({
    where: { organizationId },
    include: {
      user: { select: { email: true } },
      jobs: {
        where: { status: { in: ['ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'WORKING'] } },
        include: { appointment: { include: { service: true } } },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <HardHat className="w-6 h-6 text-primary-blue" /> Field Technicians Roster
          </h1>
          <p className="text-sm text-muted-text mt-1">
            Manage your service technicians, active field assignments, and availability status.
          </p>
        </div>
      </div>

      <div className="glass rounded-2xl border border-border/50 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-secondary-bg/60 border-b border-border/50 text-xs uppercase tracking-wider text-muted-text font-semibold">
              <tr>
                <th className="px-6 py-4">Technician</th>
                <th className="px-6 py-4">Contact</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Active Jobs</th>
                <th className="px-6 py-4">GPS Tracking</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {techs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-text">
                    <HardHat className="w-8 h-8 mx-auto mb-2 opacity-40 text-muted-text" />
                    No technicians registered in your organization.
                  </td>
                </tr>
              ) : (
                techs.map((t) => (
                  <tr key={t.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-white">
                        {t.firstName} {t.lastName}
                      </div>
                      <div className="text-xs text-muted-text mt-0.5">ID: #{t.id.slice(-6)}</div>
                    </td>

                    <td className="px-6 py-4 text-xs space-y-1">
                      <div className="flex items-center gap-1.5 text-slate-300">
                        <Mail className="w-3.5 h-3.5 text-muted-text" /> {t.user.email}
                      </div>
                      {t.phone && (
                        <div className="flex items-center gap-1.5 text-muted-text">
                          <Phone className="w-3.5 h-3.5 text-muted-text" /> {t.phone}
                        </div>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        t.availabilityStatus === 'AVAILABLE' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                        t.availabilityStatus === 'BUSY' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                        'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                      }`}>
                        {t.availabilityStatus}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-xs">
                      {t.jobs.length === 0 ? (
                        <span className="text-muted-text">0 active jobs</span>
                      ) : (
                        <div className="space-y-1">
                          <span className="font-semibold text-primary-blue">
                            {t.jobs.length} in progress
                          </span>
                          <div className="text-[11px] text-muted-text truncate max-w-xs">
                            Current: {t.jobs[0].appointment.service?.name || 'Service Job'} ({t.jobs[0].status})
                          </div>
                        </div>
                      )}
                    </td>

                    <td className="px-6 py-4 text-xs">
                      {t.currentLat && t.currentLng ? (
                        <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                          <MapPin className="w-3.5 h-3.5" /> Active ({t.currentLat.toFixed(2)}, {t.currentLng.toFixed(2)})
                        </div>
                      ) : (
                        <span className="text-muted-text">Location unavailable</span>
                      )}
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
