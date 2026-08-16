import { z } from 'zod';

/**
 * Common regex patterns.
 */
export const PHONE_REGEX = /^(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})$/;
export const CANADIAN_POSTAL_CODE_REGEX = /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/;
export const TIME_HH_MM_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Standard email validation schema.
 */
export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Email address is required')
  .email('Please enter a valid email address');

export type EmailInput = z.infer<typeof emailSchema>;

/**
 * Standard North American phone number validation schema.
 */
export const phoneSchema = z
  .string()
  .trim()
  .min(1, 'Phone number is required')
  .regex(PHONE_REGEX, 'Please enter a valid phone number (e.g. 204-555-0199)');

export type PhoneInput = z.infer<typeof phoneSchema>;

/**
 * Canadian postal code validation schema (e.g., R3C 1A1 or R3C1A1).
 */
export const postalCodeSchema = z
  .string()
  .trim()
  .min(1, 'Postal code is required')
  .regex(CANADIAN_POSTAL_CODE_REGEX, 'Please enter a valid Canadian postal code (e.g. R3C 1A1)');

export type PostalCodeInput = z.infer<typeof postalCodeSchema>;

/**
 * UUID validation schema.
 */
export const uuidSchema = z
  .string()
  .uuid('Invalid identifier format');

export type UuidInput = z.infer<typeof uuidSchema>;

/**
 * Pagination query parameters validation schema.
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1, 'Page must be at least 1').default(1),
  limit: z.coerce.number().int().min(1, 'Limit must be at least 1').max(100, 'Limit cannot exceed 100').default(20),
});

export type PaginationInput = z.infer<typeof paginationSchema>;
