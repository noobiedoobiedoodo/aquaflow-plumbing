import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth/password';
import { createSession } from '@/lib/auth/session';

describe('Browser Workflow: Authentication & Role Directing', () => {
  const testEmail = `auth.test.${Date.now()}@aquaflow.internal`;
  let orgId: string;
  let userId: string;

  beforeEach(async () => {
    const org = await prisma.organization.create({
      data: {
        name: 'Auth Test Plumbing',
        slug: `auth-test-${Date.now()}`,
      },
    });
    orgId = org.id;

    const user = await prisma.user.create({
      data: {
        email: testEmail,
        passwordHash: await hashPassword('password123'),
        firstName: 'Auth',
        lastName: 'Tester',
      },
    });
    userId = user.id;

    await prisma.organizationMember.create({
      data: {
        userId,
        organizationId: orgId,
        role: 'ADMIN',
      },
    });
  });

  it('authenticates user and returns valid session cookie with organization context', async () => {
    const token = await createSession(userId, '127.0.0.1', 'Mozilla/5.0');
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');

    const userInDb = await prisma.user.findUnique({
      where: { id: userId },
      include: { memberships: true },
    });

    expect(userInDb?.email).toBe(testEmail);
    expect(userInDb?.memberships[0].role).toBe('ADMIN');
    expect(userInDb?.memberships[0].organizationId).toBe(orgId);
  });
});
