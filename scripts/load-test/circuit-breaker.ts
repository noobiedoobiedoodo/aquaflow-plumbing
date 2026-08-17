import { ForensicEvidence, ForensicsRecorder } from './forensics';
import { TelemetryCollector } from './telemetry';

export type SecurityBreakerType =
  | 'CROSS_TENANT_LEAK'
  | 'UNAUTHORIZED_MUTATION'
  | 'DUPLICATE_PAYMENT'
  | 'DUPLICATE_WEBHOOK_EFFECT'
  | 'SESSION_BOUNDARY_FAILURE'
  | 'PLAINTEXT_CREDENTIAL';

export interface CircuitBreakerTrip {
  breakerType: SecurityBreakerType;
  timestamp: string;
  reason: string;
  evidence: ForensicEvidence;
}

export class SecurityCircuitBreaker {
  private isTripped: boolean = false;
  private trips: CircuitBreakerTrip[] = [];
  private telemetry?: TelemetryCollector;

  constructor(telemetry?: TelemetryCollector) {
    this.telemetry = telemetry;
  }

  public getStatus(): { isTripped: boolean; tripsCount: number; trips: CircuitBreakerTrip[] } {
    return {
      isTripped: this.isTripped,
      tripsCount: this.trips.length,
      trips: this.trips,
    };
  }

  public async trip(
    breakerType: SecurityBreakerType,
    params: {
      scenario: string;
      reason: string;
      expectedResult: string;
      actualResult: string;
      request?: {
        method: string;
        path: string;
        status?: number;
        headers?: Record<string, string>;
        body?: any;
      };
      context?: {
        sourceTenant?: string;
        targetTenant?: string;
        customerId?: string;
        userId?: string;
        jobId?: string;
        invoiceId?: string;
        paymentId?: string;
        eventId?: string;
      };
      databaseEvidence?: Record<string, any>;
      stack?: string;
    }
  ): Promise<CircuitBreakerTrip> {
    this.isTripped = true;

    const telemetrySnapshot = this.telemetry ? await this.telemetry.getSnapshot() : undefined;

    const evidence = ForensicsRecorder.captureEvidence({
      classification: 'APPLICATION_SECURITY',
      scenario: params.scenario,
      request: params.request,
      context: params.context || {},
      expectedResult: params.expectedResult,
      actualResult: params.actualResult,
      stack: params.stack || new Error().stack,
      telemetrySnapshot,
      databaseEvidence: params.databaseEvidence,
    });

    const tripRecord: CircuitBreakerTrip = {
      breakerType,
      timestamp: new Date().toISOString(),
      reason: params.reason,
      evidence,
    };

    this.trips.push(tripRecord);

    console.error(`\n🛑 =============================================================================`);
    console.error(`   SECURITY CIRCUIT BREAKER TRIPPED: [${breakerType}]`);
    console.error(`   Reason:   ${params.reason}`);
    console.error(`   Scenario: ${params.scenario}`);
    console.error(`   Status:   TEST EXECUTION FROZEN — ZERO TOLERANCE SECURITY DEFECT DETECTED`);
    console.error(`=============================================================================\n`);

    return tripRecord;
  }

  public checkInvariant(condition: boolean, breakerType: SecurityBreakerType, details: any) {
    if (!condition) {
      this.trip(breakerType, details);
      throw new Error(`SECURITY_CIRCUIT_BREAKER_TRIPPED: ${breakerType} - ${details.reason}`);
    }
  }
}
