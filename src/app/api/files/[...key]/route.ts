import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies, validateSession } from '@/lib/auth/session';
import { getCustomerTokenFromCookies, validateCustomerSession } from '@/lib/auth/customer-session';
import { ROLES, ADMIN_ROLES } from '@/lib/constants';
import { prisma } from '@/lib/db';
import { storage } from '@/lib/storage';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string[] | string }> }
) {
  try {
    const { key } = await params;

    // Safely reconstruct the storage key from the catch-all parameter array
    const storageKey = Array.isArray(key) ? key.join('/') : key;

    // Defense against directory traversal and malicious paths
    if (
      !storageKey ||
      storageKey.includes('..') ||
      storageKey.includes('\\') ||
      storageKey.startsWith('/') ||
      storageKey.split('/').some((segment) => segment === '.' || segment === '..')
    ) {
      return new NextResponse('Invalid file key', { status: 400 });
    }

    // 1. Verify Authentication & Authorization
    const staffToken = request.cookies.get('plumber-session')?.value || (await getSessionFromCookies());
    let currentUser = null;
    if (staffToken) {
      currentUser = await validateSession(staffToken);
    }

    const customerToken = request.cookies.get('customer_session')?.value || (await getCustomerTokenFromCookies());
    let currentCustomer = null;
    if (customerToken) {
      currentCustomer = await validateCustomerSession(customerToken);
    }

    if (!currentUser && !currentCustomer) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // 2. Resolve File Association and Associated Job
    const signature = await prisma.customerSignature.findFirst({
      where: { storageKey },
      include: {
        job: {
          include: {
            appointment: true,
            technician: true,
          },
        },
      },
    });

    const photo = await prisma.jobPhoto.findFirst({
      where: { storageKey },
      include: {
        job: {
          include: {
            appointment: true,
            technician: true,
          },
        },
      },
    });

    const invoiceSig = await prisma.invoiceSignature.findFirst({
      where: { signedPdfKey: storageKey },
      include: { invoice: true },
    });

    const invoiceVer = await prisma.invoiceVersion.findFirst({
      where: { signedPdfKey: storageKey },
      include: { invoice: true },
    });

    const job = signature?.job || photo?.job;
    const invoice = invoiceSig?.invoice || invoiceVer?.invoice;

    if (!job && !invoice) {
      return new NextResponse('File record not found or access denied', { status: 404 });
    }

    let isAuthorized = false;

    // 3. Customer Authorization Check
    if (currentCustomer) {
      if (job && job.appointment && job.appointment.customerId === currentCustomer.customerId) {
        if (!photo || photo.customerVisible) {
          isAuthorized = true;
        }
      } else if (invoice && invoice.customerId === currentCustomer.customerId) {
        isAuthorized = true;
      }
    }

    // 4. Staff / Admin / Technician Authorization Check
    if (currentUser && !isAuthorized) {
      const { user } = currentUser;
      const targetOrgId = job?.organizationId || invoice?.organizationId;

      // TENANT ISOLATION: The staff user MUST have active membership in THIS entity's organization
      const orgMembership = user.memberships.find(
        (m) => m.organizationId === targetOrgId
      );

      if (orgMembership) {
        const isAdmin = ADMIN_ROLES.includes(orgMembership.role as any);
        const isTechnician = orgMembership.role === ROLES.TECHNICIAN;

        if (isAdmin) {
          isAuthorized = true;
        } else if (isTechnician && job) {
          if (job.technician?.userId === user.id) {
            isAuthorized = true;
          }
        }
      }
    }

    if (!isAuthorized) {
      return new NextResponse('Forbidden: Cross-tenant or unauthorized file access', {
        status: 403,
      });
    }

    // 5. Read and Serve File via Storage Provider
    const fileData = await storage.getFileBuffer(storageKey);

    if (!fileData) {
      return new NextResponse('File not found in storage', { status: 404 });
    }

    return new NextResponse(new Uint8Array(fileData.buffer), {
      status: 200,
      headers: {
        'Content-Type': fileData.contentType,
        'Cache-Control': 'private, no-transform, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error: any) {
    console.error('Error serving file:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
