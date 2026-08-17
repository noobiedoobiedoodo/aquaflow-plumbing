import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/lib/db';
import { randomUUID, randomBytes } from 'crypto';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import {
  loginCustomerWithPassword,
  requestCustomerPasswordReset,
} from '@/app/actions/customer-auth';
import {
  createCustomerSession,
  validateCustomerSession,
  hashToken,
} from '@/lib/auth/customer-session';
import { GET as verifyHandler } from '@/app/auth/verify/route';
import { POST as resetPasswordHandler } from '@/app/api/auth/reset-password/route';
import { RateLimiter } from '@/lib/security/rate-limiter';
import { NextRequest } from 'next/server';

describe('Customer Permanent Account & Multi-Tenant Lifecycle Suite', () => {
  let orgAId: string;
  let orgBId: string;
  let orgCId: string;
  let orgASlug: string;
  let orgBSlug: string;
  let orgCSlug: string;

  let sharedUserId: string;
  let sharedEmail: string;
  let customerAId: string;
  let customerBId: string;

  let unactivatedUserId: string;
  let unactivatedEmail: string;
  let unactivatedCustomerId: string;

  beforeEach(async () => {
    await RateLimiter.resetAll();
    const testId = randomUUID().slice(0, 8);

    orgASlug = `alpha-plumbing-${testId}`;
    orgBSlug = `beta-plumbing-${testId}`;
    orgCSlug = `gamma-plumbing-${testId}`;

    // Create 3 separate organizations
    const orgA = await prisma.organization.create({
      data: {
        name: `Alpha Plumbing ${testId}`,
        slug: orgASlug,
        phone: '204-555-0101',
        email: `alpha-${testId}@example.com`,
      },
    });
    orgAId = orgA.id;

    const orgB = await prisma.organization.create({
      data: {
        name: `Beta Plumbing ${testId}`,
        slug: orgBSlug,
        phone: '204-555-0102',
        email: `beta-${testId}@example.com`,
      },
    });
    orgBId = orgB.id;

    const orgC = await prisma.organization.create({
      data: {
        name: `Gamma Plumbing ${testId}`,
        slug: orgCSlug,
        phone: '204-555-0103',
        email: `gamma-${testId}@example.com`,
      },
    });
    orgCId = orgC.id;

    // Create Global Shared User (Jane) with a permanent password
    sharedEmail = `jane.doe.${testId}@example.com`;
    const passwordHash = await hashPassword('SecretPassword123!');
    const sharedUser = await prisma.user.create({
      data: {
        email: sharedEmail,
        firstName: 'Jane',
        lastName: 'Doe',
        passwordHash,
        passwordSetAt: new Date(),
        emailVerified: true,
      },
    });
    sharedUserId = sharedUser.id;

    // Associate Jane as a Customer in Org A and Org B, but NOT Org C
    const custA = await prisma.customer.create({
      data: {
        organizationId: orgAId,
        userId: sharedUserId,
        firstName: 'Jane',
        lastName: 'Doe',
      },
    });
    customerAId = custA.id;

    const custB = await prisma.customer.create({
      data: {
        organizationId: orgBId,
        userId: sharedUserId,
        firstName: 'Jane',
        lastName: 'Doe',
      },
    });
    customerBId = custB.id;

    // Create an unactivated customer (no password set) in Org A
    unactivatedEmail = `mark.unactivated.${testId}@example.com`;
    const unactivatedUser = await prisma.user.create({
      data: {
        email: unactivatedEmail,
        firstName: 'Mark',
        lastName: 'Spicer',
        passwordHash: null,
        passwordSetAt: null,
        emailVerified: false,
      },
    });
    unactivatedUserId = unactivatedUser.id;

    const unactCust = await prisma.customer.create({
      data: {
        organizationId: orgAId,
        userId: unactivatedUserId,
        firstName: 'Mark',
        lastName: 'Spicer',
      },
    });
    unactivatedCustomerId = unactCust.id;
  });

  describe('1. Invitation & Account Activation Flow', () => {
    it('redirects unactivated customer to /portal/setup-password on magic link verification', async () => {
      const rawToken = randomBytes(32).toString('base64url');
      const tokenHash = hashToken(rawToken);

      await prisma.magicLinkToken.create({
        data: {
          tokenHash,
          userId: unactivatedUserId,
          organizationId: orgAId,
          customerId: unactivatedCustomerId,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        },
      });

      const req = new NextRequest(`https://aquaflow.test/auth/verify?token=${rawToken}`);
      const res = await verifyHandler(req);

      expect(res.status).toBe(307);
      const location = res.headers.get('location');
      expect(location).toContain('/portal/setup-password');

      // Verify token is stamped used
      const dbToken = await prisma.magicLinkToken.findUnique({ where: { tokenHash } });
      expect(dbToken?.usedAt).not.toBeNull();
    });

    it('redirects already activated customer directly to /portal/dashboard', async () => {
      const rawToken = randomBytes(32).toString('base64url');
      const tokenHash = hashToken(rawToken);

      await prisma.magicLinkToken.create({
        data: {
          tokenHash,
          userId: sharedUserId,
          organizationId: orgAId,
          customerId: customerAId,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        },
      });

      const req = new NextRequest(`https://aquaflow.test/auth/verify?token=${rawToken}`);
      const res = await verifyHandler(req);

      expect(res.status).toBe(307);
      const location = res.headers.get('location');
      expect(location).toContain('/portal/dashboard');
    });
  });

  describe('2. Permanent Password Login at /p/[slug]/login', () => {
    it('authenticates customer with valid email and password', async () => {
      const result = await loginCustomerWithPassword({
        email: sharedEmail,
        password: 'SecretPassword123!',
        slug: orgASlug,
      });

      expect(result.success).toBe(true);
      expect(result.redirectUrl).toBe('/portal/dashboard');
    });

    it('rejects incorrect password with 401 equivalent message', async () => {
      const result = await loginCustomerWithPassword({
        email: sharedEmail,
        password: 'WrongPassword999!',
        slug: orgASlug,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid email or password');
    });

    it('rejects unactivated customer account with activation guidance', async () => {
      const result = await loginCustomerWithPassword({
        email: unactivatedEmail,
        password: 'SomeRandomPassword123!',
        slug: orgASlug,
      });

      expect(result.success).toBe(false);
      expect(result.unactivated).toBe(true);
      expect(result.error).toContain('Account not yet activated');
    });

    it('rejects non-existent email without account enumeration', async () => {
      const result = await loginCustomerWithPassword({
        email: 'nobody.exists@example.com',
        password: 'SecretPassword123!',
        slug: orgASlug,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid email or password');
    });
  });

  describe('3. Multi-Tenant Same-Email Isolation Gate', () => {
    it('creates CustomerSession strictly bound to Org A when logging in to Org A', async () => {
      const result = await loginCustomerWithPassword({
        email: sharedEmail,
        password: 'SecretPassword123!',
        slug: orgASlug,
      });

      expect(result.success).toBe(true);

      const latestSession = await prisma.customerSession.findFirst({
        where: { customer: { userId: sharedUserId } },
        orderBy: { createdAt: 'desc' },
        include: { customer: true },
      });

      expect(latestSession?.customer.id).toBe(customerAId);
      expect(latestSession?.customer.organizationId).toBe(orgAId);
    });

    it('creates CustomerSession strictly bound to Org B when logging in to Org B', async () => {
      const result = await loginCustomerWithPassword({
        email: sharedEmail,
        password: 'SecretPassword123!',
        slug: orgBSlug,
      });

      expect(result.success).toBe(true);

      const latestSession = await prisma.customerSession.findFirst({
        where: { customer: { userId: sharedUserId } },
        orderBy: { createdAt: 'desc' },
        include: { customer: true },
      });

      expect(latestSession?.customer.id).toBe(customerBId);
      expect(latestSession?.customer.organizationId).toBe(orgBId);
    });

    it('rejects login to Org C where user has no customer record', async () => {
      const result = await loginCustomerWithPassword({
        email: sharedEmail,
        password: 'SecretPassword123!',
        slug: orgCSlug,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid email or password');
    });
  });

  describe('4. Cryptographic Password Reset & Session Revocation', () => {
    it('stores SHA-256 tokenHash in database on reset request without account enumeration', async () => {
      const res = await requestCustomerPasswordReset({
        email: sharedEmail,
        slug: orgASlug,
      });

      expect(res.success).toBe(true);
      expect(res.message).toContain('instructions have been sent');

      const resetToken = await prisma.passwordResetToken.findFirst({
        where: { userId: sharedUserId, organizationId: orgAId },
        orderBy: { createdAt: 'desc' },
      });

      expect(resetToken).toBeDefined();
      expect(resetToken?.tokenHash).toBeDefined();
      expect(resetToken?.tokenHash.length).toBe(64); // SHA-256 hex digest length
    });

    it('resets password and revokes all active customer sessions', async () => {
      // 1. Create an active session
      const sessionToken = await createCustomerSession(customerAId);
      const validCheckBefore = await validateCustomerSession(sessionToken);
      expect(validCheckBefore).not.toBeNull();

      // 2. Create a reset token
      const rawToken = randomBytes(32).toString('base64url');
      const tokenHash = hashToken(rawToken);
      await prisma.passwordResetToken.create({
        data: {
          userId: sharedUserId,
          organizationId: orgAId,
          tokenHash,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });

      // 3. Consume reset token
      const req = new NextRequest('https://aquaflow.test/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: rawToken, newPassword: 'NewPermanentPassword888!' }),
      });
      const resetRes = await resetPasswordHandler(req);
      expect(resetRes.status).toBe(200);

      // 4. Verify password updated
      const updatedUser = await prisma.user.findUnique({ where: { id: sharedUserId } });
      const verifyNew = await verifyPassword('NewPermanentPassword888!', updatedUser?.passwordHash);
      expect(verifyNew).toBe(true);

      // 5. Verify previous session was REVOKED
      const validCheckAfter = await validateCustomerSession(sessionToken);
      expect(validCheckAfter).toBeNull();

      // 6. Verify replay of reset token fails
      const replayReq = new NextRequest('https://aquaflow.test/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: rawToken, newPassword: 'AnotherPassword999!' }),
      });
      const replayRes = await resetPasswordHandler(replayReq);
      expect(replayRes.status).toBe(400);
    });
  });
});
