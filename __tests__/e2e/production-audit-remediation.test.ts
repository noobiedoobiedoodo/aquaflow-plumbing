import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/db';
import { randomUUID } from 'crypto';
import { hashSessionToken, createSession } from '@/lib/auth/session';
import { hashToken } from '@/lib/auth/customer-session';
import { generateAppointmentNumber, generateQuoteNumber, generateInvoiceNumber } from '@/lib/utils';
import { PaymentService } from '@/lib/services/payment-service';
import { validateEnvironment } from '@/lib/config/env';
import { getStorageProvider } from '@/lib/storage';
import { POST as registerHandler } from '@/app/api/auth/register/route';
import { POST as resendWebhookHandler } from '@/app/api/webhooks/resend/route';
import { POST as twilioWebhookHandler } from '@/app/api/webhooks/twilio/route';

describe('Production Audit Remediation & Regression Test Suite', () => {
  const testId = randomUUID().slice(0, 8);
  let orgAId: string;
  let orgBId: string;
  let userAdminId: string;
  let userStaffId: string;
  let customerUserId: string;

  beforeAll(async () => {
    // Setup 2 distinct organizations for multi-tenant tests
    const orgA = await prisma.organization.create({
      data: { name: `Remediation Org A ${testId}`, slug: `remed-org-a-${testId}` },
    });
    orgAId = orgA.id;

    const orgB = await prisma.organization.create({
      data: { name: `Remediation Org B ${testId}`, slug: `remed-org-b-${testId}` },
    });
    orgBId = orgB.id;

    const adminUser = await prisma.user.create({
      data: {
        email: `admin.${testId}@test.com`,
        firstName: 'Admin',
        lastName: 'User',
        passwordHash: 'dummy',
        memberships: {
          create: { organizationId: orgA.id, role: 'ADMIN' },
        },
      },
    });
    userAdminId = adminUser.id;

    const staffUser = await prisma.user.create({
      data: {
        email: `tech.${testId}@test.com`,
        firstName: 'Tech',
        lastName: 'User',
        passwordHash: 'dummy',
        memberships: {
          create: { organizationId: orgA.id, role: 'TECHNICIAN' },
        },
      },
    });
    userStaffId = staffUser.id;

    const custUser = await prisma.user.create({
      data: {
        email: `cust.${testId}@test.com`,
        firstName: 'Cust',
        lastName: 'User',
      },
    });
    customerUserId = custUser.id;
  });

  afterAll(async () => {
    await prisma.financialActivity.deleteMany({
      where: { invoice: { organizationId: { in: [orgAId, orgBId] } } },
    });
    await prisma.payment.deleteMany({
      where: { invoice: { organizationId: { in: [orgAId, orgBId] } } },
    });
    await prisma.invoiceLine.deleteMany({
      where: { invoice: { organizationId: { in: [orgAId, orgBId] } } },
    });
    await prisma.invoiceTax.deleteMany({
      where: { invoice: { organizationId: { in: [orgAId, orgBId] } } },
    });
    await prisma.invoice.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.job.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.appointment.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.property.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.service.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.customer.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.event.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.organizationMember.deleteMany({
      where: { organizationId: { in: [orgAId, orgBId] } },
    });
    await prisma.user.deleteMany({ where: { id: { in: [userAdminId, userStaffId, customerUserId] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } });
  });

  // ==========================================
  // C-03: Collision-Resistant ID Generation
  // ==========================================
  describe('C-03: Cryptographically Safe ID Generation', () => {
    it('generates appointment numbers with 8-character hex crypto-random suffix', () => {
      const ids = new Set<string>();
      const currentYear = new Date().getFullYear();
      for (let i = 0; i < 50; i++) {
        const id = generateAppointmentNumber();
        expect(id).toMatch(new RegExp(`^PL-${currentYear}-[A-F0-9]{8}$`));
        ids.add(id);
      }
      expect(ids.size).toBe(50); // No collisions
    });

    it('generates quote and invoice numbers with collision-resistant format', () => {
      const qNum = generateQuoteNumber();
      const invNum = generateInvoiceNumber();
      expect(qNum).toMatch(/^QT-\d{4}-[A-F0-9]{8}$/);
      expect(invNum).toMatch(/^INV-\d{4}-[A-F0-9]{8}$/);
    });
  });

  // ==========================================
  // S-11: HMAC-SHA256 Session Hashing
  // ==========================================
  describe('S-11: HMAC-SHA256 Token Hashing with SESSION_SECRET', () => {
    it('hashes session tokens using HMAC rather than plain SHA-256', () => {
      const rawToken = 'test-token-12345';
      const hash1 = hashSessionToken(rawToken);
      const hash2 = hashToken(rawToken);

      expect(hash1).toBeDefined();
      expect(typeof hash1).toBe('string');
      expect(hash1.length).toBe(64); // 256-bit hex
      expect(hash1).toBe(hash2); // Same HMAC algorithm and secret
    });
  });

  // ==========================================
  // C-04: /api/auth/register Locked Down
  // ==========================================
  describe('C-04: /api/auth/register Locked Down against Orphan Account Creation', () => {
    it('returns HTTP 403 Forbidden with disabled registration message', async () => {
      const req = new Request('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '192.168.1.50',
        },
        body: JSON.stringify({
          email: 'attacker@evil.com',
          password: 'Password123!',
          firstName: 'Evil',
          lastName: 'Hacker',
        }),
      });

      const res = await registerHandler(req);
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toContain('Direct user registration is disabled');
    });
  });

  // ==========================================
  // F-01: PaymentService Partial Payment Logic
  // ==========================================
  describe('F-01: PaymentService Partial Payment Calculation', () => {
    it('marks invoice PARTIALLY_PAID when payment is less than total', async () => {
      const customer = await prisma.customer.create({
        data: {
          organization: { connect: { id: orgAId } },
          user: { connect: { id: customerUserId } },
          firstName: 'Partial',
          lastName: 'Payer',
        },
      });

      const property = await prisma.property.create({
        data: {
          organization: { connect: { id: orgAId } },
          customer: { connect: { id: customer.id } },
          address: '123 Test St',
          city: 'Winnipeg',
          province: 'MB',
          postalCode: 'R3C 1A1',
        },
      });

      const service = await prisma.service.create({
        data: {
          organization: { connect: { id: orgAId } },
          name: 'Test Service',
          slug: `test-service-${testId}`,
          basePrice: 100,
        },
      });

      const appt = await prisma.appointment.create({
        data: {
          appointmentNumber: `APPT-REMED-${testId}`,
          organization: { connect: { id: orgAId } },
          customer: { connect: { id: customer.id } },
          property: { connect: { id: property.id } },
          service: { connect: { id: service.id } },
          date: new Date(),
          startTime: '10:00',
          endTime: '12:00',
          status: 'COMPLETED',
        },
      });

      const job = await prisma.job.create({
        data: {
          organization: { connect: { id: orgAId } },
          appointment: { connect: { id: appt.id } },
          status: 'COMPLETED',
        },
      });

      const invoice = await prisma.invoice.create({
        data: {
          organization: { connect: { id: orgAId } },
          customer: { connect: { id: customer.id } },
          job: { connect: { id: job.id } },
          invoiceNumber: `INV-TEST-PARTIAL-${testId}`,
          subtotal: 500,
          taxTotal: 50,
          total: 550,
          amountPaid: 0,
          status: 'SENT',
          paymentToken: randomUUID(),
          dueDate: new Date(),
        },
      });

      // Partial payment of $200 against $550 total
      const result = await PaymentService.processPaymentSuccess(
        orgAId,
        invoice.id,
        200,
        `tx_partial_${testId}`
      );

      expect(result.invoice.status).toBe('PARTIALLY_PAID');
      expect(result.invoice.amountPaid).toBe(200);

      // Remaining payment of $350
      const finalResult = await PaymentService.processPaymentSuccess(
        orgAId,
        invoice.id,
        350,
        `tx_final_${testId}`
      );

      expect(finalResult.invoice.status).toBe('PAID');
      expect(finalResult.invoice.amountPaid).toBe(550);

      // Cleanup
      await prisma.financialActivity.deleteMany({ where: { invoiceId: invoice.id } });
      await prisma.payment.deleteMany({ where: { invoiceId: invoice.id } });
      await prisma.invoice.delete({ where: { id: invoice.id } });
      await prisma.job.delete({ where: { id: job.id } });
      await prisma.appointment.delete({ where: { id: appt.id } });
      await prisma.service.delete({ where: { id: service.id } });
      await prisma.property.delete({ where: { id: property.id } });
      await prisma.customer.delete({ where: { id: customer.id } });
    });
  });

  // ==========================================
  // F-02: Storage Fail-Closed in Production
  // ==========================================
  describe('F-02: Storage Fail-Closed Validation', () => {
    it('throws error when AWS_S3_BUCKET_NAME is missing in production environment', () => {
      const originalEnv = process.env.NODE_ENV;
      const originalBucket = process.env.AWS_S3_BUCKET_NAME;

      try {
        process.env.NODE_ENV = 'production';
        delete process.env.AWS_S3_BUCKET_NAME;

        expect(() => getStorageProvider()).toThrowError(/AWS_S3_BUCKET_NAME is required in production/);
      } finally {
        process.env.NODE_ENV = originalEnv;
        if (originalBucket) process.env.AWS_S3_BUCKET_NAME = originalBucket;
      }
    });
  });

  // ==========================================
  // S-09: Resend & Twilio Fail Closed in Prod
  // ==========================================
  describe('S-09: Resend and Twilio Webhooks Fail Closed in Production', () => {
    it('Resend webhook returns 500 in production if RESEND_WEBHOOK_SECRET is missing', async () => {
      const originalEnv = process.env.NODE_ENV;
      const originalSecret = process.env.RESEND_WEBHOOK_SECRET;

      try {
        process.env.NODE_ENV = 'production';
        delete process.env.RESEND_WEBHOOK_SECRET;

        const req = new Request('http://localhost:3000/api/webhooks/resend', {
          method: 'POST',
          body: JSON.stringify({ type: 'email.delivered' }),
        });

        const res = await resendWebhookHandler(req);
        expect(res.status).toBe(500);
      } finally {
        process.env.NODE_ENV = originalEnv;
        if (originalSecret) process.env.RESEND_WEBHOOK_SECRET = originalSecret;
      }
    });

    it('Twilio webhook returns 500 in production if TWILIO_AUTH_TOKEN is missing', async () => {
      const originalEnv = process.env.NODE_ENV;
      const originalToken = process.env.TWILIO_AUTH_TOKEN;

      try {
        process.env.NODE_ENV = 'production';
        delete process.env.TWILIO_AUTH_TOKEN;

        const req = new Request('http://localhost:3000/api/webhooks/twilio', {
          method: 'POST',
          body: 'MessageSid=SM12345&MessageStatus=delivered',
        });

        const res = await twilioWebhookHandler(req);
        expect(res.status).toBe(500);
      } finally {
        process.env.NODE_ENV = originalEnv;
        if (originalToken) process.env.TWILIO_AUTH_TOKEN = originalToken;
      }
    });
  });
});
