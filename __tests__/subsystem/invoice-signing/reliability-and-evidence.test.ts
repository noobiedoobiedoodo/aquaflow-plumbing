import { describe, it, expect, beforeAll } from 'vitest';
import { prisma } from '@/lib/db';
import { InvoiceService } from '@/lib/services/invoice-service';
import { InvoiceSigningService } from '@/lib/services/invoice-signing-service';
import { InvoiceEvidenceService } from '@/lib/services/invoice-evidence-service';
import JSZip from 'jszip';

describe('FlowLoopOS Subsystem: Reliability, Concurrency & Evidence Package', () => {
  let orgId: string;
  let customerId: string;
  let invoiceId: string;

  beforeAll(async () => {
    const org = await prisma.organization.create({
      data: { name: `Reliability Org ${Date.now()}`, slug: `rel-org-${Date.now()}` },
    });
    orgId = org.id;

    const service = await prisma.service.create({
      data: { organizationId: orgId, name: 'Sump Pump Test', slug: `sump-${Date.now()}`, basePrice: 250 },
    });

    const user = await prisma.user.create({ data: { email: `rel.cust.${Date.now()}@example.com`, passwordHash: 'hash' } });
    const customer = await prisma.customer.create({
      data: { userId: user.id, organizationId: orgId, firstName: 'Charlie', lastName: 'Reliable' },
    });
    customerId = customer.id;

    const prop = await prisma.property.create({
      data: { organizationId: orgId, customerId: customer.id, address: '88 Pump St', city: 'Winnipeg', province: 'MB', postalCode: 'R3C 003' },
    });
    const appt = await prisma.appointment.create({
      data: {
        appointmentNumber: `APT-REL-${Date.now()}`,
        organizationId: orgId,
        customerId: customer.id,
        propertyId: prop.id,
        serviceId: service.id,
        date: new Date(),
        startTime: '13:00',
        endTime: '15:00',
        status: 'CONFIRMED',
      },
    });
    const job = await prisma.job.create({
      data: { organizationId: orgId, appointmentId: appt.id, status: 'COMPLETED' },
    });
    const inv = await InvoiceService.generateInvoice(orgId, job.id, 250);
    invoiceId = inv.id;
  });

  it('handles concurrent double-click signing without race condition duplicates', async () => {
    const consent = await InvoiceSigningService.recordConsent({
      organizationId: orgId,
      invoiceId,
      versionNumber: 1,
      customerId,
      consented: true,
      ipAddress: '198.51.100.77',
      userAgent: 'Double Clicker Agent',
    });

    // Fire two signing requests simultaneously
    const [res1, res2] = await Promise.allSettled([
      InvoiceSigningService.signInvoice({
        organizationId: orgId,
        invoiceId,
        versionNumber: 1,
        customerId,
        consentRecordId: consent.id,
        signerName: 'Charlie Reliable',
        signerEmail: 'charlie@example.com',
        signatureMethod: 'TYPED',
        ipAddress: '198.51.100.77',
        userAgent: 'Double Clicker Agent',
        authenticationMethod: 'CUSTOMER_PORTAL_SESSION',
      }),
      InvoiceSigningService.signInvoice({
        organizationId: orgId,
        invoiceId,
        versionNumber: 1,
        customerId,
        consentRecordId: consent.id,
        signerName: 'Charlie Reliable',
        signerEmail: 'charlie@example.com',
        signatureMethod: 'TYPED',
        ipAddress: '198.51.100.77',
        userAgent: 'Double Clicker Agent',
        authenticationMethod: 'CUSTOMER_PORTAL_SESSION',
      }),
    ]);

    // At least one must succeed; neither should corrupt the database
    const successfulResponses = [res1, res2].filter((r) => r.status === 'fulfilled');
    expect(successfulResponses.length).toBeGreaterThanOrEqual(1);

    // Hard verification: exactly one signature record exists
    const sigs = await prisma.invoiceSignature.findMany({
      where: { organizationId: orgId, invoiceId },
    });
    expect(sigs.length).toBe(1);

    const inv = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    expect(inv?.status).toBe('SIGNED');
  });

  it('exports comprehensive evidence package containing all 6 required files and verifiable hashes', async () => {
    const { buffer, filename } = await InvoiceEvidenceService.exportEvidencePackage(orgId, invoiceId, 1);

    expect(buffer).toBeDefined();
    expect(buffer.length).toBeGreaterThan(0);
    expect(filename).toMatch(/\.zip$/);

    // Unpack ZIP in-memory to verify structure
    const zip = await JSZip.loadAsync(buffer);
    const fileNames = Object.keys(zip.files);

    expect(fileNames.some((f) => f.endsWith('signed-invoice.pdf'))).toBe(true);
    expect(fileNames.some((f) => f.endsWith('invoice-snapshot.json'))).toBe(true);
    expect(fileNames.some((f) => f.endsWith('signature-record.json'))).toBe(true);
    expect(fileNames.some((f) => f.endsWith('consent-record.json'))).toBe(true);
    expect(fileNames.some((f) => f.endsWith('audit-timeline.json'))).toBe(true);
    expect(fileNames.some((f) => f.endsWith('integrity-verification.json'))).toBe(true);

    // Inspect integrity-verification.json contents
    const verificationFile = fileNames.find((f) => f.endsWith('integrity-verification.json'));
    const verificationContent = await zip.files[verificationFile!].async('string');
    const parsedVerification = JSON.parse(verificationContent);

    expect(parsedVerification.overallStatus).toBe('VERIFIED');
    expect(parsedVerification.canonicalIntegrity.canonicalHashMatches).toBe(true);
    expect(parsedVerification.pdfIntegrity.pdfHashMatches).toBe(true);
  });
});
