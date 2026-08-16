import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { generateToken } from '@/lib/utils';
import { Role } from '@/lib/constants';
import { createHash } from 'crypto';

const SESSION_COOKIE_NAME = 'plumber-session';
const SESSION_MAX_AGE_DAYS = Number(process.env.SESSION_MAX_AGE_DAYS) || 30;

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Creates a new session in the database.
 */
export async function createSession(userId: string, ipAddress?: string, userAgent?: string) {
  const rawToken = generateToken();
  const tokenHash = hashSessionToken(rawToken);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_MAX_AGE_DAYS);

  await prisma.session.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
      ipAddress,
      userAgent,
    },
  });

  return rawToken;
}

/**
 * Validates a session token and returns the session and user if valid.
 */
export async function validateSession(token: string) {
  if (!token) return null;
  const tokenHash = hashSessionToken(token);
  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: {
      user: {
        include: {
          memberships: {
            include: {
              organization: true,
            }
          },
        },
      },
    },
  });

  if (!session) return null;
  if (session.revokedAt) return null;
  if (new Date() > session.expiresAt) return null;
  if (!session.user.isActive) return null;

  return session;
}

/**
 * Revokes a specific session.
 */
export async function revokeSession(token: string) {
  if (!token) return;
  const tokenHash = hashSessionToken(token);
  await prisma.session.updateMany({
    where: { tokenHash },
    data: { revokedAt: new Date() },
  });
}

/**
 * Revokes all active sessions for a user.
 */
export async function revokeAllUserSessions(userId: string) {
  await prisma.session.updateMany({
    where: {
      userId,
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  });
}

/**
 * Gets the session token from cookies.
 */
export async function getSessionFromCookies(): Promise<string | undefined> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
    return sessionCookie?.value;
  } catch {
    return undefined;
  }
}

/**
 * Sets the session cookie.
 */
export async function setSessionCookie(token: string) {
  try {
    const expires = new Date();
    expires.setDate(expires.getDate() + SESSION_MAX_AGE_DAYS);

    const cookieStore = await cookies();
    cookieStore.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires,
    });
  } catch {
    // Gracefully ignore if called outside Next.js request context
  }
}

/**
 * Clears the session cookie.
 */
export async function clearSessionCookie() {
  try {
    const cookieStore = await cookies();
    cookieStore.set({
      name: SESSION_COOKIE_NAME,
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

/**
 * Gets the current authenticated user and their active session.
 */
export async function getCurrentUser() {
  const token = await getSessionFromCookies();
  if (!token) return null;

  const session = await validateSession(token);
  if (!session) return null;

  return {
    user: session.user,
    session,
  };
}

export async function requireAuth() {
  const current = await getCurrentUser();
  if (!current) {
    redirect('/login');
  }
  return current;
}

/**
 * Requires a specific role. Throws if user does not have the role in the organization.
 */
export async function requireRole(roles: Role[], organizationId?: string) {
  const current = await requireAuth();

  // If organizationId is provided, check if the user has the role in that specific organization
  if (organizationId) {
    const hasRole = current.user.memberships.some(
      (m) => m.organizationId === organizationId && roles.includes(m.role as Role)
    );
    if (!hasRole) {
      throw new Error('Forbidden');
    }
  } else {
    // If no organizationId, just check if they have the role in ANY organization
    // (useful for global actions or when organization context isn't strictly required but role is)
    const hasRole = current.user.memberships.some((m) => roles.includes(m.role as Role));
    if (!hasRole) {
      throw new Error('Forbidden');
    }
  }

  return current;
}

/**
 * Requires a specific role and returns the user's verified organizationId.
 * 
 * CRITICAL: This is the primary tenant isolation boundary.
 * The organizationId is ALWAYS derived from the authenticated session, never from client input.
 * All tenant-scoped queries MUST use the organizationId returned by this function.
 */
export async function requireRoleInOrg(roles: Role[], targetOrganizationId?: string) {
  const current = await requireAuth();

  // If a target organization is specified, the user MUST be an authorized member with that role in that specific organization
  if (targetOrganizationId) {
    const membership = current.user.memberships.find(
      (m) => m.organizationId === targetOrganizationId && roles.includes(m.role as Role)
    );
    if (!membership) {
      throw new Error('Forbidden: User is not authorized in the requested organization');
    }
    return {
      user: current.user,
      session: current.session,
      organizationId: membership.organizationId,
    };
  }

  // Validate that the user holds the required role in an active organization membership
  const matchingMemberships = current.user.memberships.filter((m) => roles.includes(m.role as Role));
  if (matchingMemberships.length === 0) {
    throw new Error('Forbidden: User does not hold the required role in any organization');
  }

  const membership = matchingMemberships[0];

  return {
    user: current.user,
    session: current.session,
    organizationId: membership.organizationId,
  };
}

/**
 * Validates that the organization has an active or grace-period subscription.
 * Throws if the subscription is CANCELED, UNPAID, or INCOMPLETE.
 */
export async function requireActiveSubscription(organizationId: string) {
  const current = await requireAuth();
  
  const membership = current.user.memberships.find(m => m.organizationId === organizationId);
  if (!membership) throw new Error('Forbidden');

  const status = (membership.organization as { subscriptionStatus?: string | null })?.subscriptionStatus;
  
  // No status means they haven't subscribed at all (or local dev)
  if (!status) return current;

  // Canceled or Unpaid restrict mutations
  if (['CANCELED', 'UNPAID', 'INCOMPLETE', 'INCOMPLETE_EXPIRED'].includes(status)) {
    throw new Error('Subscription inactive. Your account is currently in read-only mode.');
  }

  return current;
}
