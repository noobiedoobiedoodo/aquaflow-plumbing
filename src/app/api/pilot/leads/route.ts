import { NextRequest, NextResponse } from 'next/server';
import { getPilotLeads } from '@/lib/services/pilot-lead-service';

export async function GET(req: NextRequest) {
  try {
    const leads = await getPilotLeads();
    return NextResponse.json({ success: true, leads, total: leads.length });
  } catch (error) {
    console.error('Failed to fetch pilot leads:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch pilot applications' },
      { status: 500 }
    );
  }
}
