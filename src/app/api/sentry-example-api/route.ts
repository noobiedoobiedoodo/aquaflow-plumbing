import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    throw new Error('Sentry Serverless Test Error - AquaFlow Backend Verification');
  } catch (error) {
    Sentry.captureException(error);
    return NextResponse.json(
      { error: 'Internal Server Error (Captured by Sentry)' },
      { status: 500 }
    );
  }
}
