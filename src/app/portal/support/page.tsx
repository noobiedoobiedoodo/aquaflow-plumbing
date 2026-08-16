import { requireCustomerSession } from '@/lib/auth/customer-session';
import { prisma } from '@/lib/db';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

export default async function CustomerSupportTicketsPage() {
  const { customerId } = await requireCustomerSession();

  // STRICT DB AUTHORIZATION
  const tickets = await prisma.supportTicket.findMany({
    where: { customerId },
    orderBy: { updatedAt: 'desc' }
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Support Tickets</h1>
          <p className="text-neutral-500 mt-1">Get help with your jobs or billing.</p>
        </div>
        <Link
          href="/portal/support/new"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm transition"
        >
          + New Ticket
        </Link>
      </div>

      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-sm text-left">
          <thead className="bg-neutral-50 text-neutral-500 border-b">
            <tr>
              <th className="px-6 py-3 font-medium">Ticket ID</th>
              <th className="px-6 py-3 font-medium">Subject</th>
              <th className="px-6 py-3 font-medium">Status</th>
              <th className="px-6 py-3 font-medium">Last Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {tickets.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-neutral-500">
                  You have no open support tickets.
                </td>
              </tr>
            ) : (
              tickets.map(ticket => (
                <tr key={ticket.id} className="hover:bg-neutral-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-neutral-900">
                    <Link href={`/portal/support/${ticket.id}`} className="hover:underline text-blue-600">
                      #{ticket.id.slice(-6)}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-neutral-800">{ticket.subject}</td>
                  <td className="px-6 py-4">
                    <Badge variant="outline">{ticket.status.replace('_', ' ')}</Badge>
                  </td>
                  <td className="px-6 py-4 text-neutral-500">{ticket.updatedAt.toLocaleDateString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
