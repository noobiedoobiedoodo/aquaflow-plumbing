import { NextRequest, NextResponse } from 'next/server';
import { updatePilotLeadStatus, PilotLeadStatus } from '@/lib/services/pilot-lead-service';
import { validateSession } from '@/lib/auth/session';
import { cookies } from 'next/headers';
import { timingSafeEqual } from 'crypto';
import { z } from 'zod';

const updateSchema = z.object({
  status: z.enum([
    'NEW',
    'CONTACTED',
    'QUALIFIED',
    'APPROVED',
    'WAITLIST',
    'ONBOARDING',
    'ONBOARDED',
    'DECLINED',
  ]),
  notes: z.string().optional(),
});

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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const body = await req.json();
    const validated = updateSchema.parse(body);

    const updated = await updatePilotLeadStatus(
      id,
      validated.status as PilotLeadStatus,
      validated.notes
    );

    if (!updated) {
      return NextResponse.json(
        { success: false, message: 'Lead not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      lead: updated,
      message: `Lead status updated to ${validated.status}`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, errors: error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    console.error('Failed to update pilot lead:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error updating lead' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const { deletePilotLead } = await import('@/lib/services/pilot-lead-service');
    await deletePilotLead(id);

    return NextResponse.json({
      success: true,
      message: 'Pilot lead deleted successfully.',
    });
  } catch (error) {
    console.error('Failed to delete pilot lead:', error);
    return NextResponse.json(
      { success: false, message: 'Internal error deleting lead' },
      { status: 500 }
    );
  }
}
