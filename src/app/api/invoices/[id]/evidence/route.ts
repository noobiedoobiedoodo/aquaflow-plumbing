import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionFromCookies, validateSession } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/constants';
import { InvoiceEvidenceService } from '@/lib/services/invoice-evidence-service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: invoiceId } = await params;
    const url = new URL(request.url);
    const versionParam = url.searchParams.get('version');

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { organizationId: true, currentVersion: true },
    });

    if (!invoice) {
      return new NextResponse('Invoice not found', { status: 404 });
    }

    // Must be Staff Admin/Dispatcher in this invoice's organization
    const staffToken = request.cookies.get('plumber-session')?.value || (await getSessionFromCookies());
    if (!staffToken) {
      return new NextResponse('Unauthorized: Staff session required', { status: 401 });
    }

    const currentUser = await validateSession(staffToken);
    if (!currentUser) {
      return new NextResponse('Unauthorized: Invalid session', { status: 401 });
    }

    const hasOrgMembership = currentUser.user.memberships.some(
      (m) => m.organizationId === invoice.organizationId && ADMIN_ROLES.includes(m.role as any)
    );

    if (!hasOrgMembership) {
      return new NextResponse('Forbidden: Cross-tenant access denied', { status: 403 });
    }

    const targetVersion = versionParam ? parseInt(versionParam, 10) : invoice.currentVersion;

    const { buffer, filename } = await InvoiceEvidenceService.exportEvidencePackage(
      invoice.organizationId,
      invoiceId,
      targetVersion
    );

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, no-cache',
      },
    });
  } catch (error: any) {
    console.error('Error exporting evidence package:', error);
    return new NextResponse(error.message || 'Internal Server Error', { status: 500 });
  }
}
