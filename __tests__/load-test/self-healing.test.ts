import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InfrastructureHealer } from '../../scripts/load-test/healer';
import { SecurityCircuitBreaker } from '../../scripts/load-test/circuit-breaker';
import { ForensicsRecorder } from '../../scripts/load-test/forensics';
import { TelemetryCollector } from '../../scripts/load-test/telemetry';
import fs from 'fs';
import path from 'path';

describe('Phase 21: Self-Diagnosing / Self-Healing QA Architecture', () => {
  let telemetry: TelemetryCollector;
  let circuitBreaker: SecurityCircuitBreaker;
  let healer: InfrastructureHealer;

  beforeEach(() => {
    telemetry = new TelemetryCollector();
    circuitBreaker = new SecurityCircuitBreaker(telemetry);
    healer = new InfrastructureHealer(telemetry);
  });

  it('Test A — Infrastructure recovery: DB connection pool exhaustion is classified as allowlisted and successfully healed', async () => {
    const dbPoolError = new Error('Timed out fetching a new connection from the connection pool. (P2024)');
    (dbPoolError as any).code = 'P2024';

    const classification = healer.classifyError(dbPoolError);

    expect(classification.isAllowlisted).toBe(true);
    expect(classification.recommendedAction).toBe('RECYCLE_DATABASE_POOL');
    expect(classification.subsystem).toBe('DATABASE_CONNECTION_POOL');

    // Execute healing action
    const result = await healer.executeHealingAction(
      classification.recommendedAction!,
      classification.reason!,
      classification.subsystem!
    );

    expect(result.success).toBe(true);
    const actions = healer.getActions();
    expect(actions.length).toBe(1);
    expect(actions[0].action).toBe('RECYCLE_DATABASE_POOL');
    expect(actions[0].success).toBe(true);
    expect(actions[0].beforeTelemetry).toBeDefined();
    expect(actions[0].afterTelemetry).toBeDefined();
  });

  it('Test B — Security failure: Cross-tenant access fails closed without healing and trips circuit breaker', async () => {
    const crossTenantError = new Error('Cross-tenant data leaked: Customer of Company A accessed invoice of Company B');

    // 1. Verify healer refuses to heal security violations
    const classification = healer.classifyError(crossTenantError);
    expect(classification.isAllowlisted).toBe(false);

    // 2. Verify circuit breaker trips and captures forensics
    const tripRecord = await circuitBreaker.trip('CROSS_TENANT_LEAK', {
      scenario: 'AdversarialCrossTenantScan',
      reason: crossTenantError.message,
      expectedResult: 'HTTP 404/403',
      actualResult: 'HTTP 200 with foreign invoice payload',
      context: {
        sourceTenant: 'plumbing-corp-a',
        targetTenant: 'plumbing-corp-b',
        customerId: 'cust_test_123',
        invoiceId: 'inv_test_456',
      },
    });

    expect(circuitBreaker.getStatus().isTripped).toBe(true);
    expect(tripRecord.breakerType).toBe('CROSS_TENANT_LEAK');
    expect(tripRecord.evidence.failureId).toMatch(/^FAIL_/);
    expect(tripRecord.evidence.classification).toBe('APPLICATION_SECURITY');

    // Verify standalone reproduction script was written
    const reproFile = path.resolve(process.cwd(), 'reports', `repro-${tripRecord.evidence.failureId}.ts`);
    expect(fs.existsSync(reproFile)).toBe(true);

    const reproContent = fs.readFileSync(reproFile, 'utf8');
    expect(reproContent).toContain('reproduce()');
    expect(reproContent).toContain('cust_test_123');
    expect(reproContent).toContain('inv_test_456');
  });

  it('Test C — Duplicate payment: Duplicate financial effect trips circuit breaker with zero healing', async () => {
    const duplicatePaymentError = new Error('Duplicate payment created for providerPaymentId pi_123456');

    const classification = healer.classifyError(duplicatePaymentError);
    expect(classification.isAllowlisted).toBe(false);

    await circuitBreaker.trip('DUPLICATE_PAYMENT', {
      scenario: 'ConcurrentWebhookRace',
      reason: duplicatePaymentError.message,
      expectedResult: 'Exactly 1 Payment record',
      actualResult: '2 duplicate Payment records created',
      context: {
        paymentId: 'pay_duplicate_999',
        invoiceId: 'inv_target_888',
      },
    });

    expect(circuitBreaker.getStatus().isTripped).toBe(true);
    expect(circuitBreaker.getStatus().tripsCount).toBe(1);
    expect(circuitBreaker.getStatus().trips[0].breakerType).toBe('DUPLICATE_PAYMENT');
  });

  it('Test D — Unknown exception: Unclassified error fails closed without triggering healing', () => {
    const weirdError = new Error('Null pointer reference in unexpected internal handler');

    const classification = healer.classifyError(weirdError);
    expect(classification.isAllowlisted).toBe(false);
    expect(classification.recommendedAction).toBeUndefined();
    expect(healer.getActions().length).toBe(0);
  });

  it('Test E — Rate-limit recovery: Test rate limiter threshold triggers controlled allowlisted reset', async () => {
    const rateLimitError = new Error('Too Many Requests: 429 rate limit exceeded in test batch');

    const classification = healer.classifyError(rateLimitError);
    expect(classification.isAllowlisted).toBe(true);
    expect(classification.recommendedAction).toBe('RESET_RATE_LIMITERS');
    expect(classification.subsystem).toBe('RATE_LIMITER');

    const result = await healer.executeHealingAction(
      classification.recommendedAction!,
      classification.reason!,
      classification.subsystem!
    );

    expect(result.success).toBe(true);
    expect(healer.getActions().length).toBe(1);
    expect(healer.getActions()[0].action).toBe('RESET_RATE_LIMITERS');
  });

  it('Test F — Forensic redaction: Redacts sensitive passwords, tokens, and cookies before recording evidence', () => {
    const rawData = {
      user: 'alice@example.com',
      password: 'SuperSecretPassword123!',
      cookie: 'customer_session=raw_secret_session_token_xyz',
      tokenHash: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
      nested: {
        stripe_secret: 'sk_test_51MzXYZ123456',
        publicCount: 42,
      },
    };

    const clean = ForensicsRecorder.redactSensitiveValues(rawData);

    expect(clean.password).toMatch(/^\[REDACTED_SHA256:/);
    expect(clean.cookie).toMatch(/^\[REDACTED_SHA256:/);
    expect(clean.tokenHash).toMatch(/^\[REDACTED_SHA256:/);
    expect(clean.nested.stripe_secret).toMatch(/^\[REDACTED_SHA256:/);
    expect(clean.nested.publicCount).toBe(42);
    expect(clean.user).toBe('alice@example.com');
  });
});
