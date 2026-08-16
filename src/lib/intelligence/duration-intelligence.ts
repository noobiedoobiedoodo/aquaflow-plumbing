import { prisma } from '@/lib/db';

export interface DurationStats {
  averageMinutes: number;
  medianMinutes: number;
  p95Minutes: number;
  sampleSize: number;
}

export class DurationIntelligence {
  /**
   * Calculates historical duration stats for a specific service type.
   */
  static async getServiceDurationStats(organizationId: string, serviceSlug: string): Promise<DurationStats | null> {
    // Find all completed jobs for this service that have valid time entries
    const jobs = await prisma.job.findMany({
      where: {
        organizationId,
        status: 'COMPLETED',
        appointment: { service: { slug: serviceSlug } },
        startedAt: { not: null },
        completedAt: { not: null }
      },
      select: {
        startedAt: true,
        completedAt: true
      }
    });

    if (jobs.length === 0) return null;

    // Calculate durations in minutes
    const durations = jobs
      .map(j => (j.completedAt!.getTime() - j.startedAt!.getTime()) / 60000)
      .filter(d => d > 0)
      .sort((a, b) => a - b);

    if (durations.length === 0) return null;

    const sampleSize = durations.length;
    const totalDuration = durations.reduce((acc, curr) => acc + curr, 0);
    const averageMinutes = Math.round(totalDuration / sampleSize);
    
    // Median
    const mid = Math.floor(sampleSize / 2);
    const medianMinutes = Math.round(
      sampleSize % 2 !== 0 ? durations[mid] : (durations[mid - 1] + durations[mid]) / 2
    );

    // P95
    const p95Index = Math.floor(sampleSize * 0.95);
    const p95Minutes = Math.round(durations[p95Index] || durations[durations.length - 1]);

    return {
      averageMinutes,
      medianMinutes,
      p95Minutes,
      sampleSize
    };
  }

  static async getTechnicianServiceDurationStats(organizationId: string, technicianId: string, serviceSlug: string): Promise<DurationStats | null> {
    const jobs = await prisma.job.findMany({
      where: {
        organizationId,
        technicianId,
        status: 'COMPLETED',
        appointment: { service: { slug: serviceSlug } },
        startedAt: { not: null },
        completedAt: { not: null }
      },
      select: {
        startedAt: true,
        completedAt: true
      }
    });

    if (jobs.length === 0) return null;

    const durations = jobs
      .map(j => (j.completedAt!.getTime() - j.startedAt!.getTime()) / 60000)
      .filter(d => d > 0)
      .sort((a, b) => a - b);

    if (durations.length === 0) return null;

    const sampleSize = durations.length;
    const totalDuration = durations.reduce((acc, curr) => acc + curr, 0);
    const averageMinutes = Math.round(totalDuration / sampleSize);
    
    const mid = Math.floor(sampleSize / 2);
    const medianMinutes = Math.round(
      sampleSize % 2 !== 0 ? durations[mid] : (durations[mid - 1] + durations[mid]) / 2
    );

    const p95Index = Math.floor(sampleSize * 0.95);
    const p95Minutes = Math.round(durations[p95Index] || durations[durations.length - 1]);

    return {
      averageMinutes,
      medianMinutes,
      p95Minutes,
      sampleSize
    };
  }
}
