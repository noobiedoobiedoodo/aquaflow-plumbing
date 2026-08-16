import { z } from 'zod';

export const CreateCustomerSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(50),
  lastName: z.string().min(1, 'Last name is required').max(50),
  email: z.string().email('Invalid email address').max(100),
  phone: z.string().min(10).max(20),
});

export const CreateEstimateSchema = z.object({
  serviceId: z.string().uuid('Invalid service ID'),
  address: z.string().min(5, 'Address is required').max(200),
  city: z.string().min(2, 'City is required').max(100),
  province: z.string().length(2, 'Province code must be 2 characters'),
  postalCode: z.string().min(5).max(10),
  preferredDate: z.string().datetime(),
  preferredTime: z.enum(['MORNING', 'AFTERNOON', 'EVENING']),
  notes: z.string().max(1000).optional(),
});
