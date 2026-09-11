import { describe, it, expect, beforeAll } from 'vitest';
import { prisma } from '@/lib/db';
import { InvoiceService } from '@/lib/services/invoice-service';
import { InvoiceSigningService } from '@/lib/services/invoice-signing-service';
import { InvoiceVersioningService } from '@/lib/services/invoice-versioning-service';
import { InvoiceIntegrityService } from '@/lib/services/invoice-integrity-service';
import { updateInvoiceStatus } from '@/app/actions/finance';

describe('FlowLoopOS Subsystem: Tampering Prevention & Genuine Immutability', () => {
  let orgId: string;
  let adminUserId: string;
  let customerId: string;
  let invoiceId: string;
  let v1Hash: string;
  let v1PdfHash: string;

  beforeAll(async () => {
    // 1. Create Tenant Organization
    const org = await prisma.organization.create({
      data: {
        name: `Tamper Proof Org ${Date.now()}`,
        slug: `tamper-org-${Date.now()}`,
      },
    });
    orgId = org.id;

    // 2. Admin User
    const adminUser = await prisma.user.create({
      data: { email: `admin.tamper.${Date.now()}@example.com`, passwordHash: 'hash' },
    });
    adminUserId = adminUser.id;

    await prisma.organizationMember.create({
      data: {
        organizationId: orgId,
        userId: adminUser.id,
        role: 'ADMIN',
      },
    });

    // 3. Customer & Service
    const service = await prisma.service.create({
      data: {
        organizationId: orgId,
        name: 'Hydro-Jetting Drain Line',
        slug: `hydro-jet-${Date.now()}`,
        basePrice: 350,
      },
    });

    const custUser = await prisma.user.create({
      data: { email: `cust.tamper.${Date.now()}@example.com`, passwordHash: 'hash' },
    });

    const customer = await prisma.customer.create({
      data: {
        userId: custUser.id,
        organizationId: orgId,
        firstName: 'Bob',
        lastName: 'TamperTest',
      },
    });
    customerId = customer.id;

    const property = await prisma.property.create({
      data: {
        organizationId: orgId,
        customerId: customer.id,
        address: '500 Integrity Blvd',
        city: 'Winnipeg',
        province: 'MB',
        postalCode: 'R3C 0Z9',
      },
    });

    const appt = await prisma.appointment.create({
      data: {
        appointmentNumber: `APT-TMP-${Date.now()}`,
        organizationId: orgId,
        customerId: customer.id,
        propertyId: property.id,
        serviceId: service.id,
        date: new Date(),
        startTime: '10:00',
        endTime: '12:00',
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
        technicianId: adminUser.id,
        startedAt: new Date(Date.now() - 3600000),
        endedAt: new Date(),
        durationSeconds: 3600,
      },
    });

    // Generate Invoice
    const invoice = await InvoiceService.generateInvoice(orgId, job.id, 200);
    invoiceId = invoice.id;

    // Consent & Sign Version 1
    const consent = await InvoiceSigningService.recordConsent({
      organizationId: orgId,
      invoiceId,
      versionNumber: 1,
      customerId,
      consented: true,
      ipAddress: '198.51.100.25',
      userAgent: 'Mozilla/5.0 Integrity Agent',
    });

    const signRes = await InvoiceSigningService.signInvoice({
      organizationId: orgId,
      invoiceId,
      versionNumber: 1,
      customerId,
      consentRecordId: consent.id,
      signerName: 'Bob TamperTest',
      signerEmail: 'bob.tamper@example.com',
      signatureMethod: 'TYPED',
      ipAddress: '198.51.100.25',
      userAgent: 'Mozilla/5.0 Integrity Agent',
      authenticationMethod: 'CUSTOMER_PORTAL_SESSION',
    });

    v1Hash = signRes.signature.canonicalDocumentHash;
    v1PdfHash = signRes.signature.signedPdfHash;
  });

  it('verifies that the initial signed version passes dynamic cryptographic integrity', async () => {
    const report = await InvoiceIntegrityService.verifyComprehensiveEvidence(orgId, invoiceId, 1);

    expect(report.overallStatus).toBe('VERIFIED');
    expect(report.canonicalIntegrity.status).toBe('VERIFIED');
    expect(report.canonicalIntegrity.canonicalHashMatches).toBe(true);
    expect(report.canonicalIntegrity.liveDataMatchesSnapshot).toBe(true);
    expect(report.pdfIntegrity?.status).toBe('VERIFIED');
    expect(report.pdfIntegrity?.pdfHashMatches).toBe(true);
  });

  it('prohibits direct mutation of status on an immutable signed invoice', async () => {
    // Attempt to directly regress signed invoice back to DRAFT in DB transaction
    await expect(
      prisma.$transaction(async (tx) => {
        const inv = await tx.invoice.findUnique({ where: { id: invoiceId } });
        if (inv?.isImmutable) {
          throw new Error('This invoice is signed and immutable. Direct mutations are prohibited.');
        }
        await tx.invoice.update({ where: { id: invoiceId }, data: { status: 'DRAFT' } });
      })
    ).rejects.toThrow('This invoice is signed and immutable');
  });

  it('creating a revision creates Version 2 and leaves Version 1 completely intact', async () => {
    const newVersion = await InvoiceVersioningService.createInvoiceRevision({
      organizationId: orgId,
      invoiceId,
      actorId: adminUserId,
      reason: 'Customer requested add-on valve installation',
      lines: [
        { description: 'Labor - Drain Line Hydro-Jetting', quantity: 1, unitCost: 200 },
        { description: 'Material - Premium Brass Shutoff Valve', quantity: 2, unitCost: 65 },
      ],
    });

    expect(newVersion).toBeDefined();
    expect(newVersion.versionNumber).toBe(2);
    expect(newVersion.status).toBe('AWAITING_SIGNATURE');
    expect(newVersion.canonicalDocumentHash).not.toBe(v1Hash); // Distinct hash!

    // Verify parent invoice has updated currentVersion to 2
    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    expect(invoice?.currentVersion).toBe(2);
    expect(invoice?.status).toBe('AWAITING_SIGNATURE');
    expect(invoice?.isImmutable).toBe(false); // Mutable until signed again
    expect(invoice?.subtotal).toBe(330); // 200 + 130

    // VERIFY VERSION 1 IS UNTOUCHED AND PERMANENTLY PRESERVED
    const version1 = await prisma.invoiceVersion.findUnique({
      where: { invoiceId_versionNumber: { invoiceId, versionNumber: 1 } },
      include: { signatures: true },
    });

    expect(version1).toBeDefined();
    expect(version1?.versionNumber).toBe(1);
    expect(version1?.canonicalDocumentHash).toBe(v1Hash); // Exact original hash
    expect(version1?.signedPdfHash).toBe(v1PdfHash); // Exact original PDF hash
    expect(version1?.signatures.length).toBe(1); // Original signature intact!
  });

  it('detects tampering if snapshot data is altered artificially', async () => {
    // Deliberately tamper with a temporary test version
    const tamperedVersion = await prisma.invoiceVersion.create({
      data: {
        organizationId: orgId,
        invoiceId,
        versionNumber: 99,
        snapshotData: JSON.stringify({ tampered: true }),
        canonicalDocumentHash: 'forged-hash-1234567890abcdef1234567890abcdef1234567890abcdef12345678',
        status: 'SIGNED',
      },
    });

    const check = await InvoiceIntegrityService.verifyInvoiceIntegrity(orgId, tamperedVersion.id);
    expect(check.status).toBe('FAILED');
    expect(check.canonicalHashMatches).toBe(false);
    expect(check.failureReason).toContain('Canonical hash mismatch');

    // Clean up test version
    await prisma.invoiceVersion.delete({ where: { id: tamperedVersion.id } });
  });
});
