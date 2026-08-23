import { prisma } from '../db';
import { ColdProspect, getColdProspects, updateColdProspectQualification } from './prospecting-service';

export interface OutreachEmailPayload {
  to: string;
  recipientName: string;
  companyName: string;
  city: string;
  state: string;
  painPoints: string[];
  technicianCount: string;
}

export function generateColdEmailContent(payload: OutreachEmailPayload) {
  const { recipientName, companyName, city, state, painPoints, technicianCount } = payload;
  const firstName = recipientName.split(' ')[0] || recipientName || 'there';
  const primaryPain = painPoints[0] || 'dispatch phone tag and late invoice deposits';
  const pilotUrl = `https://aquaflow-plumbing-theta.vercel.app/pilot?utm_source=cold_outbound&company=${encodeURIComponent(companyName)}&utm_campaign=${state.toLowerCase()}_pilot`;

  const subject = `Quick question regarding dispatch at ${companyName} (${city})`;

  const text = `Hi ${firstName},

I noticed ${companyName} is running a strong team in ${city}.

We built AquaFlow specifically for independent contractors with ${technicianCount} who are sick of paying $1,200/month for bloated ServiceTitan contracts or dealing with ${primaryPain.toLowerCase()}.

We are currently onboarding 3 founding plumbing partners in ${city} for our $199/month lifetime cohort (unlimited multi-tech dispatch, automated SMS on-my-way alerts, and instant card deposits on site).

Would you be open to taking a look at a 60-second live demo?

You can review the founding partner pilot cohort here:
${pilotUrl}

Best regards,
Travis Vance
Founding Team | AquaFlow Plumbing Operating System
https://aquaflowplumbing.com

---
AquaFlow Systems Inc. | 100 Innovation Way, Dallas TX / Winnipeg MB
To opt out of pilot notifications, reply "Unsubscribe" or visit https://aquaflow-plumbing-theta.vercel.app/privacy`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b; }
    .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
    .header { font-size: 18px; font-weight: 700; color: #0f172a; margin-bottom: 16px; }
    .btn { display: inline-block; background: linear-gradient(135deg, #0284c7, #0d9488); color: #ffffff !important; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; font-size: 14px; margin: 20px 0; }
    .pill { display: inline-block; background: #f1f5f9; padding: 4px 10px; border-radius: 6px; font-size: 12px; color: #475569; margin-bottom: 12px; border: 1px solid #e2e8f0; }
    .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #f1f5f9; font-size: 11px; color: #94a3b8; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="card">
    <div class="pill">🚀 AquaFlow Founding Partner Program • ${city}, ${state}</div>
    <div class="header">Hi ${firstName},</div>
    <p>I noticed <strong>${companyName}</strong> is running a high-demand plumbing operation in ${city}.</p>
    <p>We built AquaFlow specifically for independent trade businesses managing <strong>${technicianCount}</strong> who are tired of paying $1,200/month for clunky enterprise software or dealing with <strong>${primaryPain.toLowerCase()}</strong>.</p>
    
    <p>We are opening <strong>3 Founding Partner spots</strong> in your region at a locked-in <strong>$199/month lifetime rate</strong> (includes multi-tech dispatch, automated customer GPS arrival texts, and 1-click mobile invoice collection).</p>
    
    <div style="text-align: center;">
      <a href="${pilotUrl}" class="btn">Claim Founding Pilot Spot ($199/mo) →</a>
    </div>

    <p style="font-size: 13px; color: #64748b;">Zero contracts. Zero per-technician seat fees. Fully set up in under 5 minutes.</p>

    <div class="footer">
      <strong>Travis Vance</strong> • Founding Team<br>
      AquaFlow Plumbing Operating System • <a href="https://aquaflowplumbing.com" style="color: #0284c7;">aquaflowplumbing.com</a><br><br>
      AquaFlow Systems Inc. • 100 Innovation Way, Dallas TX / Winnipeg MB<br>
      <em>To opt out of future notifications, reply "Unsubscribe" or manage preferences <a href="https://aquaflow-plumbing-theta.vercel.app/privacy" style="color: #64748b;">here</a>.</em>
    </div>
  </div>
</body>
</html>`;

  return { subject, text, html };
}

/**
 * Sends a single automated cold outreach email via Resend
 */
export async function sendProspectOutreachEmail(prospect: ColdProspect): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { success: false, error: 'RESEND_API_KEY is not configured.' };
  }

  try {
    const { Resend } = await import('resend');
    const resend = new Resend(apiKey);
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'AquaFlow Growth <onboarding@resend.dev>';

    const emailContent = generateColdEmailContent({
      to: prospect.email,
      recipientName: prospect.contactName,
      companyName: prospect.companyName,
      city: prospect.city,
      state: prospect.state,
      painPoints: prospect.painPoints,
      technicianCount: prospect.technicianCount,
    });

    const founderReplyTo = process.env.FOUNDER_ALERT_EMAIL || process.env.RESEND_FROM_EMAIL;

    const res = await resend.emails.send({
      from: fromEmail,
      to: prospect.email,
      replyTo: founderReplyTo || undefined,
      subject: emailContent.subject,
      text: emailContent.text,
      html: emailContent.html,
      headers: {
        'X-Entity-Ref-ID': prospect.id,
      },
    });

    if (res.error) {
      console.error(`Resend dispatch error for ${prospect.email}:`, res.error);
      return { success: false, error: res.error.message };
    }

    // Update database status to EMAIL_SENT
    await updateColdProspectQualification(prospect.id, {
      outreachStatus: 'EMAIL_SENT',
      notes: `Automated cold outreach email dispatched on ${new Date().toLocaleString()}`,
    });

    return { success: true, messageId: res.data?.id };
  } catch (err: any) {
    console.error(`Failed to send cold email to ${prospect.email}:`, err);
    return { success: false, error: err.message || 'Unknown sending failure' };
  }
}

/**
 * Executes a high-deliverability batch cold outreach campaign
 */
export async function runBatchColdOutreach(options: {
  stateFilter?: string;
  limit?: number;
  prospectIds?: string[];
}): Promise<{
  totalProcessed: number;
  sent: number;
  failed: number;
  results: Array<{ id: string; companyName: string; email: string; success: boolean; error?: string }>;
}> {
  const allProspects = await getColdProspects();
  
  let candidates = allProspects.filter((p) => p.outreachStatus === 'NOT_CONTACTED');

  if (options.prospectIds && options.prospectIds.length > 0) {
    candidates = allProspects.filter((p) => options.prospectIds!.includes(p.id));
  } else if (options.stateFilter && options.stateFilter !== 'ALL') {
    candidates = candidates.filter((p) => p.state === options.stateFilter);
  }

  if (options.limit) {
    candidates = candidates.slice(0, options.limit);
  }

  const results: Array<{ id: string; companyName: string; email: string; success: boolean; error?: string }> = [];
  let sent = 0;
  let failed = 0;

  for (const prospect of candidates) {
    const outcome = await sendProspectOutreachEmail(prospect);
    if (outcome.success) {
      sent++;
      results.push({ id: prospect.id, companyName: prospect.companyName, email: prospect.email, success: true });
    } else {
      failed++;
      results.push({ id: prospect.id, companyName: prospect.companyName, email: prospect.email, success: false, error: outcome.error });
    }

    // Rate limiting throttle: 350ms delay between emails to maintain 100% deliverability
    await new Promise((r) => setTimeout(r, 350));
  }

  return {
    totalProcessed: candidates.length,
    sent,
    failed,
    results,
  };
}
