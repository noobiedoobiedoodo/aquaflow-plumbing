import { loadConfiguration, LoadTestConfig } from './config';
import { TestRegistry } from './registry';
import { MetricsCollector } from './metrics';
import { SecurityCircuitBreaker } from './circuit-breaker';
import { InfrastructureHealer } from './healer';
import { seedSyntheticTenants } from './seed';
import { BusinessLifecycleScenarios } from './scenarios';
import { AdversarialAttackSuite } from './attacks';
import { RaceConditionSuite } from './races';
import { DatabaseIntegrityScanner } from './integrity';
import { cleanupSyntheticData } from './cleanup';
import { LoadTestReporter } from './reporter';
import { RateLimiter } from '../../src/lib/security/rate-limiter';
import { prisma } from '../../src/lib/db';

async function runHarness() {
  console.log(`
=============================================================================
           AQUAFLOW MULTI-TENANT PRODUCTION ACCEPTANCE HARNESS
             Phase 21: Self-Diagnosing / Self-Healing QA Layer
=============================================================================
`);

  const config = loadConfiguration();
  console.log(`[Config] Run ID:      ${config.runId}`);
  console.log(`[Config] Mode:        ${config.mode.toUpperCase()}`);
  console.log(`[Config] Companies:   ${config.companies}`);
  console.log(`[Config] Customers:   ${config.customersPerCompany}/company`);
  console.log(`[Config] Concurrency: ${config.concurrency}`);
  console.log(`[Config] Cleanup:     ${config.cleanup ? 'ENABLED' : 'DISABLED'}`);
  console.log(`[Config] Database:    ${config.databaseUrl.replace(/:[^:@]+@/, ':****@')}`);
  console.log(`=============================================================================\n`);

  const registry = new TestRegistry();
  const metrics = new MetricsCollector();
  const circuitBreaker = new SecurityCircuitBreaker(metrics.telemetry);
  const healer = new InfrastructureHealer(metrics.telemetry, config);

  metrics.start();

  try {
    // 0. Ensure Stripe webhook secret is present for test signatures and reset rate limiters
    process.env.STRIPE_WEBHOOK_SECRET =
      process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_secret_for_acceptance_harness';
    await RateLimiter.resetAll();

    // 1. Synthetic Seeding with Self-Healing Intercept
    console.log(`[Execution] Seeding ${config.companies} synthetic plumbing companies...`);
    try {
      await seedSyntheticTenants(config, registry);
    } catch (seedErr: any) {
      const classification = healer.classifyError(seedErr);
      if (classification.isAllowlisted && classification.recommendedAction) {
        metrics.infrastructureFailures += 1;
        metrics.selfHealingActions += 1;
        const healResult = await healer.executeHealingAction(
          classification.recommendedAction,
          classification.reason || 'Seed failure',
          classification.subsystem || 'SEED_STORE'
        );
        if (healResult.success) {
          metrics.selfHealingSuccesses += 1;
          await seedSyntheticTenants(config, registry);
        } else {
          metrics.selfHealingFailures += 1;
          throw seedErr;
        }
      } else {
        metrics.unknownFailures += 1;
        throw seedErr;
      }
    }

    const scenarios = new BusinessLifecycleScenarios(registry, metrics);
    const attacks = new AdversarialAttackSuite(registry, metrics);
    const races = new RaceConditionSuite(registry, metrics);
    const integrityScanner = new DatabaseIntegrityScanner(config, registry, metrics);

    // 2. Concurrent Business Lifecycle Execution
    console.log(`\n[Execution] Running Concurrent Business Lifecycle Scenarios (Concurrency: ${config.concurrency})...`);
    const companies = registry.getAllCompanies();

    for (const company of companies) {
      if (circuitBreaker.getStatus().isTripped) break;
      console.log(`  -> Processing Company Lifecycle: ${company.name} (${company.slug})...`);

      const customersToProcess = company.customers.slice(0, Math.min(20, company.customers.length));
      const BATCH_SIZE = config.concurrency;

      for (let i = 0; i < customersToProcess.length; i += BATCH_SIZE) {
        if (circuitBreaker.getStatus().isTripped) break;
        const batch = customersToProcess.slice(i, i + BATCH_SIZE);

        await Promise.all(
          batch.map(async (customer) => {
            if (circuitBreaker.getStatus().isTripped) return;

            // A. Customer Activation & Password Setup
            if (!customer.isActivated) {
              await scenarios.runCustomerActivationScenario(company, customer);
            }

            // B. Customer In-Portal Service Request
            const jobId = await scenarios.runCustomerServiceRequestScenario(company, customer);
            if (jobId) {
              // C. Dispatcher Assignment
              await scenarios.runDispatchAssignmentScenario(company, jobId);

              // D. Technician Execution
              await scenarios.runTechnicianExecutionScenario(company, jobId);

              // E. Invoice Generation
              const invoiceId = await scenarios.runInvoiceGenerationScenario(company, jobId);
              if (invoiceId) {
                // F. Payment & Stripe Webhook
                await scenarios.runPaymentWebhookScenario(company, invoiceId);
              }
            }
          })
        );
      }
    }

    // 3. Shared-Email Multi-Tenant Verification
    if (!circuitBreaker.getStatus().isTripped) {
      console.log(`\n[Execution] Verifying Shared-Email Multi-Tenant Isolation...`);
      await scenarios.runSharedEmailMultiTenantVerification();
    }

    // 4. Adversarial Cross-Tenant Attack Matrix
    if (!circuitBreaker.getStatus().isTripped) {
      console.log(`\n[Execution] Executing Adversarial Attack Matrix...`);
      await attacks.runAllAttacks();

      // Check invariant counters post-attack
      if (metrics.crossTenantLeaks > 0) {
        await circuitBreaker.trip('CROSS_TENANT_LEAK', {
          scenario: 'AdversarialAttackSuite',
          reason: `Detected ${metrics.crossTenantLeaks} cross-tenant data leaks!`,
          expectedResult: '0 leaks',
          actualResult: `${metrics.crossTenantLeaks} leaks`,
        });
      }
      if (metrics.unauthorizedMutations > 0) {
        await circuitBreaker.trip('UNAUTHORIZED_MUTATION', {
          scenario: 'AdversarialAttackSuite',
          reason: `Detected ${metrics.unauthorizedMutations} unauthorized mutations!`,
          expectedResult: '0 mutations',
          actualResult: `${metrics.unauthorizedMutations} mutations`,
        });
      }
    }

    // 5. Concurrency & Race Condition Suite
    if (!circuitBreaker.getStatus().isTripped) {
      console.log(`\n[Execution] Executing Race Condition Suite...`);
      await races.runAllRaceTests();

      if (metrics.duplicatePayments > 0) {
        await circuitBreaker.trip('DUPLICATE_PAYMENT', {
          scenario: 'RaceConditionSuite',
          reason: `Detected ${metrics.duplicatePayments} duplicate payments from concurrent webhooks!`,
          expectedResult: '0 duplicate payments',
          actualResult: `${metrics.duplicatePayments} duplicates`,
        });
      }
      if (metrics.tokenReplaySuccesses > 0) {
        await circuitBreaker.trip('SESSION_BOUNDARY_FAILURE', {
          scenario: 'RaceConditionSuite',
          reason: `Detected ${metrics.tokenReplaySuccesses} token replay successes!`,
          expectedResult: '0 token replay successes',
          actualResult: `${metrics.tokenReplaySuccesses} successes`,
        });
      }
    }

    // 6. Soak Mode (if active)
    if (config.mode === 'soak' && !circuitBreaker.getStatus().isTripped) {
      console.log(`\n[Execution] Running Soak Test for ${config.soakDurationSeconds} seconds...`);
      const soakEndTime = Date.now() + config.soakDurationSeconds * 1000;
      while (Date.now() < soakEndTime) {
        if (circuitBreaker.getStatus().isTripped) break;
        const randomComp = companies[Math.floor(Math.random() * companies.length)];
        const randomCust = randomComp.customers[Math.floor(Math.random() * randomComp.customers.length)];
        await scenarios.runCustomerServiceRequestScenario(randomComp, randomCust);
        await new Promise((r) => setTimeout(r, 100));
      }
    }

    // 7. Database Integrity & Leak Scan
    console.log(`\n[Execution] Running Deep Database Integrity & Leak Scanner...`);
    const integrityReport = await integrityScanner.runFullScan();

    if (integrityReport.plaintextPasswordsCount > 0 || integrityReport.unhashedResetTokensCount > 0) {
      metrics.plaintextCredentials += integrityReport.plaintextPasswordsCount + integrityReport.unhashedResetTokensCount;
      await circuitBreaker.trip('PLAINTEXT_CREDENTIAL', {
        scenario: 'DatabaseIntegrityScanner',
        reason: `Found ${integrityReport.plaintextPasswordsCount} plaintext passwords and ${integrityReport.unhashedResetTokensCount} unhashed reset tokens!`,
        expectedResult: '0 plaintext credentials',
        actualResult: `${metrics.plaintextCredentials} plaintext items`,
      });
    }

    metrics.finish();

    // 8. Cleanup (if enabled and circuit breaker not tripped)
    let cleanupResidue = 0;
    if (config.cleanup && !circuitBreaker.getStatus().isTripped) {
      console.log(`\n[Execution] Cleaning up synthetic test records...`);
      const cleanupRes = await cleanupSyntheticData(config);
      cleanupResidue = cleanupRes.remainingCount;
    } else if (circuitBreaker.getStatus().isTripped) {
      console.warn(`\n⚠️ [FREEZE STATE] Circuit breaker tripped: Preserving database records for forensic investigation.`);
    }

    // 9. Generate Reports
    console.log(`\n[Execution] Generating Multi-Dimensional Production Acceptance Reports...`);
    const healingActions = healer.getActions();
    const breakerTrips = circuitBreaker.getStatus().trips;
    metrics.circuitBreakerTrips = breakerTrips.length;

    const { jsonPath, mdPath, passed } = LoadTestReporter.generateReports(
      config,
      registry,
      metrics,
      integrityReport,
      cleanupResidue,
      healingActions,
      breakerTrips
    );

    console.log(`
=============================================================================
                       FINAL ACCEPTANCE VERDICT
=============================================================================
Result: ${passed ? '✅ PASS — AQUAFLOW PRODUCTION ACCEPTED' : '❌ FAIL — ACCEPTANCE REJECTED'}

Reports Generated:
  • JSON Report:     ${jsonPath}
  • Markdown Report: ${mdPath}

Acceptance Dimensions:
  • Functional Security:  ${metrics.crossTenantLeaks === 0 && breakerTrips.length === 0 ? '✅ PASS' : '❌ FAIL'}
  • Performance:          ${metrics.getSummary().throughputReqsPerSec > 0 ? '✅ PASS' : '❌ FAIL'}
  • Reliability:          ${breakerTrips.length === 0 ? '✅ PASS' : '❌ FAIL'}
  • Data Integrity:       ${integrityReport.matrixPassed && cleanupResidue === 0 ? '✅ PASS' : '❌ FAIL'}

Telemetry Summary:
  • Total Transactions:   ${metrics.getSummary().totalRequests}
  • Success Rate:         ${metrics.getSummary().successRate}%
  • Throughput:           ${metrics.getSummary().throughputReqsPerSec} reqs/sec
  • P50 Latency:          ${metrics.getSummary().latency.p50} ms
  • P95 Latency:          ${metrics.getSummary().latency.p95} ms
  • Self-Healing Actions: ${healingActions.length}
  • Circuit Breaker Trips:${breakerTrips.length}
=============================================================================
`);

    if (!passed) {
      process.exit(1);
    }
  } catch (err: any) {
    console.error('\n[FATAL HARNESS ERROR]:', err);
    metrics.recordError('harness_fatal', err.message || 'Fatal exception');
    metrics.finish();
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runHarness();
