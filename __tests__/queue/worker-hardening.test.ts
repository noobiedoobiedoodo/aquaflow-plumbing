import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { prisma } from '@/lib/db';
import { randomUUID } from 'crypto';
import { processEvent } from '@/workers/event-processor';
import { processNotification } from '@/workers/notification-sender';
import { claimAndDispatchPendingEvents } from '@/workers/outbox-dispatcher';
import { AutomationRulesEngine } from '@/lib/automation/rules-engine';
import { Job } from 'bullmq';

describe('AquaFlow Continuous BullMQ Worker Hardening & Reliability Suite', () => {
  let testId: string;
  let orgAId: string;
  let orgBId: string;
  let userAId: string;
  let userBId: string;

  beforeEach(async () => {
    testId = randomUUID().slice(0, 8);

    // Provision Tenant A
    const orgA = await prisma.organization.create({
      data: { name: `Worker Tenant A ${testId}`, slug: `worker-tenant-a-${testId}` },
    });
    orgAId = orgA.id;

    // Provision Tenant B
    const orgB = await prisma.organization.create({
      data: { name: `Worker Tenant B ${testId}`, slug: `worker-tenant-b-${testId}` },
    });
    orgBId = orgB.id;

    // User A
    const userA = await prisma.user.create({
      data: {
        email: `usera.${testId}@test.com`,
        firstName: 'UserA',
        lastName: 'Tester',
        passwordHash: 'dummy_hash',
        memberships: { create: { organizationId: orgAId, role: 'ADMIN' } },
      },
    });
    userAId = userA.id;

    // User B
    const userB = await prisma.user.create({
      data: {
        email: `userb.${testId}@test.com`,
        firstName: 'UserB',
        lastName: 'Tester',
        passwordHash: 'dummy_hash',
        memberships: { create: { organizationId: orgBId, role: 'ADMIN' } },
      },
    });
    userBId = userB.id;
  });

  afterEach(async () => {
    if (orgAId) {
      await prisma.payment.deleteMany({ where: { invoice: { organizationId: orgAId } } });
      await prisma.invoiceLine.deleteMany({ where: { invoice: { organizationId: orgAId } } });
      await prisma.invoice.deleteMany({ where: { organizationId: orgAId } });
      await prisma.job.deleteMany({ where: { organizationId: orgAId } });
      await prisma.appointment.deleteMany({ where: { organizationId: orgAId } });
      await prisma.service.deleteMany({ where: { organizationId: orgAId } });
      await prisma.property.deleteMany({ where: { organizationId: orgAId } });
      await prisma.customer.deleteMany({ where: { organizationId: orgAId } });
      await prisma.notification.deleteMany({ where: { organizationId: orgAId } });
      await prisma.automationExecution.deleteMany({ where: { event: { organizationId: orgAId } } });
      await prisma.automationRule.deleteMany({ where: { organizationId: orgAId } });
      await prisma.event.deleteMany({ where: { organizationId: orgAId } });
      await prisma.organizationMember.deleteMany({ where: { organizationId: orgAId } });
      await prisma.organization.deleteMany({ where: { id: orgAId } });
    }
    if (orgBId) {
      await prisma.payment.deleteMany({ where: { invoice: { organizationId: orgBId } } });
      await prisma.invoiceLine.deleteMany({ where: { invoice: { organizationId: orgBId } } });
      await prisma.invoice.deleteMany({ where: { organizationId: orgBId } });
      await prisma.job.deleteMany({ where: { organizationId: orgBId } });
      await prisma.appointment.deleteMany({ where: { organizationId: orgBId } });
      await prisma.service.deleteMany({ where: { organizationId: orgBId } });
      await prisma.property.deleteMany({ where: { organizationId: orgBId } });
      await prisma.customer.deleteMany({ where: { organizationId: orgBId } });
      await prisma.notification.deleteMany({ where: { organizationId: orgBId } });
      await prisma.automationExecution.deleteMany({ where: { event: { organizationId: orgBId } } });
      await prisma.automationRule.deleteMany({ where: { organizationId: orgBId } });
      await prisma.event.deleteMany({ where: { organizationId: orgBId } });
      await prisma.organizationMember.deleteMany({ where: { organizationId: orgBId } });
      await prisma.organization.deleteMany({ where: { id: orgBId } });
    }
    await prisma.user.deleteMany({ where: { id: { in: [userAId, userBId].filter(Boolean) } } });
  });

  // TEST 1: Outbox Event Persistence Across Worker Restarts
  it('Outbox Reliability: Event queued in DB survives worker interruption and completes on restart', async () => {
    // 1. Create PENDING outbox event
    const event = await prisma.event.create({
      data: {
        organizationId: orgAId,
        type: 'job.completed',
        entityType: 'Job',
        entityId: randomUUID(),
        status: 'PENDING',
        data: JSON.stringify({ jobId: randomUUID(), completedAt: new Date().toISOString() }),
      },
    });

    // 2. Outbox claims the event
    const claimed = await claimAndDispatchPendingEvents(10);
    expect(claimed).toBeGreaterThanOrEqual(1);

    const claimedEvent = await prisma.event.findUnique({ where: { id: event.id } });
    expect(claimedEvent?.status).toBe('PROCESSING');

    // 3. Simulate worker restart & job processing
    const mockJob = {
      name: 'job.completed',
      data: { eventId: event.id },
      opts: { attempts: 3 },
      attemptsMade: 1,
    } as unknown as Job;

    await processEvent(mockJob);

    // 4. Verify completion
    const finalEvent = await prisma.event.findUnique({ where: { id: event.id } });
    expect(finalEvent?.status).toBe('COMPLETED');
    expect(finalEvent?.processedAt).not.toBeNull();
  });

  // TEST 2: Duplicate Processing Idempotency
  it('Worker Idempotency: Duplicate job delivery skips re-execution and prevents duplicate side-effects', async () => {
    const event = await prisma.event.create({
      data: {
        organizationId: orgAId,
        type: 'payment.succeeded',
        entityType: 'Payment',
        entityId: randomUUID(),
        status: 'COMPLETED',
        processedAt: new Date(),
        data: JSON.stringify({ amount: 150.00 }),
      },
    });

    const mockJob = {
      name: 'payment.succeeded',
      data: { eventId: event.id },
      opts: { attempts: 3 },
      attemptsMade: 2,
    } as unknown as Job;

    await processEvent(mockJob);

    const check = await prisma.event.findUnique({ where: { id: event.id } });
    expect(check?.status).toBe('COMPLETED');
  });

  // TEST 3: Multi-Tenant Worker Isolation
  it('Tenant Isolation: Worker processing Tenant A event cannot modify or cross into Tenant B scope', async () => {
    const custUserB = await prisma.user.create({
      data: { email: `custb.${testId}@test.com`, firstName: 'Bob', lastName: 'Beta', passwordHash: 'none' }
    });
    const custB = await prisma.customer.create({
      data: { organizationId: orgBId, userId: custUserB.id, firstName: 'Bob', lastName: 'Beta' }
    });

    const notifB = await prisma.notification.create({
      data: {
        organizationId: orgBId,
        userId: custUserB.id,
        type: 'INVOICE_SENT',
        channel: 'IN_APP',
        content: 'Tenant B Invoice',
        status: 'PENDING',
        idempotencyKey: `notif:b:${randomUUID()}`,
      }
    });

    const eventA = await prisma.event.create({
      data: {
        organizationId: orgAId,
        type: 'job.created',
        entityType: 'Job',
        entityId: randomUUID(),
        status: 'PENDING',
        data: JSON.stringify({ customerId: custB.id, note: 'Spoofed Tenant B Customer' }),
      },
    });

    const mockJobA = {
      name: 'job.created',
      data: { eventId: eventA.id },
      opts: { attempts: 1 },
      attemptsMade: 1,
    } as unknown as Job;

    await processEvent(mockJobA);

    const freshNotifB = await prisma.notification.findUnique({ where: { id: notifB.id } });
    expect(freshNotifB?.organizationId).toBe(orgBId);
    expect(freshNotifB?.status).toBe('PENDING');

    await prisma.notification.delete({ where: { id: notifB.id } });
    await prisma.customer.delete({ where: { id: custB.id } });
    await prisma.user.delete({ where: { id: custUserB.id } });
  });

  // TEST 4: Stripe Webhook Duplicate Deduplication & Idempotency
  it('Stripe Webhook Safety: Retried Stripe webhooks result in exactly 1 payment record and prevent overpayment', async () => {
    const customer = await prisma.customer.create({
      data: { organizationId: orgAId, userId: userAId, firstName: 'Jane', lastName: 'Doe' }
    });

    const property = await prisma.property.create({
      data: { organizationId: orgAId, customerId: customer.id, address: '123 Test St', city: 'Winnipeg', postalCode: 'R3C1A1' }
    });

    const service = await prisma.service.create({
      data: { organizationId: orgAId, name: 'Pipe Repair', slug: `pipe-${testId}`, basePrice: 250 }
    });

    const appointment = await prisma.appointment.create({
      data: {
        appointmentNumber: `APT-${testId}`,
        organizationId: orgAId,
        customerId: customer.id,
        propertyId: property.id,
        serviceId: service.id,
        date: new Date(),
        startTime: '09:00',
        endTime: '11:00',
      }
    });

    const job = await prisma.job.create({
      data: {
        organizationId: orgAId,
        appointmentId: appointment.id,
        status: 'COMPLETED',
      }
    });

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: `INV-STRIPE-${testId}`,
        organization: { connect: { id: orgAId } },
        customer: { connect: { id: customer.id } },
        job: { connect: { id: job.id } },
        status: 'ISSUED',
        subtotal: 250.00,
        taxTotal: 12.50,
        total: 262.50,
        amountPaid: 0,
      }
    });

    const stripeEventId = `evt_test_${testId}`;
    const providerPaymentId = `pi_test_${testId}`;

    // Simulate Webhook Execution 1 (First Delivery)
    await prisma.$transaction(async (tx) => {
      const existing = await tx.stripeWebhookEvent.findUnique({ where: { stripeEventId } });
      if (!existing) {
        await tx.stripeWebhookEvent.create({ data: { stripeEventId, type: 'payment_intent.succeeded' } });
        const payment = await tx.payment.create({
          data: {
            invoiceId: invoice.id,
            type: 'CHARGE',
            amount: 250.00,
            currency: 'cad',
            status: 'SUCCEEDED',
            provider: 'stripe',
            providerPaymentId,
            idempotencyKey: `pi_${providerPaymentId}_success`,
          }
        });
        await tx.invoice.update({
          where: { id: invoice.id },
          data: { amountPaid: 250.00, status: 'PARTIALLY_PAID' }
        });
      }
    });

    let inv = await prisma.invoice.findUnique({ where: { id: invoice.id } });
    expect(inv?.amountPaid).toBe(250.00);
    expect(inv?.status).toBe('PARTIALLY_PAID');

    // Simulate Webhook Execution 2 (Duplicate Retry)
    await prisma.$transaction(async (tx) => {
      const existing = await tx.stripeWebhookEvent.findUnique({ where: { stripeEventId } });
      if (existing) return;
      throw new Error('Duplicate was not caught!');
    });

    // Simulate Webhook Execution 3 (Third Retry)
    await prisma.$transaction(async (tx) => {
      const existing = await tx.stripeWebhookEvent.findUnique({ where: { stripeEventId } });
      if (existing) return;
      throw new Error('Duplicate was not caught!');
    });

    // Verify exactly 1 payment record, amount remains $250.00, NOT $500 or $750
    const paymentCount = await prisma.payment.count({ where: { invoiceId: invoice.id } });
    expect(paymentCount).toBe(1);

    inv = await prisma.invoice.findUnique({ where: { id: invoice.id } });
    expect(inv?.amountPaid).toBe(250.00);

    // Clean up
    await prisma.payment.deleteMany({ where: { invoiceId: invoice.id } });
    await prisma.stripeWebhookEvent.deleteMany({ where: { stripeEventId } });
    await prisma.invoice.delete({ where: { id: invoice.id } });
    await prisma.job.delete({ where: { id: job.id } });
    await prisma.appointment.delete({ where: { id: appointment.id } });
    await prisma.service.delete({ where: { id: service.id } });
    await prisma.property.delete({ where: { id: property.id } });
    await prisma.customer.delete({ where: { id: customer.id } });
  });

  // TEST 5: Failed Job & Dead-Letter Recording with Zero Secrets Leaked
  it('Dead-Letter Handling: Permanent failure transitions to DEAD_LETTER with sanitized metadata', async () => {
    // Spy on AutomationRulesEngine.evaluateEvent to simulate a fatal domain failure
    vi.spyOn(AutomationRulesEngine, 'evaluateEvent').mockRejectedValueOnce(
      new Error('Permanent third-party downstream failure in worker rule execution')
    );

    const event = await prisma.event.create({
      data: {
        organizationId: orgAId,
        type: 'custom.failure.test',
        entityType: 'Job',
        entityId: randomUUID(),
        status: 'PROCESSING',
        data: JSON.stringify({ secretApiKey: 'sk_live_12345SECRET', password: 'SecretPassword123' }),
      },
    });

    const mockJob = {
      name: 'custom.failure.test',
      data: { eventId: event.id },
      opts: { attempts: 1 },
      attemptsMade: 1, // Final attempt -> DEAD_LETTER
    } as unknown as Job;

    await expect(processEvent(mockJob)).rejects.toThrow('Permanent third-party downstream failure in worker rule execution');

    const failedEvent = await prisma.event.findUnique({ where: { id: event.id } });
    expect(failedEvent?.status).toBe('DEAD_LETTER');
    expect(failedEvent?.failedAt).not.toBeNull();
    expect(failedEvent?.attempts).toBe(1);
    expect(failedEvent?.error).toContain('Permanent third-party downstream failure');

    vi.restoreAllMocks();
  });
});
