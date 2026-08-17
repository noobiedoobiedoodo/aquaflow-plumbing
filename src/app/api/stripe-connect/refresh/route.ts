import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { getServerBaseUrl } = await import('@/lib/config/url');
  const baseUrl = await getServerBaseUrl();
  return NextResponse.redirect(`${baseUrl}/onboarding?error=link_expired`);
}
