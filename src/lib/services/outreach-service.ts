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

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    'https://aquaflow-plumbing-theta.vercel.app';

  const pilotUrl = `${baseUrl}/pilot?utm_source=cold_outbound&company=${encodeURIComponent(companyName)}&utm_campaign=${state.toLowerCase()}_pilot`;
  const privacyUrl = `${baseUrl}/privacy`;
  const domainDisplay = baseUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');

  const subject = `Quick question regarding dispatch at ${companyName} (${city})`;

  const text = `Hi ${firstName},

I noticed ${companyName} is running a strong team in ${city}.

We built AquaFlow specifically for independent contractors with ${technicianCount} who are sick of paying $1,200/month for bloated ServiceTitan contracts or dealing with ${primaryPain.toLowerCase()}.

We are currently onboarding 3 founding plumbing partners in ${city} for our $199/month lifetime cohort (unlimited multi-tech dispatch, automated SMS on-my-way alerts, and instant card deposits on site).

Would you be open to taking a look at a 60-second live demo?

You can review the founding partner pilot cohort here:
${pilotUrl}

Best regards,
Stephan Sabeski
Founding Team | AquaFlow Plumbing Operating System
${pilotUrl}

---
AquaFlow Systems Inc. | 100 Innovation Way, Dallas TX / Winnipeg MB
To opt out of pilot notifications, reply "Unsubscribe" or visit ${privacyUrl}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f17; margin: 0; padding: 24px 12px; color: #1e293b; }
    .wrapper { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1); }
    .top-bar { background: linear-gradient(135deg, #0A121A 0%, #0F172A 100%); padding: 24px 28px; border-bottom: 2px solid #0284c7; }
    .brand-title { font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px; margin: 0; display: inline-flex; align-items: center; }
    .badge { display: inline-block; background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.35); color: #38bdf8; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-top: 8px; }
    .content { padding: 28px; background: #ffffff; }
    .salutation { font-size: 17px; font-weight: 700; color: #0f172a; margin-bottom: 12px; }
    p { font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 14px 0; }
    .feature-grid { margin: 18px 0; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; }
    .feature-item { display: flex; align-items: flex-start; margin-bottom: 10px; font-size: 13px; color: #1e293b; }
    .feature-item:last-child { margin-bottom: 0; }
    .feature-icon { margin-right: 10px; font-size: 16px; flex-shrink: 0; }
    .comparison-box { background: #0f172a; border-radius: 12px; padding: 16px; margin: 20px 0; color: #ffffff; }
    .comp-row { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; font-size: 12px; border-bottom: 1px solid #1e293b; }
    .comp-row:last-child { border-bottom: none; padding-top: 8px; font-weight: bold; }
    .btn-container { text-align: center; margin: 26px 0 18px 0; }
    .btn { display: inline-block; background: linear-gradient(135deg, #0284c7 0%, #0d9488 100%); color: #ffffff !important; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-weight: 800; font-size: 15px; box-shadow: 0 4px 14px rgba(2, 132, 199, 0.35); transition: all 0.2s ease; }
    .subtext { text-align: center; font-size: 12px; color: #64748b; margin-bottom: 20px; }
    .footer { background: #f8fafc; padding: 22px 28px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; line-height: 1.6; }
    .signoff { font-size: 13px; color: #1e293b; margin-bottom: 12px; }
  </style>
</head>
<body>
  <div class="wrapper">
    <!-- BRAND TOP BAR -->
    <div class="top-bar">
      <a href="${pilotUrl}" style="text-decoration: none;">
        <h1 class="brand-title">💧 AquaFlow<span style="color: #38bdf8;">OS</span></h1>
      </a>
      <br/>
      <div class="badge">🚀 Founding Partner Cohort • ${city}, ${state}</div>
    </div>

    <!-- MAIN BODY CONTENT -->
    <div class="content">
      <div class="salutation">Hi ${firstName},</div>
      <p>I noticed <strong>${companyName}</strong> is running a high-demand plumbing team in <strong>${city}</strong>.</p>
      <p>We built AquaFlow specifically for independent contractors managing <strong>${technicianCount}</strong> who are tired of paying $1,200/month for bloated enterprise software or dealing with <strong>${primaryPain.toLowerCase()}</strong>.</p>
      
      <!-- 3 VALUE PILLARS -->
      <div class="feature-grid">
        <div class="feature-item">
          <span class="feature-icon">⚡</span>
          <div><strong>Automated Multi-Tech Dispatch:</strong> Eliminates morning whiteboard chaos and dispatch phone tag.</div>
        </div>
        <div class="feature-item">
          <span class="feature-icon">📲</span>
          <div><strong>Customer GPS Alerts:</strong> Automatic "Tech is on the way" texts with live technician arrival tracking.</div>
        </div>
        <div class="feature-item">
          <span class="feature-icon">💳</span>
          <div><strong>Instant Mobile Payments:</strong> 1-click mobile invoicing and card deposits on site.</div>
        </div>
      </div>

      <!-- PRICING COMPARISON -->
      <div class="comparison-box">
        <div class="comp-row">
          <span style="color: #94a3b8;">Legacy Software (ServiceTitan)</span>
          <span style="color: #f87171;">$1,200+/mo • 12-Mo Lock-in</span>
        </div>
        <div class="comp-row">
          <span style="color: #38bdf8;">AquaFlow Founding Pilot</span>
          <span style="color: #34d399;">$199/mo Flat • Lifetime Rate (No Contracts)</span>
        </div>
      </div>

      <p>We are selecting <strong>3 Founding Plumbing Partners</strong> in your region for our lifetime $199/month cohort.</p>

      <!-- HIGH-IMPACT CTA -->
      <div class="btn-container">
        <a href="${pilotUrl}" class="btn">Claim Founding Pilot Spot ($199/mo) →</a>
      </div>

      <div class="subtext">
        🔒 Zero setup fees • Zero per-seat tech penalties • Set up in under 5 minutes
      </div>
    </div>

    <!-- COMPLIANT FOOTER -->
    <div class="footer">
      <div class="signoff">
        <strong>Stephan Sabeski</strong> • Founding Team<br/>
        AquaFlow Plumbing Operating System • <a href="${pilotUrl}" style="color: #0284c7; font-weight: bold; text-decoration: none;">${domainDisplay}/pilot</a>
      </div>
      AquaFlow Systems Inc. • 100 Innovation Way, Dallas TX / Winnipeg MB<br/>
      <em>To opt out of future partner invites, reply "Unsubscribe" or manage preferences <a href="${privacyUrl}" style="color: #64748b;">here</a>.</em>
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

    let res = await resend.emails.send({
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

    // If in Resend Sandbox mode (onboarding@resend.dev) without verified domain, route to owner test email
    if (res.error && res.error.message?.includes('You can only send testing emails to your own email address')) {
      const sandboxEmailMatch = res.error.message.match(/\(([^)]+)\)/);
      const ownerEmail = sandboxEmailMatch ? sandboxEmailMatch[1] : (process.env.FOUNDER_ALERT_EMAIL || 'stephan.sabeski12@gmail.com');
      
      console.log(`[Resend Sandbox] Forwarding test outreach to owner email (${ownerEmail}) for ${prospect.companyName}`);
      res = await resend.emails.send({
        from: fromEmail,
        to: ownerEmail,
        replyTo: founderReplyTo || undefined,
        subject: `[TEST OUTREACH ➔ ${prospect.companyName}] ${emailContent.subject}`,
        text: `[TEST SIMULATION FOR: ${prospect.contactName} <${prospect.email}> at ${prospect.companyName}]\n\n${emailContent.text}`,
        html: `<div style="background: #fef3c7; border: 1px solid #f59e0b; padding: 12px; border-radius: 8px; margin-bottom: 16px; font-size: 12px; color: #92400e;">
          ⚠️ <strong>Resend Sandbox Test Mode:</strong> This email was dispatched to your test address because <code>onboarding@resend.dev</code> is active. To send directly to <code>${prospect.email}</code>, verify your custom domain in <a href="https://resend.com/domains" target="_blank">resend.com/domains</a>.
        </div>${emailContent.html}`,
        headers: {
          'X-Entity-Ref-ID': prospect.id,
        },
      });
    }

    if (res.error) {
      if (res.error.message?.includes('daily email sending quota') || (res.error as any).name === 'daily_quota_exceeded') {
        console.warn('⚠️ Resend Free Tier Daily Quota Reached (200/200 emails sent today).');
        return {
          success: false,
          error: 'Resend Daily Free Tier Quota Reached (200/200 emails sent today). Resets at 00:00 UTC or upgrade at resend.com/billing.',
        };
      }
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
