import { NextRequest, NextResponse } from 'next/server';
import { isAuthorizedAdmin } from '../../leads/route';
import { getColdProspects } from '@/lib/services/prospecting-service';
import { sendProspectOutreachEmail } from '@/lib/services/outreach-service';

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
    const { prospectId } = body;

    if (!prospectId) {
      return NextResponse.json(
        { success: false, message: 'Missing prospectId parameter.' },
        { status: 400 }
      );
    }

    const prospects = await getColdProspects();
    const prospect = prospects.find((p) => p.id === prospectId);

    if (!prospect) {
      return NextResponse.json(
        { success: false, message: 'Prospect not found.' },
        { status: 404 }
      );
    }

    const result = await sendProspectOutreachEmail(prospect);

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.error || 'Failed to dispatch email.' },
        { status: 500 }
      );
    }

    const updated = (await getColdProspects()).find((p) => p.id === prospectId);

    return NextResponse.json({
      success: true,
      message: `Cold outreach email successfully sent to ${prospect.companyName} (${prospect.email})!`,
      prospect: updated,
    });
  } catch (error: any) {
    console.error('Failed to send single outreach email:', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'Internal error sending outreach email.' },
      { status: 500 }
    );
  }
}
