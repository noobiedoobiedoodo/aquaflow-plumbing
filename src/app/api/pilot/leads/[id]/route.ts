import { NextRequest, NextResponse } from 'next/server';
import { updatePilotLeadStatus, PilotLeadStatus } from '@/lib/services/pilot-lead-service';
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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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
