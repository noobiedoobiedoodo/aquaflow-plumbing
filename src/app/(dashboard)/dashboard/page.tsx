import { prisma } from '@/lib/db';
import { AlertCircle, Wrench, HardHat, Car, Clock } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { differenceInMinutes } from 'date-fns';
import { RealTimeListener } from '@/components/dashboard/RealTimeListener';

import { requireRoleInOrg } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/constants';

export default async function OperationsCommandCenter() {
  const { organizationId } = await requireRoleInOrg(ADMIN_ROLES);

  // Fetch real-time metrics strictly scoped to organizationId
  const [
    emergencyJobs,
    unassignedJobs,
    activeTechsCount,
    enRouteTechsCount,
    lateJobsCount,
    attentionTasks,
    activeJobsList,
    techsWithLocation
  ] = await Promise.all([
    prisma.job.count({ 
      where: { 
        organizationId, 
        status: { notIn: ['COMPLETED', 'CANCELLED'] }, 
        appointment: { isEmergency: true } 
      } 
    }),
    prisma.job.count({ where: { organizationId, status: 'CREATED', technicianId: null } }),
    prisma.technician.count({ where: { organizationId, isActive: true } }),
    prisma.job.count({ where: { organizationId, status: 'EN_ROUTE' } }),
    prisma.jobActivity.count({ 
      where: { 
        job: { organizationId }, 
        action: { in: ['LIKELY_LATE_FLAGGED', 'CRITICAL_LATE_FLAGGED'] } 
      } 
    }),
    prisma.task.findMany({ 
      where: { organizationId, status: 'OPEN' }, 
      orderBy: { priority: 'asc' }, 
      take: 10 
    }),
    prisma.job.findMany({ 
      where: { 
        organizationId, 
        status: { in: ['EN_ROUTE', 'ARRIVED', 'WORKING'] } 
      },
      include: { 
        technician: true, 
        appointment: { include: { customer: true, property: true } },
        operationalForecasts: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      },
      orderBy: { updatedAt: 'desc' }
    }),
    prisma.technician.findMany({
      where: { organizationId, isActive: true, currentLat: { not: null } },
      select: { id: true, firstName: true, currentLat: true, currentLng: true, locationUpdatedAt: true, availabilityStatus: true }
    })
  ]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4">
      <RealTimeListener />
      <h1 className="text-2xl font-bold tracking-tight text-neutral-900">AQUAFLOW OPERATIONS</h1>
      
      {/* Top Metrics Bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <MetricCard icon={AlertCircle} label="Emergencies" value={emergencyJobs} danger={emergencyJobs > 0} />
        <MetricCard icon={Wrench} label="Unassigned" value={unassignedJobs} warning={unassignedJobs > 0} />
        <MetricCard icon={HardHat} label="Active Techs" value={activeTechsCount} />
        <MetricCard icon={Car} label="En Route" value={enRouteTechsCount} />
        <MetricCard icon={Clock} label="Late Jobs" value={lateJobsCount} danger={lateJobsCount > 0} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left: Operations Map (Fleet Tracking) */}
        <div className="lg:col-span-2 bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-sm flex flex-col h-[400px]">
          <div className="px-4 py-3 border-b bg-neutral-50 font-semibold text-neutral-800 uppercase tracking-wider text-xs">
            Operations Map (Fleet Tracking)
          </div>
          <div className="p-4 flex-1 overflow-y-auto">
            {techsWithLocation.length === 0 ? (
              <p className="text-neutral-500 text-sm">No active fleet tracking data.</p>
            ) : (
              <div className="space-y-4">
                {techsWithLocation.map(tech => {
                  const staleMins = tech.locationUpdatedAt ? differenceInMinutes(new Date(), tech.locationUpdatedAt) : 999;
                  const isStale = staleMins > 10;
                  return (
                    <div key={tech.id} className="flex items-center justify-between p-3 border rounded-lg bg-neutral-50">
                      <div>
                        <div className="font-semibold text-neutral-900">{tech.firstName}</div>
                        <div className="text-xs text-neutral-500">
                          {tech.currentLat?.toFixed(4)}, {tech.currentLng?.toFixed(4)}
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className={isStale ? "border-amber-200 text-amber-700 bg-amber-50" : "border-emerald-200 text-emerald-700 bg-emerald-50"}>
                          {isStale ? `⚠️ Stale - ${staleMins} mins` : `Updated ${staleMins} mins ago`}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: Attention Board */}
        <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-sm flex flex-col h-[400px]">
           <div className="px-4 py-3 border-b bg-neutral-50 font-semibold text-neutral-800 uppercase tracking-wider text-xs">
            Attention Required
          </div>
          <div className="p-4 flex-1 overflow-y-auto space-y-3">
            {attentionTasks.length === 0 ? (
              <p className="text-neutral-500 text-sm">No pending tasks. Clear board.</p>
            ) : (
              attentionTasks.map(task => (
                <div key={task.id} className="p-3 border rounded-lg hover:bg-neutral-50 flex items-start gap-3">
                  <div className={`mt-0.5 shrink-0 h-2 w-2 rounded-full ${task.priority === 'URGENT' || task.priority === 'HIGH' ? 'bg-red-500' : 'bg-orange-400'}`} />
                  <div>
                    <div className="font-medium text-sm text-neutral-900">{task.title}</div>
                    <div className="text-xs text-neutral-500 mt-1">{task.type.replace('_', ' ')}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Bottom: Active Jobs List */}
      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b bg-neutral-50 font-semibold text-neutral-800 uppercase tracking-wider text-xs">
          Active Jobs
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-neutral-50/50 text-neutral-500 border-b">
              <tr>
                <th className="px-4 py-3 font-medium">Job ID</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Technician</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">ETA / Predict</th>
                <th className="px-4 py-3 font-medium">Risk</th>
                <th className="px-4 py-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {activeJobsList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-neutral-500">No active jobs in the field.</td>
                </tr>
              ) : (
                activeJobsList.map(job => {
                  const forecast = job.operationalForecasts?.[0];
                  let riskLabel = 'LOW';
                  let riskColor = 'bg-neutral-100 text-neutral-700';
                  
                  if (forecast) {
                    if (forecast.lateProbability > 0.5) {
                      riskLabel = `HIGH (${Math.round(forecast.lateProbability * 100)}%)`;
                      riskColor = 'bg-red-100 text-red-700 border-red-200';
                    } else if (forecast.lateProbability > 0.15) {
                      riskLabel = `MED (${Math.round(forecast.lateProbability * 100)}%)`;
                      riskColor = 'bg-orange-100 text-orange-700 border-orange-200';
                    } else {
                      riskLabel = `LOW (${Math.round(forecast.lateProbability * 100)}%)`;
                      riskColor = 'bg-emerald-100 text-emerald-700 border-emerald-200';
                    }
                  }

                  return (
                  <tr key={job.id} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-neutral-900">#{job.id.slice(-6)}</td>
                    <td className="px-4 py-3 text-neutral-600">{job.appointment?.customer.firstName} {job.appointment?.customer.lastName}</td>
                    <td className="px-4 py-3 text-neutral-600">{job.technician?.firstName || 'Unassigned'}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="uppercase text-[10px] tracking-wider">
                        {job.status.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-700">
                      {forecast ? (
                         <div className="flex flex-col">
                           <span className="font-medium text-neutral-900">{forecast.predictedCompletionAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                           <span className="text-xs text-neutral-500">via {forecast.routingProvider}</span>
                         </div>
                      ) : (
                        <span className="text-neutral-400 text-xs">No forecast</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {forecast ? (
                        <div className="group relative inline-block cursor-help">
                          <Badge variant="outline" className={`text-[10px] tracking-wider ${riskColor}`}>
                            {riskLabel}
                          </Badge>
                          {/* Rich explainability tooltip */}
                          <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 opacity-0 transition-opacity group-hover:opacity-100 bg-neutral-900 text-white text-xs rounded shadow-lg p-3">
                            <div className="font-semibold mb-2 border-b border-neutral-700 pb-1">Forecast Factors</div>
                            <div className="space-y-1 mb-2">
                               {(() => {
                                 try {
                                   const r = JSON.parse(forecast.reasoningJson);
                                   return r.factors.map((f: any, i: number) => (
                                     <div key={i} className="flex justify-between">
                                       <span className="text-neutral-400">{f.factor.replace('_', ' ')}:</span>
                                       <span className={f.impactMinutes > 0 ? 'text-red-400' : 'text-emerald-400'}>
                                         {f.impactMinutes > 0 ? '+' : ''}{f.impactMinutes}m
                                       </span>
                                     </div>
                                   ));
                                 } catch(e) { return null; }
                               })()}
                            </div>
                            <div className="text-[10px] text-neutral-400 mt-2 pt-1 border-t border-neutral-700">
                               Confidence: {forecast.confidence} | Sample: {forecast.sampleSize}
                            </div>
                          </div>
                        </div>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/dashboard/jobs/${job.id}`} className="text-blue-600 hover:underline text-xs font-medium">
                        View
                      </Link>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, danger, warning }: any) {
  let colorClass = "text-neutral-900";
  let bgClass = "bg-white border-neutral-200";
  if (danger) { colorClass = "text-red-700"; bgClass = "bg-red-50 border-red-200"; }
  else if (warning) { colorClass = "text-amber-700"; bgClass = "bg-amber-50 border-amber-200"; }

  return (
    <div className={`p-4 rounded-xl border flex flex-col items-center justify-center text-center shadow-sm ${bgClass}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`h-4 w-4 ${colorClass}`} />
        <span className={`text-xs font-semibold uppercase tracking-wider ${colorClass}`}>{label}</span>
      </div>
      <div className={`text-3xl font-bold ${colorClass}`}>{value}</div>
    </div>
  );
}
