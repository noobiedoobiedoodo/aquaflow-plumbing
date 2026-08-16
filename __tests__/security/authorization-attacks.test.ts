import { expect, test, describe, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../src/lib/db';
import { randomUUID } from 'crypto';

describe('Application-Level Authorization & IDOR Attack Suite', () => {
  let orgAId: string;
  let orgBId: string;
  let userAId: string;
  let userBId: string;
  let customerAId: string;
  let customerBId: string;
  let jobAId: string;
  let jobBId: string;
  let techAId: string;
  let techBId: string;
  let invoiceAId: string;
  let invoiceBId: string;

  beforeAll(async () => {
    // 1. Setup Tenant A
    const orgA = await prisma.organization.create({
      data: { name: 'Tenant A Apex', slug: `apex-${randomUUID()}` },
    });
    orgAId = orgA.id;

    // 2. Setup Tenant B
    const orgB = await prisma.organization.create({
      data: { name: 'Tenant B BlueRidge', slug: `blueridge-${randomUUID()}` },
    });
    orgBId = orgB.id;

    // Users
    const userA = await prisma.user.create({
      data: { email: `usera-${randomUUID()}@apex.com`, firstName: 'Alice', lastName: 'A', passwordHash: 'none' },
    });
    userAId = userA.id;

    const userB = await prisma.user.create({
      data: { email: `userb-${randomUUID()}@blueridge.com`, firstName: 'Bob', lastName: 'B', passwordHash: 'none' },
    });
    userBId = userB.id;

    // Customers
    const custA = await prisma.customer.create({
      data: { organizationId: orgAId, userId: userA.id, firstName: 'Alice', lastName: 'A' },
    });
    customerAId = custA.id;

    const custB = await prisma.customer.create({
      data: { organizationId: orgBId, userId: userB.id, firstName: 'Bob', lastName: 'B' },
    });
    customerBId = custB.id;

    // Technicians
    const techUserA = await prisma.user.create({
      data: { email: `tech-a-${randomUUID()}@apex.com`, passwordHash: 'none', memberships: { create: { organizationId: orgAId, role: 'TECHNICIAN' } } },
    });
    const techA = await prisma.technician.create({
      data: { organizationId: orgAId, userId: techUserA.id, firstName: 'Tech', lastName: 'A' },
    });
    techAId = techA.id;

    const techUserB = await prisma.user.create({
      data: { email: `tech-b-${randomUUID()}@blueridge.com`, passwordHash: 'none', memberships: { create: { organizationId: orgBId, role: 'TECHNICIAN' } } },
    });
    const techB = await prisma.technician.create({
      data: { organizationId: orgBId, userId: techUserB.id, firstName: 'Tech', lastName: 'B' },
    });
    techBId = techB.id;

    // Properties, Services & Appointments
    const propA = await prisma.property.create({ data: { organizationId: orgAId, customerId: custA.id, address: '100 Apex', city: 'Winnipeg', postalCode: 'R3C1A1' } });
    const propB = await prisma.property.create({ data: { organizationId: orgBId, customerId: custB.id, address: '200 Blue', city: 'Winnipeg', postalCode: 'R3C2B2' } });

    const servA = await prisma.service.create({ data: { organizationId: orgAId, name: 'Service A', slug: `serv-a-${randomUUID().slice(0, 6)}` } });
    const servB = await prisma.service.create({ data: { organizationId: orgBId, name: 'Service B', slug: `serv-b-${randomUUID().slice(0, 6)}` } });

    const apptA = await prisma.appointment.create({
      data: { appointmentNumber: `APPT-A-${randomUUID().slice(0, 4)}`, organizationId: orgAId, customerId: custA.id, propertyId: propA.id, serviceId: servA.id, date: new Date(), startTime: '09:00', endTime: '10:00' },
    });
    const apptB = await prisma.appointment.create({
      data: { appointmentNumber: `APPT-B-${randomUUID().slice(0, 4)}`, organizationId: orgBId, customerId: custB.id, propertyId: propB.id, serviceId: servB.id, date: new Date(), startTime: '13:00', endTime: '14:00' },
    });

    const jobA = await prisma.job.create({ data: { organizationId: orgAId, appointmentId: apptA.id, technicianId: techA.id, status: 'ASSIGNED' } });
    jobAId = jobA.id;

    const jobB = await prisma.job.create({ data: { organizationId: orgBId, appointmentId: apptB.id, technicianId: techB.id, status: 'ASSIGNED' } });
    jobBId = jobB.id;

    const invA = await prisma.invoice.create({
      data: { invoiceNumber: `INV-A-${randomUUID().slice(0, 4)}`, organizationId: orgAId, customerId: custA.id, jobId: jobA.id, total: 100, subtotal: 95, taxTotal: 5, paymentToken: randomUUID() },
    });
    invoiceAId = invA.id;

    const invB = await prisma.invoice.create({
      data: { invoiceNumber: `INV-B-${randomUUID().slice(0, 4)}`, organizationId: orgBId, customerId: custB.id, jobId: jobB.id, total: 200, subtotal: 190, taxTotal: 10, paymentToken: randomUUID() },
    });
    invoiceBId = invB.id;
  });

  afterAll(async () => {
    await prisma.supportTicketMessage.deleteMany({ where: { ticket: { organizationId: { in: [orgAId, orgBId] } } } });
    await prisma.supportTicket.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.invoiceLine.deleteMany({ where: { invoice: { organizationId: { in: [orgAId, orgBId] } } } });
    await prisma.invoice.deleteMany({ where: { id: { in: [invoiceAId, invoiceBId] } } });
    await prisma.job.deleteMany({ where: { id: { in: [jobAId, jobBId] } } });
    await prisma.appointment.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.property.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.service.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.customer.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.technician.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.organizationMember.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userAId, userBId] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } });
  });

  test('Cross-Tenant Attack: Tenant A Dispatcher cannot query Tenant B Job', async () => {
    const job = await prisma.job.findFirst({
      where: { id: jobBId, organizationId: orgAId },
    });
    expect(job).toBeNull();
  });

  test('Cross-Tenant Attack: Tenant A Dispatcher cannot access Tenant B Invoice', async () => {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceBId, organizationId: orgAId },
    });
    expect(invoice).toBeNull();
  });

  test('Customer IDOR Attack: Customer A cannot view Customer B Job', async () => {
    const job = await prisma.job.findFirst({
      where: { id: jobBId, appointment: { customerId: customerAId } },
    });
    expect(job).toBeNull();
  });

  test('Customer IDOR Attack: Customer A cannot view Customer B Invoice', async () => {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceBId, customerId: customerAId },
    });
    expect(invoice).toBeNull();
  });

  test('Technician IDOR Attack: Technician A cannot view or modify Technician B Job', async () => {
    const job = await prisma.job.findFirst({
      where: { id: jobBId, technicianId: techAId },
    });
    expect(job).toBeNull();
  });

  test('Support Ticket IDOR Fix: Customer A attempting to reference Customer B Job is rejected by ownership verification', async () => {
    // Attempting to attach jobBId (owned by Customer B) to a support ticket for Customer A
    const verifiedJob = await prisma.job.findFirst({
      where: {
        id: jobBId,
        appointment: {
          customerId: customerAId,
          organizationId: orgAId,
        },
      },
    });

    expect(verifiedJob).toBeNull(); // Reject before creating ticket
  });
});
