'use server';

import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth/password';
import { createSession, setSessionCookie } from '@/lib/auth/session';
import { z } from 'zod';
import { ROLES, DEFAULT_SERVICES } from '@/lib/constants';

const SignupSchema = z.object({
  companyName: z.string().min(2, 'Company name is required').max(100),
  firstName: z.string().min(1, 'First name is required').max(50),
  lastName: z.string().min(1, 'Last name is required').max(50),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export async function registerTenant(formData: FormData) {
  try {
    const rawData = Object.fromEntries(formData.entries());
    const validated = SignupSchema.safeParse(rawData);
    
    if (!validated.success) {
      return { success: false, error: 'Validation failed', details: validated.error.flatten() };
    }

    const data = validated.data;
    const cleanEmail = data.email.toLowerCase().trim();

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (existingUser) {
      return { success: false, error: 'An account with this email already exists' };
    }

    const baseSlug = data.companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const slug = `${baseSlug}-${Math.floor(1000 + Math.random() * 9000)}`;

    // Execute within an atomic transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Organization
      const org = await tx.organization.create({
        data: {
          name: data.companyName,
          slug,
          city: 'Winnipeg',
          province: 'MB',
          country: 'CA',
          onboardingStatus: 'ONBOARDING_COMPLETE',
          isActive: true,
        }
      });

      // 2. Create Super Admin User & Organization Membership
      const user = await tx.user.create({
        data: {
          email: cleanEmail,
          firstName: data.firstName,
          lastName: data.lastName,
          passwordHash: await hashPassword(data.password),
          memberships: {
            create: {
              organizationId: org.id,
              role: ROLES.SUPER_ADMIN,
            }
          }
        }
      });

      // 3. Create initial Technician profile for the business owner
      await tx.technician.create({
        data: {
          userId: user.id,
          organizationId: org.id,
          firstName: data.firstName,
          lastName: data.lastName,
          availabilityStatus: 'AVAILABLE',
          isActive: true,
        }
      });

      // 4. Provision default plumbing services for this tenant
      const initialServices = DEFAULT_SERVICES.slice(0, 5).map((s, idx) => ({
        organizationId: org.id,
        name: s.name,
        slug: `${s.slug}-${org.slug}`,
        description: s.description,
        shortDescription: s.shortDescription,
        category: s.category,
        icon: s.icon,
        estimatedDuration: s.estimatedDuration,
        isEmergency: s.isEmergency,
        basePrice: s.isEmergency ? 199.0 : 129.0 + (idx * 20),
        sortOrder: s.sortOrder,
        isActive: true,
      }));

      await tx.service.createMany({
        data: initialServices,
      });

      // 5. Provision standard operating business hours
      const businessDays = [
        { dayOfWeek: 1, openTime: '08:00', closeTime: '17:00', isClosed: false }, // Mon
        { dayOfWeek: 2, openTime: '08:00', closeTime: '17:00', isClosed: false }, // Tue
        { dayOfWeek: 3, openTime: '08:00', closeTime: '17:00', isClosed: false }, // Wed
        { dayOfWeek: 4, openTime: '08:00', closeTime: '17:00', isClosed: false }, // Thu
        { dayOfWeek: 5, openTime: '08:00', closeTime: '17:00', isClosed: false }, // Fri
        { dayOfWeek: 6, openTime: '09:00', closeTime: '14:00', isClosed: false }, // Sat
        { dayOfWeek: 0, openTime: '00:00', closeTime: '00:00', isClosed: true },  // Sun
      ];

      await tx.businessHours.createMany({
        data: businessDays.map(b => ({
          organizationId: org.id,
          ...b,
        })),
      });

      // 6. Provision standard default tax rule
      await tx.taxRule.create({
        data: {
          organizationId: org.id,
          name: 'Standard Combined Sales Tax',
          jurisdiction: 'MB',
          rate: 0.12,
          appliesTo: 'ALL',
          active: true,
        }
      });

      return { org, user };
    });

    // Create session to log them in automatically
    const sessionId = await createSession(result.user.id);
    await setSessionCookie(sessionId);

    return { success: true, slug: result.org.slug };
  } catch (error: any) {
    console.error('Registration error:', error);
    return { success: false, error: 'An unexpected error occurred during signup.' };
  }
}
