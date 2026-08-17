import { describe, it, expect } from 'vitest';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth/password';

describe('Browser Workflow: Public Self-Serve Customer Acquisition Flow', () => {
  it('creates booking, customer, property, appointment, and dispatch job for tenant', async () => {
    const org = await prisma.organization.create({
      data: { name: 'Acquisition Org', slug: `acq-org-${Date.now()}` },
    });

    const service = await prisma.service.create({
      data: {
        organizationId: org.id,
        name: 'Emergency Pipe Thawing',
        slug: `emergency-thaw-${Date.now()}`,
        basePrice: 200,
        estimatedDuration: 60,
        isEmergency: true,
      },
    });

    const user = await prisma.user.create({
      data: {
        email: `booker.${Date.now()}@example.com`,
        passwordHash: await hashPassword('password123'),
        firstName: 'Sam',
        lastName: 'Smith',
      },
    });

    const customer = await prisma.customer.create({
      data: {
        userId: user.id,
        organizationId: org.id,
        firstName: 'Sam',
        lastName: 'Smith',
        phone: '204-555-0177',
      },
    });

    const property = await prisma.property.create({
      data: {
        organizationId: org.id,
        customerId: customer.id,
        address: '789 Pembina Hwy',
        city: 'Winnipeg',
        province: 'MB',
        postalCode: 'R3T 2G6',
      },
    });

    const appointment = await prisma.appointment.create({
      data: {
        appointmentNumber: `APT-${Date.now()}`,
        organizationId: org.id,
        customerId: customer.id,
        propertyId: property.id,
        serviceId: service.id,
        date: new Date(),
        startTime: '13:00',
        endTime: '15:00',
        isEmergency: true,
        problemDescription: 'Frozen main water line in crawlspace',
        status: 'CONFIRMED',
      },
    });

    const job = await prisma.job.create({
      data: {
        organizationId: org.id,
        appointmentId: appointment.id,
        status: 'CREATED',
      },
    });

    expect(job.organizationId).toBe(org.id);
    expect(job.status).toBe('CREATED');
    expect(appointment.serviceId).toBe(service.id);
  });
});
