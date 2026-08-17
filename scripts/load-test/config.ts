import { randomUUID } from 'crypto';

export interface LoadTestConfig {
  runId: string;
  prefix: string;
  environment: string;
  targetUrl: string;
  databaseUrl: string;
  mode: 'acceptance' | 'stress' | 'soak' | 'smoke';
  companies: number;
  dispatchersPerCompany: number;
  techniciansPerCompany: number;
  customersPerCompany: number;
  sharedCustomersCount: number;
  concurrency: number;
  cleanup: boolean;
  soakDurationSeconds: number;
  notificationMode: 'stub' | 'live';
}

export function loadConfiguration(): LoadTestConfig {
  const allowLoadTest = process.env.ALLOW_LOAD_TEST === 'true' || process.argv.includes('--allow');
  if (!allowLoadTest) {
    console.error(`
=============================================================================
CRITICAL SAFETY ERROR: Load test execution not allowed!
To execute the multi-tenant acceptance harness, you must explicitly set:
  ALLOW_LOAD_TEST=true
or pass the CLI flag:
  --allow
=============================================================================
`);
    process.exit(1);
  }

  const databaseUrl = process.env.DATABASE_URL || '';
  const isProductionDatabase =
    databaseUrl.includes('prod') ||
    databaseUrl.includes('production') ||
    process.env.NODE_ENV === 'production';

  const isExplicitProductionTarget =
    process.argv.includes('--target-production') ||
    process.env.ALLOW_PRODUCTION_LOAD_TEST === 'true';

  if (isProductionDatabase && !isExplicitProductionTarget) {
    console.error(`
=============================================================================
CRITICAL PRODUCTION SAFETY ERROR:
Detected potential production database connection:
  ${databaseUrl.replace(/:[^:@]+@/, ':****@')}
The harness will NOT execute against production without:
  --target-production AND ALLOW_PRODUCTION_LOAD_TEST=true
=============================================================================
`);
    process.exit(1);
  }

  const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  const randomSuffix = randomUUID().slice(0, 6);
  const runId = process.env.LOAD_TEST_RUN_ID || `${timestamp}_${randomSuffix}`;
  const prefix = `LOADTEST_${runId}_`;

  let mode: 'acceptance' | 'stress' | 'soak' | 'smoke' = 'acceptance';
  if (process.argv.includes('--stress') || process.env.LOAD_TEST_MODE === 'stress') {
    mode = 'stress';
  } else if (process.argv.includes('--soak') || process.env.LOAD_TEST_MODE === 'soak') {
    mode = 'soak';
  } else if (process.argv.includes('--smoke') || process.env.LOAD_TEST_MODE === 'smoke') {
    mode = 'smoke';
  }

  let defaultCompanies = 5;
  let defaultCustomers = 50;
  let defaultConcurrency = 10;

  if (mode === 'smoke') {
    defaultCompanies = 2;
    defaultCustomers = 10;
    defaultConcurrency = 2;
  } else if (mode === 'stress') {
    defaultCompanies = 25;
    defaultCustomers = 100;
    defaultConcurrency = 50;
  } else if (mode === 'soak') {
    defaultCompanies = 5;
    defaultCustomers = 20;
    defaultConcurrency = 5;
  }

  const companies = parseInt(process.env.LOAD_COMPANIES || '', 10) || defaultCompanies;
  const dispatchersPerCompany = parseInt(process.env.LOAD_DISPATCHERS || '', 10) || 3;
  const techniciansPerCompany = parseInt(process.env.LOAD_TECHNICIANS || '', 10) || 5;
  const customersPerCompany = parseInt(process.env.LOAD_CUSTOMERS || '', 10) || defaultCustomers;
  const sharedCustomersCount = Math.min(20, Math.floor(customersPerCompany / 2));
  const concurrency = parseInt(process.env.LOAD_CONCURRENCY || '', 10) || defaultConcurrency;
  const cleanup = process.env.LOAD_CLEANUP !== 'false' && !process.argv.includes('--no-cleanup');
  const soakDurationSeconds = parseInt(process.env.SOAK_DURATION_SECONDS || '60', 10);
  const targetUrl = process.env.LOAD_TARGET_URL || 'http://localhost:3000';

  return {
    runId,
    prefix,
    environment: process.env.NODE_ENV || 'development',
    targetUrl,
    databaseUrl,
    mode,
    companies,
    dispatchersPerCompany,
    techniciansPerCompany,
    customersPerCompany,
    sharedCustomersCount,
    concurrency,
    cleanup,
    soakDurationSeconds,
    notificationMode: 'stub',
  };
}
