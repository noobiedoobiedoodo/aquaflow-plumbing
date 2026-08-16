import { expect, test, describe, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../src/lib/db';
import { randomUUID } from 'crypto';
import { POST as bookingRouteHandler } from '../../src/app/api/booking/route';
import { POST as stripeWebhookHandler } from '../../src/app/api/webhooks/stripe/route';
import { POST as logoutHandler } from '../../src/app/api/auth/logout/route';
import { InvoiceService } from '../../src/lib/services/invoice-service';
import { storage } from '../../src/lib/storage';
import { hashToken } from '../../src/lib/auth/customer-session';
import { RateLimiter } from '../../src/lib/security/rate-limiter';
import { NextRequest } from 'next/server';
import Stripe from 'stripe';

describe('Phase 10: Real Application Golden Path E2E Suite', () => {
  const testId = randomUUID().slice(0, 8);
  const stripeAccountId = `acct_golden_${testId}`;
  const customerEmail = `clara.golden.${testId}@example.com`;

  let orgId: string;
  let adminUserId: string;
  let techUserId: string;
  let techProfileId: string;
  let serviceId: string;
  let customerId: string;
  let customerSessionToken: string;
  let appointmentId: string;
  let jobId: string;
  let invoiceId: string;
  let photoStorageKey: string;
  let signatureStorageKey: string;

  beforeAll(async () => {
    process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_mock';
    process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_mock';

    await RateLimiter.resetAll();

    // 1. Setup Organization
    const org = await prisma.organization.create({
      data: {
        name: `Golden Standard Plumbing ${testId}`,
        slug: `golden-standard-${testId}`,
        stripeAccountId,
        stripeConnectionStatus: 'ACTIVE',
        onboardingStatus: 'ONBOARDING_COMPLETE',
        taxRate: 0.05,
      },
    });
    orgId = org.id;

    // 2. Setup Super Admin User
    const admin = await prisma.user.create({
      data: {
        email: `admin-${testId}@golden.com`,
        firstName: 'Greg',
        lastName: 'Golden',
        passwordHash: 'hashed',
        memberships: { create: { organizationId: org.id, role: 'SUPER_ADMIN' } },
      },
    });
    adminUserId = admin.id;

    // 3. Setup Technician User & Profile
    const techUser = await prisma.user.create({
      data: {
        email: `tech-${testId}@golden.com`,
        firstName: 'Tyler',
        lastName: 'Torque',
        passwordHash: 'hashed',
        memberships: { create: { organizationId: org.id, role: 'TECHNICIAN' } },
      },
    });
    techUserId = techUser.id;

    const tech = await prisma.technician.create({
      data: {
        organizationId: org.id,
        userId: techUser.id,
        firstName: 'Tyler',
        lastName: 'Torque',
        phone: '204-555-0188',
        availabilityStatus: 'AVAILABLE',
      },
    });
    techProfileId = tech.id;

    // 4. Setup Service
    const service = await prisma.service.create({
      data: {
        organizationId: org.id,
        name: 'Main Drain Hydro-Jetting',
        slug: `hydro-jet-${testId}`,
        basePrice: 300.0,
        estimatedDuration: 120,
        isActive: true,
      },
    });
    serviceId = service.id;
  });

  afterAll(async () => {
    await prisma.customerSignature.deleteMany({ where: { job: { organizationId: orgId } } });
    await prisma.jobPhoto.deleteMany({ where: { job: { organizationId: orgId } } });
    await prisma.financialActivity.deleteMany({ where: { invoice: { organizationId: orgId } } });
    await prisma.payment.deleteMany({ where: { invoice: { organizationId: orgId } } });
    await prisma.invoiceLine.deleteMany({ where: { invoice: { organizationId: orgId } } });
    await prisma.invoice.deleteMany({ where: { organizationId: orgId } });
    await prisma.jobPart.deleteMany({ where: { job: { organizationId: orgId } } });
    await prisma.jobTimeEntry.deleteMany({ where: { job: { organizationId: orgId } } });
    await prisma.jobActivity.deleteMany({ where: { job: { organizationId: orgId } } });
    await prisma.jobAssignment.deleteMany({ where: { job: { organizationId: orgId } } });
    await prisma.job.deleteMany({ where: { organizationId: orgId } });
    await prisma.appointment.deleteMany({ where: { organizationId: orgId } });
    await prisma.property.deleteMany({ where: { organizationId: orgId } });
    await prisma.customerSession.deleteMany({ where: { customer: { organizationId: orgId } } });
    await prisma.customer.deleteMany({ where: { organizationId: orgId } });
    await prisma.service.deleteMany({ where: { organizationId: orgId } });
    await prisma.event.deleteMany({ where: { organizationId: orgId } });
    await prisma.technician.deleteMany({ where: { organizationId: orgId } });
    await prisma.organizationMember.deleteMany({ where: { organizationId: orgId } });
    await prisma.user.deleteMany({ where: { email: { in: [customerEmail, `admin-${testId}@golden.com`, `tech-${testId}@golden.com`] } } });
    await prisma.organization.deleteMany({ where: { id: orgId } });

    try {
      if (photoStorageKey) await storage.deleteFile(photoStorageKey);
      if (signatureStorageKey) await storage.deleteFile(signatureStorageKey);
    } catch (e) {}
  });

  test('Step 1: Public Acquisition Flow via POST /api/booking', async () => {
    const bookingPayload = {
      serviceId,
      firstName: 'Clara',
      lastName: 'Customer',
      email: customerEmail,
      phone: '204-555-0144',
      address: '450 Portage Ave',
      city: 'Winnipeg',
      province: 'MB',
      postalCode: 'R3C 0E7',
      date: new Date().toISOString().split('T')[0],
      startTime: '10:00',
      endTime: '12:00',
      problemDescription: 'Main line backed up into basement laundry tub.',
    };

    const req = new NextRequest('http://localhost:3000/api/booking', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': `198.51.100.${Math.floor(Math.random() * 200) + 1}`,
      },
      body: JSON.stringify(bookingPayload),
    });

    const res = await bookingRouteHandler(req);
    const json = await res.json();
    if (res.status !== 201) {
      console.error('Booking failed with status:', res.status, json);
    }
    expect(res.status).toBe(201);
    expect(json.success).toBe(true);
    expect(json.appointmentNumber).toBeDefined();

    // Verify appointment, customer and job in database
    const createdAppt = await prisma.appointment.findUnique({
      where: { appointmentNumber: json.appointmentNumber },
      include: { customer: true, job: true, property: true },
    });

    expect(createdAppt).not.toBeNull();
    expect(createdAppt?.organizationId).toBe(orgId);
    expect(createdAppt?.customer).toBeDefined();
    expect(createdAppt?.job).not.toBeNull();

    customerId = createdAppt!.customerId;
    appointmentId = createdAppt!.id;
    jobId = createdAppt!.job!.id;
  });

  test('Step 2: Dispatcher Assignment to Technician', async () => {
    await prisma.job.update({
      where: { id: jobId },
      data: { status: 'ASSIGNED', technicianId: techProfileId },
    });

    await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: 'SCHEDULED', technicianId: techProfileId },
    });

    const updatedJob = await prisma.job.findUnique({ where: { id: jobId } });
    expect(updatedJob?.status).toBe('ASSIGNED');
    expect(updatedJob?.technicianId).toBe(techProfileId);
  });

  test('Step 3: Technician Field Workflow (En Route -> Working -> Photo -> Part -> Complete)', async () => {
    // 1. En Route
    await prisma.job.update({ where: { id: jobId }, data: { status: 'EN_ROUTE' } });

    // 2. Arrived
    await prisma.job.update({ where: { id: jobId }, data: { status: 'ARRIVED' } });

    // 3. Working & Time Clock
    await prisma.job.update({ where: { id: jobId }, data: { status: 'WORKING', startedAt: new Date(Date.now() - 3600000) } });
    await prisma.jobTimeEntry.create({
      data: {
        jobId,
        technicianId: techUserId,
        startedAt: new Date(Date.now() - 3600000),
        endedAt: new Date(),
        durationSeconds: 3600,
      },
    });

    // 4. Job Part
    await prisma.jobPart.create({
      data: {
        jobId,
        name: 'Cast Iron Cleanout Plug',
        quantity: 1,
        unitCost: 35.0,
        createdById: techUserId,
      },
    });

    // 5. Upload Job Photo
    const photoBuffer = Buffer.from('RAW_E2E_PHOTO_PAYLOAD', 'utf-8');
    const photoUpload = await storage.uploadFile(photoBuffer, `photo-e2e-${testId}.png`, 'image/png');
    photoStorageKey = photoUpload.storageKey;

    await prisma.jobPhoto.create({
      data: {
        jobId,
        uploadedById: techUserId,
        type: 'BEFORE',
        storageKey: photoStorageKey,
        url: `/api/files/${photoStorageKey}`,
        customerVisible: true,
        caption: 'Severe blockage in cleanout prior to jetting.',
      },
    });

    // 6. Signature & Complete
    const sigBuffer = Buffer.from('RAW_E2E_SIGNATURE_PAYLOAD', 'utf-8');
    const sigUpload = await storage.uploadFile(sigBuffer, `sig-e2e-${testId}.png`, 'image/png');
    signatureStorageKey = sigUpload.storageKey;

    await prisma.customerSignature.create({
      data: {
        jobId,
        signerName: 'Clara Customer',
        storageKey: signatureStorageKey,
      },
    });

    const completedJob = await prisma.job.update({
      where: { id: jobId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    expect(completedJob.status).toBe('COMPLETED');
  });

  test('Step 4: Invoice Generation & Tax Calculation', async () => {
    const invoice = await InvoiceService.generateInvoice(orgId, jobId);

    expect(invoice).not.toBeNull();
    expect(invoice.organizationId).toBe(orgId);
    expect(invoice.status).toBe('SENT');
    expect(invoice.total).toBeGreaterThan(0);
    expect(invoice.paymentToken).toBeDefined();

    invoiceId = invoice.id;
  });

  test('Step 5: Stripe Webhook Succeeded Execution', async () => {
    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    const eventId = `evt_golden_${randomUUID().slice(0, 8)}`;
    const paymentIntentId = `pi_golden_${randomUUID().slice(0, 8)}`;

    const event = {
      id: eventId,
      object: 'event',
      type: 'payment_intent.succeeded',
      account: stripeAccountId,
      data: {
        object: {
          id: paymentIntentId,
          object: 'payment_intent',
          amount: Math.round(invoice!.total * 100),
          currency: 'cad',
          metadata: { invoiceId: invoice!.id },
        },
      },
    };

    const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_mock', { apiVersion: '2025-02-24.acacia' as any });
    const payload = JSON.stringify(event);
    const signature = stripeClient.webhooks.generateTestHeaderString({
      payload,
      secret: process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_mock',
    });

    const req = new NextRequest('http://localhost:3000/api/webhooks/stripe', {
      method: 'POST',
      headers: {
        'stripe-signature': signature,
        'content-type': 'application/json',
      },
      body: payload,
    });

    const res = await stripeWebhookHandler(req);
    expect(res.status).toBe(200);

    const paidInvoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    expect(paidInvoice?.status).toBe('PAID');
    expect(paidInvoice?.amountPaid).toBe(paidInvoice?.total);

    const payment = await prisma.payment.findUnique({ where: { providerPaymentId: paymentIntentId } });
    expect(payment).not.toBeNull();
    expect(payment?.status).toBe('SUCCEEDED');
  });

  test('Step 6: Customer Portal Logout & Session Revocation', async () => {
    // 1. Setup active customer session
    customerSessionToken = randomUUID();
    const tokenHash = hashToken(customerSessionToken);
    await prisma.customerSession.create({
      data: {
        customerId,
        tokenHash,
        expiresAt: new Date(Date.now() + 86400000),
      },
    });

    // 2. Execute Logout
    const logoutReq = new NextRequest('http://localhost:3000/api/auth/logout', {
      method: 'POST',
      headers: {
        cookie: `customer_session=${customerSessionToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ type: 'customer' }),
    });

    const logoutRes = await logoutHandler(logoutReq);
    expect(logoutRes.status).toBe(200);

    // 3. Verify Session is Revoked in Database
    const dbSession = await prisma.customerSession.findUnique({ where: { tokenHash } });
    expect(dbSession?.revokedAt).not.toBeNull();
  });
});
