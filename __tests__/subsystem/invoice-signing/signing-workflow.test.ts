import { describe, it, expect, beforeAll } from 'vitest';
import { prisma } from '@/lib/db';
import { InvoiceService } from '@/lib/services/invoice-service';
import { InvoiceSigningService, STATUTORY_CONSENT_TEXT, CONSENT_TEXT_VERSION } from '@/lib/services/invoice-signing-service';
import { storage } from '@/lib/storage';

describe('FlowLoopOS Subsystem: Electronic Invoice Signing Workflow', () => {
  let orgId: string;
  let customerId: string;
  let invoiceId: string;

  beforeAll(async () => {
    // 1. Create Tenant Organization
    const org = await prisma.organization.create({
      data: {
        name: `Sign Test Plumbing Org ${Date.now()}`,
        slug: `sign-test-org-${Date.now()}`,
      },
    });
    orgId = org.id;

    // 2. Create Service & Tax Rule
    const service = await prisma.service.create({
      data: {
        organizationId: orgId,
        name: 'Master Pipe Repair',
        slug: `pipe-rep-${Date.now()}`,
        basePrice: 200,
      },
    });

    await prisma.taxRule.create({
      data: {
        organizationId: orgId,
        name: 'MB Provincial Tax',
        jurisdiction: 'MB',
        rate: 0.12,
        appliesTo: 'ALL',
      },
    });

    // 3. Create Customer
    const user = await prisma.user.create({
      data: { email: `cust.sign.${Date.now()}@example.com`, passwordHash: 'hash' },
    });

    const customer = await prisma.customer.create({
      data: {
        userId: user.id,
        organizationId: orgId,
        firstName: 'Alice',
        lastName: 'Signer',
      },
    });
    customerId = customer.id;

    const property = await prisma.property.create({
      data: {
        organizationId: orgId,
        customerId: customer.id,
        address: '100 Legal Way',
        city: 'Winnipeg',
        province: 'MB',
        postalCode: 'R3C 0A1',
      },
    });

    const appt = await prisma.appointment.create({
      data: {
        appointmentNumber: `APT-SIG-${Date.now()}`,
        organizationId: orgId,
        customerId: customer.id,
        propertyId: property.id,
        serviceId: service.id,
        date: new Date(),
        startTime: '09:00',
        endTime: '11:00',
        status: 'CONFIRMED',
      },
    });

    const job = await prisma.job.create({
      data: {
        organizationId: orgId,
        appointmentId: appt.id,
        status: 'COMPLETED',
      },
    });

    await prisma.jobTimeEntry.create({
      data: {
        jobId: job.id,
        technicianId: user.id,
        startedAt: new Date(Date.now() - 7200000),
        endedAt: new Date(),
        durationSeconds: 7200, // 2.0 hours
      },
    });

    // 4. Generate Invoice (which automatically initializes Version 1)
    const invoice = await InvoiceService.generateInvoice(orgId, job.id, 150);
    invoiceId = invoice.id;
  });

  it('verifies Version 1 was initialized automatically upon invoice generation', async () => {
    const version = await prisma.invoiceVersion.findUnique({
      where: {
        invoiceId_versionNumber: { invoiceId, versionNumber: 1 },
      },
    });

    expect(version).toBeDefined();
    expect(version?.versionNumber).toBe(1);
    expect(version?.canonicalDocumentHash).toBeDefined();
    expect(version?.canonicalDocumentHash.length).toBe(64); // SHA-256 hex length
    expect(version?.status).toBe('SENT');
  });

  it('fails signing if affirmative electronic consent is not provided', async () => {
    await expect(
      InvoiceSigningService.recordConsent({
        organizationId: orgId,
        invoiceId,
        versionNumber: 1,
        customerId,
        consented: false, // Unchecked / false
        ipAddress: '198.51.100.1',
        userAgent: 'Mozilla/5.0 Test Agent',
      })
    ).rejects.toThrow('Explicit affirmative electronic consent is required');
  });

  it('records affirmative statutory consent correctly', async () => {
    const consent = await InvoiceSigningService.recordConsent({
      organizationId: orgId,
      invoiceId,
      versionNumber: 1,
      customerId,
      consented: true,
      ipAddress: '198.51.100.10',
      userAgent: 'Mozilla/5.0 Chrome Test',
      sessionId: 'sess-test-123',
      requestId: 'req-test-abc',
    });

    expect(consent).toBeDefined();
    expect(consent.consentText).toBe(STATUTORY_CONSENT_TEXT);
    expect(consent.consentTextVersion).toBe(CONSENT_TEXT_VERSION);
    expect(consent.ipAddress).toBe('198.51.100.10');

    // Audit event created
    const auditEvent = await prisma.invoiceAuditEvent.findFirst({
      where: { invoiceId, eventType: 'CONSENT_ACCEPTED' },
    });
    expect(auditEvent).toBeDefined();
    expect(auditEvent?.actorType).toBe('CUSTOMER');
  });

  it('executes atomic signing: generates PDF, stores artifact, records hashes, transitions to SIGNED', async () => {
    const consentRecord = await prisma.invoiceConsentRecord.findFirst({
      where: { invoiceId, invoiceVersion: { versionNumber: 1 } },
    });
    expect(consentRecord).toBeDefined();

    const signResult = await InvoiceSigningService.signInvoice({
      organizationId: orgId,
      invoiceId,
      versionNumber: 1,
      customerId,
      consentRecordId: consentRecord!.id,
      signerName: 'Alice Signer',
      signerEmail: 'alice.signer@example.com',
      signatureMethod: 'TYPED',
      signatureData: 'TYPED:Alice Signer',
      ipAddress: '198.51.100.10',
      userAgent: 'Mozilla/5.0 Chrome Test',
      authenticationMethod: 'CUSTOMER_PORTAL_SESSION',
    });

    expect(signResult.success).toBe(true);
    expect(signResult.alreadySigned).toBe(false);
    expect(signResult.signature).toBeDefined();

    // Verify Signature Record
    const signature = signResult.signature;
    expect(signature.signerName).toBe('Alice Signer');
    expect(signature.canonicalDocumentHash.length).toBe(64);
    expect(signature.signedPdfHash.length).toBe(64);
    expect(signature.signedPdfKey).toMatch(/\.pdf$/);

    // Verify PDF was stored in storage provider
    const storedFile = await storage.getFileBuffer(signature.signedPdfKey);
    expect(storedFile).toBeDefined();
    expect(storedFile?.contentType).toBe('application/pdf');

    // Verify Invoice and Version state
    const updatedInvoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
    });
    expect(updatedInvoice?.status).toBe('SIGNED');
    expect(updatedInvoice?.isImmutable).toBe(true);
    expect(updatedInvoice?.signedAt).toBeDefined();

    const updatedVersion = await prisma.invoiceVersion.findUnique({
      where: { invoiceId_versionNumber: { invoiceId, versionNumber: 1 } },
    });
    expect(updatedVersion?.status).toBe('SIGNED');
    expect(updatedVersion?.signedPdfHash).toBe(signature.signedPdfHash);

    // Verify audit events
    const signedEvent = await prisma.invoiceAuditEvent.findFirst({
      where: { invoiceId, eventType: 'INVOICE_SIGNED' },
    });
    expect(signedEvent).toBeDefined();
    expect(signedEvent?.signedPdfHash).toBe(signature.signedPdfHash);
  });

  it('prevents duplicate signatures on the same version (idempotency check)', async () => {
    const consentRecord = await prisma.invoiceConsentRecord.findFirst({
      where: { invoiceId, invoiceVersion: { versionNumber: 1 } },
    });

    // Attempt second signing of same version
    const duplicateAttempt = await InvoiceSigningService.signInvoice({
      organizationId: orgId,
      invoiceId,
      versionNumber: 1,
      customerId,
      consentRecordId: consentRecord!.id,
      signerName: 'Alice Signer',
      signerEmail: 'alice.signer@example.com',
      signatureMethod: 'TYPED',
      ipAddress: '198.51.100.10',
      userAgent: 'Mozilla/5.0 Chrome Test',
      authenticationMethod: 'CUSTOMER_PORTAL_SESSION',
    });

    expect(duplicateAttempt.success).toBe(true);
    expect(duplicateAttempt.alreadySigned).toBe(true);

    // Check count of signatures for this version
    const sigCount = await prisma.invoiceSignature.count({
      where: { organizationId: orgId, invoiceId },
    });
    expect(sigCount).toBe(1); // Exactly 1 signature, no duplicates!
  });
});
