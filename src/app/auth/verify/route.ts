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

  // 1. Mark token as used
  await prisma.magicLinkToken.update({
    where: { id: magicLink.id },
    data: { usedAt: new Date() }
  });

  // 2. Mark email as verified if not already
  if (!magicLink.user.emailVerified) {
    await prisma.user.update({
      where: { id: magicLink.user.id },
      data: { emailVerified: true }
    });
  }

  if (customerRecord && !customerRecord.emailVerifiedAt) {
    await prisma.customer.update({
      where: { id: customerId },
      data: { emailVerifiedAt: new Date() },
    });
  }

  // 3. Create Session and Cookie
  await createCustomerSession(customerId);

  // 4. Redirect to Portal Dashboard
  return NextResponse.redirect(new URL('/portal/dashboard', req.url));
}
