import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { prisma } from '@/lib/db';
import { randomUUID } from 'crypto';
import { POST as magicLinkHandler } from '@/app/api/auth/magic-link/route';
import { GET as verifyHandler } from '@/app/auth/verify/route';

import { RateLimiter } from '@/lib/security/rate-limiter';

describe('Multi-Tenant Customer Magic-Link Security & Authentication Matrix', () => {
  let orgAId: string;
  let orgBId: string;
  let orgASlug: string;
  let orgBSlug: string;
  let multiOrgUserEmail: string;
  let singleOrgUserEmail: string;
  let multiOrgUserId: string;
  let singleOrgUserId: string;
  let custAId: string;
  let custBId: string;
  let testIp: string;

  beforeEach(async () => {
    await RateLimiter.resetAll();
    const testId = randomUUID().slice(0, 8);
    testIp = `192.168.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}`;
    orgASlug = `apex-${testId}`;
    orgBSlug = `bluewave-${testId}`;
    multiOrgUserEmail = `shared.customer.${testId}@example.com`;
    singleOrgUserEmail = `single.customer.${testId}@example.com`;

    // 1. Create Org A & Org B
    const orgA = await prisma.organization.create({
      data: { name: `Apex Plumbing ${testId}`, slug: orgASlug },
    });
    const orgB = await prisma.organization.create({
      data: { name: `BlueWave Plumbing ${testId}`, slug: orgBSlug },
    });
    orgAId = orgA.id;
    orgBId = orgB.id;

    // 2. Create Multi-Org User with Customers in Org A and Org B
    const multiUser = await prisma.user.create({
      data: {
        email: multiOrgUserEmail,
        firstName: 'Shared',
        lastName: 'Customer',
        passwordHash: 'hash_123',
      },
    });
    multiOrgUserId = multiUser.id;

    const custA = await prisma.customer.create({
      data: {
        organizationId: orgAId,
        userId: multiUser.id,
        firstName: 'Shared',
        lastName: 'Customer',
      },
    });
    const custB = await prisma.customer.create({
      data: {
        organizationId: orgBId,
        userId: multiUser.id,
        firstName: 'Shared',
        lastName: 'Customer',
      },
    });
    custAId = custA.id;
    custBId = custB.id;

    // 3. Create Single-Org User with Customer in Org A only
    const singleUser = await prisma.user.create({
      data: {
        email: singleOrgUserEmail,
        firstName: 'Single',
        lastName: 'Customer',
        passwordHash: 'hash_123',
      },
    });
    singleOrgUserId = singleUser.id;

    await prisma.customer.create({
      data: {
        organizationId: orgAId,
        userId: singleUser.id,
        firstName: 'Single',
        lastName: 'Customer',
      },
    });
  });

  afterEach(async () => {
    await prisma.notification.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.customerSession.deleteMany({ where: { customer: { organizationId: { in: [orgAId, orgBId] } } } });
    await prisma.magicLinkToken.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.customer.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [multiOrgUserId, singleOrgUserId] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } });
  });

  it('Single-org customer → generic login creates single tenant-bound token', async () => {
    const req = new Request('http://localhost:3000/api/auth/magic-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': testIp },
      body: JSON.stringify({ email: singleOrgUserEmail }),
    });

    const res = await magicLinkHandler(req);
    expect(res.status).toBe(200);

    const tokens = await prisma.magicLinkToken.findMany({
      where: { user: { email: singleOrgUserEmail } },
    });
    expect(tokens.length).toBe(1);
    expect(tokens[0].organizationId).toBe(orgAId);
  });

  it('Multi-org customer → generic login never silently chooses customers[0], creates distinct single-tenant tokens', async () => {
    const req = new Request('http://localhost:3000/api/auth/magic-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': testIp },
      body: JSON.stringify({ email: multiOrgUserEmail }),
    });

    const res = await magicLinkHandler(req);
    expect(res.status).toBe(200);

    const tokens = await prisma.magicLinkToken.findMany({
      where: { user: { email: multiOrgUserEmail } },
      orderBy: { organizationId: 'asc' },
    });

    // Must generate 2 distinct tokens: 1 for Org A, 1 for Org B
    expect(tokens.length).toBe(2);
    const orgIds = tokens.map((t) => t.organizationId);
    expect(orgIds).toContain(orgAId);
    expect(orgIds).toContain(orgBId);

    const notifications = await prisma.notification.findMany({
      where: { userId: multiOrgUserId },
    });
    expect(notifications.length).toBe(2);
  });

  it('Org A slug → issues token exclusively for Org A customer', async () => {
    const req = new Request('http://localhost:3000/api/auth/magic-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': testIp },
      body: JSON.stringify({ email: multiOrgUserEmail, organizationSlug: orgASlug }),
    });

    const res = await magicLinkHandler(req);
    expect(res.status).toBe(200);

    const tokens = await prisma.magicLinkToken.findMany({
      where: { user: { email: multiOrgUserEmail } },
    });
    expect(tokens.length).toBe(1);
    expect(tokens[0].organizationId).toBe(orgAId);
    expect(tokens[0].customerId).toBe(custAId);
  });

  it('Org B slug → issues token exclusively for Org B customer', async () => {
    const req = new Request('http://localhost:3000/api/auth/magic-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': testIp },
      body: JSON.stringify({ email: multiOrgUserEmail, organizationSlug: orgBSlug }),
    });

    const res = await magicLinkHandler(req);
    expect(res.status).toBe(200);

    const tokens = await prisma.magicLinkToken.findMany({
      where: { user: { email: multiOrgUserEmail } },
    });
    expect(tokens.length).toBe(1);
    expect(tokens[0].organizationId).toBe(orgBId);
    expect(tokens[0].customerId).toBe(custBId);
  });

  it('Org A magic link creates session bound only to Org A customer and cannot authenticate Org B', async () => {
    // 1. Request Org A magic link
    const req = new Request('http://localhost:3000/api/auth/magic-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': testIp },
      body: JSON.stringify({ email: multiOrgUserEmail, organizationSlug: orgASlug }),
    });
    await magicLinkHandler(req);

    const notification = await prisma.notification.findFirst({
      where: { userId: multiOrgUserId, organizationId: orgAId },
    });
    expect(notification).toBeDefined();

    // Extract raw token from notification content
    const tokenMatch = notification!.content.match(/token=([a-zA-Z0-9_-]+)/);
    expect(tokenMatch).toBeDefined();
    const rawToken = tokenMatch![1];

    // Verify token
    const verifyReq = new Request(`http://localhost:3000/auth/verify?token=${rawToken}`);
    const verifyRes = await verifyHandler(verifyReq);
    expect(verifyRes.status).toBe(307); // Next.js redirect

    // Find created CustomerSession
    const session = await prisma.customerSession.findFirst({
      where: { customerId: custAId },
    });
    expect(session).toBeDefined();
    expect(session!.customerId).toBe(custAId);

    // Verify no session was created for Customer B
    const sessionB = await prisma.customerSession.findFirst({
      where: { customerId: custBId },
    });
    expect(sessionB).toBeNull();
  });

  it('Replayed or expired magic link token is rejected (400)', async () => {
    const req = new Request('http://localhost:3000/api/auth/magic-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': testIp },
      body: JSON.stringify({ email: singleOrgUserEmail }),
    });
    await magicLinkHandler(req);

    const notification = await prisma.notification.findFirst({
      where: { organizationId: orgAId },
    });
    const tokenMatch = notification!.content.match(/token=([a-zA-Z0-9_-]+)/);
    const rawToken = tokenMatch![1];

    // First use: success
    const res1 = await verifyHandler(new Request(`http://localhost:3000/auth/verify?token=${rawToken}`));
    expect(res1.status).toBe(307);

    // Replay attempt: rejected
    const res2 = await verifyHandler(new Request(`http://localhost:3000/auth/verify?token=${rawToken}`));
    expect(res2.status).toBe(400);
  });

  it('Unknown email does not reveal existence (anti-enumeration response)', async () => {
    const req = new Request('http://localhost:3000/api/auth/magic-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': testIp },
      body: JSON.stringify({ email: `unknown.${randomUUID().slice(0, 6)}@example.com` }),
    });

    const res = await magicLinkHandler(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.message).toBe('If an account exists, a sign-in link has been sent to this email.');
  });
});
