import { expect, test, describe, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../src/lib/db';
import { randomUUID } from 'crypto';
import { ScheduleOptimizer } from '../../src/lib/intelligence/schedule-optimizer';
import { storage } from '../../src/lib/storage';

describe('Phase 13: Runtime Crash & Model Conformance Verification Suite', () => {
  const testId = randomUUID().slice(0, 8);

  let orgId: string;
  let adminUserId: string;
  let techUser1Id: string;
  let techUser2Id: string;
  let tech1Id: string;
  let tech2Id: string;
  let serviceId: string;
  let propertyId: string;
  let customerId: string;
  let appointmentId: string;
  let jobId: string;
  let proposalId: string;

  beforeAll(async () => {
    // 1. Organization
    const org = await prisma.organization.create({
      data: { name: `Runtime Org ${testId}`, slug: `runtime-org-${testId}` },
    });
    orgId = org.id;

    // 2. Admin & Techs
    const admin = await prisma.user.create({
      data: { email: `admin-${testId}@test.com`, firstName: 'Admin', lastName: 'User', passwordHash: 'none', memberships: { create: { organizationId: orgId, role: 'ADMIN' } } },
    });
    adminUserId = admin.id;

    const techUser1 = await prisma.user.create({
      data: { email: `tech1-${testId}@test.com`, firstName: 'Tyler', lastName: 'Tech1', passwordHash: 'none', memberships: { create: { organizationId: orgId, role: 'TECHNICIAN' } } },
    });
    techUser1Id = techUser1.id;
    const tech1 = await prisma.technician.create({
      data: { organizationId: orgId, userId: techUser1.id, firstName: 'Tyler', lastName: 'Tech1', availabilityStatus: 'AVAILABLE', skills: JSON.stringify([`sewer-${testId}`]) },
    });
    tech1Id = tech1.id;

    const techUser2 = await prisma.user.create({
      data: { email: `tech2-${testId}@test.com`, firstName: 'Trevor', lastName: 'Tech2', passwordHash: 'none', memberships: { create: { organizationId: orgId, role: 'TECHNICIAN' } } },
    });
    techUser2Id = techUser2.id;
    const tech2 = await prisma.technician.create({
      data: { organizationId: orgId, userId: techUser2.id, firstName: 'Trevor', lastName: 'Tech2', availabilityStatus: 'AVAILABLE', skills: JSON.stringify([`sewer-${testId}`]) },
    });
    tech2Id = tech2.id;

    // 3. Service, Customer, Property
    const service = await prisma.service.create({
      data: { organizationId: orgId, name: 'Sewer Jetting', slug: `sewer-${testId}` },
    });
    serviceId = service.id;

    const user = await prisma.user.create({ data: { email: `cust-${testId}@test.com`, firstName: 'Cust', lastName: 'Omer', passwordHash: 'none' } });
    const customer = await prisma.customer.create({ data: { organizationId: orgId, userId: user.id, firstName: 'Cust', lastName: 'Omer' } });
    customerId = customer.id;

    const property = await prisma.property.create({ data: { organizationId: orgId, customerId: customer.id, address: '123 Test St', city: 'Winnipeg', postalCode: 'R3C1A1' } });
    propertyId = property.id;

    // 4. Appointment & Job
    const appointment = await prisma.appointment.create({
      data: {
        appointmentNumber: `APPT-RT-${testId}`,
        organizationId: orgId,
        customerId: customer.id,
        propertyId: property.id,
        serviceId: service.id,
        date: new Date(),
        startTime: '10:00',
        endTime: '12:00',
        technicianId: tech1.id,
      },
    });
    appointmentId = appointment.id;

    const job = await prisma.job.create({
      data: {
        organizationId: orgId,
        appointmentId: appointment.id,
        technicianId: tech1.id,
        status: 'ASSIGNED',
      },
    });
    jobId = job.id;

    // 5. Optimization Proposal
    const proposal = await prisma.optimizationProposal.create({
      data: {
        organizationId: orgId,
        jobId: job.id,
        originalTechnicianId: tech1.id,
        proposedTechnicianId: tech2.id,
        reason: 'Avoid cascade delay',
        predictedDelayBefore: 30,
        predictedDelayAfter: 0,
        status: 'PENDING',
      },
    });
    proposalId = proposal.id;
  });

  afterAll(async () => {
    await prisma.jobActivity.deleteMany({ where: { jobId } });
    await prisma.optimizationProposal.deleteMany({ where: { organizationId: orgId } });
    await prisma.job.deleteMany({ where: { id: jobId } });
    await prisma.appointment.deleteMany({ where: { id: appointmentId } });
    await prisma.property.deleteMany({ where: { id: propertyId } });
    await prisma.customer.deleteMany({ where: { id: customerId } });
    await prisma.service.deleteMany({ where: { id: serviceId } });
    await prisma.technician.deleteMany({ where: { organizationId: orgId } });
    await prisma.organizationMember.deleteMany({ where: { organizationId: orgId } });
    await prisma.user.deleteMany({ where: { email: { in: [`admin-${testId}@test.com`, `tech1-${testId}@test.com`, `tech2-${testId}@test.com`, `cust-${testId}@test.com`] } } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
  });

  test('Runtime Safety: Safe fallback for service name on Job Appointment', async () => {
    const jobWithService = await prisma.job.findUnique({
      where: { id: jobId },
      include: { appointment: { include: { service: true } } },
    });

    const title1 = jobWithService?.appointment?.service?.name ?? 'Service Call';
    expect(title1).toBe('Sewer Jetting');

    // Simulate missing service relation
    const jobWithoutService = {
      appointment: {
        service: null,
      },
    };
    const title2 = jobWithoutService?.appointment?.service?.name ?? 'Service Call';
    expect(title2).toBe('Service Call');
  });

  test('Model Conformance: ScheduleOptimizer.acceptProposal executes successfully without runtime errors', async () => {
    const updatedJob = await ScheduleOptimizer.acceptProposal(proposalId, orgId);

    expect(updatedJob).not.toBeNull();
    expect(updatedJob.technicianId).toBe(tech2Id);

    // Verify proposal is ACCEPTED
    const resolvedProposal = await prisma.optimizationProposal.findUnique({ where: { id: proposalId } });
    expect(resolvedProposal?.status).toBe('ACCEPTED');

    // Verify JobActivity was created with valid schema fields
    const activities = await prisma.jobActivity.findMany({ where: { jobId } });
    expect(activities.length).toBeGreaterThan(0);
    const reassignedActivity = activities.find((a) => a.action === 'REASSIGNED');
    expect(reassignedActivity).toBeDefined();
    expect(reassignedActivity?.userId).toBeNull();
  });
});
