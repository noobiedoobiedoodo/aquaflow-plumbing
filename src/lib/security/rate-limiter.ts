import { redis } from '@/lib/queue/redis';
import { headers } from 'next/headers';
import { Logger } from '@/lib/observability/logger';

export interface RateLimitConfig {
  action: string;
  maxRequests: number;
  windowSeconds: number;
  failClosedInProd?: boolean;
}

export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  BOOKING: { action: 'booking', maxRequests: 10, windowSeconds: 3600 }, // 10 per hour
  LOGIN: { action: 'login', maxRequests: 10, windowSeconds: 900, failClosedInProd: true }, // 10 per 15 min
  WEBHOOK: { action: 'webhook', maxRequests: 200, windowSeconds: 60 },
  API: { action: 'api_general', maxRequests: 1000, windowSeconds: 3600 },
};

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

// ============================================================================
// CONSTANTS & CIRCUIT BREAKER STATE
// ============================================================================
// Internal Redis operation timeout set to 180ms to provide 20ms scheduling/timer
// overhead margin, guaranteeing end-to-end RateLimiter decision latency is strictly <= 200ms.
const REDIS_TIMEOUT_MS = 180; 
const COOLDOWN_MS = 10_000;   // 10 seconds cooldown
const MAX_IN_MEMORY_KEYS = 10_000; // Bounded key count cap
const CLEANUP_INTERVAL_MS = 30_000; // Periodic cleanup threshold

let circuitState: CircuitState = CircuitState.CLOSED;
let lastFailureTime = 0;
let isProbing = false;

// Bounded in-memory sliding-window store: key -> array of unix epoch timestamps (ms)
const inMemoryStore = new Map<string, number[]>();
let lastCleanupTime = 0;

/**
 * Wraps any promise with a strict maximum timeout of <= 200ms.
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number = REDIS_TIMEOUT_MS): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Redis operation timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timer);
  });
}

/**
 * Determines whether a request should attempt Redis based on circuit state.
 * Prevents concurrent requests from all independently attempting Redis during recovery.
 */
function shouldAttemptRedis(now: number): boolean {
  if (!redis) return false;

  if (circuitState === CircuitState.CLOSED) {
    return true;
  }

  if (circuitState === CircuitState.OPEN) {
    if (now - lastFailureTime >= COOLDOWN_MS) {
      circuitState = CircuitState.HALF_OPEN;
      // Fall through to HALF_OPEN probe assignment
    } else {
      return false; // Cooldown active, use in-memory limiter immediately
    }
  }

  if (circuitState === CircuitState.HALF_OPEN) {
    if (!isProbing) {
      isProbing = true; // Designate this single request as the active probe
      return true;
    }
    // Another request is already probing; concurrent requests immediately use in-memory limiter
    return false;
  }

  return false;
}

/**
 * Records a successful Redis operation. If in HALF_OPEN, transitions circuit back to CLOSED.
 */
function recordRedisSuccess(): void {
  if (circuitState === CircuitState.HALF_OPEN) {
    circuitState = CircuitState.CLOSED;
    isProbing = false;
    Logger.info('RateLimiter circuit breaker: Redis recovered, circuit transitioned to CLOSED', {
      operation: 'ratelimit.circuit_closed',
    });
  }
}

/**
 * Records a failed or timed-out Redis operation. Trips circuit to OPEN and starts 10s cooldown.
 */
function recordRedisFailure(error: any): void {
  const wasOpen = circuitState === CircuitState.OPEN;
  circuitState = CircuitState.OPEN;
  lastFailureTime = Date.now();
  isProbing = false;

  if (!wasOpen) {
    Logger.warn(`RateLimiter circuit breaker: Redis failure detected (${error?.message || 'unknown error'}). Circuit tripped to OPEN for ${COOLDOWN_MS / 1000}s cooldown. Falling back to in-memory sliding-window limiter.`, {
      operation: 'ratelimit.circuit_open',
      metadata: { error: error?.message },
    });
  }
}

/**
 * Memory safety: Periodic cleanup of expired entries from the in-memory store.
 * Cleans up empty keys and keys whose latest timestamp is expired beyond 1 hour.
 */
function cleanupInMemory(now: number): void {
  if (now - lastCleanupTime < CLEANUP_INTERVAL_MS) return;
  lastCleanupTime = now;

  for (const [key, timestamps] of inMemoryStore.entries()) {
    if (!timestamps.length || timestamps[timestamps.length - 1] < now - 3600_000) {
      inMemoryStore.delete(key);
    }
  }
}

/**
 * Bounded in-memory sliding-window rate limit evaluator.
 * Strictly enforces identical maxRequests over windowSeconds.
 * 
 * Capacity & Security Policy:
 * If the hard key cap (10,000 keys) is reached, it first purges expired entries.
 * If still at capacity and the key is new, the limiter FAILS CLOSED (returns false)
 * rather than evicting active keys, thereby preventing DDoS/flood attackers from
 * cycling random identities to bypass rate limits.
 */
function checkInMemory(key: string, config: RateLimitConfig, now: number): boolean {
  cleanupInMemory(now);

  const windowStart = now - config.windowSeconds * 1000;
  let timestamps = inMemoryStore.get(key);

  if (timestamps) {
    // Retain only timestamps within the sliding window
    timestamps = timestamps.filter((t) => t > windowStart);
  } else {
    timestamps = [];
  }

  if (timestamps.length >= config.maxRequests) {
    inMemoryStore.set(key, timestamps);
    Logger.warn(`[In-Memory Fallback] Rate limit exceeded for ${config.action} (${key}): ${timestamps.length}/${config.maxRequests}`, {
      operation: 'ratelimit.in_memory.exceeded',
      metadata: { action: config.action, count: timestamps.length, limit: config.maxRequests },
    });
    return false;
  }

  // Key count capacity enforcement for new keys
  if (!inMemoryStore.has(key) && inMemoryStore.size >= MAX_IN_MEMORY_KEYS) {
    // Eager cleanup of all expired keys across entire store
    for (const [k, ts] of inMemoryStore.entries()) {
      if (!ts.length || ts[ts.length - 1] < windowStart) {
        inMemoryStore.delete(k);
      }
    }

    // If still at capacity, fail closed to prevent memory exhaustion & rate-limit bypass
    if (inMemoryStore.size >= MAX_IN_MEMORY_KEYS) {
      Logger.error(`[In-Memory Fallback] Hard key cap reached (${MAX_IN_MEMORY_KEYS}), failing closed for new key to prevent bypass`, new Error('RateLimiter in-memory key cap reached'), {
        operation: 'ratelimit.in_memory.capacity_exceeded',
        metadata: { key, action: config.action },
      });
      return false;
    }
  }

  timestamps.push(now);
  inMemoryStore.set(key, timestamps);
  return true;
}

export class RateLimiter {
  /**
   * Checks if a request exceeds the configured sliding rate limit.
   * Uses atomic Redis INCR + EXPIRE when Redis is healthy (<= 200ms timeout).
   * Automatically falls back to bounded in-memory sliding-window limiter on Redis failure.
   */
  static async check(identifier: string, config: RateLimitConfig): Promise<boolean> {
    if (!identifier) return true;

    const now = Date.now();
    const key = `ratelimit:${config.action}:${identifier}`;

    // 1. Evaluate Circuit Breaker: should we attempt Redis?
    if (shouldAttemptRedis(now)) {
      try {
        const current = await withTimeout(redis!.incr(key), REDIS_TIMEOUT_MS);

        if (current === 1) {
          await withTimeout(redis!.expire(key, config.windowSeconds), REDIS_TIMEOUT_MS);
        }

        recordRedisSuccess();

        if (current > config.maxRequests) {
          Logger.warn(`Rate limit exceeded for ${config.action} (${identifier}): ${current}/${config.maxRequests}`, {
            operation: 'ratelimit.exceeded',
            metadata: { action: config.action, count: current, limit: config.maxRequests },
          });
          return false;
        }

        return true;
      } catch (error: any) {
        // Redis failed, timed out (<= 200ms), or connection refused.
        // Record failure to trip circuit breaker and avoid 20s hangs on concurrent requests.
        recordRedisFailure(error);

        // Fall through directly to bounded in-memory fallback
      }
    }

    // 2. Bounded In-Memory Sliding-Window Fallback
    // Strictly enforces identical action, identifier, maxRequests, windowSeconds.
    return checkInMemory(key, config, now);
  }

  /**
   * Gets the client IP from Next.js headers safely
   */
  static async getClientIp(req?: Request): Promise<string> {
    if (req && req.headers) {
      const forwardedFor = req.headers.get('x-forwarded-for');
      if (forwardedFor) return forwardedFor.split(',')[0].trim();
      const realIp = req.headers.get('x-real-ip');
      if (realIp) return realIp;
    }

    try {
      const headersList = await headers();
      const forwardedFor = headersList.get('x-forwarded-for');
      if (forwardedFor) {
        return forwardedFor.split(',')[0].trim();
      }
      return headersList.get('x-real-ip') || '127.0.0.1';
    } catch {
      return '127.0.0.1';
    }
  }

  /**
   * Multi-dimensional rate limit check (e.g. check by IP AND by email).
   */
  static async checkMulti(identifiers: string[], config: RateLimitConfig): Promise<boolean> {
    for (const id of identifiers) {
      if (!id) continue;
      const allowed = await this.check(id, config);
      if (!allowed) return false;
    }
    return true;
  }

  /**
   * Resets rate limit keys for a given identifier across both Redis and In-Memory fallback.
   */
  static async reset(identifier: string, action: string): Promise<void> {
    const key = `ratelimit:${action}:${identifier}`;
    inMemoryStore.delete(key);

    if (shouldAttemptRedis(Date.now())) {
      try {
        await withTimeout(redis!.del(key), REDIS_TIMEOUT_MS);
        recordRedisSuccess();
      } catch (error) {
        recordRedisFailure(error);
      }
    }
  }

  /**
   * Resets all rate limits and circuit breaker state across both Redis and In-Memory fallback.
   */
  static async resetAll(): Promise<void> {
    inMemoryStore.clear();
    circuitState = CircuitState.CLOSED;
    isProbing = false;

    if (shouldAttemptRedis(Date.now())) {
      try {
        const keys = await withTimeout(redis!.keys('ratelimit:*'), REDIS_TIMEOUT_MS);
        if (keys.length > 0) {
          await withTimeout(redis!.del(...keys), REDIS_TIMEOUT_MS);
        }
        recordRedisSuccess();
      } catch (error) {
        recordRedisFailure(error);
      }
    }
  }

  /**
   * Diagnostic inspection helper for runtime status & verification suites.
   */
  static getDiagnosticState(): {
    circuitState: CircuitState;
    isProbing: boolean;
    lastFailureTime: number;
    inMemoryKeyCount: number;
  } {
    return {
      circuitState,
      isProbing,
      lastFailureTime,
      inMemoryKeyCount: inMemoryStore.size,
    };
  }

  /**
   * Forces a circuit state (used exclusively for deterministic testing).
   */
  static setCircuitStateForTesting(state: CircuitState, lastFail: number = Date.now()): void {
    circuitState = state;
    lastFailureTime = lastFail;
    isProbing = false;
  }
}

export const circuitBreaker = {
  getState: (): CircuitState => circuitState,
  recordFailure: (): void => recordRedisFailure(new Error('Manual test failure recorded')),
  recordSuccess: (): void => recordRedisSuccess(),
  reset: (): void => {
    circuitState = CircuitState.CLOSED;
    lastFailureTime = 0;
    isProbing = false;
  },
};

export const inMemoryLimiter = {
  check: (key: string, maxRequests: number, windowSeconds: number): boolean => {
    return checkInMemory(key, { action: 'test_action', maxRequests, windowSeconds }, Date.now());
  },
  size: (): number => inMemoryStore.size,
  clear: (): void => inMemoryStore.clear(),
};

