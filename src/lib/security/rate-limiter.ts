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

export class RateLimiter {
  /**
   * Checks if a request exceeds the configured sliding rate limit.
   * Uses atomic Redis INCR + EXPIRE.
   */
  static async check(identifier: string, config: RateLimitConfig): Promise<boolean> {
    if (!identifier) return true;

    try {
      if (!redis) {
        if (process.env.NODE_ENV === 'production' && config.failClosedInProd) {
          Logger.error(`Redis unavailable: failing closed for sensitive action ${config.action}`, new Error('Redis unavailable'), {
            operation: 'ratelimit.fail_closed',
            metadata: { action: config.action, identifier },
          });
          return false;
        }
        return true;
      }

      const key = `ratelimit:${config.action}:${identifier}`;
      const current = await redis.incr(key);

      if (current === 1) {
        await redis.expire(key, config.windowSeconds);
      }

      if (current > config.maxRequests) {
        Logger.warn(`Rate limit exceeded for ${config.action} (${identifier}): ${current}/${config.maxRequests}`, {
          operation: 'ratelimit.exceeded',
          metadata: { action: config.action, count: current, limit: config.maxRequests },
        });
        return false;
      }

      return true;
    } catch (error: any) {
      Logger.error(`Rate limiter error for ${config.action}`, error, {
        operation: 'ratelimit.error',
        metadata: { action: config.action, identifier },
      });

      if (process.env.NODE_ENV === 'production' && config.failClosedInProd) {
        return false; // Fail closed for critical endpoints in production
      }
      return true; // Graceful degradation in dev
    }
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
   * Resets rate limit keys for a given identifier or all rate limits (useful in test suites).
   */
  static async reset(identifier: string, action: string): Promise<void> {
    if (redis && identifier) {
      try {
        await redis.del(`ratelimit:${action}:${identifier}`);
      } catch {}
    }
  }

  static async resetAll(): Promise<void> {
    if (redis) {
      try {
        const keys = await redis.keys('ratelimit:*');
        if (keys.length > 0) {
          await redis.del(...keys);
        }
      } catch {}
    }
  }
}
