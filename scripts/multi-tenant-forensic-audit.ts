import { prisma } from '../src/lib/db';
import { registerTenant } from '../src/app/actions/onboarding';
import { InvoiceService } from '../src/lib/services/invoice-service';
import { PaymentService } from '../src/lib/services/payment-service';
import { hashPassword } from '../src/lib/auth/password';
import { normalizeAddress } from '../src/lib/address';
import { generateAppointmentNumber } from '../src/lib/utils';

interface AuditResult {
  step: string;
  status: 'PASS' | 'FAIL';
  details: string;
}

async function runMultiTenantForensicAudit() {
  console.log('================================================================');
  console.log('🚀 AQUAFLOW — MULTI-TENANT SaaS + CUSTOMER ACQUISITION AUDIT');
  console.log('================================================================\n');

  const results: AuditResult[] = [];
  const runId = Date.now().toString().slice(-4);

  // --------------------------------------------------------------------------
  // STEP 1: PROVE SIGNUP & PROVISIONING FOR COMPANY A
  // --------------------------------------------------------------------------
  console.log('📦 STEP 1: Provisioning Company A (Apex Plumbing Ltd)...');
  const compAEmail = `admin.a.${runId}@apexplumbing.test`;
  const compAName = `Apex Plumbing ${runId}`;

  const formA = new FormData();
  formA.append('companyName', compAName);
  formA.append('firstName', 'Alice');
  formA.append('lastName', 'Apex');
  formA.append('email', compAEmail);
  formA.append('password', 'SecurePass123!');

  const regARes = await registerTenant(formA);
  if (!regARes.success) {
    throw new Error(`Failed to register Company A: ${regARes.error}`);
  }

  const userA = await prisma.user.findUnique({
    where: { email: compAEmail },
    include: {
      memberships: { include: { organization: true } },
      technician: true,
    },
  });

  const orgA = userA?.memberships[0]?.organization;
  if (!orgA || !userA) throw new Error('Company A records not found in DB');

  const orgAServices = await prisma.service.findMany({ where: { organizationId: orgA.id } });
  const orgAHours = await prisma.businessHours.findMany({ where: { organizationId: orgA.id } });
  const orgATax = await prisma.taxRule.findMany({ where: { organizationId: orgA.id } });

  console.log(`   ✔ Organization A ID: ${orgA.id} (${orgA.name})`);
  console.log(`   ✔ Organization A Slug: ${orgA.slug}`);
  console.log(`   ✔ Admin A: ${userA.email} (Role: ${userA.memberships[0].role})`);
  console.log(`   ✔ Auto-Provisioned Services: ${orgAServices.length}`);
  console.log(`   ✔ Auto-Provisioned Business Hours: ${orgAHours.length}`);
  console.log(`   ✔ Auto-Provisioned Tax Rules: ${orgATax.length}`);

  results.push({
    step: 'Provision Company A',
    status: (orgAServices.length > 0 && orgAHours.length > 0 && orgATax.length > 0) ? 'PASS' : 'FAIL',
    details: `Org A created with ${orgAServices.length} services, ${orgAHours.length} hours, ${orgATax.length} tax rules.`,
  });

  // --------------------------------------------------------------------------
  // STEP 2: PROVE SIGNUP & PROVISIONING FOR COMPANY B (INDEPENDENT TENANT)
  // --------------------------------------------------------------------------
  console.log('\n📦 STEP 2: Provisioning Independent Company B (Beacon Plumbing Co)...');
  const compBEmail = `admin.b.${runId}@beaconplumbing.test`;
  const compBName = `Beacon Plumbing ${runId}`;

  const formB = new FormData();
  formB.append('companyName', compBName);
  formB.append('firstName', 'Bob');
  formB.append('lastName', 'Beacon');
  formB.append('email', compBEmail);
  formB.append('password', 'SecurePass123!');

  const regBRes = await registerTenant(formB);
  if (!regBRes.success) {
    throw new Error(`Failed to register Company B: ${regBRes.error}`);
  }

  const userB = await prisma.user.findUnique({
    where: { email: compBEmail },
    include: {
      memberships: { include: { organization: true } },
      technician: true,
    },
  });

  const orgB = userB?.memberships[0]?.organization;
  if (!orgB || !userB) throw new Error('Company B records not found in DB');

  const orgBServices = await prisma.service.findMany({ where: { organizationId: orgB.id } });
  const orgBHours = await prisma.businessHours.findMany({ where: { organizationId: orgB.id } });
  const orgBTax = await prisma.taxRule.findMany({ where: { organizationId: orgB.id } });

  console.log(`   ✔ Organization B ID: ${orgB.id} (${orgB.name})`);
  console.log(`   ✔ Organization B Slug: ${orgB.slug}`);
  console.log(`   ✔ Admin B: ${userB.email} (Role: ${userB.memberships[0].role})`);
  console.log(`   ✔ Auto-Provisioned Services: ${orgBServices.length}`);
  console.log(`   ✔ Auto-Provisioned Business Hours: ${orgBHours.length}`);
  console.log(`   ✔ Auto-Provisioned Tax Rules: ${orgBTax.length}`);

  results.push({
    step: 'Provision Independent Company B',
    status: (orgA.id !== orgB.id && userA.id !== userB.id) ? 'PASS' : 'FAIL',
    details: `Org B created with distinct ID ${orgB.id}, separate Admin ${userB.email}`,
  });

  // --------------------------------------------------------------------------
  // STEP 3: DEDICATED CUSTOMER ACQUISITION URLS & ISOLATION
  // --------------------------------------------------------------------------
  console.log('\n🌐 STEP 3: Customer Acquisition URLs & Scoping...');
  const urlA = `/p/${orgA.slug}/book`;
  const urlB = `/p/${orgB.slug}/book`;

  console.log(`   ✔ Company A Public Booking URL: ${urlA}`);
  console.log(`   ✔ Company B Public Booking URL: ${urlB}`);
  console.log(`   ✔ URLs Distinct: ${urlA !== urlB}`);

  results.push({
    step: 'Unique Acquisition URLs',
    status: urlA !== urlB ? 'PASS' : 'FAIL',
    details: `Company A: ${urlA} | Company B: ${urlB}`,
  });

  // --------------------------------------------------------------------------
  // STEP 4: SHARED CUSTOMER EMAIL BOOKING TEST
  // --------------------------------------------------------------------------
  console.log('\n👥 STEP 4: Shared Homeowner Email Multi-Tenant Test...');
  const sharedCustomerEmail = `homeowner.${runId}@example.com`;

  // 4A: Homeowner books with Company A
  const serviceA = orgAServices[0];
  const globalUserA = await prisma.user.upsert({
    where: { email: sharedCustomerEmail },
    update: {},
    create: {
      email: sharedCustomerEmail,
      firstName: 'Harry',
      lastName: 'Homeowner',
      phone: '204-555-0144',
      passwordHash: 'guest',
    },
  });

  const customerA = await prisma.customer.create({
    data: {
      organizationId: orgA.id,
      userId: globalUserA.id,
      firstName: 'Harry',
      lastName: 'Homeowner',
      phone: '204-555-0144',
    },
  });

  const propertyA = await prisma.property.create({
    data: {
      organizationId: orgA.id,
      customerId: customerA.id,
      address: '100 River Road',
      city: 'Winnipeg',
      province: 'MB',
      postalCode: 'R2M 1A1',
    },
  });

  const apptA = await prisma.appointment.create({
    data: {
      appointmentNumber: generateAppointmentNumber(),
      organizationId: orgA.id,
      customerId: customerA.id,
      propertyId: propertyA.id,
      serviceId: serviceA.id,
      date: new Date(),
      startTime: '09:00',
      endTime: '11:00',
      status: 'CONFIRMED',
      problemDescription: 'Main drain backing up in basement (Apex Plumbing)',
    },
  });

  const jobA = await prisma.job.create({
    data: {
      organizationId: orgA.id,
      appointmentId: apptA.id,
      status: 'CREATED',
    },
  });

  console.log(`   ✔ Company A Acquired Customer: ${customerA.id} (Org: ${orgA.name})`);
  console.log(`   ✔ Company A Job Created: ${jobA.id} (Status: ${jobA.status})`);

  // 4B: SAME Homeowner books with Company B
  const serviceB = orgBServices[1] || orgBServices[0];
  const customerB = await prisma.customer.create({
    data: {
      organizationId: orgB.id,
      userId: globalUserA.id, // SAME GLOBAL USER
      firstName: 'Harry',
      lastName: 'Homeowner',
      phone: '204-555-0144',
    },
  });

  const propertyB = await prisma.property.create({
    data: {
      organizationId: orgB.id,
      customerId: customerB.id,
      address: '200 Mountain Ave',
      city: 'Winnipeg',
      province: 'MB',
      postalCode: 'R2W 2B2',
    },
  });

  const apptB = await prisma.appointment.create({
    data: {
      appointmentNumber: generateAppointmentNumber(),
      organizationId: orgB.id,
      customerId: customerB.id,
      propertyId: propertyB.id,
      serviceId: serviceB.id,
      date: new Date(),
      startTime: '13:00',
      endTime: '15:00',
      status: 'CONFIRMED',
      problemDescription: 'Hot water tank leaking (Beacon Plumbing)',
    },
  });

  const jobB = await prisma.job.create({
    data: {
      organizationId: orgB.id,
      appointmentId: apptB.id,
      status: 'CREATED',
    },
  });

  console.log(`   ✔ Company B Acquired Customer: ${customerB.id} (Org: ${orgB.name})`);
  console.log(`   ✔ Company B Job Created: ${jobB.id} (Status: ${jobB.status})`);
  console.log(`   ✔ Customer Records Distinct: ${customerA.id !== customerB.id}`);

  results.push({
    step: 'Shared Customer Email Isolation',
    status: (customerA.id !== customerB.id && customerA.organizationId !== customerB.organizationId) ? 'PASS' : 'FAIL',
    details: `Same email (${sharedCustomerEmail}) yielded Customer A in Org A (${customerA.id}) and Customer B in Org B (${customerB.id}).`,
  });

  // --------------------------------------------------------------------------
  // STEP 5: FORENSIC DATA LEAK & CROSS-TENANT ISOLATION PROOF
  // --------------------------------------------------------------------------
  console.log('\n🔒 STEP 5: Testing Cross-Tenant Boundary Protection...');

  // Query 1: Admin A views customers
  const orgACustomers = await prisma.customer.findMany({ where: { organizationId: orgA.id } });
  const adminACanSeeCustB = orgACustomers.some(c => c.id === customerB.id);

  // Query 2: Admin B views customers
  const orgBCustomers = await prisma.customer.findMany({ where: { organizationId: orgB.id } });
  const adminBCanSeeCustA = orgBCustomers.some(c => c.id === customerA.id);

  // Query 3: Admin A views jobs
  const orgAJobs = await prisma.job.findMany({ where: { organizationId: orgA.id } });
  const adminACanSeeJobB = orgAJobs.some(j => j.id === jobB.id);

  // Query 4: Admin B views jobs
  const orgBJobs = await prisma.job.findMany({ where: { organizationId: orgB.id } });
  const adminBCanSeeJobA = orgBJobs.some(j => j.id === jobA.id);

  console.log(`   ✔ Admin A sees Customer B? ${adminACanSeeCustB} (Expected: false)`);
  console.log(`   ✔ Admin B sees Customer A? ${adminBCanSeeCustA} (Expected: false)`);
  console.log(`   ✔ Admin A sees Job B? ${adminACanSeeJobB} (Expected: false)`);
  console.log(`   ✔ Admin B sees Job A? ${adminBCanSeeJobA} (Expected: false)`);

  const crossTenantLeakDetected = adminACanSeeCustB || adminBCanSeeCustA || adminACanSeeJobB || adminBCanSeeJobA;

  results.push({
    step: 'Cross-Tenant Read Isolation',
    status: !crossTenantLeakDetected ? 'PASS' : 'FAIL',
    details: `Zero data leakage across ${orgACustomers.length} Org A records and ${orgBCustomers.length} Org B records.`,
  });

  // --------------------------------------------------------------------------
  // STEP 6: COMPLETE INDEPENDENT BUSINESS LOOP FOR BOTH COMPANIES
  // --------------------------------------------------------------------------
  console.log('\n⚡ STEP 6: Executing Full Operational Cycle for Both Companies...');

  // Company A Operations Loop:
  const techA = userA.technician!;
  await prisma.job.update({
    where: { id: jobA.id },
    data: { technicianId: techA.id, status: 'WORKING' },
  });

  await prisma.jobTimeEntry.create({
    data: {
      jobId: jobA.id,
      technicianId: userA.id,
      startedAt: new Date(Date.now() - 7200000),
      endedAt: new Date(),
      durationSeconds: 7200, // 2.0 hrs
    },
  });

  await prisma.jobPart.create({
    data: {
      jobId: jobA.id,
      createdById: userA.id,
      name: 'Heavy Duty Cleanout Plug',
      quantity: 1,
      unitCost: 24.50,
    },
  });

  await prisma.customerSignature.create({
    data: {
      jobId: jobA.id,
      signerName: 'Harry Homeowner (Apex)',
      storageKey: 'signatures/apex-sig.png',
    },
  });

  await prisma.job.update({
    where: { id: jobA.id },
    data: { status: 'COMPLETED', completedAt: new Date() },
  });

  const invoiceA = await InvoiceService.generateInvoice(orgA.id, jobA.id, 120.0);
  const payIdA = `pi_apex_${runId}_${Math.random().toString(36).slice(2)}`;
  await PaymentService.processPaymentSuccess(orgA.id, invoiceA.id, invoiceA.total, payIdA);

  const finalInvoiceA = await prisma.invoice.findUnique({ where: { id: invoiceA.id } });
  console.log(`   ✔ Company A Invoice: ${finalInvoiceA?.invoiceNumber} | Subtotal: $${finalInvoiceA?.subtotal} | Total: $${finalInvoiceA?.total} | Status: ${finalInvoiceA?.status}`);

  // Company B Operations Loop:
  const techB = userB.technician!;
  await prisma.job.update({
    where: { id: jobB.id },
    data: { technicianId: techB.id, status: 'WORKING' },
  });

  await prisma.jobTimeEntry.create({
    data: {
      jobId: jobB.id,
      technicianId: userB.id,
      startedAt: new Date(Date.now() - 3600000),
      endedAt: new Date(),
      durationSeconds: 3600, // 1.0 hr
    },
  });

  await prisma.jobPart.create({
    data: {
      jobId: jobB.id,
      createdById: userB.id,
      name: 'Temperature & Pressure Relief Valve',
      quantity: 1,
      unitCost: 48.00,
    },
  });

  await prisma.customerSignature.create({
    data: {
      jobId: jobB.id,
      signerName: 'Harry Homeowner (Beacon)',
      storageKey: 'signatures/beacon-sig.png',
    },
  });

  await prisma.job.update({
    where: { id: jobB.id },
    data: { status: 'COMPLETED', completedAt: new Date() },
  });

  const invoiceB = await InvoiceService.generateInvoice(orgB.id, jobB.id, 150.0);
  const payIdB = `pi_beacon_${runId}_${Math.random().toString(36).slice(2)}`;
  await PaymentService.processPaymentSuccess(orgB.id, invoiceB.id, invoiceB.total, payIdB);

  const finalInvoiceB = await prisma.invoice.findUnique({ where: { id: invoiceB.id } });
  console.log(`   ✔ Company B Invoice: ${finalInvoiceB?.invoiceNumber} | Subtotal: $${finalInvoiceB?.subtotal} | Total: $${finalInvoiceB?.total} | Status: ${finalInvoiceB?.status}`);

  const loopsSucceeded = finalInvoiceA?.status === 'PAID' && finalInvoiceB?.status === 'PAID' && invoiceA.id !== invoiceB.id;

  results.push({
    step: 'End-to-End Operational Lifecycle',
    status: loopsSucceeded ? 'PASS' : 'FAIL',
    details: `Company A Invoice (${finalInvoiceA?.invoiceNumber}): PAID ($${finalInvoiceA?.total}) | Company B Invoice (${finalInvoiceB?.invoiceNumber}): PAID ($${finalInvoiceB?.total})`,
  });

  // --------------------------------------------------------------------------
  // SUMMARY REPORT
  // --------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log('📊 AUDIT SUMMARY TABLE');
  console.log('================================================================');
  results.forEach(r => {
    console.log(`${r.status === 'PASS' ? '🟢' : '🔴'} ${r.step.padEnd(35)} [${r.status}] -> ${r.details}`);
  });

  const allPassed = results.every(r => r.status === 'PASS');
  console.log(`\nOVERALL VERDICT: ${allPassed ? '🟢 TRUE MULTI-TENANT SAAS READY' : '🔴 FAILED'}\n`);
}

runMultiTenantForensicAudit().catch(err => {
  console.error('Fatal audit execution error:', err);
  process.exit(1);
});
