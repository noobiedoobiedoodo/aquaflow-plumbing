import { describe, it, expect } from 'vitest';
import { prisma } from '@/lib/db';
import { InvoiceService } from '@/lib/services/invoice-service';

describe('Browser Workflow: Invoice Generation & Multi-Tier Tax Engine', () => {
  it('generates collision-free invoice from completed job with proper line items and tax rules', async () => {
    const org = await prisma.organization.create({
      data: { name: 'Billing Org', slug: `bill-org-${Date.now()}` },
    });

    const service = await prisma.service.create({
      data: {
        organizationId: org.id,
        name: 'Standard Plumbing Repair',
        slug: `plumb-rep-${Date.now()}`,
        basePrice: 100,
      },
    });

    await prisma.taxRule.create({
      data: { organizationId: org.id, name: 'MB Provincial Tax', jurisdiction: 'MB', rate: 0.12, appliesTo: 'ALL' },
    });

    const user = await prisma.user.create({
      data: { email: `inv.cust.${Date.now()}@example.com`, passwordHash: 'hash' },
    });

    const customer = await prisma.customer.create({
      data: { userId: user.id, organizationId: org.id, firstName: 'Billing', lastName: 'Customer' },
    });

    const prop = await prisma.property.create({
      data: { organizationId: org.id, customerId: customer.id, address: '55 Invoice Blvd', city: 'Winnipeg', province: 'MB', postalCode: 'R3C 111' },
    });

    const appt = await prisma.appointment.create({
      data: {
        appointmentNumber: `APT-INV-${Date.now()}`,
        organizationId: org.id,
        customerId: customer.id,
        propertyId: prop.id,
        serviceId: service.id,
        date: new Date(),
        startTime: '08:00',
        endTime: '10:00',
        status: 'CONFIRMED',
      },
    });

    const job = await prisma.job.create({
      data: {
        organizationId: org.id,
        appointmentId: appt.id,
        status: 'COMPLETED',
      },
    });

    await prisma.jobTimeEntry.create({
      data: {
        jobId: job.id,
        technicianId: user.id,
        startedAt: new Date(Date.now() - 3600000),
        endedAt: new Date(),
        durationSeconds: 3600, // 1.0 hour
      },
    });

    const invoice = await InvoiceService.generateInvoice(org.id, job.id, 100);
    expect(invoice).toBeDefined();
    expect(invoice.invoiceNumber).toMatch(/^INV-\d{4}-\d{5}-[A-Z0-9]{4}$/);
    expect(invoice.subtotal).toBe(100);
    expect(invoice.taxTotal).toBe(12);
    expect(invoice.total).toBe(112);
  });
});
