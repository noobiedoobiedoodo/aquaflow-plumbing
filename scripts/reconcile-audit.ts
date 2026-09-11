import { prisma } from '../src/lib/db';

async function main() {
  console.log('--- RECONCILIATION AUDIT ---');
  const orgs = await prisma.organization.findMany({
    select: { id: true, name: true, slug: true, email: true, isActive: true, createdAt: true }
  });
  console.log('Orgs in Neon DB:', JSON.stringify(orgs, null, 2));

  const totalUsers = await prisma.user.count();
  const totalCustomers = await prisma.customer.count();
  const totalInvoices = await prisma.invoice.count();
  const totalPayments = await prisma.payment.count();
  const totalEvents = await prisma.event.count();

  console.log({
    totalUsers,
    totalCustomers,
    totalInvoices,
    totalPayments,
    totalEvents
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
