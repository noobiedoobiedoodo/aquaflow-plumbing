import { prisma } from '../db';

async function main() {
  console.log('--- Testing Job Lifecycle & Invoicing ---');

  // 1. Find an unassigned job
  const job = await prisma.job.findFirst({
    where: { status: 'CREATED', technicianId: null },
    include: { appointment: { include: { service: true } } }
  });

  if (!job) {
    console.log('No unassigned jobs found.');
    return;
  }
  console.log(`Found Job: ${job.id} (Service: ${job.appointment.service.name})`);

  // 2. Find a technician
  const tech = await prisma.technician.findFirst({ where: { isActive: true } });
  if (!tech) {
    console.log('No active technicians found.');
    return;
  }
  console.log(`Found Technician: ${tech.firstName} ${tech.lastName}`);

  // 3. Assign Job (Dispatcher Action)
  await prisma.job.update({
    where: { id: job.id },
    data: { technicianId: tech.id }
  });
  console.log(`Job assigned to ${tech.firstName}`);

  // 4. Progress Statuses (Technician Action)
  const statuses: any[] = ['EN_ROUTE', 'ARRIVED', 'WORKING', 'COMPLETED'];
  for (const status of statuses) {
    await prisma.job.update({
      where: { id: job.id },
      data: { status }
    });
    console.log(`Job status updated to: ${status}`);
  }

  // 4.5. Emit Completion Event
  await prisma.event.create({
    data: {
      organizationId: job.organizationId,
      type: 'job.completed',
      entityType: 'Job',
      entityId: job.id,
      data: JSON.stringify({ technicianId: tech.id })
    }
  });
  console.log(`Job completed event emitted to Outbox... Waiting 5 seconds for worker...`);
  await new Promise(r => setTimeout(r, 5000));

  // 5. Check if Invoice was generated
  const invoice = await prisma.invoice.findFirst({
    where: { jobId: job.id },
    include: { lines: true }
  });

  if (invoice) {
    console.log('SUCCESS: Invoice was automatically generated!');
    console.log(`Invoice ID: ${invoice.id}`);
    console.log(`Total: $${invoice.total}`);
    console.log(`Status: ${invoice.status}`);
    console.log('Line Items:');
    invoice.lines.forEach((l: any) => console.log(` - ${l.description}: $${l.unitCost * l.quantity}`));
  } else {
    console.log('FAILURE: No invoice was found for this completed job. The automation might not be wired up.');
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
