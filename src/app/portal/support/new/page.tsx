import { requireCustomerSession } from '@/lib/auth/customer-session';
import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, MessageSquare, HelpCircle } from 'lucide-react';

export default async function NewSupportTicketPage() {
  const session = await requireCustomerSession();
  const customerId = session.customerId;
  const organizationId = session.customer.organizationId;

  // Fetch recent customer jobs to link to ticket if needed
  const jobs = await prisma.job.findMany({
    where: { appointment: { customerId } },
    include: { appointment: { include: { service: true } } },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  async function createTicketAction(formData: FormData) {
    'use server';
    const s = await requireCustomerSession();
    const currentCustId = s.customerId;
    const currentOrgId = s.customer.organizationId;

    const subject = (formData.get('subject') as string)?.trim();
    const description = (formData.get('description') as string)?.trim();
    const jobId = (formData.get('jobId') as string)?.trim() || null;

    if (!subject || subject.length < 3) {
      throw new Error('Please provide a subject for your ticket.');
    }
    if (!description || description.length < 5) {
      throw new Error('Please provide details about your question or request.');
    }

    // STRICT IDOR VALIDATION: Verify job belongs to authenticated customer
    let validatedJobId: string | null = null;
    if (jobId && jobId !== 'none') {
      const verifiedJob = await prisma.job.findFirst({
        where: {
          id: jobId,
          appointment: {
            customerId: currentCustId,
            organizationId: currentOrgId,
          },
        },
        select: { id: true },
      });

      if (!verifiedJob) {
        throw new Error('Unauthorized: The referenced job does not exist or does not belong to your account.');
      }
      validatedJobId = verifiedJob.id;
    }

    const ticket = await prisma.$transaction(async (tx) => {
      const createdTicket = await tx.supportTicket.create({
        data: {
          organizationId: currentOrgId,
          customerId: currentCustId,
          relatedJobId: validatedJobId,
          subject,
          status: 'OPEN',
        },
      });

      await tx.supportTicketMessage.create({
        data: {
          ticketId: createdTicket.id,
          senderType: 'CUSTOMER',
          senderId: currentCustId,
          body: description,
        },
      });

      return createdTicket;
    });

    revalidatePath('/portal/support');
    redirect(`/portal/support/${ticket.id}`);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Link
          href="/portal/support"
          className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900 transition mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Tickets
        </Link>
        <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Create Support Ticket</h1>
        <p className="text-neutral-500 text-sm mt-1">
          Have a question about an estimate, invoice, or past service? We're here to help.
        </p>
      </div>

      <div className="bg-white border border-neutral-200 rounded-2xl p-6 sm:p-8 shadow-sm">
        <form action={createTicketAction} className="space-y-5">
          <div>
            <label htmlFor="subject" className="block text-sm font-semibold text-neutral-900 mb-1.5">Subject</label>
            <input
              id="subject"
              type="text"
              name="subject"
              required
              placeholder="e.g. Question regarding recent invoice or warranty inquiry"
              className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
            />
          </div>

          {jobs.length > 0 && (
            <div>
              <label htmlFor="jobId" className="block text-sm font-semibold text-neutral-900 mb-1.5">Related Job (Optional)</label>
              <select
                id="jobId"
                name="jobId"
                className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
              >
                <option value="none">Not related to a specific job</option>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    Job #{j.id.slice(-6)} • {j.appointment?.service?.name || 'Plumbing Service'} ({new Date(j.createdAt).toLocaleDateString()})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label htmlFor="description" className="block text-sm font-semibold text-neutral-900 mb-1.5">Message / Details</label>
            <textarea
              id="description"
              name="description"
              rows={5}
              required
              placeholder="Please provide any details, questions, or clarification needed..."
              className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
            ></textarea>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm shadow-md transition flex items-center justify-center gap-2"
            >
              <MessageSquare className="w-4 h-4" /> Submit Ticket
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
