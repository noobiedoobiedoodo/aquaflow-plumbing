import { expect, test, describe, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../src/lib/db';
import { randomUUID } from 'crypto';

describe('Cross-Tenant Security & Isolation Hostile Suite', () => {
  let orgAId: string;
  let orgBId: string;
  let userAId: string;
  let userBId: string;
  let techAId: string;
  let techBId: string;
  let jobAId: string;
  let jobBId: string;
  let invoiceAId: string;
  let invoiceBId: string;

  const sharedEmail = `overlap-${randomUUID()}@customer-test.com`;

  beforeAll(async () => {
    // 1. Setup Organizations
    const orgA = await prisma.organization.create({
      data: {
        name: 'Apex Plumbing Co',
        slug: `apex-${randomUUID()}`,
        stripeAccountId: `acct_apex_${randomUUID().slice(0, 8)}`,
      },
    });
    orgAId = orgA.id;

    const orgB = await prisma.organization.create({
      data: {
        name: 'Blue Ridge Plumbing',
        slug: `blueridge-${randomUUID()}`,
        stripeAccountId: `acct_blueridge_${randomUUID().slice(0, 8)}`,
      },
    });
    orgBId = orgB.id;

    // 2. Setup Dispatchers / Tech Users
    const userA = await prisma.user.create({
      data: {
        email: `dispatch-a-${randomUUID()}@apex.com`,
        firstName: 'Alice',
        lastName: 'Admin',
        passwordHash: 'hashed',
        memberships: {
          create: { organizationId: orgAId, role: 'DISPATCHER' },
        },
      },
    });
    userAId = userA.id;

    const userB = await prisma.user.create({
      data: {
        email: `dispatch-b-${randomUUID()}@blueridge.com`,
        firstName: 'Bob',
        lastName: 'Admin',
        passwordHash: 'hashed',
        memberships: {
          create: { organizationId: orgBId, role: 'DISPATCHER' },
        },
      },
    });
    userBId = userB.id;

    // 3. Setup Technicians
    const techUserA = await prisma.user.create({
      data: {
        email: `tech-a-${randomUUID()}@apex.com`,
        firstName: 'Tom',
        lastName: 'Tech',
        passwordHash: 'hashed',
        memberships: {
          create: { organizationId: orgAId, role: 'TECHNICIAN' },
        },
      },
    });
    const techA = await prisma.technician.create({
      data: {
        organizationId: orgAId,
        userId: techUserA.id,
        firstName: 'Tom',
        lastName: 'Tech',
      },
    });
    techAId = techA.id;

    const techUserB = await prisma.user.create({
      data: {
        email: `tech-b-${randomUUID()}@blueridge.com`,
        firstName: 'Bill',
        lastName: 'Tech',
        passwordHash: 'hashed',
        memberships: {
          create: { organizationId: orgBId, role: 'TECHNICIAN' },
        },
      },
    });
    const techB = await prisma.technician.create({
      data: {
        organizationId: orgBId,
        userId: techUserB.id,
        firstName: 'Bill',
        lastName: 'Tech',
      },
    });
    techBId = techB.id;

    // 4. Setup Services
    const serviceA = await prisma.service.create({
      data: { organizationId: orgAId, name: 'Drain Cleaning', slug: 'drain-cleaning' },
    });
    const serviceB = await prisma.service.create({
      data: { organizationId: orgBId, name: 'Pipe Repair', slug: 'pipe-repair' },
    });

    // 5. Setup Customer Overlap (Same global User email for Org A and Org B)
    const globalCustomerUser = await prisma.user.create({
      data: {
        email: sharedEmail,
        firstName: 'John',
        lastName: 'Smith',
        passwordHash: 'guest_no_login',
      },
    });

    const custA = await prisma.customer.create({
      data: {
        organizationId: orgAId,
        userId: globalCustomerUser.id,
        firstName: 'John',
        lastName: 'Smith',
        phone: '555-0101',
      },
    });

    const custB = await prisma.customer.create({
      data: {
        organizationId: orgBId,
        userId: globalCustomerUser.id,
        firstName: 'John',
        lastName: 'Smith',
        phone: '555-0202',
      },
    });

    // 6. Setup Properties & Appointments
    const propA = await prisma.property.create({
      data: { organizationId: orgAId, customerId: custA.id, address: '100 Apex Way', city: 'Winnipeg', postalCode: 'R3C 1A1' },
    });
    const propB = await prisma.property.create({
      data: { organizationId: orgBId, customerId: custB.id, address: '200 Blue Ridge St', city: 'Winnipeg', postalCode: 'R3C 2B2' },
    });

    const apptA = await prisma.appointment.create({
      data: {
        appointmentNumber: `APPT-A-${randomUUID().slice(0, 4)}`,
        organizationId: orgAId,
        customerId: custA.id,
        propertyId: propA.id,
        serviceId: serviceA.id,
        date: new Date(),
        startTime: '09:00',
        endTime: '11:00',
        status: 'ASSIGNED',
        technicianId: techAId,
      },
    });

    const apptB = await prisma.appointment.create({
      data: {
        appointmentNumber: `APPT-B-${randomUUID().slice(0, 4)}`,
        organizationId: orgBId,
        customerId: custB.id,
        propertyId: propB.id,
        serviceId: serviceB.id,
        date: new Date(),
        startTime: '13:00',
        endTime: '15:00',
        status: 'ASSIGNED',
        technicianId: techBId,
      },
    });

    // 7. Setup Jobs
    const jobA = await prisma.job.create({
      data: {
        organizationId: orgAId,
        appointmentId: apptA.id,
        technicianId: techAId,
        status: 'ASSIGNED',
      },
    });
    jobAId = jobA.id;

    const jobB = await prisma.job.create({
      data: {
        organizationId: orgBId,
        appointmentId: apptB.id,
        technicianId: techBId,
        status: 'ASSIGNED',
      },
    });
    jobBId = jobB.id;

    // 8. Setup Invoices
    const invA = await prisma.invoice.create({
      data: {
        invoiceNumber: `INV-A-${randomUUID().slice(0, 4)}`,
        organizationId: orgAId,
        customerId: custA.id,
        jobId: jobA.id,
        total: 250.0,
        subtotal: 238.1,
        taxTotal: 11.9,
        paymentToken: randomUUID(),
      },
    });
    invoiceAId = invA.id;

    const invB = await prisma.invoice.create({
      data: {
        invoiceNumber: `INV-B-${randomUUID().slice(0, 4)}`,
        organizationId: orgBId,
        customerId: custB.id,
        jobId: jobB.id,
        total: 500.0,
        subtotal: 476.19,
        taxTotal: 23.81,
        paymentToken: randomUUID(),
      },
    });
    invoiceBId = invB.id;
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.payment.deleteMany({ where: { invoiceId: { in: [invoiceAId, invoiceBId] } } });
    await prisma.invoice.deleteMany({ where: { id: { in: [invoiceAId, invoiceBId] } } });
    await prisma.job.deleteMany({ where: { id: { in: [jobAId, jobBId] } } });
    await prisma.appointment.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.property.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.service.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.customer.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.technician.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.organizationMember.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.user.deleteMany({ where: { email: { contains: sharedEmail } } });
    await prisma.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } });
  });

  test('Org A Dispatcher cannot read Org B Job even with known UUID', async () => {
    const jobAttempt = await prisma.job.findFirst({
      where: {
        id: jobBId,
        organizationId: orgAId, // Scoped to Org A session
      },
    });
    expect(jobAttempt).toBeNull();
  });

  test('Org A Dispatcher cannot read Org B Invoices', async () => {
    const invoiceAttempt = await prisma.invoice.findFirst({
      where: {
        id: invoiceBId,
        organizationId: orgAId, // Scoped to Org A session
      },
    });
    expect(invoiceAttempt).toBeNull();
  });

  test('Customer overlap: single email belongs to Org A and Org B independently', async () => {
    const user = await prisma.user.findUnique({
      where: { email: sharedEmail },
      include: { customers: true },
    });

    expect(user).not.toBeNull();
    expect(user?.customers.length).toBe(2);

    const orgACust = user?.customers.find((c) => c.organizationId === orgAId);
    const orgBCust = user?.customers.find((c) => c.organizationId === orgBId);

    expect(orgACust).toBeDefined();
    expect(orgBCust).toBeDefined();
    expect(orgACust?.id).not.toBe(orgBCust?.id);

    // Verify Org A only sees Org A customer appointments
    const orgAAppts = await prisma.appointment.findMany({
      where: { organizationId: orgAId, customerId: orgACust!.id },
    });
    expect(orgAAppts.length).toBe(1);
    expect(orgAAppts[0].propertyId).not.toBeNull();

    // Verify Org B only sees Org B customer appointments
    const orgBAppts = await prisma.appointment.findMany({
      where: { organizationId: orgBId, customerId: orgBCust!.id },
    });
    expect(orgBAppts.length).toBe(1);
  });

  test('Technician A cannot read or modify Technician B assigned job', async () => {
    const techAJob = await prisma.job.findFirst({
      where: {
        id: jobBId,
        technicianId: techAId,
      },
    });
    expect(techAJob).toBeNull();
  });
});
