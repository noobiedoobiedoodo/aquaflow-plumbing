import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { hashToken, createCustomerSession } from '@/lib/auth/customer-session';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const rawToken = url.searchParams.get('token');

  if (!rawToken) {
    return new NextResponse('Missing token', { status: 400 });
  }

  const tokenHash = hashToken(rawToken);

  const magicLink = await prisma.magicLinkToken.findUnique({
    where: { tokenHash },
    include: { user: { include: { customers: true } } }
  });

  if (!magicLink) {
    return new NextResponse('Invalid or expired token', { status: 400 });
  }

  if (magicLink.usedAt) {
    return new NextResponse('This link has already been used.', { status: 400 });
  }

  if (magicLink.expiresAt < new Date()) {
    return new NextResponse('This link has expired. Please request a new one.', { status: 400 });
  }

  // Strict Tenant Binding: Resolve customer strictly from token's customerId and organizationId
  let customerRecord = null;
  if (magicLink.customerId) {
    customerRecord = magicLink.user.customers.find(
      (c) => c.id === magicLink.customerId && (!magicLink.organizationId || c.organizationId === magicLink.organizationId)
    );
  } else if (magicLink.organizationId) {
    customerRecord = magicLink.user.customers.find(
      (c) => c.organizationId === magicLink.organizationId
    );
  }

  if (!customerRecord) {
    return new NextResponse('No associated customer organization found for this token.', { status: 400 });
  }

  const customerId = customerRecord.id;
  const destination = !magicLink.user.passwordSetAt ? '/portal/setup-password' : '/portal/dashboard';

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Atomic token consumption (prevents concurrent replay race conditions)
      const updatedToken = await tx.magicLinkToken.updateMany({
        where: { id: magicLink.id, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() }
      });

      if (updatedToken.count === 0) {
        throw new Error('TOKEN_ALREADY_USED_OR_EXPIRED');
      }

      // 2. Mark email as verified if not already
      if (!magicLink.user.emailVerified) {
        await tx.user.update({
          where: { id: magicLink.user.id },
          data: { emailVerified: true }
        });
      }

      if (customerRecord && !customerRecord.emailVerifiedAt) {
        await tx.customer.update({
          where: { id: customerId },
          data: { emailVerifiedAt: new Date() },
        });
      }
    });
  } catch (err: any) {
    if (err.message === 'TOKEN_ALREADY_USED_OR_EXPIRED') {
      return new NextResponse('This link has already been used or has expired.', { status: 400 });
    }
    throw err;
  }

  // 3. Create Session and Cookie
  await createCustomerSession(customerId);

  // 4. Redirect: If customer has not established a password yet, guide to setup-password; else dashboard
  return NextResponse.redirect(new URL(destination, req.url));
}
