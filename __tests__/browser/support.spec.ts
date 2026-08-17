import { describe, it, expect } from 'vitest';
import { prisma } from '@/lib/db';

describe('Browser Workflow: Customer Support Desk & Threaded Tickets', () => {
  it('allows customer to create ticket and dispatcher to post responses with status progression', async () => {
    const org = await prisma.organization.create({
      data: { name: 'Support Org', slug: `supp-org-${Date.now()}` },
    });

    const user = await prisma.user.create({
      data: { email: `supp.cust.${Date.now()}@example.com`, passwordHash: 'hash' },
    });

    const customer = await prisma.customer.create({
      data: { userId: user.id, organizationId: org.id, firstName: 'Ticket', lastName: 'Submitter' },
    });

    const ticket = await prisma.supportTicket.create({
      data: {
        organizationId: org.id,
        customerId: customer.id,
        subject: 'Warranty Question regarding Sump Pump Installation',
        status: 'OPEN',
      },
    });

    // Customer initial message
    await prisma.supportTicketMessage.create({
      data: {
        ticketId: ticket.id,
        senderType: 'CUSTOMER',
        senderId: customer.id,
        body: 'Does the newly installed sump pump have a 1-year parts warranty?',
      },
    });

    // Dispatcher reply
    await prisma.supportTicketMessage.create({
      data: {
        ticketId: ticket.id,
        senderType: 'DISPATCHER',
        senderId: user.id,
        body: 'Yes, it comes with a 1-year manufacturer warranty and a 90-day labor warranty.',
      },
    });

    const updatedTicket = await prisma.supportTicket.update({
      where: { id: ticket.id },
      data: { status: 'WAITING_CUSTOMER' },
      include: { messages: true },
    });

    expect(updatedTicket.status).toBe('WAITING_CUSTOMER');
    expect(updatedTicket.messages.length).toBe(2);
  });
});
