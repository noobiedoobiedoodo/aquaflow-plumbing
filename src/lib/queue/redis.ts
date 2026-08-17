import { Redis } from 'ioredis';

const isProduction = process.env.NODE_ENV === 'production';
const REDIS_URL = process.env.REDIS_URL;

// We use a singleton pattern for the Redis connection so we don't exhaust 
// connections during hot-reloads in development.
const globalForRedis = global as unknown as { redis: Redis | null };

function createRedisClient(): Redis | null {
  if (REDIS_URL) {
    return new Redis(REDIS_URL, {
      maxRetriesPerRequest: null, // BullMQ requires this to be null
      lazyConnect: true,
      retryStrategy: (times) => Math.min(times * 100, 3000),
    });
  }

  if (isProduction) {
    // In production without REDIS_URL, fail safely without connecting to localhost
    return null;
  }

  // Development local fallback with lazy connection
  return new Redis('redis://localhost:6379', {
    maxRetriesPerRequest: null,
    lazyConnect: true,
    retryStrategy: () => null, // Do not spam retries if local redis daemon is not running
  });
}

export const redis = globalForRedis.redis !== undefined ? globalForRedis.redis : createRedisClient();

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis;

