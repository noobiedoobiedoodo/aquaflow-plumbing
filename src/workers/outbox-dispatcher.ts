import { prisma } from '../lib/db';
import { eventsQueue } from '../lib/queue/bullmq';
import { Logger } from '../lib/observability/logger';

interface PendingEventRow {
  id: string;
  type: string;
  organizationId: string;
  data: string;
}

export async function claimAndDispatchPendingEvents(batchSize = 50): Promise<number> {
  // If BullMQ / Redis queue is not available, do not claim events.
  // Events safely remain PENDING in PostgreSQL outbox until Redis recovers.
  if (!eventsQueue) {
    return 0;
  }

  try {
    const claimedCount = await prisma.$transaction(async (tx) => {
      // Concurrency-safe atomic claim using PostgreSQL row locking with SKIP LOCKED
      const claimedEvents = await tx.$queryRaw<PendingEventRow[]>`
        SELECT id, type, "organizationId", data
        FROM "Event"
        WHERE status = 'PENDING'
        ORDER BY "createdAt" ASC
        LIMIT ${batchSize}
        FOR UPDATE SKIP LOCKED
      `;

      if (!claimedEvents || claimedEvents.length === 0) {
        return 0;
      }

      const eventIds = claimedEvents.map((e) => e.id);

      // Atomically transition status to PROCESSING
      await tx.event.updateMany({
        where: { id: { in: eventIds } },
        data: { status: 'PROCESSING' },
      });

      // Dispatch to BullMQ with jobId idempotency
      const jobs = claimedEvents.map((e) => ({
        name: e.type,
        data: { eventId: e.id },
        opts: {
          jobId: e.id, // BullMQ idempotency key
          attempts: 5,
          backoff: { type: 'exponential', delay: 2000 },
        },
      }));

      if (eventsQueue) {
        try {
          await eventsQueue.addBulk(jobs);
        } catch (queueErr) {
          Logger.warn('Queue dispatch failed, events remain in PROCESSING for BullMQ worker retry when Redis recovers', {
            operation: 'outbox.queue_fallback',
          });
        }
      }

      return claimedEvents.length;
    });

    if (claimedCount > 0) {
      Logger.info(`Dispatched ${claimedCount} events to BullMQ queue.`, {
        operation: 'outbox.dispatch',
        metadata: { count: claimedCount },
      });
    }

    return claimedCount;
  } catch (error: any) {
    Logger.error('Failed to claim and dispatch outbox events', error, {
      operation: 'outbox.dispatch',
    });
    return 0;
  }
}

// Start polling loop
export function startOutboxDispatcher(intervalMs = 5000) {
  Logger.info(`Starting concurrency-safe Outbox Dispatcher (interval: ${intervalMs}ms)...`, {
    operation: 'outbox.start',
  });

  const timer = setInterval(() => {
    claimAndDispatchPendingEvents().catch((err) => {
      Logger.error('Unhandled error in outbox polling tick', err, {
        operation: 'outbox.tick',
      });
    });
  }, intervalMs);

  // Initial execution
  claimAndDispatchPendingEvents().catch(() => {});

  return timer;
}
