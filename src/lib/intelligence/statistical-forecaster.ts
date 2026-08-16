import { prisma } from '@/lib/db';
import { routingProvider } from './routing-provider';
import { DurationIntelligence } from './duration-intelligence';

export interface ForecastFactor {
  factor: string;
  impactMinutes: number;
  details: string;
}

export interface ReasoningJson {
  factors: ForecastFactor[];
  sampleSize: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

export class StatisticalForecaster {
  static readonly MODEL_VERSION = 'forecast-v1';
  static readonly FORECAST_TTL_MINUTES = 10;

  /**
   * Generates or retrieves an unexpired forecast for a given job and technician.
   */
  static async getForecast(jobId: string, technicianId: string): Promise<any> {
    // 1. Check for fresh forecast
    const existing = await prisma.operationalForecast.findFirst({
      where: {
        jobId,
        technicianId,
        expiresAt: { gt: new Date() }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (existing) {
      return existing;
    }

    // 2. Fetch required context
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        appointment: { include: { property: true, service: true } },
        organization: true
      }
    });
    
    const tech = await prisma.technician.findUnique({
      where: { id: technicianId }
    });

    if (!job || !tech || !job.appointment.property || !tech.currentLat || !tech.currentLng) {
      return null;
    }

    // 3. Collect Factors
    const factors: ForecastFactor[] = [];
    let predictedRemainingMinutes = 0;
    
    // A. Routing Factor
    const route = await routingProvider.getRoute(
      tech.currentLat, tech.currentLng,
      job.appointment.property.latitude!, job.appointment.property.longitude!
    );

    let routeMinutes = 0;
    if (route.durationSeconds) {
      routeMinutes = Math.round(route.durationSeconds / 60);
      predictedRemainingMinutes += routeMinutes;
      factors.push({
        factor: 'TRAFFIC',
        impactMinutes: routeMinutes,
        details: `Live travel time via ${route.provider}`
      });
    } else {
      // Estimate Haversine (assume 40km/h avg speed city)
      routeMinutes = Math.round((route.distanceMeters! / 1000) / 40 * 60);
      predictedRemainingMinutes += routeMinutes;
      factors.push({
        factor: 'ESTIMATED_TRAVEL',
        impactMinutes: routeMinutes,
        details: 'Heuristic travel time based on distance (no live traffic)'
      });
    }

    // B. Job Duration Factor
    const orgStats = await DurationIntelligence.getServiceDurationStats(job.organizationId, job.appointment.service.slug);
    const techStats = await DurationIntelligence.getTechnicianServiceDurationStats(job.organizationId, technicianId, job.appointment.service.slug);

    let baseDuration = 60; // fallback
    let sampleSize = 0;
    let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';

    if (techStats && techStats.sampleSize >= 5) {
      baseDuration = techStats.averageMinutes;
      sampleSize = techStats.sampleSize;
      factors.push({
        factor: 'TECHNICIAN_AVERAGE',
        impactMinutes: techStats.averageMinutes,
        details: `Technician historical average across ${sampleSize} jobs`
      });
      
      // Compare to org variance
      if (orgStats && orgStats.sampleSize >= 10) {
        const variance = techStats.averageMinutes - orgStats.averageMinutes;
        if (Math.abs(variance) > 10) {
          factors.push({
            factor: 'TECHNICIAN_VARIANCE',
            impactMinutes: variance,
            details: `Technician is ${variance > 0 ? 'slower' : 'faster'} than organization average`
          });
        }
      }
    } else if (orgStats && orgStats.sampleSize >= 10) {
      baseDuration = orgStats.averageMinutes;
      sampleSize = orgStats.sampleSize;
      factors.push({
        factor: 'ORGANIZATION_AVERAGE',
        impactMinutes: orgStats.averageMinutes,
        details: `Organization baseline across ${sampleSize} jobs`
      });
    } else {
      factors.push({
        factor: 'DEFAULT_ESTIMATE',
        impactMinutes: 60,
        details: 'Insufficient historical data, using default baseline'
      });
    }

    if (sampleSize > 50) confidence = 'HIGH';
    else if (sampleSize > 10) confidence = 'MEDIUM';

    // C. Adjust for elapsed time if already WORKING
    let elapsedMinutes = 0;
    if (job.status === 'WORKING' && job.startedAt) {
      elapsedMinutes = Math.round((new Date().getTime() - job.startedAt.getTime()) / 60000);
      factors.push({
        factor: 'ELAPSED_TIME',
        impactMinutes: -elapsedMinutes,
        details: `Time already spent on site`
      });
      const remainingWork = Math.max(10, baseDuration - elapsedMinutes); // Assume at least 10 mins left if still working
      predictedRemainingMinutes += remainingWork;
    } else if (job.status === 'EN_ROUTE' && job.startedAt) {
       // Already traveling, route covers travel, but add base duration
       predictedRemainingMinutes += baseDuration;
    } else {
       // Not started yet
       predictedRemainingMinutes += baseDuration;
    }

    // 4. Compute Late Probability
    const predictedCompletionAt = new Date(new Date().getTime() + predictedRemainingMinutes * 60000);
    // Note: appointment schedulingStart is string when using findUnique, converting to Date
    const scheduledStartDate = new Date(job.appointment.date);
    const [sh, sm] = job.appointment.startTime.split(':').map(Number);
    scheduledStartDate.setHours(sh, sm, 0, 0);
    const scheduledEnd = new Date(scheduledStartDate.getTime() + 60 * 60000); // 1hr default
    
    // Risk curves:
    const diffMinutes = (predictedCompletionAt.getTime() - scheduledEnd.getTime()) / 60000;
    
    let lateProbability = 0;
    if (diffMinutes <= -15) lateProbability = 0.05;
    else if (diffMinutes <= 0) lateProbability = 0.20 + (15 + diffMinutes) / 15 * 0.30;
    else if (diffMinutes <= 30) lateProbability = 0.50 + (diffMinutes / 30) * 0.40;
    else lateProbability = 0.90 + Math.min((diffMinutes - 30) / 60 * 0.09, 0.09);

    lateProbability = Math.round(lateProbability * 100) / 100;

    const reasoningJson: ReasoningJson = {
      factors,
      sampleSize,
      confidence
    };

    const expiresAt = new Date(new Date().getTime() + this.FORECAST_TTL_MINUTES * 60000);

    const featureSnapshot = {
      service: job.appointment.service.slug,
      technicianAverageSeconds: techStats?.averageMinutes ? techStats.averageMinutes * 60 : null,
      organizationAverageSeconds: orgStats?.averageMinutes ? orgStats.averageMinutes * 60 : null,
      technicianP95Seconds: techStats?.p95Minutes ? techStats.p95Minutes * 60 : null,
      elapsedSeconds: elapsedMinutes * 60,
      remainingTravelSeconds: route.durationSeconds || null,
      hourOfDay: new Date().getHours(),
      dayOfWeek: new Date().getDay(),
      trafficAware: route.trafficAware,
      routingProvider: route.provider
    };

    // 5. Save Forecast
    const forecast = await prisma.operationalForecast.create({
      data: {
        organizationId: job.organizationId,
        jobId,
        technicianId,
        predictedCompletionAt,
        lateProbability,
        confidence,
        sampleSize,
        routingProvider: route.provider,
        modelVersion: this.MODEL_VERSION,
        reasoningJson: JSON.stringify(reasoningJson),
        featureSnapshot: JSON.stringify(featureSnapshot),
        expiresAt
      }
    });

    return forecast;
  }
}
