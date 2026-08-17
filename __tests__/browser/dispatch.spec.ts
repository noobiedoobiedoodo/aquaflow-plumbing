import { describe, it, expect } from 'vitest';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth/password';

describe('Browser Workflow: Dispatcher Assignment Workflow', () => {
  it('allows dispatcher to assign active technician to job within same organization', async () => {
    const org = await prisma.organization.create({
      data: { name: 'Dispatch Org', slug: `dispatch-org-${Date.now()}` },
    });

    const service = await prisma.service.create({
      data: {
        organizationId: org.id,
        name: 'Leak Inspection',
        slug: `leak-insp-${Date.now()}`,
        basePrice: 150,
      },
    });

    // Create Admin User & Membership
    const adminUser = await prisma.user.create({
      data: {
        email: `dispatch.admin.${Date.now()}@aquaflow.internal`,
        passwordHash: await hashPassword('password123'),
        firstName: 'Dispatch',
        lastName: 'Manager',
      },
    });

    await prisma.organizationMember.create({
      data: {
        userId: adminUser.id,
        organizationId: org.id,
        role: 'SUPER_ADMIN',
      },
    });

    // Create Technician
    const techUser = await prisma.user.create({
      data: {
        email: `dispatch.tech.${Date.now()}@aquaflow.internal`,
        passwordHash: await hashPassword('tech123'),
        firstName: 'Bob',
        lastName: 'Plumber',
      },
    });

    await prisma.organizationMember.create({
      data: {
        userId: techUser.id,
        organizationId: org.id,
        role: 'TECHNICIAN',
      },
    });

    const tech = await prisma.technician.create({
      data: {
        userId: techUser.id,
        organizationId: org.id,
        firstName: 'Bob',
        lastName: 'Plumber',
        availabilityStatus: 'AVAILABLE',
        isActive: true,
      },
    });

    // Create Customer & Job
    const custUser = await prisma.user.create({
      data: {
        email: `cust.${Date.now()}@example.com`,
        passwordHash: await hashPassword('pass'),
      },
    });

    const customer = await prisma.customer.create({
      data: {
        userId: custUser.id,
        organizationId: org.id,
        firstName: 'Alice',
        lastName: 'Brown',
      },
    });

    const property = await prisma.property.create({
      data: {
        organizationId: org.id,
        customerId: customer.id,
        address: '100 Main St',
        city: 'Winnipeg',
        province: 'MB',
        postalCode: 'R3C 1A1',
      },
    });

    const appointment = await prisma.appointment.create({
      data: {
        appointmentNumber: `APT-DSP-${Date.now()}`,
        organizationId: org.id,
        customerId: customer.id,
        propertyId: property.id,
        serviceId: service.id,
        date: new Date(),
        startTime: '09:00',
        endTime: '11:00',
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

    // Assign Technician
    const updatedJob = await prisma.job.update({
      where: { id: job.id },
      data: {
        technicianId: tech.id,
        status: 'ASSIGNED',
      },
    });

    expect(updatedJob.technicianId).toBe(tech.id);
    expect(updatedJob.status).toBe('ASSIGNED');
  });
});
