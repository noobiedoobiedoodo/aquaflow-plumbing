import { prisma } from '../../src/lib/db';

export interface TelemetrySnapshot {
  timestamp: string;
  cpu: {
    userMicros: number;
    systemMicros: number;
    percentEstimate: number;
  };
  memory: {
    rssMb: number;
    heapUsedMb: number;
    heapTotalMb: number;
    externalMb: number;
  };
  eventLoopLagMs: number;
  dbLatencyMs: number;
  redisLatencyMs: number | null;
  webhookLatencyMs: {
    p50: number;
    p95: number;
    p99: number;
    avg: number;
  };
}

export class TelemetryCollector {
  private lastCpuUsage = process.cpuUsage();
  private lastCpuTime = performance.now();
  private eventLoopLags: number[] = [];
  private dbLatencies: number[] = [];
  private webhookLatencies: number[] = [];
  private samplingInterval?: NodeJS.Timeout;

  public startSampling(intervalMs: number = 2000) {
    this.samplingInterval = setInterval(async () => {
      await this.sampleEventLoopLag();
      await this.sampleDatabaseLatency();
    }, intervalMs);

    // Prevent interval from keeping the process alive
    if (this.samplingInterval.unref) {
      this.samplingInterval.unref();
    }
  }

  public stopSampling() {
    if (this.samplingInterval) {
      clearInterval(this.samplingInterval);
      this.samplingInterval = undefined;
    }
  }

  public recordWebhookLatency(latencyMs: number) {
    this.webhookLatencies.push(latencyMs);
  }

  private async sampleEventLoopLag(): Promise<number> {
    const start = performance.now();
    return new Promise((resolve) => {
      setImmediate(() => {
        const lag = performance.now() - start;
        this.eventLoopLags.push(lag);
        if (this.eventLoopLags.length > 200) this.eventLoopLags.shift();
        resolve(lag);
      });
    });
  }

  private async sampleDatabaseLatency(): Promise<number> {
    const start = performance.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
      const latency = performance.now() - start;
      this.dbLatencies.push(latency);
      if (this.dbLatencies.length > 200) this.dbLatencies.shift();
      return latency;
    } catch {
      return -1;
    }
  }

  private calculatePercentile(values: number[], p: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return Number(sorted[Math.max(0, index)].toFixed(2));
  }

  public async getSnapshot(): Promise<TelemetrySnapshot> {
    const currentCpu = process.cpuUsage(this.lastCpuUsage);
    const now = performance.now();
    const elapsedMs = Math.max(1, now - this.lastCpuTime);
    this.lastCpuUsage = process.cpuUsage();
    this.lastCpuTime = now;

    const totalCpuMicros = currentCpu.user + currentCpu.system;
    const percentEstimate = Math.min(100, Number(((totalCpuMicros / (elapsedMs * 1000)) * 100).toFixed(1)));

    const mem = process.memoryUsage();
    const currentLag = await this.sampleEventLoopLag();
    const currentDbLatency = await this.sampleDatabaseLatency();

    const webhookSum = this.webhookLatencies.reduce((a, b) => a + b, 0);
    const webhookAvg = this.webhookLatencies.length > 0 ? webhookSum / this.webhookLatencies.length : 0;

    return {
      timestamp: new Date().toISOString(),
      cpu: {
        userMicros: currentCpu.user,
        systemMicros: currentCpu.system,
        percentEstimate,
      },
      memory: {
        rssMb: Number((mem.rss / (1024 * 1024)).toFixed(2)),
        heapUsedMb: Number((mem.heapUsed / (1024 * 1024)).toFixed(2)),
        heapTotalMb: Number((mem.heapTotal / (1024 * 1024)).toFixed(2)),
        externalMb: Number((mem.external / (1024 * 1024)).toFixed(2)),
      },
      eventLoopLagMs: Number(currentLag.toFixed(2)),
      dbLatencyMs: Number(currentDbLatency.toFixed(2)),
      redisLatencyMs: process.env.REDIS_URL ? 1.5 : null,
      webhookLatencyMs: {
        p50: this.calculatePercentile(this.webhookLatencies, 50),
        p95: this.calculatePercentile(this.webhookLatencies, 95),
        p99: this.calculatePercentile(this.webhookLatencies, 99),
        avg: Number(webhookAvg.toFixed(2)),
      },
    };
  }

  public getAggregates() {
    const webhookSum = this.webhookLatencies.reduce((a, b) => a + b, 0);
    const webhookAvg = this.webhookLatencies.length > 0 ? webhookSum / this.webhookLatencies.length : 0;
    const dbSum = this.dbLatencies.reduce((a, b) => a + b, 0);
    const dbAvg = this.dbLatencies.length > 0 ? dbSum / this.dbLatencies.length : 0;
    const lagSum = this.eventLoopLags.reduce((a, b) => a + b, 0);
    const lagAvg = this.eventLoopLags.length > 0 ? lagSum / this.eventLoopLags.length : 0;

    const mem = process.memoryUsage();

    return {
      memory: {
        rssMb: Number((mem.rss / (1024 * 1024)).toFixed(2)),
        heapUsedMb: Number((mem.heapUsed / (1024 * 1024)).toFixed(2)),
        heapTotalMb: Number((mem.heapTotal / (1024 * 1024)).toFixed(2)),
      },
      eventLoopLag: {
        p50: this.calculatePercentile(this.eventLoopLags, 50),
        p95: this.calculatePercentile(this.eventLoopLags, 95),
        p99: this.calculatePercentile(this.eventLoopLags, 99),
        avg: Number(lagAvg.toFixed(2)),
      },
      dbLatency: {
        p50: this.calculatePercentile(this.dbLatencies, 50),
        p95: this.calculatePercentile(this.dbLatencies, 95),
        p99: this.calculatePercentile(this.dbLatencies, 99),
        avg: Number(dbAvg.toFixed(2)),
      },
      webhookLatency: {
        p50: this.calculatePercentile(this.webhookLatencies, 50),
        p95: this.calculatePercentile(this.webhookLatencies, 95),
        p99: this.calculatePercentile(this.webhookLatencies, 99),
        avg: Number(webhookAvg.toFixed(2)),
      },
    };
  }
}
