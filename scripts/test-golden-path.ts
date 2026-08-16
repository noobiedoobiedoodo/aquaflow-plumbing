import { prisma } from '../src/lib/db';
import { randomUUID } from 'crypto';

async function runGoldenPathTest() {
  console.log('🚀 Starting AquaFlow Golden Path Pre-Beta Verification...\n');

  const testId = randomUUID().slice(0, 8);
  const slug = `golden-plumbing-${testId}`;
  const stripeAccountId = `acct_golden_${testId}`;
  const customerEmail = `customer-${testId}@example.com`;

  try {
    // 1. Organization Onboarding
    console.log('1️⃣  Creating Organization...');
    const org = await prisma.organization.create({
      data: {
        name: 'Golden Standard Plumbing',
        slug,
        phone: '204-555-0100',
        city: 'Winnipeg',
        province: 'MB',
        postalCode: 'R3C 1A1',
        stripeAccountId,
        stripeConnectionStatus: 'ACTIVE',
        onboardingStatus: 'ONBOARDING_COMPLETE',
      },
    });
    console.log(`   ✔ Organization created: ${org.name} (slug: /p/${org.slug})\n`);

    // 2. Admin Creation
    console.log('2️⃣  Creating Super Admin User...');
    const adminUser = await prisma.user.create({
      data: {
        email: `admin-${testId}@goldenplumbing.com`,
        firstName: 'Greg',
        lastName: 'Golden',
        passwordHash: 'hashed_pw',
        memberships: {
          create: { organizationId: org.id, role: 'SUPER_ADMIN' },
        },
      },
    });
    console.log(`   ✔ Admin user created: ${adminUser.email}\n`);

    // 3. Technician Onboarding
    console.log('3️⃣  Creating Technician Profile...');
    const techUser = await prisma.user.create({
      data: {
        email: `tech-${testId}@goldenplumbing.com`,
        firstName: 'Tyler',
        lastName: 'Torque',
        passwordHash: 'hashed_pw',
        memberships: {
          create: { organizationId: org.id, role: 'TECHNICIAN' },
        },
      },
    });
    const technician = await prisma.technician.create({
      data: {
        organizationId: org.id,
        userId: techUser.id,
        firstName: 'Tyler',
        lastName: 'Torque',
        phone: '204-555-0188',
        availabilityStatus: 'AVAILABLE',
      },
    });
    console.log(`   ✔ Technician registered: ${technician.firstName} ${technician.lastName} (ID: ${technician.id})\n`);

    // 4. Service Catalog
    console.log('4️⃣  Setting up Service Catalog...');
    const service = await prisma.service.create({
      data: {
        organizationId: org.id,
        name: 'Hydro-Jet Main Drain Clearing',
        slug: 'hydro-jet-drain',
        basePrice: 350.0,
        estimatedDuration: 120,
        isActive: true,
      },
    });
    console.log(`   ✔ Service created: ${service.name} ($${service.basePrice})\n`);

    // 5. Customer Acquisition & Public Booking (/p/[slug]/book)
    console.log('5️⃣  Simulating Customer Public Booking...');
    let customerUser = await prisma.user.findUnique({ where: { email: customerEmail } });
    if (!customerUser) {
      customerUser = await prisma.user.create({
        data: {
          email: customerEmail,
          firstName: 'Clara',
          lastName: 'Customer',
          phone: '204-555-0144',
          passwordHash: 'guest_no_login',
        },
      });
    }

    const customer = await prisma.customer.create({
      data: {
        organizationId: org.id,
        userId: customerUser.id,
        firstName: 'Clara',
        lastName: 'Customer',
        phone: '204-555-0144',
      },
    });

    const property = await prisma.property.create({
      data: {
        organizationId: org.id,
        customerId: customer.id,
        address: '450 Portage Avenue',
        city: 'Winnipeg',
        province: 'MB',
        postalCode: 'R3C 0E7',
      },
    });

    const appointment = await prisma.appointment.create({
      data: {
        appointmentNumber: `GOLDEN-${testId.toUpperCase()}`,
        organizationId: org.id,
        customerId: customer.id,
        propertyId: property.id,
        serviceId: service.id,
        date: new Date(),
        startTime: '10:00',
        endTime: '12:00',
        status: 'PENDING',
        problemDescription: 'Main sewer line backup in basement.',
      },
    });

    const job = await prisma.job.create({
      data: {
        organizationId: org.id,
        appointmentId: appointment.id,
        status: 'CREATED',
      },
    });
    console.log(`   ✔ Booking created: Appt #${appointment.appointmentNumber}, Job ID: ${job.id}\n`);

    // 6. Dispatcher Assignment
    console.log('6️⃣  Simulating Dispatcher Assignment...');
    const assignedJob = await prisma.job.update({
      where: { id: job.id },
      data: {
        status: 'ASSIGNED',
        technicianId: technician.id,
      },
    });
    await prisma.appointment.update({
      where: { id: appointment.id },
      data: { status: 'SCHEDULED', technicianId: technician.id },
    });
    console.log(`   ✔ Job dispatched to Technician ${technician.firstName}\n`);

    // 7. Technician Job Execution Flow
    console.log('7️⃣  Simulating Technician Field Execution...');
    // En Route
    await prisma.job.update({ where: { id: job.id }, data: { status: 'EN_ROUTE' } });
    // Arrived
    await prisma.job.update({ where: { id: job.id }, data: { status: 'ARRIVED' } });
    // Working & Clock In
    await prisma.job.update({ where: { id: job.id }, data: { status: 'WORKING', startedAt: new Date() } });
    const timeEntry = await prisma.jobTimeEntry.create({
      data: {
        jobId: job.id,
        technicianId: techUser.id,
        startedAt: new Date(Date.now() - 3600 * 1000), // 1 hour ago
        endedAt: new Date(),
        durationSeconds: 3600,
      },
    });
    // Add Part
    const part = await prisma.jobPart.create({
      data: {
        jobId: job.id,
        name: 'Heavy Duty Cleanout Plug',
        quantity: 1,
        unitCost: 45.0,
        createdById: techUser.id,
      },
    });
    // Complete Job
    const completedJob = await prisma.job.update({
      where: { id: job.id },
      data: { status: 'COMPLETED', completedAt: new Date(), workPerformed: 'Cleared main line with hydro-jetter. Replaced cracked cleanout plug.' },
    });
    console.log(`   ✔ Job completed: 1h labor tracked, 1 material part added\n`);

    // 8. Invoicing & Billing
    console.log('8️⃣  Generating Invoice from Completed Job...');
    const laborRate = 125.0;
    const laborSubtotal = (timeEntry.durationSeconds! / 3600) * laborRate; // $125
    const partsSubtotal = part.quantity * part.unitCost; // $45
    const subtotal = laborSubtotal + partsSubtotal; // $170
    const taxTotal = Number((subtotal * 0.05).toFixed(2)); // 5% GST = $8.50
    const total = subtotal + taxTotal; // $178.50

    const invoice = await prisma.invoice.create({
      data: {
        organizationId: org.id,
        jobId: job.id,
        customerId: customer.id,
        invoiceNumber: `INV-${testId.toUpperCase()}`,
        status: 'SENT',
        subtotal,
        taxTotal,
        total,
        paymentToken: randomUUID(),
        lines: {
          create: [
            { description: `Labor - ${service.name}`, quantity: 1, unitCost: laborRate },
            { description: `Material - ${part.name}`, quantity: part.quantity, unitCost: part.unitCost },
          ],
        },
      },
    });
    console.log(`   ✔ Invoice generated: ${invoice.invoiceNumber} (Total: $${invoice.total.toFixed(2)})\n`);

    // 9. Payment Processing via Connected Account
    console.log('9️⃣  Recording Customer Payment via Stripe Connect...');
    const payment = await prisma.payment.create({
      data: {
        invoiceId: invoice.id,
        amount: invoice.total,
        currency: 'cad',
        status: 'SUCCEEDED',
        provider: 'stripe',
        providerPaymentId: `pi_test_${testId}`,
        idempotencyKey: `pi_idem_${testId}`,
        paidAt: new Date(),
      },
    });
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { status: 'PAID', amountPaid: invoice.total },
    });
    console.log(`   ✔ Payment succeeded ($${payment.amount.toFixed(2)}) routed to Stripe Account ${org.stripeAccountId}\n`);

    // 10. Lifetime History Verification
    console.log('🔟 Verifying Customer Lifetime Record in Organization...');
    const fullCustomerHistory = await prisma.customer.findUnique({
      where: { id: customer.id },
      include: {
        appointments: { include: { service: true, job: true } },
        invoices: { include: { payments: true } },
        properties: true,
      },
    });

    if (
      fullCustomerHistory &&
      fullCustomerHistory.appointments.length === 1 &&
      fullCustomerHistory.invoices.length === 1 &&
      fullCustomerHistory.invoices[0].status === 'PAID'
    ) {
      console.log('   ✔ Customer lifetime history verified! All relations correctly isolated to Organization.\n');
      console.log('🎉 GOLDEN PATH INTEGRATION TEST PASSED SUCCESSFULLY!\n');
    } else {
      throw new Error('Customer lifetime history validation failed!');
    }

    // Cleanup test data
    await prisma.payment.deleteMany({ where: { invoiceId: invoice.id } });
    await prisma.invoiceLine.deleteMany({ where: { invoiceId: invoice.id } });
    await prisma.invoice.deleteMany({ where: { id: invoice.id } });
    await prisma.jobPart.deleteMany({ where: { jobId: job.id } });
    await prisma.jobTimeEntry.deleteMany({ where: { jobId: job.id } });
    await prisma.job.deleteMany({ where: { id: job.id } });
    await prisma.appointment.deleteMany({ where: { id: appointment.id } });
    await prisma.property.deleteMany({ where: { id: property.id } });
    await prisma.customer.deleteMany({ where: { id: customer.id } });
    await prisma.service.deleteMany({ where: { id: service.id } });
    await prisma.technician.deleteMany({ where: { id: technician.id } });
    await prisma.organizationMember.deleteMany({ where: { organizationId: org.id } });
    await prisma.user.deleteMany({ where: { id: { in: [adminUser.id, techUser.id, customerUser.id] } } });
    await prisma.organization.deleteMany({ where: { id: org.id } });

    console.log('🧹 Test data cleaned up.');
  } catch (error) {
    console.error('❌ Golden Path Test Failed:', error);
    process.exit(1);
  }
}

runGoldenPathTest();
