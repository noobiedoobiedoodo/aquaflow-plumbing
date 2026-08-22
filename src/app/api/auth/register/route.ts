import { NextResponse } from 'next/server';
import { RateLimiter, RATE_LIMITS } from '@/lib/security/rate-limiter';

/**
 * Direct unassociated registration is disabled to prevent orphan account creation and database pollution.
 * Users must either register a tenant via /actions/onboarding or be invited to an existing organization.
 */
export async function POST(request: Request) {
  try {
    const ip = await RateLimiter.getClientIp(request);
    
    // Rate limiting to mitigate spam/probing
    const isAllowed = await RateLimiter.check(ip, RATE_LIMITS.LOGIN);
    if (!isAllowed) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
    }

    return NextResponse.json(
      { 
        error: 'Direct user registration is disabled. Please sign up your company at /signup or use an organization invitation.' 
      },
      { status: 403 }
    );
  } catch (error) {
    console.error('Registration endpoint error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
