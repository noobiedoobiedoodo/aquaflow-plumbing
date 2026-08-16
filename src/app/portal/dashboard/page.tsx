import { requireCustomerSession } from '@/lib/auth/customer-session';
import { prisma } from '@/lib/db';
import Link from 'next/link';
import { Calendar, FileText, ArrowRight } from 'lucide-react';

export default async function PortalDashboard() {
  const { customerId, customer } = await requireCustomerSession();

  // Fetch Upcoming Appointments (Strictly scoped to customerId)
  const upcomingAppointments = await prisma.appointment.findMany({
    where: { 
      customerId,
      date: { gte: new Date() },
      status: { notIn: ['CANCELLED', 'COMPLETED'] }
    },
    orderBy: { startTime: 'asc' },
    take: 3,
    include: {
      technician: { include: { user: true } },
      job: true
    }
  });

  // Fetch Pending Estimates
  const pendingEstimates = await prisma.estimate.findMany({
    where: {
      customerId,
      status: 'SENT'
    },
    orderBy: { createdAt: 'desc' }
  });

  // Fetch Unpaid Invoices
  const unpaidInvoices = await prisma.invoice.findMany({
    where: {
      customerId,
      status: { in: ['SENT', 'PARTIALLY_PAID', 'OVERDUE'] }
    },
    orderBy: { dueDate: 'asc' }
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Welcome back, {customer.firstName}!</h1>
        <p className="text-neutral-500 mt-1">Here is the latest overview of your service history.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Action Required Section */}
        {(pendingEstimates.length > 0 || unpaidInvoices.length > 0) && (
          <div className="col-span-1 md:col-span-2 space-y-4">
            <h2 className="text-lg font-semibold text-neutral-900">Action Required</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingEstimates.map(est => (
                <div key={est.id} className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-amber-900">Pending Estimate Approval</div>
                    <div className="text-sm text-amber-700 mt-1">{est.estimateNumber} • ${est.total.toFixed(2)}</div>
                  </div>
                  <Link href={`/portal/estimates/${est.id}`} className="px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition">
                    Review
                  </Link>
                </div>
              ))}
              {unpaidInvoices.map(inv => (
                <div key={inv.id} className="bg-red-50 border border-red-200 rounded-xl p-5 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-red-900">Outstanding Invoice</div>
                    <div className="text-sm text-red-700 mt-1">{inv.invoiceNumber} • ${(inv.total - inv.amountPaid).toFixed(2)} Due</div>
                  </div>
                  <Link href={`/portal/billing`} className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition">
                    Pay Now
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upcoming Appointments */}
        <div className="bg-white border border-neutral-200 shadow-sm rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-neutral-200 bg-neutral-50 flex items-center justify-between">
            <h2 className="font-semibold text-neutral-900 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-neutral-400" />
              Upcoming Appointments
            </h2>
          </div>
          <div className="divide-y divide-neutral-100">
            {upcomingAppointments.length === 0 ? (
              <div className="p-6 text-center text-neutral-500 text-sm">No upcoming appointments.</div>
            ) : (
              upcomingAppointments.map((appt) => {
                const start = new Date(appt.date);
                const [sh, sm] = appt.startTime.split(':');
                start.setHours(parseInt(sh, 10), parseInt(sm, 10), 0, 0);

                const end = new Date(appt.date);
                const [eh, em] = appt.endTime.split(':');
                end.setHours(parseInt(eh, 10), parseInt(em, 10), 0, 0);

                return (
                  <div key={appt.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="font-medium text-neutral-900">
                        {start.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                      </div>
                      <div className="text-sm text-neutral-500 mt-1">
                        {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                    {appt.technician && (
                      <div className="text-sm text-neutral-600 flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center font-medium text-neutral-500">
                          {appt.technician.user.firstName?.[0]}{appt.technician.user.lastName?.[0]}
                        </div>
                        {appt.technician.user.firstName}
                      </div>
                    )}
                    {appt.job && (
                      <Link href={`/portal/jobs/${appt.job.id}`} className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1">
                        View Job <ArrowRight className="h-4 w-4" />
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
    </div>
  );
}
