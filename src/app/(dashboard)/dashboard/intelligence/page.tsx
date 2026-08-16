import { prisma } from '@/lib/db';
import { requireRoleInOrg } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/constants';
import { ForecastEvaluator } from '@/lib/intelligence/evaluation/forecast-evaluator';
import { TechnicianVariance } from '@/lib/intelligence/evaluation/technician-variance';
import { Brain, Activity, Target, Shield, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default async function IntelligenceDashboard() {
  const { organizationId } = await requireRoleInOrg(ADMIN_ROLES);

  // 1. Forecast Evaluation (Model: forecast-v1)
  const { metrics, calibration } = await ForecastEvaluator.evaluateModel(organizationId, 'forecast-v1');

  // 2. Optimization Proposal Evaluation
  const proposals = await prisma.optimizationProposal.findMany({ where: { organizationId } });
  const proposalsGenerated = proposals.length;
  const accepted = proposals.filter(p => p.status === 'ACCEPTED').length;
  const rejected = proposals.filter(p => p.status === 'REJECTED').length;
  const expired = proposals.filter(p => p.status === 'EXPIRED').length;
  const observedDelayReduction = proposals
    .filter(p => p.status === 'ACCEPTED' && p.observedDelayReduction)
    .reduce((sum, p) => sum + (p.observedDelayReduction || 0), 0);

  // 3. Technician Variance
  const varianceBoard = await TechnicianVariance.getVarianceLeaderboard(organizationId);

  return (
    <div className="space-y-8 max-w-6xl mx-auto p-4">
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Intelligence Calibration</h1>
          <p className="text-neutral-500 text-sm mt-1">Model performance, calibration, and optimization evaluation</p>
        </div>
        <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200">
          <Brain className="h-3 w-3 mr-1" />
          Model Governance Active
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Forecast Performance */}
        <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-sm lg:col-span-1">
          <div className="px-4 py-3 border-b bg-neutral-50 flex items-center justify-between">
             <div className="flex items-center gap-2">
               <Target className="h-4 w-4 text-blue-500" />
               <h2 className="font-semibold text-neutral-800 tracking-tight">Forecast-v1 Performance</h2>
             </div>
             <Badge variant="outline" className="text-[10px]">N = {metrics.totalEvaluated}</Badge>
          </div>
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
               <MetricCard label="MAE" value={`${metrics.maeMinutes}m`} subtext="Mean Absolute Error" />
               <MetricCard label="Bias" value={`${metrics.biasMinutes > 0 ? '+' : ''}${metrics.biasMinutes}m`} subtext="Mean Bias" />
               <MetricCard label="Precision" value={`${metrics.precision}%`} subtext="Late classification" />
               <MetricCard label="Recall" value={`${metrics.recall}%`} subtext="Late classification" />
               <MetricCard label="F1 Score" value={`${metrics.f1}%`} subtext="Harmonic mean" />
               <MetricCard label="Brier Score" value={metrics.brierScore.toFixed(3)} subtext="Prob. Accuracy" />
            </div>
            
            <div className="pt-4 border-t border-neutral-100 grid grid-cols-2 gap-4">
               <div>
                  <div className="text-xs text-neutral-500 uppercase font-semibold mb-1">False Positives</div>
                  <div className="text-lg font-medium text-neutral-800">{metrics.fpr}%</div>
               </div>
               <div>
                  <div className="text-xs text-neutral-500 uppercase font-semibold mb-1">False Negatives</div>
                  <div className="text-lg font-medium text-neutral-800">{metrics.fnr}%</div>
               </div>
            </div>

            <div className="pt-4 border-t border-neutral-100 space-y-2">
               <div className="text-xs text-neutral-500 uppercase font-semibold mb-2">Data Quality</div>
               <div className="flex justify-between text-sm">
                  <span className="text-neutral-600">Total Valid Evaluated</span>
                  <span className="font-medium">{metrics.totalEvaluated}</span>
               </div>
               <div className="flex justify-between text-sm">
                  <span className="text-neutral-600">Insufficient Data</span>
                  <span className="font-medium text-amber-600">{metrics.insufficientData}</span>
               </div>
               <div className="flex justify-between text-sm">
                  <span className="text-neutral-600">Invalidated (e.g. Cancelled)</span>
                  <span className="font-medium text-neutral-400">{metrics.invalidated}</span>
               </div>
            </div>
          </div>
        </div>

        {/* Calibration & Optimizer */}
        <div className="space-y-6 lg:col-span-2">
          
          <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b bg-neutral-50 flex items-center justify-between">
               <div className="flex items-center gap-2">
                 <Activity className="h-4 w-4 text-emerald-500" />
                 <h2 className="font-semibold text-neutral-800 tracking-tight">Calibration Curve</h2>
               </div>
            </div>
            <div className="p-0 overflow-x-auto">
               <table className="w-full text-sm text-left">
                  <thead className="bg-neutral-50 text-neutral-500 uppercase text-[10px] tracking-wider border-b">
                     <tr>
                        <th className="px-4 py-2 font-medium">Predicted Probability</th>
                        <th className="px-4 py-2 font-medium">Actual Late Rate</th>
                        <th className="px-4 py-2 font-medium">Sample Size</th>
                        <th className="px-4 py-2 font-medium">Calibration Status</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y">
                     {calibration.map((row, i) => (
                        <tr key={i} className="hover:bg-neutral-50">
                           <td className="px-4 py-2 font-medium text-neutral-700">{row.range}</td>
                           <td className="px-4 py-2">{row.actualLateRate}%</td>
                           <td className="px-4 py-2 text-neutral-500">{row.count}</td>
                           <td className="px-4 py-2">
                              {row.status === 'Excellent' && <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none">Excellent</Badge>}
                              {row.status === 'Good' && <Badge variant="outline" className="bg-blue-50 text-blue-700">Good</Badge>}
                              {row.status === 'Slightly underconfident' && <Badge variant="outline" className="border-amber-200 text-amber-700">Underconfident</Badge>}
                              {row.status === 'Overconfident' && <Badge variant="outline" className="border-red-200 text-red-700">Overconfident</Badge>}
                              {row.status === 'Insufficient Data' && <span className="text-xs text-neutral-400">Insufficient Data</span>}
                           </td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>
          </div>

          <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b bg-neutral-50 flex items-center justify-between">
               <div className="flex items-center gap-2">
                 <Shield className="h-4 w-4 text-purple-500" />
                 <h2 className="font-semibold text-neutral-800 tracking-tight">Optimizer Performance</h2>
               </div>
            </div>
            <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
               <div>
                  <div className="text-xs text-neutral-500 uppercase font-semibold mb-1">Proposals</div>
                  <div className="text-2xl font-bold text-neutral-900">{proposalsGenerated}</div>
               </div>
               <div>
                  <div className="text-xs text-emerald-600 uppercase font-semibold mb-1">Accepted</div>
                  <div className="text-2xl font-bold text-emerald-700">{accepted}</div>
               </div>
               <div>
                  <div className="text-xs text-neutral-500 uppercase font-semibold mb-1">Rejected / Expired</div>
                  <div className="text-2xl font-bold text-neutral-600">{rejected + expired}</div>
               </div>
               <div>
                  <div className="text-xs text-purple-600 uppercase font-semibold mb-1">Observed Reduction</div>
                  <div className="text-2xl font-bold text-purple-700">{observedDelayReduction}m</div>
               </div>
            </div>
          </div>

        </div>
      </div>

      {/* Technician Variance */}
      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b bg-neutral-50 flex items-center gap-2">
             <AlertTriangle className="h-4 w-4 text-amber-500" />
             <h2 className="font-semibold text-neutral-800 tracking-tight">Technician Variance</h2>
          </div>
          <div className="p-0 overflow-x-auto">
             <table className="w-full text-sm text-left">
                <thead className="bg-neutral-50 text-neutral-500 uppercase text-[10px] tracking-wider border-b">
                   <tr>
                      <th className="px-4 py-3 font-medium">Technician</th>
                      <th className="px-4 py-3 font-medium">Service Type</th>
                      <th className="px-4 py-3 font-medium">Org Avg (N)</th>
                      <th className="px-4 py-3 font-medium">Tech Avg (N)</th>
                      <th className="px-4 py-3 font-medium text-right">Variance</th>
                      <th className="px-4 py-3 font-medium text-right">Data Confidence</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                   {varianceBoard.length === 0 ? (
                     <tr>
                       <td colSpan={6} className="px-4 py-8 text-center text-neutral-500">Not enough historical data to compute variance.</td>
                     </tr>
                   ) : varianceBoard.map((row, i) => (
                      <tr key={i} className="hover:bg-neutral-50">
                         <td className="px-4 py-3 font-medium text-neutral-900">{row.technicianName}</td>
                         <td className="px-4 py-3 text-neutral-600">{row.serviceName}</td>
                         <td className="px-4 py-3 text-neutral-500">{row.orgAverage}m <span className="text-[10px] ml-1">(N={row.orgSampleSize})</span></td>
                         <td className="px-4 py-3 font-medium">{row.techAverage}m <span className="text-[10px] text-neutral-400 font-normal ml-1">(N={row.techSampleSize})</span></td>
                         <td className="px-4 py-3 text-right">
                           <span className={`font-semibold ${row.variancePercent > 10 ? 'text-red-600' : row.variancePercent < -10 ? 'text-emerald-600' : 'text-neutral-600'}`}>
                              {row.variancePercent > 0 ? '+' : ''}{row.variancePercent}%
                           </span>
                         </td>
                         <td className="px-4 py-3 text-right">
                            {row.confidence === 'HIGH CONFIDENCE' ? (
                               <Badge variant="outline" className="border-emerald-200 text-emerald-700 bg-emerald-50">High (N={row.techSampleSize})</Badge>
                            ) : (
                               <Badge variant="outline" className="border-neutral-200 text-neutral-500">Limited (N={row.techSampleSize})</Badge>
                            )}
                         </td>
                      </tr>
                   ))}
                </tbody>
             </table>
          </div>
      </div>

    </div>
  );
}

function MetricCard({ label, value, subtext }: { label: string, value: string | number, subtext: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-neutral-500 uppercase font-semibold mb-1">{label}</span>
      <span className="text-2xl font-bold text-neutral-900 leading-none">{value}</span>
      <span className="text-[10px] text-neutral-400 mt-1">{subtext}</span>
    </div>
  );
}
