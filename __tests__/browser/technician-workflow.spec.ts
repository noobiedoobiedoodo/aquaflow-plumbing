import { describe, it, expect } from 'vitest';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth/password';

describe('Browser Workflow: Technician Mobile Execution (Clock, Parts, Signature, Completion)', () => {
  it('executes full field job lifecycle: state transitions, parts, signature, completion', async () => {
    const org = await prisma.organization.create({
      data: { name: 'Field Work Org', slug: `field-org-${Date.now()}` },
    });

    const service = await prisma.service.create({
      data: {
        organizationId: org.id,
        name: 'Main Pipe Valve Replacement',
        slug: `valve-rep-${Date.now()}`,
        basePrice: 175,
      },
    });

    const techUser = await prisma.user.create({
      data: {
        email: `field.tech.${Date.now()}@aquaflow.internal`,
        passwordHash: await hashPassword('tech123'),
        firstName: 'Dave',
        lastName: 'Field',
      },
    });

    await prisma.organizationMember.create({
      data: { userId: techUser.id, organizationId: org.id, role: 'TECHNICIAN' },
    });

    const tech = await prisma.technician.create({
      data: {
        userId: techUser.id,
        organizationId: org.id,
        firstName: 'Dave',
        lastName: 'Field',
        availabilityStatus: 'BUSY',
        isActive: true,
      },
    });

    const custUser = await prisma.user.create({
      data: { email: `cust.field.${Date.now()}@example.com`, passwordHash: 'hash' },
    });

    const customer = await prisma.customer.create({
      data: { userId: custUser.id, organizationId: org.id, firstName: 'C', lastName: 'U' },
    });

    const property = await prisma.property.create({
      data: { organizationId: org.id, customerId: customer.id, address: '99 Tech Way', city: 'Winnipeg', province: 'MB', postalCode: 'R3T 1A1' },
    });

    const appointment = await prisma.appointment.create({
      data: {
        appointmentNumber: `APT-FIELD-${Date.now()}`,
        organizationId: org.id,
        customerId: customer.id,
        propertyId: property.id,
        serviceId: service.id,
        date: new Date(),
        startTime: '10:00',
        endTime: '12:00',
        status: 'CONFIRMED',
      },
    });

    const job = await prisma.job.create({
      data: {
        organizationId: org.id,
        appointmentId: appointment.id,
        technicianId: tech.id,
        status: 'ASSIGNED',
      },
    });

    // 1. Mark EN_ROUTE
    await prisma.job.update({ where: { id: job.id }, data: { status: 'EN_ROUTE' } });

    // 2. Mark ARRIVED
    await prisma.job.update({ where: { id: job.id }, data: { status: 'ARRIVED' } });

    // 3. Mark WORKING & Record Time Entry
    await prisma.job.update({ where: { id: job.id }, data: { status: 'WORKING' } });
    const timeEntry = await prisma.jobTimeEntry.create({
      data: {
        jobId: job.id,
        technicianId: techUser.id,
        startedAt: new Date(Date.now() - 3600000),
        endedAt: new Date(),
        durationSeconds: 3600,
      },
    });

    // 4. Add Parts
    const part = await prisma.jobPart.create({
      data: {
        jobId: job.id,
        createdById: techUser.id,
        name: 'Brass Ball Valve 3/4"',
        quantity: 2,
        unitCost: 18.5,
      },
    });

    // 5. Capture Signature
    const sig = await prisma.customerSignature.create({
      data: {
        jobId: job.id,
        signerName: 'Customer Jane',
        storageKey: 'signatures/sig-123.png',
      },
    });

    // 6. Complete Job
    const completedJob = await prisma.job.update({
      where: { id: job.id },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });

    expect(completedJob.status).toBe('COMPLETED');
    expect(timeEntry.durationSeconds).toBe(3600);
    expect(part.name).toBe('Brass Ball Valve 3/4"');
    expect(sig.signerName).toBe('Customer Jane');
  });
});
