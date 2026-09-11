import { prisma } from '../src/lib/db';
import { randomUUID } from 'crypto';

async function testWorkerExecution() {
  console.log('--- TESTING LIVE OUTBOX WORKER PROCESSING ---');
  
  // 1. Fetch default organization
  const org = await prisma.organization.findFirst();
  if (!org) throw new Error('No organization found');

  // 2. Create test outbox event
  const testEventId = randomUUID();
  const event = await prisma.event.create({
    data: {
      organizationId: org.id,
      type: 'payment.succeeded',
      entityType: 'Payment',
      entityId: testEventId,
      data: JSON.stringify({ amount: 199.00, customerId: 'live-test', note: 'Live Worker Pipeline Verification' }),
      status: 'PENDING',
    }
  });
  console.log(`Created live outbox event in Neon DB: ${event.id} (Status: ${event.status})`);

  // 3. Query HTTP health endpoint
  try {
    const res = await fetch('http://localhost:8085/health');
    const health = await res.json();
    console.log('Worker Health Probe Output (http://localhost:8085/health):', JSON.stringify(health, null, 2));
  } catch (err: any) {
    console.log('Health check note (worker standalone):', err.message);
  }

  // 4. Poll database until event is processed by outbox worker
  console.log('Waiting for worker to process outbox event...');
  let processed = false;
  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const current = await prisma.event.findUnique({ where: { id: event.id } });
    if (current && (current.status === 'COMPLETED' || current.status === 'PROCESSING')) {
      console.log(`✓ Event ${event.id} successfully claimed/processed: Status = ${current.status}, ProcessedAt = ${current.processedAt}`);
      processed = true;
      break;
    }
  }

  if (!processed) {
    const finalCheck = await prisma.event.findUnique({ where: { id: event.id } });
    console.log(`Event state: ${finalCheck?.status}`);
  }
}

testWorkerExecution()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
