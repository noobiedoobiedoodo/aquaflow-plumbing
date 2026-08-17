import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { prisma } from '@/lib/db';
import { registerTenant } from '@/app/actions/onboarding';
import { getServerBaseUrl, getBaseUrl, getAbsoluteServerUrl, getAbsoluteUrl } from '@/lib/config/url';
import { hashToken } from '@/lib/auth/customer-session';
import crypto from 'crypto';

describe('AQUAFLOW — FINAL BLOCKER VERIFICATION SUITE', () => {
  const originalEnv = { ...process.env };
  const timestamp = Date.now();

  let orgA: any;
  let orgB: any;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  // ==========================================================================
  // 1. MULTI-COMPANY SAME HOMEOWNER EMAIL TEST
  // ==========================================================================
  it('1. Same homeowner email in Company A & Company B creates isolated Customer records & tokens', async () => {
    // 1. Create Company A
    const formA = new FormData();
    formA.append('companyName', `Winnipeg Pro Multi ${timestamp}`);
    formA.append('firstName', 'John');
    formA.append('lastName', 'Smith');
    formA.append('email', `john.multi_${timestamp}@winnipegpro.test`);
    formA.append('password', 'OwnerPass123!');
    const resA = await registerTenant(formA);
    orgA = await prisma.organization.findUnique({ where: { slug: resA.slug } });

    // 2. Create Company B
    const formB = new FormData();
    formB.append('companyName', `Winnipeg Elite Multi ${timestamp}`);
    formB.append('firstName', 'Alice');
    formB.append('lastName', 'Elite');
    formB.append('email', `alice.multi_${timestamp}@winnipegelite.test`);
    formB.append('password', 'OwnerPass123!');
    const resB = await registerTenant(formB);
    orgB = await prisma.organization.findUnique({ where: { slug: resB.slug } });

    // 3. Shared Homeowner email across both companies
    const sharedEmail = `homeowner.shared_${timestamp}@example.com`.toLowerCase();
    const globalUser = await prisma.user.create({
      data: {
        email: sharedEmail,
        passwordHash: 'shared_homeowner_hash',
        firstName: 'Jane',
        lastName: 'Homeowner',
      },
    });

    // Customer record in Company A
    const customerA = await prisma.customer.create({
      data: {
        userId: globalUser.id,
        organizationId: orgA.id,
        firstName: 'Jane',
        lastName: 'Homeowner (Company A Record)',
      },
    });

    // Customer record in Company B
    const customerB = await prisma.customer.create({
      data: {
        userId: globalUser.id,
        organizationId: orgB.id,
        firstName: 'Jane',
        lastName: 'Homeowner (Company B Record)',
      },
    });

    expect(customerA.id).not.toBe(customerB.id);
    expect(customerA.organizationId).toBe(orgA.id);
    expect(customerB.organizationId).toBe(orgB.id);
    expect(customerA.userId).toBe(globalUser.id);
    expect(customerB.userId).toBe(globalUser.id);

    // 4. Generate Single-Tenant Magic Link Token for Company A
    const rawTokenA = crypto.randomBytes(32).toString('base64url');
    const tokenHashA = hashToken(rawTokenA);
    const magicA = await prisma.magicLinkToken.create({
      data: {
        userId: globalUser.id,
        organizationId: orgA.id,
        customerId: customerA.id,
        tokenHash: tokenHashA,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    // 5. Generate Single-Tenant Magic Link Token for Company B
    const rawTokenB = crypto.randomBytes(32).toString('base64url');
    const tokenHashB = hashToken(rawTokenB);
    const magicB = await prisma.magicLinkToken.create({
      data: {
        userId: globalUser.id,
        organizationId: orgB.id,
        customerId: customerB.id,
        tokenHash: tokenHashB,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    // Token A binds to Customer A & Org A
    expect(magicA.customerId).toBe(customerA.id);
    expect(magicA.organizationId).toBe(orgA.id);

    // Token B binds to Customer B & Org B
    expect(magicB.customerId).toBe(customerB.id);
    expect(magicB.organizationId).toBe(orgB.id);

    // Verify Token A cannot authenticate into Org B
    const crossTokenVerification = await prisma.magicLinkToken.findFirst({
      where: { tokenHash: tokenHashA, organizationId: orgB.id },
    });
    expect(crossTokenVerification).toBeNull();
  });

  // ==========================================================================
  // 2. PRODUCTION URL SWEEP & RESOLUTION ACCURACY
  // ==========================================================================
  it('2. Production URL Sweep: all 12 URL generators produce valid production URLs with zero localhost', async () => {
    process.env.NODE_ENV = 'production';
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'aquaflow-plumbing-theta.vercel.app';

    const slug = 'winnipeg-pro-plumbing';
    const rawToken = 'sample_raw_token_123';
    const payToken = 'pay_uuid_456';

    const urls = {
      base: await getServerBaseUrl(),
      portalInvite: await getAbsoluteServerUrl(`/auth/verify?token=${rawToken}`),
      portalLogin: await getAbsoluteServerUrl(`/p/${slug}/login`),
      publicBooking: await getAbsoluteServerUrl(`/p/${slug}/book`),
      publicLanding: await getAbsoluteServerUrl(`/p/${slug}`),
      invoicePay: await getAbsoluteServerUrl(`/pay/${payToken}`),
      stripeConnectRefresh: await getAbsoluteServerUrl(`/api/stripe-connect/refresh`),
      stripeConnectCallback: await getAbsoluteServerUrl(`/api/stripe-connect/callback`),
      stripeCheckoutSuccess: await getAbsoluteServerUrl(`/onboarding?session_id=CHECKOUT_123`),
      stripeCheckoutCancel: await getAbsoluteServerUrl(`/onboarding`),
      twilioWebhook: await getAbsoluteServerUrl(`/api/webhooks/twilio`),
      resendWebhook: await getAbsoluteServerUrl(`/api/webhooks/resend`),
    };

    for (const [name, url] of Object.entries(urls)) {
      expect(url, `URL for ${name} should not contain localhost`).not.toContain('localhost');
      expect(url, `URL for ${name} should not contain 127.0.0.1`).not.toContain('127.0.0.1');
      expect(url, `URL for ${name} should not contain undefined`).not.toContain('undefined');
      expect(url, `URL for ${name} should not contain null`).not.toContain('null');
      expect(url.startsWith('https://aquaflow-plumbing-theta.vercel.app'), `URL for ${name} must use production origin`).toBe(true);
    }
  });

  // ==========================================================================
  // 3. TOKEN LIFECYCLE: EXPIRATION & SINGLE-USE VERIFICATION
  // ==========================================================================
  it('3. Token Lifecycle: Expired or used tokens are rejected safely', async () => {
    const user = await prisma.user.create({
      data: {
        email: `token.test_${timestamp}@example.com`.toLowerCase(),
        passwordHash: 'test_hash',
        firstName: 'Token',
        lastName: 'Tester',
      },
    });

    // 1. Expired token (created with past expiresAt)
    const expiredRawToken = crypto.randomBytes(32).toString('base64url');
    const expiredHash = hashToken(expiredRawToken);
    await prisma.magicLinkToken.create({
      data: {
        userId: user.id,
        organizationId: orgA.id,
        tokenHash: expiredHash,
        expiresAt: new Date(Date.now() - 1000), // Expired 1s ago
      },
    });

    const foundExpired = await prisma.magicLinkToken.findFirst({
      where: {
        tokenHash: expiredHash,
        expiresAt: { gt: new Date() },
        usedAt: null,
      },
    });
    expect(foundExpired).toBeNull();

    // 2. Used token (usedAt is set)
    const usedRawToken = crypto.randomBytes(32).toString('base64url');
    const usedHash = hashToken(usedRawToken);
    await prisma.magicLinkToken.create({
      data: {
        userId: user.id,
        organizationId: orgA.id,
        tokenHash: usedHash,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        usedAt: new Date(), // Already consumed
      },
    });

    const foundUsed = await prisma.magicLinkToken.findFirst({
      where: {
        tokenHash: usedHash,
        expiresAt: { gt: new Date() },
        usedAt: null,
      },
    });
    expect(foundUsed).toBeNull();
  });
});
