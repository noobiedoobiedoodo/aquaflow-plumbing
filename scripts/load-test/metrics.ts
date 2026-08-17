import { TelemetryCollector } from './telemetry';

export interface ScenarioMetric {
  scenarioName: string;
  count: number;
  successes: number;
  failures: number;
  latencies: number[]; // ms
  statusCodes: Record<number, number>;
}

export class MetricsCollector {
  private startTime: number = Date.now();
  private endTime: number = Date.now();
  private scenarioMetrics: Map<string, ScenarioMetric> = new Map();
  private errors: Array<{ timestamp: string; scenario: string; error: string }> = [];

  // Hard Security & Invariant Counters
  public crossTenantLeaks: number = 0;
  public unauthorizedReads: number = 0;
  public unauthorizedMutations: number = 0;
  public duplicatePayments: number = 0;
  public duplicateWebhookEffects: number = 0;
  public sessionBoundaryFailures: number = 0;
  public tokenReplaySuccesses: number = 0;
  public plaintextCredentials: number = 0;
  public integrityViolations: number = 0;

  // Reliability & Infrastructure Counters
  public circuitBreakerTrips: number = 0;
  public infrastructureFailures: number = 0;
  public selfHealingActions: number = 0;
  public selfHealingSuccesses: number = 0;
  public selfHealingFailures: number = 0;
  public unknownFailures: number = 0;

  public telemetry: TelemetryCollector;

  constructor() {
    this.telemetry = new TelemetryCollector();
  }

  public start() {
    this.startTime = Date.now();
    this.telemetry.startSampling();
  }

  public finish() {
    this.endTime = Date.now();
    this.telemetry.stopSampling();
  }

  public recordRequest(scenarioName: string, latencyMs: number, statusCode: number, isSuccess: boolean) {
    let metric = this.scenarioMetrics.get(scenarioName);
    if (!metric) {
      metric = {
        scenarioName,
        count: 0,
        successes: 0,
        failures: 0,
        latencies: [],
        statusCodes: {},
      };
      this.scenarioMetrics.set(scenarioName, metric);
    }

    metric.count += 1;
    if (isSuccess) {
      metric.successes += 1;
    } else {
      metric.failures += 1;
    }

    metric.latencies.push(latencyMs);
    metric.statusCodes[statusCode] = (metric.statusCodes[statusCode] || 0) + 1;

    if (scenarioName === 'payment_webhook') {
      this.telemetry.recordWebhookLatency(latencyMs);
    }
  }

  public recordError(scenario: string, error: string) {
    this.errors.push({
      timestamp: new Date().toISOString(),
      scenario,
      error,
    });
  }

  private calculatePercentile(latencies: number[], p: number): number {
    if (latencies.length === 0) return 0;
    const sorted = [...latencies].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return Number(sorted[Math.max(0, index)].toFixed(2));
  }

  public getSummary() {
    const totalDurationSec = Math.max(0.001, (this.endTime - this.startTime) / 1000);
    const allLatencies: number[] = [];
    let totalRequests = 0;
    let totalSuccesses = 0;
    let totalFailures = 0;
    const statusCodes: Record<number, number> = {};

    const scenarioBreakdown: Record<
      string,
      {
        requests: number;
        successes: number;
        failures: number;
        p50: number;
        p95: number;
        p99: number;
        avg: number;
      }
    > = {};

    for (const [name, metric] of this.scenarioMetrics.entries()) {
      totalRequests += metric.count;
      totalSuccesses += metric.successes;
      totalFailures += metric.failures;
      allLatencies.push(...metric.latencies);

      for (const [code, count] of Object.entries(metric.statusCodes)) {
        const numCode = parseInt(code, 10);
        statusCodes[numCode] = (statusCodes[numCode] || 0) + count;
      }

      const sum = metric.latencies.reduce((a, b) => a + b, 0);
      const avg = metric.latencies.length > 0 ? sum / metric.latencies.length : 0;

      scenarioBreakdown[name] = {
        requests: metric.count,
        successes: metric.successes,
        failures: metric.failures,
        p50: this.calculatePercentile(metric.latencies, 50),
        p95: this.calculatePercentile(metric.latencies, 95),
        p99: this.calculatePercentile(metric.latencies, 99),
        avg: Number(avg.toFixed(2)),
      };
    }

    const throughput = Number((totalRequests / totalDurationSec).toFixed(2));
    const allSum = allLatencies.reduce((a, b) => a + b, 0);
    const overallAvg = allLatencies.length > 0 ? allSum / allLatencies.length : 0;

    const telemetryAggs = this.telemetry.getAggregates();

    return {
      durationSeconds: Number(totalDurationSec.toFixed(2)),
      totalRequests,
      totalSuccesses,
      totalFailures,
      successRate: totalRequests > 0 ? Number(((totalSuccesses / totalRequests) * 100).toFixed(2)) : 100,
      throughputReqsPerSec: throughput,
      latency: {
        p50: this.calculatePercentile(allLatencies, 50),
        p75: this.calculatePercentile(allLatencies, 75),
        p90: this.calculatePercentile(allLatencies, 90),
        p95: this.calculatePercentile(allLatencies, 95),
        p99: this.calculatePercentile(allLatencies, 99),
        avg: Number(overallAvg.toFixed(2)),
        max: allLatencies.length > 0 ? Math.max(...allLatencies) : 0,
        min: allLatencies.length > 0 ? Math.min(...allLatencies) : 0,
      },
      telemetry: telemetryAggs,
      statusCodes,
      security: {
        crossTenantLeaks: this.crossTenantLeaks,
        unauthorizedReads: this.unauthorizedReads,
        unauthorizedMutations: this.unauthorizedMutations,
        duplicatePayments: this.duplicatePayments,
        duplicateWebhookEffects: this.duplicateWebhookEffects,
        sessionBoundaryFailures: this.sessionBoundaryFailures,
        tokenReplaySuccesses: this.tokenReplaySuccesses,
        plaintextCredentials: this.plaintextCredentials,
        integrityViolations: this.integrityViolations,
      },
      reliability: {
        circuitBreakerTrips: this.circuitBreakerTrips,
        infrastructureFailures: this.infrastructureFailures,
        selfHealingActions: this.selfHealingActions,
        selfHealingSuccesses: this.selfHealingSuccesses,
        selfHealingFailures: this.selfHealingFailures,
        unknownFailures: this.unknownFailures,
      },
      scenarioBreakdown,
      recentErrors: this.errors.slice(0, 20),
    };
  }
}
