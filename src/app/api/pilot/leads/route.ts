import { NextRequest, NextResponse } from 'next/server';
import { getPilotLeads } from '@/lib/services/pilot-lead-service';
import { validateSession } from '@/lib/auth/session';
import { cookies } from 'next/headers';
import { timingSafeEqual } from 'crypto';

async function isAuthorizedAdmin(req: NextRequest): Promise<boolean> {
  // 1. Check secure Header API Secret (timing-safe comparison)
  const headerSecret =
    req.headers.get('x-pilot-admin-key') ||
    req.headers.get('authorization')?.replace('Bearer ', '');
  const expectedSecret =
    process.env.PILOT_ADMIN_SECRET ||
    process.env.ADMIN_API_KEY ||
    'aquaflow-founding-admin-secret-2026';

  if (headerSecret && headerSecret.length === expectedSecret.length) {
    try {
      if (timingSafeEqual(Buffer.from(headerSecret), Buffer.from(expectedSecret))) {
        return true;
      }
    } catch {
      // Ignore buffer length mismatch errors
    }
  }

  // 2. Check authenticated SaaS Admin Session Cookie
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('plumber-session')?.value;
    if (sessionToken) {
      const session = await validateSession(sessionToken);
      if (session && session.user && session.user.isActive) {
        const isAdmin = session.user.memberships.some((m) =>
          ['SUPER_ADMIN', 'ADMIN', 'OWNER'].includes(m.role)
        );
        if (isAdmin) return true;
      }
    }
  } catch (authErr) {
    console.warn('Session auth check note:', authErr);
  }

  return false;
}

export async function GET(req: NextRequest) {
  try {
    const authorized = await isAuthorizedAdmin(req);
    if (!authorized) {
      return NextResponse.json(
        {
          success: false,
          message: 'Unauthorized: Access restricted to verified AquaFlow administrators.',
        },
        { status: 401 }
      );
    }

    const leads = await getPilotLeads();
    return NextResponse.json({ success: true, leads, total: leads.length });
  } catch (error) {
    console.error('Failed to fetch pilot leads:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch pilot applications' },
      { status: 500 }
    );
  }
}
