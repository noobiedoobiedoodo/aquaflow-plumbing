'use server';

import { prisma } from '@/lib/db';
import { requireRoleInOrg } from '@/lib/auth/session';
import { revalidatePath } from 'next/cache';
import { ADMIN_ROLES } from '@/lib/constants';
import { AssignJobSchema } from '@/lib/validations/job';

export async function assignJob(jobId: string, technicianId: string) {
  try {
    // 0. Validate input boundary
    const validated = AssignJobSchema.safeParse({ jobId, technicianId });
    if (!validated.success) {
      throw new Error(`Validation Error: ${validated.error.issues.map(e => e.message).join(', ')}`);
    }

    // 1. Verify Role AND derive organizationId from session (TENANT ISOLATION)
    const { user, organizationId } = await requireRoleInOrg(ADMIN_ROLES);

    // 2. Execute Atomic Transaction
    const result = await prisma.$transaction(async (tx) => {
      // Validate Job exists AND belongs to the user's organization
      const job = await tx.job.findFirst({
        where: { id: jobId, organizationId },
        include: { appointment: true },
      });

      if (!job) throw new Error('Job not found');

      // Validate Technician exists, is Active, AND belongs to the same organization
      const technician = await tx.technician.findFirst({
        where: { id: technicianId, organizationId },
      });

      if (!technician || !technician.isActive) {
        throw new Error('Technician is not available or does not exist');
      }

      // Update Job status to ASSIGNED and link Technician
      const updatedJob = await tx.job.update({
        where: { id: jobId },
        data: {
          status: 'ASSIGNED',
          technicianId,
        },
      });

      // Update related Appointment status to SCHEDULED
      await tx.appointment.update({
        where: { id: job.appointmentId },
        data: {
          status: 'SCHEDULED',
        },
      });

      // Log the JobActivity Audit Trail
      await tx.jobActivity.create({
        data: {
          jobId: job.id,
          userId: user.id,
          action: 'TECHNICIAN_ASSIGNED',
          previousStatus: job.status,
          newStatus: 'ASSIGNED',
          metadata: JSON.stringify({ technicianId, technicianName: `${technician.firstName} ${technician.lastName}` }),
        },
      });

      // OUTBOX: Generate Event for Notification Worker (B8 fix)
      await tx.event.create({
        data: {
          organizationId,
          type: 'job.assigned',
          entityType: 'Job',
          entityId: job.id,
          data: JSON.stringify({
            technicianId,
            technicianName: `${technician.firstName} ${technician.lastName}`,
          }),
        }
      });

      return updatedJob;
    });

    // 3. Revalidate the dashboard
    revalidatePath('/dashboard');
    
    return { success: true, job: result };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to dispatch job';
    console.error('Dispatch error:', error);
    return { success: false, error: message };
  }
}
