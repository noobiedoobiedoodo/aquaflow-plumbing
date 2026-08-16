import { prisma } from '@/lib/db';

const HAVERSINE_R = 6371; // km

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return HAVERSINE_R * c;
}

export class RecommendationEngine {
  static readonly SCORING_VERSION = "v1.0";

  /**
   * Main entry point for evaluating an unassigned job and persisting ranked recommendations.
   */
  static async scoreAndPersistCandidates(jobId: string) {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { 
        appointment: { include: { property: true, service: true } },
        organization: true
      }
    });

    if (!job || job.technicianId || !job.appointment) return;

    // Is this an emergency? For MVP, we can check if service title contains "Emergency"
    const isEmergency = job.appointment.service?.name?.toLowerCase().includes('emergency') || false;

    // Fetch all active technicians in this organization
    const technicians = await prisma.technician.findMany({
      where: { organizationId: job.organizationId, isActive: true },
      include: { user: true, jobs: { where: { status: { in: ['EN_ROUTE', 'IN_PROGRESS', 'ASSIGNED'] } } } }
    });

    // Mark previous recommendations as EXPIRED
    await prisma.intelligenceRecommendation.updateMany({
      where: { jobId, status: 'SUGGESTED' },
      data: { status: 'EXPIRED' }
    });

    const recommendations = [];

    for (const tech of technicians) {
      const scoreData = this.evaluateTechnician(job, tech, isEmergency);
      
      // If it's an emergency and they have a hard conflict, completely skip them.
      if (isEmergency && scoreData.availabilityScore === 0) continue;

      recommendations.push(scoreData);
    }

    // Persist all generated recommendations
    for (const rec of recommendations) {
      await prisma.intelligenceRecommendation.create({
        data: rec
      });
    }

    console.log(`[RecommendationEngine] Generated ${recommendations.length} recommendations for Job ${jobId}`);
  }

  private static evaluateTechnician(job: any, technician: any, isEmergency: boolean) {
    let score = 0;

    // 1. Distance Score (Haversine)
    let distanceScore = 0;
    let distanceKm = null;
    const prop = job.appointment.property;

    if (technician.currentLat && technician.currentLng && prop.lat && prop.lng) {
      distanceKm = haversineDistance(technician.currentLat, technician.currentLng, prop.lat, prop.lng);
      if (distanceKm <= 2) distanceScore = 30;
      else if (distanceKm <= 5) distanceScore = 25;
      else if (distanceKm <= 10) distanceScore = 18;
      else if (distanceKm <= 20) distanceScore = 10;
      else distanceScore = 0;
    } else {
      // Default mid-score if location is unknown to not penalize heavily, but not reward
      distanceScore = 10;
    }

    // 2. Availability
    let availabilityScore = 0;
    let availabilityStatus = 'Unknown';
    if (technician.availabilityStatus === 'AVAILABLE') {
      availabilityScore = 30;
      availabilityStatus = 'Immediately available';
    } else if (technician.availabilityStatus === 'BUSY') {
      availabilityScore = 5;
      availabilityStatus = 'Potential conflict';
    } else {
      availabilityScore = 0;
      availabilityStatus = 'Hard conflict';
    }

    // 3. Skills Match
    let skillScore = 0;
    let skillMatch = 'No verified skill';
    const requiredSkill = job.appointment.service?.slug;
    
    if (requiredSkill && technician.skills) {
      try {
        const skillsArray = JSON.parse(technician.skills);
        if (skillsArray.includes(requiredSkill)) {
          skillScore = 25;
          skillMatch = 'Exact service match';
        }
      } catch (e) { /* ignore */ }
    } else if (!requiredSkill) {
      // If job has no specific service required, full points
      skillScore = 25;
      skillMatch = 'General service';
    }

    // 4. Workload
    let workloadScore = 0;
    let workloadLevel = 'Unknown';
    const activeJobs = technician.jobs?.length || 0;
    if (activeJobs === 0) {
      workloadScore = 15;
      workloadLevel = 'Light workload';
    } else if (activeJobs <= 2) {
      workloadScore = 10;
      workloadLevel = 'Normal';
    } else if (activeJobs <= 4) {
      workloadScore = 5;
      workloadLevel = 'Heavy';
    } else {
      workloadScore = 0;
      workloadLevel = 'Overloaded';
    }

    // Emergency adjustments
    if (isEmergency) {
      // Higher penalty for heavy workload or missing skills
      if (availabilityScore < 30) availabilityScore = 0; // Must be immediately available
      if (skillScore < 25) skillScore = 0; // Must have exact match
    }

    score = distanceScore + availabilityScore + skillScore + workloadScore;

    const reasoning = [
      { factor: 'Distance', impact: `+${distanceScore}`, details: distanceKm ? `${distanceKm.toFixed(1)} km away` : 'Unknown location' },
      { factor: 'Availability', impact: `+${availabilityScore}`, details: availabilityStatus },
      { factor: 'Skills', impact: `+${skillScore}`, details: skillMatch },
      { factor: 'Workload', impact: `+${workloadScore}`, details: workloadLevel }
    ];

    return {
      organizationId: job.organizationId,
      jobId: job.id,
      technicianId: technician.id,
      score,
      distanceScore,
      availabilityScore,
      skillScore,
      workloadScore,
      distanceKm,
      availabilityStatus,
      skillMatch,
      workloadLevel,
      reasoningJson: JSON.stringify(reasoning),
      scoringVersion: this.SCORING_VERSION,
      status: 'SUGGESTED'
    };
  }
}
