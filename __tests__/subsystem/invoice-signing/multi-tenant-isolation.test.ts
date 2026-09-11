import { describe, it, expect, beforeAll } from 'vitest';
import { prisma } from '@/lib/db';
import { InvoiceService } from '@/lib/services/invoice-service';
import { InvoiceSigningService } from '@/lib/services/invoice-signing-service';
import { InvoiceEvidenceService } from '@/lib/services/invoice-evidence-service';
import { InvoiceIntegrityService } from '@/lib/services/invoice-integrity-service';

describe('FlowLoopOS Subsystem: Strict Multi-Tenant Isolation', () => {
  let tenantAOrgId: string;
  let tenantBOrgId: string;
  let customerAId: string;
  let customerBId: string;
  let tenantAInvoiceId: string;
  let tenantBInvoiceId: string;
  let tenantASignatureId: string;

  beforeAll(async () => {
    // 1. Create Tenant A
    const orgA = await prisma.organization.create({
      data: { name: `Tenant Alpha ${Date.now()}`, slug: `tenant-alpha-${Date.now()}` },
    });
    tenantAOrgId = orgA.id;

    // 2. Create Tenant B
    const orgB = await prisma.organization.create({
      data: { name: `Tenant Beta ${Date.now()}`, slug: `tenant-beta-${Date.now()}` },
    });
    tenantBOrgId = orgB.id;

    // Services
    const serviceA = await prisma.service.create({
      data: { organizationId: tenantAOrgId, name: 'Plumbing A', slug: `serv-a-${Date.now()}`, basePrice: 100 },
    });
    const serviceB = await prisma.service.create({
      data: { organizationId: tenantBOrgId, name: 'Plumbing B', slug: `serv-b-${Date.now()}`, basePrice: 100 },
    });

    // Customer A (in Tenant A)
    const userA = await prisma.user.create({ data: { email: `cust.a.${Date.now()}@example.com`, passwordHash: 'hash' } });
    const custA = await prisma.customer.create({
      data: { userId: userA.id, organizationId: tenantAOrgId, firstName: 'Customer', lastName: 'Alpha' },
    });
    customerAId = custA.id;

    // Customer B (in Tenant B)
    const userB = await prisma.user.create({ data: { email: `cust.b.${Date.now()}@example.com`, passwordHash: 'hash' } });
    const custB = await prisma.customer.create({
      data: { userId: userB.id, organizationId: tenantBOrgId, firstName: 'Customer', lastName: 'Beta' },
    });
    customerBId = custB.id;

    // Appointments & Jobs
    const propA = await prisma.property.create({
      data: { organizationId: tenantAOrgId, customerId: customerAId, address: '1 Alpha St', city: 'Winnipeg', province: 'MB', postalCode: 'R3C 001' },
    });
    const apptA = await prisma.appointment.create({
      data: {
        appointmentNumber: `APT-A-${Date.now()}`,
        organizationId: tenantAOrgId,
        customerId: customerAId,
        propertyId: propA.id,
        serviceId: serviceA.id,
        date: new Date(),
        startTime: '09:00',
        endTime: '10:00',
        status: 'CONFIRMED',
      },
    });
    const jobA = await prisma.job.create({
      data: { organizationId: tenantAOrgId, appointmentId: apptA.id, status: 'COMPLETED' },
    });
    const invA = await InvoiceService.generateInvoice(tenantAOrgId, jobA.id, 100);
    tenantAInvoiceId = invA.id;

    const propB = await prisma.property.create({
      data: { organizationId: tenantBOrgId, customerId: customerBId, address: '2 Beta St', city: 'Winnipeg', province: 'MB', postalCode: 'R3C 002' },
    });
    const apptB = await prisma.appointment.create({
      data: {
        appointmentNumber: `APT-B-${Date.now()}`,
        organizationId: tenantBOrgId,
        customerId: customerBId,
        propertyId: propB.id,
        serviceId: serviceB.id,
        date: new Date(),
        startTime: '11:00',
        endTime: '12:00',
        status: 'CONFIRMED',
      },
    });
    const jobB = await prisma.job.create({
      data: { organizationId: tenantBOrgId, appointmentId: apptB.id, status: 'COMPLETED' },
    });
    const invB = await InvoiceService.generateInvoice(tenantBOrgId, jobB.id, 100);
    tenantBInvoiceId = invB.id;

    // Sign Invoice A
    const consentA = await InvoiceSigningService.recordConsent({
      organizationId: tenantAOrgId,
      invoiceId: tenantAInvoiceId,
      versionNumber: 1,
      customerId: customerAId,
      consented: true,
      ipAddress: '10.0.0.1',
      userAgent: 'Agent Alpha',
    });

    const sigResA = await InvoiceSigningService.signInvoice({
      organizationId: tenantAOrgId,
      invoiceId: tenantAInvoiceId,
      versionNumber: 1,
      customerId: customerAId,
      consentRecordId: consentA.id,
      signerName: 'Customer Alpha',
      signerEmail: 'alpha@example.com',
      signatureMethod: 'TYPED',
      ipAddress: '10.0.0.1',
      userAgent: 'Agent Alpha',
      authenticationMethod: 'CUSTOMER_PORTAL_SESSION',
    });
    tenantASignatureId = sigResA.signature.id;
  });

  it('rejects cross-tenant consent recording', async () => {
    // Tenant B tries to record consent for Tenant A invoice
    await expect(
      InvoiceSigningService.recordConsent({
        organizationId: tenantBOrgId, // Cross-tenant spoofing!
        invoiceId: tenantAInvoiceId,
        versionNumber: 1,
        customerId: customerBId,
        consented: true,
        ipAddress: '10.0.0.99',
        userAgent: 'Malicious Agent',
      })
    ).rejects.toThrow('cross-tenant access denied');
  });

  it('rejects cross-tenant invoice signing', async () => {
    // Tenant B tries to sign Tenant A invoice
    const fakeConsentRecord = await prisma.invoiceConsentRecord.findFirst({
      where: { invoiceId: tenantAInvoiceId },
    });

    await expect(
      InvoiceSigningService.signInvoice({
        organizationId: tenantBOrgId, // Cross-tenant!
        invoiceId: tenantAInvoiceId,
        versionNumber: 1,
        customerId: customerBId,
        consentRecordId: fakeConsentRecord!.id,
        signerName: 'Intruder',
        signerEmail: 'intruder@example.com',
        signatureMethod: 'TYPED',
        ipAddress: '10.0.0.99',
        userAgent: 'Malicious Agent',
        authenticationMethod: 'CUSTOMER_PORTAL_SESSION',
      })
    ).rejects.toThrow('cross-tenant access denied');
  });

  it('rejects cross-tenant evidence package export', async () => {
    // Tenant B attempts to export Tenant A evidence package
    await expect(
      InvoiceEvidenceService.exportEvidencePackage(tenantBOrgId, tenantAInvoiceId, 1)
    ).rejects.toThrow('cross-tenant access denied');
  });

  it('rejects cross-tenant integrity verification', async () => {
    // Tenant B attempts to verify Tenant A signature
    const result = await InvoiceIntegrityService.verifySignedPdf(tenantBOrgId, tenantASignatureId);
    expect(result.status).toBe('FAILED');
    expect(result.failureReason).toContain('Signature record not found in tenant scope');
  });
});
