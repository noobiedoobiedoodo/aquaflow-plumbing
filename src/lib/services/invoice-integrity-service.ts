import { prisma } from '@/lib/db';
import { storage } from '@/lib/storage';
import { InvoiceCanonicalizer } from './invoice-canonicalizer';
import { createHash } from 'crypto';

export interface CanonicalIntegrityResult {
  status: 'VERIFIED' | 'FAILED';
  canonicalHashMatches: boolean;
  liveDataMatchesSnapshot: boolean;
  recordedHash: string;
  computedHash: string;
  timestamp: string;
  failureReason?: string;
}

export interface PdfIntegrityResult {
  status: 'VERIFIED' | 'FAILED';
  pdfHashMatches: boolean;
  recordedPdfHash: string;
  computedPdfHash: string;
  storageKey: string;
  timestamp: string;
  failureReason?: string;
}

export interface ComprehensiveIntegrityReport {
  overallStatus: 'VERIFIED' | 'FAILED';
  invoiceNumber: string;
  versionNumber: number;
  organizationId: string;
  canonicalIntegrity: CanonicalIntegrityResult;
  pdfIntegrity: PdfIntegrityResult | null;
  signatureRecord: {
    signatureId: string;
    signerName: string;
    signerEmail: string;
    signedAt: string;
    consentTextVersion: string;
  } | null;
  verifiedAt: string;
}

export class InvoiceIntegrityService {
  /**
   * Proves: SHA256(canonical snapshot) === recorded canonicalDocumentHash
   * Also verifies live DB items have not diverged from the sealed snapshot if it's the current version.
   */
  static async verifyInvoiceIntegrity(
    organizationId: string,
    invoiceVersionId: string
  ): Promise<CanonicalIntegrityResult> {
    const version = await prisma.invoiceVersion.findFirst({
      where: { id: invoiceVersionId, organizationId },
      include: {
        invoice: {
          include: {
            lines: true,
            taxes: true,
            customer: { include: { user: true } },
          },
        },
      },
    });

    if (!version) {
      return {
        status: 'FAILED',
        canonicalHashMatches: false,
        liveDataMatchesSnapshot: false,
        recordedHash: '',
        computedHash: '',
        timestamp: new Date().toISOString(),
        failureReason: 'Invoice version not found in tenant scope.',
      };
    }

    // 1. Recompute SHA-256 of the stored canonical snapshotData
    const computedHash = InvoiceCanonicalizer.hash(version.snapshotData);
    const canonicalHashMatches = computedHash.toLowerCase() === version.canonicalDocumentHash.toLowerCase();

    if (!canonicalHashMatches) {
      return {
        status: 'FAILED',
        canonicalHashMatches: false,
        liveDataMatchesSnapshot: false,
        recordedHash: version.canonicalDocumentHash,
        computedHash,
        timestamp: new Date().toISOString(),
        failureReason: `Canonical hash mismatch. Expected ${version.canonicalDocumentHash}, got ${computedHash}`,
      };
    }

    // 2. If this version is the current invoice version, verify live DB rows match the sealed snapshot
    let liveDataMatches = true;
    let liveMismatchReason: string | undefined;

    if (version.invoice.currentVersion === version.versionNumber) {
      try {
        const livePayload = InvoiceCanonicalizer.buildPayload({
          organizationId: version.organizationId,
          invoiceNumber: version.invoice.invoiceNumber,
          versionNumber: version.versionNumber,
          customerId: version.invoice.customerId,
          customerName: `${version.invoice.customer.firstName} ${version.invoice.customer.lastName}`,
          customerEmail: version.invoice.customer.user?.email || '',
          currency: 'CAD',
          issueDate: (version.invoice.issuedAt || version.invoice.createdAt).toISOString().split('T')[0],
          dueDate: version.invoice.dueDate ? version.invoice.dueDate.toISOString().split('T')[0] : null,
          subtotal: version.invoice.subtotal,
          taxTotal: version.invoice.taxTotal,
          total: version.invoice.total,
          lines: version.invoice.lines.map((l) => ({
            description: l.description,
            quantity: l.quantity,
            unitCost: l.unitCost,
            total: Number((l.quantity * l.unitCost).toFixed(2)),
          })),
          taxes: version.invoice.taxes.map((t) => ({
            name: t.name,
            jurisdiction: t.jurisdiction,
            rate: t.rate,
            amount: t.amount,
          })),
          terms: 'Net 14 days. Subject to FlowLoopOS standard commercial terms.',
        });

        const liveJson = InvoiceCanonicalizer.stringify(livePayload);
        const liveHash = InvoiceCanonicalizer.hash(liveJson);

        if (liveHash.toLowerCase() !== version.canonicalDocumentHash.toLowerCase()) {
          liveDataMatches = false;
          liveMismatchReason = 'Live database tables diverge from sealed snapshot (tampering detected on live rows).';
        }
      } catch (err: any) {
        liveDataMatches = false;
        liveMismatchReason = `Error rebuilding live invoice payload: ${err.message}`;
      }
    }

    const overallValid = canonicalHashMatches && liveDataMatches;

    return {
      status: overallValid ? 'VERIFIED' : 'FAILED',
      canonicalHashMatches,
      liveDataMatchesSnapshot: liveDataMatches,
      recordedHash: version.canonicalDocumentHash,
      computedHash,
      timestamp: new Date().toISOString(),
      failureReason: liveMismatchReason,
    };
  }

  /**
   * Proves: SHA256(stored signed PDF) === recorded signedPdfHash
   */
  static async verifySignedPdf(
    organizationId: string,
    signatureId: string
  ): Promise<PdfIntegrityResult> {
    const signature = await prisma.invoiceSignature.findFirst({
      where: { id: signatureId, organizationId },
    });

    if (!signature) {
      return {
        status: 'FAILED',
        pdfHashMatches: false,
        recordedPdfHash: '',
        computedPdfHash: '',
        storageKey: '',
        timestamp: new Date().toISOString(),
        failureReason: 'Signature record not found in tenant scope.',
      };
    }

    const fileData = await storage.getFileBuffer(signature.signedPdfKey);
    if (!fileData) {
      return {
        status: 'FAILED',
        pdfHashMatches: false,
        recordedPdfHash: signature.signedPdfHash,
        computedPdfHash: '',
        storageKey: signature.signedPdfKey,
        timestamp: new Date().toISOString(),
        failureReason: 'Signed PDF file missing from durable storage provider.',
      };
    }

    const computedPdfHash = createHash('sha256').update(fileData.buffer).digest('hex');
    const pdfHashMatches = computedPdfHash.toLowerCase() === signature.signedPdfHash.toLowerCase();

    return {
      status: pdfHashMatches ? 'VERIFIED' : 'FAILED',
      pdfHashMatches,
      recordedPdfHash: signature.signedPdfHash,
      computedPdfHash,
      storageKey: signature.signedPdfKey,
      timestamp: new Date().toISOString(),
      failureReason: pdfHashMatches ? undefined : `PDF hash mismatch. Expected ${signature.signedPdfHash}, got ${computedPdfHash}`,
    };
  }

  /**
   * Generates a comprehensive cryptographic verification report for an invoice version.
   */
  static async verifyComprehensiveEvidence(
    organizationId: string,
    invoiceId: string,
    versionNumber: number
  ): Promise<ComprehensiveIntegrityReport> {
    const version = await prisma.invoiceVersion.findUnique({
      where: {
        invoiceId_versionNumber: { invoiceId, versionNumber },
      },
      include: {
        invoice: true,
        signatures: {
          include: { consentRecord: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!version || version.organizationId !== organizationId) {
      throw new Error('Invoice version not found or cross-tenant access denied.');
    }

    const canonicalIntegrity = await this.verifyInvoiceIntegrity(organizationId, version.id);

    let pdfIntegrity: PdfIntegrityResult | null = null;
    let signatureRecord = null;

    if (version.signatures.length > 0) {
      const sig = version.signatures[0];
      pdfIntegrity = await this.verifySignedPdf(organizationId, sig.id);
      signatureRecord = {
        signatureId: sig.id,
        signerName: sig.signerName,
        signerEmail: sig.signerEmail,
        signedAt: sig.signatureTimestamp.toISOString(),
        consentTextVersion: sig.consentRecord.consentTextVersion,
      };
    }

    const overallStatus =
      canonicalIntegrity.status === 'VERIFIED' && (!pdfIntegrity || pdfIntegrity.status === 'VERIFIED')
        ? 'VERIFIED'
        : 'FAILED';

    return {
      overallStatus,
      invoiceNumber: version.invoice.invoiceNumber,
      versionNumber: version.versionNumber,
      organizationId,
      canonicalIntegrity,
      pdfIntegrity,
      signatureRecord,
      verifiedAt: new Date().toISOString(),
    };
  }
}
