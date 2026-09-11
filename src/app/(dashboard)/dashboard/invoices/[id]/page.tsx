import { requireRoleInOrg } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/constants';
import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import AdminInvoiceDetailClient from './AdminInvoiceDetailClient';
import { InvoiceVersioningService } from '@/lib/services/invoice-versioning-service';

export default async function AdminInvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { organizationId } = await requireRoleInOrg(ADMIN_ROLES as any);
  const { id: invoiceId } = await params;

  // 1. Fetch Invoice with strict Tenant Isolation
  let invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, organizationId },
    include: {
      customer: { include: { user: true } },
      lines: true,
      taxes: true,
      versions: {
        orderBy: { versionNumber: 'desc' },
        include: {
          signatures: {
            include: { consentRecord: true },
            orderBy: { createdAt: 'desc' },
          },
        },
      },
      auditEvents: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!invoice) return notFound();

  // If this invoice has no versions yet (historical invoice), initialize Version 1 on the fly
  const activeInvoice = invoice;
  if (activeInvoice.versions.length === 0) {
    await prisma.$transaction(async (tx) => {
      await InvoiceVersioningService.initializeVersionOne(tx, organizationId, activeInvoice.id);
    });

    // Re-fetch
    invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, organizationId },
      include: {
        customer: { include: { user: true } },
        lines: true,
        taxes: true,
        versions: {
          orderBy: { versionNumber: 'desc' },
          include: {
            signatures: {
              include: { consentRecord: true },
              orderBy: { createdAt: 'desc' },
            },
          },
        },
        auditEvents: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  if (!invoice) return notFound();

  // Find latest signature across versions if available
  const allSignatures = invoice.versions.flatMap((v) => v.signatures);
  const latestSignature = allSignatures.length > 0 ? allSignatures[0] : null;

  return (
    <AdminInvoiceDetailClient
      invoice={{
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        organizationId: invoice.organizationId,
        status: invoice.status,
        currentVersion: invoice.currentVersion,
        isImmutable: invoice.isImmutable,
        signedAt: invoice.signedAt ? invoice.signedAt.toISOString() : null,
        paymentToken: invoice.paymentToken,
        subtotal: invoice.subtotal,
        taxTotal: invoice.taxTotal,
        total: invoice.total,
        amountPaid: invoice.amountPaid,
        dueDate: invoice.dueDate ? invoice.dueDate.toISOString() : null,
        issuedAt: invoice.issuedAt ? invoice.issuedAt.toISOString() : null,
        createdAt: invoice.createdAt.toISOString(),
        customer: {
          id: invoice.customer.id,
          firstName: invoice.customer.firstName,
          lastName: invoice.customer.lastName,
          email: invoice.customer.user?.email || null,
          phone: invoice.customer.phone || null,
        },
        lines: invoice.lines.map((l) => ({
          id: l.id,
          description: l.description,
          quantity: l.quantity,
          unitCost: l.unitCost,
        })),
        taxes: invoice.taxes.map((t) => ({
          id: t.id,
          name: t.name,
          jurisdiction: t.jurisdiction,
          rate: t.rate,
          amount: t.amount,
        })),
      }}
      versions={invoice.versions.map((v) => ({
        id: v.id,
        versionNumber: v.versionNumber,
        canonicalDocumentHash: v.canonicalDocumentHash,
        signedPdfHash: v.signedPdfHash,
        status: v.status,
        createdAt: v.createdAt.toISOString(),
      }))}
      latestSignature={
        latestSignature
          ? {
              id: latestSignature.id,
              signerName: latestSignature.signerName,
              signerEmail: latestSignature.signerEmail,
              signatureMethod: latestSignature.signatureMethod,
              signatureTimestamp: latestSignature.signatureTimestamp.toISOString(),
              canonicalDocumentHash: latestSignature.canonicalDocumentHash,
              signedPdfHash: latestSignature.signedPdfHash,
              ipAddress: latestSignature.ipAddress,
              userAgent: latestSignature.userAgent,
              timezone: latestSignature.timezone,
              sessionId: latestSignature.sessionId,
              requestId: latestSignature.requestId,
              consentRecord: {
                consentTextVersion: latestSignature.consentRecord.consentTextVersion,
                consentedAt: latestSignature.consentRecord.consentedAt.toISOString(),
                ipAddress: latestSignature.consentRecord.ipAddress,
              },
            }
          : null
      }
      auditEvents={invoice.auditEvents.map((e) => ({
        id: e.id,
        eventType: e.eventType,
        actorType: e.actorType,
        eventDetails: e.eventDetails,
        canonicalDocumentHash: e.canonicalDocumentHash,
        signedPdfHash: e.signedPdfHash,
        ipAddress: e.ipAddress,
        createdAt: e.createdAt.toISOString(),
      }))}
    />
  );
}
