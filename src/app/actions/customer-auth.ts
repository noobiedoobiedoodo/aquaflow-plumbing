'use server';

import { prisma } from '@/lib/db';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { createCustomerSession, requireCustomerSession, hashToken } from '@/lib/auth/customer-session';
import { getAbsoluteServerUrl } from '@/lib/config/url';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import { emailSchema } from '@/lib/validation/common.schema';
import { RateLimiter, RATE_LIMITS } from '@/lib/security/rate-limiter';
import { headers } from 'next/headers';

const CustomerLoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
  slug: z.string().min(1, 'Organization slug is required'),
});

const SetPasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

/**
 * Permanent Email + Password authentication for a customer at /p/[slug]/login.
 * Strictly verifies the customer's membership within the specified organization.
 */
export async function loginCustomerWithPassword(params: {
  email: string;
  password: string;
  slug: string;
}) {
  const parsed = CustomerLoginSchema.safeParse(params);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues.map((i) => i.message).join(', '),
    };
  }

  const { email, password, slug } = parsed.data;

  // Rate limiting (IP + Tenant + Email)
  try {
    let clientIp = '127.0.0.1';
    try {
      const headerStore = await headers();
      clientIp = headerStore.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
    } catch {
      // Test or offline context
    }

    const isAllowed = await RateLimiter.checkMulti(
      [clientIp, `custlogin:${slug.toLowerCase()}:${email.toLowerCase().trim()}`],
      RATE_LIMITS.LOGIN
    );

    if (!isAllowed) {
      return { success: false, error: 'Too many failed attempts. Please try again later.' };
    }
  } catch (err) {
    // Fail-closed handled inside RateLimiter if in production
  }

  try {
    // 1. Resolve Organization strictly from route slug
    const org = await prisma.organization.findUnique({
      where: { slug: slug.toLowerCase() },
      select: { id: true, name: true, isActive: true },
    });

    if (!org || !org.isActive) {
      return { success: false, error: 'Invalid email or password' };
    }

    // 2. Lookup Global User by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        passwordSetAt: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      return { success: false, error: 'Invalid email or password' };
    }

    // 3. Check if password has been activated
    if (!user.passwordHash || !user.passwordSetAt) {
      return {
        success: false,
        error: 'Account not yet activated. Please sign in using a magic link to create your password.',
        unactivated: true,
      };
    }

    // 4. Verify password with bcrypt
    const isPasswordValid = await verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      return { success: false, error: 'Invalid email or password' };
    }

    // 5. TENANT ISOLATION: Verify customer record exists within this organization
    const customer = await prisma.customer.findUnique({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: org.id,
        },
      },
      select: { id: true, organizationId: true },
    });

    if (!customer) {
      // User exists globally but has no customer record in this organization
      return { success: false, error: 'Invalid email or password' };
    }

    // 6. Create tenant-scoped CustomerSession and set HTTP-only cookie
    await createCustomerSession(customer.id);

    // 7. Update lastLoginAt
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      success: true,
      redirectUrl: '/portal/dashboard',
    };
  } catch (error) {
    console.error('Customer login error:', error);
    return { success: false, error: 'An unexpected error occurred. Please try again.' };
  }
}

/**
 * Sets the initial permanent password for an authenticated customer session
 * who arrived via invitation/magic link (where passwordSetAt is null).
 */
export async function setCustomerPermanentPassword(formData: FormData) {
  const session = await requireCustomerSession();
  const rawPassword = formData.get('password') as string;

  const parsed = SetPasswordSchema.safeParse({ password: rawPassword });
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues.map((i) => i.message).join(', '),
    };
  }

  try {
    const passwordHash = await hashPassword(parsed.data.password);

    await prisma.user.update({
      where: { id: session.customer.userId },
      data: {
        passwordHash,
        passwordSetAt: new Date(),
        emailVerified: true,
      },
    });

    return { success: true };
  } catch (error) {
    console.error('Set permanent password error:', error);
    return { success: false, error: 'Failed to set password. Please try again.' };
  }
}

/**
 * Requests a tenant-bound password reset for a customer.
 * Prevents account enumeration by always returning a generic success message.
 */
export async function requestCustomerPasswordReset(params: {
  email: string;
  slug: string;
}) {
  const { email, slug } = params;
  const genericSuccess = {
    success: true,
    message: 'If an account exists for this company, instructions have been sent to your email.',
  };

  if (!email || !slug) return genericSuccess;

  // Rate Limiting (IP + Tenant + Email)
  try {
    let clientIp = '127.0.0.1';
    try {
      const headerStore = await headers();
      clientIp = headerStore.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
    } catch {
      // Test or offline context
    }

    const isAllowed = await RateLimiter.checkMulti(
      [clientIp, `reset:${slug.toLowerCase()}:${email.toLowerCase().trim()}`],
      RATE_LIMITS.LOGIN
    );

    if (!isAllowed) {
      return genericSuccess; // Non-enumerating fail closed
    }
  } catch {
    // Continue
  }

  try {
    const org = await prisma.organization.findUnique({
      where: { slug: slug.toLowerCase() },
      select: { id: true, name: true },
    });

    if (!org) return genericSuccess;

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: {
        customers: {
          where: { organizationId: org.id },
        },
      },
    });

    if (!user || user.customers.length === 0 || !user.isActive) {
      return genericSuccess;
    }

    const rawToken = randomBytes(32).toString('base64url');
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        organizationId: org.id,
        tokenHash,
        expiresAt,
      },
    });

    const resetUrl = await getAbsoluteServerUrl(`/auth/reset-password?token=${rawToken}&slug=${slug}`);

    await prisma.notification.create({
      data: {
        organizationId: org.id,
        userId: user.id,
        idempotencyKey: `pwdreset:${tokenHash}`,
        type: 'PASSWORD_RESET',
        channel: 'EMAIL',
        status: 'PENDING',
        subject: `Reset Your ${org.name} Portal Password`,
        content: `Hi ${user.firstName || 'Customer'},\n\nClick the link below to securely reset your ${org.name} customer portal password:\n\n${resetUrl}\n\nThis link is active for 1 hour.`,
        metadata: JSON.stringify({ email: user.email, resetUrl, organizationId: org.id }),
      },
    });

    return genericSuccess;
  } catch (error) {
    console.error('Customer password reset request error:', error);
    return genericSuccess;
  }
}

/**
 * Updates a customer's password from their authenticated portal profile.
 */
export async function updateCustomerPasswordFromProfile(formData: FormData) {
  const session = await requireCustomerSession();
  const currentPassword = formData.get('currentPassword') as string;
  const newPassword = formData.get('newPassword') as string;

  if (!newPassword || newPassword.length < 8) {
    return { success: false, error: 'New password must be at least 8 characters long' };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.customer.userId },
      select: { id: true, passwordHash: true },
    });

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    // If user already had a password, verify current password
    if (user.passwordHash) {
      const isValid = await verifyPassword(currentPassword, user.passwordHash);
      if (!isValid) {
        return { success: false, error: 'Incorrect current password' };
      }
    }

    const passwordHash = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordSetAt: new Date(),
      },
    });

    // Revoke old sessions upon password change for security
    await prisma.customerSession.updateMany({
      where: {
        customerId: session.customer.id,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    return { success: true };
  } catch (error) {
    console.error('Update password error:', error);
    return { success: false, error: 'Failed to update password' };
  }
}
