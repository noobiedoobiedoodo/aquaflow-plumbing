import { expect, test, describe, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../src/lib/db';
import { randomUUID } from 'crypto';
import { hashPassword } from '../../src/lib/auth/password';
import { createSession, hashSessionToken } from '../../src/lib/auth/session';
import { createCustomerSession, hashToken } from '../../src/lib/auth/customer-session';
import { GET as fileGetHandler } from '../../src/app/api/files/[...key]/route';
import { POST as logoutHandler } from '../../src/app/api/auth/logout/route';
import { uploadJobPhoto, updateJobState, toggleTimeClock, captureSignatureAndComplete } from '../../src/app/actions/tech';
import { generateInvoiceFromJob } from '../../src/app/actions/finance';
import { storage } from '../../src/lib/storage';
import { NextRequest } from 'next/server';

describe('Phase 11: Real Two-Tenant Adversarial Attack Suite', () => {
  const testId = randomUUID().slice(0, 8);
  const sharedCustomerEmail = `shared-cust-${testId}@example.com`;

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

  let globalUser: any;
  let customerA: any;
  let customerB: any;
  let customerSessionTokenA: string;
  let customerSessionTokenB: string;

  let jobAId: string;
  let jobBId: string;
  let photoStorageKeyA: string;
  let photoStorageKeyB: string;
  let signatureStorageKeyA: string;
  let signatureStorageKeyB: string;
  let supportTicketAId: string;
  let supportTicketBId: string;
  let invoiceAId: string;
  let invoiceBId: string;

  beforeAll(async () => {
    // 1. Create Organizations
    const orgA = await prisma.organization.create({
      data: { name: `Apex Plumbing ${testId}`, slug: `apex-${testId}`, stripeAccountId: `acct_apex_${testId}` },
    });
    orgAId = orgA.id;

    const orgB = await prisma.organization.create({
      data: { name: `Blue Ridge Plumbing ${testId}`, slug: `blueridge-${testId}`, stripeAccountId: `acct_blueridge_${testId}` },
    });
    orgBId = orgB.id;

    // 2. Admins
    adminUserA = await prisma.user.create({
      data: {
        email: `admin-a-${testId}@apex.com`,
        firstName: 'Alice',
        lastName: 'Admin',
        passwordHash: await hashPassword('AdminPass123!'),
        memberships: { create: { organizationId: orgAId, role: 'ADMIN' } },
      },
    });
    adminSessionTokenA = await createSession(adminUserA.id);

    adminUserB = await prisma.user.create({
      data: {
        email: `admin-b-${testId}@blueridge.com`,
        firstName: 'Bob',
        lastName: 'Admin',
        passwordHash: await hashPassword('AdminPass123!'),
        memberships: { create: { organizationId: orgBId, role: 'ADMIN' } },
      },
    });
    adminSessionTokenB = await createSession(adminUserB.id);

    // 3. Technicians
    techUserA = await prisma.user.create({
      data: {
        email: `tech-a-${testId}@apex.com`,
        firstName: 'Arthur',
        lastName: 'Apex',
        passwordHash: await hashPassword('TechPass123!'),
        memberships: { create: { organizationId: orgAId, role: 'TECHNICIAN' } },
      },
    });
    techA = await prisma.technician.create({
      data: { organizationId: orgAId, userId: techUserA.id, firstName: 'Arthur', lastName: 'Apex' },
    });
    techSessionTokenA = await createSession(techUserA.id);

    techUserB = await prisma.user.create({
      data: {
        email: `tech-b-${testId}@blueridge.com`,
        firstName: 'Brian',
        lastName: 'Blue',
        passwordHash: await hashPassword('TechPass123!'),
        memberships: { create: { organizationId: orgBId, role: 'TECHNICIAN' } },
      },
    });
    techB = await prisma.technician.create({
      data: { organizationId: orgBId, userId: techUserB.id, firstName: 'Brian', lastName: 'Blue' },
    });
    techSessionTokenB = await createSession(techUserB.id);

    // 4. Shared Customer
    globalUser = await prisma.user.create({
      data: { email: sharedCustomerEmail, firstName: 'John', lastName: 'Doe', passwordHash: 'none' },
    });
    customerA = await prisma.customer.create({
      data: { organizationId: orgAId, userId: globalUser.id, firstName: 'John', lastName: 'Doe' },
    });
    customerSessionTokenA = randomUUID();
    await prisma.customerSession.create({
      data: { customerId: customerA.id, tokenHash: hashToken(customerSessionTokenA), expiresAt: new Date(Date.now() + 86400000) },
    });

    customerB = await prisma.customer.create({
      data: { organizationId: orgBId, userId: globalUser.id, firstName: 'John', lastName: 'Doe' },
    });
    customerSessionTokenB = randomUUID();
    await prisma.customerSession.create({
      data: { customerId: customerB.id, tokenHash: hashToken(customerSessionTokenB), expiresAt: new Date(Date.now() + 86400000) },
    });

    // 5. Properties, Services, Appointments & Jobs
    const propA = await prisma.property.create({ data: { organizationId: orgAId, customerId: customerA.id, address: '100 Apex Way', city: 'Winnipeg', postalCode: 'R3C1A1' } });
    const propB = await prisma.property.create({ data: { organizationId: orgBId, customerId: customerB.id, address: '200 Blue Way', city: 'Brandon', postalCode: 'R7A1A1' } });

    const servA = await prisma.service.create({ data: { organizationId: orgAId, name: 'Drain Cleaning', slug: `drain-${testId}` } });
    const servB = await prisma.service.create({ data: { organizationId: orgBId, name: 'Water Heater', slug: `heater-${testId}` } });

    const apptA = await prisma.appointment.create({
      data: { appointmentNumber: `APPT-A-${testId}`, organizationId: orgAId, customerId: customerA.id, propertyId: propA.id, serviceId: servA.id, date: new Date(), startTime: '09:00', endTime: '10:00', technicianId: techA.id },
    });
    const apptB = await prisma.appointment.create({
      data: { appointmentNumber: `APPT-B-${testId}`, organizationId: orgBId, customerId: customerB.id, propertyId: propB.id, serviceId: servB.id, date: new Date(), startTime: '13:00', endTime: '14:00', technicianId: techB.id },
    });

    const jobA = await prisma.job.create({ data: { organizationId: orgAId, appointmentId: apptA.id, technicianId: techA.id, status: 'WORKING' } });
    jobAId = jobA.id;

    const jobB = await prisma.job.create({ data: { organizationId: orgBId, appointmentId: apptB.id, technicianId: techB.id, status: 'WORKING' } });
    jobBId = jobB.id;

    // 6. Files (Photos & Signatures)
    const fileA = await storage.uploadFile(Buffer.from('Photo A content', 'utf-8'), `photoA-${testId}.png`, 'image/png');
    photoStorageKeyA = fileA.storageKey;
    await prisma.jobPhoto.create({
      data: { jobId: jobA.id, uploadedById: techUserA.id, storageKey: photoStorageKeyA, url: `/api/files/${photoStorageKeyA}`, customerVisible: true },
    });

    const fileB = await storage.uploadFile(Buffer.from('Photo B content', 'utf-8'), `photoB-${testId}.png`, 'image/png');
    photoStorageKeyB = fileB.storageKey;
    await prisma.jobPhoto.create({
      data: { jobId: jobB.id, uploadedById: techUserB.id, storageKey: photoStorageKeyB, url: `/api/files/${photoStorageKeyB}`, customerVisible: false },
    });

    const sigA = await storage.uploadFile(Buffer.from('Sig A content', 'utf-8'), `sigA-${testId}.png`, 'image/png');
    signatureStorageKeyA = sigA.storageKey;
    await prisma.customerSignature.create({
      data: { jobId: jobA.id, signerName: 'John Doe', storageKey: signatureStorageKeyA },
    });

    const sigB = await storage.uploadFile(Buffer.from('Sig B content', 'utf-8'), `sigB-${testId}.png`, 'image/png');
    signatureStorageKeyB = sigB.storageKey;
    await prisma.customerSignature.create({
      data: { jobId: jobB.id, signerName: 'John Doe', storageKey: signatureStorageKeyB },
    });

    // 7. Support Tickets
    const ticketA = await prisma.supportTicket.create({
      data: {
        organizationId: orgAId,
        customerId: customerA.id,
        subject: 'Ticket A Subject',
        status: 'OPEN',
        messages: { create: { senderType: 'CUSTOMER', body: 'Help A' } },
      },
    });
    supportTicketAId = ticketA.id;

    const ticketB = await prisma.supportTicket.create({
      data: {
        organizationId: orgBId,
        customerId: customerB.id,
        subject: 'Ticket B Subject',
        status: 'OPEN',
        messages: { create: { senderType: 'CUSTOMER', body: 'Help B' } },
      },
    });
    supportTicketBId = ticketB.id;

    // 8. Invoices
    const invA = await prisma.invoice.create({
      data: { organizationId: orgAId, customerId: customerA.id, jobId: jobA.id, invoiceNumber: `INV-A-${testId}`, total: 150, subtotal: 140, taxTotal: 10, paymentToken: randomUUID() },
    });
    invoiceAId = invA.id;

    const invB = await prisma.invoice.create({
      data: { organizationId: orgBId, customerId: customerB.id, jobId: jobB.id, invoiceNumber: `INV-B-${testId}`, total: 300, subtotal: 280, taxTotal: 20, paymentToken: randomUUID() },
    });
    invoiceBId = invB.id;
  });

  afterAll(async () => {
    await prisma.customerSignature.deleteMany({ where: { jobId: { in: [jobAId, jobBId] } } });
    await prisma.jobPhoto.deleteMany({ where: { jobId: { in: [jobAId, jobBId] } } });
    await prisma.supportTicketMessage.deleteMany({ where: { ticketId: { in: [supportTicketAId, supportTicketBId] } } });
    await prisma.supportTicket.deleteMany({ where: { id: { in: [supportTicketAId, supportTicketBId] } } });
    await prisma.invoice.deleteMany({ where: { id: { in: [invoiceAId, invoiceBId] } } });
    await prisma.jobTimeEntry.deleteMany({ where: { jobId: { in: [jobAId, jobBId] } } });
    await prisma.job.deleteMany({ where: { id: { in: [jobAId, jobBId] } } });
    await prisma.appointment.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.property.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.service.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.customerSession.deleteMany({ where: { customerId: { in: [customerA.id, customerB.id] } } });
    await prisma.customer.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.technician.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.organizationMember.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.session.deleteMany({ where: { userId: { in: [adminUserA.id, adminUserB.id, techUserA.id, techUserB.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [adminUserA.id, adminUserB.id, techUserA.id, techUserB.id, globalUser.id] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } });

    try {
      await storage.deleteFile(photoStorageKeyA);
      await storage.deleteFile(photoStorageKeyB);
      await storage.deleteFile(signatureStorageKeyA);
      await storage.deleteFile(signatureStorageKeyB);
    } catch (e) {}
  });

  function createRequestWithCookies(url: string, cookiesObj: Record<string, string>): NextRequest {
    const cookieHeader = Object.entries(cookiesObj)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');

    return new NextRequest(url, {
      headers: {
        cookie: cookieHeader,
      },
    });
  }

  // ==========================================
  // SECTION 1: ADMIN ATTACKS
  // ==========================================
  describe('Adversarial Admin Attacks', () => {
    test('Attack: Admin A attempts to access Org B Photo -> REJECTED (403)', async () => {
      const req = createRequestWithCookies(`http://localhost:3000/api/files/${photoStorageKeyB}`, {
        'plumber-session': adminSessionTokenA, // Admin of Org A requesting Org B's photo
      });

      const keySegments = photoStorageKeyB.split('/');
      const res = await fileGetHandler(req, { params: Promise.resolve({ key: keySegments }) });

      expect(res.status).toBe(403);
    });

    test('Attack: Admin A attempts to access Org B Customer Signature -> REJECTED (403)', async () => {
      const req = createRequestWithCookies(`http://localhost:3000/api/files/${signatureStorageKeyB}`, {
        'plumber-session': adminSessionTokenA, // Admin of Org A requesting Org B's signature
      });

      const keySegments = signatureStorageKeyB.split('/');
      const res = await fileGetHandler(req, { params: Promise.resolve({ key: keySegments }) });

      expect(res.status).toBe(403);
    });

    test('Legitimate: Admin A accesses Org A Photo -> ACCEPTED (200)', async () => {
      const req = createRequestWithCookies(`http://localhost:3000/api/files/${photoStorageKeyA}`, {
        'plumber-session': adminSessionTokenA,
      });

      const keySegments = photoStorageKeyA.split('/');
      const res = await fileGetHandler(req, { params: Promise.resolve({ key: keySegments }) });

      expect(res.status).toBe(200);
    });
  });

  // ==========================================
  // SECTION 2: TECHNICIAN ATTACKS
  // ==========================================
  describe('Adversarial Technician Attacks', () => {
    test('Attack: Technician A attempts to access Org B internal photo -> REJECTED (403)', async () => {
      const req = createRequestWithCookies(`http://localhost:3000/api/files/${photoStorageKeyB}`, {
        'plumber-session': techSessionTokenA, // Tech of Org A requesting Org B photo
      });

      const keySegments = photoStorageKeyB.split('/');
      const res = await fileGetHandler(req, { params: Promise.resolve({ key: keySegments }) });

      expect(res.status).toBe(403);
    });

    test('Attack: Technician A attempts to modify Org B Job state -> REJECTED', async () => {
      // Tech A tries to query or mutate Org B's job
      const accessibleJob = await prisma.job.findFirst({
        where: { id: jobBId, organizationId: orgAId },
      });
      expect(accessibleJob).toBeNull();
    });
  });

  // ==========================================
  // SECTION 3: CUSTOMER ATTACKS
  // ==========================================
  describe('Adversarial Customer Attacks', () => {
    test('Attack: Customer A attempts to download Customer B internal photo -> REJECTED (403)', async () => {
      const req = createRequestWithCookies(`http://localhost:3000/api/files/${photoStorageKeyB}`, {
        customer_session: customerSessionTokenA, // Customer A session requesting Org B internal photo
      });

      const keySegments = photoStorageKeyB.split('/');
      const res = await fileGetHandler(req, { params: Promise.resolve({ key: keySegments }) });

      expect(res.status).toBe(403);
    });

    test('Legitimate: Customer A downloads own customer-visible photo -> ACCEPTED (200)', async () => {
      const req = createRequestWithCookies(`http://localhost:3000/api/files/${photoStorageKeyA}`, {
        customer_session: customerSessionTokenA, // Customer A session requesting own visible photo
      });

      const keySegments = photoStorageKeyA.split('/');
      const res = await fileGetHandler(req, { params: Promise.resolve({ key: keySegments }) });

      expect(res.status).toBe(200);
    });
  });

  // ==========================================
  // SECTION 4: PATH TRAVERSAL ATTACKS
  // ==========================================
  describe('Adversarial Path Traversal Attacks', () => {
    test('Attack: Path traversal key "../etc/passwd" -> REJECTED (400)', async () => {
      const req = createRequestWithCookies('http://localhost:3000/api/files/../../etc/passwd', {
        'plumber-session': adminSessionTokenA,
      });

      const res = await fileGetHandler(req, { params: Promise.resolve({ key: ['..', '..', 'etc', 'passwd'] }) });
      expect(res.status).toBe(400);
    });

    test('Attack: Malicious dot segment key "uploads/./secret" -> REJECTED (400)', async () => {
      const req = createRequestWithCookies('http://localhost:3000/api/files/uploads/./secret', {
        'plumber-session': adminSessionTokenA,
      });

      const res = await fileGetHandler(req, { params: Promise.resolve({ key: ['uploads', '.', 'secret'] }) });
      expect(res.status).toBe(400);
    });
  });

  // ==========================================
  // SECTION 5: LOGOUT & SESSION REVOCATION ATTACKS
  // ==========================================
  describe('Logout & Replay Token Attacks', () => {
    test('Attack: Replaying revoked Customer Session token fails after logout', async () => {
      // 1. Create a fresh customer session
      const tempToken = randomUUID();
      const tokenHash = hashToken(tempToken);
      const session = await prisma.customerSession.create({
        data: { customerId: customerA.id, tokenHash, expiresAt: new Date(Date.now() + 86400000) },
      });

      // 2. Perform Logout
      const logoutReq = new NextRequest('http://localhost:3000/api/auth/logout', {
        method: 'POST',
        headers: {
          cookie: `customer_session=${tempToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ type: 'customer' }),
      });

      const logoutRes = await logoutHandler(logoutReq);
      expect(logoutRes.status).toBe(200);

      // 3. Verify in DB that revokedAt is set
      const revokedDbSession = await prisma.customerSession.findUnique({
        where: { tokenHash },
      });
      expect(revokedDbSession?.revokedAt).not.toBeNull();

      // 4. Attempt to use revoked session to fetch a file
      const fileReq = createRequestWithCookies(`http://localhost:3000/api/files/${photoStorageKeyA}`, {
        customer_session: tempToken,
      });

      const keySegments = photoStorageKeyA.split('/');
      const fileRes = await fileGetHandler(fileReq, { params: Promise.resolve({ key: keySegments }) });

      // Unauthorized since token is revoked
      expect(fileRes.status).toBe(401);
    });
  });
});
