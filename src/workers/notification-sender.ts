import { Worker, Job } from 'bullmq';
import { prisma } from '../lib/db';
import { redis } from '../lib/queue/redis';
import { QUEUES, NotificationQueueJobData } from '../lib/queue/bullmq';
import { Logger } from '../lib/observability/logger';

const isProduction = process.env.NODE_ENV === 'production';
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'AquaFlow <onboarding@aquaflowplumbing.com>';
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER;

export async function processNotification(job: Job<NotificationQueueJobData>) {
  const { notificationId } = job.data;

  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
    include: { organization: true, user: true },
  });

  if (!notification) throw new Error(`Notification ${notificationId} not found`);
  if (notification.status === 'DELIVERED' || notification.status === 'SENT') return; // Idempotency

  await prisma.notification.update({
    where: { id: notificationId },
    data: { status: 'PROCESSING', attempts: { increment: 1 } },
  });

  Logger.info(`Processing ${notification.channel} notification ${notification.id}`, {
    operation: 'notification.process',
    organizationId: notification.organizationId,
    metadata: { notificationId, channel: notification.channel, type: notification.type },
  });

  try {
    let providerId: string | null = null;

    if (notification.channel === 'EMAIL') {
      if (RESEND_API_KEY && !RESEND_API_KEY.includes('mock')) {
        const { Resend } = await import('resend');
        const resend = new Resend(RESEND_API_KEY);
        const metadata = JSON.parse(notification.metadata || '{}');
        const toEmail = metadata.email || notification.user?.email;

        if (!toEmail) {
          throw new Error(`No recipient email found for notification ${notification.id}`);
        }

        const res = await resend.emails.send({
          from: EMAIL_FROM,
          to: toEmail,
          subject: notification.subject || 'Update from AquaFlow',
          text: notification.content,
          tags: [{ name: 'notificationId', value: notification.id }],
        });

        if (res.error) throw new Error(res.error.message);
        providerId = res.data?.id || null;
      } else {
        if (isProduction) {
          throw new Error('RESEND_API_KEY is not configured in production. Cannot send email.');
        }
        // In local development / test without key
        Logger.info(`[Dev Mailer] Email simulated for local testing (subject: ${notification.subject})`, {
          operation: 'notification.email.dev',
          organizationId: notification.organizationId,
        });
        providerId = `dev_email_${Date.now()}`;
      }
    } else if (notification.channel === 'SMS') {
      if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_FROM_NUMBER) {
        const twilio = (await import('twilio')).default(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
        const metadata = JSON.parse(notification.metadata || '{}');
        const toNumber = metadata.phone || notification.user?.phone;

        if (!toNumber) {
          throw new Error(`No recipient phone number found for SMS notification ${notification.id}`);
        }

        const msg = await twilio.messages.create({
          body: notification.content,
          from: TWILIO_FROM_NUMBER,
          to: toNumber,
        });

        providerId = msg.sid;
      } else {
        if (isProduction) {
          throw new Error('Twilio SMS is not configured in production.');
        }
        Logger.info(`[Dev SMS] SMS simulated for local testing`, {
          operation: 'notification.sms.dev',
          organizationId: notification.organizationId,
        });
        providerId = `dev_sms_${Date.now()}`;
      }
    } else if (notification.channel === 'IN_APP') {
      // In-app notifications are stored directly in DB
      providerId = `in_app_${Date.now()}`;
    }

    // Mark as SENT with provider reference
    await prisma.notification.update({
      where: { id: notificationId },
      data: {
        status: 'SENT',
        sentAt: new Date(),
        providerId,
      },
    });

    Logger.info(`Notification ${notification.id} dispatched successfully via ${notification.channel}`, {
      operation: 'notification.sent',
      organizationId: notification.organizationId,
      metadata: { notificationId, providerId },
    });
  } catch (error: any) {
    const isFinalFailure = job.attemptsMade >= (job.opts.attempts || 1);

    await prisma.notification.update({
      where: { id: notificationId },
      data: {
        status: isFinalFailure ? 'FAILED' : 'PENDING',
        failureReason: error.message,
        failedAt: new Date(),
      },
    });

    if (isFinalFailure) {
      await prisma.event.create({
        data: {
          organizationId: notification.organizationId,
          type: 'notification.failed',
          entityType: 'Notification',
          entityId: notification.id,
          data: JSON.stringify({
            notificationId: notification.id,
            channel: notification.channel,
            error: error.message,
          }),
        },
      });
    }

    Logger.error(`Failed to send notification ${notification.id}`, error, {
      operation: 'notification.send.error',
      organizationId: notification.organizationId,
      metadata: { notificationId, attemptsMade: job.attemptsMade },
    });

    throw error;
  }
}

export function startNotificationSender() {
  if (!redis) {
    Logger.warn('Skipping Notification Sender worker: REDIS_URL not configured.', { operation: 'worker.notification.skip' });
    return null;
  }
  Logger.info('Starting Notification Sender worker...', { operation: 'worker.notification.start' });
  const worker = new Worker<NotificationQueueJobData>(QUEUES.NOTIFICATIONS, processNotification, {
    connection: redis,
  });

  worker.on('failed', (job, err) => {
    Logger.error(`Notification Job ${job?.id} failed`, err, { operation: 'worker.notification.failed' });
  });

  return worker;
}
