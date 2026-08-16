import { prisma } from '@/lib/db';
import { routingProvider } from './routing-provider';

export interface ConflictResult {
  canAssign: boolean;
  hardConflicts: string[];
  softConflicts: string[];
}

export class ConflictEngine {
  /**
   * Evaluates conflicts for assigning a technician to a job.
   */
  static async evaluateAssignment(jobId: string, technicianId: string): Promise<ConflictResult> {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { appointment: { include: { property: true, service: true } } }
    });

    const technician = await prisma.technician.findUnique({
      where: { id: technicianId },
      include: { 
        jobs: {
          where: { status: { in: ['ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'WORKING'] } },
          include: { appointment: true }
        }
      }
    });

    if (!job || !technician || !job.appointment) {
      throw new Error("Invalid job or technician data provided to ConflictEngine");
    }

    const hardConflicts: string[] = [];
    const softConflicts: string[] = [];

    // 1. HARD CONFLICTS
    if (technician.availabilityStatus !== 'AVAILABLE') {
      hardConflicts.push(`Technician availability status is ${technician.availabilityStatus}`);
    }

    // Required Skill
    const requiredSkill = job.appointment.service?.slug;
    if (requiredSkill) {
      let hasSkill = false;
      try {
        const skillsArray = technician.skills ? JSON.parse(technician.skills) : [];
        if (skillsArray.includes(requiredSkill)) hasSkill = true;
      } catch (e) { /* ignore */ }
      
      if (!hasSkill) {
        hardConflicts.push(`Technician lacks required certification: ${requiredSkill}`);
      }
    }

    // Overlapping Appointments (Simplistic overlap check for MVP)
    const getDates = (appt: any) => {
      const start = new Date(appt.date);
      const startParts = appt.startTime.split(':');
      start.setHours(parseInt(startParts[0], 10), parseInt(startParts[1], 10), 0, 0);

      const end = new Date(appt.date);
      const endParts = appt.endTime.split(':');
      end.setHours(parseInt(endParts[0], 10), parseInt(endParts[1], 10), 0, 0);
      
      return { start: start.getTime(), end: end.getTime(), startDate: start };
    };

    const { start: newStart, end: newEnd } = getDates(job.appointment);
    
    for (const activeJob of technician.jobs) {
      if (!activeJob.appointment) continue;
      const { start: actStart, end: actEnd, startDate: actStartDate } = getDates(activeJob.appointment);
      
      if (newStart < actEnd && newEnd > actStart) {
        hardConflicts.push(`Technician has overlapping appointment at ${actStartDate.toLocaleTimeString()}`);
      }
    }

    // 2. SOFT CONFLICTS
    
    // Heavy Workload
    if (technician.jobs.length >= 4) {
      softConflicts.push(`Heavy workload: Technician already has ${technician.jobs.length} active jobs`);
    }

    // Distance/Travel
    if (technician.currentLat && technician.currentLng && job.appointment.property.latitude && job.appointment.property.longitude) {
      const route = await routingProvider.getRoute(
        technician.currentLat, technician.currentLng,
        job.appointment.property.latitude, job.appointment.property.longitude
      );

      if (route.durationSeconds && route.durationSeconds > 45 * 60) {
        softConflicts.push(`Estimated travel exceeds 45 minutes (${Math.round(route.durationSeconds/60)} min)`);
      } else if (!route.durationSeconds && route.distanceMeters && route.distanceMeters > 30000) {
        // Fallback for Haversine (e.g. > 30km is a soft conflict)
        softConflicts.push(`Estimated travel distance exceeds 30 km (${Math.round(route.distanceMeters/1000)} km)`);
      }
    }

    // Tight Buffers
    for (const activeJob of technician.jobs) {
      if (!activeJob.appointment) continue;
      const { start: actStart, end: actEnd } = getDates(activeJob.appointment);
      
      // If the new job starts right after an active job ends (less than 15 mins)
      if (newStart >= actEnd && newStart - actEnd < 15 * 60 * 1000) {
        softConflicts.push(`Only ${Math.round((newStart - actEnd) / 60000)} minutes between previous appointment and this appointment`);
      }
      // Or if the new job ends right before an active job starts
      if (newEnd <= actStart && actStart - newEnd < 15 * 60 * 1000) {
        softConflicts.push(`Only ${Math.round((actStart - newEnd) / 60000)} minutes before next appointment starts`);
      }
    }

    return {
      canAssign: hardConflicts.length === 0,
      hardConflicts,
      softConflicts
    };
  }
}
