import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies, revokeSession, clearSessionCookie } from '@/lib/auth/session';
import { getCustomerTokenFromCookies, revokeCustomerSession, clearCustomerSessionCookie } from '@/lib/auth/customer-session';

export async function POST(req: NextRequest) {
  try {
    let explicitType: string | null = null;
    const contentType = req.headers.get('content-type') || '';
    
    if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
      try {
        const formData = await req.formData();
        explicitType = formData.get('type') as string | null;
      } catch (e) {
        // Ignore form parse error if body is empty
      }
    } else if (contentType.includes('application/json')) {
      try {
        const body = await req.json();
        explicitType = body?.type || null;
      } catch (e) {
        // Ignore JSON parse error
      }
    }

    const cookieHeader = req.headers.get('cookie') || '';
    const parseCookie = (name: string) => {
      if (req.cookies?.get) {
        return req.cookies.get(name)?.value;
      }
      const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
      return match ? decodeURIComponent(match[1]) : undefined;
    };

    let staffLoggedOut = false;
    let customerLoggedOut = false;

    // 1. Staff Session Logout
    if (!explicitType || explicitType === 'staff' || explicitType === 'all') {
      const staffToken = parseCookie('plumber-session') || (await getSessionFromCookies());
      if (staffToken) {
        await revokeSession(staffToken);
        staffLoggedOut = true;
      }
      await clearSessionCookie();
    }

    // 2. Customer Session Logout
    if (!explicitType || explicitType === 'customer' || explicitType === 'all') {
      const customerToken = parseCookie('customer_session') || (await getCustomerTokenFromCookies());
      if (customerToken) {
        await revokeCustomerSession(customerToken);
        customerLoggedOut = true;
      }
      await clearCustomerSessionCookie();
    }

    // 3. Handle Browser Form Navigation vs API Response
    const acceptHeader = req.headers.get('accept') || '';
    const isHtmlNavigation =
      acceptHeader.includes('text/html') ||
      contentType.includes('application/x-www-form-urlencoded');

    if (isHtmlNavigation) {
      const redirectUrl = explicitType === 'customer' || (customerLoggedOut && !staffLoggedOut)
        ? new URL('/portal/login', req.url)
        : new URL('/login', req.url);

      return NextResponse.redirect(redirectUrl, { status: 303 });
    }

    return NextResponse.json(
      {
        success: true,
        staffLoggedOut,
        customerLoggedOut,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
