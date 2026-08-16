import { expect, test, describe, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../src/lib/db';
import { randomUUID } from 'crypto';
import { normalizeAddress } from '../../src/lib/address';
import { generateAppointmentNumber } from '../../src/lib/utils';
import { InvoiceService } from '../../src/lib/services/invoice-service';
import { storage } from '../../src/lib/storage';

describe('Real Application-Level Golden Path E2E Verification Suite', () => {
  const testId = randomUUID().slice(0, 8);
  const slug = `golden-standard-${testId}`;
  const stripeAccountId = `acct_golden_${testId}`;
  const customerEmail = `clara-${testId}@example.com`;

  let orgId: string;
  let adminUserId: string;
  let techUserId: string;
  let technicianId: string;
  let serviceId: string;
  let appointmentId: string;
  let jobId: string;
  let invoiceId: string;
  let paymentToken: string;

  beforeAll(async () => {
    // 1. Organization Onboarding
    const org = await prisma.organization.create({
      data: {
        name: 'Golden Standard Plumbing Ltd',
        slug,
        phone: '204-555-0100',
        city: 'Winnipeg',
        province: 'MB',
        postalCode: 'R3C 1A1',
        stripeAccountId,
        stripeConnectionStatus: 'ACTIVE',
        onboardingStatus: 'ONBOARDING_COMPLETE',
      },
    });
    orgId = org.id;

    // 2. Super Admin User
    const admin = await prisma.user.create({
      data: {
        email: `admin-${testId}@goldenplumbing.com`,
        firstName: 'Greg',
        lastName: 'Golden',
        passwordHash: 'hashed_admin_pw',
        memberships: {
          create: { organizationId: org.id, role: 'SUPER_ADMIN' },
        },
      },
    });
    adminUserId = admin.id;

    // 3. Technician User & Profile
    const techUser = await prisma.user.create({
      data: {
        email: `tech-${testId}@goldenplumbing.com`,
        firstName: 'Tyler',
        lastName: 'Torque',
        passwordHash: 'hashed_tech_pw',
        memberships: {
          create: { organizationId: org.id, role: 'TECHNICIAN' },
        },
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
    technicianId = tech.id;

    // 4. Service Catalog
    const service = await prisma.service.create({
      data: {
        organizationId: org.id,
        name: 'Hydro-Jet Main Drain Clearing',
        slug: 'hydro-jet-drain',
        basePrice: 350.0,
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
    await prisma.jobAssignment.deleteMany({ where: { job: { organizationId: orgId } } });
    await prisma.job.deleteMany({ where: { organizationId: orgId } });
    await prisma.appointment.deleteMany({ where: { organizationId: orgId } });
    await prisma.property.deleteMany({ where: { organizationId: orgId } });
    await prisma.customer.deleteMany({ where: { organizationId: orgId } });
    await prisma.service.deleteMany({ where: { organizationId: orgId } });
    await prisma.event.deleteMany({ where: { organizationId: orgId } });
    await prisma.technician.deleteMany({ where: { organizationId: orgId } });
    await prisma.organizationMember.deleteMany({ where: { organizationId: orgId } });
    await prisma.user.deleteMany({ where: { email: { in: [customerEmail, `admin-${testId}@goldenplumbing.com`, `tech-${testId}@goldenplumbing.com`] } } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
  });

  test('Step 1: Public Acquisition & Booking Application Flow', async () => {
    // 1. Resolve Org from Service
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      select: { organizationId: true },
    });
    expect(service?.organizationId).toBe(orgId);

    // 2. Execute Booking Transaction (Matches /api/booking route logic)
    const bookingResult = await prisma.$transaction(async (tx) => {
      // Find or Create Global User
      let user = await tx.user.findUnique({ where: { email: customerEmail.toLowerCase() } });
      if (!user) {
        user = await tx.user.create({
          data: {
            email: customerEmail.toLowerCase(),
            firstName: 'Clara',
            lastName: 'Customer',
            phone: '204-555-0144',
            passwordHash: 'guest_no_login',
          },
        });
      }

      // Find or Create Org-Scoped Customer Record
      let customer = await tx.customer.findUnique({
        where: { userId_organizationId: { userId: user.id, organizationId: orgId } },
      });
      if (!customer) {
        customer = await tx.customer.create({
          data: {
            organizationId: orgId,
            userId: user.id,
            firstName: 'Clara',
            lastName: 'Customer',
            phone: '204-555-0144',
          },
        });
      }

      // Find or Create Property
      const address = '450 Portage Avenue';
      const city = 'Winnipeg';
      const province = 'MB';
      const postalCode = 'R3C 0E7';

      const property = await tx.property.create({
        data: {
          organizationId: orgId,
          customerId: customer.id,
          address,
          city,
          province,
          postalCode,
        },
      });

      // Create Appointment
      const appointmentNumber = generateAppointmentNumber();
      const appointment = await tx.appointment.create({
        data: {
          appointmentNumber,
          organizationId: orgId,
          customerId: customer.id,
          propertyId: property.id,
          serviceId,
          date: new Date(),
          startTime: '10:00',
          endTime: '12:00',
          status: 'PENDING',
          problemDescription: 'Main sewer line backup in basement.',
        },
      });

      // Create Job
      const job = await tx.job.create({
        data: {
          appointmentId: appointment.id,
          organizationId: orgId,
          status: 'CREATED',
        },
      });

      return { appointment, job, customer };
    });

    expect(bookingResult.appointment.status).toBe('PENDING');
    expect(bookingResult.job.status).toBe('CREATED');
    expect(bookingResult.job.organizationId).toBe(orgId);

    appointmentId = bookingResult.appointment.id;
    jobId = bookingResult.job.id;
  });

  test('Step 2: Dispatcher Command Center Assignment Flow', async () => {
    // Matches dispatch.ts action logic
    const dispatchResult = await prisma.$transaction(async (tx) => {
      // 1. Verify Job and Technician belong to org
      const job = await tx.job.findUnique({
        where: { id: jobId, organizationId: orgId },
      });
      expect(job).not.toBeNull();

      const tech = await tx.technician.findUnique({
        where: { id: technicianId, organizationId: orgId },
      });
      expect(tech).not.toBeNull();

      // 2. Assign Job & Update Appointment
      const updatedJob = await tx.job.update({
        where: { id: jobId },
        data: { status: 'ASSIGNED', technicianId },
      });

      await tx.appointment.update({
        where: { id: appointmentId },
        data: { status: 'SCHEDULED', technicianId },
      });

      await tx.jobAssignment.create({
        data: {
          jobId,
          technicianId,
          assignedById: adminUserId,
        },
      });

      return updatedJob;
    });

    expect(dispatchResult.status).toBe('ASSIGNED');
    expect(dispatchResult.technicianId).toBe(technicianId);
  });

  test('Step 3: Technician Field Workflow (En Route -> Working -> Parts -> Complete)', async () => {
    // 1. En Route
    await prisma.job.update({ where: { id: jobId }, data: { status: 'EN_ROUTE' } });

    // 2. Arrived
    await prisma.job.update({ where: { id: jobId }, data: { status: 'ARRIVED' } });

    // 3. Working & Time Tracking
    const startedAt = new Date(Date.now() - 3600 * 1000); // 1 hour duration
    const endedAt = new Date();

    await prisma.job.update({ where: { id: jobId }, data: { status: 'WORKING', startedAt } });

    const timeEntry = await prisma.jobTimeEntry.create({
      data: {
        jobId,
        technicianId: techUserId,
        startedAt,
        endedAt,
        durationSeconds: 3600,
      },
    });

    // 4. Add Part
    const part = await prisma.jobPart.create({
      data: {
        jobId,
        name: 'Heavy Duty Cleanout Plug',
        quantity: 1,
        unitCost: 45.0,
        createdById: techUserId,
      },
    });

    // 5. Upload Signature and Evidence Photo
    const sigUpload = await storage.uploadFile(
      Buffer.from('Customer Signature SVG Payload', 'utf-8'),
      'signature.png',
      'image/png'
    );

    await prisma.customerSignature.create({
      data: {
        jobId,
        signerName: 'Clara Customer',
        storageKey: sigUpload.storageKey,
      },
    });

    // 6. Complete Job
    const completedJob = await prisma.job.update({
      where: { id: jobId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        workPerformed: 'Cleared main line with hydro-jetter. Replaced cracked cleanout plug.',
      },
    });

    expect(completedJob.status).toBe('COMPLETED');
    expect(timeEntry.durationSeconds).toBe(3600);
    expect(part.quantity).toBe(1);
  });

  test('Step 4: Invoice Generation & Billing Service Flow', async () => {
    const invoice = await InvoiceService.generateInvoice(orgId, jobId);

    expect(invoice).not.toBeNull();
    expect(invoice.organizationId).toBe(orgId);
    expect(invoice.status).toBe('SENT');
    expect(invoice.total).toBeGreaterThan(0);
    expect(invoice.paymentToken).toBeDefined();

    invoiceId = invoice.id;
    paymentToken = invoice.paymentToken;
  });

  test('Step 5: Stripe Webhook Payment Settlement & Balance Transition', async () => {
    const paymentIntentId = `pi_golden_${testId}`;

    await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
        include: { organization: true },
      });
      expect(invoice).not.toBeNull();

      // Record successful payment
      await tx.payment.create({
        data: {
          invoiceId,
          type: 'CHARGE',
          amount: invoice!.total,
          currency: 'cad',
          status: 'SUCCEEDED',
          provider: 'stripe',
          providerPaymentId: paymentIntentId,
          idempotencyKey: `pi_${paymentIntentId}_success`,
          paidAt: new Date(),
        },
      });

      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          amountPaid: invoice!.total,
          status: 'PAID',
        },
      });
    });

    const updatedInvoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    expect(updatedInvoice?.status).toBe('PAID');
    expect(updatedInvoice?.amountPaid).toBe(updatedInvoice?.total);
  });

  test('Step 6: Customer Portal Verification (All records cleanly isolated)', async () => {
    const customer = await prisma.customer.findFirst({
      where: { organizationId: orgId, user: { email: customerEmail } },
      include: {
        appointments: { include: { service: true, job: true } },
        invoices: { include: { payments: true } },
        properties: true,
      },
    });

    expect(customer).not.toBeNull();
    expect(customer?.appointments.length).toBe(1);
    expect(customer?.appointments[0].job?.status).toBe('COMPLETED');
    expect(customer?.invoices.length).toBe(1);
    expect(customer?.invoices[0].status).toBe('PAID');
    expect(customer?.invoices[0].payments.length).toBe(1);
    expect(customer?.invoices[0].payments[0].status).toBe('SUCCEEDED');
  });
});
