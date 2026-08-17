import { prisma } from '@/lib/db';
import { requireRoleInOrg } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/constants';
import { History, Shield, Clock, User, Activity } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default async function AuditPage() {
  const { organizationId } = await requireRoleInOrg(ADMIN_ROLES);

  const [auditLogs, jobActivities] = await Promise.all([
    prisma.auditLog.findMany({
      where: { organizationId },
      include: { user: { select: { email: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 25,
    }),
    prisma.jobActivity.findMany({
      where: { job: { organizationId } },
      include: { job: { include: { appointment: { include: { customer: true } } } } },
      orderBy: { createdAt: 'desc' },
      take: 25,
    }),
  ]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
          <Shield className="w-6 h-6 text-primary-blue" /> System Security & Operations Audit Trail
        </h1>
        <p className="text-sm text-muted-text mt-1">
          Immutable forensic log of all dispatcher assignments, state changes, security authentications, and billing actions.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Organization Security Audit */}
        <div className="glass rounded-2xl border border-border/50 overflow-hidden shadow-xl flex flex-col">
          <div className="p-4 border-b border-border/50 bg-secondary-bg/60 flex items-center justify-between">
            <h2 className="font-semibold text-white text-sm flex items-center gap-2">
              <History className="w-4 h-4 text-primary-blue" /> Security & Auth Log
            </h2>
            <span className="text-xs text-muted-text">{auditLogs.length} events recorded</span>
          </div>

          <div className="p-4 flex-1 overflow-y-auto max-h-[500px] divide-y divide-border/30">
            {auditLogs.length === 0 ? (
              <p className="text-sm text-muted-text py-8 text-center">No security audit records logged yet.</p>
            ) : (
              auditLogs.map((log) => (
                <div key={log.id} className="py-3 first:pt-0 last:pb-0 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white uppercase tracking-wider text-[11px] text-primary-blue">
                      {log.action}
                    </span>
                    <span className="text-muted-text">{new Date(log.createdAt).toLocaleTimeString()}</span>
                  </div>
                  <div className="text-slate-300">
                    Entity: <span className="font-mono text-slate-400">{log.entity} #{log.entityId.slice(-6)}</span>
                  </div>
                  {log.user && (
                    <div className="text-muted-text flex items-center gap-1">
                      <User className="w-3 h-3" /> {log.user.email}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Job Field Operations Activity */}
        <div className="glass rounded-2xl border border-border/50 overflow-hidden shadow-xl flex flex-col">
          <div className="p-4 border-b border-border/50 bg-secondary-bg/60 flex items-center justify-between">
            <h2 className="font-semibold text-white text-sm flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" /> Field Dispatch Activity
            </h2>
            <span className="text-xs text-muted-text">{jobActivities.length} actions</span>
          </div>

          <div className="p-4 flex-1 overflow-y-auto max-h-[500px] divide-y divide-border/30">
            {jobActivities.length === 0 ? (
              <p className="text-sm text-muted-text py-8 text-center">No field dispatch activities recorded.</p>
            ) : (
              jobActivities.map((act) => (
                <div key={act.id} className="py-3 first:pt-0 last:pb-0 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-emerald-400">
                      {act.action.replace(/_/g, ' ')}
                    </span>
                    <span className="text-muted-text">{new Date(act.createdAt).toLocaleTimeString()}</span>
                  </div>
                  <div className="text-slate-300">
                    Job #{act.jobId.slice(-6)} — Customer: {act.job?.appointment?.customer?.firstName} {act.job?.appointment?.customer?.lastName}
                  </div>
                  {act.metadata && (
                    <div className="text-[11px] text-muted-text font-mono truncate">
                      {act.metadata}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
