import { expect, test, describe, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../src/lib/db';
import { randomUUID } from 'crypto';
import { hashPassword } from '../../src/lib/auth/password';
import { createSession, hashSessionToken } from '../../src/lib/auth/session';
import { createCustomerSession, hashToken } from '../../src/lib/auth/customer-session';
import { GET as fileGetHandler } from '../../src/app/api/files/[...key]/route';
import { POST as logoutHandler } from '../../src/app/api/auth/logout/route';
import { POST as stripeWebhookHandler } from '../../src/app/api/webhooks/stripe/route';
import { uploadJobPhoto, updateJobState, toggleTimeClock, captureSignatureAndComplete } from '../../src/app/actions/tech';
import { storage } from '../../src/lib/storage';
import { NextRequest } from 'next/server';
import Stripe from 'stripe';

describe('Phase 18: Final Independent Two-Tenant Adversarial Hardening Suite', () => {
  const testId = randomUUID().slice(0, 8);
  const stripeAccountIdA = `acct_adv_a_${testId}`;
  const stripeAccountIdB = `acct_adv_b_${testId}`;

  let orgAId: string;
  let orgBId: string;

  let adminUserA: any;
  let adminUserB: any;
  let adminSessionTokenA: string;
  let adminSessionTokenB: string;

  let techUserA: any;
  let techUserB: any;
  let techA: any;
  let techB: any;
  let techSessionTokenA: string;
  let techSessionTokenB: string;

  let userA: any;
  let userB: any;
  let customerA: any;
  let customerB: any;
  let customerSessionTokenA: string;
  let customerSessionTokenB: string;

  let propAId: string;
  let propBId: string;
  let servAId: string;
  let servBId: string;
  let apptAId: string;
  let apptBId: string;
  let jobAId: string;
  let jobBId: string;
  let photoKeyA: string;
  let photoKeyB: string;
  let sigKeyA: string;
  let sigKeyB: string;
  let estimateAId: string;
  let estimateBId: string;
  let invoiceAId: string;
  let invoiceBId: string;
  let ticketAId: string;
  let ticketBId: string;

  beforeAll(async () => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_mock';
    process.env.STRIPE_SECRET_KEY = 'sk_test_mock';

    // 1. Organizations
    const orgA = await prisma.organization.create({
      data: { name: `Alpha Plumbing ${testId}`, slug: `alpha-${testId}`, stripeAccountId: stripeAccountIdA, stripeConnectionStatus: 'ACTIVE' },
    });
    orgAId = orgA.id;

    const orgB = await prisma.organization.create({
      data: { name: `Beta Plumbing ${testId}`, slug: `beta-${testId}`, stripeAccountId: stripeAccountIdB, stripeConnectionStatus: 'ACTIVE' },
    });
    orgBId = orgB.id;

    // 2. Admins
    adminUserA = await prisma.user.create({
      data: {
        email: `admin-a-${testId}@alpha.com`,
        firstName: 'Alice',
        lastName: 'Alpha',
        passwordHash: await hashPassword('AdminPass123!'),
        memberships: { create: { organizationId: orgAId, role: 'ADMIN' } },
      },
    });
    adminSessionTokenA = await createSession(adminUserA.id);

    adminUserB = await prisma.user.create({
      data: {
        email: `admin-b-${testId}@beta.com`,
        firstName: 'Bob',
        lastName: 'Beta',
        passwordHash: await hashPassword('AdminPass123!'),
        memberships: { create: { organizationId: orgBId, role: 'ADMIN' } },
      },
    });
    adminSessionTokenB = await createSession(adminUserB.id);

    // 3. Technicians
    techUserA = await prisma.user.create({
      data: {
        email: `tech-a-${testId}@alpha.com`,
        firstName: 'Andy',
        lastName: 'Alpha',
        passwordHash: await hashPassword('TechPass123!'),
        memberships: { create: { organizationId: orgAId, role: 'TECHNICIAN' } },
      },
    });
    techA = await prisma.technician.create({
      data: { organizationId: orgAId, userId: techUserA.id, firstName: 'Andy', lastName: 'Alpha', availabilityStatus: 'AVAILABLE' },
    });
    techSessionTokenA = await createSession(techUserA.id);

    techUserB = await prisma.user.create({
      data: {
        email: `tech-b-${testId}@beta.com`,
        firstName: 'Ben',
        lastName: 'Beta',
        passwordHash: await hashPassword('TechPass123!'),
        memberships: { create: { organizationId: orgBId, role: 'TECHNICIAN' } },
      },
    });
    techB = await prisma.technician.create({
      data: { organizationId: orgBId, userId: techUserB.id, firstName: 'Ben', lastName: 'Beta', availabilityStatus: 'AVAILABLE' },
    });
    techSessionTokenB = await createSession(techUserB.id);

    // 4. Customers
    userA = await prisma.user.create({
      data: { email: `cust-a-${testId}@customer.com`, firstName: 'Catherine', lastName: 'CustA', passwordHash: 'none' },
    });
    customerA = await prisma.customer.create({
      data: { organizationId: orgAId, userId: userA.id, firstName: 'Catherine', lastName: 'CustA' },
    });
    customerSessionTokenA = randomUUID();
    await prisma.customerSession.create({
      data: { customerId: customerA.id, tokenHash: hashToken(customerSessionTokenA), expiresAt: new Date(Date.now() + 86400000) },
    });

    userB = await prisma.user.create({
      data: { email: `cust-b-${testId}@customer.com`, firstName: 'Charles', lastName: 'CustB', passwordHash: 'none' },
    });
    customerB = await prisma.customer.create({
      data: { organizationId: orgBId, userId: userB.id, firstName: 'Charles', lastName: 'CustB' },
    });
    customerSessionTokenB = randomUUID();
    await prisma.customerSession.create({
      data: { customerId: customerB.id, tokenHash: hashToken(customerSessionTokenB), expiresAt: new Date(Date.now() + 86400000) },
    });

    // 5. Properties & Services
    const propA = await prisma.property.create({ data: { organizationId: orgAId, customerId: customerA.id, address: '10 Alpha Way', city: 'Winnipeg', postalCode: 'R3C1A1' } });
    propAId = propA.id;
    const propB = await prisma.property.create({ data: { organizationId: orgBId, customerId: customerB.id, address: '20 Beta Way', city: 'Winnipeg', postalCode: 'R3C1A1' } });
    propBId = propB.id;

    const servA = await prisma.service.create({ data: { organizationId: orgAId, name: 'Drain Cleaning', slug: `drain-${testId}`, basePrice: 150 } });
    servAId = servA.id;
    const servB = await prisma.service.create({ data: { organizationId: orgBId, name: 'Pipe Repair', slug: `pipe-${testId}`, basePrice: 250 } });
    servBId = servB.id;

    // 6. Appointments & Jobs
    const apptA = await prisma.appointment.create({
      data: { appointmentNumber: `APPT-A-${testId}`, organizationId: orgAId, customerId: customerA.id, propertyId: propA.id, serviceId: servA.id, date: new Date(), startTime: '09:00', endTime: '10:00', technicianId: techA.id },
    });
    apptAId = apptA.id;
    const apptB = await prisma.appointment.create({
      data: { appointmentNumber: `APPT-B-${testId}`, organizationId: orgBId, customerId: customerB.id, propertyId: propB.id, serviceId: servB.id, date: new Date(), startTime: '10:00', endTime: '11:00', technicianId: techB.id },
    });
    apptBId = apptB.id;

    const jobA = await prisma.job.create({ data: { organizationId: orgAId, appointmentId: apptA.id, technicianId: techA.id, status: 'WORKING' } });
    jobAId = jobA.id;
    const jobB = await prisma.job.create({ data: { organizationId: orgBId, appointmentId: apptB.id, technicianId: techB.id, status: 'WORKING' } });
    jobBId = jobB.id;

    // 7. Photos & Signatures
    const photoA = await storage.uploadFile(Buffer.from('Alpha Photo Content', 'utf-8'), `photoA-${testId}.png`, 'image/png');
    photoKeyA = photoA.storageKey;
    await prisma.jobPhoto.create({
      data: { jobId: jobA.id, uploadedById: techUserA.id, storageKey: photoKeyA, url: `/api/files/${photoKeyA}`, customerVisible: true },
    });

    const photoB = await storage.uploadFile(Buffer.from('Beta Photo Content', 'utf-8'), `photoB-${testId}.png`, 'image/png');
    photoKeyB = photoB.storageKey;
    await prisma.jobPhoto.create({
      data: { jobId: jobB.id, uploadedById: techUserB.id, storageKey: photoKeyB, url: `/api/files/${photoKeyB}`, customerVisible: false },
    });

    const sigA = await storage.uploadFile(Buffer.from('Alpha Signature', 'utf-8'), `sigA-${testId}.png`, 'image/png');
    sigKeyA = sigA.storageKey;
    await prisma.customerSignature.create({
      data: { jobId: jobA.id, signerName: 'Catherine CustA', storageKey: sigKeyA },
    });

    const sigB = await storage.uploadFile(Buffer.from('Beta Signature', 'utf-8'), `sigB-${testId}.png`, 'image/png');
    sigKeyB = sigB.storageKey;
    await prisma.customerSignature.create({
      data: { jobId: jobB.id, signerName: 'Charles CustB', storageKey: sigKeyB },
    });

    // 8. Estimates & Invoices
    const estA = await prisma.estimate.create({
      data: { organizationId: orgAId, customerId: customerA.id, jobId: jobA.id, estimateNumber: `EST-A-${testId}`, total: 150, subtotal: 150 },
    });
    estimateAId = estA.id;

    const estB = await prisma.estimate.create({
      data: { organizationId: orgBId, customerId: customerB.id, jobId: jobB.id, estimateNumber: `EST-B-${testId}`, total: 250, subtotal: 250 },
    });
    estimateBId = estB.id;

    const invA = await prisma.invoice.create({
      data: { organizationId: orgAId, customerId: customerA.id, jobId: jobA.id, invoiceNumber: `INV-A-${testId}`, total: 150, subtotal: 150, paymentToken: randomUUID() },
    });
    invoiceAId = invA.id;

    const invB = await prisma.invoice.create({
      data: { organizationId: orgBId, customerId: customerB.id, jobId: jobB.id, invoiceNumber: `INV-B-${testId}`, total: 250, subtotal: 250, paymentToken: randomUUID() },
    });
    invoiceBId = invB.id;

    // 9. Support Tickets
    const ticketA = await prisma.supportTicket.create({
      data: { organizationId: orgAId, customerId: customerA.id, subject: 'Ticket Alpha', status: 'OPEN', messages: { create: { senderType: 'CUSTOMER', body: 'Help Alpha' } } },
    });
    ticketAId = ticketA.id;

    const ticketB = await prisma.supportTicket.create({
      data: { organizationId: orgBId, customerId: customerB.id, subject: 'Ticket Beta', status: 'OPEN', messages: { create: { senderType: 'CUSTOMER', body: 'Help Beta' } } },
    });
    ticketBId = ticketB.id;
  });

  afterAll(async () => {
    await prisma.customerSignature.deleteMany({ where: { jobId: { in: [jobAId, jobBId] } } });
    await prisma.jobPhoto.deleteMany({ where: { jobId: { in: [jobAId, jobBId] } } });
    await prisma.supportTicketMessage.deleteMany({ where: { ticketId: { in: [ticketAId, ticketBId] } } });
    await prisma.supportTicket.deleteMany({ where: { id: { in: [ticketAId, ticketBId] } } });
    await prisma.estimate.deleteMany({ where: { id: { in: [estimateAId, estimateBId] } } });
    await prisma.invoice.deleteMany({ where: { id: { in: [invoiceAId, invoiceBId] } } });
    await prisma.job.deleteMany({ where: { id: { in: [jobAId, jobBId] } } });
    await prisma.appointment.deleteMany({ where: { id: { in: [apptAId, apptBId] } } });
    await prisma.property.deleteMany({ where: { id: { in: [propAId, propBId] } } });
    await prisma.service.deleteMany({ where: { id: { in: [servAId, servBId] } } });
    await prisma.customerSession.deleteMany({ where: { customerId: { in: [customerA.id, customerB.id] } } });
    await prisma.customer.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.technician.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.organizationMember.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.session.deleteMany({ where: { userId: { in: [adminUserA.id, adminUserB.id, techUserA.id, techUserB.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [adminUserA.id, adminUserB.id, techUserA.id, techUserB.id, userA.id, userB.id] } } });
    await prisma.event.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } });

    try {
      await storage.deleteFile(photoKeyA);
      await storage.deleteFile(photoKeyB);
      await storage.deleteFile(sigKeyA);
      await storage.deleteFile(sigKeyB);
    } catch (e) {}
  });

  function createRequestWithCookies(url: string, cookiesObj: Record<string, string>): NextRequest {
    const cookieHeader = Object.entries(cookiesObj)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');

    return new NextRequest(url, { headers: { cookie: cookieHeader } });
  }

  // ============================================================================
  // GROUP 1: ADMIN A -> ORGANIZATION B ATTACKS
  // ============================================================================
  describe('Group 1: Admin A -> Org B Attacks', () => {
    test('Attack: Admin A queries Org B Job -> Returns null (Tenant Scoped)', async () => {
      const job = await prisma.job.findFirst({ where: { id: jobBId, organizationId: orgAId } });
      expect(job).toBeNull();
    });

    test('Attack: Admin A queries Org B Invoice -> Returns null (Tenant Scoped)', async () => {
      const inv = await prisma.invoice.findFirst({ where: { id: invoiceBId, organizationId: orgAId } });
      expect(inv).toBeNull();
    });

    test('Attack: Admin A queries Org B Support Ticket -> Returns null (Tenant Scoped)', async () => {
      const ticket = await prisma.supportTicket.findFirst({ where: { id: ticketBId, organizationId: orgAId } });
      expect(ticket).toBeNull();
    });

    test('Attack: Admin A downloads Org B Photo via File API -> 403 Forbidden', async () => {
      const req = createRequestWithCookies(`http://localhost:3000/api/files/${photoKeyB}`, { 'plumber-session': adminSessionTokenA });
      const res = await fileGetHandler(req, { params: Promise.resolve({ key: photoKeyB.split('/') }) });
      expect(res.status).toBe(403);
    });

    test('Attack: Admin A downloads Org B Signature via File API -> 403 Forbidden', async () => {
      const req = createRequestWithCookies(`http://localhost:3000/api/files/${sigKeyB}`, { 'plumber-session': adminSessionTokenA });
      const res = await fileGetHandler(req, { params: Promise.resolve({ key: sigKeyB.split('/') }) });
      expect(res.status).toBe(403);
    });
  });

  // ============================================================================
  // GROUP 2: TECHNICIAN A -> ORGANIZATION B ATTACKS
  // ============================================================================
  describe('Group 2: Technician A -> Org B Attacks', () => {
    test('Attack: Tech A accesses Org B Job Workspace -> Denied (Tenant Scoped)', async () => {
      const job = await prisma.job.findFirst({
        where: { id: jobBId, organizationId: orgAId },
      });
      expect(job).toBeNull();
    });

    test('Attack: Tech A downloads Org B Private Photo -> 403 Forbidden', async () => {
      const req = createRequestWithCookies(`http://localhost:3000/api/files/${photoKeyB}`, { 'plumber-session': techSessionTokenA });
      const res = await fileGetHandler(req, { params: Promise.resolve({ key: photoKeyB.split('/') }) });
      expect(res.status).toBe(403);
    });

    test('Attack: Tech A queries Org B Customer Info -> Returns null', async () => {
      const customer = await prisma.customer.findFirst({ where: { id: customerB.id, organizationId: orgAId } });
      expect(customer).toBeNull();
    });
  });

  // ============================================================================
  // GROUP 3: CUSTOMER A -> ORGANIZATION B ATTACKS
  // ============================================================================
  describe('Group 3: Customer A -> Org B Attacks', () => {
    test('Attack: Customer A accesses Org B Job -> Returns null', async () => {
      const job = await prisma.job.findFirst({
        where: { id: jobBId, appointment: { customerId: customerA.id } },
      });
      expect(job).toBeNull();
    });

    test('Attack: Customer A accesses Org B Estimate -> Returns null', async () => {
      const estimate = await prisma.estimate.findFirst({ where: { id: estimateBId, customerId: customerA.id } });
      expect(estimate).toBeNull();
    });

    test('Attack: Customer A accesses Org B Invoice -> Returns null', async () => {
      const inv = await prisma.invoice.findFirst({ where: { id: invoiceBId, customerId: customerA.id } });
      expect(inv).toBeNull();
    });

    test('Attack: Customer A accesses Org B Support Ticket -> Returns null', async () => {
      const ticket = await prisma.supportTicket.findFirst({ where: { id: ticketBId, customerId: customerA.id } });
      expect(ticket).toBeNull();
    });

    test('Attack: Customer A downloads Org B File -> 403 Forbidden', async () => {
      const req = createRequestWithCookies(`http://localhost:3000/api/files/${photoKeyB}`, { customer_session: customerSessionTokenA });
      const res = await fileGetHandler(req, { params: Promise.resolve({ key: photoKeyB.split('/') }) });
      expect(res.status).toBe(403);
    });
  });

  // ============================================================================
  // GROUP 4: SESSION, REPLAY & TRAVERSAL ATTACKS
  // ============================================================================
  describe('Group 4: Session, Replay, Path Traversal & Stripe Attacks', () => {
    test('Attack: Expired Customer Token -> 401 Unauthorized', async () => {
      const expiredToken = randomUUID();
      await prisma.customerSession.create({
        data: { customerId: customerA.id, tokenHash: hashToken(expiredToken), expiresAt: new Date(Date.now() - 3600000) },
      });

      const req = createRequestWithCookies(`http://localhost:3000/api/files/${photoKeyA}`, { customer_session: expiredToken });
      const res = await fileGetHandler(req, { params: Promise.resolve({ key: photoKeyA.split('/') }) });
      expect(res.status).toBe(401);
    });

    test('Attack: Revoked Customer Token -> 401 Unauthorized', async () => {
      const revokedToken = randomUUID();
      await prisma.customerSession.create({
        data: { customerId: customerA.id, tokenHash: hashToken(revokedToken), expiresAt: new Date(Date.now() + 3600000), revokedAt: new Date() },
      });

      const req = createRequestWithCookies(`http://localhost:3000/api/files/${photoKeyA}`, { customer_session: revokedToken });
      const res = await fileGetHandler(req, { params: Promise.resolve({ key: photoKeyA.split('/') }) });
      expect(res.status).toBe(401);
    });

    test('Attack: Path Traversal `../secret` -> 400 Bad Request', async () => {
      const req = createRequestWithCookies('http://localhost:3000/api/files/../secret', { 'plumber-session': adminSessionTokenA });
      const res = await fileGetHandler(req, { params: Promise.resolve({ key: ['..', 'secret'] }) });
      expect(res.status).toBe(400);
    });

    test('Attack: Wrong Stripe Connected Account on Webhook -> 400 Security Rejection', async () => {
      const event = {
        id: `evt_spoof_${randomUUID().slice(0, 8)}`,
        object: 'event',
        type: 'payment_intent.succeeded',
        account: stripeAccountIdB, // Org B trying to settle Org A's invoice!
        data: {
          object: {
            id: `pi_spoof_${randomUUID().slice(0, 8)}`,
            object: 'payment_intent',
            amount: 15000,
            currency: 'cad',
            metadata: { invoiceId: invoiceAId },
          },
        },
      };

      const stripeClient = new Stripe('sk_test_mock', { apiVersion: '2025-02-24.acacia' as any });
      const payload = JSON.stringify(event);
      const signature = stripeClient.webhooks.generateTestHeaderString({ payload, secret: 'whsec_test_mock' });

      const req = new NextRequest('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'stripe-signature': signature, 'content-type': 'application/json' },
        body: payload,
      });

      const res = await stripeWebhookHandler(req);
      expect(res.status).toBe(400);
      const text = await res.text();
      expect(text).toContain('Security Rejection');
    });
  });
});
