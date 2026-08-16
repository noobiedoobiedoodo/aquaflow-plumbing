import { requireCustomerSession } from '@/lib/auth/customer-session';
import { prisma } from '@/lib/db';
import Link from 'next/link';
import { ArrowRight, Receipt } from 'lucide-react';

export default async function PortalBillingList() {
  const { customerId } = await requireCustomerSession();

  const invoices = await prisma.invoice.findMany({
    where: { customerId },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Billing & Invoices</h1>
        <p className="text-neutral-500 mt-1">Review your invoices and payment history.</p>
      </div>

      <div className="bg-white border border-neutral-200 shadow-sm rounded-xl overflow-hidden">
        <div className="divide-y divide-neutral-100">
          {invoices.length === 0 ? (
            <div className="p-8 text-center text-neutral-500">No invoices found.</div>
          ) : (
            invoices.map((inv) => (
              <div key={inv.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-neutral-50 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="mt-1">
                    <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-600">
                      <Receipt className="h-5 w-5" />
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-neutral-900">
                      Invoice {inv.invoiceNumber}
                    </h3>
                    <div className="text-sm text-neutral-500 mt-1 flex flex-col md:flex-row md:items-center gap-2">
                      <span className="font-medium text-neutral-900">${inv.total.toFixed(2)}</span>
                      <span className="hidden md:inline">•</span>
                      <span>Due: {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : 'Upon Receipt'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                    inv.status === 'PAID' ? 'bg-green-50 text-green-700 border-green-200' :
                    inv.status === 'OVERDUE' ? 'bg-red-50 text-red-700 border-red-200' :
                    ['SENT', 'PARTIALLY_PAID'].includes(inv.status) ? 'bg-amber-50 text-amber-700 border-amber-200' :
                    'bg-neutral-50 text-neutral-700 border-neutral-200'
                  }`}>
                    {inv.status.replace('_', ' ')}
                  </span>
                  {['SENT', 'PARTIALLY_PAID', 'OVERDUE'].includes(inv.status) && (
                    <Link href={`/pay/${inv.paymentToken}`} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition shadow-sm">
                      Pay Now
                    </Link>
                  )}
                  {inv.status === 'PAID' && (
                    <Link href={`/pay/${inv.paymentToken}`} className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1">
                      View Receipt <ArrowRight className="h-4 w-4" />
                    </Link>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
