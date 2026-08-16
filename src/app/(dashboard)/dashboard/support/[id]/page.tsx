import { requireRoleInOrg } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { revalidatePath } from 'next/cache';

export default async function DashboardSupportTicketDetail({ params }: { params: Promise<{ id: string }> }) {
  const { user, organizationId } = await requireRoleInOrg(['ADMIN', 'SUPER_ADMIN', 'DISPATCHER']);
  const { id } = await params;

  const ticket = await prisma.supportTicket.findFirst({
    where: { id, organizationId },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
      customer: true,
      job: true
    }
  });

  if (!ticket) notFound();

  async function postMessage(formData: FormData) {
    'use server';
    const body = formData.get('body') as string;
    const newStatus = formData.get('status') as string;

    if (!body || body.trim() === '') return;
    
    const { user: sender, organizationId: authOrgId } = await requireRoleInOrg(['ADMIN', 'SUPER_ADMIN', 'DISPATCHER']);
    
    await prisma.$transaction(async (tx) => {
      // Re-verify that the ticket belongs to this organization inside the transaction
      const existingTicket = await tx.supportTicket.findFirst({
        where: { id, organizationId: authOrgId },
      });

      if (!existingTicket) {
        throw new Error('Support ticket not found or access denied');
      }

      await tx.supportTicketMessage.create({
        data: {
          ticketId: id,
          senderType: 'DISPATCHER',
          senderId: sender.id,
          body,
        },
      });

      const updatedStatus = newStatus && newStatus !== existingTicket.status ? newStatus : 'WAITING_CUSTOMER';
      await tx.supportTicket.update({
        where: { id },
        data: { status: updatedStatus },
      });
    });

    revalidatePath(`/dashboard/support/${id}`);
  }


  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">{ticket.subject}</h1>
          <p className="text-neutral-500 mt-1">Customer: {ticket.customer.firstName} {ticket.customer.lastName} • Ticket #{ticket.id.slice(-6)}</p>
        </div>
        <Badge variant="outline">{ticket.status.replace('_', ' ')}</Badge>
      </div>

      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-sm flex flex-col h-[600px]">
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-neutral-50/50">
          {ticket.messages.length === 0 ? (
            <p className="text-neutral-500 text-center py-8">No messages yet.</p>
          ) : (
            ticket.messages.map(msg => {
              const isDispatcher = msg.senderType === 'DISPATCHER' || msg.senderType === 'SYSTEM';
              return (
                <div key={msg.id} className={`flex flex-col ${isDispatcher ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${isDispatcher ? 'bg-neutral-800 text-white rounded-br-none' : 'bg-white border border-neutral-200 text-neutral-900 rounded-bl-none'}`}>
                    <p className="whitespace-pre-wrap text-sm">{msg.body}</p>
                  </div>
                  <span className="text-[10px] text-neutral-400 mt-1 mx-1">
                    {msg.senderType === 'SYSTEM' ? 'Automated Message' : isDispatcher ? 'You/Staff' : 'Customer'} • {msg.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              );
            })
          )}
        </div>
        
        <div className="p-4 bg-white border-t border-neutral-200">
          <form action={postMessage} className="flex flex-col gap-3">
            <textarea
              name="body"
              required
              rows={3}
              placeholder="Type your reply to the customer..."
              className="w-full rounded-lg border border-neutral-300 px-4 py-3 focus:ring-2 focus:ring-neutral-900 focus:outline-none resize-none"
            />
            <div className="flex items-center justify-between">
              <select name="status" defaultValue="WAITING_CUSTOMER" className="border border-neutral-300 rounded-md px-3 py-1.5 text-sm">
                <option value="OPEN">Keep Open</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="WAITING_CUSTOMER">Waiting on Customer</option>
                <option value="RESOLVED">Resolved</option>
                <option value="CLOSED">Closed</option>
              </select>
              <button type="submit" className="bg-neutral-900 text-white px-6 py-2 rounded-lg font-medium hover:bg-neutral-800 transition-colors">
                Send Reply
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
