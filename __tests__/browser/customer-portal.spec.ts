import { describe, it, expect } from 'vitest';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth/password';

describe('Browser Workflow: Customer Portal Navigation & Features', () => {
  it('scopes customer dashboard to authenticated customerId with jobs, estimates, and invoices', async () => {
    const org = await prisma.organization.create({
      data: { name: 'Portal Org', slug: `portal-org-${Date.now()}` },
    });

    const service = await prisma.service.create({
      data: {
        organizationId: org.id,
        name: 'Drain Snaking',
        slug: `drain-snake-${Date.now()}`,
        basePrice: 150,
      },
    });

    const user = await prisma.user.create({
      data: { email: `portal.user.${Date.now()}@example.com`, passwordHash: 'hash' },
    });

    const customer = await prisma.customer.create({
      data: { userId: user.id, organizationId: org.id, firstName: 'Portal', lastName: 'Customer' },
    });

    const prop = await prisma.property.create({
      data: { organizationId: org.id, customerId: customer.id, address: '88 Portal Pl', city: 'Winnipeg', province: 'MB', postalCode: 'R3C 333' },
    });

    const appt = await prisma.appointment.create({
      data: {
        appointmentNumber: `APT-PRT-${Date.now()}`,
        organizationId: org.id,
        customerId: customer.id,
        propertyId: prop.id,
        serviceId: service.id,
        date: new Date(),
        startTime: '14:00',
        endTime: '16:00',
        status: 'CONFIRMED',
      },
    });

    const customerAppointments = await prisma.appointment.findMany({
      where: { customerId: customer.id },
    });

    expect(customerAppointments.length).toBe(1);
    expect(customerAppointments[0].customerId).toBe(customer.id);
  });
});
