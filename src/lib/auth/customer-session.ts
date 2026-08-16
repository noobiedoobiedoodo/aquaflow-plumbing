import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { randomBytes, createHash } from 'crypto';
import { redirect } from 'next/navigation';

const CUSTOMER_SESSION_COOKIE = 'customer_session';
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export async function createCustomerSession(customerId: string) {
  const token = randomBytes(32).toString('base64url');
  const tokenHash = hashToken(token);
  
  await prisma.customerSession.create({
    data: {
      customerId,
      tokenHash,
      expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
    }
  });

  try {
    const cookieStore = await cookies();
    cookieStore.set(CUSTOMER_SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: new Date(Date.now() + SESSION_DURATION_MS),
      path: '/',
    });
  } catch {
    // Gracefully ignore if called outside Next.js request context (e.g. tests or background workers)
  }

  await prisma.customerActivity.create({
    data: {
      customerId,
      action: 'CUSTOMER_LOGIN',
    }
  });

  return token;
}

export async function validateCustomerSession(token: string) {
  if (!token) return null;

  const tokenHash = hashToken(token);
  const session = await prisma.customerSession.findUnique({
    where: { tokenHash },
    include: { customer: true }
  });

  if (!session) return null;
  if (session.revokedAt || session.expiresAt < new Date()) {
    return null;
  }

  // Update lastUsedAt in background without blocking the request
  prisma.customerSession.update({
    where: { id: session.id },
    data: { lastUsedAt: new Date() }
  }).catch(() => {});

  return {
    customer: session.customer,
    customerId: session.customerId,
    sessionId: session.id,
  };
}

export async function getCustomerSession(tokenFromReq?: string) {
  const token = tokenFromReq || (await getCustomerTokenFromCookies());
  if (!token) return null;
  return validateCustomerSession(token);
}

export async function requireCustomerSession() {
  const session = await getCustomerSession();
  if (!session) {
    redirect('/portal/login');
  }
  return session;
}

export async function getCustomerTokenFromCookies(): Promise<string | undefined> {
  try {
    const cookieStore = await cookies();
    return cookieStore.get(CUSTOMER_SESSION_COOKIE)?.value;
  } catch {
    return undefined;
  }
}

export async function clearCustomerSessionCookie() {
  try {
    const cookieStore = await cookies();
    cookieStore.set({
      name: CUSTOMER_SESSION_COOKIE,
      value: '',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires: new Date(0),
    });
  } catch {
    // Gracefully ignore if called outside Next.js request context
  }
}

export async function revokeCustomerSession(token?: string) {
  let sessionToken = token;
  if (!sessionToken) {
    sessionToken = await getCustomerTokenFromCookies();
  }

  if (sessionToken) {
    const tokenHash = hashToken(sessionToken);
    await prisma.customerSession.updateMany({
      where: { tokenHash },
      data: { revokedAt: new Date() },
    });
  }

  await clearCustomerSessionCookie();
}

