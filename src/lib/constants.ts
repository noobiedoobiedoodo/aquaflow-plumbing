// ============================================================================
// COMPANY CONFIGURATION
// ============================================================================
// All values marked /* PLACEHOLDER */ must be replaced with real business
// information before production deployment. These are intentionally obvious
// non-production values.
// ============================================================================

export const COMPANY = {
  /** @placeholder Replace with real company name */
  name: 'AquaFlow Plumbing' /* PLACEHOLDER */,
  /** @placeholder Replace with real tagline */
  tagline: 'Plumbing, Engineered Right.' /* PLACEHOLDER */,
  /** @placeholder Replace with real phone number */
  phone: '(204) 555-0199' /* PLACEHOLDER */,
  /** @placeholder Replace with real emergency phone */
  emergencyPhone: '(204) 555-0911' /* PLACEHOLDER */,
  /** @placeholder Replace with real email */
  email: 'info@aquaflowplumbing.com' /* PLACEHOLDER */,
  /** @placeholder Replace with real address */
  address: '123 Main Street' /* PLACEHOLDER */,
  city: 'Winnipeg' /* PLACEHOLDER */,
  province: 'MB',
  postalCode: 'R3C 1A1' /* PLACEHOLDER */,
  country: 'CA',
  timezone: 'America/Winnipeg',
  /** @placeholder Replace with real website URL */
  url: 'https://aquaflowplumbing.com' /* PLACEHOLDER */,
} as const;

export const BRAND = {
  colors: {
    background: '#05080B',
    backgroundSecondary: '#0A1016',
    primaryBlue: '#0088FF',
    waterCyan: '#00E5FF',
    copper: '#B87333',
    copperLight: '#D4956B',
    white: '#F5F7FA',
    mutedText: '#8994A3',
    success: '#22C55E',
    warning: '#F59E0B',
    danger: '#EF4444',
    border: '#1A2332',
    cardBg: '#0D1520',
    glassBg: 'rgba(10, 16, 22, 0.8)',
  },
} as const;

// ============================================================================
// SERVICE DEFINITIONS
// ============================================================================

export interface ServiceDefinition {
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  category: string;
  icon: string;
  estimatedDuration: number;
  isEmergency: boolean;
  sortOrder: number;
}

export const DEFAULT_SERVICES: ServiceDefinition[] = [
  {
    name: 'Emergency Plumbing',
    slug: 'emergency-plumbing',
    shortDescription: 'Immediate response for urgent plumbing emergencies.',
    description: 'When a plumbing emergency strikes, every minute counts. Our emergency plumbing team provides rapid response for burst pipes, major leaks, sewage backups, and other urgent situations that require immediate professional attention.',
    category: 'Emergency',
    icon: 'AlertTriangle',
    estimatedDuration: 120,
    isEmergency: true,
    sortOrder: 0,
  },
  {
    name: 'Drain Cleaning',
    slug: 'drain-cleaning',
    shortDescription: 'Professional clearing of clogged and slow drains.',
    description: 'Our professional drain cleaning service uses advanced equipment to clear stubborn blockages, remove buildup, and restore proper drainage throughout your home. We handle kitchen drains, bathroom drains, floor drains, and main sewer lines.',
    category: 'Drain',
    icon: 'ArrowDownToLine',
    estimatedDuration: 90,
    isEmergency: false,
    sortOrder: 1,
  },
  {
    name: 'Sewer Services',
    slug: 'sewer-services',
    shortDescription: 'Comprehensive sewer line inspection, repair, and replacement.',
    description: 'From camera inspections to full sewer line replacements, our team handles all aspects of sewer service. We identify problems accurately with video inspection technology and provide lasting solutions for damaged, blocked, or aging sewer lines.',
    category: 'Sewer',
    icon: 'ScanLine',
    estimatedDuration: 180,
    isEmergency: false,
    sortOrder: 2,
  },
  {
    name: 'Leak Detection',
    slug: 'leak-detection',
    shortDescription: 'Advanced technology to locate hidden leaks.',
    description: 'Hidden leaks can cause significant damage to your property. Our leak detection service uses advanced acoustic and thermal technology to pinpoint leaks behind walls, under floors, and in underground pipes without unnecessary demolition.',
    category: 'Detection',
    icon: 'Search',
    estimatedDuration: 120,
    isEmergency: false,
    sortOrder: 3,
  },
  {
    name: 'Water Heaters',
    slug: 'water-heaters',
    shortDescription: 'Installation, repair, and replacement of water heaters.',
    description: 'Whether you need a new water heater installed, your existing unit repaired, or an upgrade to a more efficient system, our technicians handle all types of water heaters including traditional tank and heat pump systems.',
    category: 'Water Heater',
    icon: 'Flame',
    estimatedDuration: 180,
    isEmergency: false,
    sortOrder: 4,
  },
  {
    name: 'Tankless Water Heaters',
    slug: 'tankless-water-heaters',
    shortDescription: 'On-demand hot water with tankless systems.',
    description: 'Tankless water heaters provide endless hot water on demand while saving energy and space. We install, maintain, and repair all major brands of tankless water heating systems.',
    category: 'Water Heater',
    icon: 'Zap',
    estimatedDuration: 240,
    isEmergency: false,
    sortOrder: 5,
  },
  {
    name: 'Toilet Repair',
    slug: 'toilet-repair',
    shortDescription: 'Expert repair and replacement for all toilet issues.',
    description: 'From running toilets and weak flushes to complete replacements, we handle all toilet repairs efficiently. Our technicians diagnose the issue accurately and provide lasting solutions.',
    category: 'Fixtures',
    icon: 'Droplets',
    estimatedDuration: 60,
    isEmergency: false,
    sortOrder: 6,
  },
  {
    name: 'Faucet Repair',
    slug: 'faucet-repair',
    shortDescription: 'Repair and installation of kitchen and bathroom faucets.',
    description: 'Dripping faucets waste water and money. We repair and replace all types of faucets including kitchen, bathroom, utility, and outdoor faucets with quality fixtures that last.',
    category: 'Fixtures',
    icon: 'Droplet',
    estimatedDuration: 60,
    isEmergency: false,
    sortOrder: 7,
  },
  {
    name: 'Sump Pumps',
    slug: 'sump-pumps',
    shortDescription: 'Installation, repair, and maintenance of sump pump systems.',
    description: 'Protect your basement from flooding with a properly functioning sump pump system. We install new systems, repair existing pumps, and provide backup power solutions for reliable protection.',
    category: 'Pumps',
    icon: 'ArrowUpFromLine',
    estimatedDuration: 120,
    isEmergency: false,
    sortOrder: 8,
  },
  {
    name: 'Garbage Disposals',
    slug: 'garbage-disposals',
    shortDescription: 'Installation and repair of garbage disposal units.',
    description: 'We install and repair all major brands of garbage disposals. Whether your unit needs a quick fix or a complete replacement, our technicians get your kitchen back to full functionality.',
    category: 'Fixtures',
    icon: 'RotateCcw',
    estimatedDuration: 60,
    isEmergency: false,
    sortOrder: 9,
  },
  {
    name: 'Pipe Repair',
    slug: 'pipe-repair',
    shortDescription: 'Professional repair of damaged, leaking, or corroded pipes.',
    description: 'From minor leaks to major pipe damage, our pipe repair service addresses all types of pipe problems. We work with copper, PEX, PVC, and cast iron piping systems throughout your property.',
    category: 'Pipes',
    icon: 'Wrench',
    estimatedDuration: 120,
    isEmergency: false,
    sortOrder: 10,
  },
  {
    name: 'Pipe Replacement',
    slug: 'pipe-replacement',
    shortDescription: 'Full pipe replacement and repiping services.',
    description: 'When repairs are no longer sufficient, our pipe replacement service provides comprehensive repiping solutions. We replace aging, corroded, or damaged pipes with modern, durable materials.',
    category: 'Pipes',
    icon: 'Replace',
    estimatedDuration: 480,
    isEmergency: false,
    sortOrder: 11,
  },
  {
    name: 'Frozen Pipes',
    slug: 'frozen-pipes',
    shortDescription: 'Safe thawing and protection against frozen pipes.',
    description: 'Frozen pipes can burst and cause extensive water damage. Our team safely thaws frozen pipes and installs preventive measures to protect your plumbing from future freezing.',
    category: 'Emergency',
    icon: 'Snowflake',
    estimatedDuration: 120,
    isEmergency: true,
    sortOrder: 12,
  },
  {
    name: 'Commercial Plumbing',
    slug: 'commercial-plumbing',
    shortDescription: 'Professional plumbing services for commercial properties.',
    description: 'We provide comprehensive plumbing services for commercial properties including offices, retail spaces, restaurants, and industrial facilities. Our commercial team handles installations, repairs, maintenance, and emergency services.',
    category: 'Commercial',
    icon: 'Building',
    estimatedDuration: 240,
    isEmergency: false,
    sortOrder: 13,
  },
];

// ============================================================================
// SERVICE AREAS
// ============================================================================

export interface ServiceAreaDefinition {
  name: string;
  slug: string;
  description: string;
}

export const DEFAULT_SERVICE_AREAS: ServiceAreaDefinition[] = [
  { name: 'Winnipeg', slug: 'winnipeg', description: 'Serving all areas of Winnipeg with professional plumbing services.' },
  { name: 'Headingley', slug: 'headingley', description: 'Professional plumbing services in Headingley and surrounding areas.' },
  { name: 'East St. Paul', slug: 'east-st-paul', description: 'Reliable plumbing services for East St. Paul residents.' },
  { name: 'West St. Paul', slug: 'west-st-paul', description: 'Expert plumbing services in West St. Paul.' },
  { name: 'Oak Bluff', slug: 'oak-bluff', description: 'Professional plumbing services in Oak Bluff.' },
  { name: 'St. Andrews', slug: 'st-andrews', description: 'Trusted plumbing services for St. Andrews.' },
  { name: 'Selkirk', slug: 'selkirk', description: 'Quality plumbing services in Selkirk.' },
  { name: 'Stonewall', slug: 'stonewall', description: 'Professional plumbing services for Stonewall and area.' },
];

// ============================================================================
// BUSINESS HOURS
// ============================================================================

export interface BusinessHoursDefinition {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
}

export const DEFAULT_BUSINESS_HOURS: BusinessHoursDefinition[] = [
  { dayOfWeek: 0, openTime: '10:00', closeTime: '16:00', isClosed: false }, // Sunday
  { dayOfWeek: 1, openTime: '07:00', closeTime: '18:00', isClosed: false }, // Monday
  { dayOfWeek: 2, openTime: '07:00', closeTime: '18:00', isClosed: false }, // Tuesday
  { dayOfWeek: 3, openTime: '07:00', closeTime: '18:00', isClosed: false }, // Wednesday
  { dayOfWeek: 4, openTime: '07:00', closeTime: '18:00', isClosed: false }, // Thursday
  { dayOfWeek: 5, openTime: '07:00', closeTime: '18:00', isClosed: false }, // Friday
  { dayOfWeek: 6, openTime: '08:00', closeTime: '16:00', isClosed: false }, // Saturday
];

// ============================================================================
// BOOKING CONFIG
// ============================================================================

export const BOOKING = {
  /** Minimum hours in advance a non-emergency appointment can be booked */
  minAdvanceHours: 4,
  /** Maximum days in advance an appointment can be booked */
  maxAdvanceDays: 60,
  /** Default slot duration in minutes */
  defaultSlotDuration: 60,
  /** Buffer time between appointments in minutes */
  bufferMinutes: 15,
  /** Available time slot intervals in minutes */
  slotInterval: 30,
} as const;

// ============================================================================
// ROLES
// ============================================================================

export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  DISPATCHER: 'DISPATCHER',
  TECHNICIAN: 'TECHNICIAN',
  CUSTOMER: 'CUSTOMER',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

/** Roles that can access the admin dashboard */
export const ADMIN_ROLES: Role[] = ['SUPER_ADMIN', 'ADMIN', 'DISPATCHER'];

/** Roles that can access the technician portal */
export const TECH_ROLES: Role[] = ['SUPER_ADMIN', 'ADMIN', 'DISPATCHER', 'TECHNICIAN'];

// ============================================================================
// FINANCE & AUDIT EVENT CONSTANTS
// ============================================================================

export const FINANCE_EVENTS = {
  INVOICE_CREATED: 'INVOICE_CREATED',
  INVOICE_SENT: 'INVOICE_SENT',
  PAYMENT_INTENT_CREATED: 'PAYMENT_INTENT_CREATED',
  PAYMENT_SUCCEEDED: 'PAYMENT_SUCCEEDED',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  REFUND_SUCCEEDED: 'REFUND_SUCCEEDED',
} as const;

export const AUDIT_EVENTS = {
  STATUS_CHANGED: 'STATUS_CHANGED',
  TIME_STARTED: 'TIME_STARTED',
  TIME_PAUSED: 'TIME_PAUSED',
  TIME_RESUMED: 'TIME_RESUMED',
  TIME_COMPLETED: 'TIME_COMPLETED',
  PART_ADDED: 'PART_ADDED',
  NOTE_ADDED: 'NOTE_ADDED',
  SIGNATURE_CAPTURED: 'SIGNATURE_CAPTURED',
  PHOTO_UPLOADED: 'PHOTO_UPLOADED',
  JOB_COMPLETED: 'JOB_COMPLETED',
  JOB_CANCELLED: 'JOB_CANCELLED',
} as const;

