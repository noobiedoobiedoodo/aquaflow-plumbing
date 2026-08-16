import { expect, test, describe } from 'vitest';
import { validateEnvironment } from '../../src/lib/config/env';

describe('Fail-Closed Production Environment Validation Suite', () => {
  test('Development environment allows local defaults and mocks safely', () => {
    const devEnv = {
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://postgres@localhost:5432/aquaflow_db',
      SESSION_SECRET: 'dev-secret-change-in-production-min-32-chars-long',
    };

    const validated = validateEnvironment(devEnv);
    expect(validated.NODE_ENV).toBe('development');
    expect(validated.SESSION_SECRET).toBe('dev-secret-change-in-production-min-32-chars-long');
  });

  test('Production environment fails closed if STRIPE_SECRET_KEY is missing', () => {
    const prodEnv = {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://prod_user:secret@db:5432/aquaflow_prod',
      SESSION_SECRET: 'a-very-long-secure-production-session-secret-string-1234',
      STRIPE_WEBHOOK_SECRET: 'whsec_live_valid_secret_key_12345',
      REDIS_URL: 'redis://prod-redis:6379',
    };

    expect(() => validateEnvironment(prodEnv)).toThrowError(/STRIPE_SECRET_KEY is required in production/);
  });

  test('Production environment fails closed if mock placeholder keys are provided', () => {
    const prodEnvWithMocks = {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://prod_user:secret@db:5432/aquaflow_prod',
      SESSION_SECRET: 'dev-secret-change-in-production-min-32-chars-long', // Forbidden default
      STRIPE_SECRET_KEY: 'sk_test_mock', // Forbidden mock
      STRIPE_WEBHOOK_SECRET: 'whsec_test_mock', // Forbidden mock
      REDIS_URL: 'redis://prod-redis:6379',
    };

    expect(() => validateEnvironment(prodEnvWithMocks)).toThrowError(/Production Fail-Closed Configuration Errors/);
  });

  test('Production environment succeeds with valid production configuration', () => {
    const validProdEnv = {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://prod_user:secret@db:5432/aquaflow_prod',
      SESSION_SECRET: 'a-very-long-secure-production-session-secret-string-1234',
      STRIPE_SECRET_KEY: 'sk_test_51MockLiveValidKeyForDeployment12345',
      STRIPE_WEBHOOK_SECRET: 'whsec_valid_webhook_secret_key_12345',
      REDIS_URL: 'redis://prod-redis:6379',
    };

    const validated = validateEnvironment(validProdEnv);
    expect(validated.NODE_ENV).toBe('production');
    expect(validated.STRIPE_SECRET_KEY).toBe('sk_test_51MockLiveValidKeyForDeployment12345');
  });
});
