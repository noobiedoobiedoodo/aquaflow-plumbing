import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SESSION_COOKIE_NAME = 'plumber-session';

// Define route prefixes that require authentication
const protectedRoutes = [
  '/dashboard',
  '/tech',
  '/account'
];

// Public API routes that don't require auth
const publicApiRoutes = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/booking', // public booking endpoints
  '/api/health-check'
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Check if it's an API route
  const isApiRoute = pathname.startsWith('/api/');
  
  // Skip proxy for public API routes
  if (isApiRoute && publicApiRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Check if the route requires authentication
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));

  // If it's a protected route and there's no session cookie, redirect to login
  if (isProtectedRoute) {
    const sessionToken = request.cookies.get(SESSION_COOKIE_NAME);
    
    if (!sessionToken?.value) {
      // For API routes, return 401 instead of redirecting
      if (isApiRoute) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(loginUrl);
    }
    
    // Note: We only check for the existence of the cookie here.
    // Full validation and role checking must happen in the route handlers
    // since we can't reliably query the DB in proxy (edge runtime).
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Apply to all routes except standard Next.js files and public static files
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};
