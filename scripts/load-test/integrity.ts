import { prisma } from '../../src/lib/db';
import { LoadTestConfig } from './config';
import { TestRegistry } from './registry';
import { MetricsCollector } from './metrics';

export interface IntegrityReport {
  orphanRecordsCount: number;
  fkMismatchesCount: number;
  plaintextPasswordsCount: number;
  unhashedResetTokensCount: number;
  matrixPassed: boolean;
  isolationMatrix: Record<string, Record<string, boolean>>; // orgA -> orgB -> blocked
}

export class DatabaseIntegrityScanner {
  constructor(
    private config: LoadTestConfig,
    private registry: TestRegistry,
    private metrics: MetricsCollector
  ) {}

  public async runFullScan(): Promise<IntegrityReport> {
    console.log('[Integrity] Scanning database for orphan records, cross-tenant foreign key misalignments, and credential security...');

    let orphanCount = 0;
    let fkMismatchesCount = 0;
    let plaintextPasswordsCount = 0;
    let unhashedResetTokensCount = 0;

    const companies = this.registry.getAllCompanies();
    const orgIds = companies.map((c) => c.organizationId);

    // 1. Scan for Orphaned Customers & Properties
    const existingOrgs = await prisma.organization.findMany({
      where: { id: { in: orgIds } },
      select: { id: true },
    });
    const validOrgIdSet = new Set(existingOrgs.map((o) => o.id));

    const testCustomers = await prisma.customer.findMany({
      where: { organizationId: { in: orgIds } },
      select: { id: true, organizationId: true },
    });
    for (const cust of testCustomers) {
      if (!validOrgIdSet.has(cust.organizationId)) {
        orphanCount += 1;
      }
    }

    const testProperties = await prisma.property.findMany({
      where: { organizationId: { in: orgIds } },
      select: { id: true, organizationId: true },
    });
    for (const prop of testProperties) {
      if (!validOrgIdSet.has(prop.organizationId)) {
        orphanCount += 1;
      }
    }

    // 2. Cross-Tenant Foreign Key Alignment in Jobs
    const jobs = await prisma.job.findMany({
      where: { organizationId: { in: orgIds } },
      include: {
        appointment: {
          select: {
            organizationId: true,
            customer: { select: { organizationId: true } },
          },
        },
      },
    });

    for (const job of jobs) {
      if (job.appointment) {
        if (job.appointment.organizationId !== job.organizationId) {
          fkMismatchesCount += 1;
          console.error(`[FK Mismatch] Job ${job.id} org ${job.organizationId} != Appointment org ${job.appointment.organizationId}`);
        }
        if (job.appointment.customer && job.appointment.customer.organizationId !== job.organizationId) {
          fkMismatchesCount += 1;
          console.error(`[FK Mismatch] Job ${job.id} org ${job.organizationId} != Customer org ${job.appointment.customer.organizationId}`);
        }
      }
    }

    // 3. Cross-Tenant Foreign Key Alignment in Invoices
    const invoices = await prisma.invoice.findMany({
      where: { organizationId: { in: orgIds } },
      include: {
        job: { select: { organizationId: true } },
        customer: { select: { organizationId: true } },
      },
    });

    for (const inv of invoices) {
      if (inv.job && inv.job.organizationId !== inv.organizationId) {
        fkMismatchesCount += 1;
        console.error(`[FK Mismatch] Invoice ${inv.id} org ${inv.organizationId} != Job org ${inv.job.organizationId}`);
      }
      if (inv.customer && inv.customer.organizationId !== inv.organizationId) {
        fkMismatchesCount += 1;
        console.error(`[FK Mismatch] Invoice ${inv.id} org ${inv.organizationId} != Customer org ${inv.customer.organizationId}`);
      }
    }

    // 4. Credential Security Check (Zero Plaintext)
    const users = await prisma.user.findMany({
      where: { email: { contains: this.config.prefix } },
      select: { id: true, email: true, passwordHash: true },
    });

    for (const u of users) {
      if (u.passwordHash) {
        // Bcrypt hashes begin with $2a$ or $2b$ and are 60 chars
        const isBcrypt = u.passwordHash.startsWith('$2a$') || u.passwordHash.startsWith('$2b$');
        if (!isBcrypt) {
          plaintextPasswordsCount += 1;
          console.error(`[Security Violation] User ${u.email} has non-bcrypt passwordHash: ${u.passwordHash}`);
        }
      }
    }

    // 5. Reset Token Hash Check
    const resetTokens = await prisma.passwordResetToken.findMany({
      where: { organizationId: { in: orgIds } },
      select: { id: true, tokenHash: true },
    });

    for (const t of resetTokens) {
      if (!t.tokenHash || t.tokenHash.length !== 64) {
        unhashedResetTokensCount += 1;
        console.error(`[Security Violation] ResetToken ${t.id} has invalid tokenHash length`);
      }
    }

    // 6. Tenant Isolation Matrix Scan
    const isolationMatrix: Record<string, Record<string, boolean>> = {};
    let matrixPassed = true;

    for (const compA of companies) {
      isolationMatrix[compA.slug] = {};
      for (const compB of companies) {
        if (compA.organizationId === compB.organizationId) {
          isolationMatrix[compA.slug][compB.slug] = true; // Own tenant is authorized
          continue;
        }

        // Check if any customer of A has records in B
        const leaks = await prisma.customer.count({
          where: {
            organizationId: compB.organizationId,
            id: { in: compA.customers.map((c) => c.customerId) },
          },
        });

        const isIsolated = leaks === 0;
        isolationMatrix[compA.slug][compB.slug] = isIsolated;
        if (!isIsolated) {
          matrixPassed = false;
          this.metrics.crossTenantLeaks += leaks;
        }
      }
    }

    const totalViolations = orphanCount + fkMismatchesCount + plaintextPasswordsCount + unhashedResetTokensCount;
    this.metrics.integrityViolations += totalViolations;

    return {
      orphanRecordsCount: orphanCount,
      fkMismatchesCount,
      plaintextPasswordsCount,
      unhashedResetTokensCount,
      matrixPassed,
      isolationMatrix,
    };
  }
}
