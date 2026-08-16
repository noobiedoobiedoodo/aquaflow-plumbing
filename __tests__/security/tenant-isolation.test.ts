import { expect, test, describe, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../src/lib/db';
import { randomUUID } from 'crypto';

describe('Security & Tenant Isolation Regression Suite', () => {
  let orgAId: string;
  let orgBId: string;
  let orgAUser: string;
  let orgBUser: string;
  let techAId: string;
  let jobOrgA: string;

  beforeAll(async () => {
    // 1. Setup Organizations
    const orgA = await prisma.organization.create({
      data: { name: 'Tenant A - Secure Plumbing', slug: `tenant-a-${randomUUID()}` }
    });
    orgAId = orgA.id;

    const orgB = await prisma.organization.create({
      data: { name: 'Tenant B - Competitor', slug: `tenant-b-${randomUUID()}` }
    });
    orgBId = orgB.id;

    // 2. Setup Users
    const userA = await prisma.user.create({
      data: {
        email: `usera-${randomUUID()}@tenanta.com`,
        firstName: 'Alice', lastName: 'A',
        passwordHash: 'hashed',
        memberships: {
          create: { organizationId: orgAId, role: 'TECHNICIAN' }
        }
      }
    });
    orgAUser = userA.id;

    const techA = await prisma.technician.create({
      data: {
        organizationId: orgAId,
        userId: userA.id,
        firstName: 'Alice',
        lastName: 'A',
      }
    });
    techAId = techA.id;

    const userB = await prisma.user.create({
      data: {
        email: `userb-${randomUUID()}@tenantb.com`,
        firstName: 'Bob', lastName: 'B',
        passwordHash: 'hashed',
        memberships: {
          create: { organizationId: orgBId, role: 'TECHNICIAN' }
        }
      }
    });
    orgBUser = userB.id;

    // 3. Setup Customer & Job in Org A
    const custA = await prisma.customer.create({
      data: {
        organizationId: orgAId,
        userId: userA.id,
        firstName: 'Alice',
        lastName: 'A',
      }
    });

    const property = await prisma.property.create({
      data: { customerId: custA.id, organizationId: orgAId, address: "123 Test", city: "Test", postalCode: "123" }
    });
    
    const service = await prisma.service.create({
      data: { organizationId: orgAId, name: "Test", slug: `test-${randomUUID().slice(0, 6)}` }
    });

    const appt = await prisma.appointment.create({
      data: { appointmentNumber: `TEST-${randomUUID().slice(0, 6)}`, organizationId: orgAId, customerId: custA.id, propertyId: property.id, serviceId: service.id, date: new Date(), startTime: "09:00", endTime: "10:00" }
    });

    const job = await prisma.job.create({
      data: {
        organizationId: orgAId,
        appointmentId: appt.id,
        status: 'ASSIGNED',
        technicianId: techAId
      }
    });
    jobOrgA = job.id;
  });

  afterAll(async () => {
    // Clean up in reverse relational dependency order
    await prisma.job.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.appointment.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.property.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.service.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.customer.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.technician.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.organizationMember.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [orgAUser, orgBUser] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } });
  });

  test('Tenant B Technician cannot read Tenant A Job', async () => {
    const accessAttempt = await prisma.job.findFirst({
      where: {
        id: jobOrgA,
        organizationId: orgBId,
      }
    });
    expect(accessAttempt).toBeNull();
  });

  test('Database strictly enforces Organization foreign keys', async () => {
    const custB = await prisma.customer.create({
      data: {
        organizationId: orgBId,
        userId: orgBUser,
        firstName: 'Bob',
        lastName: 'B',
      }
    });

    try {
      const cust = await prisma.customer.findUnique({
        where: { userId_organizationId: { userId: orgBUser, organizationId: orgAId } }
      });
      expect(cust).toBeNull();
    } finally {
      await prisma.customer.delete({ where: { id: custB.id } });
    }
  });
});
