import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  // If the user gets redirected here because their link expired, we just send them back to onboarding
  // where they can click "Connect" again to generate a fresh link.
  return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/onboarding?error=link_expired`);
}
