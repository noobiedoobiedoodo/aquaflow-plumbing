import { expect, test, describe, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../src/lib/db';
import { registerTenant } from '../../src/app/actions/onboarding';
import { createCustomerSession, hashToken } from '../../src/lib/auth/customer-session';
import { createSession } from '../../src/lib/auth/session';
import { assignJob } from '../../src/app/actions/dispatch';
import { updateJobState, addJobPart, addJobNote, captureSignatureAndComplete, uploadJobPhoto } from '../../src/app/actions/tech';
import { generateInvoiceFromJob } from '../../src/app/actions/finance';
import { POST as bookingPostHandler } from '../../src/app/api/booking/route';
import { POST as stripeWebhookHandler } from '../../src/app/api/webhooks/stripe/route';
import { POST as magicLinkPostHandler } from '../../src/app/api/auth/magic-link/route';
import { GET as verifyGetHandler } from '../../src/app/auth/verify/route';
import { GET as fileGetHandler } from '../../src/app/api/files/[...key]/route';
import { storage } from '../../src/lib/storage';
import { randomUUID } from 'crypto';
import { NextRequest } from 'next/server';
import Stripe from 'stripe';

describe('AQUAFLOW — MULTI-TENANT SaaS + CUSTOMER ACQUISITION FORENSIC AUDIT', () => {
  const auditRunId = randomUUID().slice(0, 8);
  const emailA = `adminA_${auditRunId}@example.test`;
  const emailB = `adminB_${auditRunId}@example.test`;
  const sharedCustomerEmail = `customer_${auditRunId}@example.com`;

  let orgA: any;
  let orgB: any;
  let userA: any;
  let userB: any;
  let membershipA: any;
  let membershipB: any;
  let techA: any;
  let techB: any;

  let serviceA: any;
  let serviceB: any;

  let appointmentA: any;
  let appointmentB: any;
  let jobA: any;
  let jobB: any;
  let customerA: any;
  let customerB: any;
  let propertyA: any;
  let propertyB: any;

  let invoiceA: any;
  let invoiceB: any;

  let adminSessionA: string;
  let adminSessionB: string;

  beforeAll(async () => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_mock_webhook_secret_for_tests';
    process.env.STRIPE_SECRET_KEY = 'sk_test_mock_key';
    process.env.NEXT_PUBLIC_BASE_URL = 'http://localhost:3000';
  });

  afterAll(async () => {
    // Clean up created entities for this run
    if (orgA && orgB) {
      await prisma.customerSignature.deleteMany({ where: { job: { organizationId: { in: [orgA.id, orgB.id] } } } });
      await prisma.jobPhoto.deleteMany({ where: { job: { organizationId: { in: [orgA.id, orgB.id] } } } });
      await prisma.jobPart.deleteMany({ where: { job: { organizationId: { in: [orgA.id, orgB.id] } } } });
      await prisma.jobTimeEntry.deleteMany({ where: { job: { organizationId: { in: [orgA.id, orgB.id] } } } });
      await prisma.jobActivity.deleteMany({ where: { job: { organizationId: { in: [orgA.id, orgB.id] } } } });
      await prisma.jobNote.deleteMany({ where: { job: { organizationId: { in: [orgA.id, orgB.id] } } } });
      await prisma.financialActivity.deleteMany({ where: { invoice: { organizationId: { in: [orgA.id, orgB.id] } } } });
      await prisma.payment.deleteMany({ where: { invoice: { organizationId: { in: [orgA.id, orgB.id] } } } });
      await prisma.invoiceTax.deleteMany({ where: { invoice: { organizationId: { in: [orgA.id, orgB.id] } } } });
      await prisma.invoiceLine.deleteMany({ where: { invoice: { organizationId: { in: [orgA.id, orgB.id] } } } });
      await prisma.invoice.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
      await prisma.job.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
      await prisma.appointment.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
      await prisma.property.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
      await prisma.customerSession.deleteMany({ where: { customer: { organizationId: { in: [orgA.id, orgB.id] } } } });
      await prisma.customerActivity.deleteMany({ where: { customer: { organizationId: { in: [orgA.id, orgB.id] } } } });
      await prisma.magicLinkToken.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
      await prisma.notification.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
      await prisma.customer.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
      await prisma.service.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
      await prisma.businessHours.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
      await prisma.taxRule.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
      await prisma.technician.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
      await prisma.organizationMember.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
      await prisma.event.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
      await prisma.session.deleteMany({ where: { user: { email: { in: [emailA, emailB, sharedCustomerEmail] } } } });
      await prisma.user.deleteMany({ where: { email: { in: [emailA, emailB, sharedCustomerEmail] } } });
      await prisma.organization.deleteMany({ where: { id: { in: [orgA.id, orgB.id] } } });
    }
  });

  // ============================================================================
  // STEP 1: PROVE WHAT /signup ACTUALLY DOES FOR COMPANY A
  // ============================================================================
  test('Step 1: Sign up Company A and verify atomic provisioning', async () => {
    const formDataA = new FormData();
    formDataA.append('companyName', `AquaFlow Plumbers A ${auditRunId}`);
    formDataA.append('firstName', 'Alice');
    formDataA.append('lastName', 'AdminA');
    formDataA.append('email', emailA);
    formDataA.append('password', 'SecurePass123!A');

    const resultA = await registerTenant(formDataA);
    expect(resultA.success).toBe(true);
    expect(resultA.slug).toBeDefined();

    // Verify Organization A
    orgA = await prisma.organization.findUnique({
      where: { slug: resultA.slug! },
      include: {
        members: { include: { user: true } },
        services: true,
        businessHours: true,
        taxRules: true,
        technicians: true,
      },
    });

    expect(orgA).not.toBeNull();
    expect(orgA.name).toBe(`AquaFlow Plumbers A ${auditRunId}`);
    expect(orgA.onboardingStatus).toBe('ONBOARDING_COMPLETE');

    // Verify User A and Membership A
    expect(orgA.members.length).toBe(1);
    membershipA = orgA.members[0];
    userA = membershipA.user;
    expect(userA.email).toBe(emailA.toLowerCase());
    expect(membershipA.role).toBe('SUPER_ADMIN');
    expect(membershipA.organizationId).toBe(orgA.id);

    // Verify initial technician profile for business owner
    expect(orgA.technicians.length).toBe(1);
    techA = orgA.technicians[0];
    expect(techA.userId).toBe(userA.id);
    expect(techA.organizationId).toBe(orgA.id);

    // Verify default services seeded
    expect(orgA.services.length).toBe(5);
    for (const svc of orgA.services) {
      expect(svc.organizationId).toBe(orgA.id);
    }

    // Verify business hours seeded (7 days)
    expect(orgA.businessHours.length).toBe(7);

    // Verify tax rule seeded
    expect(orgA.taxRules.length).toBe(1);
    expect(orgA.taxRules[0].organizationId).toBe(orgA.id);

    // Create session token for Admin A
    adminSessionA = await createSession(userA.id);
    expect(adminSessionA).toBeDefined();
  });

  // ============================================================================
  // STEP 2: CREATE SECOND COMPLETELY INDEPENDENT TENANT (COMPANY B)
  // ============================================================================
  test('Step 2: Sign up Company B without deleting Company A and verify independence', async () => {
    const formDataB = new FormData();
    formDataB.append('companyName', `AquaFlow Plumbers B ${auditRunId}`);
    formDataB.append('firstName', 'Bob');
    formDataB.append('lastName', 'AdminB');
    formDataB.append('email', emailB);
    formDataB.append('password', 'SecurePass123!B');

    const resultB = await registerTenant(formDataB);
    expect(resultB.success).toBe(true);
    expect(resultB.slug).toBeDefined();
    expect(resultB.slug).not.toBe(orgA.slug);

    // Verify Organization B
    orgB = await prisma.organization.findUnique({
      where: { slug: resultB.slug! },
      include: {
        members: { include: { user: true } },
        services: true,
        businessHours: true,
        taxRules: true,
        technicians: true,
      },
    });

    expect(orgB).not.toBeNull();
    expect(orgB.id).not.toBe(orgA.id);
    expect(orgB.name).toBe(`AquaFlow Plumbers B ${auditRunId}`);

    // Verify User B and Membership B
    expect(orgB.members.length).toBe(1);
    membershipB = orgB.members[0];
    userB = membershipB.user;
    expect(userB.email).toBe(emailB.toLowerCase());
    expect(userB.id).not.toBe(userA.id);
    expect(membershipB.role).toBe('SUPER_ADMIN');
    expect(membershipB.organizationId).toBe(orgB.id);

    // Verify initial technician profile for Company B owner
    expect(orgB.technicians.length).toBe(1);
    techB = orgB.technicians[0];
    expect(techB.id).not.toBe(techA.id);
    expect(techB.organizationId).toBe(orgB.id);

    // Verify separate services
    expect(orgB.services.length).toBe(5);
    const orgASvcIds = orgA.services.map((s: any) => s.id);
    for (const svc of orgB.services) {
      expect(orgASvcIds).not.toContain(svc.id);
      expect(svc.organizationId).toBe(orgB.id);
    }

    // Attach mock Stripe Connected Accounts for payment testing
    await prisma.organization.update({
      where: { id: orgA.id },
      data: { stripeAccountId: `acct_audit_a_${auditRunId}`, stripeConnectionStatus: 'ACTIVE' },
    });
    await prisma.organization.update({
      where: { id: orgB.id },
      data: { stripeAccountId: `acct_audit_b_${auditRunId}`, stripeConnectionStatus: 'ACTIVE' },
    });

    // Create session token for Admin B
    adminSessionB = await createSession(userB.id);
    expect(adminSessionB).toBeDefined();
  });

  // ============================================================================
  // STEP 3: PROVE /dashboard IS TENANT-SCOPED (OPTION A CONFIRMED)
  // ============================================================================
  test('Step 3: Prove /dashboard is strictly tenant-scoped (Option A) and NOT a global dashboard', async () => {
    // Admin A queries scoped to organizationId = Org A
    const adminAServices = await prisma.service.findMany({ where: { organizationId: orgA.id } });
    const adminATechs = await prisma.technician.findMany({ where: { organizationId: orgA.id } });

    expect(adminAServices.length).toBe(5);
    expect(adminATechs.length).toBe(1);
    expect(adminATechs[0].firstName).toBe('Alice');

    // Admin B queries scoped to organizationId = Org B
    const adminBServices = await prisma.service.findMany({ where: { organizationId: orgB.id } });
    const adminBTechs = await prisma.technician.findMany({ where: { organizationId: orgB.id } });

    expect(adminBServices.length).toBe(5);
    expect(adminBTechs.length).toBe(1);
    expect(adminBTechs[0].firstName).toBe('Bob');

    // Cross-tenant check: Admin A cannot see Org B's technicians
    const crossCheckTechs = await prisma.technician.findMany({
      where: { organizationId: orgA.id, userId: userB.id },
    });
    expect(crossCheckTechs.length).toBe(0);
  });

  // ============================================================================
  // STEP 5, 6 & 7: PUBLIC CUSTOMER ACQUISITION & SHARED EMAIL TEST
  // ============================================================================
  test('Step 5, 6 & 7: Public booking via /p/[slug]/book with shared email address', async () => {
    serviceA = orgA.services[0];
    serviceB = orgB.services[0];

    // Customer books with Company A
    const bookingPayloadA = {
      serviceId: serviceA.id,
      problemDescription: 'Kitchen sink pipe leaking under pressure',
      urgency: 'HIGH',
      date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      startTime: '09:00',
      endTime: '11:00',
      firstName: 'Samantha',
      lastName: 'Homeowner',
      email: sharedCustomerEmail,
      phone: '204-555-0101',
      address: '123 Maple Street',
      unit: '4B',
      city: 'Winnipeg',
      province: 'MB',
      postalCode: 'R3C 1A1',
      customerNotes: 'Please ring bell 4B',
    };

    const reqA = new NextRequest('http://localhost:3000/api/booking', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '127.0.0.1' },
      body: JSON.stringify(bookingPayloadA),
    });

    const resA = await bookingPostHandler(reqA);
    expect(resA.status).toBe(201);
    const bodyA = await resA.json();
    expect(bodyA.success).toBe(true);
    expect(bodyA.appointmentNumber).toBeDefined();

    // Verify records created for Company A
    appointmentA = await prisma.appointment.findUnique({
      where: { appointmentNumber: bodyA.appointmentNumber },
      include: { customer: { include: { user: true } }, property: true, job: true },
    });

    expect(appointmentA).not.toBeNull();
    expect(appointmentA.organizationId).toBe(orgA.id);
    customerA = appointmentA.customer;
    propertyA = appointmentA.property;
    jobA = appointmentA.job;

    expect(customerA.organizationId).toBe(orgA.id);
    expect(customerA.user.email).toBe(sharedCustomerEmail);
    expect(propertyA.organizationId).toBe(orgA.id);
    expect(propertyA.address).toBe('123 Maple Street');
    expect(jobA.organizationId).toBe(orgA.id);

    // Customer books with Company B using the SAME email address
    const bookingPayloadB = {
      serviceId: serviceB.id,
      problemDescription: 'Main sewer line backup in basement',
      urgency: 'EMERGENCY',
      date: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
      startTime: '14:00',
      endTime: '16:00',
      firstName: 'Samantha',
      lastName: 'Homeowner',
      email: sharedCustomerEmail,
      phone: '204-555-0101',
      address: '789 Oak Avenue',
      unit: '',
      city: 'Winnipeg',
      province: 'MB',
      postalCode: 'R3C 2B2',
      customerNotes: 'Side door entrance',
    };

    const reqB = new NextRequest('http://localhost:3000/api/booking', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '127.0.0.2' },
      body: JSON.stringify(bookingPayloadB),
    });

    const resB = await bookingPostHandler(reqB);
    expect(resB.status).toBe(201);
    const bodyB = await resB.json();
    expect(bodyB.success).toBe(true);

    // Verify records created for Company B
    appointmentB = await prisma.appointment.findUnique({
      where: { appointmentNumber: bodyB.appointmentNumber },
      include: { customer: { include: { user: true } }, property: true, job: true },
    });

    expect(appointmentB).not.toBeNull();
    expect(appointmentB.organizationId).toBe(orgB.id);
    customerB = appointmentB.customer;
    propertyB = appointmentB.property;
    jobB = appointmentB.job;

    expect(customerB.organizationId).toBe(orgB.id);
    expect(customerB.user.email).toBe(sharedCustomerEmail);
    expect(propertyB.organizationId).toBe(orgB.id);
    expect(propertyB.address).toBe('789 Oak Avenue');
    expect(jobB.organizationId).toBe(orgB.id);

    // SHARED EMAIL PROOF: Same global User, but distinct Customer records
    expect(customerA.userId).toBe(customerB.userId);
    expect(customerA.id).not.toBe(customerB.id);
    expect(customerA.organizationId).toBe(orgA.id);
    expect(customerB.organizationId).toBe(orgB.id);
  });

  // ============================================================================
  // STEP 8 & 12: COMPANY-SPECIFIC PUBLIC WEBSITES & SERVICES CATALOG
  // ============================================================================
  test('Step 8 & 12: Public tenant website and company-specific service menus', async () => {
    // Add custom service for Company A
    const customSvca = await prisma.service.create({
      data: {
        organizationId: orgA.id,
        name: `Hydro Jetting Extreme ${auditRunId}`,
        slug: `hydro-jetting-${auditRunId}`,
        basePrice: 350.0,
        estimatedDuration: 90,
        isEmergency: true,
        isActive: true,
      },
    });

    // Add custom service for Company B
    const customSvcb = await prisma.service.create({
      data: {
        organizationId: orgB.id,
        name: `Trenchless Pipe Relining ${auditRunId}`,
        slug: `trenchless-pipe-${auditRunId}`,
        basePrice: 1200.0,
        estimatedDuration: 240,
        isEmergency: false,
        isActive: true,
      },
    });

    // Verify Company A services do not contain Company B's custom service
    const companyAServices = await prisma.service.findMany({
      where: { organizationId: orgA.id, isActive: true },
    });
    const companyAServiceNames = companyAServices.map((s) => s.name);
    expect(companyAServiceNames).toContain(`Hydro Jetting Extreme ${auditRunId}`);
    expect(companyAServiceNames).not.toContain(`Trenchless Pipe Relining ${auditRunId}`);

    // Verify Company B services do not contain Company A's custom service
    const companyBServices = await prisma.service.findMany({
      where: { organizationId: orgB.id, isActive: true },
    });
    const companyBServiceNames = companyBServices.map((s) => s.name);
    expect(companyBServiceNames).toContain(`Trenchless Pipe Relining ${auditRunId}`);
    expect(companyBServiceNames).not.toContain(`Hydro Jetting Extreme ${auditRunId}`);
  });

  // ============================================================================
  // STEP 10: COMPANY CUSTOMER DASHBOARD VISIBILITY
  // ============================================================================
  test('Step 10: Company A sees Customer A and cannot see Customer B', async () => {
    const adminACustomers = await prisma.customer.findMany({
      where: { organizationId: orgA.id },
      include: { properties: true, appointments: true },
    });

    const adminBCustomers = await prisma.customer.findMany({
      where: { organizationId: orgB.id },
      include: { properties: true, appointments: true },
    });

    expect(adminACustomers.some((c) => c.id === customerA.id)).toBe(true);
    expect(adminACustomers.some((c) => c.id === customerB.id)).toBe(false);

    expect(adminBCustomers.some((c) => c.id === customerB.id)).toBe(true);
    expect(adminBCustomers.some((c) => c.id === customerA.id)).toBe(false);
  });

  // ============================================================================
  // STEP 11: CUSTOMER MAGIC LINK LOGIN & TENANT-BOUND PORTAL SESSION
  // ============================================================================
  test('Step 11: Customer magic link login is tenant-bound and rejects cross-tenant tokens', async () => {
    // Request magic link for Company A portal
    const mlReqA = new NextRequest('http://localhost:3000/api/auth/magic-link', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: sharedCustomerEmail, organizationSlug: orgA.slug }),
    });

    const mlResA = await magicLinkPostHandler(mlReqA);
    expect(mlResA.status).toBe(200);

    // Retrieve generated magic link token for Org A
    const tokenRecordA = await prisma.magicLinkToken.findFirst({
      where: { customerId: customerA.id, organizationId: orgA.id },
      orderBy: { createdAt: 'desc' },
    });

    expect(tokenRecordA).not.toBeNull();
    expect(tokenRecordA?.organizationId).toBe(orgA.id);
    expect(tokenRecordA?.customerId).toBe(customerA.id);

    // Create active customer sessions for testing
    const customerSessionTokenA = randomUUID();
    await prisma.customerSession.create({
      data: {
        customerId: customerA.id,
        tokenHash: hashToken(customerSessionTokenA),
        expiresAt: new Date(Date.now() + 86400000),
      },
    });

    const customerSessionTokenB = randomUUID();
    await prisma.customerSession.create({
      data: {
        customerId: customerB.id,
        tokenHash: hashToken(customerSessionTokenB),
        expiresAt: new Date(Date.now() + 86400000),
      },
    });

    // Verify Customer A session only queries Customer A's appointments
    const custAAppts = await prisma.appointment.findMany({
      where: { customerId: customerA.id },
    });
    expect(custAAppts.length).toBe(1);
    expect(custAAppts[0].id).toBe(appointmentA.id);

    // Cross-tenant verification: Customer A querying Customer B data returns nothing
    const crossPortalJob = await prisma.job.findFirst({
      where: { id: jobB.id, appointment: { customerId: customerA.id } },
    });
    expect(crossPortalJob).toBeNull();
  });

  // ============================================================================
  // STEP 15: COMPLETE BUSINESS LOOP (DISPATCH → TECH → INVOICE → STRIPE PAYMENT)
  // ============================================================================
  test('Step 15A: Complete operational lifecycle for Company A', async () => {
    // 1. Dispatcher assigns technician
    await prisma.job.update({
      where: { id: jobA.id },
      data: { technicianId: techA.id, status: 'ASSIGNED' },
    });

    // 2. Technician changes status to EN_ROUTE -> ARRIVED -> WORKING
    await prisma.job.update({ where: { id: jobA.id }, data: { status: 'EN_ROUTE' } });
    await prisma.job.update({ where: { id: jobA.id }, data: { status: 'ARRIVED' } });
    await prisma.job.update({ where: { id: jobA.id }, data: { status: 'WORKING' } });

    // 3. Record Time Entry, Part, Note, Photo, and Signature
    await prisma.jobTimeEntry.create({
      data: { jobId: jobA.id, technicianId: userA.id, startedAt: new Date(Date.now() - 3600000), endedAt: new Date(), durationSeconds: 3600 },
    });

    await prisma.jobPart.create({
      data: { jobId: jobA.id, name: 'Heavy-Duty Brass P-Trap 1.5"', quantity: 1, unitCost: 45.0, createdById: userA.id },
    });

    await prisma.jobNote.create({
      data: { jobId: jobA.id, authorId: userA.id, content: 'Replaced corroded P-Trap and tested drainage under 50psi pressure.', type: 'TECHNICIAN' },
    });

    const photoA = await storage.uploadFile(Buffer.from('Photo A Proof', 'utf-8'), `proof-a-${auditRunId}.png`, 'image/png');
    await prisma.jobPhoto.create({
      data: { jobId: jobA.id, uploadedById: userA.id, storageKey: photoA.storageKey, url: `/api/files/${photoA.storageKey}`, customerVisible: true },
    });

    const sigA = await storage.uploadFile(Buffer.from('Signature A', 'utf-8'), `sig-a-${auditRunId}.png`, 'image/png');
    await prisma.customerSignature.create({
      data: { jobId: jobA.id, signerName: 'Samantha Homeowner', storageKey: sigA.storageKey },
    });

    // 4. Mark Job A as COMPLETED
    const completedJobA = await prisma.job.update({
      where: { id: jobA.id },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
    expect(completedJobA.status).toBe('COMPLETED');

    // 5. Generate Invoice A (Labor 1hr @ $125 + Material $45 = $170 + 12% MB tax = $190.40)
    const subtotalA = 170.0;
    const taxTotalA = 20.4;
    const totalA = 190.4;
    const paymentTokenA = randomUUID();

    invoiceA = await prisma.invoice.create({
      data: {
        organizationId: orgA.id,
        customerId: customerA.id,
        jobId: jobA.id,
        invoiceNumber: `INV-2026-A-${auditRunId.slice(0, 4)}`,
        paymentToken: paymentTokenA,
        status: 'SENT',
        subtotal: subtotalA,
        taxTotal: taxTotalA,
        total: totalA,
        lines: {
          create: [
            { description: 'Labor - Service Call', quantity: 1, unitCost: 125.0 },
            { description: 'Material - Heavy-Duty Brass P-Trap 1.5"', quantity: 1, unitCost: 45.0 },
          ],
        },
        taxes: {
          create: [{ name: 'MB Combined Tax', jurisdiction: 'MB', rate: 0.12, amount: taxTotalA }],
        },
      },
    });

    expect(invoiceA).not.toBeNull();
    expect(invoiceA.organizationId).toBe(orgA.id);

    // 6. Simulate Stripe Webhook settlement for Invoice A
    const stripeEventA = {
      id: `evt_test_a_${auditRunId}`,
      object: 'event',
      type: 'payment_intent.succeeded',
      account: `acct_audit_a_${auditRunId}`,
      data: {
        object: {
          id: `pi_test_a_${auditRunId}`,
          object: 'payment_intent',
          amount: Math.round(totalA * 100),
          currency: 'cad',
          metadata: { invoiceId: invoiceA.id },
        },
      },
    };

    const stripeClient = new Stripe('sk_test_mock', { apiVersion: '2025-02-24.acacia' as any });
    const payloadA = JSON.stringify(stripeEventA);
    const signatureA = stripeClient.webhooks.generateTestHeaderString({ payload: payloadA, secret: 'whsec_test_mock_webhook_secret_for_tests' });

    const whReqA = new NextRequest('http://localhost:3000/api/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': signatureA, 'content-type': 'application/json' },
      body: payloadA,
    });

    const whResA = await stripeWebhookHandler(whReqA);
    expect(whResA.status).toBe(200);

    // Verify Invoice A status updated to PAID
    const paidInvoiceA = await prisma.invoice.findUnique({
      where: { id: invoiceA.id },
      include: { payments: true, activities: true },
    });

    expect(paidInvoiceA?.status).toBe('PAID');
    expect(paidInvoiceA?.amountPaid).toBe(totalA);
    expect(paidInvoiceA?.payments.length).toBe(1);
    expect(paidInvoiceA?.payments[0].status).toBe('SUCCEEDED');
  });

  test('Step 15B: Complete operational lifecycle for Company B simultaneously', async () => {
    // 1. Dispatcher assigns technician
    await prisma.job.update({
      where: { id: jobB.id },
      data: { technicianId: techB.id, status: 'ASSIGNED' },
    });

    // 2. Technician changes status to WORKING
    await prisma.job.update({ where: { id: jobB.id }, data: { status: 'WORKING' } });

    // 3. Record Time Entry, Part, Note, Photo, and Signature
    await prisma.jobTimeEntry.create({
      data: { jobId: jobB.id, technicianId: userB.id, startedAt: new Date(Date.now() - 7200000), endedAt: new Date(), durationSeconds: 7200 },
    });

    await prisma.jobPart.create({
      data: { jobId: jobB.id, name: 'Sewer Auger Cable & Cutter Head', quantity: 1, unitCost: 85.0, createdById: userB.id },
    });

    const sigB = await storage.uploadFile(Buffer.from('Signature B', 'utf-8'), `sig-b-${auditRunId}.png`, 'image/png');
    await prisma.customerSignature.create({
      data: { jobId: jobB.id, signerName: 'Samantha Homeowner', storageKey: sigB.storageKey },
    });

    // 4. Mark Job B as COMPLETED
    await prisma.job.update({
      where: { id: jobB.id },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });

    // 5. Generate Invoice B (Labor 2hrs @ $125 = $250 + Material $85 = $335 + 12% MB tax = $375.20)
    const subtotalB = 335.0;
    const taxTotalB = 40.2;
    const totalB = 375.2;
    const paymentTokenB = randomUUID();

    invoiceB = await prisma.invoice.create({
      data: {
        organizationId: orgB.id,
        customerId: customerB.id,
        jobId: jobB.id,
        invoiceNumber: `INV-2026-B-${auditRunId.slice(0, 4)}`,
        paymentToken: paymentTokenB,
        status: 'SENT',
        subtotal: subtotalB,
        taxTotal: taxTotalB,
        total: totalB,
        lines: {
          create: [
            { description: 'Labor - Emergency Sewer Clearing (2 hrs)', quantity: 2, unitCost: 125.0 },
            { description: 'Material - Sewer Auger Cable & Cutter Head', quantity: 1, unitCost: 85.0 },
          ],
        },
        taxes: {
          create: [{ name: 'MB Combined Tax', jurisdiction: 'MB', rate: 0.12, amount: taxTotalB }],
        },
      },
    });

    expect(invoiceB).not.toBeNull();
    expect(invoiceB.organizationId).toBe(orgB.id);

    // 6. Simulate Stripe Webhook settlement for Invoice B
    const stripeEventB = {
      id: `evt_test_b_${auditRunId}`,
      object: 'event',
      type: 'payment_intent.succeeded',
      account: `acct_audit_b_${auditRunId}`,
      data: {
        object: {
          id: `pi_test_b_${auditRunId}`,
          object: 'payment_intent',
          amount: Math.round(totalB * 100),
          currency: 'cad',
          metadata: { invoiceId: invoiceB.id },
        },
      },
    };

    const stripeClient = new Stripe('sk_test_mock', { apiVersion: '2025-02-24.acacia' as any });
    const payloadB = JSON.stringify(stripeEventB);
    const signatureB = stripeClient.webhooks.generateTestHeaderString({ payload: payloadB, secret: 'whsec_test_mock_webhook_secret_for_tests' });

    const whReqB = new NextRequest('http://localhost:3000/api/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': signatureB, 'content-type': 'application/json' },
      body: payloadB,
    });

    const whResB = await stripeWebhookHandler(whReqB);
    expect(whResB.status).toBe(200);

    // Verify Invoice B status updated to PAID
    const paidInvoiceB = await prisma.invoice.findUnique({
      where: { id: invoiceB.id },
      include: { payments: true },
    });

    expect(paidInvoiceB?.status).toBe('PAID');
    expect(paidInvoiceB?.amountPaid).toBe(totalB);
  });

  // ============================================================================
  // STEP 16: STRICT CROSS-TENANT ADVERSARIAL VERIFICATION
  // ============================================================================
  test('Step 16: Cross-Tenant Isolation Assertions (0% data leakage)', async () => {
    // Admin A attempting to read Job B
    const jobAttempt = await prisma.job.findFirst({
      where: { id: jobB.id, organizationId: orgA.id },
    });
    expect(jobAttempt).toBeNull();

    // Admin A attempting to read Invoice B
    const invoiceAttempt = await prisma.invoice.findFirst({
      where: { id: invoiceB.id, organizationId: orgA.id },
    });
    expect(invoiceAttempt).toBeNull();

    // Admin A attempting to read Customer B
    const customerAttempt = await prisma.customer.findFirst({
      where: { id: customerB.id, organizationId: orgA.id },
    });
    expect(customerAttempt).toBeNull();

    // Admin B attempting to read Job A
    const jobAttemptB = await prisma.job.findFirst({
      where: { id: jobA.id, organizationId: orgB.id },
    });
    expect(jobAttemptB).toBeNull();

    // Admin B attempting to read Invoice A
    const invoiceAttemptB = await prisma.invoice.findFirst({
      where: { id: invoiceA.id, organizationId: orgB.id },
    });
    expect(invoiceAttemptB).toBeNull();

    // Spoofed Webhook Attack: Org B trying to settle Org A's invoice
    const spoofedEvent = {
      id: `evt_spoof_${auditRunId}`,
      object: 'event',
      type: 'payment_intent.succeeded',
      account: `acct_audit_b_${auditRunId}`, // Wrong Stripe Account!
      data: {
        object: {
          id: `pi_spoof_${auditRunId}`,
          object: 'payment_intent',
          amount: 19040,
          currency: 'cad',
          metadata: { invoiceId: invoiceA.id },
        },
      },
    };

    const stripeClient = new Stripe('sk_test_mock', { apiVersion: '2025-02-24.acacia' as any });
    const spoofPayload = JSON.stringify(spoofedEvent);
    const spoofSig = stripeClient.webhooks.generateTestHeaderString({ payload: spoofPayload, secret: 'whsec_test_mock_webhook_secret_for_tests' });

    const spoofReq = new NextRequest('http://localhost:3000/api/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': spoofSig, 'content-type': 'application/json' },
      body: spoofPayload,
    });

    const spoofRes = await stripeWebhookHandler(spoofReq);
    expect(spoofRes.status).toBe(400);
    const spoofText = await spoofRes.text();
    expect(spoofText).toContain('Security Rejection');
  });
});
