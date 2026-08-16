import { prisma } from '@/lib/db';
import { requireRoleInOrg } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/constants';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, User, Phone, Mail, MapPin, Calendar, Receipt, Wrench, Shield } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CustomerDetailPage({ params }: Props) {
  const { organizationId } = await requireRoleInOrg(ADMIN_ROLES);
  const { id } = await params;

  const customer = await prisma.customer.findFirst({
    where: { id, organizationId },
    include: {
      user: { select: { email: true, createdAt: true } },
      properties: { orderBy: { createdAt: 'desc' } },
      appointments: {
        include: {
          service: true,
          technician: true,
          job: true,
        },
        orderBy: { date: 'desc' },
      },
      invoices: {
        include: { payments: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!customer) {
    notFound();
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <Link
          href="/dashboard/customers"
          className="inline-flex items-center gap-1.5 text-xs text-muted-text hover:text-white transition mb-4 font-medium"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Customers
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-blue/20 text-primary-blue flex items-center justify-center font-bold text-lg">
                {customer.firstName.slice(0, 1)}
                {customer.lastName.slice(0, 1)}
              </div>
              {customer.firstName} {customer.lastName}
            </h1>
            <p className="text-sm text-muted-text mt-1">Customer Record ID: #{customer.id.slice(-6)}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Contact & Properties */}
        <div className="space-y-6">
          {/* Contact Details Card */}
          <div className="glass rounded-2xl border border-border/50 p-6 shadow-xl space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-primary-blue">Contact Information</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2.5 text-slate-300">
                <Mail className="w-4 h-4 text-muted-text" />
                <span>{customer.user.email}</span>
              </div>
              <div className="flex items-center gap-2.5 text-slate-300">
                <Phone className="w-4 h-4 text-muted-text" />
                <span>{customer.phone || 'No phone recorded'}</span>
              </div>
              <div className="flex items-center gap-2.5 text-muted-text text-xs pt-2 border-t border-border/30">
                <Calendar className="w-4 h-4 text-muted-text" />
                <span>Client since {new Date(customer.createdAt).toLocaleDateString()}</span>
              </div>
            </div>

            {customer.notes && (
              <div className="pt-3 border-t border-border/30">
                <span className="text-xs font-semibold text-muted-text block mb-1">Dispatcher Notes</span>
                <p className="text-xs text-slate-300 bg-secondary-bg/60 p-3 rounded-lg border border-border/30">
                  {customer.notes}
                </p>
              </div>
            )}
          </div>

          {/* Properties Card */}
          <div className="glass rounded-2xl border border-border/50 p-6 shadow-xl space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-primary-blue">Service Locations ({customer.properties.length})</h3>
            <div className="space-y-3">
              {customer.properties.map((p) => (
                <div key={p.id} className="p-3 bg-secondary-bg/60 rounded-xl border border-border/30 text-xs text-slate-300">
                  <div className="font-semibold text-white">
                    {p.address} {p.unit ? `(Unit ${p.unit})` : ''}
                  </div>
                  <div className="text-muted-text mt-0.5">
                    {p.city}, {p.province} {p.postalCode}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Service & Financial History */}
        <div className="lg:col-span-2 space-y-6">
          {/* Service History Table */}
          <div className="glass rounded-2xl border border-border/50 overflow-hidden shadow-xl">
            <div className="p-5 border-b border-border/50 bg-secondary-bg/60 flex items-center justify-between">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Wrench className="w-4 h-4 text-primary-blue" /> Service & Appointment History ({customer.appointments.length})
              </h3>
            </div>

            <div className="divide-y divide-border/30">
              {customer.appointments.length === 0 ? (
                <div className="p-8 text-center text-muted-text text-sm">No service appointments recorded.</div>
              ) : (
                customer.appointments.map((appt) => (
                  <div key={appt.id} className="p-4 hover:bg-white/[0.02] transition-colors flex items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white text-sm">
                          {appt.service?.name || 'General Plumbing Service'}
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          {appt.status}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-text mt-1 flex flex-wrap items-center gap-3">
                        <span>Appt #{appt.appointmentNumber}</span>
                        <span>•</span>
                        <span>{new Date(appt.date).toLocaleDateString()} at {appt.startTime}</span>
                        {appt.technician && (
                          <>
                            <span>•</span>
                            <span className="text-slate-300">Tech: {appt.technician.firstName} {appt.technician.lastName}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {appt.job && (
                      <Link
                        href={`/dashboard/jobs/${appt.job.id}`}
                        className="text-xs font-semibold text-primary-blue hover:text-cyan-400 shrink-0"
                      >
                        View Job →
                      </Link>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Invoices History Table */}
          <div className="glass rounded-2xl border border-border/50 overflow-hidden shadow-xl">
            <div className="p-5 border-b border-border/50 bg-secondary-bg/60 flex items-center justify-between">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-400" /> Invoices & Billing ({customer.invoices.length})
              </h3>
            </div>

            <div className="divide-y divide-border/30">
              {customer.invoices.length === 0 ? (
                <div className="p-8 text-center text-muted-text text-sm">No invoices generated.</div>
              ) : (
                customer.invoices.map((inv) => (
                  <div key={inv.id} className="p-4 hover:bg-white/[0.02] transition-colors flex items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white text-sm">Invoice #{inv.invoiceNumber}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          inv.status === 'PAID' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                          'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}>
                          {inv.status}
                        </span>
                      </div>
                      <div className="text-xs text-muted-text mt-1">
                        Issued: {new Date(inv.createdAt).toLocaleDateString()}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-bold text-white text-sm">${inv.total.toFixed(2)}</div>
                      <span className="text-[11px] text-muted-text">
                        {inv.status === 'PAID' ? 'Paid in full' : `$${(inv.total - inv.amountPaid).toFixed(2)} Due`}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
