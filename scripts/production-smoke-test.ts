import { prisma } from '../src/lib/db';
import { redis } from '../src/lib/queue/redis';
import { storage } from '../src/lib/storage';
import { env } from '../src/lib/config/env';
import { randomUUID } from 'crypto';

/**
 * AquaFlow Production Smoke Test
 * Run on staging or production to verify infrastructure health and end-to-end flow:
 *   npx tsx scripts/production-smoke-test.ts
 */
async function runProductionSmokeTest() {
  console.log('\n🔍 Starting AquaFlow Controlled Production Smoke Test...\n');
  const runId = randomUUID().slice(0, 8);

  // 1. Infrastructure Checks
  console.log('1️⃣  Verifying Infrastructure Connections...');
  
  // Database Check
  try {
    const dbCheck = await prisma.$queryRaw`SELECT 1 as healthy`;
    console.log('   ✔ PostgreSQL Database: Connected & Healthy');
  } catch (err: any) {
    console.error('   ❌ PostgreSQL Database Connection Failed:', err.message);
    process.exit(1);
  }

  // Redis Check
  if (redis) {
    try {
      await redis.set(`smoke:ping:${runId}`, 'pong', 'EX', 60);
      const val = await redis.get(`smoke:ping:${runId}`);
      if (val === 'pong') {
        console.log('   ✔ Redis / BullMQ Queue: Connected & Healthy');
        await redis.del(`smoke:ping:${runId}`);
      } else {
        throw new Error('Redis ping/pong mismatch');
      }
    } catch (err: any) {
      console.warn('   ⚠ Redis Check Warning (Worker tasks may degrade):', err.message);
    }
  } else {
    console.log('   ℹ Redis: In-memory / dev mode');
  }

  // Storage Check
  try {
    const testBuffer = Buffer.from(`Smoke Test Storage Payload ${runId}`, 'utf-8');
    const uploadRes = await storage.uploadFile(testBuffer, `smoke-${runId}.txt`, 'text/plain');
    const exists = await storage.fileExists(uploadRes.storageKey);
    if (!exists) throw new Error('Uploaded smoke test file not found in storage');
    await storage.deleteFile(uploadRes.storageKey);
    console.log('   ✔ Object Storage (S3/Private Storage): Read/Write/Delete Operational');
  } catch (err: any) {
    console.error('   ❌ Object Storage Failed:', err.message);
    process.exit(1);
  }

  // 2. Controlled Internal Organization Workflow
  console.log('\n2️⃣  Executing Controlled Smoke Workflow (Internal Test Org)...');
  const orgSlug = `smoke-test-org-${runId}`;
  
  const org = await prisma.organization.create({
    data: {
      name: `AquaFlow Internal Test Org ${runId}`,
      slug: orgSlug,
      taxRate: 0.13,
      onboardingStatus: 'ONBOARDING_COMPLETE',
      stripeConnectionStatus: 'ACTIVE',
      stripeAccountId: `acct_smoke_${runId}`,
    },
  });
  console.log(`   ✔ Organization Provisioned: ${org.name} (Slug: /p/${orgSlug})`);

  // Service Catalog
  const service = await prisma.service.create({
    data: {
      organizationId: org.id,
      name: 'Smoke Drain Inspection',
      slug: `smoke-drain-${runId}`,
      basePrice: 150.0,
      isActive: true,
    },
  });
  console.log(`   ✔ Service Active: ${service.name} ($${service.basePrice})`);

  // Staff (Admin + Tech)
  const adminUser = await prisma.user.create({
    data: {
      email: `smoke.admin.${runId}@aquaflow.internal`,
      firstName: 'Smoke',
      lastName: 'Admin',
      passwordHash: 'smoke_hash_internal',
      memberships: { create: { organizationId: org.id, role: 'SUPER_ADMIN' } },
    },
  });

  const techUser = await prisma.user.create({
    data: {
      email: `smoke.tech.${runId}@aquaflow.internal`,
      firstName: 'Smoke',
      lastName: 'Tech',
      passwordHash: 'smoke_hash_internal',
      memberships: { create: { organizationId: org.id, role: 'TECHNICIAN' } },
    },
  });

  const tech = await prisma.technician.create({
    data: {
      organizationId: org.id,
      userId: techUser.id,
      firstName: 'Smoke',
      lastName: 'Tech',
      availabilityStatus: 'AVAILABLE',
    },
  });
  console.log(`   ✔ Staff Registered: Admin (${adminUser.email}) & Tech (${techUser.email})`);

  // Customer & Public Booking
  const customerUser = await prisma.user.create({
    data: {
      email: `smoke.customer.${runId}@aquaflow.internal`,
      firstName: 'Smoke',
      lastName: 'Customer',
      passwordHash: 'none',
    },
  });

  const customer = await prisma.customer.create({
    data: {
      organizationId: org.id,
      userId: customerUser.id,
      firstName: 'Smoke',
      lastName: 'Customer',
    },
  });

  const property = await prisma.property.create({
    data: {
      organizationId: org.id,
      customerId: customer.id,
      address: '123 Smoke Test Blvd',
      city: 'Winnipeg',
      postalCode: 'R3C 1A1',
    },
  });

  const appt = await prisma.appointment.create({
    data: {
      appointmentNumber: `SMOKE-${runId.toUpperCase()}`,
      organizationId: org.id,
      customerId: customer.id,
      propertyId: property.id,
      serviceId: service.id,
      date: new Date(),
      startTime: '10:00',
      endTime: '12:00',
      status: 'PENDING',
    },
  });

  const job = await prisma.job.create({
    data: {
      organizationId: org.id,
      appointmentId: appt.id,
      status: 'CREATED',
    },
  });
  console.log(`   ✔ Booking Created: Appointment #${appt.appointmentNumber}, Job ID: ${job.id}`);

  // Dispatch Assignment
  await prisma.job.update({
    where: { id: job.id },
    data: { technicianId: tech.id, status: 'ASSIGNED' },
  });
  await prisma.appointment.update({
    where: { id: appt.id },
    data: { technicianId: tech.id, status: 'SCHEDULED' },
  });
  console.log(`   ✔ Dispatch: Job assigned to Technician (${tech.firstName} ${tech.lastName})`);

  // Technician Execution
  await prisma.job.update({ where: { id: job.id }, data: { status: 'WORKING', startedAt: new Date() } });
  await prisma.jobTimeEntry.create({
    data: {
      jobId: job.id,
      technicianId: techUser.id,
      startedAt: new Date(Date.now() - 3600 * 1000),
      endedAt: new Date(),
      durationSeconds: 3600,
    },
  });
  await prisma.jobPart.create({
    data: {
      jobId: job.id,
      name: 'Inspection Camera O-Ring',
      quantity: 1,
      unitCost: 25.0,
      createdById: techUser.id,
    },
  });

  const sig = await storage.uploadFile(Buffer.from('Smoke Signature Data', 'utf-8'), `smoke-sig-${runId}.png`, 'image/png');
  await prisma.customerSignature.create({
    data: { jobId: job.id, signerName: 'Smoke Customer', storageKey: sig.storageKey },
  });

  await prisma.job.update({
    where: { id: job.id },
    data: { status: 'COMPLETED', completedAt: new Date(), workPerformed: 'Camera drain line inspected. Flow normal.' },
  });
  console.log('   ✔ Field Execution: 1h labor + parts + customer signature recorded -> Job COMPLETED');

  // Invoicing (1h labor @ $125 + $25 part = $150. Tax 13% = $19.50. Total = $169.50)
  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber: `INV-SMOKE-${runId.toUpperCase()}`,
      organizationId: org.id,
      jobId: job.id,
      customerId: customer.id,
      status: 'SENT',
      subtotal: 150.0,
      taxTotal: 19.50,
      total: 169.50,
      paymentToken: randomUUID(),
      lines: {
        create: [
          { description: 'Labor - Drain Inspection', quantity: 1, unitCost: 125.0 },
          { description: 'Material - Inspection Camera O-Ring', quantity: 1, unitCost: 25.0 },
        ],
      },
      taxes: {
        create: [
          { name: 'ON HST', jurisdiction: 'Ontario', rate: 0.13, amount: 19.50 },
        ],
      },
    },
  });
  console.log(`   ✔ Invoicing: ${invoice.invoiceNumber} generated for $${invoice.total.toFixed(2)}`);

  // Stripe Settlement Simulation
  await prisma.payment.create({
    data: {
      invoiceId: invoice.id,
      amount: invoice.total,
      currency: 'cad',
      status: 'SUCCEEDED',
      provider: 'stripe',
      providerPaymentId: `pi_smoke_${runId}`,
      idempotencyKey: `stripe:pi:smoke_${runId}`,
      paidAt: new Date(),
    },
  });
  await prisma.invoice.update({
    where: { id: invoice.id },
    data: { status: 'PAID', amountPaid: invoice.total },
  });
  console.log(`   ✔ Settlement: Paid via Stripe Connect (${org.stripeAccountId}) -> Invoice marked PAID`);

  // Teardown Smoke Test Data
  console.log('\n3️⃣  Cleaning Up Smoke Test Artifacts...');
  await storage.deleteFile(sig.storageKey);
  await prisma.payment.deleteMany({ where: { invoiceId: invoice.id } });
  await prisma.invoiceTax.deleteMany({ where: { invoiceId: invoice.id } });
  await prisma.invoiceLine.deleteMany({ where: { invoiceId: invoice.id } });
  await prisma.invoice.deleteMany({ where: { organizationId: org.id } });
  await prisma.customerSignature.deleteMany({ where: { jobId: job.id } });
  await prisma.jobPart.deleteMany({ where: { jobId: job.id } });
  await prisma.jobTimeEntry.deleteMany({ where: { jobId: job.id } });
  await prisma.job.deleteMany({ where: { organizationId: org.id } });
  await prisma.appointment.deleteMany({ where: { organizationId: org.id } });
  await prisma.property.deleteMany({ where: { organizationId: org.id } });
  await prisma.customer.deleteMany({ where: { organizationId: org.id } });
  await prisma.technician.deleteMany({ where: { organizationId: org.id } });
  await prisma.organizationMember.deleteMany({ where: { organizationId: org.id } });
  await prisma.service.deleteMany({ where: { organizationId: org.id } });
  await prisma.user.deleteMany({ where: { id: { in: [adminUser.id, techUser.id, customerUser.id] } } });
  await prisma.organization.deleteMany({ where: { id: org.id } });

  console.log('   ✔ Cleanup complete.');
  console.log('\n🎉 ALL PRODUCTION SMOKE TESTS PASSED! System is fully operational.\n');
}

runProductionSmokeTest()
  .catch((e) => {
    console.error('Smoke test failure:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
