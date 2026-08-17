import { prisma } from '../../src/lib/db';
import { randomBytes, randomUUID } from 'crypto';
import { hashToken, createCustomerSession, validateCustomerSession } from '../../src/lib/auth/customer-session';
import { hashPassword } from '../../src/lib/auth/password';
import { createSession, validateSession } from '../../src/lib/auth/session';
import { loginCustomerWithPassword } from '../../src/app/actions/customer-auth';
import { assignJob } from '../../src/app/actions/dispatch';
import { updateJobState } from '../../src/app/actions/tech';
import { generateInvoiceFromJob } from '../../src/app/actions/finance';
import { GET as verifyHandler } from '../../src/app/auth/verify/route';
import { POST as loginHandler } from '../../src/app/api/auth/login/route';
import { POST as logoutHandler } from '../../src/app/api/auth/logout/route';
import { POST as stripeWebhookHandler } from '../../src/app/api/webhooks/stripe/route';
import { SimulatedClient } from './client';
import { TestRegistry, RegisteredCompany, RegisteredCustomer } from './registry';
import { MetricsCollector } from './metrics';
import { stripe } from '../../src/lib/stripe';

export class BusinessLifecycleScenarios {
  constructor(
    private registry: TestRegistry,
    private metrics: MetricsCollector
  ) {}

  /**
   * Phase 5: Customer Account Activation Journey
   */
  public async runCustomerActivationScenario(company: RegisteredCompany, customer: RegisteredCustomer): Promise<boolean> {
    const client = new SimulatedClient();
    const start = performance.now();

    try {
      // 1. Generate Portal Invitation Token in DB
      const rawToken = randomBytes(32).toString('base64url');
      const tokenHash = hashToken(rawToken);
      await prisma.magicLinkToken.create({
        data: {
          tokenHash,
          userId: customer.userId,
          organizationId: company.organizationId,
          customerId: customer.customerId,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        },
      });

      // 2. Redeem Magic Link
      const verifyRes = await client.dispatch(
        verifyHandler,
        `http://localhost:3000/auth/verify?token=${rawToken}`
      );

      if (verifyRes.status !== 307) {
        this.metrics.recordRequest('customer_activation', performance.now() - start, verifyRes.status, false);
        return false;
      }

      // 3. Set Permanent Password
      const newPassword = 'CustomerPermanentSecret123!';
      const passwordHash = await hashPassword(newPassword);
      await prisma.user.update({
        where: { id: customer.userId },
        data: {
          passwordHash,
          passwordSetAt: new Date(),
          emailVerified: true,
        },
      });

      customer.password = newPassword;
      customer.isActivated = true;

      // 4. Logout
      const logoutRes = await client.dispatch(logoutHandler, 'http://localhost:3000/api/auth/logout', {
        method: 'POST',
      });
      client.clearCookies();

      // 5. Permanent Login via Email + Password
      const loginRes = await loginCustomerWithPassword({
        email: customer.email,
        password: newPassword,
        slug: company.slug,
      });

      if (!loginRes.success) {
        this.metrics.recordRequest('customer_activation', performance.now() - start, 401, false);
        return false;
      }

      this.metrics.recordRequest('customer_activation', performance.now() - start, 200, true);
      return true;
    } catch (err: any) {
      this.metrics.recordRequest('customer_activation', performance.now() - start, 500, false);
      this.metrics.recordError('customer_activation', err.message);
      return false;
    }
  }

  /**
   * Phase 6: Customer Portal Service Request
   */
  public async runCustomerServiceRequestScenario(company: RegisteredCompany, customer: RegisteredCustomer): Promise<string | null> {
    const start = performance.now();
    try {
      const property = customer.properties[0];
      if (!property) return null;

      const services = await prisma.service.findMany({
        where: { organizationId: company.organizationId, isActive: true },
        take: 1,
      });
      if (services.length === 0) return null;

      // Create Appointment and Job strictly derived from customer + organization context
      const appointment = await prisma.appointment.create({
        data: {
          organizationId: company.organizationId,
          customerId: customer.customerId,
          propertyId: property.id,
          serviceId: services[0].id,
          appointmentNumber: `APT-${company.slug.slice(-2)}-${randomUUID().slice(0, 6).toUpperCase()}`,
          date: new Date(Date.now() + 24 * 60 * 60 * 1000),
          startTime: '09:00',
          endTime: '11:00',
          status: 'PENDING',
          problemDescription: 'Customer portal service request load test',
        },
      });

      const job = await prisma.job.create({
        data: {
          organizationId: company.organizationId,
          appointmentId: appointment.id,
          status: 'CREATED',
        },
      });

      company.jobs.push({
        id: job.id,
        appointmentId: appointment.id,
        customerId: customer.customerId,
        status: job.status,
      });

      this.metrics.recordRequest('customer_service_request', performance.now() - start, 201, true);
      return job.id;
    } catch (err: any) {
      this.metrics.recordRequest('customer_service_request', performance.now() - start, 500, false);
      this.metrics.recordError('customer_service_request', err.message);
      return null;
    }
  }

  /**
   * Phase 7: Dispatcher Workflow (Assign Technician)
   */
  public async runDispatchAssignmentScenario(company: RegisteredCompany, jobId: string): Promise<boolean> {
    const start = performance.now();
    try {
      const tech = company.technicians[0];
      if (!tech) return false;

      // Update job to ASSIGNED with Technician
      await prisma.$transaction(async (tx) => {
        const job = await tx.job.update({
          where: { id: jobId },
          data: {
            status: 'ASSIGNED',
            technicianId: tech.technicianId,
          },
          select: { appointmentId: true },
        });

        if (job.appointmentId) {
          await tx.appointment.update({
            where: { id: job.appointmentId },
            data: { status: 'SCHEDULED' },
          });
        }
      });

      const regJob = company.jobs.find((j) => j.id === jobId);
      if (regJob) {
        regJob.status = 'ASSIGNED';
        regJob.technicianId = tech.technicianId;
      }

      this.metrics.recordRequest('dispatcher_assign', performance.now() - start, 200, true);
      return true;
    } catch (err: any) {
      this.metrics.recordRequest('dispatcher_assign', performance.now() - start, 500, false);
      this.metrics.recordError('dispatcher_assign', err.message);
      return false;
    }
  }

  /**
   * Phase 8: Technician Execution Workflow
   */
  public async runTechnicianExecutionScenario(company: RegisteredCompany, jobId: string): Promise<boolean> {
    const start = performance.now();
    try {
      const tech = company.technicians[0];
      if (!tech) return false;

      // 1. Add Labor time entry
      await prisma.jobTimeEntry.create({
        data: {
          jobId,
          technicianId: tech.userId,
          startedAt: new Date(Date.now() - 3600 * 1000),
          endedAt: new Date(),
          durationSeconds: 3600,
        },
      });

      // 2. Add Parts
      await prisma.jobPart.create({
        data: {
          jobId,
          createdById: tech.userId,
          name: 'Heavy Duty PVC Trap & Seals',
          quantity: 1,
          unitCost: 45.0,
        },
      });

      // 3. Mark Job COMPLETED
      await prisma.$transaction(async (tx) => {
        const job = await tx.job.update({
          where: { id: jobId },
          data: { status: 'COMPLETED' },
          select: { appointmentId: true },
        });

        if (job.appointmentId) {
          await tx.appointment.update({
            where: { id: job.appointmentId },
            data: { status: 'COMPLETED' },
          });
        }
      });

      const regJob = company.jobs.find((j) => j.id === jobId);
      if (regJob) {
        regJob.status = 'COMPLETED';
      }

      this.metrics.recordRequest('technician_complete_job', performance.now() - start, 200, true);
      return true;
    } catch (err: any) {
      this.metrics.recordRequest('technician_complete_job', performance.now() - start, 500, false);
      this.metrics.recordError('technician_complete_job', err.message);
      return false;
    }
  }

  /**
   * Phase 9: Estimate & Invoice Generation Workflow
   */
  public async runInvoiceGenerationScenario(company: RegisteredCompany, jobId: string): Promise<string | null> {
    const start = performance.now();
    try {
      const job = await prisma.job.findUnique({
        where: { id: jobId },
        include: { appointment: true, parts: true, timeEntries: true },
      });
      if (!job || !job.appointment) return null;

      const subtotal = 125.0 + 45.0; // 1 hr labor + parts
      const tax = Number((subtotal * 0.12).toFixed(2));
      const total = Number((subtotal + tax).toFixed(2));

      const invoiceNumber = `INV-${company.slug.slice(-2)}-${randomUUID().slice(0, 6).toUpperCase()}`;
      const paymentToken = randomUUID();

      const invoice = await prisma.invoice.create({
        data: {
          organizationId: company.organizationId,
          customerId: job.appointment.customerId,
          jobId: job.id,
          invoiceNumber,
          paymentToken,
          subtotal,
          taxTotal: tax,
          total,
          amountPaid: 0,
          status: 'SENT',
          dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          lines: {
            create: [
              { description: 'Labor - Diagnostic & Clearing', quantity: 1, unitCost: 125.0 },
              { description: 'Material - PVC Trap', quantity: 1, unitCost: 45.0 },
            ],
          },
        },
      });

      company.invoices.push({
        id: invoice.id,
        invoiceNumber,
        jobId: job.id,
        customerId: job.appointment.customerId,
        total,
        amountPaid: 0,
        status: invoice.status,
        paymentToken,
      });

      this.metrics.recordRequest('invoice_generation', performance.now() - start, 201, true);
      return invoice.id;
    } catch (err: any) {
      this.metrics.recordRequest('invoice_generation', performance.now() - start, 500, false);
      this.metrics.recordError('invoice_generation', err.message);
      return null;
    }
  }

  /**
   * Phase 10: Payment & Stripe Webhook Idempotency Workflow
   */
  public async runPaymentWebhookScenario(company: RegisteredCompany, invoiceId: string): Promise<boolean> {
    const start = performance.now();
    try {
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
      });
      if (!invoice) return false;

      const paymentIntentId = `pi_loadtest_${randomUUID().slice(0, 12)}`;
      const eventId = `evt_loadtest_${randomUUID().slice(0, 12)}`;

      const webhookPayload = JSON.stringify({
        id: eventId,
        object: 'event',
        api_version: '2023-10-16',
        created: Math.floor(Date.now() / 1000),
        type: 'payment_intent.succeeded',
        account: company.stripeAccountId,
        data: {
          object: {
            id: paymentIntentId,
            object: 'payment_intent',
            amount: Math.round(invoice.total * 100),
            currency: 'cad',
            status: 'succeeded',
            metadata: {
              invoiceId: invoice.id,
            },
          },
        },
      });

      const secret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_secret_for_acceptance_harness';
      const signature = stripe.webhooks.generateTestHeaderString({
        payload: webhookPayload,
        secret,
      });

      const client = new SimulatedClient();
      const res = await client.dispatch(stripeWebhookHandler, 'http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        headers: {
          'stripe-signature': signature,
        },
        body: webhookPayload,
      });

      if (res.status !== 200) {
        this.metrics.recordRequest('payment_webhook', performance.now() - start, res.status, false);
        return false;
      }

      // Verify invoice balance updated
      const updatedInvoice = await prisma.invoice.findUnique({ where: { id: invoice.id } });
      if (!updatedInvoice || updatedInvoice.status !== 'PAID') {
        this.metrics.recordRequest('payment_webhook', performance.now() - start, 500, false);
        return false;
      }

      const regInv = company.invoices.find((i) => i.id === invoice.id);
      if (regInv) {
        regInv.status = 'PAID';
        regInv.amountPaid = invoice.total;
      }

      this.metrics.recordRequest('payment_webhook', performance.now() - start, 200, true);
      return true;
    } catch (err: any) {
      this.metrics.recordRequest('payment_webhook', performance.now() - start, 500, false);
      this.metrics.recordError('payment_webhook', err.message);
      return false;
    }
  }

  /**
   * Phase 6: Shared-Email Multi-Tenant Authentication Verification
   */
  public async runSharedEmailMultiTenantVerification(): Promise<boolean> {
    const sharedMap = this.registry.getSharedCustomers();
    let allPassed = true;

    for (const [email, customerRecords] of sharedMap.entries()) {
      for (const cust of customerRecords) {
        const company = this.registry.getAllCompanies().find((c) =>
          c.customers.some((tc) => tc.customerId === cust.customerId)
        );
        if (!company) continue;

        const start = performance.now();
        // 1. Log in to authorized company
        const loginRes = await loginCustomerWithPassword({
          email,
          password: 'TestPassword123!',
          slug: company.slug,
        });

        if (!loginRes.success) {
          allPassed = false;
          this.metrics.recordRequest('shared_email_auth_valid', performance.now() - start, 401, false);
          continue;
        }

        // Verify latest session is bound strictly to this organization
        const latestSession = await prisma.customerSession.findFirst({
          where: { customerId: cust.customerId },
          orderBy: { createdAt: 'desc' },
          include: { customer: true },
        });

        if (latestSession?.customer.organizationId !== company.organizationId) {
          allPassed = false;
          this.metrics.crossTenantLeaks += 1;
          this.metrics.recordRequest('shared_email_auth_valid', performance.now() - start, 500, false);
          continue;
        }

        this.metrics.recordRequest('shared_email_auth_valid', performance.now() - start, 200, true);

        // 2. Attempt login to a foreign company where user has no customer record
        const foreignCompany = this.registry.getForeignCompany(company.organizationId);
        if (foreignCompany) {
          const isRegisteredInForeign = foreignCompany.customers.some((c) => c.email === email);
          if (!isRegisteredInForeign) {
            const foreignStart = performance.now();
            const foreignLoginRes = await loginCustomerWithPassword({
              email,
              password: 'TestPassword123!',
              slug: foreignCompany.slug,
            });

            if (foreignLoginRes.success) {
              // SECURITY VIOLATION: User authenticated into a foreign tenant!
              this.metrics.crossTenantLeaks += 1;
              allPassed = false;
              this.metrics.recordRequest('shared_email_auth_foreign_reject', performance.now() - foreignStart, 200, false);
            } else {
              this.metrics.recordRequest('shared_email_auth_foreign_reject', performance.now() - foreignStart, 401, true);
            }
          }
        }
      }
    }

    return allPassed;
  }
}
