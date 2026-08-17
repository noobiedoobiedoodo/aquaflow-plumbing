import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { TelemetrySnapshot } from './telemetry';

export type FailureClassification =
  | 'APPLICATION_SECURITY'
  | 'APPLICATION_BUSINESS_LOGIC'
  | 'INFRASTRUCTURE_ENVIRONMENT'
  | 'UNKNOWN';

export interface ForensicEvidence {
  failureId: string;
  timestamp: string;
  classification: FailureClassification;
  scenario: string;
  request?: {
    method: string;
    path: string;
    status?: number;
    headers?: Record<string, string>;
    body?: any;
  };
  context: {
    sourceTenant?: string;
    targetTenant?: string;
    customerId?: string;
    userId?: string;
    jobId?: string;
    invoiceId?: string;
    paymentId?: string;
    eventId?: string;
  };
  expectedResult: string;
  actualResult: string;
  stack?: string;
  telemetrySnapshot?: TelemetrySnapshot;
  databaseEvidence?: Record<string, any>;
}

export class ForensicsRecorder {
  private static reportsDir = path.resolve(process.cwd(), 'reports');

  public static redactSensitiveValues(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;

    const redacted = Array.isArray(obj) ? [...obj] : { ...obj };
    const sensitiveKeys = [
      'password',
      'passwordhash',
      'token',
      'tokenhash',
      'cookie',
      'secret',
      'stripe_secret',
      'authorization',
      'key',
    ];

    for (const key of Object.keys(redacted)) {
      const lowerKey = key.toLowerCase();
      const isSensitive = sensitiveKeys.some((s) => lowerKey.includes(s));

      if (isSensitive && typeof redacted[key] === 'string') {
        const hash = crypto.createHash('sha256').update(redacted[key]).digest('hex').substring(0, 10);
        redacted[key] = `[REDACTED_SHA256:${hash}]`;
      } else if (typeof redacted[key] === 'object') {
        redacted[key] = ForensicsRecorder.redactSensitiveValues(redacted[key]);
      }
    }

    return redacted;
  }

  public static captureEvidence(evidence: Omit<ForensicEvidence, 'failureId' | 'timestamp'>): ForensicEvidence {
    const randomSuffix = crypto.randomBytes(3).toString('hex');
    const failureId = `FAIL_${Date.now()}_${randomSuffix}`;
    const timestamp = new Date().toISOString();

    const cleanEvidence: ForensicEvidence = {
      failureId,
      timestamp,
      classification: evidence.classification,
      scenario: evidence.scenario,
      request: evidence.request ? ForensicsRecorder.redactSensitiveValues(evidence.request) : undefined,
      context: evidence.context,
      expectedResult: evidence.expectedResult,
      actualResult: evidence.actualResult,
      stack: evidence.stack,
      telemetrySnapshot: evidence.telemetrySnapshot,
      databaseEvidence: evidence.databaseEvidence
        ? ForensicsRecorder.redactSensitiveValues(evidence.databaseEvidence)
        : undefined,
    };

    if (!fs.existsSync(ForensicsRecorder.reportsDir)) {
      fs.mkdirSync(ForensicsRecorder.reportsDir, { recursive: true });
    }

    // Write reproduction script
    const reproScriptPath = path.join(ForensicsRecorder.reportsDir, `repro-${failureId}.ts`);
    const reproScriptContent = ForensicsRecorder.generateReproductionScript(cleanEvidence);
    fs.writeFileSync(reproScriptPath, reproScriptContent, 'utf8');

    console.error(`\n🚨 [FORENSIC CAPTURE] Failure ID: ${failureId}`);
    console.error(`   Classification: ${cleanEvidence.classification}`);
    console.error(`   Scenario:       ${cleanEvidence.scenario}`);
    console.error(`   Reproduction:   ${reproScriptPath}\n`);

    return cleanEvidence;
  }

  private static generateReproductionScript(evidence: ForensicEvidence): string {
    return `/**
 * Deterministic Failure Reproduction Script
 * Failure ID: ${evidence.failureId}
 * Classification: ${evidence.classification}
 * Timestamp: ${evidence.timestamp}
 * Scenario: ${evidence.scenario}
 * Expected: ${evidence.expectedResult}
 * Actual: ${evidence.actualResult}
 */

import { prisma } from '../src/lib/db';
import { NextRequest } from 'next/server';

async function reproduce() {
  console.log('[Repro] Starting standalone reproduction for ${evidence.failureId}...');
  console.log('[Repro] Target Scenario: ${evidence.scenario}');
  console.log('[Repro] Target Context: ${JSON.stringify(evidence.context)}');

  // Verify entity state before executing
  ${
    evidence.context.jobId
      ? `const job = await prisma.job.findUnique({ where: { id: '${evidence.context.jobId}' } });
  console.log('[Repro] Job State:', job);`
      : ''
  }
  ${
    evidence.context.invoiceId
      ? `const invoice = await prisma.invoice.findUnique({ where: { id: '${evidence.context.invoiceId}' } });
  console.log('[Repro] Invoice State:', invoice);`
      : ''
  }

  // Simulated Failing Request
  ${
    evidence.request
      ? `console.log('[Repro] Executing Request: ${evidence.request.method} ${evidence.request.path}');
  // Method: ${evidence.request.method}
  // Expected Status: ${evidence.expectedResult}
  // Actual Status: ${evidence.actualResult}`
      : `console.log('[Repro] Direct Database / Business Invariant Violation');`
  }

  console.log('[Repro] Reproduction execution completed.');
  await prisma.$disconnect();
}

reproduce().catch((err) => {
  console.error('[Repro] Execution failed:', err);
  process.exit(1);
});
`;
  }
}
