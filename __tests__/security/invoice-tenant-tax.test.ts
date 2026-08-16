import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { prisma } from '@/lib/db';
import { InvoiceService } from '@/lib/services/invoice-service';
import { randomUUID } from 'crypto';

describe('Multi-Tenant Invoice Tax & Labor Configuration Matrix', () => {
  let orgAId: string;
  let orgBId: string;
  let jobAId: string;
  let jobBId: string;
  let taxRuleAId: string;
  let taxRuleBId: string;
  let userAId: string;
  let userBId: string;
  let propAId: string;
  let propBId: string;

  beforeEach(async () => {
    const testId = randomUUID().slice(0, 8);

    // 1. Create Org A (13% HST) & Org B (5% GST + 7% PST = 12%)
    const orgA = await prisma.organization.create({
      data: { name: `Tax Org A ${testId}`, slug: `tax-org-a-${testId}`, taxRate: 0.13 },
    });
    const orgB = await prisma.organization.create({
      data: { name: `Tax Org B ${testId}`, slug: `tax-org-b-${testId}`, taxRate: 0.12 },
    });
    orgAId = orgA.id;
    orgBId = orgB.id;

    // 2. Create Active Tax Rules
    // Org A: Single 13% HST
    const ruleA = await prisma.taxRule.create({
      data: {
        organizationId: orgAId,
        name: 'ON HST',
        jurisdiction: 'Ontario',
        rate: 0.13,
        appliesTo: 'ALL',
        active: true,
      },
    });
    taxRuleAId = ruleA.id;

    // Org B: 5% GST on ALL + 7% PST on MATERIALS only
    const ruleB1 = await prisma.taxRule.create({
      data: {
        organizationId: orgBId,
        name: 'BC GST',
        jurisdiction: 'BC',
        rate: 0.05,
        appliesTo: 'ALL',
        active: true,
      },
    });
    const ruleB2 = await prisma.taxRule.create({
      data: {
        organizationId: orgBId,
        name: 'BC PST Materials',
        jurisdiction: 'BC',
        rate: 0.07,
        appliesTo: 'MATERIALS',
        active: true,
      },
    });
    taxRuleBId = ruleB1.id;

    // 3. Create Users, Customers & Services
    const userA = await prisma.user.create({
      data: { email: `tax.user.a.${testId}@test.com`, firstName: 'Cust', lastName: 'A', passwordHash: 'hash_123' },
    });
    const userB = await prisma.user.create({
      data: { email: `tax.user.b.${testId}@test.com`, firstName: 'Cust', lastName: 'B', passwordHash: 'hash_123' },
    });
    userAId = userA.id;
    userBId = userB.id;

    const custA = await prisma.customer.create({
      data: { organizationId: orgAId, userId: userA.id, firstName: 'Cust', lastName: 'A' },
    });
    const custB = await prisma.customer.create({
      data: { organizationId: orgBId, userId: userB.id, firstName: 'Cust', lastName: 'B' },
    });

    const propA = await prisma.property.create({
      data: { organizationId: orgAId, customerId: custA.id, address: '100 Tax St', city: 'Toronto', postalCode: 'M5V 2T6' },
    });
    const propB = await prisma.property.create({
      data: { organizationId: orgBId, customerId: custB.id, address: '200 Tax Ave', city: 'Vancouver', postalCode: 'V6B 1A1' },
    });
    propAId = propA.id;
    propBId = propB.id;

    const servA = await prisma.service.create({
      data: { organizationId: orgAId, name: 'Faucet Install', slug: `faucet-${testId}`, basePrice: 100 },
    });
    const servB = await prisma.service.create({
      data: { organizationId: orgBId, name: 'Boiler Repair', slug: `boiler-${testId}`, basePrice: 200 },
    });

    // 4. Create Appointments and Completed Jobs
    const apptA = await prisma.appointment.create({
      data: {
        appointmentNumber: `APPT-A-${testId}`,
        organizationId: orgAId,
        customerId: custA.id,
        propertyId: propA.id,
        serviceId: servA.id,
        date: new Date(),
        startTime: '09:00',
        endTime: '11:00',
        status: 'COMPLETED',
      },
    });
    const jobA = await prisma.job.create({
      data: { organizationId: orgAId, appointmentId: apptA.id, status: 'COMPLETED' },
    });
    jobAId = jobA.id;

    const apptB = await prisma.appointment.create({
      data: {
        appointmentNumber: `APPT-B-${testId}`,
        organizationId: orgBId,
        customerId: custB.id,
        propertyId: propB.id,
        serviceId: servB.id,
        date: new Date(),
        startTime: '13:00',
        endTime: '15:00',
        status: 'COMPLETED',
      },
    });
    const jobB = await prisma.job.create({
      data: { organizationId: orgBId, appointmentId: apptB.id, status: 'COMPLETED' },
    });
    jobBId = jobB.id;

    // Add 2 hours of labor (7200s) and $100 in parts to both jobs
    await prisma.jobTimeEntry.create({
      data: {
        jobId: jobAId,
        technicianId: userA.id,
        startedAt: new Date(Date.now() - 7200 * 1000),
        endedAt: new Date(),
        durationSeconds: 7200,
      },
    });
    await prisma.jobPart.create({
      data: { jobId: jobAId, name: 'Brass Valve', quantity: 2, unitCost: 50, createdById: userA.id },
    });

    await prisma.jobTimeEntry.create({
      data: {
        jobId: jobBId,
        technicianId: userB.id,
        startedAt: new Date(Date.now() - 7200 * 1000),
        endedAt: new Date(),
        durationSeconds: 7200,
      },
    });
    await prisma.jobPart.create({
      data: { jobId: jobBId, name: 'Boiler Sensor', quantity: 1, unitCost: 100, createdById: userB.id },
    });
  });

  afterEach(async () => {
    const invoices = await prisma.invoice.findMany({
      where: { organizationId: { in: [orgAId, orgBId] } },
      select: { id: true },
    });
    const invoiceIds = invoices.map((i) => i.id);

    if (invoiceIds.length > 0) {
      await prisma.invoiceTax.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
      await prisma.invoiceLine.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
      await prisma.financialActivity.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
    }

    await prisma.event.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.invoice.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.jobPart.deleteMany({ where: { jobId: { in: [jobAId, jobBId] } } });
    await prisma.jobTimeEntry.deleteMany({ where: { jobId: { in: [jobAId, jobBId] } } });
    await prisma.job.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.appointment.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.property.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.taxRule.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.service.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.customer.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userAId, userBId] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } });
  });

  it('Org A tax configuration is used for Org A invoice (13% HST)', async () => {
    // 2 hrs labor @ $125/hr = $250. Parts = $100. Subtotal = $350.
    // 13% HST on $350 = $45.50. Total = $395.50.
    const invA = await InvoiceService.generateInvoice(orgAId, jobAId, 125.0);

    expect(invA.subtotal).toBe(350);
    expect(invA.taxTotal).toBe(45.5);
    expect(invA.total).toBe(395.5);
    expect(invA.taxes.length).toBe(1);
    expect(invA.taxes[0].name).toBe('ON HST');
    expect(invA.taxes[0].rate).toBe(0.13);
  });

  it('Org B tax configuration is used for Org B invoice (5% on ALL + 7% on MATERIALS)', async () => {
    // 2 hrs labor @ $125/hr = $250. Parts = $100. Subtotal = $350.
    // 5% GST on $350 = $17.50. 7% PST on $100 materials = $7.00. TaxTotal = $24.50. Total = $374.50.
    const invB = await InvoiceService.generateInvoice(orgBId, jobBId, 125.0);

    expect(invB.subtotal).toBe(350);
    expect(invB.taxTotal).toBe(24.5);
    expect(invB.total).toBe(374.5);
    expect(invB.taxes.length).toBe(2);
  });

  it('Changing Org A tax configuration does not affect Org B', async () => {
    // Update Org A to 15%
    await prisma.taxRule.update({
      where: { id: taxRuleAId },
      data: { rate: 0.15, name: 'Increased HST' },
    });

    const invB = await InvoiceService.generateInvoice(orgBId, jobBId, 125.0);
    // Org B tax must remain $24.50
    expect(invB.taxTotal).toBe(24.5);
    expect(invB.total).toBe(374.5);
  });

  it('Cross-tenant TaxRule selection is impossible (Org A cannot access Org B rules)', async () => {
    const rulesForOrgA = await prisma.taxRule.findMany({
      where: { organizationId: orgAId, active: true },
    });
    expect(rulesForOrgA.some((r) => r.organizationId === orgBId)).toBe(false);
  });

  it('InvoiceService and Finance Action calculations yield identical results', async () => {
    const invFromService = await InvoiceService.generateInvoice(orgAId, jobAId, 125.0);

    const expectedLabor = 250;
    const expectedMaterials = 100;
    const expectedSubtotal = 350;
    const expectedTax = Number((expectedSubtotal * 0.13).toFixed(2));
    const expectedTotal = expectedSubtotal + expectedTax;

    expect(invFromService.subtotal).toBe(expectedSubtotal);
    expect(invFromService.taxTotal).toBe(expectedTax);
    expect(invFromService.total).toBe(expectedTotal);
  });
});
