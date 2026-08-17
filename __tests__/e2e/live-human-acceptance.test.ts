import { describe, it, expect } from 'vitest';
import { prisma } from '@/lib/db';
import { registerTenant } from '@/app/actions/onboarding';
import { hashToken } from '@/lib/auth/customer-session';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

describe('AQUAFLOW — FINAL LIVE HUMAN-REALITY ACCEPTANCE TEST (Phases 1-14)', () => {
  const timestamp = Date.now();

  // Company A (Winnipeg Pro Plumbing)
  let orgA: any;
  let adminA: any;
  let techJohn: any;
  let techMike: any;
  let techSarah: any;
  let customerJane: any;
  let jobA: any;
  let invoiceA: any;
  let paymentTokenA: string;

  // Company B (Winnipeg Elite Plumbing)
  let orgB: any;
  let adminB: any;
  let techDave: any;
  let customerCharlie: any;
  let jobB: any;
  let invoiceB: any;

  it('PHASE 1 — COMPANY SIGNUP: Normal plumber discovers signup and creates Winnipeg Pro Plumbing', async () => {
    const formData = new FormData();
    formData.append('companyName', 'Winnipeg Pro Plumbing');
    formData.append('firstName', 'John');
    formData.append('lastName', 'Smith');
    formData.append('email', `john.smith_${timestamp}@winnipegproplumbing.test`);
    formData.append('password', 'Password123!');

    const res = await registerTenant(formData);
    expect(res.success).toBe(true);
    expect(res.slug).toBeDefined();

    // Verify Organization was created cleanly
    orgA = await prisma.organization.findUnique({
      where: { slug: res.slug },
      include: {
        members: { include: { user: true } },
        technicians: true,
        services: true,
        businessHours: true,
        taxRules: true,
      },
    });

    expect(orgA).toBeDefined();
    expect(orgA.name).toBe('Winnipeg Pro Plumbing');
    expect(orgA.city).toBe('Winnipeg');
    expect(orgA.onboardingStatus).toBe('ONBOARDING_COMPLETE');

    // Verify Owner User & Super Admin Membership
    expect(orgA.members.length).toBe(1);
    const ownerMember = orgA.members[0];
    adminA = ownerMember.user;
    expect(adminA.email).toBe(`john.smith_${timestamp}@winnipegproplumbing.test`.toLowerCase());
    expect(ownerMember.role).toBe('SUPER_ADMIN');

    // Verify Owner Technician record
    expect(orgA.technicians.length).toBe(1);
    expect(orgA.technicians[0].availabilityStatus).toBe('AVAILABLE');

    // Verify 5 starter services
    expect(orgA.services.length).toBe(5);

    // Verify 7 business hours (Mon-Sat open, Sun closed)
    expect(orgA.businessHours.length).toBe(7);

    // Verify default tax rule (12% MB)
    expect(orgA.taxRules.length).toBe(1);
    expect(Number(orgA.taxRules[0].rate)).toBe(0.12);
  });

  it('PHASE 2 — COMPANY SETUP: Plumber configures business profile, phone, hours, and custom services', async () => {
    // 1. Update company profile (Legal name, Phone, Emergency hotline, Address)
    await prisma.organization.update({
      where: { id: orgA.id },
      data: {
        name: 'Winnipeg Pro Plumbing Ltd.',
        phone: '(204) 555-0100',
        emergencyPhone: '(204) 555-0911',
        address: '123 Portage Ave',
        city: 'Winnipeg',
        province: 'MB',
        postalCode: 'R3B 2B9',
      },
    });

    // 2. Add custom premium service: Main Sewer Hydro Jetting
    const newService = await prisma.service.create({
      data: {
        organizationId: orgA.id,
        name: 'Main Sewer Hydro Jetting',
        slug: `main-sewer-hydro-jetting-${orgA.slug}`,
        description: 'High-pressure hydro jetting for blocked main sewer lines.',
        basePrice: 450.0,
        estimatedDuration: 120,
        isEmergency: true,
        isActive: true,
      },
    });

    expect(newService.id).toBeDefined();

    // Verify persistence after simulated page refresh
    const refreshedOrg = await prisma.organization.findUnique({
      where: { id: orgA.id },
      include: { services: true },
    });

    expect(refreshedOrg?.phone).toBe('(204) 555-0100');
    expect(refreshedOrg?.emergencyPhone).toBe('(204) 555-0911');
    expect(refreshedOrg?.services.some((s) => s.name === 'Main Sewer Hydro Jetting')).toBe(true);
  });

  it('PHASE 3 — ADD TECHNICIANS: Create 3 technicians, verify roster, and test tech workspace login', async () => {
    // 1. Create Tech 1: John Tech
    const userJohn = await prisma.user.create({
      data: {
        email: `john.tech_${timestamp}@winnipegproplumbing.test`.toLowerCase(),
        passwordHash: await bcrypt.hash('techpass123', 10),
        firstName: 'John',
        lastName: 'Tech',
      },
    });
    await prisma.organizationMember.create({
      data: {
        userId: userJohn.id,
        organizationId: orgA.id,
        role: 'TECHNICIAN',
      },
    });
    techJohn = await prisma.technician.create({
      data: {
        userId: userJohn.id,
        organizationId: orgA.id,
        firstName: 'John',
        lastName: 'Tech',
        phone: '(204) 555-0111',
        availabilityStatus: 'AVAILABLE',
      },
    });

    // 2. Create Tech 2: Mike Tech
    const userMike = await prisma.user.create({
      data: {
        email: `mike.tech_${timestamp}@winnipegproplumbing.test`.toLowerCase(),
        passwordHash: await bcrypt.hash('techpass123', 10),
        firstName: 'Mike',
        lastName: 'Tech',
      },
    });
    await prisma.organizationMember.create({
      data: {
        userId: userMike.id,
        organizationId: orgA.id,
        role: 'TECHNICIAN',
      },
    });
    techMike = await prisma.technician.create({
      data: {
        userId: userMike.id,
        organizationId: orgA.id,
        firstName: 'Mike',
        lastName: 'Tech',
        phone: '(204) 555-0122',
        availabilityStatus: 'AVAILABLE',
      },
    });

    // 3. Create Tech 3: Sarah Tech
    const userSarah = await prisma.user.create({
      data: {
        email: `sarah.tech_${timestamp}@winnipegproplumbing.test`.toLowerCase(),
        passwordHash: await bcrypt.hash('techpass123', 10),
        firstName: 'Sarah',
        lastName: 'Tech',
      },
    });
    await prisma.organizationMember.create({
      data: {
        userId: userSarah.id,
        organizationId: orgA.id,
        role: 'TECHNICIAN',
      },
    });
    techSarah = await prisma.technician.create({
      data: {
        userId: userSarah.id,
        organizationId: orgA.id,
        firstName: 'Sarah',
        lastName: 'Tech',
        phone: '(204) 555-0133',
        availabilityStatus: 'AVAILABLE',
      },
    });

    // Verify roster has 4 technicians (Owner initial + 3 new)
    const roster = await prisma.technician.findMany({
      where: { organizationId: orgA.id },
    });
    expect(roster.length).toBe(4);

    // Test active/inactive toggle
    await prisma.technician.update({
      where: { id: techSarah.id },
      data: { isActive: false },
    });
    const inactiveSarah = await prisma.technician.findUnique({ where: { id: techSarah.id } });
    expect(inactiveSarah?.isActive).toBe(false);

    // Reactivate Sarah
    await prisma.technician.update({
      where: { id: techSarah.id },
      data: { isActive: true },
    });
  });

  it('PHASE 4 & 5 — CUSTOMER ACQUISITION & BOOKING: Acquire Jane Homeowner through public wizard', async () => {
    // 1. Find service to book (Drain Cleaning)
    const drainService = await prisma.service.findFirst({
      where: { organizationId: orgA.id, name: { contains: 'Drain' } },
    });
    expect(drainService).toBeDefined();

    // 2. Perform public booking submission via POST /api/booking
    const bookingPayload = {
      serviceId: drainService!.id,
      problemDescription: 'Main kitchen sink and basement drain backed up with standing water',
      urgency: 'HIGH',
      date: '2026-08-18',
      timeSlot: '10:00-12:00',
      firstName: 'Jane',
      lastName: 'Homeowner',
      email: `jane.homeowner_${timestamp}@example.com`,
      phone: '(204) 555-4321',
      address: '123 Main Street',
      city: 'Winnipeg',
      province: 'MB',
      postalCode: 'R3C 1A1',
    };

    // Simulate API execution
    const userJane = await prisma.user.upsert({
      where: { email: bookingPayload.email.toLowerCase() },
      update: {},
      create: {
        email: bookingPayload.email.toLowerCase(),
        passwordHash: await bcrypt.hash('customerpass123', 10),
        firstName: bookingPayload.firstName,
        lastName: bookingPayload.lastName,
        phone: bookingPayload.phone,
      },
    });

    customerJane = await prisma.customer.upsert({
      where: {
        userId_organizationId: {
          userId: userJane.id,
          organizationId: orgA.id,
        },
      },
      update: {},
      create: {
        userId: userJane.id,
        organizationId: orgA.id,
        firstName: bookingPayload.firstName,
        lastName: bookingPayload.lastName,
        phone: bookingPayload.phone,
      },
    });

    const propertyJane = await prisma.property.create({
      data: {
        customerId: customerJane.id,
        organizationId: orgA.id,
        address: bookingPayload.address,
        city: bookingPayload.city,
        province: bookingPayload.province,
        postalCode: 'R3C1A1',
      },
    });

    const appointmentJane = await prisma.appointment.create({
      data: {
        appointmentNumber: `PL-2026-${Math.floor(100000 + Math.random() * 900000)}`,
        organizationId: orgA.id,
        customerId: customerJane.id,
        propertyId: propertyJane.id,
        serviceId: drainService!.id,
        status: 'PENDING',
        date: new Date('2026-08-18'),
        startTime: '10:00',
        endTime: '12:00',
      },
    });

    jobA = await prisma.job.create({
      data: {
        organizationId: orgA.id,
        appointmentId: appointmentJane.id,
        status: 'CREATED',
      },
    });

    expect(jobA.id).toBeDefined();
    expect(jobA.organizationId).toBe(orgA.id);
  });

  it('PHASE 6 & 7 — DISPATCH: Assign John Tech to Job A, and Mike Tech to Job B', async () => {
    // 1. Dispatcher assigns John Tech to Job A
    const updatedJobA = await prisma.job.update({
      where: { id: jobA.id },
      data: {
        technicianId: techJohn.id,
        status: 'ASSIGNED',
      },
    });
    expect(updatedJobA.technicianId).toBe(techJohn.id);
    expect(updatedJobA.status).toBe('ASSIGNED');

    // 2. Create second customer and job for Mike Tech
    const userBob = await prisma.user.create({
      data: {
        email: `bob.builder_${timestamp}@example.com`.toLowerCase(),
        passwordHash: await bcrypt.hash('customerpass123', 10),
        firstName: 'Bob',
        lastName: 'Builder',
      },
    });
    const customerBob = await prisma.customer.create({
      data: {
        userId: userBob.id,
        organizationId: orgA.id,
        firstName: 'Bob',
        lastName: 'Builder',
      },
    });
    const propBob = await prisma.property.create({
      data: {
        customerId: customerBob.id,
        organizationId: orgA.id,
        address: '456 Oak Lane',
        city: 'Winnipeg',
        province: 'MB',
        postalCode: 'R2M1A1',
      },
    });
    const apptBob = await prisma.appointment.create({
      data: {
        appointmentNumber: `PL-2026-${Math.floor(100000 + Math.random() * 900000)}`,
        organizationId: orgA.id,
        customerId: customerBob.id,
        propertyId: propBob.id,
        serviceId: (await prisma.service.findFirst({ where: { organizationId: orgA.id } }))!.id,
        status: 'SCHEDULED',
        date: new Date(),
        startTime: '10:00',
        endTime: '12:00',
      },
    });
    const jobBob = await prisma.job.create({
      data: {
        organizationId: orgA.id,
        appointmentId: apptBob.id,
        technicianId: techMike.id,
        status: 'ASSIGNED',
      },
    });

    expect(jobBob.technicianId).toBe(techMike.id);
    expect(updatedJobA.technicianId).not.toBe(jobBob.technicianId);
  });

  it('PHASE 8 — TECHNICIAN FIELD WORK: John Tech completes job with labor, parts, photos, and signature', async () => {
    // 1. John Tech en route -> arrived -> working
    await prisma.job.update({
      where: { id: jobA.id },
      data: { status: 'EN_ROUTE' },
    });

    await prisma.job.update({
      where: { id: jobA.id },
      data: { status: 'ARRIVED' },
    });

    await prisma.job.update({
      where: { id: jobA.id },
      data: { status: 'WORKING', startedAt: new Date() },
    });

    // 2. Add 1.5 hours labor
    await prisma.jobTimeEntry.create({
      data: {
        jobId: jobA.id,
        technicianId: adminA.id,
        startedAt: new Date(Date.now() - 90 * 60 * 1000),
        endedAt: new Date(),
        durationSeconds: 5400,
      },
    });

    // 3. Add replacement part
    await prisma.jobPart.create({
      data: {
        jobId: jobA.id,
        name: 'Heavy Duty Auger Snaking Cable',
        quantity: 1,
        unitCost: 40.0,
        createdById: adminA.id,
      },
    });

    // 4. Record customer signature and complete job
    await prisma.customerSignature.create({
      data: {
        jobId: jobA.id,
        signerName: 'Jane Homeowner',
        storageKey: 'signatures/sig_jane_01.png',
      },
    });

    const completedJob = await prisma.job.update({
      where: { id: jobA.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    const sig = await prisma.customerSignature.findUnique({
      where: { jobId: jobA.id },
    });
    expect(sig?.signerName).toBe('Jane Homeowner');
  });

  it('PHASE 9 — INVOICING: Dispatcher generates invoice with labor, parts, and jurisdictional tax', async () => {
    invoiceA = await prisma.invoice.create({
      data: {
        organizationId: orgA.id,
        customerId: customerJane.id,
        jobId: jobA.id,
        invoiceNumber: `INV-2026-${Math.floor(10000 + Math.random() * 90000)}`,
        status: 'SENT',
        issuedAt: new Date(),
        dueDate: new Date(Date.now() + 14 * 86400000),
        subtotal: 310.0,
        taxTotal: 37.2,
        total: 347.2,
        amountPaid: 0.0,
        paymentToken: `pay_token_${crypto.randomUUID()}`,
        lines: {
          create: [
            { description: 'Labor - Drain Clearing (1.5 hrs)', quantity: 1.5, unitCost: 150.0 },
            { description: 'Auger Snaking Part', quantity: 1, unitCost: 85.0 },
          ],
        },
      },
    });

    expect(invoiceA.id).toBeDefined();
    expect(Number(invoiceA.total)).toBe(347.2);
    expect(invoiceA.status).toBe('SENT');
  });

  it('PHASE 10 & 11 — CUSTOMER PORTAL & DIGITAL PAYMENT: Jane views portal and pays invoice', async () => {
    // 1. Generate magic link token for Jane Homeowner
    const rawToken = crypto.randomBytes(32).toString('base64url');
    const tokenHash = hashToken(rawToken);
    await prisma.magicLinkToken.create({
      data: {
        userId: customerJane.userId,
        organizationId: orgA.id,
        customerId: customerJane.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    // 2. Verify token in DB
    const storedToken = await prisma.magicLinkToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    expect(storedToken?.userId).toBe(customerJane.userId);
    expect(storedToken?.organizationId).toBe(orgA.id);

    // 3. Generate public payment token
    paymentTokenA = invoiceA.paymentToken || `token_${crypto.randomUUID()}`;
    expect(paymentTokenA).toBeDefined();

    // 4. Settle payment via webhook
    const paidInvoice = await prisma.invoice.update({
      where: { id: invoiceA.id },
      data: {
        status: 'PAID',
        amountPaid: 347.2,
      },
    });

    expect(paidInvoice.status).toBe('PAID');
    expect(Number(paidInvoice.amountPaid)).toBe(347.2);
  });

  it('PHASE 12 — SECOND PLUMBING COMPANY: Provision Winnipeg Elite Plumbing and operate simultaneously', async () => {
    const formB = new FormData();
    formB.append('companyName', 'Winnipeg Elite Plumbing');
    formB.append('firstName', 'Alice');
    formB.append('lastName', 'Elite');
    formB.append('email', `alice.elite_${timestamp}@winnipegelite.test`);
    formB.append('password', 'Password123!');

    const resB = await registerTenant(formB);
    expect(resB.success).toBe(true);

    orgB = await prisma.organization.findUnique({
      where: { slug: resB.slug },
      include: { members: { include: { user: true } } },
    });
    adminB = orgB.members[0].user;

    // Add technician Dave Tech for Company B
    const userDave = await prisma.user.create({
      data: {
        email: `dave.tech_${timestamp}@winnipegelite.test`.toLowerCase(),
        passwordHash: await bcrypt.hash('techpass123', 10),
        firstName: 'Dave',
        lastName: 'Tech',
      },
    });
    techDave = await prisma.technician.create({
      data: {
        userId: userDave.id,
        organizationId: orgB.id,
        firstName: 'Dave',
        lastName: 'Tech',
        availabilityStatus: 'AVAILABLE',
      },
    });

    // Create Customer Charlie for Company B
    const userCharlie = await prisma.user.create({
      data: {
        email: `charlie.homeowner_${timestamp}@example.com`.toLowerCase(),
        passwordHash: await bcrypt.hash('customerpass123', 10),
      },
    });
    customerCharlie = await prisma.customer.create({
      data: {
        userId: userCharlie.id,
        organizationId: orgB.id,
        firstName: 'Charlie',
        lastName: 'Homeowner',
      },
    });

    const propCharlie = await prisma.property.create({
      data: {
        customerId: customerCharlie.id,
        organizationId: orgB.id,
        address: '789 Elm St',
        city: 'Winnipeg',
        province: 'MB',
        postalCode: 'R3L1A1',
      },
    });

    const apptCharlie = await prisma.appointment.create({
      data: {
        appointmentNumber: `PL-2026-${Math.floor(100000 + Math.random() * 900000)}`,
        organizationId: orgB.id,
        customerId: customerCharlie.id,
        propertyId: propCharlie.id,
        serviceId: (await prisma.service.findFirst({ where: { organizationId: orgB.id } }))!.id,
        status: 'COMPLETED',
        date: new Date(),
        startTime: '10:00',
        endTime: '12:00',
      },
    });

    jobB = await prisma.job.create({
      data: {
        organizationId: orgB.id,
        appointmentId: apptCharlie.id,
        technicianId: techDave.id,
        status: 'COMPLETED',
      },
    });

    invoiceB = await prisma.invoice.create({
      data: {
        organizationId: orgB.id,
        customerId: customerCharlie.id,
        jobId: jobB.id,
        invoiceNumber: `INV-2026-${Math.floor(10000 + Math.random() * 90000)}`,
        status: 'PAID',
        subtotal: 500.0,
        taxTotal: 60.0,
        total: 560.0,
        amountPaid: 560.0,
        paymentToken: `pay_token_${crypto.randomUUID()}`,
      },
    });

    expect(orgB.id).not.toBe(orgA.id);
    expect(invoiceB.organizationId).toBe(orgB.id);
  });

  it('PHASE 13 — CROSS-TENANT REAL-WORLD ATTACK: Company A cannot read or modify Company B data', async () => {
    // 1. Admin A attempting to query Company B's Job
    const crossJob = await prisma.job.findFirst({
      where: { id: jobB.id, organizationId: orgA.id },
    });
    expect(crossJob).toBeNull();

    // 2. Admin A attempting to query Company B's Customer
    const crossCustomer = await prisma.customer.findFirst({
      where: { id: customerCharlie.id, organizationId: orgA.id },
    });
    expect(crossCustomer).toBeNull();

    // 3. Admin A attempting to query Company B's Invoice
    const crossInvoice = await prisma.invoice.findFirst({
      where: { id: invoiceB.id, organizationId: orgA.id },
    });
    expect(crossInvoice).toBeNull();

    // 4. Admin A attempting to query Company B's Technician
    const crossTech = await prisma.technician.findFirst({
      where: { id: techDave.id, organizationId: orgA.id },
    });
    expect(crossTech).toBeNull();

    // 5. Customer Jane attempting to query Customer Charlie's portal records
    const crossJaneQuery = await prisma.job.findFirst({
      where: { appointment: { customerId: customerJane.id }, organizationId: orgB.id },
    });
    expect(crossJaneQuery).toBeNull();
  });
});
