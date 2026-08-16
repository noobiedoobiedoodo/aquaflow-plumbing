import { prisma } from '@/lib/db';
import { StatisticalForecaster } from './statistical-forecaster';
import { ConflictEngine } from './conflict-engine';

export class ScheduleOptimizer {
  
  static async calculateCascades(organizationId: string) {
    const activeJobs = await prisma.job.findMany({
      where: { organizationId, status: { in: ['EN_ROUTE', 'WORKING'] } },
      include: { appointment: { include: { service: true, property: true } }, technician: true }
    });

    const cascadingDelays = [];

    for (const job of activeJobs) {
      if (!job.technicianId) continue;

      const forecast = await StatisticalForecaster.getForecast(job.id, job.technicianId);
      if (!forecast || forecast.lateProbability < 0.5) continue;

      const predictedCompletionTime = forecast.predictedCompletionAt.getTime();
      const scheduledStartDate = new Date(job.appointment.date);
      const [sh, sm] = job.appointment.startTime.split(':').map(Number);
      scheduledStartDate.setHours(sh, sm, 0, 0);
      const scheduledEnd = scheduledStartDate.getTime() + 60 * 60000; // default 1 hr for MVP
      const lateMinutes = Math.round((predictedCompletionTime - scheduledEnd) / 60000);

      if (lateMinutes > 15) {
        const downstreamJobs = await prisma.job.findMany({
          where: {
            technicianId: job.technicianId,
            status: { in: ['CREATED', 'ASSIGNED'] },
            appointment: { date: { gt: new Date() } }
          },
          include: { appointment: true },
          orderBy: { appointment: { date: 'asc' } }
        });

        if (downstreamJobs.length > 0) {
          cascadingDelays.push({
            causeJobId: job.id,
            technicianName: job.technician?.firstName || 'Unknown',
            lateMinutes,
            downstreamCount: downstreamJobs.length,
            affectedJobs: downstreamJobs
          });

          const nextJob = downstreamJobs[0];
          
          // Check if there is already a PENDING proposal for this job
          const existingProposal = await prisma.optimizationProposal.findFirst({
            where: { jobId: nextJob.id, status: 'PENDING' }
          });
          
          if (!existingProposal) {
            const availableTechs = await prisma.technician.findMany({
               where: { organizationId, isActive: true, id: { not: job.technicianId } }
            });

            for (const altTech of availableTechs) {
              const evaluation = await ConflictEngine.evaluateAssignment(nextJob.id, altTech.id);
              if (evaluation.hardConflicts.length === 0) {
                
                const reasoningJson = JSON.stringify({
                  trigger: "TECHNICIAN_DELAY",
                  affectedJobs: downstreamJobs.length,
                  originalTechnician: { id: job.technicianId },
                  proposedTechnician: { id: altTech.id },
                  expectedImpact: {
                    jobsProtected: downstreamJobs.length,
                    delayReductionMinutes: lateMinutes
                  },
                  conflictCheck: { passed: true, softConflicts: 0 }
                });

                await prisma.optimizationProposal.create({
                  data: {
                    organizationId,
                    jobId: nextJob.id,
                    originalTechnicianId: job.technicianId,
                    proposedTechnicianId: altTech.id,
                    reason: `Reassign #${nextJob.id.slice(-6)} to ${altTech.firstName} to avoid ${lateMinutes}m cascade delay from ${job.technician?.firstName}`,
                    reasoningJson,
                    predictedDelayBefore: lateMinutes,
                    predictedDelayAfter: 0,
                    status: 'PENDING'
                  }
                });
                break;
              }
            }
          }
        }
      }
    }

    const proposals = await prisma.optimizationProposal.findMany({
      where: { organizationId, status: 'PENDING' },
      include: { proposedTechnician: true }
    });

    return { cascadingDelays, proposals };
  }

  static async acceptProposal(proposalId: string, organizationId: string) {
    return await prisma.$transaction(async (tx) => {
      const proposal = await tx.optimizationProposal.findUnique({ where: { id: proposalId } });
      if (!proposal || proposal.status !== 'PENDING') throw new Error('Proposal not valid or already resolved.');

      const job = await tx.job.findUnique({ where: { id: proposal.jobId }, include: { appointment: true } });
      if (!job || job.organizationId !== organizationId) throw new Error('Job not found or access denied');
      
      if (job.technicianId !== proposal.originalTechnicianId) {
        await tx.optimizationProposal.update({ where: { id: proposalId }, data: { status: 'INVALID', resolvedAt: new Date() }});
        throw new Error('STALE_STATE: Job was already reassigned by another dispatcher.');
      }
      if (['EN_ROUTE', 'ARRIVED', 'WORKING', 'COMPLETED'].includes(job.status)) {
        await tx.optimizationProposal.update({ where: { id: proposalId }, data: { status: 'INVALID', resolvedAt: new Date() }});
        throw new Error('STALE_STATE: Job has already progressed past ASSIGNED.');
      }

      const evaluation = await ConflictEngine.evaluateAssignment(job.id, proposal.proposedTechnicianId);
      
      if (evaluation.hardConflicts.length > 0) {
        await tx.optimizationProposal.update({ where: { id: proposalId }, data: { status: 'EXPIRED', resolvedAt: new Date() }});
        throw new Error('STALE_STATE: The proposed technician now has a conflict.');
      }

      const updatedJob = await tx.job.update({
        where: { id: job.id },
        data: { technicianId: proposal.proposedTechnicianId }
      });

      // Update proposal with observed metrics placeholder. 
      // In a real system, actual delays would be reconciled by a background worker after job completion.
      await tx.optimizationProposal.update({
        where: { id: proposalId },
        data: { 
          status: 'ACCEPTED', 
          resolvedAt: new Date(),
          observedDelayReduction: proposal.predictedDelayBefore // Assuming full reduction for now
        }
      });

      await tx.jobActivity.create({
        data: {
          jobId: job.id,
          userId: null,
          action: 'REASSIGNED',
          metadata: JSON.stringify({
            reason: proposal.reason,
            originalTechnicianId: proposal.originalTechnicianId,
            proposedTechnicianId: proposal.proposedTechnicianId,
          }),
        },
      });

      return updatedJob;
    });
  }
}
