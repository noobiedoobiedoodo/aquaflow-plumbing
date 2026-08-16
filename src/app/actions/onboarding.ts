'use server';

import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth/password';
import { createSession, setSessionCookie } from '@/lib/auth/session';
import { z } from 'zod';
import { ROLES } from '@/lib/constants';

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

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email: data.email.toLowerCase() } });
    if (existingUser) {
      return { success: false, error: 'An account with this email already exists' };
    }

    const slug = data.companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Math.floor(Math.random() * 10000);

    // Execute within a transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Organization
      const org = await tx.organization.create({
        data: {
          name: data.companyName,
          slug,
          onboardingStatus: 'STRIPE_SUBSCRIPTION_PENDING',
        }
      });

      // 2. Create User
      const user = await tx.user.create({
        data: {
          email: data.email.toLowerCase(),
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

      return { org, user };
    });

    // Create session to log them in automatically
    const sessionId = await createSession(result.user.id);
    setSessionCookie(sessionId);

    return { success: true };
  } catch (error: any) {
    console.error('Registration error:', error);
    return { success: false, error: 'An unexpected error occurred during signup.' };
  }
}
