import { describe, it, expect, beforeEach } from 'vitest';
import { RateLimiter, circuitBreaker, inMemoryLimiter } from '@/lib/security/rate-limiter';
import { randomUUID } from 'crypto';

describe('RATE-001: RateLimiter Failure Resilience & Sliding Window Fallback', () => {
  beforeEach(async () => {
    await RateLimiter.resetAll();
  });

  it('fails fast on first request when Redis is offline and enforces in-memory limits without stalling', async () => {
    const id = `test-user-${randomUUID()}`;
    const testConfig = { action: 'test_action', maxRequests: 3, windowSeconds: 60 };

    const start = Date.now();
    const res1 = await RateLimiter.check(id, testConfig);
    const end = Date.now();
    const elapsedFirst = end - start;

    // First request should fail fast (<= 250ms with timeout overhead) and NOT hang 20,000ms
    expect(elapsedFirst).toBeLessThan(300);
    expect(res1).toBe(true);

    // Circuit should now be OPEN because Redis connection failed
    expect(circuitBreaker.getState()).toBe('OPEN');

    // Subsequent requests while OPEN should be effectively instantaneous (< 5ms)
    const t2Start = performance.now();
    const res2 = await RateLimiter.check(id, testConfig);
    const t2End = performance.now();
    expect(t2End - t2Start).toBeLessThan(10);
    expect(res2).toBe(true);

    const res3 = await RateLimiter.check(id, testConfig);
    expect(res3).toBe(true);

    // 4th request exceeds maxRequests = 3: must be rejected!
    const res4 = await RateLimiter.check(id, testConfig);
    expect(res4).toBe(false);

    // Test multi-check with in-memory fallback
    const idMulti = `multi-${randomUUID()}`;
    const m1 = await RateLimiter.checkMulti(['127.0.0.1', idMulti], testConfig);
    expect(m1).toBe(true);

    // Reset clears in-memory state
    await RateLimiter.reset(id, 'test_action');
    const resAfterReset = await RateLimiter.check(id, testConfig);
    expect(resAfterReset).toBe(true);
  });

  it('benchmarks 100 consecutive requests while circuit is OPEN to measure latency', async () => {
    // Force circuit OPEN
    circuitBreaker.recordFailure();
    expect(circuitBreaker.getState()).toBe('OPEN');

    const config = { action: 'bench', maxRequests: 200, windowSeconds: 60 };
    const latencies: number[] = [];

    for (let i = 0; i < 100; i++) {
      const t0 = performance.now();
      const ok = await RateLimiter.check(`bench-user-${i}`, config);
      const t1 = performance.now();
      latencies.push(t1 - t0);
      expect(ok).toBe(true);
    }

    const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const max = Math.max(...latencies);

    // Average latency should be well under 1ms
    expect(avg).toBeLessThan(1.0);
    expect(max).toBeLessThan(10.0);
  });

  it('fails closed when in-memory limiter reaches hard capacity', async () => {
    circuitBreaker.recordFailure();

    // Fill in-memory limiter up to 10,000 keys
    for (let i = 0; i < 10_000; i++) {
      inMemoryLimiter.check(`fill-key-${i}`, 10, 3600);
    }
    expect(inMemoryLimiter.size()).toBe(10_000);

    // 10,001st key should trigger capacity cleanup, and if still at 10,000 active keys, fail closed
    const ok = inMemoryLimiter.check('overflow-key', 10, 3600);
    expect(ok).toBe(false);
  });
});
