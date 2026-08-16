import { z } from 'zod';

export const CreateJobSchema = z.object({
  customerId: z.string().uuid(),
  propertyId: z.string().uuid(),
  serviceId: z.string().uuid(),
  scheduledStart: z.string().datetime(),
  scheduledEnd: z.string().datetime(),
  notes: z.string().max(2000).optional(),
});

export const UpdateJobStatusSchema = z.object({
  jobId: z.string().uuid(),
  status: z.enum(['CREATED', 'ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'WORKING', 'COMPLETED', 'CANCELLED', 'REJECTED']),
  reason: z.string().max(500).optional()
});

export const AssignJobSchema = z.object({
  jobId: z.string().uuid(),
  technicianId: z.string().uuid()
});
