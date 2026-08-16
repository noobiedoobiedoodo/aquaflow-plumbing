import { prisma } from '@/lib/db';
import { StatisticalForecaster } from './statistical-forecaster';

export class LateJobDetector {
  /**
   * Evaluates the latest operational forecast for an EN_ROUTE or ASSIGNED job.
   * If the deterministic ETA crosses thresholds, it fires state transitions.
   * Returns the forecast object.
   */
  static async checkJobLateness(jobId: string, technicianId: string): Promise<any> {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { appointment: true }
    });

    if (!job || !job.appointment) return null;
    
    // 1. Get or Generate Forecast
    const forecast = await StatisticalForecaster.getForecast(jobId, technicianId);
    if (!forecast) return null;

    if (['ARRIVED', 'DIAGNOSING', 'WORKING', 'COMPLETED', 'CANCELLED'].includes(job.status)) {
      return forecast; // Already arrived or finished, no deterministic transition needed
    }

    const appointmentDate = new Date(job.appointment.date);
    const timeParts = job.appointment.startTime.split(':');
    appointmentDate.setHours(parseInt(timeParts[0], 10), parseInt(timeParts[1], 10), 0, 0);
    const scheduledStart = appointmentDate.getTime();
    
    // For the deterministic check, we use the forecaster's predicted completion time (or travel time).
    // Wait, if it's EN_ROUTE, the predicted time is the arrival time + duration.
    // The deterministic SLA check is usually based on ARRIVAL time.
    // Let's extract the travel time from the reasoning JSON
    let travelMinutes = 0;
    try {
      const reasoning = JSON.parse(forecast.reasoningJson);
      const trafficFactor = reasoning.factors.find((f: any) => f.factor === 'TRAFFIC' || f.factor === 'ESTIMATED_TRAVEL');
      if (trafficFactor) travelMinutes = trafficFactor.impactMinutes;
    } catch(e) {}

    const eta = new Date().getTime() + travelMinutes * 60000;
    const currentEtaDate = new Date(eta);
    
    // Check deterministic lateness thresholds
    const isCriticalLate = eta > scheduledStart + 30 * 60 * 1000; // > 30 mins late arrival
    const isLikelyLate = eta > scheduledStart + 15 * 60 * 1000; // > 15 mins late arrival
    
    // Let's add a "latenessState" to Job, or use JobActivity to see if we already notified.
    // For MVP, we can check the latest JobActivity to see if we already flagged it.
    const latestLateActivity = await prisma.jobActivity.findFirst({
      where: { jobId: job.id, action: { in: ['LIKELY_LATE_FLAGGED', 'CRITICAL_LATE_FLAGGED'] } },
      orderBy: { createdAt: 'desc' }
    });

    let newState = null;
    if (isCriticalLate && latestLateActivity?.action !== 'CRITICAL_LATE_FLAGGED') {
      newState = 'CRITICAL_LATE_FLAGGED';
    } else if (isLikelyLate && !isCriticalLate && latestLateActivity?.action !== 'LIKELY_LATE_FLAGGED') {
      // Only flag LIKELY_LATE if we haven't flagged it OR if we downgraded from CRITICAL (rare)
      if (!latestLateActivity || latestLateActivity.action !== 'LIKELY_LATE_FLAGGED') {
        newState = 'LIKELY_LATE_FLAGGED';
      }
    }

    if (newState) {
      await prisma.$transaction(async (tx) => {
        await tx.jobActivity.create({
          data: {
            jobId: job.id,
            action: newState!,
            metadata: JSON.stringify({ eta: currentEtaDate.toISOString() })
          }
        });

        // Trigger Event for automation to notify dispatcher/customer
        await tx.event.create({
          data: {
            organizationId: job.organizationId,
            type: newState === 'CRITICAL_LATE_FLAGGED' ? 'job.critical_late' : 'job.likely_late',
            entityType: 'Job',
            entityId: job.id,
            data: JSON.stringify({ jobId: job.id, eta: currentEtaDate.toISOString() })
          }
        });
      });

      return forecast;
    }

    return forecast;
  }
}
