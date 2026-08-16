import { Queue, Worker, QueueEvents, Job } from 'bullmq';
import { redis } from './redis';

// Define strict types for our queues
export const QUEUES = {
  EVENTS: 'events-queue',
  NOTIFICATIONS: 'notifications-queue',
} as const;

// Types for the jobs themselves
export type EventQueueJobData = {
  eventId: string;
};

export type NotificationQueueJobData = {
  notificationId: string;
};

// Create queue instances
export const eventsQueue = new Queue<EventQueueJobData>(QUEUES.EVENTS, { connection: redis });
export const notificationsQueue = new Queue<NotificationQueueJobData>(QUEUES.NOTIFICATIONS, { connection: redis });

// In Next.js environments, we generally don't want to instantiate Workers inside
// the normal web process (api routes/page renders). 
// They should be run in a separate custom server, or a standalone Node.js process.
// For this platform, we will create separate worker entrypoints in `src/workers/`
