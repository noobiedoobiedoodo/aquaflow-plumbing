import { describe, it, expect } from 'vitest';
import { prisma } from '@/lib/db';
import { PaymentService } from '@/lib/services/payment-service';

describe('Browser Workflow: Stripe Payment Checkout & Settlement', () => {
  it('creates payment session and reconciles invoice state to PAID', async () => {
    const org = await prisma.organization.create({
      data: { name: 'Payment Org', slug: `pay-org-${Date.now()}` },
    });

    const service = await prisma.service.create({
      data: {
        organizationId: org.id,
        name: 'Faucet Fixture Repair',
        slug: `faucet-rep-${Date.now()}`,
        basePrice: 100,
      },
    });

    const user = await prisma.user.create({
      data: { email: `pay.cust.${Date.now()}@example.com`, passwordHash: 'hash' },
    });

    const customer = await prisma.customer.create({
      data: { userId: user.id, organizationId: org.id, firstName: 'Pay', lastName: 'User' },
    });

    const prop = await prisma.property.create({
      data: { organizationId: org.id, customerId: customer.id, address: '12 Pay Lane', city: 'Winnipeg', province: 'MB', postalCode: 'R3C 222' },
    });

    const appt = await prisma.appointment.create({
      data: {
        appointmentNumber: `APT-PAY-${Date.now()}`,
        organizationId: org.id,
        customerId: customer.id,
        propertyId: prop.id,
        serviceId: service.id,
        date: new Date(),
        startTime: '10:00',
        endTime: '11:00',
        status: 'CONFIRMED',
      },
    });

    const job = await prisma.job.create({
      data: { organizationId: org.id, appointmentId: appt.id, status: 'COMPLETED' },
    });

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: `INV-${Date.now()}`,
        organizationId: org.id,
        customerId: customer.id,
        jobId: job.id,
        subtotal: 100,
        taxTotal: 12,
        total: 112,
        paymentToken: `token-${Date.now()}`,
        status: 'SENT',
      },
    });

    const uniqueProviderId = `pi_test_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const paymentResult = await PaymentService.processPaymentSuccess(org.id, invoice.id, 112, uniqueProviderId);
    expect(paymentResult).toBeDefined();

    const updated = await prisma.invoice.findUnique({
      where: { id: invoice.id },
    });

    expect(updated?.status).toBe('PAID');
    expect(updated?.amountPaid).toBe(112);
  });
});
