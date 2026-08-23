import { NextRequest, NextResponse } from 'next/server';
import { isAuthorizedAdmin } from '../../leads/route';
import { runBatchColdOutreach } from '@/lib/services/outreach-service';
import { getColdProspects } from '@/lib/services/prospecting-service';

export async function POST(req: NextRequest) {
  try {
    const auth = await isAuthorizedAdmin(req);
    if (!auth) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized. Administrator access required.' },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { stateFilter, limit, prospectIds } = body;

    const campaignResult = await runBatchColdOutreach({
      stateFilter,
      limit: typeof limit === 'number' ? limit : 25,
      prospectIds: Array.isArray(prospectIds) ? prospectIds : undefined,
    });

    const updatedProspects = await getColdProspects();

    return NextResponse.json({
      success: true,
      message: `Automated campaign complete! Dispatched ${campaignResult.sent} emails (${campaignResult.failed} failed).`,
      stats: campaignResult,
      prospects: updatedProspects,
    });
  } catch (error: any) {
    console.error('Failed to run batch outreach campaign:', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'Internal error executing campaign.' },
      { status: 500 }
    );
  }
}
