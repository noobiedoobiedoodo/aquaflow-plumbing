import { prisma } from '@/lib/db';
import { requireRoleInOrg } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/constants';
import Link from 'next/link';
import { Users, Plus, Phone, Mail, MapPin, Calendar, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default async function CustomersPage() {
  const { organizationId } = await requireRoleInOrg(ADMIN_ROLES);

  const customers = await prisma.customer.findMany({
    where: { organizationId },
    include: {
      user: { select: { email: true } },
      properties: { take: 1, orderBy: { createdAt: 'desc' } },
      _count: {
        select: {
          appointments: true,
          invoices: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Users className="w-6 h-6 text-primary-blue" /> Customer Directory
          </h1>
          <p className="text-sm text-muted-text mt-1">
            Manage your organization's customer records, service locations, and lifetime history.
          </p>
        </div>
        <Button asChild className="bg-primary-blue hover:bg-blue-600 text-white font-semibold">
          <Link href="/dashboard/customers/new" className="flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Add Customer
          </Link>
        </Button>
      </div>

      <div className="glass rounded-2xl border border-border/50 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-secondary-bg/60 border-b border-border/50 text-xs uppercase tracking-wider text-muted-text font-semibold">
              <tr>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Contact</th>
                <th className="px-6 py-4">Primary Property</th>
                <th className="px-6 py-4 text-center">Jobs</th>
                <th className="px-6 py-4 text-center">Invoices</th>
                <th className="px-6 py-4">Added</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {customers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-muted-text">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-40 text-muted-text" />
                    No customers found in your organization. Click "Add Customer" or share your public booking link.
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr key={c.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-white">
                        {c.firstName} {c.lastName}
                      </div>
                      <div className="text-xs text-muted-text mt-0.5">ID: #{c.id.slice(-6)}</div>
                    </td>
                    <td className="px-6 py-4 text-xs space-y-1">
                      <div className="flex items-center gap-1.5 text-slate-300">
                        <Mail className="w-3.5 h-3.5 text-muted-text" /> {c.user.email}
                      </div>
                      {c.phone && (
                        <div className="flex items-center gap-1.5 text-muted-text">
                          <Phone className="w-3.5 h-3.5 text-muted-text" /> {c.phone}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-300">
                      {c.properties[0] ? (
                        <div className="flex items-start gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-muted-text mt-0.5 shrink-0" />
                          <span>
                            {c.properties[0].address}
                            {c.properties[0].unit ? ` (Unit ${c.properties[0].unit})` : ''}, {c.properties[0].city}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-text italic">No property recorded</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-primary-blue border border-primary-blue/20">
                        {c._count.appointments}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {c._count.invoices}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-muted-text">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/dashboard/customers/${c.id}`}
                        className="text-xs font-semibold text-primary-blue hover:text-cyan-400 inline-flex items-center gap-1 transition"
                      >
                        View <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
