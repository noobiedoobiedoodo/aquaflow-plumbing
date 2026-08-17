import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { prisma } from '@/lib/db';
import { randomUUID } from 'crypto';
import { POST as bookingHandler } from '@/app/api/booking/route';
import {
  bookingSubmitSchema,
  serviceStepSchema,
  problemStepSchema,
  appointmentStepSchema,
  locationStepSchema,
  customerStepSchema,
  UrgencyLevel,
} from '@/lib/validation/booking.schema';
import { normalizeAddress } from '@/lib/address';
import { generateAppointmentNumber } from '@/lib/utils';
import { RateLimiter, RATE_LIMITS } from '@/lib/security/rate-limiter';
import { generateMetadata as generateLandingMetadata } from '@/app/p/[slug]/page';
import { generateMetadata as generateBookingMetadata } from '@/app/p/[slug]/book/page';

describe('Public Customer Acquisition & Booking Wizard Forensic Audit', () => {
  const runId = randomUUID().slice(0, 8);

  let orgAId: string;
  let orgASlug: string;
  let orgBId: string;
  let orgBSlug: string;
  let serviceA1Id: string;
  let serviceA2Id: string;
  let serviceB1Id: string;
  let inactiveServiceId: string;
  let areaA1Id: string;
  let hoursA1Id: string;

  beforeEach(async () => {
    orgASlug = `alpha-plumbing-${runId}`;
    orgBSlug = `beta-plumbing-${runId}`;

    // Create Organization A (Fully Configured Tenant)
    const orgA = await prisma.organization.create({
      data: {
        name: `Alpha Master Plumbing ${runId}`,
        slug: orgASlug,
        phone: '204-555-0101',
        emergencyPhone: '204-555-0911',
        address: '100 Main St, Winnipeg, MB',
        city: 'Winnipeg',
        province: 'MB',
        postalCode: 'R3C 1A1',
        isActive: true,
        logoUrl: 'https://cdn.aquaflow.io/logos/alpha-logo.png',
      },
    });
    orgAId = orgA.id;

    // Create Organization B (Second Tenant for Isolation Checks)
    const orgB = await prisma.organization.create({
      data: {
        name: `Beta Express Rooter ${runId}`,
        slug: orgBSlug,
        phone: '204-555-0202',
        emergencyPhone: '204-555-0999',
        city: 'Brandon',
        province: 'MB',
        postalCode: 'R7A 1A1',
        isActive: true,
      },
    });
    orgBId = orgB.id;

    // Services for Organization A
    const serviceA1 = await prisma.service.create({
      data: {
        organizationId: orgAId,
        name: 'Emergency Pipe Thawing & Repair',
        slug: `emergency-thaw-${runId}`,
        description: 'Rapid dispatch pipe thaw and burst pipe mitigation.',
        shortDescription: 'Emergency pipe thaw and burst repair.',
        basePrice: 249.99,
        estimatedDuration: 90,
        isEmergency: true,
        isActive: true,
        sortOrder: 1,
        icon: 'AlertTriangle',
      },
    });
    serviceA1Id = serviceA1.id;

    const serviceA2 = await prisma.service.create({
      data: {
        organizationId: orgAId,
        name: 'Main Drain Hydro-Jetting',
        slug: `hydro-jet-${runId}`,
        description: 'High-pressure water jetting for severe mainline blockages.',
        shortDescription: 'High-pressure mainline jetting.',
        basePrice: 389.00,
        estimatedDuration: 120,
        isEmergency: false,
        isActive: true,
        sortOrder: 2,
        icon: 'Droplets',
      },
    });
    serviceA2Id = serviceA2.id;

    // Inactive Service for Org A (Should not be accessible)
    const inactiveService = await prisma.service.create({
      data: {
        organizationId: orgAId,
        name: 'Decommissioned Boiler Service',
        slug: `decommissioned-boiler-${runId}`,
        description: 'Discontinued legacy boiler service.',
        shortDescription: 'Legacy boiler service.',
        basePrice: 500,
        isActive: false,
        sortOrder: 99,
      },
    });
    inactiveServiceId = inactiveService.id;

    // Service for Organization B
    const serviceB1 = await prisma.service.create({
      data: {
        organizationId: orgBId,
        name: 'Sump Pump Installation & Backup',
        slug: `sump-pump-${runId}`,
        description: 'Commercial & residential sump pump installation.',
        shortDescription: 'Sump pump installation.',
        basePrice: 450.00,
        estimatedDuration: 180,
        isEmergency: false,
        isActive: true,
        sortOrder: 1,
      },
    });
    serviceB1Id = serviceB1.id;

    // Service Area for Org A
    const areaA1 = await prisma.serviceArea.create({
      data: {
        organizationId: orgAId,
        name: 'River Heights & Tuxedo',
        slug: `river-heights-${runId}`,
        isActive: true,
        sortOrder: 1,
      },
    });
    areaA1Id = areaA1.id;

    // Business Hours for Org A
    const hoursA1 = await prisma.businessHours.create({
      data: {
        organizationId: orgAId,
        dayOfWeek: 1, // Monday
        openTime: '08:00',
        closeTime: '17:00',
        isClosed: false,
      },
    });
    hoursA1Id = hoursA1.id;
  });

  afterEach(async () => {
    // Teardown created records safely
    await prisma.job.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.appointment.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.property.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.customerSession.deleteMany({ where: { customer: { organizationId: { in: [orgAId, orgBId] } } } });
    await prisma.customer.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.businessHours.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.serviceArea.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.service.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } });
  });

  // =========================================================================
  // 1. PUBLIC COMPANY LANDING PAGE AUDIT (/p/[slug])
  // =========================================================================
  describe('1. Public Company Landing Page (/p/[slug]) Forensic Audit', () => {
    it('generates accurate SEO metadata incorporating company branding and location', async () => {
      const metadata = await generateLandingMetadata({
        params: Promise.resolve({ slug: orgASlug }),
      });

      expect(metadata.title).toBe(`Alpha Master Plumbing ${runId} | Expert Plumbing in Winnipeg`);
      expect(metadata.description).toContain(`Professional plumbing and emergency service by Alpha Master Plumbing ${runId}`);
    });

    it('handles non-existent or inactive tenant slugs gracefully in metadata', async () => {
      const metadata = await generateLandingMetadata({
        params: Promise.resolve({ slug: 'non-existent-plumber-slug' }),
      });

      expect(metadata.title).toBe('Plumbing Services');
    });

    it('queries tenant profile with branding, phone numbers, and emergency lines intact', async () => {
      const org = await prisma.organization.findUnique({
        where: { slug: orgASlug, isActive: true },
        include: {
          services: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
          serviceAreas: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
          businessHours: { orderBy: { dayOfWeek: 'asc' } },
        },
      });

      expect(org).not.toBeNull();
      expect(org!.name).toBe(`Alpha Master Plumbing ${runId}`);
      expect(org!.phone).toBe('204-555-0101');
      expect(org!.emergencyPhone).toBe('204-555-0911');
      expect(org!.logoUrl).toBe('https://cdn.aquaflow.io/logos/alpha-logo.png');
      expect(org!.city).toBe('Winnipeg');
      expect(org!.province).toBe('MB');
    });

    it('strictly isolates tenant services and omits inactive services on landing page', async () => {
      const org = await prisma.organization.findUnique({
        where: { slug: orgASlug, isActive: true },
        include: {
          services: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
        },
      });

      expect(org!.services.length).toBe(2);
      const serviceIds = org!.services.map((s) => s.id);
      expect(serviceIds).toContain(serviceA1Id);
      expect(serviceIds).toContain(serviceA2Id);
      expect(serviceIds).not.toContain(inactiveServiceId);
      expect(serviceIds).not.toContain(serviceB1Id);

      // Verify emergency badge property
      const emergencyService = org!.services.find((s) => s.id === serviceA1Id);
      expect(emergencyService!.isEmergency).toBe(true);
      expect(emergencyService!.basePrice).toBe(249.99);
      expect(emergencyService!.estimatedDuration).toBe(90);

      const standardService = org!.services.find((s) => s.id === serviceA2Id);
      expect(standardService!.isEmergency).toBe(false);
    });

    it('loads service areas and business operating schedule for the tenant', async () => {
      const org = await prisma.organization.findUnique({
        where: { slug: orgASlug, isActive: true },
        include: {
          serviceAreas: { where: { isActive: true } },
          businessHours: true,
        },
      });

      expect(org!.serviceAreas.length).toBe(1);
      expect(org!.serviceAreas[0].name).toBe('River Heights & Tuxedo');
      expect(org!.businessHours.length).toBe(1);
      expect(org!.businessHours[0].openTime).toBe('08:00');
      expect(org!.businessHours[0].closeTime).toBe('17:00');
    });
  });

  // =========================================================================
  // 2. PUBLIC BOOKING PAGE AUDIT (/p/[slug]/book)
  // =========================================================================
  describe('2. Public Booking Page (/p/[slug]/book) Forensic Audit', () => {
    it('generates booking page SEO metadata with organization name', async () => {
      const metadata = await generateBookingMetadata({
        params: Promise.resolve({ slug: orgASlug }),
      });

      expect(metadata.title).toBe(`Book Service | Alpha Master Plumbing ${runId}`);
      expect(metadata.description).toContain(`Online service booking and emergency plumbing request with Alpha Master Plumbing ${runId}`);
    });

    it('queries active services payload scoped strictly to the target company', async () => {
      const org = await prisma.organization.findUnique({
        where: { slug: orgASlug, isActive: true },
        include: {
          services: {
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' },
            select: {
              id: true,
              name: true,
              shortDescription: true,
              icon: true,
              isEmergency: true,
            },
          },
        },
      });

      expect(org).not.toBeNull();
      expect(org!.services.length).toBe(2);
      expect(org!.services[0].id).toBe(serviceA1Id);
      expect(org!.services[0].name).toBe('Emergency Pipe Thawing & Repair');
      expect(org!.services[0].icon).toBe('AlertTriangle');
      expect(org!.services[0].isEmergency).toBe(true);
      expect(org!.services[1].id).toBe(serviceA2Id);
      expect(org!.services[1].isEmergency).toBe(false);
    });

    it('returns null when querying an inactive or non-existent organization slug', async () => {
      const org = await prisma.organization.findUnique({
        where: { slug: 'invalid-nonexistent-org-slug', isActive: true },
      });
      expect(org).toBeNull();
    });
  });

  // =========================================================================
  // 3. STEP-BY-STEP VALIDATION & SCHEMA MATRIX AUDIT
  // =========================================================================
  describe('3. 5-Step Booking Wizard Validation Schema Audit', () => {
    describe('Step 1: Service Selection Validation (serviceStepSchema)', () => {
      it('validates a valid UUID serviceId', () => {
        const result = serviceStepSchema.safeParse({ serviceId: serviceA1Id });
        expect(result.success).toBe(true);
      });

      it('rejects missing or non-UUID serviceId', () => {
        const missing = serviceStepSchema.safeParse({});
        expect(missing.success).toBe(false);

        const invalidUuid = serviceStepSchema.safeParse({ serviceId: 'not-a-valid-uuid' });
        expect(invalidUuid.success).toBe(false);
        if (!invalidUuid.success) {
          expect(invalidUuid.error.issues[0].message).toContain('Invalid identifier format');
        }
      });
    });

    describe('Step 2: Problem Description & Urgency Validation (problemStepSchema)', () => {
      it('accepts valid problem description (>= 10 chars) and standard urgency', () => {
        const result = problemStepSchema.safeParse({
          problemDescription: 'Water heater leaking rapidly into finished basement floor',
          urgency: 'NORMAL',
        });
        expect(result.success).toBe(true);
      });

      it('defaults urgency to NORMAL when omitted', () => {
        const result = problemStepSchema.safeParse({
          problemDescription: 'Toilet constantly running and overflowing valve',
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.urgency).toBe('NORMAL');
        }
      });

      it('accepts EMERGENCY urgency level', () => {
        const result = problemStepSchema.safeParse({
          problemDescription: 'Active burst pipe spraying behind drywall',
          urgency: 'EMERGENCY',
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.urgency).toBe('EMERGENCY');
        }
      });

      it('rejects problem descriptions shorter than 10 characters', () => {
        const result = problemStepSchema.safeParse({
          problemDescription: 'Broken',
          urgency: 'NORMAL',
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('at least 10 characters');
        }
      });

      it('rejects problem descriptions exceeding 1000 characters', () => {
        const longText = 'A'.repeat(1001);
        const result = problemStepSchema.safeParse({
          problemDescription: longText,
          urgency: 'NORMAL',
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('cannot exceed 1000 characters');
        }
      });

      it('rejects invalid urgency levels', () => {
        const result = problemStepSchema.safeParse({
          problemDescription: 'Sump pump failed and backup battery dead',
          urgency: 'SUPER_CRITICAL' as any,
        });
        expect(result.success).toBe(false);
      });
    });

    describe('Step 3: Appointment Date & Time Window Validation (appointmentStepSchema)', () => {
      it('accepts valid YYYY-MM-DD date and HH:mm arrival windows', () => {
        const result = appointmentStepSchema.safeParse({
          date: '2026-09-01',
          startTime: '08:00',
          endTime: '10:00',
        });
        expect(result.success).toBe(true);
      });

      it('rejects malformed date formats', () => {
        const invalidDates = ['09-01-2026', '2026/09/01', 'tomorrow', '2026-9-1'];
        for (const badDate of invalidDates) {
          const result = appointmentStepSchema.safeParse({
            date: badDate,
            startTime: '10:00',
            endTime: '12:00',
          });
          expect(result.success).toBe(false);
        }
      });

      it('rejects malformed or non-24h time strings', () => {
        const invalidTimes = ['8:00', '8am', '25:00', '12:60', 'morning'];
        for (const badTime of invalidTimes) {
          const result = appointmentStepSchema.safeParse({
            date: '2026-09-01',
            startTime: badTime,
            endTime: '12:00',
          });
          expect(result.success).toBe(false);
        }
      });
    });

    describe('Step 4: Location & Customer Information Validation (locationStepSchema & customerStepSchema)', () => {
      it('validates complete customer details with phone and email', () => {
        const customerResult = customerStepSchema.safeParse({
          firstName: 'Jonathan',
          lastName: 'Vance',
          email: 'jvance@example.com',
          phone: '204-555-0188',
        });
        expect(customerResult.success).toBe(true);
      });

      it('rejects invalid email formats', () => {
        const invalidEmails = ['plainaddress', '@missingusername.com', 'user@.com', 'user@domain..com'];
        for (const badEmail of invalidEmails) {
          const result = customerStepSchema.safeParse({
            firstName: 'John',
            lastName: 'Doe',
            email: badEmail,
            phone: '204-555-0188',
          });
          expect(result.success).toBe(false);
        }
      });

      it('accepts varied valid North American phone formats and rejects invalid numbers', () => {
        const validPhones = [
          '204-555-0188',
          '(204) 555-0188',
          '2045550188',
          '+1 204 555 0188',
          '+1-204-555-0188',
        ];
        for (const phone of validPhones) {
          const result = customerStepSchema.safeParse({
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@example.com',
            phone,
          });
          expect(result.success).toBe(true);
        }

        const invalidPhones = ['12345', 'abcdefghij', '555-018', '204-555-018888'];
        for (const badPhone of invalidPhones) {
          const result = customerStepSchema.safeParse({
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@example.com',
            phone: badPhone,
          });
          expect(result.success).toBe(false);
        }
      });

      it('validates property location with Canadian postal code and default province', () => {
        const locationResult = locationStepSchema.safeParse({
          address: '450 Portage Avenue',
          unit: 'Suite 300',
          city: 'Winnipeg',
          province: 'MB',
          postalCode: 'R3C 0G1',
        });
        expect(locationResult.success).toBe(true);
      });

      it('validates postal code formats (with and without space)', () => {
        const validPostalCodes = ['R3C 1A1', 'R3C1A1', 'r3c 1a1', 'V6B 2W9', 'M5V 3L9'];
        for (const code of validPostalCodes) {
          const result = locationStepSchema.safeParse({
            address: '123 Main St',
            city: 'Winnipeg',
            province: 'MB',
            postalCode: code,
          });
          expect(result.success).toBe(true);
        }

        const invalidPostalCodes = ['12345', '90210', 'R3C-1A1-X', 'INVALID', ''];
        for (const badCode of invalidPostalCodes) {
          const result = locationStepSchema.safeParse({
            address: '123 Main St',
            city: 'Winnipeg',
            province: 'MB',
            postalCode: badCode,
          });
          expect(result.success).toBe(false);
        }
      });

      it('rejects province code longer than 2 characters', () => {
        const result = locationStepSchema.safeParse({
          address: '123 Main St',
          city: 'Winnipeg',
          province: 'MANITOBA',
          postalCode: 'R3C 1A1',
        });
        expect(result.success).toBe(false);
      });
    });

    describe('Step 5: Full Combined Booking Submission (bookingSubmitSchema)', () => {
      it('validates an end-to-end full booking payload successfully', () => {
        const fullPayload = {
          serviceId: serviceA1Id,
          problemDescription: 'Burst water main in crawlspace flooding subfloor',
          urgency: 'EMERGENCY' as const,
          date: '2026-09-02',
          startTime: '08:00',
          endTime: '10:00',
          firstName: 'Robert',
          lastName: 'Taylor',
          email: 'robert.taylor@example.com',
          phone: '204-555-0144',
          address: '120 Osborne Street',
          unit: 'Apt 2B',
          city: 'Winnipeg',
          province: 'MB',
          postalCode: 'R3L 1Y5',
          customerNotes: 'Please ring unit 2B intercom at entrance gate.',
        };

        const result = bookingSubmitSchema.safeParse(fullPayload);
        expect(result.success).toBe(true);
      });

      it('rejects full booking submission if any mandatory step field is missing', () => {
        const incompletePayload = {
          serviceId: serviceA1Id,
          problemDescription: 'Burst water main',
          urgency: 'EMERGENCY' as const,
          // Missing date and times
          firstName: 'Robert',
          lastName: 'Taylor',
          email: 'robert.taylor@example.com',
          phone: '204-555-0144',
          address: '120 Osborne Street',
          city: 'Winnipeg',
          postalCode: 'R3L 1Y5',
        };

        const result = bookingSubmitSchema.safeParse(incompletePayload);
        expect(result.success).toBe(false);
      });
    });
  });

  // =========================================================================
  // 4. POST /api/booking EXECUTION, NORMALIZATION & CONFIRMATION AUDIT
  // =========================================================================
  describe('4. POST /api/booking Execution & Confirmation Screen Verification', () => {
    it('generates appointment numbers matching PL-YYYY-NNNNNN format', () => {
      const currentYear = new Date().getFullYear();
      for (let i = 0; i < 10; i++) {
        const aptNum = generateAppointmentNumber();
        expect(aptNum).toMatch(new RegExp(`^PL-${currentYear}-\\d{6}$`));
      }
    });

    it('normalizes street address, punctuation, and postal code spacing correctly', () => {
      const raw = {
        street: '  123   Main St., Apt. #4  ',
        city: '  Winnipeg. , ',
        province: ' mb ',
        postalCode: ' r3c  1a1 ',
      };

      const normalized = normalizeAddress(raw.street, raw.city, raw.province, raw.postalCode);
      expect(normalized.normStreet).toBe('123 main st apt #4');
      expect(normalized.normCity).toBe('winnipeg');
      expect(normalized.normProvince).toBe('MB');
      expect(normalized.normPostalCode).toBe('R3C1A1');
    });

    it('executes POST /api/booking, returns HTTP 201 with appointmentNumber, and creates complete DB entity graph', async () => {
      const email = `audited.customer.${runId}@example.com`;
      const bookingPayload = {
        serviceId: serviceA1Id,
        problemDescription: 'Emergency pipe thaw required in basement suite ceiling',
        urgency: 'EMERGENCY' as const,
        date: '2026-09-05',
        startTime: '10:00',
        endTime: '12:00',
        firstName: 'Forensic',
        lastName: 'Auditor',
        email,
        phone: '204-555-0199',
        address: '555 Broadway Ave',
        unit: 'Suite 100',
        city: 'Winnipeg',
        province: 'MB',
        postalCode: 'R3C 0V4',
        customerNotes: 'Key is in lockbox beside garage door.',
      };

      const req = new Request('http://localhost:3000/api/booking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': `192.168.1.${Math.floor(Math.random() * 200)}`,
        },
        body: JSON.stringify(bookingPayload),
      });

      const res = await bookingHandler(req);
      expect(res.status).toBe(201);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.appointmentNumber).toMatch(/^PL-\d{4}-\d{6}$/);

      // Verify DB User Creation
      const createdUser = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });
      expect(createdUser).not.toBeNull();
      expect(createdUser!.firstName).toBe('Forensic');
      expect(createdUser!.lastName).toBe('Auditor');
      expect(createdUser!.passwordHash).toBe('guest_no_login');

      // Verify DB Customer Record Scoped to Org A
      const customer = await prisma.customer.findUnique({
        where: {
          userId_organizationId: {
            userId: createdUser!.id,
            organizationId: orgAId,
          },
        },
      });
      expect(customer).not.toBeNull();
      expect(customer!.organizationId).toBe(orgAId);
      expect(customer!.phone).toBe('204-555-0199');

      // Verify DB Property Record
      const property = await prisma.property.findFirst({
        where: {
          customerId: customer!.id,
          organizationId: orgAId,
        },
      });
      expect(property).not.toBeNull();
      expect(property!.address).toBe('555 Broadway Ave');
      expect(property!.unit).toBe('Suite 100');
      expect(property!.city).toBe('Winnipeg');
      expect(property!.postalCode).toBe('R3C 0V4');

      // Verify DB Appointment Record
      const appointment = await prisma.appointment.findUnique({
        where: { appointmentNumber: data.appointmentNumber },
      });
      expect(appointment).not.toBeNull();
      expect(appointment!.organizationId).toBe(orgAId);
      expect(appointment!.customerId).toBe(customer!.id);
      expect(appointment!.propertyId).toBe(property!.id);
      expect(appointment!.serviceId).toBe(serviceA1Id);
      expect(appointment!.status).toBe('PENDING');
      expect(appointment!.priority).toBe('EMERGENCY');
      expect(appointment!.isEmergency).toBe(true);
      expect(appointment!.startTime).toBe('10:00');
      expect(appointment!.endTime).toBe('12:00');
      expect(appointment!.customerNotes).toBe('Key is in lockbox beside garage door.');

      // Verify DB Job Record Scoped to Org A with CREATED Status
      const job = await prisma.job.findFirst({
        where: { appointmentId: appointment!.id },
      });
      expect(job).not.toBeNull();
      expect(job!.organizationId).toBe(orgAId);
      expect(job!.status).toBe('CREATED');
    });

    it('reuses existing property on subsequent booking for same customer if address normalizes to identical match', async () => {
      const email = `repeat.customer.${runId}@example.com`;
      const basePayload = {
        serviceId: serviceA2Id,
        problemDescription: 'First service request - Main line jetting inspection',
        urgency: 'NORMAL' as const,
        date: '2026-09-10',
        startTime: '08:00',
        endTime: '10:00',
        firstName: 'Repeat',
        lastName: 'Customer',
        email,
        phone: '204-555-0155',
        address: '777 Portage Ave.',
        city: 'Winnipeg',
        province: 'MB',
        postalCode: 'R3G 0M8',
      };

      // First booking
      const req1 = new Request('http://localhost:3000/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '10.0.0.1' },
        body: JSON.stringify(basePayload),
      });
      const res1 = await bookingHandler(req1);
      expect(res1.status).toBe(201);

      // Second booking with slight formatting differences in address & postal code
      const secondPayload = {
        ...basePayload,
        problemDescription: 'Second service request - Follow-up drain scoping',
        date: '2026-09-15',
        address: '777 Portage Ave', // omitted trailing period
        postalCode: 'r3g0m8', // lowercase without space
      };

      const req2 = new Request('http://localhost:3000/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '10.0.0.2' },
        body: JSON.stringify(secondPayload),
      });
      const res2 = await bookingHandler(req2);
      expect(res2.status).toBe(201);

      // Verify that only 1 Property record was created for this customer
      const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
      const customer = await prisma.customer.findUnique({
        where: { userId_organizationId: { userId: user!.id, organizationId: orgAId } },
      });
      const properties = await prisma.property.findMany({
        where: { customerId: customer!.id },
      });
      expect(properties.length).toBe(1);

      // Verify 2 separate Appointments exist on the same property
      const appointments = await prisma.appointment.findMany({
        where: { propertyId: properties[0].id },
      });
      expect(appointments.length).toBe(2);
    });

    it('rejects POST /api/booking with HTTP 400 when validation fails', async () => {
      const invalidPayload = {
        serviceId: serviceA1Id,
        // missing required fields
        firstName: 'Incomplete',
      };

      const req = new Request('http://localhost:3000/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidPayload),
      });

      const res = await bookingHandler(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Validation failed');
      expect(data.details).toBeDefined();
    });

    it('rejects POST /api/booking with HTTP 400 when serviceId does not exist in DB', async () => {
      const fakeUuid = randomUUID();
      const payload = {
        serviceId: fakeUuid,
        problemDescription: 'Valid description with over ten characters',
        urgency: 'NORMAL' as const,
        date: '2026-09-08',
        startTime: '10:00',
        endTime: '12:00',
        firstName: 'Test',
        lastName: 'User',
        email: `fake.service.${runId}@example.com`,
        phone: '204-555-0122',
        address: '123 Fake Street',
        city: 'Winnipeg',
        province: 'MB',
        postalCode: 'R3C 1A1',
      };

      const req = new Request('http://localhost:3000/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const res = await bookingHandler(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Invalid service selected');
    });
  });

  // =========================================================================
  // 5. MULTI-TENANT CONTEXT SEPARATION & BOUNDARY ISOLATION AUDIT
  // =========================================================================
  describe('5. Multi-Tenant Context Separation & Target Organization Association', () => {
    it('strictly associates Customer, Property, Appointment, and Job with Org A when booking Org A service', async () => {
      const email = `tenant.a.user.${runId}@example.com`;
      const payloadA = {
        serviceId: serviceA1Id,
        problemDescription: 'Burst pipe repair request for Org A tenant boundary test',
        urgency: 'EMERGENCY' as const,
        date: '2026-09-12',
        startTime: '14:00',
        endTime: '16:00',
        firstName: 'TenantA',
        lastName: 'Resident',
        email,
        phone: '204-555-0133',
        address: '101 Alpha Blvd',
        city: 'Winnipeg',
        province: 'MB',
        postalCode: 'R3C 2B2',
      };

      const resA = await bookingHandler(new Request('http://localhost:3000/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadA),
      }));
      expect(resA.status).toBe(201);
      const dataA = await resA.json();

      // Org A Appointment Check
      const apptA = await prisma.appointment.findUnique({
        where: { appointmentNumber: dataA.appointmentNumber },
        include: { customer: true, property: true, job: true },
      });

      expect(apptA!.organizationId).toBe(orgAId);
      expect(apptA!.customer.organizationId).toBe(orgAId);
      expect(apptA!.property.organizationId).toBe(orgAId);
      expect(apptA!.job!.organizationId).toBe(orgAId);

      // Verify Org B has zero records of this booking
      const orgBAppts = await prisma.appointment.findMany({
        where: { organizationId: orgBId, customerId: apptA!.customerId },
      });
      expect(orgBAppts.length).toBe(0);

      const orgBJobs = await prisma.job.findMany({
        where: { organizationId: orgBId, appointmentId: apptA!.id },
      });
      expect(orgBJobs.length).toBe(0);
    });

    it('strictly associates Customer, Property, Appointment, and Job with Org B when booking Org B service', async () => {
      const email = `tenant.b.user.${runId}@example.com`;
      const payloadB = {
        serviceId: serviceB1Id,
        problemDescription: 'Sump pump installation request for Org B tenant boundary test',
        urgency: 'NORMAL' as const,
        date: '2026-09-14',
        startTime: '12:00',
        endTime: '14:00',
        firstName: 'TenantB',
        lastName: 'Resident',
        email,
        phone: '204-555-0244',
        address: '202 Beta Cres',
        city: 'Brandon',
        province: 'MB',
        postalCode: 'R7A 2B2',
      };

      const resB = await bookingHandler(new Request('http://localhost:3000/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadB),
      }));
      expect(resB.status).toBe(201);
      const dataB = await resB.json();

      // Org B Appointment Check
      const apptB = await prisma.appointment.findUnique({
        where: { appointmentNumber: dataB.appointmentNumber },
        include: { customer: true, property: true, job: true },
      });

      expect(apptB!.organizationId).toBe(orgBId);
      expect(apptB!.customer.organizationId).toBe(orgBId);
      expect(apptB!.property.organizationId).toBe(orgBId);
      expect(apptB!.job!.organizationId).toBe(orgBId);

      // Verify Org A has zero records of this Org B booking
      const orgAAppts = await prisma.appointment.findMany({
        where: { organizationId: orgAId, customerId: apptB!.customerId },
      });
      expect(orgAAppts.length).toBe(0);
    });

    it('maintains segregated Customer accounts when single user books with multiple distinct organizations', async () => {
      const sharedEmail = `multi.tenant.customer.${runId}@example.com`;

      // Booking 1: Customer books with Org A
      const bookingOrgA = {
        serviceId: serviceA1Id,
        problemDescription: 'Winter pipe thaw emergency at residential home',
        urgency: 'EMERGENCY' as const,
        date: '2026-09-20',
        startTime: '08:00',
        endTime: '10:00',
        firstName: 'Clara',
        lastName: 'Oswald',
        email: sharedEmail,
        phone: '204-555-0166',
        address: '1000 Pembina Hwy',
        city: 'Winnipeg',
        province: 'MB',
        postalCode: 'R3T 2G6',
      };

      const res1 = await bookingHandler(new Request('http://localhost:3000/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingOrgA),
      }));
      expect(res1.status).toBe(201);

      // Booking 2: Same customer books with Org B
      const bookingOrgB = {
        serviceId: serviceB1Id,
        problemDescription: 'Commercial sump pump installation at rental cottage',
        urgency: 'NORMAL' as const,
        date: '2026-09-22',
        startTime: '14:00',
        endTime: '16:00',
        firstName: 'Clara',
        lastName: 'Oswald',
        email: sharedEmail,
        phone: '204-555-0166',
        address: '50 Victoria Ave',
        city: 'Brandon',
        province: 'MB',
        postalCode: 'R7A 1Y1',
      };

      const res2 = await bookingHandler(new Request('http://localhost:3000/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingOrgB),
      }));
      expect(res2.status).toBe(201);

      // Verify Single Global User Record
      const user = await prisma.user.findUnique({
        where: { email: sharedEmail.toLowerCase() },
      });
      expect(user).not.toBeNull();

      // Verify Two Distinct Customer Records Scoped Per Organization
      const customers = await prisma.customer.findMany({
        where: { userId: user!.id },
      });
      expect(customers.length).toBe(2);

      const customerOrgA = customers.find((c) => c.organizationId === orgAId);
      const customerOrgB = customers.find((c) => c.organizationId === orgBId);
      expect(customerOrgA).toBeDefined();
      expect(customerOrgB).toBeDefined();
      expect(customerOrgA!.id).not.toBe(customerOrgB!.id);

      // Verify Properties are strictly isolated to their respective organizations
      const propsOrgA = await prisma.property.findMany({ where: { organizationId: orgAId, customerId: customerOrgA!.id } });
      const propsOrgB = await prisma.property.findMany({ where: { organizationId: orgBId, customerId: customerOrgB!.id } });
      expect(propsOrgA.length).toBe(1);
      expect(propsOrgA[0].address).toBe('1000 Pembina Hwy');
      expect(propsOrgB.length).toBe(1);
      expect(propsOrgB[0].address).toBe('50 Victoria Ave');
    });

    it('prevents attacker from forging cross-tenant organization ID via payload injection', async () => {
      const email = `attacker.${runId}@example.com`;
      // Attacker attempts to pass organizationId of Org B while using Org A's service
      const maliciousPayload = {
        organizationId: orgBId, // Injected attempt to hijack tenant scope
        serviceId: serviceA1Id, // Belongs to Org A
        problemDescription: 'Malicious cross-tenant injection test attempt',
        urgency: 'NORMAL' as const,
        date: '2026-09-25',
        startTime: '10:00',
        endTime: '12:00',
        firstName: 'Eve',
        lastName: 'Adversary',
        email,
        phone: '204-555-0190',
        address: '666 Exploit Way',
        city: 'Winnipeg',
        province: 'MB',
        postalCode: 'R3C 1A1',
      };

      const res = await bookingHandler(new Request('http://localhost:3000/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(maliciousPayload),
      }));
      expect(res.status).toBe(201);
      const data = await res.json();

      // Verify the server strictly derived organizationId from serviceA1Id (Org A) and ignored injected organizationId
      const appointment = await prisma.appointment.findUnique({
        where: { appointmentNumber: data.appointmentNumber },
      });
      expect(appointment!.organizationId).toBe(orgAId);
      expect(appointment!.organizationId).not.toBe(orgBId);

      const job = await prisma.job.findFirst({
        where: { appointmentId: appointment!.id },
      });
      expect(job!.organizationId).toBe(orgAId);
      expect(job!.organizationId).not.toBe(orgBId);
    });
  });
});
