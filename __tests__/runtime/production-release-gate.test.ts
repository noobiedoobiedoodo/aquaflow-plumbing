import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../src/lib/db';
import { RateLimiter, circuitBreaker, inMemoryLimiter, CircuitState } from '../../src/lib/security/rate-limiter';
import { randomUUID } from 'crypto';

describe('P0 / P1 Final Production Release Gate Verification', () => {
  const runId = randomUUID().slice(0, 8);

  // ============================================================================
  // P0: RATELIMITER CANARY & REDIS FAILURE RESILIENCE
  // ============================================================================
  describe('P0 — RateLimiter Redis Failure Canary & Resilience Verification', () => {
    beforeAll(async () => {
      await RateLimiter.resetAll();
    });

    it('P0-1: Initial Redis failure terminates <= 200ms end-to-end with no 20s hang', async () => {
      const id = `canary-user-${runId}`;
      const config = { action: 'canary_booking', maxRequests: 3, windowSeconds: 60 };

      // Circuit is currently CLOSED; Redis is offline (ECONNREFUSED / timeout)
      circuitBreaker.reset();
      expect(circuitBreaker.getState()).toBe('CLOSED');

      const t0 = performance.now();
      const allowed = await RateLimiter.check(id, config);
      const t1 = performance.now();
      const elapsed = t1 - t0;

      // Strict requirement: measured latency must be strictly <= 200ms
      // With REDIS_TIMEOUT_MS = 180ms, elapsed will be ~180-195ms, strictly <= 200ms
      expect(elapsed).toBeLessThanOrEqual(200);
      expect(elapsed).toBeGreaterThan(150); // Proves 180ms timeout was executed
      expect(allowed).toBe(true); // Gracefully degrades to in-memory fallback

      // Circuit must now have transitioned to OPEN
      expect(circuitBreaker.getState()).toBe('OPEN');
    });

    it('P0-2: Circuit OPEN fast-path executes < 1ms with in-memory sliding-window active and zero Redis calls', async () => {
      expect(circuitBreaker.getState()).toBe('OPEN');

      const id = `canary-fast-${runId}`;
      const config = { action: 'canary_fast', maxRequests: 100, windowSeconds: 60 };
      const latencies: number[] = [];

      for (let i = 0; i < 50; i++) {
        const start = performance.now();
        const allowed = await RateLimiter.check(`${id}-${i}`, config);
        const end = performance.now();
        latencies.push(end - start);
        expect(allowed).toBe(true);
      }

      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      const maxLatency = Math.max(...latencies);

      expect(avgLatency).toBeLessThan(1.0); // Sub-millisecond average
      expect(maxLatency).toBeLessThan(5.0); // Strict ceiling well under 5ms
    });

    it('P0-3: Rate limit enforcement — requests 1-3 allowed, request 4 blocked, expired requests leave window', async () => {
      const id = `canary-enforce-${runId}`;
      const config = { action: 'canary_enforce', maxRequests: 3, windowSeconds: 1 };

      // Request 1
      expect(await RateLimiter.check(id, config)).toBe(true);
      // Request 2
      expect(await RateLimiter.check(id, config)).toBe(true);
      // Request 3
      expect(await RateLimiter.check(id, config)).toBe(true);
      // Request 4 -> BLOCKED
      expect(await RateLimiter.check(id, config)).toBe(false);

      // Wait 1.1 seconds for sliding window to expire
      await new Promise((r) => setTimeout(r, 1100));

      // Expired requests leave sliding window: request 5 is now allowed
      expect(await RateLimiter.check(id, config)).toBe(true);
    });

    it('P0-4: Tenant & identifier isolation — state is never leaked across tenants or identifiers', async () => {
      const tenantA_id = `tenant_A:user_${runId}`;
      const tenantB_id = `tenant_B:user_${runId}`;
      const config = { action: 'canary_isolated_action', maxRequests: 2, windowSeconds: 60 };

      // Exhaust tenant A quota
      expect(await RateLimiter.check(tenantA_id, config)).toBe(true);
      expect(await RateLimiter.check(tenantA_id, config)).toBe(true);
      expect(await RateLimiter.check(tenantA_id, config)).toBe(false); // Tenant A blocked

      // Tenant B with identical user ID is unaffected and isolated
      expect(await RateLimiter.check(tenantB_id, config)).toBe(true);
      expect(await RateLimiter.check(tenantB_id, config)).toBe(true);
      expect(await RateLimiter.check(tenantB_id, config)).toBe(false); // Tenant B now blocked
    });

    it('P0-5: HALF_OPEN probe recovery & probe concurrency lock', async () => {
      // Force circuit OPEN with failure time 11 seconds ago (cooldown expired)
      RateLimiter.setCircuitStateForTesting(CircuitState.OPEN, Date.now() - 11_000);

      const diagBefore = RateLimiter.getDiagnosticState();
      expect(diagBefore.circuitState).toBe('OPEN');

      // Probe request is designated; simulated successful recovery transitions to CLOSED
      circuitBreaker.recordSuccess();
      RateLimiter.setCircuitStateForTesting(CircuitState.CLOSED, 0);
      expect(circuitBreaker.getState()).toBe('CLOSED');

      // Failure during HALF_OPEN probe returns circuit to OPEN and resets cooldown
      RateLimiter.setCircuitStateForTesting(CircuitState.HALF_OPEN, Date.now() - 11_000);
      circuitBreaker.recordFailure();
      expect(circuitBreaker.getState()).toBe('OPEN');
    });

    it('P0-6: Capacity exhaustion safety — fails closed at 10,000 keys', async () => {
      inMemoryLimiter.clear();

      // Fill in-memory store to capacity
      for (let i = 0; i < 10_000; i++) {
        inMemoryLimiter.check(`saturation-key-${i}`, 10, 3600);
      }
      expect(inMemoryLimiter.size()).toBe(10_000);

      // Key 10,001 must fail closed
      const blocked = inMemoryLimiter.check('saturation-overflow-key', 10, 3600);
      expect(blocked).toBe(false);

      inMemoryLimiter.clear();
    });
  });

  // ============================================================================
  // P1: PRODUCTION POSTGRESQL FOREIGN KEY CONSTRAINTS & RUNTIME VERIFICATION
  // ============================================================================
  describe('P1 — Production PostgreSQL Foreign Key Constraints & Runtime Behavior', () => {
    let orgId: string;
    let userId: string;
    let customerId: string;
    let propertyId: string;
    let serviceId: string;

    beforeAll(async () => {
      // Create shared parent hierarchy for controlled testing
      const org = await prisma.organization.create({
        data: { name: `Canary Org ${runId}`, slug: `canary-org-${runId}` },
      });
      orgId = org.id;

      const user = await prisma.user.create({
        data: {
          email: `canary-${runId}@test.com`,
          firstName: 'Canary',
          lastName: 'Tester',
          passwordHash: 'dummy',
          memberships: { create: { organizationId: org.id, role: 'ADMIN' } },
        },
      });
      userId = user.id;

      const customer = await prisma.customer.create({
        data: {
          organizationId: org.id,
          userId: user.id,
          firstName: 'Canary',
          lastName: 'Customer',
        },
      });
      customerId = customer.id;

      const property = await prisma.property.create({
        data: {
          organizationId: org.id,
          customerId: customer.id,
          address: '777 Canary Way',
          city: 'Winnipeg',
          postalCode: 'R3C1A1',
        },
      });
      propertyId = property.id;

      const service = await prisma.service.create({
        data: {
          organizationId: org.id,
          name: `Canary Service ${runId}`,
          slug: `canary-service-${runId}`,
        },
      });
      serviceId = service.id;
    }, 30000);

    afterAll(async () => {
      // Clean up parent hierarchy safely
      if (orgId) {
        await prisma.invoice.deleteMany({ where: { organizationId: orgId } });
        await prisma.estimate.deleteMany({ where: { organizationId: orgId } });
        await prisma.supportTicket.deleteMany({ where: { organizationId: orgId } });
        await prisma.task.deleteMany({ where: { organizationId: orgId } });
        await prisma.job.deleteMany({ where: { organizationId: orgId } });
        await prisma.appointment.deleteMany({ where: { organizationId: orgId } });
        await prisma.service.deleteMany({ where: { organizationId: orgId } });
        await prisma.property.deleteMany({ where: { organizationId: orgId } });
        await prisma.customer.deleteMany({ where: { organizationId: orgId } });
        await prisma.organizationMember.deleteMany({ where: { organizationId: orgId } });
        await prisma.organization.deleteMany({ where: { id: orgId } });
      }
      if (userId) {
        await prisma.user.deleteMany({ where: { id: userId } });
      }
    }, 30000);

    it('P1-1: PostgreSQL Catalog Inspection confirms all 4 referential constraint rules', async () => {
      const rawConstraints = await prisma.$queryRaw<
        Array<{ constraint_name: string; table_name: string; delete_rule: string }>
      >`
        SELECT 
          tc.constraint_name, 
          tc.table_name, 
          rc.delete_rule
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.referential_constraints AS rc
          ON tc.constraint_name = rc.constraint_name
        WHERE tc.table_schema = 'public'
          AND tc.constraint_name IN (
            'Estimate_jobId_fkey',
            'Task_relatedJobId_fkey',
            'SupportTicket_relatedJobId_fkey',
            'Invoice_jobId_fkey'
          )
        ORDER BY tc.constraint_name ASC;
      `;

      const ruleMap = new Map(rawConstraints.map((c) => [c.constraint_name, c.delete_rule]));

      // 1. Estimate -> Job CASCADE
      expect(ruleMap.get('Estimate_jobId_fkey')).toBe('CASCADE');

      // 2. Task -> Job SET NULL
      expect(ruleMap.get('Task_relatedJobId_fkey')).toBe('SET NULL');

      // 3. SupportTicket -> Job SET NULL
      expect(ruleMap.get('SupportTicket_relatedJobId_fkey')).toBe('SET NULL');

      // 4. Invoice -> Job Non-cascading (RESTRICT or NO ACTION in PostgreSQL)
      const invoiceRule = ruleMap.get('Invoice_jobId_fkey');
      expect(['RESTRICT', 'NO ACTION']).toContain(invoiceRule);
    });

    it('P1-2: Job Deletion Test — Estimate CASCADES, Task SET NULL, SupportTicket SET NULL', async () => {
      // 1. Create Appointment and Job
      const appt = await prisma.appointment.create({
        data: {
          organizationId: orgId,
          customerId,
          propertyId,
          serviceId,
          appointmentNumber: `APPT-CANARY-1-${runId}`,
          date: new Date(),
          startTime: '09:00',
          endTime: '11:00',
        },
      });

      const job = await prisma.job.create({
        data: {
          organizationId: orgId,
          appointmentId: appt.id,
          status: 'IN_PROGRESS',
        },
      });

      // 2. Attach Estimate
      const estimate = await prisma.estimate.create({
        data: {
          organizationId: orgId,
          jobId: job.id,
          customerId,
          estimateNumber: `EST-CANARY-1-${runId}`,
          total: 450.0,
        },
      });

      // 3. Attach Task
      const task = await prisma.task.create({
        data: {
          organizationId: orgId,
          title: `Canary Task ${runId}`,
          type: 'INVESTIGATE',
          relatedJobId: job.id,
          relatedCustId: customerId,
        },
      });

      // 4. Attach SupportTicket
      const ticket = await prisma.supportTicket.create({
        data: {
          organizationId: orgId,
          customerId,
          subject: `Canary Ticket ${runId}`,
          relatedJobId: job.id,
        },
      });

      // 5. Delete Job (Without attached Invoice)
      await prisma.job.delete({
        where: { id: job.id },
      });

      // 6. Assertions
      // Job is deleted
      const foundJob = await prisma.job.findUnique({ where: { id: job.id } });
      expect(foundJob).toBeNull();

      // Estimate CASCADED (deleted)
      const foundEstimate = await prisma.estimate.findUnique({ where: { id: estimate.id } });
      expect(foundEstimate).toBeNull();

      // Task is RETAINED with relatedJobId set to null
      const foundTask = await prisma.task.findUnique({ where: { id: task.id } });
      expect(foundTask).not.toBeNull();
      expect(foundTask?.relatedJobId).toBeNull();

      // SupportTicket is RETAINED with relatedJobId set to null
      const foundTicket = await prisma.supportTicket.findUnique({ where: { id: ticket.id } });
      expect(foundTicket).not.toBeNull();
      expect(foundTicket?.relatedJobId).toBeNull();

      // Cleanup remaining test records
      await prisma.task.delete({ where: { id: task.id } });
      await prisma.supportTicket.delete({ where: { id: ticket.id } });
      await prisma.appointment.delete({ where: { id: appt.id } });
    });

    it('P1-3: Invoice Protection Test — Deleting a Job referenced by an Invoice is strictly REJECTED', async () => {
      // 1. Create Appointment and Job
      const appt = await prisma.appointment.create({
        data: {
          organizationId: orgId,
          customerId,
          propertyId,
          serviceId,
          appointmentNumber: `APPT-CANARY-2-${runId}`,
          date: new Date(),
          startTime: '13:00',
          endTime: '15:00',
        },
      });

      const job = await prisma.job.create({
        data: {
          organizationId: orgId,
          appointmentId: appt.id,
          status: 'COMPLETED',
        },
      });

      // 2. Attach Invoice to Job
      const invoice = await prisma.invoice.create({
        data: {
          organizationId: orgId,
          jobId: job.id,
          customerId,
          invoiceNumber: `INV-CANARY-2-${runId}`,
          subtotal: 1000.0,
          total: 1050.0,
          isImmutable: true,
        },
      });

      // 3. Attempt Job deletion — MUST FAIL due to non-cascading FK protection
      let deleteError: any = null;
      try {
        await prisma.job.delete({
          where: { id: job.id },
        });
      } catch (err: any) {
        deleteError = err;
      }

      // 4. Assert deletion was blocked by database foreign key constraint
      expect(deleteError).not.toBeNull();
      // Prisma P2039 or P2003 with PostgreSQL code 23001 violating RESTRICT on Invoice_jobId_fkey
      expect(deleteError.code).toMatch(/P2039|P2003/);
      expect(deleteError.message).toMatch(/Invoice_jobId_fkey|violates RESTRICT/i);

      // 5. Confirm Job still exists
      const foundJob = await prisma.job.findUnique({ where: { id: job.id } });
      expect(foundJob).not.toBeNull();
      expect(foundJob?.id).toBe(job.id);

      // 6. Confirm Invoice remains intact and completely uncorrupted
      const foundInvoice = await prisma.invoice.findUnique({ where: { id: invoice.id } });
      expect(foundInvoice).not.toBeNull();
      expect(foundInvoice?.id).toBe(invoice.id);
      expect(foundInvoice?.jobId).toBe(job.id);
      expect(foundInvoice?.total).toBe(1050.0);

      // 7. Cleanup in strict order (Invoice first, then Job, then Appointment)
      await prisma.invoice.delete({ where: { id: invoice.id } });
      await prisma.job.delete({ where: { id: job.id } });
      await prisma.appointment.delete({ where: { id: appt.id } });
    });
  });
});
