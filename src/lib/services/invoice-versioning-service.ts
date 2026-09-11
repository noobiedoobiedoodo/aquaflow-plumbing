import { prisma } from '@/lib/db';
import { InvoiceCanonicalizer, CanonicalInvoicePayload } from './invoice-canonicalizer';

export interface RevisionLineItem {
  description: string;
  quantity: number;
  unitCost: number;
}

export interface CreateRevisionInput {
  organizationId: string;
  invoiceId: string;
  actorId?: string;
  reason: string;
  lines: RevisionLineItem[];
  dueDate?: Date | null;
  ipAddress?: string;
  userAgent?: string;
}

export class InvoiceVersioningService {
  /**
   * Initializes Version 1 for a freshly generated Invoice.
   */
  static async initializeVersionOne(
    tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
    organizationId: string,
    invoiceId: string
  ) {
    const invoice = await tx.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        customer: { include: { user: true } },
        lines: true,
        taxes: true,
      },
    });

    if (!invoice) throw new Error('Invoice not found for version initialization.');

    const payload: CanonicalInvoicePayload = {
      organizationId,
      invoiceNumber: invoice.invoiceNumber,
      versionNumber: 1,
      customerId: invoice.customerId,
      customerName: `${invoice.customer.firstName} ${invoice.customer.lastName}`,
      customerEmail: invoice.customer.user?.email || '',
      currency: 'CAD',
      issueDate: (invoice.issuedAt || invoice.createdAt).toISOString().split('T')[0],
      dueDate: invoice.dueDate ? invoice.dueDate.toISOString().split('T')[0] : null,
      subtotal: invoice.subtotal,
      taxTotal: invoice.taxTotal,
      total: invoice.total,
      lines: invoice.lines.map((l) => ({
        description: l.description,
        quantity: l.quantity,
        unitCost: l.unitCost,
        total: Number((l.quantity * l.unitCost).toFixed(2)),
      })),
      taxes: invoice.taxes.map((t) => ({
        name: t.name,
        jurisdiction: t.jurisdiction,
        rate: t.rate,
        amount: t.amount,
      })),
      terms: 'Net 14 days. Subject to FlowLoopOS standard commercial terms.',
    };

    const canonicalJson = InvoiceCanonicalizer.stringify(InvoiceCanonicalizer.buildPayload(payload));
    const canonicalDocumentHash = InvoiceCanonicalizer.hash(canonicalJson);

    const version = await tx.invoiceVersion.create({
      data: {
        organizationId,
        invoiceId,
        versionNumber: 1,
        snapshotData: canonicalJson,
        canonicalDocumentHash,
        status: invoice.status === 'SENT' ? 'SENT' : 'DRAFT',
      },
    });

    await tx.invoiceAuditEvent.create({
      data: {
        organizationId,
        invoiceId,
        invoiceVersionId: version.id,
        actorId: null,
        actorType: 'SYSTEM',
        eventType: 'INVOICE_CREATED',
        eventDetails: JSON.stringify({
          versionNumber: 1,
          canonicalDocumentHash,
          total: invoice.total,
        }),
        canonicalDocumentHash,
      },
    });

    return version;
  }

  /**
   * Creates a new version (e.g. Version 2) of an invoice.
   * If Version 1 is signed, it is left completely untouched and preserved as an immutable audit record.
   */
  static async createInvoiceRevision(input: CreateRevisionInput) {
    if (!input.lines || input.lines.length === 0) {
      throw new Error('At least one line item is required for an invoice revision.');
    }

    const result = await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({
        where: { id: input.invoiceId, organizationId: input.organizationId },
        include: {
          customer: { include: { user: true } },
          taxes: true,
          lines: true,
          versions: { orderBy: { versionNumber: 'desc' } },
        },
      });

      if (!invoice) {
        throw new Error('Invoice not found or cross-tenant access denied.');
      }

      const prevVersionNumber = invoice.currentVersion;
      const nextVersionNumber = prevVersionNumber + 1;

      // 1. Calculate new financials
      let newSubtotal = 0;
      const formattedLines = input.lines.map((item) => {
        const itemTotal = Number((item.quantity * item.unitCost).toFixed(2));
        newSubtotal += itemTotal;
        return {
          description: item.description.trim(),
          quantity: item.quantity,
          unitCost: item.unitCost,
        };
      });

      newSubtotal = Number(newSubtotal.toFixed(2));

      // Re-apply existing tax rates
      let newTaxTotal = 0;
      const newTaxes = invoice.taxes.map((tax) => {
        const amount = Number((newSubtotal * tax.rate).toFixed(2));
        newTaxTotal += amount;
        return {
          name: tax.name,
          jurisdiction: tax.jurisdiction,
          rate: tax.rate,
          amount,
        };
      });

      newTaxTotal = Number(newTaxTotal.toFixed(2));
      const newTotal = Number((newSubtotal + newTaxTotal).toFixed(2));

      // 2. Build Canonical Snapshot for the new Version
      const payload: CanonicalInvoicePayload = {
        organizationId: input.organizationId,
        invoiceNumber: invoice.invoiceNumber,
        versionNumber: nextVersionNumber,
        customerId: invoice.customerId,
        customerName: `${invoice.customer.firstName} ${invoice.customer.lastName}`,
        customerEmail: invoice.customer.user?.email || '',
        currency: 'CAD',
        issueDate: new Date().toISOString().split('T')[0],
        dueDate: input.dueDate 
          ? input.dueDate.toISOString().split('T')[0]
          : (invoice.dueDate ? invoice.dueDate.toISOString().split('T')[0] : null),
        subtotal: newSubtotal,
        taxTotal: newTaxTotal,
        total: newTotal,
        lines: formattedLines.map((l) => ({
          ...l,
          total: Number((l.quantity * l.unitCost).toFixed(2)),
        })),
        taxes: newTaxes,
        terms: 'Net 14 days. Subject to FlowLoopOS standard commercial terms.',
      };

      const canonicalJson = InvoiceCanonicalizer.stringify(InvoiceCanonicalizer.buildPayload(payload));
      const canonicalDocumentHash = InvoiceCanonicalizer.hash(canonicalJson);

      // 3. Mark the previous version as SUPERSEDED if it was SIGNED
      await tx.invoiceVersion.updateMany({
        where: {
          invoiceId: input.invoiceId,
          versionNumber: prevVersionNumber,
          status: 'SIGNED',
        },
        data: {
          status: 'SUPERSEDED',
        },
      });

      // 4. Create the new InvoiceVersion record
      const newVersion = await tx.invoiceVersion.create({
        data: {
          organizationId: input.organizationId,
          invoiceId: input.invoiceId,
          versionNumber: nextVersionNumber,
          snapshotData: canonicalJson,
          canonicalDocumentHash,
          status: 'AWAITING_SIGNATURE',
        },
      });

      // 5. Update the live invoice lines and status
      // Remove previous lines and replace with new lines
      await tx.invoiceLine.deleteMany({ where: { invoiceId: input.invoiceId } });
      await tx.invoiceTax.deleteMany({ where: { invoiceId: input.invoiceId } });

      await tx.invoiceLine.createMany({
        data: formattedLines.map((l) => ({
          invoiceId: input.invoiceId,
          description: l.description,
          quantity: l.quantity,
          unitCost: l.unitCost,
        })),
      });

      await tx.invoiceTax.createMany({
        data: newTaxes.map((t) => ({
          invoiceId: input.invoiceId,
          name: t.name,
          jurisdiction: t.jurisdiction,
          rate: t.rate,
          amount: t.amount,
        })),
      });

      // Update parent Invoice to AWAITING_SIGNATURE and mutable
      await tx.invoice.update({
        where: { id: input.invoiceId },
        data: {
          currentVersion: nextVersionNumber,
          status: 'AWAITING_SIGNATURE',
          isImmutable: false,
          subtotal: newSubtotal,
          taxTotal: newTaxTotal,
          total: newTotal,
          dueDate: input.dueDate !== undefined ? input.dueDate : invoice.dueDate,
          signedAt: null,
        },
      });

      // 6. Record append-only audit event
      await tx.invoiceAuditEvent.create({
        data: {
          organizationId: input.organizationId,
          invoiceId: input.invoiceId,
          invoiceVersionId: newVersion.id,
          actorId: input.actorId || null,
          actorType: 'STAFF',
          eventType: 'INVOICE_REVISED',
          eventDetails: JSON.stringify({
            previousVersion: prevVersionNumber,
            newVersion: nextVersionNumber,
            reason: input.reason,
            newTotal,
            canonicalDocumentHash,
          }),
          canonicalDocumentHash,
          ipAddress: input.ipAddress || null,
          userAgent: input.userAgent || null,
        },
      });

      return newVersion;
    });

    return result;
  }
}
