import { requireCustomerSession } from '@/lib/auth/customer-session';
import { prisma } from '@/lib/db';
import Link from 'next/link';
import { Receipt, FileCheck, ArrowRight, Download } from 'lucide-react';

export default async function PortalBillingList() {
  const { customerId } = await requireCustomerSession();

  // Tenant-scoped through customer association
  const invoices = await prisma.invoice.findMany({
    where: { customerId },
    include: {
      versions: {
        orderBy: { versionNumber: 'desc' },
        take: 1,
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Billing & Invoices</h1>
        <p className="text-neutral-500 mt-1">
          Review, sign, download, and pay your invoices electronically.
        </p>
      </div>

      <div className="bg-white border border-neutral-200 shadow-sm rounded-xl overflow-hidden">
        <div className="divide-y divide-neutral-100">
          {invoices.length === 0 ? (
            <div className="p-8 text-center text-neutral-500">No invoices found.</div>
          ) : (
            invoices.map((inv) => {
              const balanceDue = inv.total - inv.amountPaid;
              const isPaid = inv.status === 'PAID' || balanceDue <= 0;
              const isSigned = inv.status === 'SIGNED' || inv.isImmutable;

              return (
                <div
                  key={inv.id}
                  className="p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-neutral-50/50 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div className="mt-1">
                      <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100">
                        <Receipt className="h-5 w-5" />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-neutral-900">
                          Invoice #{inv.invoiceNumber}
                        </h3>
                        <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-neutral-100 text-neutral-600">
                          v{inv.currentVersion}
                        </span>
                      </div>
                      <div className="text-sm text-neutral-500 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="font-medium text-neutral-900">${inv.total.toFixed(2)} CAD</span>
                        <span>•</span>
                        <span>Due: {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : 'Upon Receipt'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    {/* Signed / Unsigned Badge */}
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${
                        isSigned
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                    >
                      <FileCheck className="w-3.5 h-3.5" />
                      {isSigned ? 'Signed' : 'Needs Signature'}
                    </span>

                    {/* Paid / Unpaid Badge */}
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                        isPaid
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : inv.status === 'OVERDUE'
                          ? 'bg-red-50 text-red-700 border-red-200'
                          : 'bg-neutral-100 text-neutral-700 border-neutral-200'
                      }`}
                    >
                      {isPaid ? 'Paid' : 'Unpaid'}
                    </span>

                    {/* View Details Action */}
                    <Link
                      href={`/portal/billing/${inv.id}`}
                      className="px-3.5 py-1.5 bg-neutral-900 text-white text-xs font-semibold rounded-lg hover:bg-neutral-800 transition"
                    >
                      {isSigned ? 'View Invoice' : 'Review & Sign'}
                    </Link>

                    {/* Download PDF if signed */}
                    {isSigned && (
                      <a
                        href={`/api/invoices/${inv.id}/pdf`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 text-neutral-600 hover:text-neutral-900 border border-neutral-200 rounded-lg hover:bg-neutral-100 transition"
                        title="Download PDF"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    )}

                    {/* Pay button if unpaid */}
                    {!isPaid && (
                      <Link
                        href={`/pay/${inv.paymentToken}`}
                        className="px-3.5 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition"
                      >
                        Pay Now
                      </Link>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
