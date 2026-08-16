import { prisma } from '@/lib/db';
import { InvoiceService } from '@/lib/services/invoice-service';
import { PaymentService } from '@/lib/services/payment-service';
import { SchedulingService } from '@/lib/services/scheduling-service';

/**
 * Registry mapping Event Types to internal rule execution logic.
 * These act as the concrete implementation of the deterministic rules.
 */
const RULE_EXECUTORS: Record<string, (event: any, rule: any) => Promise<void>> = {
  // Workflow 1: Estimate Approved -> Scheduling Required + Customer Notify
  'ESTIMATE_APPROVED_WORKFLOW': async (event, rule) => {
    const payload = JSON.parse(event.data);
    await SchedulingService.requestSchedulingForEstimate(event.organizationId, payload.estimateId);
    
    // Create Customer Notification
    await prisma.notification.create({
      data: {
        organizationId: event.organizationId,
        idempotencyKey: `est_notify:${event.id}`,
        type: 'ESTIMATE_APPROVED',
        channel: 'EMAIL',
        status: 'PENDING',
        subject: 'Estimate Approved - Scheduling Pending',
        content: `Hi there, your estimate has been approved. Our dispatcher will contact you shortly to schedule the service.`,
        metadata: JSON.stringify({ customerId: payload.customerId })
      }
    });

    const estimate = await prisma.estimate.findUnique({ where: { id: payload.estimateId } });

    // Generate Task for Dispatcher
    await prisma.task.create({
      data: {
        organizationId: event.organizationId,
        title: 'Schedule approved estimate',
        type: 'SCHEDULING_REQUIRED',
        status: 'OPEN',
        priority: 'HIGH',
        relatedJobId: estimate?.jobId,
        relatedCustId: payload.customerId,
        createdByType: 'AUTOMATION'
      }
    });

    // Generate Intelligence Recommendations for Dispatcher
    if (estimate?.jobId) {
      const { RecommendationEngine } = await import('@/lib/intelligence/recommendation-engine');
      await RecommendationEngine.scoreAndPersistCandidates(estimate.jobId);
    }
  },

  // Intelligence Workflow: Unassigned Job Created -> Recommend Techs
  'GENERATE_RECOMMENDATIONS': async (event, rule) => {
    const payload = JSON.parse(event.data);
    const { RecommendationEngine } = await import('@/lib/intelligence/recommendation-engine');
    await RecommendationEngine.scoreAndPersistCandidates(payload.jobId);
  },

  // Workflow 2: Technician En Route
  'EN_ROUTE_NOTIFICATION': async (event, rule) => {
    const payload = JSON.parse(event.data);
    
    const dbJob = await prisma.job.findUnique({
      where: { id: payload.jobId },
      include: { 
        appointment: { include: { customer: true, property: true } },
        technician: { include: { user: true } },
        organization: true
      }
    });

    if (!dbJob || !dbJob.appointment.customer || !dbJob.technician) return;

    // Send SMS
    await prisma.notification.create({
      data: {
        organizationId: event.organizationId,
        idempotencyKey: `en_route_sms:${event.id}`,
        userId: dbJob.technician.userId,
        type: 'TECH_EN_ROUTE',
        channel: 'SMS',
        status: 'PENDING',
        subject: 'Tech En Route',
        content: `Hi ${dbJob.appointment.customer.firstName}, your ${dbJob.organization.name} technician ${dbJob.technician.user.firstName} is en route to ${dbJob.appointment.property.address}.`,
        metadata: JSON.stringify({ customerId: dbJob.appointment.customerId, jobId: dbJob.id })
      }
    });
  },

  // Workflow 3: Touchless Billing
  'AUTO_INVOICE_ON_COMPLETION': async (event, rule) => {
    const payload = JSON.parse(event.data);
    
    const org = await prisma.organization.findUnique({ where: { id: event.organizationId } });
    if (!org?.autoInvoiceOnCompletion) {
      // Flag for manual review if auto-billing is off
      await prisma.notification.create({
        data: {
          organizationId: event.organizationId,
          idempotencyKey: `manual_invoice:${event.id}`,
          type: 'MANUAL_INVOICE_REVIEW',
          channel: 'IN_APP',
          status: 'PENDING',
          subject: `Job Completed: Ready for Invoicing`,
          content: `Job ${payload.jobId} is complete. Please review labor and parts before generating the final invoice.`,
          metadata: JSON.stringify({ jobId: payload.jobId })
        }
      });
      return;
    }

    const invoice = await InvoiceService.generateInvoice(event.organizationId, payload.jobId);

    // Send invoice link to customer
    await prisma.notification.create({
      data: {
        organizationId: event.organizationId,
        idempotencyKey: `send_invoice:${invoice.id}`,
        type: 'INVOICE_SENT',
        channel: 'EMAIL',
        status: 'PENDING',
        subject: `Your Invoice from ${org.name}`,
        content: `Your invoice ${invoice.invoiceNumber} is ready. You can pay online via your customer portal.`,
        metadata: JSON.stringify({ invoiceId: invoice.id, customerId: invoice.customerId })
      }
    });
  },

  // Workflow 4: Payment Succeeded -> Receipt
  'PAYMENT_RECEIPT_WORKFLOW': async (event, rule) => {
    const payload = JSON.parse(event.data);
    
    // We assume PaymentService processed the Stripe webhook.
    // This rule just sends the receipt.
    const org = await prisma.organization.findUnique({ where: { id: event.organizationId } });
    
    await prisma.notification.create({
      data: {
        organizationId: event.organizationId,
        idempotencyKey: `receipt:${event.id}`,
        type: 'PAYMENT_RECEIPT',
        channel: 'EMAIL',
        status: 'PENDING',
        subject: `Payment Receipt from ${org?.name}`,
        content: `Thank you for your payment of $${payload.amount}.`,
        metadata: JSON.stringify({ invoiceId: payload.invoiceId, customerId: payload.customerId })
      }
    });
  },

  // Workflow 5: Appointment Reminders
  'APPOINTMENT_REMINDER_WORKFLOW': async (event, rule) => {
    const payload = JSON.parse(event.data);
    const dbAppt = await prisma.appointment.findUnique({
      where: { id: payload.appointmentId },
      include: { customer: true }
    });

    if (!dbAppt || !dbAppt.customer) return;

    await prisma.notification.create({
      data: {
        organizationId: event.organizationId,
        idempotencyKey: `reminder:${payload.reminderType}:${dbAppt.id}`,
        type: 'APPOINTMENT_REMINDER',
        channel: 'SMS', // Defaulting to SMS for urgent reminders
        status: 'PENDING',
        subject: `Upcoming Appointment Reminder`,
        content: `Hi ${dbAppt.customer.firstName}, reminder that your AquaFlow technician will arrive for your appointment at ${new Date(dbAppt.startTime).toLocaleTimeString()}.`,
        metadata: JSON.stringify({ customerId: dbAppt.customerId, appointmentId: dbAppt.id })
      }
    });
  },

  // Workflow 6: Missed Appointment Alert
  'MISSED_APPOINTMENT_ALERT': async (event, rule) => {
    const payload = JSON.parse(event.data);
    
    await prisma.notification.create({
      data: {
        organizationId: event.organizationId,
        idempotencyKey: `missed_appt:${payload.appointmentId}`,
        type: 'MISSED_APPOINTMENT',
        channel: 'IN_APP',
        status: 'PENDING',
        subject: `Alert: Missed Appointment`,
        content: `Appointment ${payload.appointmentId} has passed its start time without a technician arriving. Please investigate.`,
        metadata: JSON.stringify({ appointmentId: payload.appointmentId })
      }
    });
  },

  // Workflow 7: Overdue Invoice Reminders
  'OVERDUE_INVOICE_REMINDER': async (event, rule) => {
    const payload = JSON.parse(event.data);
    
    await prisma.notification.create({
      data: {
        organizationId: event.organizationId,
        idempotencyKey: `overdue_reminder:${payload.invoiceId}`,
        type: 'INVOICE_OVERDUE',
        channel: 'EMAIL',
        status: 'PENDING',
        subject: `Overdue Invoice Alert`,
        content: `Your invoice is past due. Please review your portal to complete the payment.`,
        metadata: JSON.stringify({ invoiceId: payload.invoiceId })
      }
    });
  },

  // Workflow 8: Failed Communication Escalation
  'FAILED_COMMUNICATION_ESCALATION': async (event, rule) => {
    const payload = JSON.parse(event.data);
    const failedNotif = await prisma.notification.findUnique({ where: { id: payload.notificationId } });
    
    if (!failedNotif) return;

    if (failedNotif.channel === 'SMS') {
      // Fallback to Email
      await prisma.notification.create({
        data: {
          organizationId: event.organizationId,
          idempotencyKey: `escalation_email:${failedNotif.id}`,
          type: failedNotif.type,
          channel: 'EMAIL',
          status: 'PENDING',
          subject: failedNotif.subject || 'Notification Fallback',
          content: failedNotif.content,
          metadata: failedNotif.metadata
        }
      });
    } else {
      // If Email fails, alert Dispatcher via Task
      await prisma.task.create({
        data: {
          organizationId: event.organizationId,
          title: `Communication Delivery Failed`,
          type: 'INVESTIGATE',
          priority: 'HIGH',
          status: 'OPEN',
          createdByType: 'AUTOMATION',
          metadata: JSON.stringify({ 
            originalNotificationId: failedNotif.id,
            type: failedNotif.type
          })
        }
      });
    }
  }
};

export class AutomationRulesEngine {
  /**
   * Main entrypoint for evaluating and executing automation rules for an event.
   */
  static async evaluateEvent(eventId: string) {
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new Error(`Event ${eventId} not found`);

    // 1. Fetch active rules for this event type
    const rules = await prisma.automationRule.findMany({
      where: {
        organizationId: event.organizationId,
        eventType: event.type,
        enabled: true
      },
      orderBy: { priority: 'desc' }
    });

    if (rules.length === 0) return;

    console.log(`[AutomationEngine] Evaluated ${rules.length} rule(s) for event ${event.type}`);

    // 2. Execute each rule idempotently
    for (const rule of rules) {
      await this.executeRuleSafely(event, rule);
    }
  }

  private static async executeRuleSafely(event: any, rule: any) {
    const idempotencyKey = `${rule.id}:${event.id}`;

    // Try to acquire execution lock
    try {
      const execution = await prisma.automationExecution.create({
        data: {
          ruleId: rule.id,
          eventId: event.id,
          idempotencyKey,
          status: 'PROCESSING',
          startedAt: new Date()
        }
      });

      console.log(`[AutomationEngine] Executing Rule: ${rule.name} (Execution ${execution.id})`);

      const executor = RULE_EXECUTORS[rule.name];
      if (!executor) {
        throw new Error(`No concrete executor found for rule mapping: ${rule.name}`);
      }

      // Execute authorized domain actions
      await executor(event, rule);

      // Mark success
      await prisma.automationExecution.update({
        where: { id: execution.id },
        data: { status: 'COMPLETED', completedAt: new Date() }
      });

    } catch (err: any) {
      // If it's a unique constraint violation on idempotencyKey, the rule already fired.
      if (err.code === 'P2002') {
        console.log(`[AutomationEngine] Rule ${rule.name} already executed for event ${event.id}. Skipping.`);
        return;
      }

      console.error(`[AutomationEngine] Rule ${rule.name} failed:`, err);
      
      // Update execution with failure state if it was created
      const existingExecution = await prisma.automationExecution.findUnique({ where: { idempotencyKey } });
      if (existingExecution) {
        await prisma.automationExecution.update({
          where: { id: existingExecution.id },
          data: { status: 'FAILED', error: err.message || 'Unknown error', attempts: { increment: 1 } }
        });
      }
    }
  }
}
