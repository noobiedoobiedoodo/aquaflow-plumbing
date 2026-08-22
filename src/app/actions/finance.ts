'use server';

import { prisma } from '@/lib/db';
import { requireRoleInOrg } from '@/lib/auth/session';
import { ADMIN_ROLES, FINANCE_EVENTS } from '@/lib/constants';
import { randomUUID } from 'crypto';

/**
 * Generates a unique invoice number (e.g. INV-2026-000142)
 */
async function generateInvoiceNumber(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], organizationId: string): Promise<string> {
  const year = new Date().getFullYear();
  const count = await tx.invoice.count({
    where: {
      organizationId,
      createdAt: {
        gte: new Date(`${year}-01-01`),
      }
    }
  });
  
  const sequential = (count + 1).toString().padStart(5, '0');
  const entropy = randomUUID().slice(0, 4).toUpperCase();
  return `INV-${year}-${sequential}-${entropy}`;
}

/**
 * Generates an immutable Invoice snapshot from a completed Job.
 * TENANT ISOLATION: organizationId is derived from the authenticated session.
 */
export async function generateInvoiceFromJob(jobId: string, laborHourlyRate: number = 125.0) {
  // 0. Input Boundary Validation
  const { GenerateInvoiceFromJobSchema } = await import('@/lib/validations/finance');
  const validated = GenerateInvoiceFromJobSchema.safeParse({ jobId, laborHourlyRate });
  if (!validated.success) {
    throw new Error(`Validation Error: ${validated.error.issues.map(e => e.message).join(', ')}`);
  }

  // 1. Verify Role AND derive organizationId from session (TENANT ISOLATION)
  const { user, organizationId } = await requireRoleInOrg(ADMIN_ROLES);

  // 2. Fetch job WITH tenant isolation
  const job = await prisma.job.findFirst({
    where: { id: jobId, organizationId },
    include: {
      timeEntries: true,
      parts: true,
      appointment: {
        include: { service: true }
      }
    }
  });

  if (!job) throw new Error('Job not found');
  if (job.status !== 'COMPLETED') throw new Error('Cannot invoice a job that is not COMPLETED');

  const result = await prisma.$transaction(async (tx) => {
    // Concurrency Check: Ensure no invoice already exists.
    const existing = await tx.invoice.findUnique({ where: { jobId } });
    if (existing) {
      throw new Error('An invoice has already been generated for this job.');
    }

    // Fetch Organization Tax Configuration and Active Tax Rules
    const org = await tx.organization.findUnique({
      where: { id: organizationId },
      select: { taxRate: true },
    });

    const taxRules = await tx.taxRule.findMany({
      where: { organizationId, active: true }
    });

    // Snapshot Billable Items
    const invoiceLines: { description: string; quantity: number; unitCost: number }[] = [];
    let laborSubtotal = 0;
    let materialSubtotal = 0;

    // Labor
    const totalDurationSeconds = job.timeEntries.reduce((acc: number, entry: { durationSeconds: number | null }) => acc + (entry.durationSeconds || 0), 0);
    const totalHours = totalDurationSeconds / 3600;
    
    if (totalHours > 0) {
      const laborCost = Number((totalHours * laborHourlyRate).toFixed(2));
      laborSubtotal += laborCost;
      invoiceLines.push({
        description: `Labor - ${job.appointment?.service?.name || 'Plumbing Service'}`,
        quantity: Number(totalHours.toFixed(2)),
        unitCost: laborHourlyRate,
      });
    }

    // Materials
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

    // Calculate Taxes based on Rules (or Organization taxRate fallback)
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
    const invoiceNumber = await generateInvoiceNumber(tx, organizationId);
    const paymentToken = randomUUID();

    // Generate Invoice
    const invoice = await tx.invoice.create({
      data: {
        jobId: job.id,
        organizationId,
        customerId: job.appointment!.customerId,
        invoiceNumber,
        paymentToken,
        status: 'DRAFT',
        subtotal,
        taxTotal,
        total,
        amountPaid: 0,
        dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), 
        lines: {
          create: invoiceLines
        },
        taxes: {
          create: invoiceTaxes
        }
      },
      include: {
        lines: true,
        taxes: true
      }
    });

    // Record Financial Activity
    await tx.financialActivity.create({
      data: {
        invoiceId: invoice.id,
        actorId: user.id,
        event: FINANCE_EVENTS.INVOICE_CREATED,
        metadata: JSON.stringify({ subtotal, taxTotal, total }),
      }
    });

    // OUTBOX: Generate Event
    await tx.event.create({
      data: {
        organizationId,
        type: 'invoice.generated',
        entityType: 'Invoice',
        entityId: invoice.id,
        data: JSON.stringify({
          customerId: invoice.customerId,
          total: invoice.total,
        }),
      }
    });

    return invoice;
  });

  return result;
}

/**
 * Creates a PaymentIntent for a customer invoice.
 * Note: This is accessed via payment token (public), not session-authenticated.
 * Security is enforced via the unique, unguessable paymentToken.
 */
export async function createPaymentIntentFromToken(paymentToken: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { paymentToken },
    include: { 
      customer: { include: { user: true } },
      organization: {
        select: { stripeAccountId: true, id: true }
      } 
    }
  });

  if (!invoice) throw new Error("Invoice not found or invalid token");
  const balanceDue = Number((invoice.total - invoice.amountPaid).toFixed(2));
  
  if (balanceDue <= 0) {
    throw new Error("This invoice is already fully paid.");
  }

  const { stripe } = await import('@/lib/stripe');

  const amountInCents = Math.round(balanceDue * 100);
  const stripeAccount = invoice.organization.stripeAccountId || undefined;

  const paymentIntent = await stripe.paymentIntents.create(
    {
      amount: amountInCents,
      currency: 'cad',
      metadata: {
        invoiceId: invoice.id,
        organizationId: invoice.organizationId,
      },
      receipt_email: invoice.customer?.user?.email || undefined,
    },
    stripeAccount
      ? {
          stripeAccount,
          idempotencyKey: `pi_create_${invoice.id}_${amountInCents}`,
        }
      : {
          idempotencyKey: `pi_create_${invoice.id}_${amountInCents}`,
        }
  );

  return {
    clientSecret: paymentIntent.client_secret,
    amount: balanceDue,
    invoiceId: invoice.id,
  };
}

const VALID_INVOICE_TRANSITIONS: Record<string, string[]> = {
  'DRAFT': ['SENT', 'VOID', 'PAID', 'PARTIALLY_PAID'],
  'SENT': ['VOID', 'PAID', 'PARTIALLY_PAID', 'OVERDUE'],
  'PARTIALLY_PAID': ['PAID'],
  'OVERDUE': ['PAID', 'PARTIALLY_PAID', 'VOID'],
  'PAID': [],
  'VOID': []
};

/**
 * Updates an invoice's status.
 * TENANT ISOLATION: organizationId is derived from the authenticated session.
 */
export async function updateInvoiceStatus(invoiceId: string, newStatus: string) {
  const { user, organizationId } = await requireRoleInOrg(ADMIN_ROLES);

  const result = await prisma.$transaction(async (tx) => {
    // TENANT ISOLATION: Verify invoice belongs to this organization
    const invoice = await tx.invoice.findFirst({
      where: { id: invoiceId, organizationId }
    });
    if (!invoice) throw new Error("Invoice not found");

    const allowedNextStates = VALID_INVOICE_TRANSITIONS[invoice.status] || [];
    if (!allowedNextStates.includes(newStatus)) {
      throw new Error(`Invalid invoice state transition from ${invoice.status} to ${newStatus}`);
    }

    const updated = await tx.invoice.update({
      where: { id: invoiceId },
      data: { status: newStatus }
    });

    await tx.financialActivity.create({
      data: {
        invoiceId,
        actorId: user.id,
        event: `INVOICE_${newStatus}`,
        metadata: JSON.stringify({ previousStatus: invoice.status })
      }
    });

    return updated;
  });

  return result;
}
