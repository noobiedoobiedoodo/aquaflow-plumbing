import { z } from 'zod';
import {
  emailSchema,
  phoneSchema,
  postalCodeSchema,
  uuidSchema,
  TIME_HH_MM_REGEX,
} from './common.schema';

/**
 * Urgency level enum.
 */
export const UrgencyLevel = z.enum(['LOW', 'NORMAL', 'HIGH', 'EMERGENCY']);
export type UrgencyLevel = z.infer<typeof UrgencyLevel>;

/**
 * Step 1: Select Service.
 */
export const serviceStepSchema = z.object({
  serviceId: uuidSchema,
});

export type ServiceStepInput = z.infer<typeof serviceStepSchema>;

/**
 * Step 2: Describe the Problem.
 */
export const problemStepSchema = z.object({
  problemDescription: z
    .string()
    .trim()
    .min(10, 'Please describe your plumbing issue in at least 10 characters')
    .max(1000, 'Problem description cannot exceed 1000 characters'),
  urgency: UrgencyLevel.optional().default('NORMAL'),
});

export type ProblemStepInput = z.infer<typeof problemStepSchema>;

/**
 * Step 3: Select Appointment Date and Time Slot.
 */
export const appointmentStepSchema = z.object({
  date: z
    .string()
    .trim()
    .min(1, 'Please select an appointment date')
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted as YYYY-MM-DD'),
  startTime: z
    .string()
    .trim()
    .regex(TIME_HH_MM_REGEX, 'Start time must be formatted as HH:mm (e.g. 09:00)'),
  endTime: z
    .string()
    .trim()
    .regex(TIME_HH_MM_REGEX, 'End time must be formatted as HH:mm (e.g. 11:00)'),
});

export type AppointmentStepInput = z.infer<typeof appointmentStepSchema>;

/**
 * Step 4: Service Location.
 */
export const locationStepSchema = z.object({
  address: z
    .string()
    .trim()
    .min(1, 'Street address is required')
    .max(200, 'Address is too long'),
  unit: z
    .string()
    .trim()
    .max(50, 'Unit/suite number is too long')
    .optional(),
  city: z
    .string()
    .trim()
    .min(1, 'City is required')
    .max(100, 'City is too long'),
  province: z
    .string()
    .trim()
    .min(2, 'Province code required')
    .max(2, 'Province code must be 2 characters (e.g. MB)')
    .default('MB'),
  postalCode: postalCodeSchema,
});

export type LocationStepInput = z.infer<typeof locationStepSchema>;

/**
 * Step 5: Customer Information.
 */
export const customerStepSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, 'First name is required')
    .max(100, 'First name is too long'),
  lastName: z
    .string()
    .trim()
    .min(1, 'Last name is required')
    .max(100, 'Last name is too long'),
  email: emailSchema,
  phone: phoneSchema,
});

export type CustomerStepInput = z.infer<typeof customerStepSchema>;

/**
 * Final combined booking submission schema.
 */
export const bookingSubmitSchema = z.object({
  serviceId: uuidSchema,
  problemDescription: z
    .string()
    .trim()
    .min(10, 'Please describe your plumbing issue in at least 10 characters')
    .max(1000, 'Problem description cannot exceed 1000 characters'),
  urgency: UrgencyLevel.optional().default('NORMAL'),
  date: z
    .string()
    .trim()
    .min(1, 'Please select an appointment date')
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted as YYYY-MM-DD'),
  startTime: z
    .string()
    .trim()
    .regex(TIME_HH_MM_REGEX, 'Start time must be formatted as HH:mm'),
  endTime: z
    .string()
    .trim()
    .regex(TIME_HH_MM_REGEX, 'End time must be formatted as HH:mm'),
  address: z
    .string()
    .trim()
    .min(1, 'Street address is required')
    .max(200, 'Address is too long'),
  unit: z
    .string()
    .trim()
    .max(50, 'Unit/suite number is too long')
    .optional(),
  city: z
    .string()
    .trim()
    .min(1, 'City is required')
    .max(100, 'City is too long'),
  province: z
    .string()
    .trim()
    .min(2, 'Province code required')
    .max(2, 'Province code must be 2 characters (e.g. MB)')
    .default('MB'),
  postalCode: postalCodeSchema,
  firstName: z
    .string()
    .trim()
    .min(1, 'First name is required')
    .max(100, 'First name is too long'),
  lastName: z
    .string()
    .trim()
    .min(1, 'Last name is required')
    .max(100, 'Last name is too long'),
  email: emailSchema,
  phone: phoneSchema,
  customerNotes: z.string().trim().max(1000).optional(),
});

export type BookingSubmitInput = z.infer<typeof bookingSubmitSchema>;

/**
 * Rapid Emergency Request Schema.
 */
export const emergencyRequestSchema = z.object({
  serviceId: z.string().trim().min(1, 'Service selection is required'),
  problemDescription: z
    .string()
    .trim()
    .min(5, 'Please describe the emergency issue')
    .max(1000, 'Description cannot exceed 1000 characters'),
  isActiveDamage: z.boolean().default(true),
  name: z
    .string()
    .trim()
    .min(1, 'Your name is required')
    .max(100, 'Name is too long'),
  phone: phoneSchema,
  email: z
    .string()
    .trim()
    .email('Please enter a valid email address')
    .optional()
    .or(z.literal('')),
  address: z
    .string()
    .trim()
    .min(1, 'Street address is required')
    .max(200, 'Address is too long'),
  city: z
    .string()
    .trim()
    .min(1, 'City is required')
    .max(100, 'City is too long'),
  postalCode: postalCodeSchema,
});

export type EmergencyRequestInput = z.infer<typeof emergencyRequestSchema>;
