import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth/password';
import { revokeAllUserSessions } from '@/lib/auth/session';
import { resetPasswordSchema } from '@/lib/validation/auth.schema';
import { RateLimiter, RATE_LIMITS } from '@/lib/security/rate-limiter';

export async function POST(request: Request) {
  try {
    const ip = await RateLimiter.getClientIp(request);
    const body = await request.json();
    const result = resetPasswordSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.format() },
        { status: 400 }
      );
    }

    // Rate Limiting
    const isAllowed = await RateLimiter.check(ip, RATE_LIMITS.LOGIN);
    if (!isAllowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    const { token, newPassword } = result.data;

    const { hashToken } = await import('@/lib/auth/customer-session');
    const tokenHash = hashToken(token);

    // Find token by tokenHash
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!resetToken) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 400 }
      );
    }

    if (resetToken.usedAt) {
      return NextResponse.json(
        { error: 'Token has already been used' },
        { status: 400 }
      );
    }

    if (new Date() > resetToken.expiresAt) {
      return NextResponse.json(
        { error: 'Token has expired' },
        { status: 400 }
      );
    }

    if (!resetToken.user.isActive) {
      return NextResponse.json(
        { error: 'User account is inactive' },
        { status: 400 }
      );
    }

    // Hash new password
    const passwordHash = await hashPassword(newPassword);

    // Update user password and mark token as used atomically
    await prisma.$transaction(async (tx) => {
      const updatedToken = await tx.passwordResetToken.updateMany({
        where: { id: resetToken.id, usedAt: null },
        data: { usedAt: new Date() },
      });

      if (updatedToken.count === 0) {
        throw new Error('Token has already been used');
      }

      await tx.user.update({
        where: { id: resetToken.userId },
        data: {
          passwordHash,
          passwordSetAt: new Date(),
        },
      });

      await tx.customerSession.updateMany({
        where: {
          customer: { userId: resetToken.userId },
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
    });

    // Revoke all existing staff sessions so they have to log in again
    await revokeAllUserSessions(resetToken.userId);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
