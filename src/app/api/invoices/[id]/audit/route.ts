import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionFromCookies, validateSession } from '@/lib/auth/session';
import { getCustomerTokenFromCookies, validateCustomerSession } from '@/lib/auth/customer-session';
import { ADMIN_ROLES } from '@/lib/constants';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: invoiceId } = await params;

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { organizationId: true, customerId: true, invoiceNumber: true },
    });

    if (!invoice) {
      return new NextResponse('Invoice not found', { status: 404 });
    }

    let isAuthorized = false;

    // Staff check
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

    // Customer check
    if (!isAuthorized) {
      const customerToken = request.cookies.get('customer_session')?.value || (await getCustomerTokenFromCookies());
      if (customerToken) {
        const currentCustomer = await validateCustomerSession(customerToken);
        if (currentCustomer && currentCustomer.customerId === invoice.customerId) {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      return new NextResponse('Forbidden: Cross-tenant or unauthorized audit access', { status: 403 });
    }

    const events = await prisma.invoiceAuditEvent.findMany({
      where: { invoiceId, organizationId: invoice.organizationId },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({
      invoiceNumber: invoice.invoiceNumber,
      organizationId: invoice.organizationId,
      totalEvents: events.length,
      events,
    });
  } catch (error: any) {
    console.error('Error fetching invoice audit timeline:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
