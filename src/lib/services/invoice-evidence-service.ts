import { prisma } from '@/lib/db';
import { storage } from '@/lib/storage';
import JSZip from 'jszip';
import { InvoiceIntegrityService } from './invoice-integrity-service';

export class InvoiceEvidenceService {
  /**
   * Compiles the complete compliance and dispute evidence package as a ZIP archive.
   * Includes signed PDF, snapshot, signature metadata, consent record, audit timeline, and live integrity proof.
   */
  static async exportEvidencePackage(
    organizationId: string,
    invoiceId: string,
    versionNumber: number
  ): Promise<{ buffer: Buffer; filename: string }> {
    const version = await prisma.invoiceVersion.findUnique({
      where: {
        invoiceId_versionNumber: { invoiceId, versionNumber },
      },
      include: {
        invoice: {
          include: {
            organization: true,
            customer: true,
          },
        },
        signatures: {
          include: { consentRecord: true },
          orderBy: { createdAt: 'desc' },
        },
        consentRecords: {
          orderBy: { consentedAt: 'desc' },
        },
        auditEvents: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!version || version.organizationId !== organizationId) {
      throw new Error('Invoice version not found or cross-tenant access denied.');
    }

    const zip = new JSZip();
    const folderName = `evidence-INV-${version.invoice.invoiceNumber}-v${versionNumber}`;
    const folder = zip.folder(folderName) || zip;

    // 1. invoice-snapshot.json
    let parsedSnapshot: any;
    try {
      parsedSnapshot = JSON.parse(version.snapshotData);
    } catch {
      parsedSnapshot = version.snapshotData;
    }
    folder.file('invoice-snapshot.json', JSON.stringify(parsedSnapshot, null, 2));

    // 2. signature-record.json
    const signatureRecords = version.signatures.map((sig) => ({
      id: sig.id,
      signerName: sig.signerName,
      signerEmail: sig.signerEmail,
      signatureMethod: sig.signatureMethod,
      signatureTimestamp: sig.signatureTimestamp.toISOString(),
      canonicalDocumentHash: sig.canonicalDocumentHash,
      signedPdfHash: sig.signedPdfHash,
      signedPdfKey: sig.signedPdfKey,
      ipAddress: sig.ipAddress,
      userAgent: sig.userAgent,
      timezone: sig.timezone,
      requestId: sig.requestId,
      sessionId: sig.sessionId,
      authenticationMethod: sig.authenticationMethod,
      signatureStatus: sig.signatureStatus,
      createdAt: sig.createdAt.toISOString(),
    }));
    folder.file('signature-record.json', JSON.stringify(signatureRecords, null, 2));

    // 3. consent-record.json
    const consentRecords = version.consentRecords.map((c) => ({
      id: c.id,
      consentText: c.consentText,
      consentTextVersion: c.consentTextVersion,
      consentedAt: c.consentedAt.toISOString(),
      customerId: c.customerId,
      ipAddress: c.ipAddress,
      userAgent: c.userAgent,
      sessionId: c.sessionId,
      requestId: c.requestId,
    }));
    folder.file('consent-record.json', JSON.stringify(consentRecords, null, 2));

    // 4. audit-timeline.json
    const allAuditEvents = await prisma.invoiceAuditEvent.findMany({
      where: { invoiceId, organizationId },
      orderBy: { createdAt: 'asc' },
    });
    folder.file('audit-timeline.json', JSON.stringify(allAuditEvents, null, 2));

    // 5. integrity-verification.json (live recalculation at export time)
    const liveVerification = await InvoiceIntegrityService.verifyComprehensiveEvidence(
      organizationId,
      invoiceId,
      versionNumber
    );
    folder.file('integrity-verification.json', JSON.stringify(liveVerification, null, 2));

    // 6. signed-invoice.pdf
    if (version.signedPdfKey) {
      const pdfData = await storage.getFileBuffer(version.signedPdfKey);
      if (pdfData) {
        folder.file('signed-invoice.pdf', pdfData.buffer);
      }
    }

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    const filename = `evidence-${version.invoice.invoiceNumber}-v${versionNumber}-${Date.now()}.zip`;

    return { buffer: zipBuffer, filename };
  }
}
