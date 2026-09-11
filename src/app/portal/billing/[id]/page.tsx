import { requireCustomerSession } from '@/lib/auth/customer-session';
import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import InvoiceSigningClient from './InvoiceSigningClient';
import { InvoiceVersioningService } from '@/lib/services/invoice-versioning-service';

export default async function CustomerInvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { customerId } = await requireCustomerSession();
  const { id: invoiceId } = await params;

  // 1. Fetch Invoice with strict Customer Scoping (STRENGTHENED TENANT ISOLATION)
  let invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, customerId },
    include: {
      organization: true,
      customer: { include: { user: true } },
      lines: true,
      taxes: true,
      versions: {
        orderBy: { versionNumber: 'desc' },
        include: {
          signatures: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      },
    },
  });

  if (!invoice) return notFound();

  // If this invoice has no version record yet (historical invoice), initialize Version 1 on the fly
  const activeInvoice = invoice;
  if (activeInvoice.versions.length === 0) {
    await prisma.$transaction(async (tx) => {
      await InvoiceVersioningService.initializeVersionOne(tx, activeInvoice.organizationId, activeInvoice.id);
    });

    // Re-fetch
    invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, customerId },
      include: {
        organization: true,
        customer: { include: { user: true } },
        lines: true,
        taxes: true,
        versions: {
          orderBy: { versionNumber: 'desc' },
          include: {
            signatures: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });
  }

  if (!invoice || invoice.versions.length === 0) return notFound();

  const currentVersion = invoice.versions.find((v) => v.versionNumber === invoice.currentVersion) || invoice.versions[0];
  const latestSignature = currentVersion.signatures[0] || null;

  let parsedSnapshotData: any = {};
  try {
    parsedSnapshotData = JSON.parse(currentVersion.snapshotData);
  } catch {
    parsedSnapshotData = {
      lines: invoice.lines,
      taxes: invoice.taxes,
      subtotal: invoice.subtotal,
      taxTotal: invoice.taxTotal,
      total: invoice.total,
    };
  }

  return (
    <InvoiceSigningClient
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
        organization: {
          name: invoice.organization.name,
          email: invoice.organization.email,
          phone: invoice.organization.phone,
          address: invoice.organization.address,
          city: invoice.organization.city,
          province: invoice.organization.province,
          postalCode: invoice.organization.postalCode,
        },
        customer: {
          firstName: invoice.customer.firstName,
          lastName: invoice.customer.lastName,
          email: invoice.customer.user?.email,
          phone: invoice.customer.phone,
        },
      }}
      version={{
        versionNumber: currentVersion.versionNumber,
        canonicalDocumentHash: currentVersion.canonicalDocumentHash,
        signedPdfHash: currentVersion.signedPdfHash,
        status: currentVersion.status,
        snapshotData: parsedSnapshotData,
      }}
      signature={
        latestSignature
          ? {
              id: latestSignature.id,
              signerName: latestSignature.signerName,
              signerEmail: latestSignature.signerEmail,
              signatureMethod: latestSignature.signatureMethod,
              signatureTimestamp: latestSignature.signatureTimestamp.toISOString(),
              canonicalDocumentHash: latestSignature.canonicalDocumentHash,
              signedPdfHash: latestSignature.signedPdfHash,
            }
          : null
      }
    />
  );
}
