import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { randomBytes, createHash } from 'crypto';
import { hashToken } from '@/lib/auth/customer-session';
import { RateLimiter, RATE_LIMITS } from '@/lib/security/rate-limiter';

export async function POST(req: Request) {
  try {
    const { email, organizationSlug } = await req.json();
    if (!email) return new NextResponse('Email is required', { status: 400 });

    const ip = await RateLimiter.getClientIp();
    
    // Rate Limiting
    const isAllowed = await RateLimiter.checkMulti([ip, email.toLowerCase()], RATE_LIMITS.LOGIN);
    if (!isAllowed) {
      return new NextResponse('Too many requests. Please try again later.', { status: 429 });
    }

    // Always return a generic success message to prevent account enumeration
    const successResponse = NextResponse.json({ 
      message: 'If an account exists, a sign-in link has been sent to this email.' 
    });

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { 
        customers: {
          include: { organization: true }
        }
      }
    });

    if (!user || user.customers.length === 0) {
      // Simulate delay to prevent timing attacks
      await new Promise(r => setTimeout(r, 500));
      return successResponse;
    }

    // Determine target customer relationships (Never silently pick customers[0] for multi-org users)
    let targetCustomers: typeof user.customers = [];

    if (organizationSlug) {
      const matched = user.customers.find((c) => c.organization.slug === organizationSlug);
      if (matched) {
        targetCustomers = [matched];
      } else {
        // Slug does not match any customer record for this email
        await new Promise((r) => setTimeout(r, 500));
        return successResponse;
      }
    } else {
      // Generic portal login: issue an explicit, unambiguous magic link per customer organization
      targetCustomers = user.customers;
    }

    // Generate Single-Tenant Bound Tokens for each matching customer organization
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min expiry

    for (const customer of targetCustomers) {
      const rawToken = randomBytes(32).toString('base64url');
      const tokenHash = hashToken(rawToken);

      // Store in DB with explicit single-tenant and customer binding
      await prisma.magicLinkToken.create({
        data: {
          userId: user.id,
          organizationId: customer.organizationId,
          customerId: customer.id,
          tokenHash,
          expiresAt,
        },
      });

      const magicLinkUrl = `${baseUrl}/auth/verify?token=${rawToken}`;

      await prisma.notification.create({
        data: {
          organizationId: customer.organizationId,
          idempotencyKey: `magiclink:${tokenHash}`,
          userId: user.id,
          type: 'MAGIC_LINK',
          channel: 'EMAIL',
          status: 'PENDING',
          subject: `Your ${customer.organization.name} Portal Sign-in Link`,
          content: `Hi ${customer.firstName || user.firstName || 'Customer'},\n\nClick here to securely sign in to your ${customer.organization.name} customer portal. This link expires in 15 minutes.\n\n${magicLinkUrl}`,
          metadata: JSON.stringify({
            email: user.email,
            organizationId: customer.organizationId,
            customerId: customer.id,
          }),
        },
      });
    }

    return successResponse;

  } catch (error) {
    console.error('Magic link generation error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
