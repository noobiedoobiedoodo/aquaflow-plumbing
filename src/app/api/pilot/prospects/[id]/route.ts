import { NextRequest, NextResponse } from 'next/server';
import { isAuthorizedAdmin } from '../../leads/route';
import {
  updateColdProspectQualification,
  ensureColdProspectsTable,
} from '@/lib/services/prospecting-service';
import { prisma } from '@/lib/db';

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await isAuthorizedAdmin(req);
    if (!auth) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized. Administrator access required.' },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const { interestLevel, outreachStatus, notes } = body;

    const updated = await updateColdProspectQualification(id, {
      interestLevel,
      outreachStatus,
      notes,
    });

    if (!updated) {
      return NextResponse.json(
        { success: false, message: `Cold prospect not found with ID: ${id}` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Prospect qualification updated successfully',
      prospect: updated,
    });
  } catch (error) {
    console.error('Failed to update prospect:', error);
    return NextResponse.json(
      { success: false, message: 'Internal error updating prospect' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await isAuthorizedAdmin(req);
    if (!auth) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized. Administrator access required.' },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    await ensureColdProspectsTable();
    await prisma.$executeRawUnsafe(`DELETE FROM cold_prospects WHERE id = $1`, id);

    return NextResponse.json({
      success: true,
      message: `Prospect ${id} deleted successfully`,
    });
  } catch (error) {
    console.error('Failed to delete prospect:', error);
    return NextResponse.json(
      { success: false, message: 'Internal error deleting prospect' },
      { status: 500 }
    );
  }
}
