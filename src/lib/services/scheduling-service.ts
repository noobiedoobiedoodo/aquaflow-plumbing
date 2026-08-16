import { prisma } from '@/lib/db';

export class SchedulingService {
  /**
   * Generates a notification / dispatcher task for an approved estimate.
   */
  static async requestSchedulingForEstimate(organizationId: string, estimateId: string) {
    const estimate = await prisma.estimate.findUnique({
      where: { id: estimateId, organizationId },
      include: { job: { include: { appointment: true } } }
    });

    if (!estimate) throw new Error('Estimate not found');
    if (estimate.status !== 'APPROVED') throw new Error('Estimate is not approved');

    // Create a dispatcher notification "Scheduling Required"
    return await prisma.$transaction(async (tx) => {
      const notification = await tx.notification.create({
        data: {
          organizationId,
          idempotencyKey: `scheduling_required:${estimateId}`,
          type: 'SCHEDULING_REQUIRED',
          channel: 'IN_APP', // For dispatcher UI
          status: 'PENDING',
          subject: `Scheduling Required: Estimate ${estimate.estimateNumber}`,
          content: `Estimate ${estimate.estimateNumber} has been approved by the customer. A dispatcher needs to finalize the technician's schedule.`,
          metadata: JSON.stringify({ estimateId, jobId: estimate.jobId })
        }
      });

      // We do not autonomous dispatch a tech yet (per Phase 9 requirements)
      return notification;
    });
  }

  /**
   * Accepts a system recommendation and assigns the job to the technician securely.
   */
  static async acceptRecommendation(organizationId: string, recommendationId: string, assignedById: string, overrideSoftConflicts = true) {
    const recommendation = await prisma.intelligenceRecommendation.findUnique({
      where: { id: recommendationId, organizationId },
      include: { job: true }
    });

    if (!recommendation) throw new Error('Recommendation not found');
    if (recommendation.status !== 'SUGGESTED') throw new Error('Recommendation is no longer available');
    if (recommendation.job.technicianId) throw new Error('Job is already assigned');

    const { ConflictEngine } = await import('@/lib/intelligence/conflict-engine');
    const conflicts = await ConflictEngine.evaluateAssignment(recommendation.jobId, recommendation.technicianId);

    if (!conflicts.canAssign) {
      throw new Error(`Cannot assign: ${conflicts.hardConflicts.join(', ')}`);
    }

    return await prisma.$transaction(async (tx) => {
      // Record override if there were soft conflicts
      if (conflicts.softConflicts.length > 0 && overrideSoftConflicts) {
        await tx.assignmentOverride.create({
          data: {
            organizationId,
            jobId: recommendation.jobId,
            technicianId: recommendation.technicianId,
            userId: assignedById,
            reason: 'Dispatcher accepted recommendation despite soft conflicts',
            conflicts: JSON.stringify(conflicts.softConflicts)
          }
        });
      }

      // 1. Assign the job
      const assignment = await tx.jobAssignment.create({
        data: {
          jobId: recommendation.jobId,
          technicianId: recommendation.technicianId,
          assignedById
        }
      });

      const updatedJob = await tx.job.update({
        where: { id: recommendation.jobId },
        data: { 
          technicianId: recommendation.technicianId,
          status: 'ASSIGNED' 
        }
      });

      // 2. Accept this recommendation
      await tx.intelligenceRecommendation.update({
        where: { id: recommendationId },
        data: { status: 'ACCEPTED' }
      });

      // 3. Reject other recommendations for this job
      await tx.intelligenceRecommendation.updateMany({
        where: { jobId: recommendation.jobId, id: { not: recommendationId }, status: 'SUGGESTED' },
        data: { status: 'EXPIRED' }
      });

      // 4. Outbox Event (triggers EN_ROUTE or ASSIGNED notifications via AutomationEngine)
      await tx.event.create({
        data: {
          organizationId,
          type: 'job.assigned',
          entityType: 'Job',
          entityId: updatedJob.id,
          data: JSON.stringify({ jobId: updatedJob.id, technicianId: updatedJob.technicianId })
        }
      });

      return { updatedJob, assignment };
    });
  }

  /**
   * Rejects a recommendation with feedback for the intelligence model.
   */
  static async rejectRecommendation(organizationId: string, recommendationId: string, feedbackReason: string) {
    const recommendation = await prisma.intelligenceRecommendation.findUnique({
      where: { id: recommendationId, organizationId }
    });

    if (!recommendation) throw new Error('Recommendation not found');

    return await prisma.intelligenceRecommendation.update({
      where: { id: recommendationId },
      data: { status: 'REJECTED', feedbackReason }
    });
  }
}
