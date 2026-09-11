import { prisma } from '@/lib/db';
import { storage } from '@/lib/storage';
import { randomUUID, createHash } from 'crypto';
import { InvoiceCanonicalizer } from './invoice-canonicalizer';
import { InvoicePdfService } from './invoice-pdf-service';

export const STATUTORY_CONSENT_TEXT =
  'I consent to transact electronically and to sign this invoice electronically. I understand that my electronic signature has the same intended effect as signing a paper copy, subject to applicable law.';

export const CONSENT_TEXT_VERSION = '2026-v1-STANDARD-EVIDENCE';

export interface RecordConsentInput {
  organizationId: string;
  invoiceId: string;
  versionNumber: number;
  customerId: string;
  consented: boolean;
  ipAddress: string;
  userAgent: string;
  sessionId?: string;
  requestId?: string;
}

export interface SignInvoiceInput {
  organizationId: string;
  invoiceId: string;
  versionNumber: number;
  customerId: string;
  consentRecordId: string;
  signerName: string;
  signerEmail: string;
  signatureMethod: 'DRAWN_CANVAS' | 'TYPED' | 'DIGITAL_CLICK';
  signatureData?: string | null;
  ipAddress: string;
  userAgent: string;
  timezone?: string;
  requestId?: string;
  sessionId?: string;
  authenticationMethod: 'CUSTOMER_PORTAL_SESSION' | 'SECURE_TOKEN_LINK';
  idempotencyKey?: string;
}

export class InvoiceSigningService {
  /**
   * Records affirmative electronic transaction consent.
   * Unchecked by default; must be explicitly accepted.
   */
  static async recordConsent(input: RecordConsentInput) {
    if (!input.consented) {
      throw new Error('Explicit affirmative electronic consent is required to proceed.');
    }

    // Verify invoice and version belong to this organization
    const version = await prisma.invoiceVersion.findUnique({
      where: {
        invoiceId_versionNumber: {
          invoiceId: input.invoiceId,
          versionNumber: input.versionNumber,
        },
      },
      include: { invoice: true },
    });

    if (!version || version.organizationId !== input.organizationId) {
      throw new Error('Invoice version not found or cross-tenant access denied.');
    }

    if (version.status === 'SIGNED' || version.invoice.isImmutable) {
      throw new Error('This invoice version is already signed and immutable.');
    }

    const consentRecord = await prisma.invoiceConsentRecord.create({
      data: {
        organizationId: input.organizationId,
        invoiceId: input.invoiceId,
        invoiceVersionId: version.id,
        customerId: input.customerId,
        consentText: STATUTORY_CONSENT_TEXT,
        consentTextVersion: CONSENT_TEXT_VERSION,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        sessionId: input.sessionId,
        requestId: input.requestId,
      },
    });

    // Log append-only audit event
    await prisma.invoiceAuditEvent.create({
      data: {
        organizationId: input.organizationId,
        invoiceId: input.invoiceId,
        invoiceVersionId: version.id,
        actorId: input.customerId,
        actorType: 'CUSTOMER',
        eventType: 'CONSENT_ACCEPTED',
        eventDetails: JSON.stringify({
          consentRecordId: consentRecord.id,
          version: CONSENT_TEXT_VERSION,
          timestamp: consentRecord.consentedAt,
        }),
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });

    return consentRecord;
  }

  /**
   * Executes the state-machine electronic signing workflow.
   * Decoupled from S3/R2 storage with atomic locking and failure reconciliation.
   */
  static async signInvoice(input: SignInvoiceInput) {
    if (!input.signerName || input.signerName.trim() === '') {
      throw new Error('Signer name is required.');
    }
    if (!input.signerEmail || !input.signerEmail.includes('@')) {
      throw new Error('Valid signer email is required.');
    }

    // 1. Fetch invoice version with tenant validation
    const version = await prisma.invoiceVersion.findUnique({
      where: {
        invoiceId_versionNumber: {
          invoiceId: input.invoiceId,
          versionNumber: input.versionNumber,
        },
      },
      include: {
        invoice: {
          include: {
            organization: true,
            customer: { include: { user: true } },
            lines: true,
            taxes: true,
          },
        },
      },
    });

    if (!version || version.organizationId !== input.organizationId) {
      throw new Error('Invoice version not found or cross-tenant access denied.');
    }

    // 2. IDEMPOTENCY CHECK: If already signed, return existing signature record (Refinement #8)
    if (version.status === 'SIGNED' || version.invoice.status === 'SIGNED') {
      const existingSig = await prisma.invoiceSignature.findFirst({
        where: {
          organizationId: input.organizationId,
          invoiceVersionId: version.id,
        },
      });
      if (existingSig) {
        return {
          success: true,
          alreadySigned: true,
          signature: existingSig,
          message: 'Invoice was already signed successfully.',
        };
      }
    }

    // 3. Verify affirmative consent record exists and is valid
    const consentRecord = await prisma.invoiceConsentRecord.findFirst({
      where: {
        id: input.consentRecordId,
        organizationId: input.organizationId,
        invoiceId: input.invoiceId,
        invoiceVersionId: version.id,
        customerId: input.customerId,
      },
    });

    if (!consentRecord) {
      throw new Error('Valid electronic consent record not found. Affirmative consent must be given.');
    }

    // 4. ACQUIRE SIGNING LOCK (State: SIGNING_IN_PROGRESS)
    const lockId = randomUUID();
    const now = new Date();

    const lockAcquired = await prisma.$transaction(async (tx) => {
      const current = await tx.invoiceVersion.findUnique({
        where: { id: version.id },
      });

      if (!current) return false;
      if (current.status === 'SIGNED') return 'ALREADY_SIGNED';

      // Check if another request holds an active lock within the 45-second timeout
      if (current.signingLockId && current.signingLockedAt) {
        const lockAgeMs = now.getTime() - current.signingLockedAt.getTime();
        if (lockAgeMs < 45000) {
          return false; // Active lock in place
        }
      }

      await tx.invoiceVersion.update({
        where: { id: version.id },
        data: {
          signingLockId: lockId,
          signingLockedAt: now,
          status: 'SIGNING_IN_PROGRESS',
        },
      });

      await tx.invoiceAuditEvent.create({
        data: {
          organizationId: input.organizationId,
          invoiceId: input.invoiceId,
          invoiceVersionId: version.id,
          actorId: input.customerId,
          actorType: 'CUSTOMER',
          eventType: 'SIGNING_STARTED',
          eventDetails: JSON.stringify({ lockId, timestamp: now }),
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
        },
      });

      return true;
    });

    if (lockAcquired === 'ALREADY_SIGNED') {
      const existingSig = await prisma.invoiceSignature.findFirst({
        where: { organizationId: input.organizationId, invoiceVersionId: version.id },
      });
      return {
        success: true,
        alreadySigned: true,
        signature: existingSig,
        message: 'Invoice was already signed.',
      };
    }

    if (!lockAcquired) {
      throw new Error('A signing operation is already in progress for this invoice. Please wait a moment.');
    }

    // 5. PDF GENERATION & STORAGE OUTBOX (Decoupled from DB transaction)
    let generatedPdfBuffer: Buffer;
    let computedPdfHash: string;
    let storedPdfKey: string;

    const signatureId = `sig-${randomUUID()}`;

    try {
      // Generate static PDF artifact
      const pdfResult = await InvoicePdfService.generateInvoicePdf({
        invoice: {
          invoiceNumber: version.invoice.invoiceNumber,
          versionNumber: version.versionNumber,
          issueDate: version.invoice.issuedAt || version.invoice.createdAt,
          dueDate: version.invoice.dueDate,
          currency: 'CAD',
          subtotal: version.invoice.subtotal,
          taxTotal: version.invoice.taxTotal,
          total: version.invoice.total,
          amountPaid: version.invoice.amountPaid,
        },
        organization: {
          name: version.invoice.organization.name,
          email: version.invoice.organization.email,
          phone: version.invoice.organization.phone,
          address: version.invoice.organization.address,
          city: version.invoice.organization.city,
          province: version.invoice.organization.province,
          postalCode: version.invoice.organization.postalCode,
        },
        customer: {
          name: `${version.invoice.customer.firstName} ${version.invoice.customer.lastName}`,
          email: version.invoice.customer.user?.email,
          phone: version.invoice.customer.phone,
        },
        lines: version.invoice.lines.map((l) => ({
          description: l.description,
          quantity: l.quantity,
          unitCost: l.unitCost,
          total: Number((l.quantity * l.unitCost).toFixed(2)),
        })),
        taxes: version.invoice.taxes.map((t) => ({
          name: t.name,
          rate: t.rate,
          amount: t.amount,
        })),
        signature: {
          signerName: input.signerName.trim(),
          signerEmail: input.signerEmail.trim(),
          signatureDate: now,
          consentAccepted: true,
          consentVersion: consentRecord.consentTextVersion,
          signatureId,
          canonicalDocumentHash: version.canonicalDocumentHash,
          signatureData: input.signatureData,
        },
      });

      generatedPdfBuffer = pdfResult.buffer;
      computedPdfHash = pdfResult.pdfHash;

      // Upload to durable private storage
      const fileName = `signed-inv-${version.invoice.invoiceNumber}-v${version.versionNumber}-${Date.now()}.pdf`;
      const uploadResult = await storage.uploadFile(generatedPdfBuffer, fileName, 'application/pdf');
      storedPdfKey = uploadResult.storageKey;

      // Verify PDF Hash immediately after storage
      const verifyHash = createHash('sha256').update(generatedPdfBuffer).digest('hex');
      if (verifyHash.toLowerCase() !== computedPdfHash.toLowerCase()) {
        throw new Error('PDF hash verification failed post-generation.');
      }
    } catch (storageError: any) {
      // RECONCILIATION: Release lock on failure
      await prisma.invoiceVersion.update({
        where: { id: version.id },
        data: {
          signingLockId: null,
          signingLockedAt: null,
          status: 'AWAITING_SIGNATURE',
        },
      });

      await prisma.invoiceAuditEvent.create({
        data: {
          organizationId: input.organizationId,
          invoiceId: input.invoiceId,
          invoiceVersionId: version.id,
          actorId: input.customerId,
          actorType: 'CUSTOMER',
          eventType: 'SIGNING_FAILED',
          eventDetails: JSON.stringify({
            stage: 'PDF_STORAGE',
            error: storageError.message,
          }),
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
        },
      });

      throw new Error(`Failed to generate and store signed PDF: ${storageError.message}`);
    }

    // 6. RECORD SIGNATURE & COMMIT INVOICE AS SIGNED (Atomic Database Transaction)
    try {
      const finalSignature = await prisma.$transaction(async (tx) => {
        // Create the signature record
        const sig = await tx.invoiceSignature.create({
          data: {
            id: signatureId,
            organizationId: input.organizationId,
            invoiceId: input.invoiceId,
            invoiceVersionId: version.id,
            customerId: input.customerId,
            consentRecordId: consentRecord.id,
            signerName: input.signerName.trim(),
            signerEmail: input.signerEmail.trim(),
            signatureMethod: input.signatureMethod,
            signatureData: input.signatureData || null,
            canonicalDocumentHash: version.canonicalDocumentHash,
            signedPdfHash: computedPdfHash,
            signedPdfKey: storedPdfKey,
            signatureTimestamp: now,
            ipAddress: input.ipAddress,
            userAgent: input.userAgent,
            timezone: input.timezone || 'America/Winnipeg',
            requestId: input.requestId,
            sessionId: input.sessionId,
            authenticationMethod: input.authenticationMethod,
            signatureStatus: 'VALID',
          },
        });

        // Seal the invoice version as SIGNED and immutable
        await tx.invoiceVersion.update({
          where: { id: version.id },
          data: {
            status: 'SIGNED',
            signedPdfHash: computedPdfHash,
            signedPdfKey: storedPdfKey,
            signingLockId: null,
            signingLockedAt: null,
          },
        });

        // Transition main Invoice to SIGNED and immutable
        await tx.invoice.update({
          where: { id: input.invoiceId },
          data: {
            status: 'SIGNED',
            isImmutable: true,
            signedAt: now,
          },
        });

        // Audit Events
        await tx.invoiceAuditEvent.create({
          data: {
            organizationId: input.organizationId,
            invoiceId: input.invoiceId,
            invoiceVersionId: version.id,
            actorId: input.customerId,
            actorType: 'CUSTOMER',
            eventType: 'PDF_GENERATED',
            eventDetails: JSON.stringify({
              storageKey: storedPdfKey,
              pdfHash: computedPdfHash,
            }),
            signedPdfHash: computedPdfHash,
            ipAddress: input.ipAddress,
            userAgent: input.userAgent,
          },
        });

        await tx.invoiceAuditEvent.create({
          data: {
            organizationId: input.organizationId,
            invoiceId: input.invoiceId,
            invoiceVersionId: version.id,
            actorId: input.customerId,
            actorType: 'CUSTOMER',
            eventType: 'INVOICE_SIGNED',
            eventDetails: JSON.stringify({
              signatureId: sig.id,
              signerName: sig.signerName,
              signerEmail: sig.signerEmail,
              method: sig.signatureMethod,
            }),
            canonicalDocumentHash: version.canonicalDocumentHash,
            signedPdfHash: computedPdfHash,
            ipAddress: input.ipAddress,
            userAgent: input.userAgent,
          },
        });

        // Outbox event for notification worker
        await tx.event.create({
          data: {
            organizationId: input.organizationId,
            type: 'invoice.signed',
            entityType: 'Invoice',
            entityId: input.invoiceId,
            data: JSON.stringify({
              invoiceId: input.invoiceId,
              versionNumber: version.versionNumber,
              signatureId: sig.id,
              signerName: sig.signerName,
            }),
          },
        });

        return sig;
      });

      return {
        success: true,
        alreadySigned: false,
        signature: finalSignature,
        message: 'Invoice successfully signed.',
      };
    } catch (dbError: any) {
      // If DB fails after PDF was stored, clean up lock and log error
      await prisma.invoiceVersion.update({
        where: { id: version.id },
        data: {
          signingLockId: null,
          signingLockedAt: null,
          status: 'AWAITING_SIGNATURE',
        },
      });

      await prisma.invoiceAuditEvent.create({
        data: {
          organizationId: input.organizationId,
          invoiceId: input.invoiceId,
          invoiceVersionId: version.id,
          actorId: input.customerId,
          actorType: 'CUSTOMER',
          eventType: 'SIGNING_FAILED',
          eventDetails: JSON.stringify({
            stage: 'DB_COMMIT',
            error: dbError.message,
          }),
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
        },
      });

      throw new Error(`Database commit failed during invoice signing: ${dbError.message}`);
    }
  }
}
