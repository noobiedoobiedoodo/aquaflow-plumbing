'use server';

import { prisma } from '@/lib/db';
import { requireRoleInOrg } from '@/lib/auth/session';
import { ROLES, ADMIN_ROLES, TECH_ROLES, AUDIT_EVENTS } from '@/lib/constants';
import { revalidatePath } from 'next/cache';
import { storage } from '@/lib/storage';

/**
 * Ensures the user has permission to modify this specific job.
 * TENANT ISOLATION: Enforces organizationId from session on every query.
 * Technicians can ONLY modify jobs explicitly assigned to them.
 */
async function verifyJobAccess(jobId: string) {
  const { user, organizationId } = await requireRoleInOrg(TECH_ROLES);

  // TENANT ISOLATION: Job must belong to the user's organization
  const job = await prisma.job.findFirst({
    where: { id: jobId, organizationId },
    select: { technicianId: true, status: true, organizationId: true },
  });

  if (!job) throw new Error('Job not found');

  const isTechnician = user.memberships.some((m) => m.role === ROLES.TECHNICIAN);
  const isAdmin = user.memberships.some((m) => ADMIN_ROLES.includes(m.role as any));

  if (isTechnician && !isAdmin) {
    // Look up the technician profile by userId to compare against job.technicianId
    const techProfile = await prisma.technician.findFirst({
      where: { userId: user.id, organizationId },
      select: { id: true },
    });
    
    if (!techProfile || job.technicianId !== techProfile.id) {
      throw new Error('Forbidden: You are not assigned to this job');
    }
  }

  // Prevent ANY mutations if the job is already completed or cancelled
  if (job.status === 'COMPLETED' || job.status === 'CANCELLED') {
    throw new Error(`Job is already ${job.status} and cannot be modified.`);
  }

  return { user, job, organizationId };
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  'ASSIGNED': ['EN_ROUTE', 'CANCELLED'],
  'EN_ROUTE': ['ARRIVED', 'CANCELLED'],
  'ARRIVED': ['WORKING', 'CANCELLED'],
  'WORKING': ['COMPLETED', 'CANCELLED'],
};

export async function updateJobState(jobId: string, newState: string) {
  const { UpdateJobStatusSchema } = await import('@/lib/validations/job');
  const validated = UpdateJobStatusSchema.safeParse({ jobId, status: newState as any });
  if (!validated.success) {
    throw new Error(`Validation Error: ${validated.error.issues.map(e => e.message).join(', ')}`);
  }

  const { user, job, organizationId } = await verifyJobAccess(jobId);

  const allowedNextStates = VALID_TRANSITIONS[job.status] || [];
  if (!allowedNextStates.includes(newState)) {
    throw new Error(`Invalid transition from ${job.status} to ${newState}`);
  }

  const result = await prisma.$transaction(async (tx) => {
    // Double-check state within transaction to prevent race conditions
    const currentJob = await tx.job.findUnique({ where: { id: jobId } });
    if (!currentJob || currentJob.status !== job.status) {
      throw new Error('State mismatch. Please refresh.');
    }

    // Update Job Status
    const updatedJob = await tx.job.update({
      where: { id: jobId },
      data: { status: newState },
    });

    // Log Activity (using correct schema field names: userId, action)
    await tx.jobActivity.create({
      data: {
        jobId,
        userId: user.id,
        action: AUDIT_EVENTS.STATUS_CHANGED,
        previousStatus: job.status,
        newStatus: newState,
        metadata: JSON.stringify({ description: `Marked as ${newState}` }),
      },
    });

    // If starting work, auto-create a Time Entry
    if (newState === 'WORKING') {
      const activeEntry = await tx.jobTimeEntry.findFirst({
        where: { jobId, technicianId: user.id, endedAt: null },
      });

      if (!activeEntry) {
        await tx.jobTimeEntry.create({
          data: {
            jobId,
            technicianId: user.id,
            startedAt: new Date(),
          },
        });
        await tx.jobActivity.create({
          data: {
            jobId,
            userId: user.id,
            action: AUDIT_EVENTS.TIME_STARTED,
            metadata: JSON.stringify({ description: 'Time clock started automatically.' }),
          },
        });
      }
    }

    // If pausing or completing, close open Time Entries
    if (newState === 'COMPLETED' || newState === 'CANCELLED') {
      const openEntries = await tx.jobTimeEntry.findMany({
        where: { jobId, technicianId: user.id, endedAt: null },
      });

      for (const entry of openEntries) {
        const endedAt = new Date();
        const durationSeconds = Math.max(0, Math.floor((endedAt.getTime() - entry.startedAt.getTime()) / 1000));
        await tx.jobTimeEntry.update({
          where: { id: entry.id },
          data: { endedAt, durationSeconds },
        });
      }

      if (newState === 'COMPLETED') {
        // Outbox event within the same transaction
        await tx.event.create({
          data: {
            organizationId,
            type: 'job.completed',
            entityType: 'Job',
            entityId: jobId,
            data: JSON.stringify({ jobId })
          }
        });
      }
    }

    // Outbox event for every status change
    await tx.event.create({
      data: {
        organizationId,
        type: 'job.status_changed',
        entityType: 'Job',
        entityId: jobId,
        data: JSON.stringify({ previousStatus: job.status, newStatus: newState })
      }
    });

    return updatedJob;
  });

  revalidatePath(`/tech/jobs/${jobId}`);
  revalidatePath('/tech/dashboard');
  return result;
}

export async function toggleTimeClock(jobId: string) {
  const { user, job } = await verifyJobAccess(jobId);

  if (job.status !== 'WORKING') {
    throw new Error('You can only track time while the job status is WORKING');
  }

  const result = await prisma.$transaction(async (tx) => {
    const currentJob = await tx.job.findUnique({ where: { id: jobId } });
    if (!currentJob || currentJob.status !== 'WORKING') {
      throw new Error('State mismatch. Please refresh.');
    }

    const openEntry = await tx.jobTimeEntry.findFirst({
      where: { jobId, technicianId: user.id, endedAt: null },
      orderBy: { startedAt: 'desc' },
    });

    if (openEntry) {
      // Clock out
      const endedAt = new Date();
      const durationSeconds = Math.max(0, Math.floor((endedAt.getTime() - openEntry.startedAt.getTime()) / 1000));
      
      const updated = await tx.jobTimeEntry.update({
        where: { id: openEntry.id },
        data: { endedAt, durationSeconds },
      });

      await tx.jobActivity.create({
        data: {
          jobId,
          userId: user.id,
          action: AUDIT_EVENTS.TIME_PAUSED,
          metadata: JSON.stringify({ description: `Work paused. Segment duration: ${Math.floor(durationSeconds/60)} minutes.` }),
        },
      });

      return { status: 'paused', entry: updated };
    } else {
      // Clock in
      const newEntry = await tx.jobTimeEntry.create({
        data: {
          jobId,
          technicianId: user.id,
          startedAt: new Date(),
        },
      });

      await tx.jobActivity.create({
        data: {
          jobId,
          userId: user.id,
          action: AUDIT_EVENTS.TIME_RESUMED,
          metadata: JSON.stringify({ description: 'Work resumed.' }),
        },
      });

      return { status: 'working', entry: newEntry };
    }
  });

  revalidatePath(`/tech/jobs/${jobId}`);
  return result;
}

export async function addJobNote(jobId: string, content: string, type: 'TECHNICIAN' | 'INTERNAL' = 'TECHNICIAN') {
  const { user } = await verifyJobAccess(jobId);

  if (!content || content.trim() === '') {
    throw new Error('Note content cannot be empty');
  }
  if (content.length > 5000) {
    throw new Error('Note content exceeds maximum length');
  }

  const result = await prisma.$transaction(async (tx) => {
    const note = await tx.jobNote.create({
      data: {
        jobId,
        authorId: user.id,
        content,
        type,
      },
    });

    await tx.jobActivity.create({
      data: {
        jobId,
        userId: user.id,
        action: AUDIT_EVENTS.NOTE_ADDED,
        metadata: JSON.stringify({ description: `Added a ${type.toLowerCase()} note.` }),
      },
    });

    return note;
  });

  revalidatePath(`/tech/jobs/${jobId}`);
  return result;
}

export async function addJobPart(jobId: string, name: string, quantity: number, unitCost: number) {
  const { user, job } = await verifyJobAccess(jobId);

  if (job.status !== 'WORKING') {
    throw new Error('Cannot add parts unless job is in WORKING state');
  }

  if (!name || name.trim() === '') throw new Error('Part name is required');
  if (quantity <= 0) throw new Error('Quantity must be greater than zero');
  if (unitCost < 0) throw new Error('Unit cost cannot be negative');

  const result = await prisma.$transaction(async (tx) => {
    const part = await tx.jobPart.create({
      data: {
        jobId,
        name,
        quantity,
        unitCost,
        createdById: user.id,
      },
    });

    await tx.jobActivity.create({
      data: {
        jobId,
        userId: user.id,
        action: AUDIT_EVENTS.PART_ADDED,
        metadata: JSON.stringify({ description: `Recorded material: ${quantity}x ${name} at $${unitCost.toFixed(2)}` }),
      },
    });

    return part;
  });

  revalidatePath(`/tech/jobs/${jobId}`);
  return result;
}

/**
 * Two-phase commit for capturing signature and completing job.
 */
export async function captureSignatureAndComplete(jobId: string, signatureBase64: string, signerName: string) {
  const { user, job, organizationId } = await verifyJobAccess(jobId);

  if (job.status !== 'WORKING') {
    throw new Error('Job must be in WORKING state to complete it');
  }

  // Validate Signature Payload
  if (!signerName || signerName.trim() === '') throw new Error('Signer name is required');
  if (!signatureBase64 || !signatureBase64.startsWith('data:image/png;base64,')) {
    throw new Error('Invalid signature format. Must be a PNG data URI.');
  }
  
  if (signatureBase64.length > 2 * 1024 * 1024) {
    throw new Error('Signature payload too large.');
  }

  const base64Data = signatureBase64.replace(/^data:image\/png;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');

  if (buffer.length === 0) {
    throw new Error('Signature payload is empty.');
  }

  // Upload File (Phase 1)
  const fileName = `signature-${jobId}-${Date.now()}.png`;
  const uploadResult = await storage.uploadFile(buffer, fileName, 'image/png');
  const storageKey = uploadResult.storageKey;

  // Database Transaction (Phase 2)
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Concurrency check
      const currentJob = await tx.job.findUnique({
        where: { id: jobId },
        include: { appointment: true }
      });
      if (!currentJob || currentJob.status !== 'WORKING') {
        throw new Error('Job is no longer in WORKING state.');
      }

      // Check if signature already exists
      const existingSig = await tx.customerSignature.findUnique({ where: { jobId } });
      if (existingSig) {
        throw new Error('A signature has already been recorded for this job.');
      }

      // Save Signature
      const signature = await tx.customerSignature.create({
        data: {
          jobId,
          signerName,
          storageKey,
        },
      });

      // Close open time entries
      const openEntries = await tx.jobTimeEntry.findMany({
        where: { jobId, technicianId: user.id, endedAt: null },
      });

      for (const entry of openEntries) {
        const endedAt = new Date();
        const durationSeconds = Math.max(0, Math.floor((endedAt.getTime() - entry.startedAt.getTime()) / 1000));
        await tx.jobTimeEntry.update({
          where: { id: entry.id },
          data: { endedAt, durationSeconds },
        });
      }

      // Mark job as COMPLETED
      const updatedJob = await tx.job.update({
        where: { id: jobId },
        data: { status: 'COMPLETED', completedAt: new Date() },
        include: { appointment: true }
      });

      // Accuracy Tracking for OperationalForecast
      const forecast = await tx.operationalForecast.findFirst({
        where: { jobId },
        orderBy: { createdAt: 'desc' }
      });

      if (forecast && updatedJob.completedAt && updatedJob.appointment) {
        // Calculate if the job was late based on appointment endTime
        const appointmentDate = updatedJob.appointment.date;
        const endTimeParts = updatedJob.appointment.endTime.split(':');
        const scheduledEnd = new Date(appointmentDate);
        scheduledEnd.setHours(parseInt(endTimeParts[0], 10), parseInt(endTimeParts[1], 10), 0, 0);
        
        const actualLate = updatedJob.completedAt.getTime() > scheduledEnd.getTime();
        const predictionErrorSeconds = Math.round((updatedJob.completedAt.getTime() - forecast.predictedCompletionAt.getTime()) / 1000);
        
        await tx.operationalForecast.update({
          where: { id: forecast.id },
          data: {
            actualCompletionAt: updatedJob.completedAt,
            actualLate,
            predictionErrorSeconds
          }
        });
      }

      // Log completion activities
      await tx.jobActivity.create({
        data: {
          jobId,
          userId: user.id,
          action: AUDIT_EVENTS.SIGNATURE_CAPTURED,
          metadata: JSON.stringify({ description: `Signature captured. Authorized by: ${signerName}` }),
        },
      });

      await tx.jobActivity.create({
        data: {
          jobId,
          userId: user.id,
          action: AUDIT_EVENTS.JOB_COMPLETED,
          previousStatus: 'WORKING',
          newStatus: 'COMPLETED',
          metadata: JSON.stringify({ description: 'Job completed' }),
        },
      });

      // Free the technician's availability status
      if (currentJob.technicianId) {
        await tx.technician.update({
          where: { id: currentJob.technicianId },
          data: { availabilityStatus: 'AVAILABLE' }
        });
      }

      // OUTBOX: Generate Event for Notification Worker
      await tx.event.create({
        data: {
          organizationId,
          type: 'job.completed',
          entityType: 'Job',
          entityId: jobId,
          data: JSON.stringify({
            technicianId: currentJob.technicianId,
            completedAt: updatedJob.completedAt,
          }),
        }
      });

      return { updatedJob, signature };
    });

    revalidatePath(`/tech/jobs/${jobId}`);
    revalidatePath('/tech/dashboard');
    return result;

  } catch (error) {
    console.error('DB transaction failed for signature completion, cleaning up uploaded file...', error);
    try {
      await storage.deleteFile(storageKey);
    } catch (cleanupError) {
      console.error('Failed to cleanup orphaned file:', cleanupError);
    }
    throw error;
  }
}

/**
 * Uploads a job photo with strict MIME, size, and tenant/technician verification.
 */
export async function uploadJobPhoto(
  jobId: string,
  base64DataUrl: string,
  type: 'BEFORE' | 'AFTER' | 'DIAGNOSTIC' | 'OTHER' = 'OTHER',
  caption?: string,
  customerVisible: boolean = false
) {
  const { user, job, organizationId } = await verifyJobAccess(jobId);

  if (!base64DataUrl || !base64DataUrl.startsWith('data:image/')) {
    throw new Error('Invalid image format. Must be a valid image data URI.');
  }

  // Validate allowed MIME types (PNG, JPEG, WebP)
  const match = base64DataUrl.match(/^data:(image\/(png|jpeg|jpg|webp));base64,(.+)$/);
  if (!match) {
    throw new Error('Unsupported image format. Allowed formats: PNG, JPEG, WebP.');
  }

  const rawContentType = match[1];
  const contentType = rawContentType === 'image/jpg' ? 'image/jpeg' : rawContentType;
  const extension = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';
  const base64Data = match[3];
  const buffer = Buffer.from(base64Data, 'base64');

  if (buffer.length === 0) {
    throw new Error('Image file is empty.');
  }

  // Enforce 10MB maximum file size limit
  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error('Image size exceeds 10MB maximum limit.');
  }

  // Generate private storage key
  const fileName = `photo-${jobId}-${Date.now()}.${extension}`;
  const uploadResult = await storage.uploadFile(buffer, fileName, contentType);
  const storageKey = uploadResult.storageKey;
  const fileUrl = `/api/files/${storageKey}`;

  try {
    const photo = await prisma.$transaction(async (tx) => {
      const createdPhoto = await tx.jobPhoto.create({
        data: {
          jobId,
          uploadedById: user.id,
          type,
          storageKey,
          url: fileUrl,
          caption: caption?.trim() || null,
          customerVisible: !!customerVisible,
        },
      });

      await tx.jobActivity.create({
        data: {
          jobId,
          userId: user.id,
          action: AUDIT_EVENTS.PHOTO_UPLOADED,
          metadata: JSON.stringify({
            photoId: createdPhoto.id,
            type,
            caption: caption?.trim() || null,
          }),
        },
      });

      await tx.event.create({
        data: {
          organizationId,
          type: 'job.photo_added',
          entityType: 'Job',
          entityId: jobId,
          data: JSON.stringify({
            photoId: createdPhoto.id,
            type,
            uploadedById: user.id,
          }),
        },
      });

      return createdPhoto;
    });

    revalidatePath(`/tech/jobs/${jobId}`);
    return photo;
  } catch (error) {
    console.error('DB transaction failed for photo upload, cleaning up uploaded file...', error);
    try {
      await storage.deleteFile(storageKey);
    } catch (cleanupError) {
      console.error('Failed to cleanup orphaned file:', cleanupError);
    }
    throw error;
  }
}

/**
 * Deletes a job photo after verifying tenant & technician access.
 */
export async function deleteJobPhoto(jobId: string, photoId: string) {
  const { user, organizationId } = await verifyJobAccess(jobId);

  const photo = await prisma.jobPhoto.findFirst({
    where: { id: photoId, jobId },
  });

  if (!photo) {
    throw new Error('Photo not found');
  }

  await prisma.$transaction(async (tx) => {
    await tx.jobPhoto.delete({
      where: { id: photoId },
    });

    await tx.jobActivity.create({
      data: {
        jobId,
        userId: user.id,
        action: 'PHOTO_DELETED',
        metadata: JSON.stringify({ photoId, storageKey: photo.storageKey }),
      },
    });
  });

  try {
    await storage.deleteFile(photo.storageKey);
  } catch (err) {
    console.error('Failed to delete underlying storage file for photo:', err);
  }

  revalidatePath(`/tech/jobs/${jobId}`);
  return { success: true };
}

