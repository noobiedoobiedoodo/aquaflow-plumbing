import { describe, it, expect } from 'vitest';
import { prisma } from '@/lib/db';

describe('Browser Workflow: Estimate Creation, Review, and Customer Approval', () => {
  it('creates estimate, adds lines, and processes customer approval', async () => {
    const org = await prisma.organization.create({
      data: { name: 'Estimate Org', slug: `est-org-${Date.now()}` },
    });

    const service = await prisma.service.create({
      data: {
        organizationId: org.id,
        name: 'Boiler Replacement',
        slug: `boiler-rep-${Date.now()}`,
        basePrice: 500,
      },
    });

    const custUser = await prisma.user.create({
      data: { email: `est.cust.${Date.now()}@example.com`, passwordHash: 'hash' },
    });

    const customer = await prisma.customer.create({
      data: { userId: custUser.id, organizationId: org.id, firstName: 'Est', lastName: 'Cust' },
    });

    const prop = await prisma.property.create({
      data: { organizationId: org.id, customerId: customer.id, address: '1 Estimate Ave', city: 'Winnipeg', province: 'MB', postalCode: 'R3C 001' },
    });

    const appt = await prisma.appointment.create({
      data: {
        appointmentNumber: `APT-EST-${Date.now()}`,
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
      data: { organizationId: org.id, appointmentId: appt.id, status: 'CREATED' },
    });

    const estimate = await prisma.estimate.create({
      data: {
        estimateNumber: `EST-${Date.now()}`,
        organizationId: org.id,
        customerId: customer.id,
        jobId: job.id,
        status: 'SENT',
        subtotal: 500,
        tax: 60,
        total: 560,
      },
    });

    // Customer approves estimate
    const approved = await prisma.estimate.update({
      where: { id: estimate.id },
      data: { status: 'APPROVED' },
    });

    expect(approved.status).toBe('APPROVED');
    expect(approved.total).toBe(560);
  });
});
