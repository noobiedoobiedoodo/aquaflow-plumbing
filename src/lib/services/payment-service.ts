import { prisma } from '@/lib/db';

export class PaymentService {
  /**
   * Processes a successful payment from a webhook.
   */
  static async processPaymentSuccess(organizationId: string, invoiceId: string, amountPaid: number, providerTransactionId: string) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, organizationId }
    });

    if (!invoice) throw new Error('Invoice not found');
    if (invoice.status === 'PAID') throw new Error('Invoice already paid');

    return await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          invoiceId,
          amount: amountPaid,
          provider: 'STRIPE',
          providerPaymentId: providerTransactionId,
          idempotencyKey: providerTransactionId,
          status: 'SUCCEEDED'
        }
      });

      const updatedInvoice = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          status: 'PAID',
          amountPaid: { increment: amountPaid }
        }
      });

      // Insert Financial Activity
      await tx.financialActivity.create({
        data: {
          invoiceId: invoice.id,
          paymentId: payment.id,
          event: 'PAYMENT_RECEIVED',
          metadata: JSON.stringify({ providerTransactionId, amountPaid })
        }
      });

      // Outbox Event
      await tx.event.create({
        data: {
          organizationId,
          type: 'payment.succeeded',
          entityType: 'Payment',
          entityId: payment.id,
          data: JSON.stringify({ invoiceId: invoice.id, customerId: invoice.customerId, amount: amountPaid })
        }
      });

      return { payment, invoice: updatedInvoice };
    });
  }
}
