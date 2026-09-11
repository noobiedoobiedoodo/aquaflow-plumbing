import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { storage } from '@/lib/storage';
import { getSessionFromCookies, validateSession } from '@/lib/auth/session';
import { getCustomerTokenFromCookies, validateCustomerSession } from '@/lib/auth/customer-session';
import { ADMIN_ROLES } from '@/lib/constants';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: invoiceId } = await params;
    const url = new URL(request.url);
    const token = url.searchParams.get('token');
    const versionParam = url.searchParams.get('version');

    // 1. Fetch invoice with organization
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { organization: true },
    });

    if (!invoice) {
      return new NextResponse('Invoice not found', { status: 404 });
    }

    // 2. Multi-Tenant Authorization Check (Refinement #6 & #7)
    let isAuthorized = false;

    // Check staff session
    const staffToken = request.cookies.get('plumber-session')?.value || (await getSessionFromCookies());
    if (staffToken) {
      const currentUser = await validateSession(staffToken);
      if (currentUser) {
        const hasOrgMembership = currentUser.user.memberships.some(
          (m) => m.organizationId === invoice.organizationId && ADMIN_ROLES.includes(m.role as any)
        );
        if (hasOrgMembership) isAuthorized = true;
      }
    }

    // Check customer session
    if (!isAuthorized) {
      const customerToken = request.cookies.get('customer_session')?.value || (await getCustomerTokenFromCookies());
      if (customerToken) {
        const currentCustomer = await validateCustomerSession(customerToken);
        if (currentCustomer && currentCustomer.customerId === invoice.customerId) {
          isAuthorized = true;
        }
      }
    }

    // Check secure public capability token
    if (!isAuthorized && token && token === invoice.paymentToken) {
      isAuthorized = true;
    }

    if (!isAuthorized) {
      return new NextResponse('Forbidden: Cross-tenant or unauthorized document access', { status: 403 });
    }

    // 3. Resolve target InvoiceVersion
    const targetVersionNumber = versionParam ? parseInt(versionParam, 10) : invoice.currentVersion;

    const version = await prisma.invoiceVersion.findUnique({
      where: {
        invoiceId_versionNumber: {
          invoiceId,
          versionNumber: targetVersionNumber,
        },
      },
    });

    if (!version || !version.signedPdfKey) {
      return new NextResponse('Signed PDF artifact not yet generated or available for this version.', {
        status: 404,
      });
    }

    // 4. Retrieve PDF Buffer via Private Storage Provider
    const fileData = await storage.getFileBuffer(version.signedPdfKey);
    if (!fileData) {
      return new NextResponse('Document file not found in storage.', { status: 404 });
    }

    return new NextResponse(new Uint8Array(fileData.buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="invoice-${invoice.invoiceNumber}-v${version.versionNumber}.pdf"`,
        'Cache-Control': 'private, no-transform, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error: any) {
    console.error('Error streaming invoice PDF:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
