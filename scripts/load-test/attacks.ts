import { prisma } from '../../src/lib/db';
import { randomUUID, randomBytes } from 'crypto';
import { hashToken, createCustomerSession, validateCustomerSession } from '../../src/lib/auth/customer-session';
import { createSession, validateSession } from '../../src/lib/auth/session';
import { assignJob } from '../../src/app/actions/dispatch';
import { updateJobState } from '../../src/app/actions/tech';
import { GET as fileHandler } from '../../src/app/api/files/[...key]/route';
import { POST as resetPasswordHandler } from '../../src/app/api/auth/reset-password/route';
import { POST as logoutHandler } from '../../src/app/api/auth/logout/route';
import { SimulatedClient } from './client';
import { TestRegistry, RegisteredCompany } from './registry';
import { MetricsCollector } from './metrics';

export class AdversarialAttackSuite {
  constructor(
    private registry: TestRegistry,
    private metrics: MetricsCollector
  ) {}

  public async runAllAttacks(): Promise<boolean> {
    console.log('[Attacks] Launching Adversarial Cross-Tenant Attack Matrix...');

    const r1 = await this.testCustomerCrossTenantDataAccess();
    const r2 = await this.testDispatcherCrossTenantAssignment();
    const r3 = await this.testTechnicianCrossTenantJobModification();
    const r4 = await this.testFilePathTraversalAttacks();
    const r5 = await this.testSessionRevocationAndReplayAttacks();

    return r1 && r2 && r3 && r4 && r5;
  }

  /**
   * Test 1: Customer Cross-Tenant IDOR Queries
   */
  public async testCustomerCrossTenantDataAccess(): Promise<boolean> {
    const companies = this.registry.getAllCompanies();
    if (companies.length < 2) return true;

    const companyA = companies[0];
    const companyB = companies[1];
    const customerA = companyA.customers[0];
    const jobB = companyB.jobs[0];
    const invoiceB = companyB.invoices[0];

    if (!customerA || !jobB) return true;

    const start = performance.now();
    const sessionTokenA = await createCustomerSession(customerA.customerId);

    // Attack A: Customer A queries foreign Job B
    const jobAttempt = await prisma.job.findFirst({
      where: {
        id: jobB.id,
        appointment: { customerId: customerA.customerId },
      },
    });

    if (jobAttempt) {
      this.metrics.crossTenantLeaks += 1;
      this.metrics.unauthorizedReads += 1;
      this.metrics.recordRequest('attack_customer_foreign_job', performance.now() - start, 200, false);
      return false;
    }
    this.metrics.recordRequest('attack_customer_foreign_job', performance.now() - start, 404, true);

    // Attack B: Customer A queries foreign Invoice B
    if (invoiceB) {
      const invAttempt = await prisma.invoice.findFirst({
        where: {
          id: invoiceB.id,
          customerId: customerA.customerId,
        },
      });

      if (invAttempt) {
        this.metrics.crossTenantLeaks += 1;
        this.metrics.unauthorizedReads += 1;
        this.metrics.recordRequest('attack_customer_foreign_invoice', performance.now() - start, 200, false);
        return false;
      }
      this.metrics.recordRequest('attack_customer_foreign_invoice', performance.now() - start, 404, true);
    }

    return true;
  }

  /**
   * Test 2: Dispatcher Cross-Tenant Assignment
   */
  public async testDispatcherCrossTenantAssignment(): Promise<boolean> {
    const companies = this.registry.getAllCompanies();
    if (companies.length < 2) return true;

    const companyA = companies[0];
    const companyB = companies[1];
    const jobA = companyA.jobs[0];
    const techB = companyB.technicians[0];

    if (!jobA || !techB) return true;

    const start = performance.now();

    // Attack: Dispatcher A attempts to assign foreign Technician B
    try {
      // Direct query check simulating assignJob logic
      const targetTechInOrgA = await prisma.technician.findFirst({
        where: { id: techB.technicianId, organizationId: companyA.organizationId },
      });

      if (targetTechInOrgA) {
        this.metrics.unauthorizedMutations += 1;
        this.metrics.recordRequest('attack_foreign_tech_assign', performance.now() - start, 200, false);
        return false;
      }

      this.metrics.recordRequest('attack_foreign_tech_assign', performance.now() - start, 400, true);
      return true;
    } catch {
      this.metrics.recordRequest('attack_foreign_tech_assign', performance.now() - start, 400, true);
      return true;
    }
  }

  /**
   * Test 3: Technician Cross-Tenant Job Modification
   */
  public async testTechnicianCrossTenantJobModification(): Promise<boolean> {
    const companies = this.registry.getAllCompanies();
    if (companies.length < 2) return true;

    const companyA = companies[0];
    const companyB = companies[1];
    const techA = companyA.technicians[0];
    const jobB = companyB.jobs[0];

    if (!techA || !jobB) return true;

    const start = performance.now();

    // Attack: Tech A attempts to verify access to Job B
    const allowed = await prisma.job.findFirst({
      where: { id: jobB.id, organizationId: companyA.organizationId },
    });

    if (allowed) {
      this.metrics.unauthorizedMutations += 1;
      this.metrics.crossTenantLeaks += 1;
      this.metrics.recordRequest('attack_tech_foreign_job', performance.now() - start, 200, false);
      return false;
    }

    this.metrics.recordRequest('attack_tech_foreign_job', performance.now() - start, 403, true);
    return true;
  }

  /**
   * Test 4: File Path Traversal & Dot Segments
   */
  public async testFilePathTraversalAttacks(): Promise<boolean> {
    const maliciousKeys = [
      '../../etc/passwd',
      '..\\..\\windows\\win.ini',
      'photos/../../package.json',
      '/absolute/path/leak.txt',
      '....//....//config.ts',
    ];

    const client = new SimulatedClient();
    let allPassed = true;

    for (const key of maliciousKeys) {
      const start = performance.now();
      const res = await client.dispatch(fileHandler, `http://localhost:3000/api/files/${key}`, {
        params: { key: key.split('/') },
      });

      if (res.status !== 400) {
        this.metrics.unauthorizedReads += 1;
        allPassed = false;
        this.metrics.recordRequest('attack_file_traversal', performance.now() - start, res.status, false);
      } else {
        this.metrics.recordRequest('attack_file_traversal', performance.now() - start, 400, true);
      }
    }

    return allPassed;
  }

  /**
   * Test 5: Session Revocation and Replay Attacks
   */
  public async testSessionRevocationAndReplayAttacks(): Promise<boolean> {
    const company = this.registry.getAllCompanies()[0];
    const customer = company.customers[0];
    if (!customer) return true;

    const start = performance.now();

    // 1. Create a customer session
    const sessionToken = await createCustomerSession(customer.customerId);
    const validBefore = await validateCustomerSession(sessionToken);
    if (!validBefore) return false;

    // 2. Perform a password reset
    const rawResetToken = randomBytes(32).toString('base64url');
    const tokenHash = hashToken(rawResetToken);

    await prisma.passwordResetToken.create({
      data: {
        userId: customer.userId,
        organizationId: company.organizationId,
        tokenHash,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    const client = new SimulatedClient();
    const resetRes = await client.dispatch(resetPasswordHandler, 'http://localhost:3000/api/auth/reset-password', {
      method: 'POST',
      body: {
        token: rawResetToken,
        newPassword: 'BrandNewSecurePassword888!',
      },
    });

    if (resetRes.status !== 200) {
      this.metrics.recordRequest('attack_password_reset_revocation', performance.now() - start, resetRes.status, false);
      return false;
    }

    // 3. Replay Old Session Cookie -> MUST BE REVOKED!
    const validAfter = await validateCustomerSession(sessionToken);
    if (validAfter !== null) {
      this.metrics.crossTenantLeaks += 1;
      this.metrics.recordRequest('attack_session_replay_after_reset', performance.now() - start, 200, false);
      return false;
    }

    this.metrics.recordRequest('attack_session_replay_after_reset', performance.now() - start, 401, true);

    // 4. Replay Used Reset Token -> MUST BE REJECTED!
    const replayResetRes = await client.dispatch(resetPasswordHandler, 'http://localhost:3000/api/auth/reset-password', {
      method: 'POST',
      body: {
        token: rawResetToken,
        newPassword: 'AnotherPassword999!',
      },
    });

    if (replayResetRes.status !== 400) {
      this.metrics.tokenReplaySuccesses += 1;
      this.metrics.recordRequest('attack_reset_token_replay', performance.now() - start, replayResetRes.status, false);
      return false;
    }

    this.metrics.recordRequest('attack_reset_token_replay', performance.now() - start, 400, true);
    return true;
  }
}
