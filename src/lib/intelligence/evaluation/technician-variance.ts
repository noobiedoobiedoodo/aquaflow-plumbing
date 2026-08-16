import { prisma } from '@/lib/db';
import { DurationIntelligence } from '../duration-intelligence';

export interface TechnicianVarianceRecord {
  technicianId: string;
  technicianName: string;
  serviceSlug: string;
  serviceName: string;
  techAverage: number;
  techP95: number;
  techSampleSize: number;
  orgAverage: number;
  orgP95: number;
  orgSampleSize: number;
  variancePercent: number;
  confidence: 'HIGH CONFIDENCE' | 'LIMITED DATA';
}

export class TechnicianVariance {

  static async getVarianceLeaderboard(organizationId: string): Promise<TechnicianVarianceRecord[]> {
    const activeTechs = await prisma.technician.findMany({
      where: { organizationId, isActive: true },
      select: { id: true, firstName: true, lastName: true }
    });

    const services = await prisma.service.findMany({
      where: { organizationId, isActive: true },
      select: { slug: true, name: true }
    });

    const results: TechnicianVarianceRecord[] = [];

    for (const service of services) {
      const orgStats = await DurationIntelligence.getServiceDurationStats(organizationId, service.slug);
      
      if (!orgStats || orgStats.sampleSize < 5) continue; // Skip services without enough baseline data

      for (const tech of activeTechs) {
        const techStats = await DurationIntelligence.getTechnicianServiceDurationStats(organizationId, tech.id, service.slug);
        
        if (techStats && techStats.sampleSize > 0) {
          const variance = (techStats.averageMinutes - orgStats.averageMinutes) / orgStats.averageMinutes;
          
          results.push({
            technicianId: tech.id,
            technicianName: `${tech.firstName} ${tech.lastName}`,
            serviceSlug: service.slug,
            serviceName: service.name,
            techAverage: techStats.averageMinutes,
            techP95: techStats.p95Minutes,
            techSampleSize: techStats.sampleSize,
            orgAverage: orgStats.averageMinutes,
            orgP95: orgStats.p95Minutes,
            orgSampleSize: orgStats.sampleSize,
            variancePercent: Math.round(variance * 1000) / 10, // e.g. 19.7%
            confidence: techStats.sampleSize >= 10 ? 'HIGH CONFIDENCE' : 'LIMITED DATA'
          });
        }
      }
    }

    // Sort by largest absolute variance (slowest or fastest) but prioritize HIGH CONFIDENCE
    return results.sort((a, b) => {
      if (a.confidence !== b.confidence) {
        return a.confidence === 'HIGH CONFIDENCE' ? -1 : 1;
      }
      return Math.abs(b.variancePercent) - Math.abs(a.variancePercent);
    });
  }
}
