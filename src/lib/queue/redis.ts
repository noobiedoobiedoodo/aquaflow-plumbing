import { Redis } from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// We use a singleton pattern for the Redis connection so we don't exhaust 
// connections during hot-reloads in development.
const globalForRedis = global as unknown as { redis: Redis };

export const redis = globalForRedis.redis || new Redis(REDIS_URL, {
  maxRetriesPerRequest: null, // BullMQ requires this to be null
});

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis;
