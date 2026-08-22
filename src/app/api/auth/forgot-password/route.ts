import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { generateToken } from '@/lib/utils';
import { forgotPasswordSchema } from '@/lib/validation/auth.schema';
import { RateLimiter, RATE_LIMITS } from '@/lib/security/rate-limiter';

export async function POST(request: Request) {
  try {
    const ip = await RateLimiter.getClientIp(request);
    const body = await request.json();
    const result = forgotPasswordSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.format() },
        { status: 400 }
      );
    }

    const { email } = result.data;

    // Rate Limiting (IP + Email)
    const isAllowed = await RateLimiter.checkMulti([ip, email.toLowerCase()], RATE_LIMITS.LOGIN);
    if (!isAllowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        memberships: true,
        customers: true,
      },
    });

    // We always return success to avoid email enumeration
    if (!user || !user.isActive) {
      return NextResponse.json({ success: true }, { status: 200 });
    }

    const { hashToken } = await import('@/lib/auth/customer-session');
    const { randomBytes } = await import('crypto');
    const rawToken = randomBytes(32).toString('base64url');
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    const orgId = user.memberships[0]?.organizationId || user.customers[0]?.organizationId || null;

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        organizationId: orgId,
        tokenHash,
        expiresAt,
      },
    });

    // Construct production URL for email dispatch
    const { getAbsoluteServerUrl } = await import('@/lib/config/url');
    const resetUrl = await getAbsoluteServerUrl(`/auth/reset-password?token=${rawToken}`);

    // Create Notification record for email if org exists
    if (orgId) {
      await prisma.notification.create({
        data: {
          organizationId: orgId,
          userId: user.id,
          idempotencyKey: `pwdreset:${tokenHash}`,
          type: 'PASSWORD_RESET',
          channel: 'EMAIL',
          status: 'PENDING',
          subject: 'Reset Your AquaFlow Password',
          content: `Hi ${user.firstName || 'User'},\n\nClick the link below to securely reset your password:\n\n${resetUrl}\n\nThis link is active for 1 hour.`,
          metadata: JSON.stringify({ email: user.email, resetUrl, organizationId: orgId }),
        },
      });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
