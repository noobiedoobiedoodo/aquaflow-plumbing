import 'dotenv/config';
import { z } from 'zod';

const FORBIDDEN_PRODUCTION_VALUES = new Set([
  'sk_test_mock',
  'whsec_test_mock',
  'dev-secret-change-in-production-min-32-chars-long',
  'mock_resend_api_key',
  'mock_twilio_sid',
]);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().default('postgresql://postgres@localhost:5432/aquaflow_db?schema=public'),
  SESSION_SECRET: z.string().default('dev-secret-change-in-production-min-32-chars-long'),
  SESSION_MAX_AGE_DAYS: z.coerce.number().default(30),
  REDIS_URL: z.string().optional().default('redis://localhost:6379'),
  REDIS_TOKEN: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional().default('AquaFlow <onboarding@aquaflowplumbing.com>'),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM_NUMBER: z.string().optional(),
  AWS_REGION: z.string().optional().default('us-east-1'),
  AWS_S3_BUCKET_NAME: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_ENDPOINT: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().optional().default('http://localhost:3000'),
  NEXT_PUBLIC_BASE_URL: z.string().optional().default('http://localhost:3000'),
  NEXT_PUBLIC_APP_NAME: z.string().optional().default('AquaFlow Plumbing'),
});

export function validateEnvironment(envObj: Record<string, string | undefined> = process.env) {
  const parsed = envSchema.safeParse(envObj);

  if (!parsed.success) {
    const errorDetails = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join(', ');
    throw new Error(`[Environment Validation Failed]: ${errorDetails}`);
  }

  const env = parsed.data;
  const isProduction = env.NODE_ENV === 'production';

  if (isProduction) {
    const productionErrors: string[] = [];

    // 1. Database validation
    if (!env.DATABASE_URL || (!env.DATABASE_URL.startsWith('postgresql://') && !env.DATABASE_URL.startsWith('postgres://'))) {
      productionErrors.push('DATABASE_URL must be a PostgreSQL connection in production.');
    }

    // 2. Session Secret validation
    if (env.SESSION_SECRET.length < 32) {
      productionErrors.push('SESSION_SECRET must be at least 32 characters in production.');
    }
    if (FORBIDDEN_PRODUCTION_VALUES.has(env.SESSION_SECRET)) {
      productionErrors.push('SESSION_SECRET cannot use the development default placeholder in production.');
    }

    // 3. Stripe Secrets validation
    if (!env.STRIPE_SECRET_KEY) {
      productionErrors.push('STRIPE_SECRET_KEY is required in production.');
    } else if (FORBIDDEN_PRODUCTION_VALUES.has(env.STRIPE_SECRET_KEY)) {
      productionErrors.push('STRIPE_SECRET_KEY cannot use mock placeholder values in production.');
    }

    if (!env.STRIPE_WEBHOOK_SECRET) {
      productionErrors.push('STRIPE_WEBHOOK_SECRET is required in production.');
    } else if (FORBIDDEN_PRODUCTION_VALUES.has(env.STRIPE_WEBHOOK_SECRET)) {
      productionErrors.push('STRIPE_WEBHOOK_SECRET cannot use mock placeholder values in production.');
    }

    // 4. Redis validation
    if (!env.REDIS_URL) {
      productionErrors.push('REDIS_URL is required in production for background workers and rate limiting.');
    }

    // 5. Storage validation (if S3 bucket is defined)
    if (env.AWS_S3_BUCKET_NAME) {
      if (!env.AWS_ACCESS_KEY_ID && !process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI) {
        productionErrors.push('AWS_ACCESS_KEY_ID is required when AWS_S3_BUCKET_NAME is configured.');
      }
      if (!env.AWS_SECRET_ACCESS_KEY && !process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI) {
        productionErrors.push('AWS_SECRET_ACCESS_KEY is required when AWS_S3_BUCKET_NAME is configured.');
      }
    }

    // 6. Email validation
    if (env.RESEND_API_KEY && FORBIDDEN_PRODUCTION_VALUES.has(env.RESEND_API_KEY)) {
      productionErrors.push('RESEND_API_KEY cannot use mock placeholder values.');
    }

    // 7. SMS validation
    if (env.TWILIO_ACCOUNT_SID && FORBIDDEN_PRODUCTION_VALUES.has(env.TWILIO_ACCOUNT_SID)) {
      productionErrors.push('TWILIO_ACCOUNT_SID cannot use mock placeholder values.');
    }

    if (productionErrors.length > 0) {
      throw new Error(`[Production Fail-Closed Configuration Errors]:\n- ${productionErrors.join('\n- ')}`);
    }
  }

  return env;
}

export const env = validateEnvironment();
