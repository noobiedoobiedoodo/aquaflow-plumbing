import { prisma } from '@/lib/db';
import { requireRoleInOrg } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/constants';
import { ScheduleOptimizer } from '@/lib/intelligence/schedule-optimizer';
import { AlertCircle, ArrowRight, Zap, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { OptimizerClient } from './optimizer-client';

export default async function OptimizePage() {
  const { organizationId } = await requireRoleInOrg(ADMIN_ROLES);

  const { cascadingDelays, proposals } = await ScheduleOptimizer.calculateCascades(organizationId);

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Schedule Optimizer</h1>
          <p className="text-neutral-500 text-sm mt-1">Predictive analysis of downstream schedule impacts</p>
        </div>
        <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200">
          <Zap className="h-3 w-3 mr-1" />
          Intelligence Active
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Left Column: Delay Analysis */}
        <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-sm flex flex-col">
          <div className="px-4 py-3 border-b bg-neutral-50 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-orange-500" />
            <h2 className="font-semibold text-neutral-800 tracking-tight">Identified Cascades</h2>
          </div>
          <div className="p-4 space-y-4">
            {cascadingDelays.length === 0 ? (
              <div className="text-center py-8 text-neutral-500 flex flex-col items-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-400 mb-2" />
                <p>No cascading delays detected.</p>
                <p className="text-sm">The current schedule is stable.</p>
              </div>
            ) : (
              cascadingDelays.map((cascade, i) => (
                <div key={i} className="p-3 border border-orange-200 bg-orange-50 rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-medium text-orange-900">{cascade.technicianName}</span>
                    <Badge variant="outline" className="border-orange-300 text-orange-700">+{cascade.lateMinutes}m Late</Badge>
                  </div>
                  <p className="text-sm text-orange-800">
                    Will delay <strong>{cascade.downstreamCount}</strong> subsequent jobs today.
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Shift Proposals */}
        <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-sm flex flex-col">
          <div className="px-4 py-3 border-b bg-neutral-50 flex items-center gap-2">
            <Zap className="h-4 w-4 text-blue-500" />
            <h2 className="font-semibold text-neutral-800 tracking-tight">Optimizer Proposals</h2>
          </div>
          <div className="p-4 space-y-4">
             {proposals.length === 0 ? (
               <div className="text-center py-8 text-neutral-500">
                 <p>No optimization proposals available.</p>
               </div>
             ) : (
               <OptimizerClient proposals={proposals} />
             )}
          </div>
        </div>
      </div>

    </div>
  );
}
