import { expect, test, describe, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../src/lib/db';
import { randomUUID } from 'crypto';
import { POST as stripeWebhookHandler } from '../../src/app/api/webhooks/stripe/route';
import { NextRequest } from 'next/server';
import Stripe from 'stripe';

describe('Phase 7: Stripe Webhook Fail-Closed Enforcement Suite', () => {
  const testId = randomUUID().slice(0, 8);
  const stripeAccountIdA = `acct_apex_${testId}`;
  const stripeAccountIdB = `acct_blueridge_${testId}`;

  let orgAId: string;
  let orgBId: string;
  let orgNoStripeId: string;
  let invoiceAId: string;
  let invoiceBId: string;
  let invoiceNoStripeId: string;

  beforeAll(async () => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_mock';
    process.env.STRIPE_SECRET_KEY = 'sk_test_mock';

    // Org A with connected Stripe account
    const orgA = await prisma.organization.create({
      data: {
        name: `Org A ${testId}`,
        slug: `org-a-${testId}`,
        stripeAccountId: stripeAccountIdA,
        stripeConnectionStatus: 'ACTIVE',
      },
    });
    orgAId = orgA.id;

    // Org B with connected Stripe account
    const orgB = await prisma.organization.create({
      data: {
        name: `Org B ${testId}`,
        slug: `org-b-${testId}`,
        stripeAccountId: stripeAccountIdB,
        stripeConnectionStatus: 'ACTIVE',
      },
    });
    orgBId = orgB.id;

    // Org with NO connected Stripe account
    const orgNoStripe = await prisma.organization.create({
      data: {
        name: `Org No Stripe ${testId}`,
        slug: `org-nostripe-${testId}`,
        stripeAccountId: null,
      },
    });
    orgNoStripeId = orgNoStripe.id;

    // Customer
    const user = await prisma.user.create({
      data: { email: `stripe-test-${testId}@test.com`, firstName: 'Test', lastName: 'Cust', passwordHash: 'none' },
    });

    const custA = await prisma.customer.create({ data: { organizationId: orgAId, userId: user.id, firstName: 'A', lastName: 'C' } });
    const custB = await prisma.customer.create({ data: { organizationId: orgBId, userId: user.id, firstName: 'B', lastName: 'C' } });
    const custNoStripe = await prisma.customer.create({ data: { organizationId: orgNoStripeId, userId: user.id, firstName: 'N', lastName: 'C' } });

    // Properties
    const propA = await prisma.property.create({ data: { organizationId: orgAId, customerId: custA.id, address: '100 Main St', city: 'Winnipeg', postalCode: 'R3C1A1' } });
    const propB = await prisma.property.create({ data: { organizationId: orgBId, customerId: custB.id, address: '200 Main St', city: 'Winnipeg', postalCode: 'R3C1A1' } });
    const propNoStripe = await prisma.property.create({ data: { organizationId: orgNoStripeId, customerId: custNoStripe.id, address: '300 Main St', city: 'Winnipeg', postalCode: 'R3C1A1' } });

    // Services
    const servA = await prisma.service.create({ data: { organizationId: orgAId, name: 'Service A', slug: `serv-a-${testId}` } });
    const servB = await prisma.service.create({ data: { organizationId: orgBId, name: 'Service B', slug: `serv-b-${testId}` } });
    const servNoStripe = await prisma.service.create({ data: { organizationId: orgNoStripeId, name: 'Service N', slug: `serv-n-${testId}` } });

    // Appointments
    const apptA = await prisma.appointment.create({ data: { appointmentNumber: `APPT-A-${testId}`, organizationId: orgAId, customerId: custA.id, propertyId: propA.id, serviceId: servA.id, date: new Date(), startTime: '09:00', endTime: '10:00' } });
    const apptB = await prisma.appointment.create({ data: { appointmentNumber: `APPT-B-${testId}`, organizationId: orgBId, customerId: custB.id, propertyId: propB.id, serviceId: servB.id, date: new Date(), startTime: '09:00', endTime: '10:00' } });
    const apptNoStripe = await prisma.appointment.create({ data: { appointmentNumber: `APPT-N-${testId}`, organizationId: orgNoStripeId, customerId: custNoStripe.id, propertyId: propNoStripe.id, serviceId: servNoStripe.id, date: new Date(), startTime: '09:00', endTime: '10:00' } });

    // Jobs
    const jobA = await prisma.job.create({ data: { organizationId: orgAId, appointmentId: apptA.id, status: 'COMPLETED' } });
    const jobB = await prisma.job.create({ data: { organizationId: orgBId, appointmentId: apptB.id, status: 'COMPLETED' } });
    const jobNoStripe = await prisma.job.create({ data: { organizationId: orgNoStripeId, appointmentId: apptNoStripe.id, status: 'COMPLETED' } });

    // Invoices
    const invA = await prisma.invoice.create({
      data: {
        organizationId: orgAId,
        customerId: custA.id,
        jobId: jobA.id,
        invoiceNumber: `INV-A-${testId}`,
        total: 100,
        subtotal: 95,
        taxTotal: 5,
        paymentToken: randomUUID(),
        status: 'SENT',
      },
    });
    invoiceAId = invA.id;

    const invB = await prisma.invoice.create({
      data: {
        organizationId: orgBId,
        customerId: custB.id,
        jobId: jobB.id,
        invoiceNumber: `INV-B-${testId}`,
        total: 200,
        subtotal: 190,
        taxTotal: 10,
        paymentToken: randomUUID(),
        status: 'SENT',
      },
    });
    invoiceBId = invB.id;

    const invNoStripe = await prisma.invoice.create({
      data: {
        organizationId: orgNoStripeId,
        customerId: custNoStripe.id,
        jobId: jobNoStripe.id,
        invoiceNumber: `INV-NOSTRIPE-${testId}`,
        total: 50,
        subtotal: 50,
        taxTotal: 0,
        paymentToken: randomUUID(),
        status: 'SENT',
      },
    });
    invoiceNoStripeId = invNoStripe.id;
  });

  afterAll(async () => {
    process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_mock';
    process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_mock';

    await prisma.stripeWebhookEvent.deleteMany({});
    await prisma.financialActivity.deleteMany({});
    await prisma.payment.deleteMany({ where: { invoiceId: { in: [invoiceAId, invoiceBId, invoiceNoStripeId].filter(Boolean) } } });
    await prisma.invoice.deleteMany({ where: { id: { in: [invoiceAId, invoiceBId, invoiceNoStripeId].filter(Boolean) } } });
    await prisma.job.deleteMany({ where: { organizationId: { in: [orgAId, orgBId, orgNoStripeId] } } });
    await prisma.appointment.deleteMany({ where: { organizationId: { in: [orgAId, orgBId, orgNoStripeId] } } });
    await prisma.property.deleteMany({ where: { organizationId: { in: [orgAId, orgBId, orgNoStripeId] } } });
    await prisma.service.deleteMany({ where: { organizationId: { in: [orgAId, orgBId, orgNoStripeId] } } });
    await prisma.customer.deleteMany({ where: { organizationId: { in: [orgAId, orgBId, orgNoStripeId] } } });
    await prisma.event.deleteMany({ where: { organizationId: { in: [orgAId, orgBId, orgNoStripeId] } } });
    await prisma.user.deleteMany({ where: { email: `stripe-test-${testId}@test.com` } });
    await prisma.organization.deleteMany({ where: { id: { in: [orgAId, orgBId, orgNoStripeId] } } });
  });

  function createMockStripeWebhookRequest(
    eventObj: any,
    secret: string = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_mock'
  ): NextRequest {
    const payload = JSON.stringify(eventObj);
    const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_mock', { apiVersion: '2025-02-24.acacia' as any });
    const header = stripeClient.webhooks.generateTestHeaderString({
      payload,
      secret,
    });

    return new NextRequest('http://localhost:3000/api/webhooks/stripe', {
      method: 'POST',
      headers: {
        'stripe-signature': header,
        'content-type': 'application/json',
      },
      body: payload,
    });
  }

  test('Matrix 1: Valid signature + matching account -> ACCEPT', async () => {
    const eventId = `evt_valid_${randomUUID().slice(0, 8)}`;
    const piId = `pi_valid_${randomUUID().slice(0, 8)}`;

    const event = {
      id: eventId,
      object: 'event',
      type: 'payment_intent.succeeded',
      account: stripeAccountIdA, // Matches Org A
      data: {
        object: {
          id: piId,
          object: 'payment_intent',
          amount: 10000,
          currency: 'cad',
          metadata: { invoiceId: invoiceAId },
        },
      },
    };

    const req = createMockStripeWebhookRequest(event);
    const res = await stripeWebhookHandler(req);

    expect(res.status).toBe(200);

    // Verify invoice is paid
    const updatedInvoice = await prisma.invoice.findUnique({ where: { id: invoiceAId } });
    expect(updatedInvoice?.status).toBe('PAID');
    expect(updatedInvoice?.amountPaid).toBe(100);

    const payment = await prisma.payment.findUnique({ where: { providerPaymentId: piId } });
    expect(payment).not.toBeNull();
    expect(payment?.status).toBe('SUCCEEDED');
  });

  test('Matrix 2: Valid signature + wrong account -> REJECT', async () => {
    const eventId = `evt_wrong_acct_${randomUUID().slice(0, 8)}`;
    const piId = `pi_spoof_${randomUUID().slice(0, 8)}`;

    const event = {
      id: eventId,
      object: 'event',
      type: 'payment_intent.succeeded',
      account: stripeAccountIdB, // Wrong account: Org B attempting to pay Org A's invoice!
      data: {
        object: {
          id: piId,
          object: 'payment_intent',
          amount: 10000,
          currency: 'cad',
          metadata: { invoiceId: invoiceAId },
        },
      },
    };

    const req = createMockStripeWebhookRequest(event);
    const res = await stripeWebhookHandler(req);

    expect(res.status).toBe(400);
    const body = await res.text();
    expect(body).toContain('Security Rejection');

    // Verify no payment was recorded under this spoofed attempt
    const payment = await prisma.payment.findUnique({ where: { providerPaymentId: piId } });
    expect(payment).toBeNull();
  });

  test('Matrix 3: Valid signature + missing org Stripe account -> REJECT (Fail-Closed)', async () => {
    const eventId = `evt_missing_org_${randomUUID().slice(0, 8)}`;
    const piId = `pi_missing_${randomUUID().slice(0, 8)}`;

    const event = {
      id: eventId,
      object: 'event',
      type: 'payment_intent.succeeded',
      account: stripeAccountIdA,
      data: {
        object: {
          id: piId,
          object: 'payment_intent',
          amount: 5000,
          currency: 'cad',
          metadata: { invoiceId: invoiceNoStripeId }, // Org has null stripeAccountId
        },
      },
    };

    const req = createMockStripeWebhookRequest(event);
    const res = await stripeWebhookHandler(req);

    expect(res.status).toBe(400);
    const body = await res.text();
    expect(body).toContain('Security Rejection');

    const payment = await prisma.payment.findUnique({ where: { providerPaymentId: piId } });
    expect(payment).toBeNull();
  });

  test('Matrix 4: Invalid signature -> REJECT', async () => {
    const event = {
      id: `evt_invalid_sig_${randomUUID().slice(0, 8)}`,
      type: 'payment_intent.succeeded',
      account: stripeAccountIdA,
      data: { object: { id: 'pi_test', amount: 1000, metadata: { invoiceId: invoiceAId } } },
    };

    const req = createMockStripeWebhookRequest(event, 'whsec_INVALID_SECRET_KEY');
    const res = await stripeWebhookHandler(req);

    expect(res.status).toBe(400);
    const body = await res.text();
    expect(body).toContain('Webhook Error');
  });

  test('Matrix 5: Duplicate valid event -> 200 Idempotent', async () => {
    const eventId = `evt_duplicate_${randomUUID().slice(0, 8)}`;
    const piId = `pi_dup_${randomUUID().slice(0, 8)}`;

    const event = {
      id: eventId,
      object: 'event',
      type: 'payment_intent.succeeded',
      account: stripeAccountIdB,
      data: {
        object: {
          id: piId,
          object: 'payment_intent',
          amount: 20000,
          currency: 'cad',
          metadata: { invoiceId: invoiceBId },
        },
      },
    };

    // First delivery
    const req1 = createMockStripeWebhookRequest(event);
    const res1 = await stripeWebhookHandler(req1);
    expect(res1.status).toBe(200);

    // Duplicate delivery
    const req2 = createMockStripeWebhookRequest(event);
    const res2 = await stripeWebhookHandler(req2);
    expect(res2.status).toBe(200);
  });
});
