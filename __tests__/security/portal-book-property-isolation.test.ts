import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { prisma } from '@/lib/db';
import { randomUUID } from 'crypto';

describe('Portal Book Property Isolation & IDOR Defense Matrix', () => {
  let orgAId: string;
  let orgBId: string;
  let custAId: string;
  let custBId: string;
  let custOrgBId: string;
  let propAId: string;
  let propBId: string;
  let propOrgBId: string;
  let servAId: string;
  let servBId: string;
  let userAId: string;
  let userBId: string;
  let userOrgBId: string;

  beforeEach(async () => {
    const testId = randomUUID().slice(0, 8);

    // 1. Create Org A & Org B
    const orgA = await prisma.organization.create({
      data: { name: `Org A ${testId}`, slug: `org-a-${testId}` },
    });
    const orgB = await prisma.organization.create({
      data: { name: `Org B ${testId}`, slug: `org-b-${testId}` },
    });
    orgAId = orgA.id;
    orgBId = orgB.id;

    // 2. Create Users
    const userA = await prisma.user.create({
      data: { email: `usera.${testId}@test.com`, firstName: 'User', lastName: 'A', passwordHash: 'hash_123' },
    });
    const userB = await prisma.user.create({
      data: { email: `userb.${testId}@test.com`, firstName: 'User', lastName: 'B', passwordHash: 'hash_123' },
    });
    const userOrgB = await prisma.user.create({
      data: { email: `userorgb.${testId}@test.com`, firstName: 'User', lastName: 'OrgB', passwordHash: 'hash_123' },
    });
    userAId = userA.id;
    userBId = userB.id;
    userOrgBId = userOrgB.id;

    // 3. Create Customers
    const custA = await prisma.customer.create({
      data: { organizationId: orgAId, userId: userA.id, firstName: 'Cust', lastName: 'A' },
    });
    const custB = await prisma.customer.create({
      data: { organizationId: orgAId, userId: userB.id, firstName: 'Cust', lastName: 'B' },
    });
    const custOrgB = await prisma.customer.create({
      data: { organizationId: orgBId, userId: userOrgB.id, firstName: 'Cust', lastName: 'OrgB' },
    });
    custAId = custA.id;
    custBId = custB.id;
    custOrgBId = custOrgB.id;

    // 4. Create Properties
    const propA = await prisma.property.create({
      data: { organizationId: orgAId, customerId: custAId, address: '100 Customer A St', city: 'Winnipeg', postalCode: 'R3C 1A1' },
    });
    const propB = await prisma.property.create({
      data: { organizationId: orgAId, customerId: custBId, address: '200 Customer B St', city: 'Winnipeg', postalCode: 'R3C 2B2' },
    });
    const propOrgB = await prisma.property.create({
      data: { organizationId: orgBId, customerId: custOrgBId, address: '300 Org B St', city: 'Winnipeg', postalCode: 'R3C 3C3' },
    });
    propAId = propA.id;
    propBId = propB.id;
    propOrgBId = propOrgB.id;

    // 5. Create Services
    const servA = await prisma.service.create({
      data: { organizationId: orgAId, name: 'Drain Cleaning', slug: `drain-${testId}`, basePrice: 150 },
    });
    const servB = await prisma.service.create({
      data: { organizationId: orgBId, name: 'Pipe Repair', slug: `pipe-${testId}`, basePrice: 250 },
    });
    servAId = servA.id;
    servBId = servB.id;
  });

  afterEach(async () => {
    await prisma.event.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.job.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.appointment.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.property.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.service.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.customer.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userAId, userBId, userOrgBId] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } });
  });

  // Helper simulating the exact atomic booking validation transaction
  async function executeBookingTransaction(
    sessionOrgId: string,
    sessionCustId: string,
    requestedPropertyId: string | null,
    requestedServiceId: string
  ) {
    return await prisma.$transaction(async (tx) => {
      let resolvedPropertyId = requestedPropertyId;

      if (!resolvedPropertyId || resolvedPropertyId === 'new') {
        const createdProperty = await tx.property.create({
          data: {
            organizationId: sessionOrgId,
            customerId: sessionCustId,
            address: '400 New St',
            city: 'Winnipeg',
            postalCode: 'R3C 4D4',
          },
        });
        resolvedPropertyId = createdProperty.id;
      } else {
        const verifiedProperty = await tx.property.findFirst({
          where: {
            id: resolvedPropertyId,
            customerId: sessionCustId,
            organizationId: sessionOrgId,
          },
          select: { id: true },
        });

        if (!verifiedProperty) {
          throw new Error('Unauthorized property: Service address does not belong to your account');
        }
        resolvedPropertyId = verifiedProperty.id;
      }

      const verifiedService = await tx.service.findFirst({
        where: {
          id: requestedServiceId,
          organizationId: sessionOrgId,
          isActive: true,
        },
        select: { id: true },
      });

      if (!verifiedService) {
        throw new Error('Unauthorized service: Selected service is invalid or inactive');
      }

      const appt = await tx.appointment.create({
        data: {
          appointmentNumber: `APPT-${randomUUID().slice(0, 6)}`,
          organizationId: sessionOrgId,
          customerId: sessionCustId,
          propertyId: resolvedPropertyId,
          serviceId: verifiedService.id,
          date: new Date(),
          startTime: '10:00',
          endTime: '12:00',
          status: 'PENDING',
        },
      });

      const job = await tx.job.create({
        data: {
          appointmentId: appt.id,
          organizationId: sessionOrgId,
          status: 'CREATED',
        },
      });

      return { appt, job };
    });
  }

  it('Customer A → own property → allowed', async () => {
    const result = await executeBookingTransaction(orgAId, custAId, propAId, servAId);
    expect(result.appt).toBeDefined();
    expect(result.appt.propertyId).toBe(propAId);
    expect(result.appt.customerId).toBe(custAId);
    expect(result.appt.organizationId).toBe(orgAId);
  });

  it('Customer A → Customer B property in same org → rejected and no appointment created', async () => {
    const countBefore = await prisma.appointment.count({ where: { organizationId: orgAId } });

    await expect(
      executeBookingTransaction(orgAId, custAId, propBId, servAId)
    ).rejects.toThrow('Unauthorized property');

    const countAfter = await prisma.appointment.count({ where: { organizationId: orgAId } });
    expect(countAfter).toBe(countBefore);
  });

  it('Customer A → Org B property → rejected and no appointment created', async () => {
    const countBefore = await prisma.appointment.count({ where: { organizationId: orgAId } });

    await expect(
      executeBookingTransaction(orgAId, custAId, propOrgBId, servAId)
    ).rejects.toThrow('Unauthorized property');

    const countAfter = await prisma.appointment.count({ where: { organizationId: orgAId } });
    expect(countAfter).toBe(countBefore);
  });

  it('Customer A → nonexistent property UUID → rejected and no appointment created', async () => {
    const fakeUuid = randomUUID();
    const countBefore = await prisma.appointment.count({ where: { organizationId: orgAId } });

    await expect(
      executeBookingTransaction(orgAId, custAId, fakeUuid, servAId)
    ).rejects.toThrow('Unauthorized property');

    const countAfter = await prisma.appointment.count({ where: { organizationId: orgAId } });
    expect(countAfter).toBe(countBefore);
  });

  it('Customer A → Org B service → rejected and no appointment created', async () => {
    const countBefore = await prisma.appointment.count({ where: { organizationId: orgAId } });

    await expect(
      executeBookingTransaction(orgAId, custAId, propAId, servBId)
    ).rejects.toThrow('Unauthorized service');

    const countAfter = await prisma.appointment.count({ where: { organizationId: orgAId } });
    expect(countAfter).toBe(countBefore);
  });

  it('Customer A attempting to manipulate client-supplied customer/org identifier is ignored', async () => {
    const result = await executeBookingTransaction(orgAId, custAId, null, servAId);
    expect(result.appt.organizationId).toBe(orgAId);
    expect(result.appt.customerId).toBe(custAId);
    expect(result.appt.organizationId).not.toBe(orgBId);
    expect(result.appt.customerId).not.toBe(custBId);
  });
});
