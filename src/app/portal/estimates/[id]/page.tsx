import { requireCustomerSession } from '@/lib/auth/customer-session';
import { prisma } from '@/lib/db';
import { notFound, redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

export default async function PortalEstimateDetail({ params }: { params: { id: string } }) {
  const { customerId } = await requireCustomerSession();
  const { id } = await params;

  const estimate = await prisma.estimate.findFirst({
    where: { id, customerId },
    include: {
      lines: true,
      job: { include: { appointment: { include: { service: true } } } }
    }
  });

  if (!estimate) notFound();

  // Handle Server Action for Approval
  async function approveEstimate() {
    'use server';
    const session = await requireCustomerSession();
    if (session.customerId !== estimate?.customerId) throw new Error("Unauthorized");
    if (estimate?.status === 'APPROVED') throw new Error("Already approved");

    const headerPayload = await headers();
    const ipAddress = headerPayload.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = headerPayload.get('user-agent') || 'Unknown';

    await prisma.$transaction(async (tx) => {
      // 1. Lock state
      await tx.estimate.update({
        where: { id: estimate.id },
        data: { status: 'APPROVED' }
      });

      // 2. Audit Trial
      await tx.estimateApproval.create({
        data: {
          estimateId: estimate.id,
          customerId: session.customerId,
          ipAddress,
          userAgent
        }
      });

      // 3. Activity Audit
      await tx.customerActivity.create({
        data: {
          customerId: session.customerId,
          action: 'ESTIMATE_APPROVED',
          metadata: JSON.stringify({ estimateId: estimate.id })
        }
      });

      // 4. Outbox Event
      await tx.event.create({
        data: {
          organizationId: estimate.organizationId,
          type: 'estimate.approved',
          entityType: 'Estimate',
          entityId: estimate.id,
          data: JSON.stringify({ customerId: session.customerId, total: estimate.total })
        }
      });
    });

    revalidatePath(`/portal/estimates/${estimate.id}`);
    redirect(`/portal/estimates/${estimate.id}`);
  }

  // Handle Server Action for Rejection
  async function rejectEstimate() {
    'use server';
    const session = await requireCustomerSession();
    if (session.customerId !== estimate?.customerId) throw new Error("Unauthorized");
    if (estimate?.status === 'REJECTED') throw new Error("Already rejected");

    await prisma.$transaction(async (tx) => {
      await tx.estimate.update({
        where: { id: estimate.id },
        data: { status: 'REJECTED' }
      });

      await tx.customerActivity.create({
        data: {
          customerId: session.customerId,
          action: 'ESTIMATE_REJECTED',
          metadata: JSON.stringify({ estimateId: estimate.id })
        }
      });
      
      await tx.event.create({
        data: {
          organizationId: estimate.organizationId,
          type: 'estimate.rejected',
          entityType: 'Estimate',
          entityId: estimate.id,
          data: JSON.stringify({ customerId: session.customerId, total: estimate.total })
        }
      });
    });

    revalidatePath(`/portal/estimates/${estimate.id}`);
    redirect(`/portal/estimates/${estimate.id}`);
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Estimate {estimate.estimateNumber}</h1>
          <p className="text-neutral-500 mt-1">For {estimate.job.appointment.service?.name || 'General Service'}</p>
        </div>
        <span className={`inline-flex self-start items-center px-3 py-1 rounded-full text-sm font-medium border ${
          estimate.status === 'APPROVED' ? 'bg-green-50 text-green-700 border-green-200' :
          estimate.status === 'REJECTED' ? 'bg-red-50 text-red-700 border-red-200' :
          estimate.status === 'SENT' ? 'bg-amber-50 text-amber-700 border-amber-200' :
          'bg-neutral-50 text-neutral-700 border-neutral-200'
        }`}>
          {estimate.status}
        </span>
      </div>

      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-sm">
        <div className="p-6 border-b border-neutral-200 bg-neutral-50/50">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-sm font-medium text-neutral-500">Issued On</div>
              <div className="text-neutral-900">{new Date(estimate.createdAt).toLocaleDateString()}</div>
            </div>
            {estimate.expiresAt && (
              <div className="text-right">
                <div className="text-sm font-medium text-neutral-500">Valid Until</div>
                <div className="text-neutral-900">{new Date(estimate.expiresAt).toLocaleDateString()}</div>
              </div>
            )}
          </div>
        </div>
        
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-500">
            <tr>
              <th className="px-6 py-3 font-medium">Description</th>
              <th className="px-6 py-3 font-medium text-right">Qty</th>
              <th className="px-6 py-3 font-medium text-right">Unit Price</th>
              <th className="px-6 py-3 font-medium text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {estimate.lines.map((line) => (
              <tr key={line.id}>
                <td className="px-6 py-4 text-neutral-900">{line.description}</td>
                <td className="px-6 py-4 text-right text-neutral-600">{line.quantity}</td>
                <td className="px-6 py-4 text-right text-neutral-600">${line.unitCost.toFixed(2)}</td>
                <td className="px-6 py-4 text-right text-neutral-900 font-medium">${(line.quantity * line.unitCost).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        
        <div className="p-6 bg-neutral-50 border-t border-neutral-200 flex flex-col items-end gap-2 text-sm">
          <div className="flex justify-between w-48 text-neutral-500">
            <span>Subtotal</span>
            <span>${estimate.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between w-48 text-neutral-500">
            <span>Tax</span>
            <span>${estimate.tax.toFixed(2)}</span>
          </div>
          <div className="flex justify-between w-48 text-lg font-bold text-neutral-900 mt-2 pt-2 border-t border-neutral-200">
            <span>Total</span>
            <span>${estimate.total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {estimate.status === 'SENT' && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-blue-900">Approve this estimate?</h3>
            <p className="text-blue-700 text-sm mt-1">Once approved, our dispatcher will contact you to confirm scheduling.</p>
          </div>
          <div className="flex gap-3">
            <form action={rejectEstimate}>
              <button type="submit" className="px-4 py-2 bg-white text-neutral-700 border border-neutral-300 font-medium rounded-lg hover:bg-neutral-50 transition">
                Reject
              </button>
            </form>
            <form action={approveEstimate}>
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition">
                Approve — ${(estimate.total).toFixed(2)}
              </button>
            </form>
          </div>
        </div>
      )}

      {estimate.status === 'APPROVED' && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
          <h3 className="font-semibold text-green-900">Estimate Approved</h3>
          <p className="text-green-700 text-sm mt-1">Thank you! This estimate is locked and confirmed.</p>
        </div>
      )}
    </div>
  );
}
