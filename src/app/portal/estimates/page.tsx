import { requireCustomerSession } from '@/lib/auth/customer-session';
import { prisma } from '@/lib/db';
import Link from 'next/link';
import { ArrowRight, FileText } from 'lucide-react';

export default async function PortalEstimatesList() {
  const { customerId } = await requireCustomerSession();

  const estimates = await prisma.estimate.findMany({
    where: { customerId },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Estimates</h1>
        <p className="text-neutral-500 mt-1">Review and approve cost estimates for your upcoming work.</p>
      </div>

      <div className="bg-white border border-neutral-200 shadow-sm rounded-xl overflow-hidden">
        <div className="divide-y divide-neutral-100">
          {estimates.length === 0 ? (
            <div className="p-8 text-center text-neutral-500">No estimates found.</div>
          ) : (
            estimates.map((est) => (
              <div key={est.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-neutral-50 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="mt-1">
                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                      <FileText className="h-5 w-5" />
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-neutral-900">
                      Estimate {est.estimateNumber}
                      {est.revision > 1 && <span className="ml-2 text-xs text-neutral-400 font-normal">Rev {est.revision}</span>}
                    </h3>
                    <div className="text-sm text-neutral-500 mt-1 flex items-center gap-2">
                      <span>${est.total.toFixed(2)}</span>
                      <span>•</span>
                      <span>{new Date(est.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                    est.status === 'APPROVED' ? 'bg-green-50 text-green-700 border-green-200' :
                    est.status === 'REJECTED' ? 'bg-red-50 text-red-700 border-red-200' :
                    est.status === 'SENT' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                    'bg-neutral-50 text-neutral-700 border-neutral-200'
                  }`}>
                    {est.status}
                  </span>
                  <Link href={`/portal/estimates/${est.id}`} className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1">
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
