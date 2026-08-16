import { prisma } from '@/lib/db';
import { requireRoleInOrg } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/constants';
import Link from 'next/link';

export default async function InvoicesDashboardPage() {
  const { user, organizationId } = await requireRoleInOrg(ADMIN_ROLES as any);

  const invoices = await prisma.invoice.findMany({
    where: { organizationId },
    include: {
      customer: true,
      job: { include: { appointment: { include: { service: true } } } }
    },
    orderBy: { createdAt: 'desc' }
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 tracking-tight">Invoices</h1>
          <p className="text-sm text-neutral-500 mt-1">Manage billing and payments.</p>
        </div>
      </div>

      <div className="bg-white border border-neutral-200 shadow-sm rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th className="px-6 py-4 font-medium text-neutral-500">Invoice #</th>
                <th className="px-6 py-4 font-medium text-neutral-500">Customer</th>
                <th className="px-6 py-4 font-medium text-neutral-500">Service</th>
                <th className="px-6 py-4 font-medium text-neutral-500">Amount</th>
                <th className="px-6 py-4 font-medium text-neutral-500">Status</th>
                <th className="px-6 py-4 font-medium text-neutral-500 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-neutral-500">
                    No invoices generated yet.
                  </td>
                </tr>
              ) : (
                invoices.map((invoice) => {
                  const balanceDue = invoice.total - invoice.amountPaid;
                  return (
                    <tr key={invoice.id} className="hover:bg-neutral-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-neutral-900">
                        {invoice.invoiceNumber}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-neutral-900 font-medium">{invoice.customer?.firstName} {invoice.customer?.lastName}</div>
                      </td>
                      <td className="px-6 py-4 text-neutral-600">
                        {invoice.job?.appointment?.service?.name || 'Plumbing Service'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-neutral-900 font-medium">${invoice.total.toFixed(2)}</div>
                        {balanceDue > 0 && balanceDue < invoice.total && (
                          <div className="text-xs text-orange-600">Bal: ${balanceDue.toFixed(2)}</div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                          invoice.status === 'PAID' ? 'bg-green-50 text-green-700 border-green-200' :
                          invoice.status === 'PARTIALLY_PAID' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                          invoice.status === 'VOID' ? 'bg-neutral-100 text-neutral-600 border-neutral-200' :
                          'bg-blue-50 text-blue-700 border-blue-200'
                        }`}>
                          {invoice.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link 
                          href={`/pay/${invoice.paymentToken}`} 
                          target="_blank"
                          className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                        >
                          View Portal ↗
                        </Link>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
