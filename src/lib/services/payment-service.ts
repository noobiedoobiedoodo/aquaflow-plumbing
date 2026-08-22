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

      const newAmountPaid = Number((invoice.amountPaid + amountPaid).toFixed(2));
      let newStatus = invoice.status;
      if (newAmountPaid >= invoice.total) {
        newStatus = 'PAID';
      } else if (newAmountPaid > 0) {
        newStatus = 'PARTIALLY_PAID';
      }

      const updatedInvoice = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          status: newStatus,
          amountPaid: newAmountPaid,
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
