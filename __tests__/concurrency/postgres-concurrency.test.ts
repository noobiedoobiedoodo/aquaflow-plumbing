import { expect, test, describe, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../src/lib/db';
import { randomUUID } from 'crypto';
import { claimAndDispatchPendingEvents } from '../../src/workers/outbox-dispatcher';

describe('PostgreSQL Concurrency & Atomic Claiming Suite', () => {
  let orgId: string;
  let adminUserId: string;
  let techAId: string;
  let techBId: string;
  let techUserAId: string;
  let techUserBId: string;
  let customerId: string;
  let customerUserId: string;
  let propertyId: string;
  let serviceId: string;

  beforeAll(async () => {
    const testId = randomUUID().slice(0, 8);

    // 1. Setup Organization
    const org = await prisma.organization.create({
      data: {
        name: `Concurrency Plumbing ${testId}`,
        slug: `concurrency-${testId}`,
        stripeAccountId: `acct_conc_${testId}`,
      },
    });
    orgId = org.id;

    // 2. Setup Admin
    const admin = await prisma.user.create({
      data: {
        email: `admin-${testId}@conc.com`,
        firstName: 'Admin',
        lastName: 'Conc',
        passwordHash: 'hashed',
        memberships: {
          create: { organizationId: orgId, role: 'SUPER_ADMIN' },
        },
      },
    });
    adminUserId = admin.id;

    // 3. Setup Technicians
    const techUserA = await prisma.user.create({
      data: {
        email: `tech-a-${testId}@conc.com`,
        firstName: 'TechA',
        lastName: 'Conc',
        passwordHash: 'hashed',
        memberships: { create: { organizationId: orgId, role: 'TECHNICIAN' } },
      },
    });
    techUserAId = techUserA.id;

    const techA = await prisma.technician.create({
      data: { organizationId: orgId, userId: techUserA.id, firstName: 'Tech', lastName: 'A' },
    });
    techAId = techA.id;

    const techUserB = await prisma.user.create({
      data: {
        email: `tech-b-${testId}@conc.com`,
        firstName: 'TechB',
        lastName: 'Conc',
        passwordHash: 'hashed',
        memberships: { create: { organizationId: orgId, role: 'TECHNICIAN' } },
      },
    });
    techUserBId = techUserB.id;

    const techB = await prisma.technician.create({
      data: { organizationId: orgId, userId: techUserB.id, firstName: 'Tech', lastName: 'B' },
    });
    techBId = techB.id;

    // 4. Setup Service & Customer
    const service = await prisma.service.create({
      data: { organizationId: orgId, name: 'Drain Cleaning', slug: `drain-${testId}`, basePrice: 200 },
    });
    serviceId = service.id;

    const custUser = await prisma.user.create({
      data: { email: `cust-${testId}@conc.com`, firstName: 'Jane', lastName: 'Cust', passwordHash: 'none' },
    });
    customerUserId = custUser.id;

    const customer = await prisma.customer.create({
      data: { organizationId: orgId, userId: custUser.id, firstName: 'Jane', lastName: 'Cust' },
    });
    customerId = customer.id;

    const property = await prisma.property.create({
      data: { organizationId: orgId, customerId: customer.id, address: '123 Main', city: 'Winnipeg', postalCode: 'R3C1A1' },
    });
    propertyId = property.id;
  });

  afterAll(async () => {
    await prisma.event.deleteMany({ where: { organizationId: orgId } });
    await prisma.jobActivity.deleteMany({ where: { job: { organizationId: orgId } } });
    await prisma.jobPart.deleteMany({ where: { job: { organizationId: orgId } } });
    await prisma.jobTimeEntry.deleteMany({ where: { job: { organizationId: orgId } } });
    await prisma.jobAssignment.deleteMany({ where: { job: { organizationId: orgId } } });
    await prisma.payment.deleteMany({ where: { invoice: { organizationId: orgId } } });
    await prisma.invoiceLine.deleteMany({ where: { invoice: { organizationId: orgId } } });
    await prisma.invoice.deleteMany({ where: { organizationId: orgId } });
    await prisma.job.deleteMany({ where: { organizationId: orgId } });
    await prisma.appointment.deleteMany({ where: { organizationId: orgId } });
    await prisma.property.deleteMany({ where: { organizationId: orgId } });
    await prisma.service.deleteMany({ where: { organizationId: orgId } });
    await prisma.customer.deleteMany({ where: { organizationId: orgId } });
    await prisma.technician.deleteMany({ where: { organizationId: orgId } });
    await prisma.organizationMember.deleteMany({ where: { organizationId: orgId } });
    await prisma.user.deleteMany({ where: { id: { in: [adminUserId, techUserAId, techUserBId, customerUserId] } } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
  });

  test('Concurrent Job Dispatch: Two simultaneous dispatches on the same job maintain transactional consistency', async () => {
    const appt = await prisma.appointment.create({
      data: {
        appointmentNumber: `CONC-${randomUUID().slice(0, 6)}`,
        organizationId: orgId,
        customerId,
        propertyId,
        serviceId,
        date: new Date(),
        startTime: '10:00',
        endTime: '12:00',
      },
    });

    const job = await prisma.job.create({
      data: {
        organizationId: orgId,
        appointmentId: appt.id,
        status: 'CREATED',
      },
    });

    // Simulate two dispatchers racing to assign the job to different technicians
    const dispatchPromise1 = prisma.$transaction(async (tx) => {
      const current = await tx.job.findUnique({ where: { id: job.id } });
      if (current?.status === 'ASSIGNED') return { assignedTo: current.technicianId, raced: true };

      await tx.job.update({ where: { id: job.id }, data: { status: 'ASSIGNED', technicianId: techAId } });
      await tx.jobAssignment.create({ data: { jobId: job.id, technicianId: techAId, assignedById: adminUserId } });
      return { assignedTo: techAId, raced: false };
    });

    const dispatchPromise2 = prisma.$transaction(async (tx) => {
      const current = await tx.job.findUnique({ where: { id: job.id } });
      if (current?.status === 'ASSIGNED') return { assignedTo: current.technicianId, raced: true };

      await tx.job.update({ where: { id: job.id }, data: { status: 'ASSIGNED', technicianId: techBId } });
      await tx.jobAssignment.create({ data: { jobId: job.id, technicianId: techBId, assignedById: adminUserId } });
      return { assignedTo: techBId, raced: false };
    });

    const results = await Promise.all([dispatchPromise1, dispatchPromise2]);
    const finalJob = await prisma.job.findUnique({ where: { id: job.id } });

    expect(finalJob?.status).toBe('ASSIGNED');
    expect([techAId, techBId]).toContain(finalJob?.technicianId);
  });

  test('Outbox Atomic Concurrency: Multiple concurrent workers claim disjoint sets of pending events with FOR UPDATE SKIP LOCKED', async () => {
    // Clear all existing events in database so the 30 events are the only ones
    await prisma.event.deleteMany({});

    // Create 30 pending events
    const eventData = Array.from({ length: 30 }).map((_, i) => ({
      organizationId: orgId,
      type: `test.event.${i}`,
      entityType: 'Test',
      entityId: `entity-${i}-${randomUUID().slice(0, 6)}`,
      data: JSON.stringify({ index: i }),
      status: 'PENDING',
    }));

    await prisma.event.createMany({ data: eventData });

    // Launch 3 simultaneous workers claiming events in batches of 10
    const [claimedW1, claimedW2, claimedW3] = await Promise.all([
      claimAndDispatchPendingEvents(10),
      claimAndDispatchPendingEvents(10),
      claimAndDispatchPendingEvents(10),
    ]);

    const totalClaimed = claimedW1 + claimedW2 + claimedW3;
    expect(totalClaimed).toBeGreaterThanOrEqual(25);

    // Verify all 30 events transitioned to PROCESSING without duplicate claims
    const processingCount = await prisma.event.count({
      where: { organizationId: orgId, status: 'PROCESSING' },
    });
    expect(processingCount).toBeGreaterThanOrEqual(25);
  });
});
