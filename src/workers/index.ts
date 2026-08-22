import http from 'http';
import { prisma } from '../lib/db';
import { redis } from '../lib/queue/redis';
import { startOutboxDispatcher } from './outbox-dispatcher';
import { startEventProcessor } from './event-processor';
import { startNotificationSender } from './notification-sender';
import { Logger } from '../lib/observability/logger';
import { QUEUES } from '../lib/queue/bullmq';

const startTime = new Date();
let isShuttingDown = false;
let lastHeartbeat = new Date();

Logger.info('Bootstrapping AquaFlow Continuous Worker Process...', { operation: 'worker.bootstrap' });

// 1. Connection Checks
async function verifyConnections() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    Logger.info('Worker: PostgreSQL database connection verified.', { operation: 'worker.db.connected' });
  } catch (dbErr: any) {
    Logger.error('Worker: PostgreSQL database connection failed on bootstrap', dbErr, { operation: 'worker.db.error' });
  }

  if (redis) {
    try {
      await redis.ping();
      Logger.info('Worker: Redis connection verified.', { operation: 'worker.redis.connected' });
    } catch (redisErr: any) {
      Logger.error('Worker: Redis ping failed on bootstrap', redisErr, { operation: 'worker.redis.error' });
    }
  } else {
    Logger.warn('Worker: REDIS_URL not configured. Running outbox dispatcher with database fallback.', { operation: 'worker.redis.unconfigured' });
  }
}

verifyConnections().catch(() => {});

// 2. Start Worker Queues & Dispatchers
const outboxTimer = startOutboxDispatcher(5000);
const eventWorker = startEventProcessor();
const notificationWorker = startNotificationSender();

Logger.info('All AquaFlow continuous workers initialized successfully.', {
  operation: 'worker.ready',
  metadata: {
    queues: [QUEUES.EVENTS, QUEUES.NOTIFICATIONS],
    outboxIntervalMs: 5000,
  },
});

// 3. HTTP Health & Liveness Probe Server
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8080;
const healthServer = http.createServer(async (req, res) => {
  lastHeartbeat = new Date();
  const url = req.url || '/';

  if (url === '/health' || url === '/healthz' || url === '/') {
    let dbStatus = 'DISCONNECTED';
    let redisStatus = redis ? 'CONNECTED' : 'UNCONFIGURED';

    try {
      await prisma.$queryRaw`SELECT 1`;
      dbStatus = 'CONNECTED';
    } catch {
      dbStatus = 'ERROR';
    }

    if (redis) {
      try {
        await redis.ping();
        redisStatus = 'CONNECTED';
      } catch {
        redisStatus = 'ERROR';
      }
    }

    const isHealthy = !isShuttingDown && dbStatus === 'CONNECTED';
    const statusCode = isHealthy ? 200 : 503;

    const payload = {
      status: isHealthy ? 'HEALTHY' : 'UNHEALTHY',
      service: 'aquaflow-worker',
      worker: isShuttingDown ? 'SHUTTING_DOWN' : 'ONLINE',
      database: dbStatus,
      redis: redisStatus,
      queues: [QUEUES.EVENTS, QUEUES.NOTIFICATIONS],
      uptimeSeconds: Math.floor((Date.now() - startTime.getTime()) / 1000),
      startedAt: startTime.toISOString(),
      timestamp: new Date().toISOString(),
      lastHeartbeat: lastHeartbeat.toISOString(),
    };

    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(payload, null, 2));
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

healthServer.listen(PORT, '0.0.0.0', () => {
  Logger.info(`Worker Health Check Server listening on port ${PORT}`, {
    operation: 'worker.health_server.listening',
    metadata: { port: PORT },
  });
});

// 4. Graceful Shutdown
async function shutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  Logger.info(`Received ${signal}. Shutting down worker process gracefully...`, {
    operation: 'worker.shutdown',
    metadata: { signal },
  });

  // Stop accepting new health check connections
  healthServer.close(() => {
    Logger.info('Health server closed.', { operation: 'worker.health_server.closed' });
  });

  // Clear outbox timer
  clearInterval(outboxTimer);

  const tasks: Promise<any>[] = [];
  if (eventWorker) tasks.push(eventWorker.close());
  if (notificationWorker) tasks.push(notificationWorker.close());
  if (redis) tasks.push(redis.quit());
  tasks.push(prisma.$disconnect());

  await Promise.allSettled(tasks);
  Logger.info('All worker connections closed. Exiting process cleanly.', { operation: 'worker.shutdown.complete' });
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  Logger.error('Uncaught exception in worker process', err, { operation: 'worker.uncaught_exception' });
});

process.on('unhandledRejection', (reason) => {
  Logger.error('Unhandled promise rejection in worker process', reason instanceof Error ? reason : new Error(String(reason)), {
    operation: 'worker.unhandled_rejection',
  });
});
