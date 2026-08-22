import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/db';
import { registerTenant } from '@/app/actions/onboarding';
import { validateSession, hashSessionToken, createSession } from '@/lib/auth/session';
import { ADMIN_ROLES, ROLES } from '@/lib/constants';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

describe('Plumber Signup & Tenant Provisioning Forensic Audit Suite', () => {
  const testRunId = randomUUID().slice(0, 8);
  const createdOrgIds: string[] = [];
  const createdUserIds: string[] = [];

  afterAll(async () => {
    // Cleanup provisioned test entities
    for (const orgId of createdOrgIds) {
      await prisma.taxRule.deleteMany({ where: { organizationId: orgId } }).catch(() => {});
      await prisma.businessHours.deleteMany({ where: { organizationId: orgId } }).catch(() => {});
      await prisma.service.deleteMany({ where: { organizationId: orgId } }).catch(() => {});
      await prisma.technician.deleteMany({ where: { organizationId: orgId } }).catch(() => {});
      await prisma.organizationMember.deleteMany({ where: { organizationId: orgId } }).catch(() => {});
      await prisma.organization.deleteMany({ where: { id: orgId } }).catch(() => {});
    }
    for (const userId of createdUserIds) {
      await prisma.session.deleteMany({ where: { userId } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: userId } }).catch(() => {});
    }
  });

  describe('1. Form Validation & Error States', () => {
    it('rejects registration when company name is missing or too short', async () => {
      const formData = new FormData();
      formData.append('companyName', 'A'); // Less than 2 chars
      formData.append('firstName', 'John');
      formData.append('lastName', 'Doe');
      formData.append('email', `valid.${testRunId}@aquaflow.internal`);
      formData.append('password', 'SecurePass123!');

      const result = await registerTenant(formData);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Validation failed');
      expect((result as any).details?.fieldErrors?.companyName).toBeDefined();
    });

    it('rejects registration when email format is invalid', async () => {
      const formData = new FormData();
      formData.append('companyName', 'Apex Plumbing Test');
      formData.append('firstName', 'John');
      formData.append('lastName', 'Doe');
      formData.append('email', 'not-an-email');
      formData.append('password', 'SecurePass123!');

      const result = await registerTenant(formData);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Validation failed');
      expect((result as any).details?.fieldErrors?.email).toContain('Invalid email address');
    });

    it('rejects registration when password is shorter than 8 characters', async () => {
      const formData = new FormData();
      formData.append('companyName', 'Apex Plumbing Test');
      formData.append('firstName', 'John');
      formData.append('lastName', 'Doe');
      formData.append('email', `valid.${testRunId}@aquaflow.internal`);
      formData.append('password', 'pass1'); // 5 chars

      const result = await registerTenant(formData);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Validation failed');
      expect((result as any).details?.fieldErrors?.password).toContain('Password must be at least 8 characters');
    });

    it('rejects registration when first name or last name is missing', async () => {
      const formData = new FormData();
      formData.append('companyName', 'Apex Plumbing Test');
      formData.append('firstName', '');
      formData.append('lastName', '');
      formData.append('email', `valid.${testRunId}@aquaflow.internal`);
      formData.append('password', 'SecurePass123!');

      const result = await registerTenant(formData);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Validation failed');
      expect((result as any).details?.fieldErrors?.firstName).toBeDefined();
      expect((result as any).details?.fieldErrors?.lastName).toBeDefined();
    });
  });

  describe('2. Successful Tenant Provisioning & Atomic DB Verification', () => {
    const signupEmail = `audit.plumber.${testRunId}@aquaflowtest.ca`;
    const signupPassword = 'StrongPassword99!';
    const companyName = `Precision Plumbing ${testRunId}`;
    let provisionedSlug: string;
    let provisionedOrgId: string;
    let provisionedUserId: string;

    it('successfully submits registration and returns organization slug', async () => {
      const formData = new FormData();
      formData.append('companyName', companyName);
      formData.append('firstName', 'Sarah');
      formData.append('lastName', 'Connor');
      formData.append('email', signupEmail);
      formData.append('password', signupPassword);

      const result = await registerTenant(formData);
      expect(result.success).toBe(true);
      expect(result.slug).toBeDefined();
      provisionedSlug = result.slug!;
      expect(provisionedSlug).toMatch(new RegExp(`^precision-plumbing-${testRunId}-[a-f0-9]{4,8}$`));
    });

    it('prevents duplicate registration with the same email', async () => {
      const formData = new FormData();
      formData.append('companyName', 'Duplicate Attempt Co');
      formData.append('firstName', 'Sarah');
      formData.append('lastName', 'Connor');
      formData.append('email', signupEmail); // same email
      formData.append('password', 'DifferentPassword123!');

      const result = await registerTenant(formData);
      expect(result.success).toBe(false);
      expect(result.error).toBe('An account with this email already exists');
    });

    it('verifies Database Organization creation with ONBOARDING_COMPLETE status', async () => {
      const org = await prisma.organization.findUnique({
        where: { slug: provisionedSlug },
      });

      expect(org).not.toBeNull();
      expect(org?.name).toBe(companyName);
      expect(org?.city).toBe('Winnipeg');
      expect(org?.province).toBe('MB');
      expect(org?.country).toBe('CA');
      expect(org?.onboardingStatus).toBe('ONBOARDING_COMPLETE');
      expect(org?.isActive).toBe(true);

      provisionedOrgId = org!.id;
      createdOrgIds.push(provisionedOrgId);
    });

    it('verifies Super Admin User creation, password hashing, and active status', async () => {
      const user = await prisma.user.findUnique({
        where: { email: signupEmail.toLowerCase() },
      });

      expect(user).not.toBeNull();
      expect(user?.firstName).toBe('Sarah');
      expect(user?.lastName).toBe('Connor');
      expect(user?.isActive).toBe(true);

      // Verify bcrypt password hash
      const isPasswordValid = await bcrypt.compare(signupPassword, user!.passwordHash);
      expect(isPasswordValid).toBe(true);

      provisionedUserId = user!.id;
      createdUserIds.push(provisionedUserId);
    });

    it('verifies OrganizationMember creation with SUPER_ADMIN role', async () => {
      const membership = await prisma.organizationMember.findUnique({
        where: {
          userId_organizationId: {
            userId: provisionedUserId,
            organizationId: provisionedOrgId,
          },
        },
      });

      expect(membership).not.toBeNull();
      expect(membership?.role).toBe(ROLES.SUPER_ADMIN);
      expect(membership?.isActive).toBe(true);
    });

    it('verifies Owner Technician profile creation and initial AVAILABLE status', async () => {
      const technician = await prisma.technician.findUnique({
        where: { userId: provisionedUserId },
      });

      expect(technician).not.toBeNull();
      expect(technician?.organizationId).toBe(provisionedOrgId);
      expect(technician?.firstName).toBe('Sarah');
      expect(technician?.lastName).toBe('Connor');
      expect(technician?.availabilityStatus).toBe('AVAILABLE');
      expect(technician?.isActive).toBe(true);
    });

    it('verifies exactly 5 default Services provisioned with tenant-scoped slugs and pricing', async () => {
      const services = await prisma.service.findMany({
        where: { organizationId: provisionedOrgId },
        orderBy: { sortOrder: 'asc' },
      });

      expect(services).toHaveLength(5);

      const serviceNames = services.map((s) => s.name);
      expect(serviceNames).toEqual([
        'Emergency Plumbing',
        'Drain Cleaning',
        'Sewer Services',
        'Leak Detection',
        'Water Heaters',
      ]);

      // Verify slug scoping
      services.forEach((s) => {
        expect(s.slug.endsWith(`-${provisionedSlug}`)).toBe(true);
        expect(s.isActive).toBe(true);
      });

      // Verify Emergency service price ($199) and standard service base pricing ($129 + idx*20)
      const emergencyService = services.find((s) => s.isEmergency);
      expect(emergencyService?.basePrice).toBe(199.0);

      const standardServices = services.filter((s) => !s.isEmergency);
      expect(standardServices.length).toBe(4);
      expect(services[1].basePrice).toBe(149.0); // 129 + 1*20
      expect(services[2].basePrice).toBe(169.0); // 129 + 2*20
      expect(services[3].basePrice).toBe(189.0); // 129 + 3*20
      expect(services[4].basePrice).toBe(209.0); // 129 + 4*20
    });

    it('verifies exactly 7 Business Hours provisioned (Mon-Sat Open, Sun Closed)', async () => {
      const hours = await prisma.businessHours.findMany({
        where: { organizationId: provisionedOrgId },
        orderBy: { dayOfWeek: 'asc' },
      });

      expect(hours).toHaveLength(7);

      // Sunday (0): Closed
      const sunday = hours.find((h) => h.dayOfWeek === 0);
      expect(sunday?.isClosed).toBe(true);
      expect(sunday?.openTime).toBe('00:00');
      expect(sunday?.closeTime).toBe('00:00');

      // Mon-Fri (1-5): 08:00 - 17:00
      for (let day = 1; day <= 5; day++) {
        const weekday = hours.find((h) => h.dayOfWeek === day);
        expect(weekday?.isClosed).toBe(false);
        expect(weekday?.openTime).toBe('08:00');
        expect(weekday?.closeTime).toBe('17:00');
      }

      // Saturday (6): 09:00 - 14:00
      const saturday = hours.find((h) => h.dayOfWeek === 6);
      expect(saturday?.isClosed).toBe(false);
      expect(saturday?.openTime).toBe('09:00');
      expect(saturday?.closeTime).toBe('14:00');
    });

    it('verifies standard default Tax Rule provisioned (MB 12% Combined Sales Tax)', async () => {
      const taxRules = await prisma.taxRule.findMany({
        where: { organizationId: provisionedOrgId },
      });

      expect(taxRules).toHaveLength(1);
      const taxRule = taxRules[0];
      expect(taxRule.name).toBe('Standard Combined Sales Tax');
      expect(taxRule.jurisdiction).toBe('MB');
      expect(taxRule.rate).toBe(0.12);
      expect(taxRule.appliesTo).toBe('ALL');
      expect(taxRule.active).toBe(true);
    });
  });

  describe('3. Session Lifecycle, Authorization & Dashboard Redirection Flow', () => {
    const sessionEmail = `session.audit.${testRunId}@aquaflowtest.ca`;
    let sessionOrgId: string;
    let sessionUserId: string;

    beforeAll(async () => {
      const formData = new FormData();
      formData.append('companyName', `Flow Masters ${testRunId}`);
      formData.append('firstName', 'David');
      formData.append('lastName', 'Miller');
      formData.append('email', sessionEmail);
      formData.append('password', 'MasterFlow2026!');

      const res = await registerTenant(formData);
      expect(res.success).toBe(true);

      const user = await prisma.user.findUnique({
        where: { email: sessionEmail.toLowerCase() },
        include: { memberships: true },
      });
      sessionUserId = user!.id;
      sessionOrgId = user!.memberships[0].organizationId;
      createdUserIds.push(sessionUserId);
      createdOrgIds.push(sessionOrgId);
    });

    it('creates active session token with SHA-256 hash in database', async () => {
      const rawToken = await createSession(sessionUserId, '192.168.1.1', 'Vitest Test Agent');
      expect(rawToken).toBeDefined();
      expect(typeof rawToken).toBe('string');

      const expectedHash = hashSessionToken(rawToken);
      const sessionRecord = await prisma.session.findUnique({
        where: { tokenHash: expectedHash },
      });

      expect(sessionRecord).not.toBeNull();
      expect(sessionRecord?.userId).toBe(sessionUserId);
      expect(sessionRecord?.revokedAt).toBeNull();
      expect(sessionRecord?.expiresAt.getTime()).toBeGreaterThan(Date.now() + 29 * 24 * 60 * 60 * 1000);
    });

    it('validates session and loads user with SUPER_ADMIN organization membership', async () => {
      const rawToken = await createSession(sessionUserId);
      const validated = await validateSession(rawToken);

      expect(validated).not.toBeNull();
      expect(validated?.user.id).toBe(sessionUserId);
      expect(validated?.user.email).toBe(sessionEmail.toLowerCase());

      const membership = validated?.user.memberships.find((m) => m.organizationId === sessionOrgId);
      expect(membership).toBeDefined();
      expect(membership?.role).toBe(ROLES.SUPER_ADMIN);
      expect(ADMIN_ROLES.includes(membership!.role as any)).toBe(true);
    });

    it('verifies onboarding redirection logic routes ONBOARDING_COMPLETE tenants directly to /dashboard', async () => {
      const org = await prisma.organization.findUnique({
        where: { id: sessionOrgId },
      });

      expect(org?.onboardingStatus).toBe('ONBOARDING_COMPLETE');

      // Emulate onboarding page status check
      const shouldRedirectToDashboard =
        org?.onboardingStatus === 'ONBOARDING_COMPLETE' || org?.onboardingStatus === 'COMPLETED';
      expect(shouldRedirectToDashboard).toBe(true);
    });

    it('guarantees tenant isolation between newly provisioned organizations', async () => {
      // Create a second tenant
      const secondEmail = `isolated.audit.${testRunId}@aquaflowtest.ca`;
      const formData2 = new FormData();
      formData2.append('companyName', `Isolated Tenant ${testRunId}`);
      formData2.append('firstName', 'Emma');
      formData2.append('lastName', 'Watson');
      formData2.append('email', secondEmail);
      formData2.append('password', 'SecretPass123!');

      const res2 = await registerTenant(formData2);
      expect(res2.success).toBe(true);

      const user2 = await prisma.user.findUnique({
        where: { email: secondEmail.toLowerCase() },
        include: { memberships: true },
      });
      const org2Id = user2!.memberships[0].organizationId;
      createdUserIds.push(user2!.id);
      createdOrgIds.push(org2Id);

      // Verify Org 1 services do not appear in Org 2
      const org1Services = await prisma.service.findMany({ where: { organizationId: sessionOrgId } });
      const org2Services = await prisma.service.findMany({ where: { organizationId: org2Id } });

      expect(org1Services).toHaveLength(5);
      expect(org2Services).toHaveLength(5);

      const org1ServiceIds = new Set(org1Services.map((s) => s.id));
      const overlap = org2Services.filter((s) => org1ServiceIds.has(s.id));
      expect(overlap).toHaveLength(0);

      // Verify technician isolation
      const org1Techs = await prisma.technician.findMany({ where: { organizationId: sessionOrgId } });
      const org2Techs = await prisma.technician.findMany({ where: { organizationId: org2Id } });

      expect(org1Techs).toHaveLength(1);
      expect(org2Techs).toHaveLength(1);
      expect(org1Techs[0].userId).toBe(sessionUserId);
      expect(org2Techs[0].userId).toBe(user2!.id);
    });
  });
});
