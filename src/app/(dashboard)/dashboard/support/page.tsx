import { requireRoleInOrg } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

export default async function DashboardSupportPage() {
  const { user, organizationId } = await requireRoleInOrg(['ADMIN', 'SUPER_ADMIN', 'DISPATCHER']);

  const tickets = await prisma.supportTicket.findMany({
    where: { organizationId },
    include: { customer: true, job: true },
    orderBy: { updatedAt: 'desc' }
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Support Tickets</h1>
      </div>

      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-sm text-left">
          <thead className="bg-neutral-50 text-neutral-500 border-b">
            <tr>
              <th className="px-6 py-3 font-medium">Ticket ID</th>
              <th className="px-6 py-3 font-medium">Customer</th>
              <th className="px-6 py-3 font-medium">Subject</th>
              <th className="px-6 py-3 font-medium">Status</th>
              <th className="px-6 py-3 font-medium">Last Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {tickets.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-neutral-500">
                  No support tickets found.
                </td>
              </tr>
            ) : (
              tickets.map(ticket => (
                <tr key={ticket.id} className="hover:bg-neutral-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-neutral-900">
                    <Link href={`/dashboard/support/${ticket.id}`} className="hover:underline text-blue-600">
                      #{ticket.id.slice(-6)}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-neutral-800">{ticket.customer.firstName} {ticket.customer.lastName}</td>
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
