import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { v4 as uuidv4 } from 'uuid';

/**
 * Merge Tailwind CSS classes with conflict resolution.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Generates a formatted ID.
 * Example: generateId('PL') => 'PL-2026-X8Y9Z0'
 */
export function generateId(prefix: string = 'PL'): string {
  const year = new Date().getFullYear();
  const randomChars = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${year}-${randomChars}`;
}

/**
 * Generate a human-readable appointment number.
 * Format: PL-YYYY-NNNNNN (e.g., PL-2026-000184)
 * The numeric suffix is random to avoid sequential guessing.
 */
export function generateAppointmentNumber(): string {
  const year = new Date().getFullYear();
  const num = Math.floor(Math.random() * 999999)
    .toString()
    .padStart(6, '0');
  return `PL-${year}-${num}`;
}

/**
 * Generate a human-readable quote number.
 * Format: QT-YYYY-NNNNNN
 */
export function generateQuoteNumber(): string {
  const year = new Date().getFullYear();
  const num = Math.floor(Math.random() * 999999)
    .toString()
    .padStart(6, '0');
  return `QT-${year}-${num}`;
}

/**
 * Generate a human-readable invoice number.
 * Format: INV-YYYY-NNNNNN
 */
export function generateInvoiceNumber(): string {
  const year = new Date().getFullYear();
  const num = Math.floor(Math.random() * 999999)
    .toString()
    .padStart(6, '0');
  return `INV-${year}-${num}`;
}

/**
 * Generate a cryptographically random token for sessions, password reset, etc.
 */
export function generateToken(): string {
  return uuidv4() + '-' + uuidv4();
}

/**
 * Format a phone number for display.
 */
export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  if (cleaned.length === 11 && cleaned[0] === '1') {
    return `(${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  return phone;
}

/**
 * Format currency amount.
 */
export function formatCurrency(amount: number, currency = 'CAD'): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency,
  }).format(amount);
}

/**
 * Format a date for display.
 */
export function formatDate(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...options,
  });
}

/**
 * Format time string "HH:mm" for display.
 */
export function formatTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

/**
 * Capitalize first letter of each word.
 */
export function titleCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/(?:^|\s)\S/g, (match) => match.toUpperCase());
}

/**
 * Slugify a string.
 */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Check if a feature is enabled via environment variable.
 */
export function isFeatureEnabled(envVar: string): boolean {
  const value = process.env[envVar];
  return Boolean(value && value.trim().length > 0);
}

/**
 * Appointment status display labels and colors.
 */
export const APPOINTMENT_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Pending', color: '#8994A3' },
  CONFIRMED: { label: 'Confirmed', color: '#0088FF' },
  SCHEDULED: { label: 'Scheduled', color: '#0088FF' },
  EN_ROUTE: { label: 'En Route', color: '#00E5FF' },
  ARRIVED: { label: 'Arrived', color: '#00E5FF' },
  DIAGNOSING: { label: 'Diagnosing', color: '#B87333' },
  WORKING: { label: 'In Progress', color: '#B87333' },
  COMPLETED: { label: 'Completed', color: '#22C55E' },
  CANCELLED: { label: 'Cancelled', color: '#EF4444' },
  NO_SHOW: { label: 'No Show', color: '#EF4444' },
};
