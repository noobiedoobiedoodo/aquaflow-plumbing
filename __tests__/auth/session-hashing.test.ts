import { expect, test, describe, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../src/lib/db';
import { createSession, validateSession, revokeSession, hashSessionToken } from '../../src/lib/auth/session';
import { randomUUID } from 'crypto';

describe('Admin Session Token Hashing Suite', () => {
  let userId: string;
  let orgId: string;

  beforeAll(async () => {
    const testId = randomUUID().slice(0, 8);
    const org = await prisma.organization.create({
      data: { name: `Session Org ${testId}`, slug: `session-org-${testId}` },
    });
    orgId = org.id;

    const user = await prisma.user.create({
      data: {
        email: `session-user-${testId}@test.com`,
        firstName: 'Session',
        lastName: 'Admin',
        passwordHash: 'hashed',
        memberships: {
          create: { organizationId: org.id, role: 'SUPER_ADMIN' },
        },
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.session.deleteMany({ where: { userId } });
    await prisma.organizationMember.deleteMany({ where: { organizationId: orgId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
  });

  test('createSession stores SHA-256 tokenHash in DB and never stores raw token', async () => {
    const rawToken = await createSession(userId, '127.0.0.1', 'Vitest Agent');
    expect(rawToken).toBeDefined();
    expect(typeof rawToken).toBe('string');

    const expectedHash = hashSessionToken(rawToken);

    // Direct DB inspection
    const dbRecord = await prisma.session.findUnique({
      where: { tokenHash: expectedHash },
    });

    expect(dbRecord).not.toBeNull();
    expect(dbRecord?.tokenHash).toBe(expectedHash);
    expect(dbRecord?.userId).toBe(userId);
  });

  test('validateSession succeeds with rawToken by computing hash on lookup', async () => {
    const rawToken = await createSession(userId);
    const validated = await validateSession(rawToken);

    expect(validated).not.toBeNull();
    expect(validated?.user.id).toBe(userId);
    expect(validated?.user.memberships[0].role).toBe('SUPER_ADMIN');
  });

  test('validateSession fails for invalid or tampered token', async () => {
    const fakeToken = 'tampered_fake_token_12345';
    const validated = await validateSession(fakeToken);
    expect(validated).toBeNull();
  });

  test('revokeSession marks session revokedAt in DB', async () => {
    const rawToken = await createSession(userId);
    await revokeSession(rawToken);

    const validated = await validateSession(rawToken);
    expect(validated).toBeNull();

    const tokenHash = hashSessionToken(rawToken);
    const dbSession = await prisma.session.findUnique({ where: { tokenHash } });
    expect(dbSession?.revokedAt).not.toBeNull();
  });
});
