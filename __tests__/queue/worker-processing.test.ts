import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { prisma } from '@/lib/db';
import { randomUUID } from 'crypto';
import { processEvent } from '@/workers/event-processor';
import { processNotification } from '@/workers/notification-sender';
import { Job } from 'bullmq';

describe('BullMQ Worker Lifecycle & Processing Verification Suite', () => {
  let testId: string;
  let orgId: string;
  let userId: string;

  beforeEach(async () => {
    testId = randomUUID().slice(0, 8);
    const org = await prisma.organization.create({
      data: { name: `Worker Test Org ${testId}`, slug: `worker-org-${testId}` },
    });
    orgId = org.id;

    const user = await prisma.user.create({
      data: {
        email: `worker.user.${testId}@test.com`,
        firstName: 'Worker',
        lastName: 'Tester',
        passwordHash: 'dummy_hash',
      },
    });
    userId = user.id;
  });

  afterEach(async () => {
    if (orgId) {
      await prisma.notification.deleteMany({ where: { organizationId: orgId } });
      await prisma.event.deleteMany({ where: { organizationId: orgId } });
      await prisma.user.deleteMany({ where: { id: userId } });
      await prisma.organization.deleteMany({ where: { id: orgId } });
    }
  });

  it('Event Worker: Enqueue -> Process -> Status COMPLETED', async () => {
    // 1. Create PENDING Event
    const event = await prisma.event.create({
      data: {
        organizationId: orgId,
        type: 'job.created',
        entityType: 'Job',
        entityId: randomUUID(),
        status: 'PENDING',
        data: JSON.stringify({ note: 'Automated test event' }),
      },
    });

    // 2. Simulate BullMQ Job
    const mockJob = {
      name: 'job.created',
      data: { eventId: event.id },
      opts: { attempts: 3 },
      attemptsMade: 1,
    } as unknown as Job;

    // 3. Execute Worker Processor
    await processEvent(mockJob);

    // 4. Verify DB State Transition to COMPLETED
    const updatedEvent = await prisma.event.findUnique({ where: { id: event.id } });
    expect(updatedEvent).toBeDefined();
    expect(updatedEvent!.status).toBe('COMPLETED');
    expect(updatedEvent!.processedAt).not.toBeNull();
  });

  it('Event Worker: Handles missing event gracefully', async () => {
    const fakeEventId = randomUUID();
    const mockJob = {
      name: 'unknown.event',
      data: { eventId: fakeEventId },
      opts: { attempts: 1 },
      attemptsMade: 1,
    } as unknown as Job;

    await expect(processEvent(mockJob)).rejects.toThrow(`Event ${fakeEventId} not found`);
  });

  it('Notification Worker: Process Email Notification -> Status SENT/DELIVERED', async () => {
    // 1. Create PENDING Notification
    const notification = await prisma.notification.create({
      data: {
        organizationId: orgId,
        userId,
        type: 'JOB_ASSIGNED',
        channel: 'EMAIL',
        subject: 'Your job has been dispatched',
        content: 'Technician is en route to your property.',
        status: 'PENDING',
        metadata: JSON.stringify({ email: `worker.user.${testId}@test.com` }),
        idempotencyKey: `notif:${randomUUID()}`,
      },
    });

    // 2. Simulate BullMQ Job
    const mockJob = {
      name: 'send-notification',
      data: { notificationId: notification.id },
      opts: { attempts: 3 },
      attemptsMade: 1,
    } as unknown as Job;

    // 3. Execute Notification Processor
    await processNotification(mockJob);

    // 4. Verify Notification State Transition
    const updated = await prisma.notification.findUnique({ where: { id: notification.id } });
    expect(updated).toBeDefined();
    expect(['SENT', 'DELIVERED', 'COMPLETED']).toContain(updated!.status);
  });

  it('Notification Worker: Idempotency (Already SENT notification is not re-processed)', async () => {
    const notification = await prisma.notification.create({
      data: {
        organizationId: orgId,
        userId,
        type: 'JOB_COMPLETED',
        channel: 'IN_APP',
        content: 'Work completed',
        status: 'SENT',
        idempotencyKey: `notif:${randomUUID()}`,
      },
    });

    const mockJob = {
      name: 'send-notification',
      data: { notificationId: notification.id },
      opts: { attempts: 1 },
      attemptsMade: 1,
    } as unknown as Job;

    await processNotification(mockJob);

    const check = await prisma.notification.findUnique({ where: { id: notification.id } });
    expect(check!.status).toBe('SENT');
  });
});
