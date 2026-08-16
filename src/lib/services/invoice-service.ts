import { prisma } from '@/lib/db';
import { randomUUID } from 'crypto';

async function generateInvoiceNumber(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  organizationId: string
): Promise<string> {
  const year = new Date().getFullYear();
  const count = await tx.invoice.count({
    where: {
      createdAt: {
        gte: new Date(`${year}-01-01`),
      },
    },
  });

  const sequential = (count + 1).toString().padStart(5, '0');
  const entropy = randomUUID().slice(0, 4).toUpperCase();
  return `INV-${year}-${sequential}-${entropy}`;
}

export class InvoiceService {
  /**
   * Generates a final invoice for a completed job using authoritative organization configuration and TaxRules.
   */
  static async generateInvoice(organizationId: string, jobId: string, laborHourlyRate: number = 125.0) {
    const job = await prisma.job.findFirst({
      where: { id: jobId, organizationId },
      include: {
        appointment: { include: { service: true } },
        parts: true,
        timeEntries: true,
      },
    });

    if (!job) throw new Error('Job not found');
    if (job.status !== 'COMPLETED') throw new Error('Cannot invoice an incomplete job');

    return await prisma.$transaction(async (tx) => {
      const existingInvoice = await tx.invoice.findUnique({
        where: { jobId },
      });

      if (existingInvoice) throw new Error('Invoice already exists for this job');

      // 1. Fetch Organization configuration and Active Tax Rules (Authoritative Multi-Tenant Source of Truth)
      const org = await tx.organization.findUnique({
        where: { id: organizationId },
        select: { taxRate: true },
      });

      const taxRules = await tx.taxRule.findMany({
        where: { organizationId, active: true },
      });

      // 2. Calculate Labor Cost
      const totalDurationSeconds = job.timeEntries.reduce(
        (acc: number, entry: { durationSeconds: number | null }) => acc + (entry.durationSeconds || 0),
        0
      );
      const totalHours = totalDurationSeconds / 3600;
      const laborSubtotal = totalHours > 0 ? Number((totalHours * laborHourlyRate).toFixed(2)) : 0;

      const invoiceLines: { description: string; quantity: number; unitCost: number }[] = [];
      if (totalHours > 0) {
        invoiceLines.push({
          description: `Labor - ${job.appointment?.service?.name || 'Plumbing Service'}`,
          quantity: Number(totalHours.toFixed(2)),
          unitCost: laborHourlyRate,
        });
      }

      // 3. Calculate Materials Cost
      let materialSubtotal = 0;
      for (const part of job.parts) {
        const cost = Number((part.quantity * part.unitCost).toFixed(2));
        materialSubtotal += cost;
        invoiceLines.push({
          description: `Material - ${part.name}`,
          quantity: part.quantity,
          unitCost: part.unitCost,
        });
      }

      const subtotal = Number((laborSubtotal + materialSubtotal).toFixed(2));

      // 4. Calculate Taxes based on Organization TaxRules (or Organization taxRate fallback)
      const invoiceTaxes: { name: string; jurisdiction: string; rate: number; amount: number }[] = [];
      let taxTotal = 0;

      if (taxRules.length > 0) {
        for (const rule of taxRules) {
          let taxableAmount = 0;
          if (rule.appliesTo === 'ALL') taxableAmount = subtotal;
          if (rule.appliesTo === 'LABOR') taxableAmount = laborSubtotal;
          if (rule.appliesTo === 'MATERIALS') taxableAmount = materialSubtotal;

          if (taxableAmount > 0) {
            const taxAmount = Number((taxableAmount * rule.rate).toFixed(2));
            taxTotal += taxAmount;
            invoiceTaxes.push({
              name: rule.name,
              jurisdiction: rule.jurisdiction,
              rate: rule.rate,
              amount: taxAmount,
            });
          }
        }
      } else if (org?.taxRate) {
        const taxAmount = Number((subtotal * org.taxRate).toFixed(2));
        taxTotal = taxAmount;
        invoiceTaxes.push({
          name: 'Standard Tax',
          jurisdiction: 'Standard',
          rate: org.taxRate,
          amount: taxAmount,
        });
      }

      taxTotal = Number(taxTotal.toFixed(2));
      const total = Number((subtotal + taxTotal).toFixed(2));

      const paymentToken = randomUUID();
      const invoiceNumber = await generateInvoiceNumber(tx, organizationId);

      const invoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          organizationId,
          jobId,
          customerId: job.appointment.customerId,
          status: 'SENT', // Immediately transition to SENT for touchless billing MVP
          subtotal,
          taxTotal,
          total,
          paymentToken,
          dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
          lines: {
            create: invoiceLines,
          },
          taxes: {
            create: invoiceTaxes,
          },
        },
        include: {
          lines: true,
          taxes: true,
        },
      });

      // Insert Financial Activity
      await tx.financialActivity.create({
        data: {
          invoiceId: invoice.id,
          event: 'INVOICE_GENERATED',
          metadata: JSON.stringify({ source: 'AutomationEngine', amount: total }),
        },
      });

      // Outbox Event
      await tx.event.create({
        data: {
          organizationId,
          type: 'invoice.generated',
          entityType: 'Invoice',
          entityId: invoice.id,
          data: JSON.stringify({ invoiceId: invoice.id, customerId: invoice.customerId, total }),
        },
      });

      return invoice;
    });
  }
}
