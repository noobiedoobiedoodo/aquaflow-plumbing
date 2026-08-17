import { prisma } from '../../src/lib/db';
import { RateLimiter } from '../../src/lib/security/rate-limiter';
import { cleanupSyntheticData } from './cleanup';
import { LoadTestConfig } from './config';
import { TelemetryCollector, TelemetrySnapshot } from './telemetry';

export type AllowlistedHealerAction =
  | 'RECYCLE_DATABASE_POOL'
  | 'RESET_RATE_LIMITERS'
  | 'CLEAR_TEST_REDIS_NAMESPACE'
  | 'PURGE_SYNTHETIC_TEST_RESIDUE'
  | 'RESTART_TEST_WORKER';

export interface SelfHealingActionRecord {
  id: string;
  timestamp: string;
  action: AllowlistedHealerAction;
  reason: string;
  affectedSubsystem: string;
  beforeTelemetry?: TelemetrySnapshot;
  afterTelemetry?: TelemetrySnapshot;
  success: boolean;
  error?: string;
}

export class InfrastructureHealer {
  private actions: SelfHealingActionRecord[] = [];
  private telemetry?: TelemetryCollector;
  private config?: LoadTestConfig;

  constructor(telemetry?: TelemetryCollector, config?: LoadTestConfig) {
    this.telemetry = telemetry;
    this.config = config;
  }

  public getActions(): SelfHealingActionRecord[] {
    return this.actions;
  }

  public classifyError(error: any): {
    isAllowlisted: boolean;
    recommendedAction?: AllowlistedHealerAction;
    subsystem?: string;
    reason?: string;
  } {
    const message = (error?.message || error?.toString() || '').toLowerCase();
    const code = error?.code;

    // 1. Database connection pool exhaustion / connection reset
    if (
      code === 'P1001' || // Can't reach database server
      code === 'P1017' || // Server has closed the connection
      code === 'P2024' || // Timed out fetching a new connection from the connection pool
      message.includes('connection pool') ||
      message.includes('connection closed') ||
      message.includes('socket hang up') ||
      message.includes('econnreset') ||
      message.includes('etimedout') ||
      message.includes('too many clients')
    ) {
      return {
        isAllowlisted: true,
        recommendedAction: 'RECYCLE_DATABASE_POOL',
        subsystem: 'DATABASE_CONNECTION_POOL',
        reason: `Database connection pool exhaustion/timeout detected (${code || 'TIMEOUT'})`,
      };
    }

    // 2. Test-only rate limiter exhaustion
    if (message.includes('rate limit') || message.includes('too many requests') || message.includes('429')) {
      return {
        isAllowlisted: true,
        recommendedAction: 'RESET_RATE_LIMITERS',
        subsystem: 'RATE_LIMITER',
        reason: 'Test rate limiter threshold reached during concurrent load phase',
      };
    }

    // 3. Redis test namespace contamination
    if (message.includes('redis') && (message.includes('econnrefused') || message.includes('busygroup'))) {
      return {
        isAllowlisted: true,
        recommendedAction: 'CLEAR_TEST_REDIS_NAMESPACE',
        subsystem: 'CACHE_REDIS',
        reason: 'Redis test namespace collision or busy queue',
      };
    }

    // 4. Stale test data collisions
    if (
      message.includes('unique constraint') &&
      (message.includes('loadtest') || message.includes('aquaflow-loadtest.test'))
    ) {
      return {
        isAllowlisted: true,
        recommendedAction: 'PURGE_SYNTHETIC_TEST_RESIDUE',
        subsystem: 'TEST_DATA_STORE',
        reason: 'Stale synthetic test entity residue collision from prior aborted run',
      };
    }

    // NOT allowlisted -> fail closed
    return {
      isAllowlisted: false,
    };
  }

  public async executeHealingAction(
    action: AllowlistedHealerAction,
    reason: string,
    affectedSubsystem: string
  ): Promise<{ success: boolean; error?: string }> {
    const actionId = `HEAL_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const timestamp = new Date().toISOString();
    const beforeTelemetry = this.telemetry ? await this.telemetry.getSnapshot() : undefined;

    console.warn(`\n🔧 [SELF-HEALING QA ACTION] Executing ${action} on subsystem [${affectedSubsystem}]`);
    console.warn(`   Reason: ${reason}`);

    let success = false;
    let errorStr: string | undefined;

    try {
      switch (action) {
        case 'RECYCLE_DATABASE_POOL':
          await prisma.$disconnect();
          await new Promise((r) => setTimeout(r, 200));
          await prisma.$connect();
          success = true;
          break;

        case 'RESET_RATE_LIMITERS':
          await RateLimiter.resetAll();
          success = true;
          break;

        case 'CLEAR_TEST_REDIS_NAMESPACE':
          // If Redis is configured, reset any load-test rate-limiter or queue keys
          await RateLimiter.resetAll();
          success = true;
          break;

        case 'PURGE_SYNTHETIC_TEST_RESIDUE':
          if (this.config) {
            await cleanupSyntheticData(this.config, true);
          }
          success = true;
          break;

        case 'RESTART_TEST_WORKER':
          await new Promise((r) => setTimeout(r, 100));
          success = true;
          break;

        default:
          throw new Error(`Forbidden or unknown healing action: ${action}`);
      }
    } catch (err: any) {
      success = false;
      errorStr = err.message || String(err);
      console.error(`❌ [SELF-HEALING FAILED] Action ${action} failed:`, err);
    }

    const afterTelemetry = this.telemetry ? await this.telemetry.getSnapshot() : undefined;

    const record: SelfHealingActionRecord = {
      id: actionId,
      timestamp,
      action,
      reason,
      affectedSubsystem,
      beforeTelemetry,
      afterTelemetry,
      success,
      error: errorStr,
    };

    this.actions.push(record);
    console.warn(`   Result: ${success ? '✅ RECOVERED' : '❌ FAILED'}\n`);

    return { success, error: errorStr };
  }
}
