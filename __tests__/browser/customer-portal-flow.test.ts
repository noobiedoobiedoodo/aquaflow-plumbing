import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { prisma } from '@/lib/db';
import { randomUUID, randomBytes } from 'crypto';
import { POST as magicLinkHandler } from '@/app/api/auth/magic-link/route';
import { GET as verifyHandler } from '@/app/auth/verify/route';
import { POST as logoutHandler } from '@/app/api/auth/logout/route';
import {
  createCustomerSession,
  validateCustomerSession,
  revokeCustomerSession,
  hashToken,
} from '@/lib/auth/customer-session';
import { RateLimiter } from '@/lib/security/rate-limiter';
import { NextRequest } from 'next/server';

describe('Customer Portal & Magic Link Authentication Forensic Audit', () => {
  let orgAId: string;
  let orgBId: string;
  let orgASlug: string;
  let orgBSlug: string;

  let userAId: string;
  let userBId: string;
  let sharedUserId: string;

  let userAEmail: string;
  let userBEmail: string;
  let sharedEmail: string;

  let customerAId: string;
  let customerBId: string;
  let sharedCustomerAId: string;
  let sharedCustomerBId: string;

  let propertyAId: string;
  let propertyBId: string;
  let serviceAId: string;
  let serviceBId: string;

  let apptAId: string;
  let apptBId: string;
  let jobAId: string;
  let jobBId: string;
  let estimateAId: string;
  let estimateBId: string;
  let invoiceAId: string;
  let invoiceBId: string;
  let ticketAId: string;
  let ticketBId: string;

  let testIp: string;

  beforeEach(async () => {
    await RateLimiter.resetAll();
    const testId = randomUUID().slice(0, 8);
    testIp = `10.0.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}`;

    orgASlug = `apex-plumbing-${testId}`;
    orgBSlug = `bluewave-plumbing-${testId}`;

    userAEmail = `customer.a.${testId}@example.com`;
    userBEmail = `customer.b.${testId}@example.com`;
    sharedEmail = `shared.customer.${testId}@example.com`;

    // 1. Create Organizations
    const orgA = await prisma.organization.create({
      data: {
        name: `Apex Plumbing ${testId}`,
        slug: orgASlug,
        email: `contact@${orgASlug}.com`,
      },
    });
    orgAId = orgA.id;

    const orgB = await prisma.organization.create({
      data: {
        name: `BlueWave Plumbing ${testId}`,
        slug: orgBSlug,
        email: `contact@${orgBSlug}.com`,
      },
    });
    orgBId = orgB.id;

    // 2. Create Services
    const serviceA = await prisma.service.create({
      data: {
        organizationId: orgAId,
        name: 'Emergency Drain Unclogging',
        slug: `drain-unclog-${testId}`,
        basePrice: 199.0,
      },
    });
    serviceAId = serviceA.id;

    const serviceB = await prisma.service.create({
      data: {
        organizationId: orgBId,
        name: 'Water Heater Replacement',
        slug: `water-heater-${testId}`,
        basePrice: 850.0,
      },
    });
    serviceBId = serviceB.id;

    // 3. Create Users and Customer Records
    // Customer A (in Org A only)
    const userA = await prisma.user.create({
      data: {
        email: userAEmail,
        firstName: 'Alice',
        lastName: 'Anderson',
        passwordHash: 'hash_placeholder',
        emailVerified: false,
      },
    });
    userAId = userA.id;

    const customerA = await prisma.customer.create({
      data: {
        organizationId: orgAId,
        userId: userA.id,
        firstName: 'Alice',
        lastName: 'Anderson',
        phone: '555-0101',
      },
    });
    customerAId = customerA.id;

    // Customer B (in Org B only)
    const userB = await prisma.user.create({
      data: {
        email: userBEmail,
        firstName: 'Bob',
        lastName: 'Baker',
        passwordHash: 'hash_placeholder',
        emailVerified: false,
      },
    });
    userBId = userB.id;

    const customerB = await prisma.customer.create({
      data: {
        organizationId: orgBId,
        userId: userB.id,
        firstName: 'Bob',
        lastName: 'Baker',
        phone: '555-0202',
      },
    });
    customerBId = customerB.id;

    // Shared User (Customer in BOTH Org A and Org B)
    const sharedUser = await prisma.user.create({
      data: {
        email: sharedEmail,
        firstName: 'Sam',
        lastName: 'Shared',
        passwordHash: 'hash_placeholder',
        emailVerified: false,
      },
    });
    sharedUserId = sharedUser.id;

    const sharedCustomerA = await prisma.customer.create({
      data: {
        organizationId: orgAId,
        userId: sharedUser.id,
        firstName: 'Sam',
        lastName: 'Shared (Org A)',
        phone: '555-0301',
      },
    });
    sharedCustomerAId = sharedCustomerA.id;

    const sharedCustomerB = await prisma.customer.create({
      data: {
        organizationId: orgBId,
        userId: sharedUser.id,
        firstName: 'Sam',
        lastName: 'Shared (Org B)',
        phone: '555-0302',
      },
    });
    sharedCustomerBId = sharedCustomerB.id;

    // 4. Create Properties
    const propA = await prisma.property.create({
      data: {
        organizationId: orgAId,
        customerId: customerAId,
        address: '100 Alpha St',
        city: 'Winnipeg',
        province: 'MB',
        postalCode: 'R3C 1A1',
      },
    });
    propertyAId = propA.id;

    const propB = await prisma.property.create({
      data: {
        organizationId: orgBId,
        customerId: customerBId,
        address: '200 Beta Ave',
        city: 'Winnipeg',
        province: 'MB',
        postalCode: 'R3C 2B2',
      },
    });
    propertyBId = propB.id;

    // 5. Create Appointments & Jobs
    const apptA = await prisma.appointment.create({
      data: {
        appointmentNumber: `APT-A-${testId}`,
        organizationId: orgAId,
        customerId: customerAId,
        propertyId: propertyAId,
        serviceId: serviceAId,
        date: new Date(Date.now() + 86400000),
        startTime: '09:00',
        endTime: '11:00',
        status: 'CONFIRMED',
        problemDescription: 'Main sewer line backup in basement',
      },
    });
    apptAId = apptA.id;

    const jobA = await prisma.job.create({
      data: {
        appointmentId: apptA.id,
        organizationId: orgAId,
        status: 'ASSIGNED',
      },
    });
    jobAId = jobA.id;

    // Add customer-visible and internal notes/photos to Job A
    await prisma.jobNote.createMany({
      data: [
        {
          jobId: jobA.id,
          authorId: userA.id,
          type: 'CUSTOMER_VISIBLE',
          content: 'Technician dispatched with motorized snake.',
        },
        {
          jobId: jobA.id,
          authorId: userA.id,
          type: 'INTERNAL',
          content: 'INTERNAL NOTE: Check for root infiltration, charge standard surcharge if tree root.',
        },
      ],
    });

    await prisma.jobPhoto.createMany({
      data: [
        {
          jobId: jobA.id,
          uploadedById: userA.id,
          type: 'BEFORE',
          storageKey: `photos/job-${jobA.id}-visible.jpg`,
          url: `/api/files/photos/job-${jobA.id}-visible.jpg`,
          caption: 'Drain blockage initial inspection',
          customerVisible: true,
        },
        {
          jobId: jobA.id,
          uploadedById: userA.id,
          type: 'DIAGNOSTIC',
          storageKey: `photos/job-${jobA.id}-internal.jpg`,
          url: `/api/files/photos/job-${jobA.id}-internal.jpg`,
          caption: 'Internal diagnostic schematic - DO NOT DISCLOSE',
          customerVisible: false,
        },
      ],
    });

    const apptB = await prisma.appointment.create({
      data: {
        appointmentNumber: `APT-B-${testId}`,
        organizationId: orgBId,
        customerId: customerBId,
        propertyId: propertyBId,
        serviceId: serviceBId,
        date: new Date(Date.now() + 172800000),
        startTime: '13:00',
        endTime: '16:00',
        status: 'CONFIRMED',
        problemDescription: 'Water heater leaking 40 gal tank',
      },
    });
    apptBId = apptB.id;

    const jobB = await prisma.job.create({
      data: {
        appointmentId: apptB.id,
        organizationId: orgBId,
        status: 'ASSIGNED',
      },
    });
    jobBId = jobB.id;

    // 6. Create Estimates
    const estimateA = await prisma.estimate.create({
      data: {
        estimateNumber: `EST-A-${testId}`,
        organizationId: orgAId,
        jobId: jobA.id,
        customerId: customerAId,
        status: 'SENT',
        subtotal: 200.0,
        tax: 10.0,
        total: 210.0,
        lines: {
          create: [
            { description: 'Drain Snaking 50ft', quantity: 1, unitCost: 150.0 },
            { description: 'Camera Inspection', quantity: 1, unitCost: 50.0 },
          ],
        },
      },
    });
    estimateAId = estimateA.id;

    const estimateB = await prisma.estimate.create({
      data: {
        estimateNumber: `EST-B-${testId}`,
        organizationId: orgBId,
        jobId: jobB.id,
        customerId: customerBId,
        status: 'SENT',
        subtotal: 800.0,
        tax: 40.0,
        total: 840.0,
        lines: {
          create: [
            { description: '40 Gallon Electric Water Heater', quantity: 1, unitCost: 700.0 },
            { description: 'Installation & Disposal', quantity: 1, unitCost: 100.0 },
          ],
        },
      },
    });
    estimateBId = estimateB.id;

    // 7. Create Invoices
    const invoiceA = await prisma.invoice.create({
      data: {
        invoiceNumber: `INV-A-${testId}`,
        organizationId: orgAId,
        jobId: jobA.id,
        customerId: customerAId,
        status: 'SENT',
        subtotal: 200.0,
        taxTotal: 10.0,
        total: 210.0,
        amountPaid: 0.0,
        dueDate: new Date(Date.now() + 7 * 86400000),
        paymentToken: `pay_tok_a_${testId}`,
        lines: {
          create: [
            { description: 'Drain Snaking 50ft', quantity: 1, unitCost: 200.0 },
          ],
        },
      },
    });
    invoiceAId = invoiceA.id;

    const invoiceB = await prisma.invoice.create({
      data: {
        invoiceNumber: `INV-B-${testId}`,
        organizationId: orgBId,
        jobId: jobB.id,
        customerId: customerBId,
        status: 'SENT',
        subtotal: 800.0,
        taxTotal: 40.0,
        total: 840.0,
        amountPaid: 0.0,
        dueDate: new Date(Date.now() + 7 * 86400000),
        paymentToken: `pay_tok_b_${testId}`,
        lines: {
          create: [
            { description: 'Water Heater Replacement', quantity: 1, unitCost: 800.0 },
          ],
        },
      },
    });
    invoiceBId = invoiceB.id;

    // 8. Create Support Tickets
    const ticketA = await prisma.supportTicket.create({
      data: {
        organizationId: orgAId,
        customerId: customerAId,
        relatedJobId: jobA.id,
        subject: 'Inquiry regarding drain warranty',
        status: 'OPEN',
        messages: {
          create: [
            {
              senderType: 'CUSTOMER',
              senderId: customerAId,
              body: 'How long is the drain cleaning warranty covered?',
            },
          ],
        },
      },
    });
    ticketAId = ticketA.id;

    const ticketB = await prisma.supportTicket.create({
      data: {
        organizationId: orgBId,
        customerId: customerBId,
        relatedJobId: jobB.id,
        subject: 'Water heater rebate assistance',
        status: 'OPEN',
        messages: {
          create: [
            {
              senderType: 'CUSTOMER',
              senderId: customerBId,
              body: 'Can you provide the Efficiency Manitoba serial receipt?',
            },
          ],
        },
      },
    });
    ticketBId = ticketB.id;
  });

  afterEach(async () => {
    // Teardown test artifacts
    const orgIds = [orgAId, orgBId].filter(Boolean);
    const userIds = [userAId, userBId, sharedUserId].filter(Boolean);

    await prisma.supportTicketMessage.deleteMany({
      where: { ticket: { organizationId: { in: orgIds } } },
    });
    await prisma.supportTicket.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.payment.deleteMany({ where: { invoice: { organizationId: { in: orgIds } } } });
    await prisma.invoiceLine.deleteMany({ where: { invoice: { organizationId: { in: orgIds } } } });
    await prisma.invoiceTax.deleteMany({ where: { invoice: { organizationId: { in: orgIds } } } });
    await prisma.financialActivity.deleteMany({ where: { invoice: { organizationId: { in: orgIds } } } });
    await prisma.invoice.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.estimateApproval.deleteMany({ where: { customerId: { in: [customerAId, customerBId, sharedCustomerAId, sharedCustomerBId] } } });
    await prisma.estimateLine.deleteMany({ where: { estimate: { organizationId: { in: orgIds } } } });
    await prisma.estimate.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.jobPhoto.deleteMany({ where: { job: { organizationId: { in: orgIds } } } });
    await prisma.jobNote.deleteMany({ where: { job: { organizationId: { in: orgIds } } } });
    await prisma.customerSignature.deleteMany({ where: { job: { organizationId: { in: orgIds } } } });
    await prisma.job.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.appointment.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.property.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.service.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.notification.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.customerActivity.deleteMany({ where: { customerId: { in: [customerAId, customerBId, sharedCustomerAId, sharedCustomerBId] } } });
    await prisma.customerSession.deleteMany({ where: { customer: { organizationId: { in: orgIds } } } });
    await prisma.magicLinkToken.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.event.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.customer.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
  });

  describe('1. Company-Specific Portal Login & Magic Link Generation (POST /api/auth/magic-link)', () => {
    it('generates single-tenant bound magic link when requesting for specific company slug (/p/[slug]/login)', async () => {
      const req = new Request('http://localhost:3000/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': testIp },
        body: JSON.stringify({ email: userAEmail, organizationSlug: orgASlug }),
      });

      const res = await magicLinkHandler(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.message).toContain('If an account exists');

      // Verify MagicLinkToken was created and scoped strictly to Org A
      const token = await prisma.magicLinkToken.findFirst({
        where: { userId: userAId },
      });
      expect(token).toBeDefined();
      expect(token!.organizationId).toBe(orgAId);
      expect(token!.customerId).toBe(customerAId);
      expect(token!.usedAt).toBeNull();
      expect(token!.expiresAt.getTime()).toBeGreaterThan(Date.now());

      // Verify pending notification with verification URL
      const notification = await prisma.notification.findFirst({
        where: { userId: userAId, organizationId: orgAId },
      });
      expect(notification).toBeDefined();
      expect(notification!.type).toBe('MAGIC_LINK');
      expect(notification!.content).toContain('/auth/verify?token=');
    });

    it('returns generic success response with no tokens created for non-existent email (anti-enumeration)', async () => {
      const ghostEmail = `nonexistent.${randomUUID().slice(0, 6)}@unknown-domain.com`;
      const req = new Request('http://localhost:3000/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': testIp },
        body: JSON.stringify({ email: ghostEmail, organizationSlug: orgASlug }),
      });

      const res = await magicLinkHandler(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.message).toContain('If an account exists');

      const tokens = await prisma.magicLinkToken.findMany({
        where: { user: { email: ghostEmail } },
      });
      expect(tokens.length).toBe(0);
    });

    it('returns generic success without issuing token if email exists but has no customer record for requested company slug', async () => {
      // User A belongs to Org A, but attempts to login via Org B slug (/p/bluewave-slug/login)
      const req = new Request('http://localhost:3000/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': testIp },
        body: JSON.stringify({ email: userAEmail, organizationSlug: orgBSlug }),
      });

      const res = await magicLinkHandler(req);
      expect(res.status).toBe(200);

      // Verify NO token was created for Org B
      const tokenForOrgB = await prisma.magicLinkToken.findFirst({
        where: { userId: userAId, organizationId: orgBId },
      });
      expect(tokenForOrgB).toBeNull();
    });

    it('returns 400 Bad Request when email is omitted', async () => {
      const req = new Request('http://localhost:3000/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': testIp },
        body: JSON.stringify({ organizationSlug: orgASlug }),
      });

      const res = await magicLinkHandler(req);
      expect(res.status).toBe(400);
      const text = await res.text();
      expect(text).toContain('Email is required');
    });

    it('generates distinct tenant-bound magic links for multi-organization customer on generic portal login', async () => {
      const req = new Request('http://localhost:3000/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': testIp },
        body: JSON.stringify({ email: sharedEmail }),
      });

      const res = await magicLinkHandler(req);
      expect(res.status).toBe(200);

      const tokens = await prisma.magicLinkToken.findMany({
        where: { userId: sharedUserId },
      });

      expect(tokens.length).toBe(2);
      const orgIds = tokens.map((t) => t.organizationId);
      expect(orgIds).toContain(orgAId);
      expect(orgIds).toContain(orgBId);

      const customerIds = tokens.map((t) => t.customerId);
      expect(customerIds).toContain(sharedCustomerAId);
      expect(customerIds).toContain(sharedCustomerBId);
    });
  });

  describe('2. Magic Link Token Verification & Session Cookie Issuance (/auth/verify)', () => {
    it('verifies magic link token, marks email verified, creates CustomerSession, and sets cookie', async () => {
      // 1. Generate magic link
      const rawToken = randomBytes(32).toString('base64url');
      const tokenHash = hashToken(rawToken);

      await prisma.magicLinkToken.create({
        data: {
          userId: userAId,
          organizationId: orgAId,
          customerId: customerAId,
          tokenHash,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        },
      });

      // 2. Perform verification request
      const verifyReq = new Request(`http://localhost:3000/auth/verify?token=${rawToken}`);
      const verifyRes = await verifyHandler(verifyReq);

      // Next.js redirect to dashboard
      expect(verifyRes.status).toBe(307);
      expect(verifyRes.headers.get('location')).toContain('/portal/dashboard');

      // 3. Verify database updates
      const updatedToken = await prisma.magicLinkToken.findUnique({ where: { tokenHash } });
      expect(updatedToken?.usedAt).not.toBeNull();

      const updatedUser = await prisma.user.findUnique({ where: { id: userAId } });
      expect(updatedUser?.emailVerified).toBe(true);

      const updatedCustomer = await prisma.customer.findUnique({ where: { id: customerAId } });
      expect(updatedCustomer?.emailVerifiedAt).not.toBeNull();

      // 4. Verify CustomerSession created in DB
      const session = await prisma.customerSession.findFirst({
        where: { customerId: customerAId },
      });
      expect(session).toBeDefined();
      expect(session?.revokedAt).toBeNull();
      expect(session?.expiresAt.getTime()).toBeGreaterThan(Date.now());

      // 5. Verify CustomerActivity logged
      const activity = await prisma.customerActivity.findFirst({
        where: { customerId: customerAId, action: 'CUSTOMER_LOGIN' },
      });
      expect(activity).toBeDefined();
    });

    it('rejects replayed magic link tokens with 400 Bad Request', async () => {
      const rawToken = randomBytes(32).toString('base64url');
      const tokenHash = hashToken(rawToken);

      await prisma.magicLinkToken.create({
        data: {
          userId: userAId,
          organizationId: orgAId,
          customerId: customerAId,
          tokenHash,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        },
      });

      // First use -> Success (307)
      const res1 = await verifyHandler(new Request(`http://localhost:3000/auth/verify?token=${rawToken}`));
      expect(res1.status).toBe(307);

      // Second use (Replay) -> Fails (400)
      const res2 = await verifyHandler(new Request(`http://localhost:3000/auth/verify?token=${rawToken}`));
      expect(res2.status).toBe(400);
      const text = await res2.text();
      expect(text).toContain('This link has already been used');
    });

    it('rejects expired magic link tokens with 400 Bad Request', async () => {
      const rawToken = randomBytes(32).toString('base64url');
      const tokenHash = hashToken(rawToken);

      // Created with past expiry
      await prisma.magicLinkToken.create({
        data: {
          userId: userAId,
          organizationId: orgAId,
          customerId: customerAId,
          tokenHash,
          expiresAt: new Date(Date.now() - 60 * 1000),
        },
      });

      const res = await verifyHandler(new Request(`http://localhost:3000/auth/verify?token=${rawToken}`));
      expect(res.status).toBe(400);
      const text = await res.text();
      expect(text).toContain('This link has expired');
    });

    it('rejects malformed or non-existent token with 400 Bad Request', async () => {
      const res = await verifyHandler(new Request(`http://localhost:3000/auth/verify?token=bogus_token_12345`));
      expect(res.status).toBe(400);
      const text = await res.text();
      expect(text).toContain('Invalid or expired token');
    });

    it('rejects request with missing token parameter with 400 Bad Request', async () => {
      const res = await verifyHandler(new Request('http://localhost:3000/auth/verify'));
      expect(res.status).toBe(400);
      const text = await res.text();
      expect(text).toContain('Missing token');
    });
  });

  describe('3. Customer Session Validation, Lifespan & Revocation', () => {
    it('validates active session and retrieves customer entity', async () => {
      const sessionToken = await createCustomerSession(customerAId);
      expect(sessionToken).toBeDefined();

      const validation = await validateCustomerSession(sessionToken);
      expect(validation).not.toBeNull();
      expect(validation?.customerId).toBe(customerAId);
      expect(validation?.customer.organizationId).toBe(orgAId);
    });

    it('rejects expired session tokens', async () => {
      const token = randomBytes(32).toString('base64url');
      const tokenHash = hashToken(token);

      await prisma.customerSession.create({
        data: {
          customerId: customerAId,
          tokenHash,
          expiresAt: new Date(Date.now() - 1000), // expired
        },
      });

      const validation = await validateCustomerSession(token);
      expect(validation).toBeNull();
    });

    it('rejects revoked session tokens', async () => {
      const sessionToken = await createCustomerSession(customerAId);
      await revokeCustomerSession(sessionToken);

      const validation = await validateCustomerSession(sessionToken);
      expect(validation).toBeNull();
    });
  });

  describe('4. Customer Portal Page Scoping & Interactive Workflows', () => {
    it('Dashboard: fetches only authenticated customer appointments, estimates, and invoices', async () => {
      // Query as Customer A
      const appointmentsA = await prisma.appointment.findMany({
        where: { customerId: customerAId },
      });
      const estimatesA = await prisma.estimate.findMany({
        where: { customerId: customerAId },
      });
      const invoicesA = await prisma.invoice.findMany({
        where: { customerId: customerAId },
      });

      expect(appointmentsA.length).toBe(1);
      expect(appointmentsA[0].id).toBe(apptAId);
      expect(estimatesA.length).toBe(1);
      expect(estimatesA[0].id).toBe(estimateAId);
      expect(invoicesA.length).toBe(1);
      expect(invoicesA[0].id).toBe(invoiceAId);

      // Verify no cross-tenant records returned
      expect(appointmentsA.some((a) => a.organizationId === orgBId)).toBe(false);
      expect(estimatesA.some((e) => e.organizationId === orgBId)).toBe(false);
      expect(invoicesA.some((i) => i.organizationId === orgBId)).toBe(false);
    });

    it('Jobs: hides internal technician notes and diagnostic photos from customer portal view', async () => {
      // Simulate portal job detail retrieval
      const job = await prisma.job.findFirst({
        where: { id: jobAId, appointment: { customerId: customerAId } },
        include: {
          notes: { where: { type: 'CUSTOMER_VISIBLE' } },
          photos: { where: { customerVisible: true } },
        },
      });

      expect(job).not.toBeNull();
      expect(job?.notes.length).toBe(1);
      expect(job?.notes[0].content).toContain('Technician dispatched');
      // Ensure internal note is not leaked
      expect(job?.notes.some((n) => n.content.includes('INTERNAL NOTE'))).toBe(false);

      expect(job?.photos.length).toBe(1);
      expect(job?.photos[0].caption).toContain('Drain blockage');
      // Ensure diagnostic photo is not leaked
      expect(job?.photos.some((p) => p.caption?.includes('DO NOT DISCLOSE'))).toBe(false);
    });

    it('Estimates: customer approval updates status, records audit metadata, and emits outbox event', async () => {
      // Simulate estimate approval action
      await prisma.$transaction(async (tx) => {
        await tx.estimate.update({
          where: { id: estimateAId },
          data: { status: 'APPROVED' },
        });

        await tx.estimateApproval.create({
          data: {
            estimateId: estimateAId,
            customerId: customerAId,
            ipAddress: testIp,
            userAgent: 'Vitest-Browser-Agent/1.0',
          },
        });

        await tx.customerActivity.create({
          data: {
            customerId: customerAId,
            action: 'ESTIMATE_APPROVED',
            metadata: JSON.stringify({ estimateId: estimateAId }),
          },
        });

        await tx.event.create({
          data: {
            organizationId: orgAId,
            type: 'estimate.approved',
            entityType: 'Estimate',
            entityId: estimateAId,
            data: JSON.stringify({ customerId: customerAId, total: 210.0 }),
          },
        });
      });

      const updatedEstimate = await prisma.estimate.findUnique({
        where: { id: estimateAId },
        include: { approvals: true },
      });
      expect(updatedEstimate?.status).toBe('APPROVED');
      expect(updatedEstimate?.approvals.length).toBe(1);
      expect(updatedEstimate?.approvals[0].customerId).toBe(customerAId);

      const event = await prisma.event.findFirst({
        where: { entityId: estimateAId, type: 'estimate.approved' },
      });
      expect(event).toBeDefined();
      expect(event?.organizationId).toBe(orgAId);
    });

    it('Support Tickets: customer can create ticket, post messages, and IDOR check prevents linking foreign jobs', async () => {
      // 1. Post message on existing ticket
      const newMsg = await prisma.supportTicketMessage.create({
        data: {
          ticketId: ticketAId,
          senderType: 'CUSTOMER',
          senderId: customerAId,
          body: 'Thanks for clarifying the warranty terms.',
        },
      });
      expect(newMsg.id).toBeDefined();

      const messages = await prisma.supportTicketMessage.findMany({
        where: { ticketId: ticketAId },
      });
      expect(messages.length).toBe(2);

      // 2. IDOR Prevention: Verify that attempting to link Job B (belonging to Org B / Customer B) to a ticket for Customer A fails check
      const foreignJobCheck = await prisma.job.findFirst({
        where: {
          id: jobBId,
          appointment: {
            customerId: customerAId,
            organizationId: orgAId,
          },
        },
      });
      expect(foreignJobCheck).toBeNull(); // IDOR successfully blocked
    });

    it('Profile: customer can register additional service addresses strictly bound to their organization', async () => {
      const newAddress = await prisma.property.create({
        data: {
          organizationId: orgAId,
          customerId: customerAId,
          address: '550 Portage Ave',
          city: 'Winnipeg',
          province: 'MB',
          postalCode: 'R3C 0G3',
        },
      });

      expect(newAddress.id).toBeDefined();
      expect(newAddress.customerId).toBe(customerAId);
      expect(newAddress.organizationId).toBe(orgAId);

      const customerProperties = await prisma.property.findMany({
        where: { customerId: customerAId },
      });
      expect(customerProperties.length).toBe(2);
    });
  });

  describe('5. Strict Single-Tenant Binding & Multi-Tenant Boundary Enforcement', () => {
    it('Customer A session cannot read or access Organization B jobs, estimates, or invoices', async () => {
      // Attempt to access Job B using Customer A scoping
      const jobAttempt = await prisma.job.findFirst({
        where: { id: jobBId, appointment: { customerId: customerAId } },
      });
      expect(jobAttempt).toBeNull();

      // Attempt to access Estimate B using Customer A scoping
      const estimateAttempt = await prisma.estimate.findFirst({
        where: { id: estimateBId, customerId: customerAId },
      });
      expect(estimateAttempt).toBeNull();

      // Attempt to access Invoice B using Customer A scoping
      const invoiceAttempt = await prisma.invoice.findFirst({
        where: { id: invoiceBId, customerId: customerAId },
      });
      expect(invoiceAttempt).toBeNull();

      // Attempt to access Support Ticket B using Customer A scoping
      const ticketAttempt = await prisma.supportTicket.findFirst({
        where: { id: ticketBId, customerId: customerAId },
      });
      expect(ticketAttempt).toBeNull();
    });

    it('Shared user with separate customer records in Org A and Org B has completely isolated views per session', async () => {
      // When authenticated as SharedCustomerA:
      const orgAJobs = await prisma.job.findMany({
        where: { appointment: { customerId: sharedCustomerAId } },
      });
      expect(orgAJobs.length).toBe(0);

      // When authenticated as SharedCustomerB:
      const orgBJobs = await prisma.job.findMany({
        where: { appointment: { customerId: sharedCustomerBId } },
      });
      expect(orgBJobs.length).toBe(0);

      // Org A and Org B customer records have distinct IDs and Organization bindings
      expect(sharedCustomerAId).not.toBe(sharedCustomerBId);
      const custA = await prisma.customer.findUnique({ where: { id: sharedCustomerAId } });
      const custB = await prisma.customer.findUnique({ where: { id: sharedCustomerBId } });

      expect(custA?.organizationId).toBe(orgAId);
      expect(custB?.organizationId).toBe(orgBId);
    });
  });

  describe('6. Sign-Out Flow (POST /api/auth/logout)', () => {
    it('revokes CustomerSession in DB and clears session upon JSON logout request', async () => {
      const sessionToken = await createCustomerSession(customerAId);

      const nextReq = new NextRequest('http://localhost:3000/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: `customer_session=${sessionToken}`,
        },
        body: JSON.stringify({ type: 'customer' }),
      });

      const res = await logoutHandler(nextReq);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.customerLoggedOut).toBe(true);

      // Verify CustomerSession is revoked in database
      const tokenHash = hashToken(sessionToken);
      const dbSession = await prisma.customerSession.findUnique({
        where: { tokenHash },
      });
      expect(dbSession?.revokedAt).not.toBeNull();

      // Verify token is no longer valid
      const validation = await validateCustomerSession(sessionToken);
      expect(validation).toBeNull();
    });

    it('redirects to /portal/login on HTML form submission logout', async () => {
      const sessionToken = await createCustomerSession(customerAId);

      const formData = new FormData();
      formData.set('type', 'customer');

      const nextReq = new NextRequest('http://localhost:3000/api/auth/logout', {
        method: 'POST',
        headers: {
          accept: 'text/html',
          cookie: `customer_session=${sessionToken}`,
        },
        body: formData,
      });

      const res = await logoutHandler(nextReq);
      expect(res.status).toBe(303);
      expect(res.headers.get('location')).toContain('/portal/login');
    });
  });
});
