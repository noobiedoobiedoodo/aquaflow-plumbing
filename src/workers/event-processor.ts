import { Worker, Job } from 'bullmq';
import { prisma } from '../lib/db';
import { redis } from '../lib/queue/redis';
import { QUEUES, EventQueueJobData } from '../lib/queue/bullmq';
import { AutomationRulesEngine } from '../lib/automation/rules-engine';
import { Logger } from '../lib/observability/logger';

export async function processEvent(job: Job<EventQueueJobData>) {
  const { eventId } = job.data;

  Logger.info(`Processing Event ${eventId} (Type: ${job.name})`, {
    operation: 'event.process',
    metadata: { eventId, jobName: job.name },
  });

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { organization: true },
  });

  if (!event) throw new Error(`Event ${eventId} not found`);

  try {
    // Execute Automation Rules Engine
    await AutomationRulesEngine.evaluateEvent(event.id);

    // Mark Event as COMPLETED
    await prisma.event.update({
      where: { id: eventId },
      data: { status: 'COMPLETED', processedAt: new Date() },
    });

    Logger.info(`Event ${eventId} processed successfully`, {
      operation: 'event.completed',
      organizationId: event.organizationId,
      metadata: { eventId, type: event.type },
    });
  } catch (error: any) {
    const isFinalFailure = job.attemptsMade >= (job.opts.attempts || 1);

    await prisma.event.update({
      where: { id: eventId },
      data: {
        status: isFinalFailure ? 'DEAD_LETTER' : 'FAILED',
        error: error.message,
        failedAt: new Date(),
        attempts: { increment: 1 },
      },
    });

    Logger.error(`Error processing event ${eventId}`, error, {
      operation: 'event.error',
      organizationId: event.organizationId,
      metadata: { eventId, isFinalFailure },
    });

    throw error;
  }
}

export function startEventProcessor() {
  Logger.info('Starting Event Processor worker...', { operation: 'worker.event.start' });
  const worker = new Worker<EventQueueJobData>(QUEUES.EVENTS, processEvent, { connection: redis });

  worker.on('failed', (job, err) => {
    Logger.error(`Event Job ${job?.id} failed`, err, { operation: 'worker.event.failed' });
  });

  return worker;
}
