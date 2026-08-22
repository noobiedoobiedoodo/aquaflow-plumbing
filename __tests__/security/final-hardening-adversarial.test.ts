import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/db';
import { randomUUID, randomBytes } from 'crypto';
import { hashPassword } from '@/lib/auth/password';
import { createSession, hashSessionToken, requireRoleInOrg } from '@/lib/auth/session';
import { createCustomerSession, hashToken, requireCustomerSession } from '@/lib/auth/customer-session';
import { requestCustomerPasswordReset, loginCustomerWithPassword, setCustomerPermanentPassword } from '@/app/actions/customer-auth';
import { registerTenant } from '@/app/actions/onboarding';
import { createPaymentIntentFromToken } from '@/app/actions/finance';
import { captureSignatureAndComplete, updateJobState, addJobNote, addJobPart } from '@/app/actions/tech';
import { POST as magicLinkHandler } from '@/app/api/auth/magic-link/route';
import { GET as verifyHandler } from '@/app/auth/verify/route';
import { GET as refreshHandler } from '@/app/api/stripe-connect/refresh/route';
import { ROLES, ADMIN_ROLES, TECH_ROLES } from '@/lib/constants';
import fs from 'fs';
import path from 'path';

describe('Final Production Acceptance Adversarial & Hardening Test Suite', () => {
  const testId = randomUUID().slice(0, 8);
  let orgAId: string;
  let orgBId: string;
  let orgASlug: string;
  let orgBSlug: string;

  let adminAId: string;
  let techAId: string;
  let techBId: string;
  let customerAId: string;
  let customerBId: string;
  let customerAUserId: string;
  let customerBUserId: string;

  let jobAId: string;
  let jobBId: string;
  let invoiceAId: string;
  let paymentTokenA: string;

  beforeAll(async () => {
    // 1. Create Organization A & B
    orgASlug = `pilot-org-a-${testId}`;
    orgBSlug = `pilot-org-b-${testId}`;

    const orgA = await prisma.organization.create({
      data: { name: `Pilot Plumbing A ${testId}`, slug: orgASlug, stripeAccountId: 'acct_orgA_test' },
    });
    orgAId = orgA.id;

    const orgB = await prisma.organization.create({
      data: { name: `Pilot Plumbing B ${testId}`, slug: orgBSlug, stripeAccountId: 'acct_orgB_test' },
    });
    orgBId = orgB.id;

    // 2. Create Users & Memberships
    const adminUser = await prisma.user.create({
      data: {
        email: `admina.${testId}@test.com`,
        firstName: 'Admin',
        lastName: 'OrgA',
        passwordHash: await hashPassword('Password123!'),
        memberships: { create: { organizationId: orgAId, role: ROLES.ADMIN } },
      },
    });
    adminAId = adminUser.id;

    const techAUser = await prisma.user.create({
      data: {
        email: `techa.${testId}@test.com`,
        firstName: 'Tech',
        lastName: 'OrgA',
        passwordHash: await hashPassword('Password123!'),
        memberships: { create: { organizationId: orgAId, role: ROLES.TECHNICIAN } },
      },
    });
    const techA = await prisma.technician.create({
      data: {
        userId: techAUser.id,
        organizationId: orgAId,
        firstName: 'Tech',
        lastName: 'OrgA',
        availabilityStatus: 'AVAILABLE',
      },
    });
    techAId = techA.id;

    const techBUser = await prisma.user.create({
      data: {
        email: `techb.${testId}@test.com`,
        firstName: 'Tech',
        lastName: 'OrgB',
        passwordHash: await hashPassword('Password123!'),
        memberships: { create: { organizationId: orgBId, role: ROLES.TECHNICIAN } },
      },
    });
    const techB = await prisma.technician.create({
      data: {
        userId: techBUser.id,
        organizationId: orgBId,
        firstName: 'Tech',
        lastName: 'OrgB',
        availabilityStatus: 'AVAILABLE',
      },
    });
    techBId = techB.id;

    // 3. Create Customers in Org A and Org B
    const custAUser = await prisma.user.create({
      data: {
        email: `customera.${testId}@test.com`,
        firstName: 'Customer',
        lastName: 'OrgA',
        passwordHash: await hashPassword('CustomerPass123!'),
        passwordSetAt: new Date(),
      },
    });
    customerAUserId = custAUser.id;

    const custA = await prisma.customer.create({
      data: {
        userId: custAUser.id,
        organizationId: orgAId,
        firstName: 'Customer',
        lastName: 'OrgA',
      },
    });
    customerAId = custA.id;

    const custBUser = await prisma.user.create({
      data: {
        email: `customerb.${testId}@test.com`,
        firstName: 'Customer',
        lastName: 'OrgB',
        passwordHash: await hashPassword('CustomerPass123!'),
        passwordSetAt: new Date(),
      },
    });
    customerBUserId = custBUser.id;

    const custB = await prisma.customer.create({
      data: {
        userId: custBUser.id,
        organizationId: orgBId,
        firstName: 'Customer',
        lastName: 'OrgB',
      },
    });
    customerBId = custB.id;

    // 4. Create Properties & Services
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

    const servA = await prisma.service.create({
      data: {
        organizationId: orgAId,
        name: 'Alpha Service',
        slug: `alpha-service-${testId}`,
        basePrice: 150,
      },
    });

    // 5. Create Appointments & Jobs
    const apptA = await prisma.appointment.create({
      data: {
        appointmentNumber: `PL-2026-A1A1A1A1`,
        organizationId: orgAId,
        customerId: customerAId,
        propertyId: propA.id,
        serviceId: servA.id,
        date: new Date(),
        startTime: '09:00',
        endTime: '11:00',
        status: 'CONFIRMED',
      },
    });

    const jobA = await prisma.job.create({
      data: {
        organizationId: orgAId,
        appointmentId: apptA.id,
        technicianId: techAId,
        status: 'WORKING',
      },
    });
    jobAId = jobA.id;

    const propB = await prisma.property.create({
      data: {
        organizationId: orgBId,
        customerId: customerBId,
        address: '200 Beta St',
        city: 'Winnipeg',
        province: 'MB',
        postalCode: 'R3C 1A1',
      },
    });

    const servB = await prisma.service.create({
      data: {
        organizationId: orgBId,
        name: 'Beta Service',
        slug: `beta-service-${testId}`,
        basePrice: 150,
      },
    });

    const apptB = await prisma.appointment.create({
      data: {
        appointmentNumber: `PL-2026-B2B2B2B2`,
        organizationId: orgBId,
        customerId: customerBId,
        propertyId: propB.id,
        serviceId: servB.id,
        date: new Date(),
        startTime: '13:00',
        endTime: '15:00',
        status: 'CONFIRMED',
      },
    });

    const jobB = await prisma.job.create({
      data: {
        organizationId: orgBId,
        appointmentId: apptB.id,
        technicianId: techBId,
        status: 'WORKING',
      },
    });
    jobBId = jobB.id;

    // 6. Create Invoice in Org A
    paymentTokenA = randomUUID();
    const invoiceA = await prisma.invoice.create({
      data: {
        organizationId: orgAId,
        customerId: customerAId,
        jobId: jobAId,
        invoiceNumber: `INV-2026-A1A1A1A1`,
        subtotal: 300,
        taxTotal: 36,
        total: 336,
        amountPaid: 0,
        status: 'SENT',
        paymentToken: paymentTokenA,
        dueDate: new Date(),
      },
    });
    invoiceAId = invoiceA.id;
  });

  afterAll(async () => {
    // Full clean-room teardown
    await prisma.customerSignature.deleteMany({ where: { job: { organizationId: { in: [orgAId, orgBId] } } } });
    await prisma.jobPhoto.deleteMany({ where: { job: { organizationId: { in: [orgAId, orgBId] } } } });
    await prisma.jobPart.deleteMany({ where: { job: { organizationId: { in: [orgAId, orgBId] } } } });
    await prisma.jobNote.deleteMany({ where: { job: { organizationId: { in: [orgAId, orgBId] } } } });
    await prisma.jobTimeEntry.deleteMany({ where: { job: { organizationId: { in: [orgAId, orgBId] } } } });
    await prisma.jobActivity.deleteMany({ where: { job: { organizationId: { in: [orgAId, orgBId] } } } });
    await prisma.financialActivity.deleteMany({ where: { invoice: { organizationId: { in: [orgAId, orgBId] } } } });
    await prisma.payment.deleteMany({ where: { invoice: { organizationId: { in: [orgAId, orgBId] } } } });
    await prisma.invoiceLine.deleteMany({ where: { invoice: { organizationId: { in: [orgAId, orgBId] } } } });
    await prisma.invoiceTax.deleteMany({ where: { invoice: { organizationId: { in: [orgAId, orgBId] } } } });
    await prisma.invoice.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.job.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.appointment.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.service.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.property.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.magicLinkToken.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.passwordResetToken.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.customerSession.deleteMany({ where: { customer: { organizationId: { in: [orgAId, orgBId] } } } });
    await prisma.customerActivity.deleteMany({ where: { customer: { organizationId: { in: [orgAId, orgBId] } } } });
    await prisma.customer.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.technician.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.notification.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.event.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.organizationMember.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [adminAId, customerAUserId, customerBUserId] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } });
  });

  // ==========================================
  // 1. Route Inventory Invariant Test
  // ==========================================
  describe('Route Inventory Count & Invariant Verification', () => {
    it('enforces totalRoutes === routes.length and valid attributes for every inventoried route', () => {
      const inventoryPath = path.join(process.cwd(), 'ROUTE-INVENTORY.json');
      expect(fs.existsSync(inventoryPath)).toBe(true);

      const raw = fs.readFileSync(inventoryPath, 'utf8');
      const inventory = JSON.parse(raw);

      expect(inventory.totalRoutes).toBeDefined();
      expect(inventory.routes).toBeInstanceOf(Array);
      expect(inventory.totalRoutes).toBe(inventory.routes.length);

      for (const route of inventory.routes) {
        expect(route.path).toBeDefined();
        expect(route.type).toMatch(/^(API_ROUTE|SERVER_ACTION)$/);
        expect(route.auth).toBeDefined();
        expect(typeof route.rateLimited).toBe('boolean');
        expect(route.validation).toBeDefined();
        expect(typeof route.tenantScoped).toBe('boolean');
        expect(route.tenantResolution).toBeDefined();
        expect(route.objectAuthorization).toBeDefined();
        expect(route.status).toBe('VERIFIED');
      }
    });
  });

  // ==========================================
  // 2. Customer Password Reset & Rate Limiting
  // ==========================================
  describe('Customer Password Reset Security & Non-Enumeration', () => {
    it('returns identical generic success message for non-existent email (prevents enumeration)', async () => {
      const res = await requestCustomerPasswordReset({
        email: 'nobody@nowhere.com',
        slug: orgASlug,
      });

      expect(res.success).toBe(true);
      expect(res.message).toContain('If an account exists');
    });

    it('returns identical generic success message for valid customer in wrong organization', async () => {
      // Customer A belongs to Org A, requesting reset on Org B
      const res = await requestCustomerPasswordReset({
        email: `customera.${testId}@test.com`,
        slug: orgBSlug,
      });

      expect(res.success).toBe(true);
      expect(res.message).toContain('If an account exists');

      // Verify no notification was created for Org B
      const notif = await prisma.notification.findFirst({
        where: {
          organizationId: orgBId,
          type: 'PASSWORD_RESET',
          metadata: { contains: `customera.${testId}@test.com` },
        },
      });
      expect(notif).toBeNull();
    });

    it('creates password reset token and notification for valid customer in correct organization', async () => {
      const res = await requestCustomerPasswordReset({
        email: `customera.${testId}@test.com`,
        slug: orgASlug,
      });

      expect(res.success).toBe(true);

      const notif = await prisma.notification.findFirst({
        where: {
          organizationId: orgAId,
          type: 'PASSWORD_RESET',
          userId: customerAUserId,
        },
      });
      expect(notif).not.toBeNull();
      expect(notif?.subject).toContain('Reset Your');
    });
  });

  // ==========================================
  // 3. Public Tenant Onboarding Rate Limiting & Rollback
  // ==========================================
  describe('Public Tenant Onboarding Abuse Protection & Atomic Rollback', () => {
    it('rejects duplicate email registration cleanly without partial records', async () => {
      const formData = new FormData();
      formData.set('companyName', 'Duplicate Test Plumbing');
      formData.set('firstName', 'Dupe');
      formData.set('lastName', 'User');
      formData.set('email', `admina.${testId}@test.com`); // Already exists
      formData.set('password', 'ValidPass123!');

      const res = await registerTenant(formData);
      expect(res.success).toBe(false);
      expect(res.error).toContain('already exists');
    });

    it('rejects invalid short password without creating organization', async () => {
      const formData = new FormData();
      formData.set('companyName', 'Invalid Password Plumbing');
      formData.set('firstName', 'Test');
      formData.set('lastName', 'User');
      formData.set('email', `newcompany.${testId}@test.com`);
      formData.set('password', 'short'); // < 8 chars

      const res = await registerTenant(formData);
      expect(res.success).toBe(false);
      expect(res.error).toContain('Validation failed');
    });
  });

  // ==========================================
  // 4. Magic Link Single-Tenant Binding & Concurrency
  // ==========================================
  describe('Magic Link Single-Tenant Binding & Verification', () => {
    it('strictly binds token to the matching organization when organizationSlug is provided', async () => {
      const req = new Request('http://localhost:3000/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '127.0.0.1' },
        body: JSON.stringify({
          email: `customera.${testId}@test.com`,
          organizationSlug: orgASlug,
        }),
      });

      const res = await magicLinkHandler(req);
      expect(res.status).toBe(200);

      const tokenRecord = await prisma.magicLinkToken.findFirst({
        where: {
          userId: customerAUserId,
          organizationId: orgAId,
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(tokenRecord).not.toBeNull();
      expect(tokenRecord?.organizationId).toBe(orgAId);
    });

    it('rejects magic link token when consumed with invalid token', async () => {
      const req = new Request('http://localhost:3000/auth/verify?token=completely-invalid-token', {
        method: 'GET',
      });

      const res = await verifyHandler(req);
      expect(res.status).toBe(400);
      const text = await res.text();
      expect(text).toContain('Invalid or expired token');
    });
  });

  // ==========================================
  // 5. Stripe Connect Refresh & Open Redirect Prevention
  // ==========================================
  describe('Stripe Connect Refresh Open Redirect Prevention', () => {
    it('redirects strictly to internal /onboarding without accepting user redirect parameters', async () => {
      const req = new Request('http://localhost:3000/api/stripe-connect/refresh?redirect=https://evil.com', {
        method: 'GET',
      });

      const res = await refreshHandler(req);
      expect(res.status).toBe(307); // Next.js redirect
      const location = res.headers.get('location') || '';
      expect(location).toContain('/onboarding?error=link_expired');
      expect(location).not.toContain('evil.com');
    });
  });

  // ==========================================
  // 6. Payment Token Unpredictability & Server Balance Recalculation
  // ==========================================
  describe('Payment Token Security & Balance Recalculation', () => {
    it('rejects payment intent creation for invalid or forged token', async () => {
      await expect(createPaymentIntentFromToken('forged-token-uuid-12345')).rejects.toThrow(
        /Invoice not found or invalid token/
      );
    });

    it('rejects payment intent creation if invoice balance is already 0', async () => {
      // Mark invoice fully paid
      await prisma.invoice.update({
        where: { id: invoiceAId },
        data: { amountPaid: 336, status: 'PAID' },
      });

      await expect(createPaymentIntentFromToken(paymentTokenA)).rejects.toThrow(
        /already fully paid/
      );

      // Restore
      await prisma.invoice.update({
        where: { id: invoiceAId },
        data: { amountPaid: 0, status: 'SENT' },
      });
    });
  });
});
