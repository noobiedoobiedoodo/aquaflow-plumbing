import { startOutboxDispatcher } from './outbox-dispatcher';
import { startEventProcessor } from './event-processor';
import { startNotificationSender } from './notification-sender';
import { Logger } from '../lib/observability/logger';
import { redis } from '../lib/queue/redis';

Logger.info('Bootstrapping AquaFlow Worker Process...', { operation: 'worker.bootstrap' });

const outboxTimer = startOutboxDispatcher(5000);
const eventWorker = startEventProcessor();
const notificationWorker = startNotificationSender();

Logger.info('All AquaFlow workers initialized successfully.', { operation: 'worker.ready' });

async function shutdown(signal: string) {
  Logger.info(`Received ${signal}. Shutting down worker process gracefully...`, { operation: 'worker.shutdown' });
  clearInterval(outboxTimer);
  const tasks: Promise<any>[] = [];
  if (eventWorker) tasks.push(eventWorker.close());
  if (notificationWorker) tasks.push(notificationWorker.close());
  if (redis) tasks.push(redis.quit());
  await Promise.allSettled(tasks);
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
