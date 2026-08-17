import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getServerBaseUrl, getBaseUrl, getAbsoluteServerUrl, getAbsoluteUrl } from '@/lib/config/url';
import { prisma } from '@/lib/db';
import { registerTenant } from '@/app/actions/onboarding';
import { sendCustomerPortalInvitation } from '@/app/actions/customers';
import crypto from 'crypto';

describe('PRODUCTION URL INTEGRITY & ZERO-LOCALHOST REGRESSION TEST', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('1. In production (NODE_ENV=production), getServerBaseUrl never returns localhost or 127.0.0.1', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NEXT_PUBLIC_BASE_URL;
    delete process.env.APP_URL;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    delete process.env.VERCEL_URL;

    const url = await getServerBaseUrl();
    expect(url).not.toContain('localhost');
    expect(url).not.toContain('127.0.0.1');
    expect(url).not.toContain('undefined');
    expect(url).not.toContain('null');
    expect(url.startsWith('https://')).toBe(true);
    expect(url).toBe('https://aquaflow-plumbing-theta.vercel.app');
  });

  it('2. In production with VERCEL_PROJECT_PRODUCTION_URL, correctly resolves canonical production domain', async () => {
    process.env.NODE_ENV = 'production';
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'aquaflow-plumbing-theta.vercel.app';

    const url = await getServerBaseUrl();
    expect(url).toBe('https://aquaflow-plumbing-theta.vercel.app');
    expect(url).not.toContain('localhost');
  });

  it('3. In production with custom domain APP_URL, respects configured production domain', async () => {
    process.env.NODE_ENV = 'production';
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.aquaflowplumbing.com';

    const url = await getServerBaseUrl();
    expect(url).toBe('https://app.aquaflowplumbing.com');
    expect(url).not.toContain('localhost');
  });

  it('4. In production, if explicit env var accidentally has localhost:3000, sanitizes and ignores it', async () => {
    process.env.NODE_ENV = 'production';
    process.env.NEXT_PUBLIC_BASE_URL = 'http://localhost:3000';
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'aquaflow-plumbing-theta.vercel.app';

    const url = await getServerBaseUrl();
    expect(url).not.toContain('localhost');
    expect(url).toBe('https://aquaflow-plumbing-theta.vercel.app');
  });

  it('5. Synchronous getBaseUrl resolver also never returns localhost in production', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NEXT_PUBLIC_BASE_URL;

    const url = getBaseUrl();
    expect(url).not.toContain('localhost');
    expect(url).not.toContain('127.0.0.1');
    expect(url).not.toContain('undefined');
    expect(url.startsWith('https://')).toBe(true);
  });

  it('6. Absolute Server URL helper constructs valid production verify URLs', async () => {
    process.env.NODE_ENV = 'production';
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'aquaflow-plumbing-theta.vercel.app';

    const rawToken = 'test_token_abc_123';
    const verifyUrl = await getAbsoluteServerUrl(`/auth/verify?token=${rawToken}`);

    expect(verifyUrl).toBe(`https://aquaflow-plumbing-theta.vercel.app/auth/verify?token=${rawToken}`);
    expect(verifyUrl).not.toContain('localhost');
    expect(verifyUrl).not.toContain('127.0.0.1');
  });

  it('7. Customer Portal Invitation generates non-localhost production magic link and notification', async () => {
    process.env.NODE_ENV = 'production';
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'aquaflow-plumbing-theta.vercel.app';

    const timestamp = Date.now();
    const form = new FormData();
    form.append('companyName', `Winnipeg Pro UrlTest ${timestamp}`);
    form.append('firstName', 'John');
    form.append('lastName', 'Smith');
    form.append('email', `john.urltest_${timestamp}@winnipegpro.test`);
    form.append('password', 'OwnerPass123!');

    const res = await registerTenant(form);
    expect(res.success).toBe(true);

    const org = await prisma.organization.findUnique({
      where: { slug: res.slug },
    });

    const user = await prisma.user.create({
      data: {
        email: `jane.urltest_${timestamp}@example.com`.toLowerCase(),
        passwordHash: 'manual_intake_no_password',
        firstName: 'Jane',
        lastName: 'Homeowner',
      },
    });

    const customer = await prisma.customer.create({
      data: {
        userId: user.id,
        organizationId: org!.id,
        firstName: 'Jane',
        lastName: 'Homeowner',
      },
    });

    // Mock session for requireRoleInOrg
    const authSession = await import('@/lib/auth/session');
    vi.spyOn(authSession, 'requireRoleInOrg').mockResolvedValue({
      user: { id: org!.id, email: 'john@test.com', organizationId: org!.id, role: 'SUPER_ADMIN' },
      organizationId: org!.id,
      role: 'SUPER_ADMIN',
    });

    const { sendCustomerPortalInvitation: sendInvite } = await import('@/app/actions/customers');
    const inviteRes = await sendInvite(customer.id);
    expect(inviteRes.success).toBe(true);
    expect(inviteRes.magicLinkUrl).toBeDefined();

    // STRICT VALIDATION: Must not contain localhost
    expect(inviteRes.magicLinkUrl).not.toContain('localhost');
    expect(inviteRes.magicLinkUrl).not.toContain('127.0.0.1');
    expect(inviteRes.magicLinkUrl).toContain('aquaflow-plumbing-theta.vercel.app');
    expect(inviteRes.magicLinkUrl).toContain('/auth/verify?token=');

    // Inspect Notification in Database
    const notif = await prisma.notification.findFirst({
      where: { organizationId: org!.id, userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    expect(notif).toBeDefined();
    expect(notif?.content).not.toContain('localhost');
    expect(notif?.content).toContain('https://aquaflow-plumbing-theta.vercel.app/auth/verify?token=');
  });
});
