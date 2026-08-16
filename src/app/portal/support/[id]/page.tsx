import { requireCustomerSession } from '@/lib/auth/customer-session';
import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { revalidatePath } from 'next/cache';

export default async function CustomerSupportTicketDetail({ params }: { params: { id: string } }) {
  const { customerId } = await requireCustomerSession();
  const { id } = await params;

  // STRICT DB AUTHORIZATION
  const ticket = await prisma.supportTicket.findFirst({
    where: { id, customerId },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
      job: true
    }
  });

  if (!ticket) notFound();

  async function postMessage(formData: FormData) {
    'use server';
    const body = formData.get('body') as string;
    if (!body || body.trim() === '') return;
    
    // Strict scoping validation in Server Action
    const { customerId: currentCustId } = await requireCustomerSession();
    const currentTicket = await prisma.supportTicket.findFirst({ where: { id, customerId: currentCustId } });
    if (!currentTicket) throw new Error("Unauthorized");

    await prisma.supportTicketMessage.create({
      data: {
        ticketId: id,
        senderType: 'CUSTOMER',
        senderId: currentCustId,
        body
      }
    });

    // Optionally update ticket status to OPEN if it was WAITING_CUSTOMER
    if (currentTicket.status === 'WAITING_CUSTOMER') {
      await prisma.supportTicket.update({ where: { id }, data: { status: 'OPEN' } });
    }

    revalidatePath(`/portal/support/${id}`);
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">{ticket.subject}</h1>
          <p className="text-neutral-500 mt-1">Ticket #{ticket.id.slice(-6)} {ticket.job && `• Related to Job #${ticket.job.id.slice(-6)}`}</p>
        </div>
        <Badge variant="outline">{ticket.status.replace('_', ' ')}</Badge>
      </div>

      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-sm flex flex-col h-[600px]">
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {ticket.messages.length === 0 ? (
            <p className="text-neutral-500 text-center py-8">No messages yet.</p>
          ) : (
            ticket.messages.map(msg => {
              const isCustomer = msg.senderType === 'CUSTOMER';
              return (
                <div key={msg.id} className={`flex flex-col ${isCustomer ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${isCustomer ? 'bg-blue-600 text-white rounded-br-none' : 'bg-neutral-100 text-neutral-900 rounded-bl-none'}`}>
                    <p className="whitespace-pre-wrap text-sm">{msg.body}</p>
                  </div>
                  <span className="text-[10px] text-neutral-400 mt-1 mx-1">
                    {msg.senderType === 'SYSTEM' ? 'Automated Message' : isCustomer ? 'You' : 'Support'} • {msg.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              );
            })
          )}
        </div>
        
        {ticket.status !== 'CLOSED' && ticket.status !== 'RESOLVED' && (
          <div className="p-4 bg-neutral-50 border-t border-neutral-200">
            <form action={postMessage} className="flex gap-2">
              <input
                type="text"
                name="body"
                required
                placeholder="Type your message..."
                className="flex-1 rounded-lg border border-neutral-300 px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors">
                Send
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
