import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getPilotLeads, updatePilotLeadStatus } from '@/lib/services/pilot-lead-service';
import { hashPassword } from '@/lib/auth/password';
import { validateSession } from '@/lib/auth/session';
import { cookies } from 'next/headers';
import { timingSafeEqual, randomBytes } from 'crypto';
import { ROLES, DEFAULT_SERVICES } from '@/lib/constants';

async function isAuthorizedAdmin(req: NextRequest): Promise<boolean> {
  const headerSecret =
    req.headers.get('x-pilot-admin-key') ||
    req.headers.get('authorization')?.replace('Bearer ', '');
  const expectedSecret =
    process.env.PILOT_ADMIN_SECRET ||
    process.env.ADMIN_API_KEY ||
    'aquaflow-founding-admin-secret-2026';

  if (headerSecret && headerSecret.length === expectedSecret.length) {
    try {
      if (timingSafeEqual(Buffer.from(headerSecret), Buffer.from(expectedSecret))) {
        return true;
      }
    } catch {}
  }

  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('plumber-session')?.value;
    if (sessionToken) {
      const session = await validateSession(sessionToken);
      if (session?.user?.isActive) {
        const isAdmin = session.user.memberships.some((m) =>
          ['SUPER_ADMIN', 'ADMIN', 'OWNER'].includes(m.role)
        );
        if (isAdmin) return true;
      }
    }
  } catch {}

  return false;
}

const US_TIMEZONES: Record<string, string> = {
  TX: 'America/Chicago',
  FL: 'America/New_York',
  CA: 'America/Los_Angeles',
  NY: 'America/New_York',
  IL: 'America/Chicago',
  OH: 'America/New_York',
  GA: 'America/New_York',
  NC: 'America/New_York',
  AZ: 'America/Phoenix',
  WA: 'America/Los_Angeles',
  CO: 'America/Denver',
  MB: 'America/Winnipeg',
  ON: 'America/Toronto',
  AB: 'America/Edmonton',
  BC: 'America/Vancouver',
};

const RAW_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.APP_URL ||
  'https://www.flowloopos.com';

const BASE_URL =
  RAW_URL.includes('aquaflow') || RAW_URL.includes('flowloop.com') || RAW_URL.includes('localhost') || !RAW_URL.startsWith('http')
    ? 'https://www.flowloopos.com'
    : RAW_URL;

const EMAIL_LOGO_URL = 'https://www.flowloopos.com/brand/flowloop-logo-white.png';

function generateReactivationEmailHtml(params: {
  firstName: string;
  companyName: string;
  activationLink: string;
  paymentLink: string;
  baseUrl: string;
}) {
  const { firstName, companyName, activationLink, paymentLink, baseUrl } = params;
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f17; margin: 0; padding: 24px 12px; color: #1e293b; }
    .wrapper { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1); }
    .top-bar { background: linear-gradient(135deg, #0A121A 0%, #0F172A 100%); padding: 20px 28px; border-bottom: 2px solid #0284c7; }
    .badge { display: inline-block; background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.35); color: #38bdf8; padding: 5px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
    .content { padding: 28px; background: #ffffff; }
    .salutation { font-size: 18px; font-weight: 700; color: #0f172a; margin-bottom: 12px; }
    p { font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 14px 0; }
    .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px 20px; margin: 18px 0; }
    .btn { display: inline-block; background: linear-gradient(135deg, #0284c7 0%, #0d9488 100%); color: #ffffff !important; text-decoration: none; padding: 13px 26px; border-radius: 10px; font-weight: 800; font-size: 14px; box-shadow: 0 4px 14px rgba(2, 132, 199, 0.3); }
    .btn-secondary { display: inline-block; background: #0f172a; color: #38bdf8 !important; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-weight: 700; font-size: 13px; border: 1px solid #1e293b; }
    .footer { background: #f8fafc; padding: 22px 28px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; line-height: 1.6; }
    .warning { background: #fef3c7; border: 1px solid #f59e0b; padding: 10px 14px; border-radius: 8px; font-size: 12px; color: #92400e; margin-top: 10px; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="top-bar">
      <table cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
        <tr>
          <td style="vertical-align: middle;">
            <a href="${baseUrl}" style="text-decoration: none; display: inline-block;">
              <img src="${EMAIL_LOGO_URL}" alt="FlowLoop OS" width="169" height="32" style="height: 32px; width: 169px; max-width: 169px; display: block; border: 0; outline: none; text-decoration: none;" />
            </a>
          </td>
          <td align="right" style="vertical-align: middle;">
            <span class="badge">🚀 Account Activation</span>
          </td>
        </tr>
      </table>
    </div>

    <div class="content">
      <div class="salutation">Hi ${firstName},</div>
      <p>Your FlowLoop OS dedicated operating system is provisioned for <strong>${companyName}</strong>.</p>
      
      <div class="card">
        <strong style="color: #0f172a; font-size: 15px;">1️⃣ Secure 3-Minute Activation Link:</strong>
        <p style="margin: 8px 0 12px 0;">Click the button below to set your password and access your dashboard:</p>
        <div style="text-align: center; margin: 14px 0;">
          <a href="${activationLink}" class="btn">Activate Account Now →</a>
        </div>
        <div class="warning">
          ⚠️ <strong>Security Notice:</strong> This activation link expires in 3 minutes.
        </div>
      </div>

      <div class="card">
        <strong style="color: #0f172a; font-size: 15px;">2️⃣ Founding Pilot Subscription ($199/mo):</strong>
        <p style="margin: 8px 0 12px 0;">Locks in your lifetime $199/month rate with unlimited dispatch and zero per-technician fees:</p>
        <div style="text-align: center; margin: 12px 0;">
          <a href="${paymentLink}" class="btn-secondary">Lock In Lifetime $199/mo Rate →</a>
        </div>
      </div>
    </div>

    <div class="footer">
      <strong>FlowLoop OS Founding Team</strong> • <a href="${baseUrl}" style="color: #0284c7; text-decoration: none;">flowloopos.com</a><br/>
      FlowLoop Systems Inc. • 100 Innovation Way, Dallas TX / Winnipeg MB
    </div>
  </div>
</body>
</html>`;
}

function generateWelcomeEmailHtml(params: {
  firstName: string;
  companyName: string;
  activationLink: string;
  paymentLink: string;
  baseUrl: string;
}) {
  const { firstName, companyName, activationLink, paymentLink, baseUrl } = params;
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f17; margin: 0; padding: 24px 12px; color: #1e293b; }
    .wrapper { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1); }
    .top-bar { background: linear-gradient(135deg, #0A121A 0%, #0F172A 100%); padding: 20px 28px; border-bottom: 2px solid #0284c7; }
    .badge { display: inline-block; background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.35); color: #38bdf8; padding: 5px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
    .content { padding: 28px; background: #ffffff; }
    .salutation { font-size: 18px; font-weight: 700; color: #0f172a; margin-bottom: 12px; }
    p { font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 14px 0; }
    .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px 20px; margin: 18px 0; }
    .checklist { list-style: none; padding: 0; margin: 12px 0; }
    .checklist li { font-size: 13px; color: #1e293b; padding: 5px 0; display: flex; align-items: center; }
    .btn { display: inline-block; background: linear-gradient(135deg, #0284c7 0%, #0d9488 100%); color: #ffffff !important; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-weight: 800; font-size: 15px; box-shadow: 0 4px 14px rgba(2, 132, 199, 0.35); }
    .btn-secondary { display: inline-block; background: #0f172a; color: #38bdf8 !important; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-weight: 700; font-size: 13px; border: 1px solid #1e293b; }
    .warning { background: #fef3c7; border: 1px solid #f59e0b; padding: 10px 14px; border-radius: 8px; font-size: 12px; color: #92400e; margin-top: 10px; }
    .footer { background: #f8fafc; padding: 22px 28px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="top-bar">
      <table cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
        <tr>
          <td style="vertical-align: middle;">
            <a href="${baseUrl}" style="text-decoration: none; display: inline-block;">
              <img src="${EMAIL_LOGO_URL}" alt="FlowLoop OS" width="169" height="32" style="height: 32px; width: 169px; max-width: 169px; display: block; border: 0; outline: none; text-decoration: none;" />
            </a>
          </td>
          <td align="right" style="vertical-align: middle;">
            <span class="badge">🚀 Founding Pilot Cohort</span>
          </td>
        </tr>
      </table>
    </div>

    <div class="content">
      <div class="salutation">Welcome to FlowLoop OS, ${firstName}!</div>
      <p>Your commercial plumbing operating system has been provisioned for <strong>${companyName}</strong>.</p>
      
      <div class="card">
        <strong style="color: #0f172a; font-size: 15px;">1️⃣ Step 1: Set Password & Access Dashboard</strong>
        <p style="margin: 8px 0 12px 0;">Click the button below to set your permanent login password and enter your workspace:</p>
        <div style="text-align: center; margin: 16px 0;">
          <a href="${activationLink}" class="btn">Activate Your Account Now →</a>
        </div>
        <div class="warning">
          ⚠️ <strong>Security Notice:</strong> For your protection, this activation link is valid for 3 minutes.
        </div>
      </div>

      <div class="card">
        <strong style="color: #0f172a; font-size: 15px;">2️⃣ Step 2: Lock In $199/mo Lifetime Pilot Rate</strong>
        <p style="margin: 8px 0 12px 0;">Guarantee your $199/mo rate with unlimited technician dispatch and zero per-seat fees:</p>
        <div style="text-align: center; margin: 12px 0;">
          <a href="${paymentLink}" class="btn-secondary">Lock In Lifetime $199/mo Rate →</a>
        </div>
      </div>

      <div class="card" style="background: #ffffff; border: 1px solid #cbd5e1;">
        <strong style="color: #0f172a; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Ready in your workspace:</strong>
        <ul class="checklist">
          <li>✅ <strong>${companyName}</strong> Organization & Member Roles</li>
          <li>✅ 6 Pre-Configured Plumbing Services (Heaters, Drains, Leaks, Jetting)</li>
          <li>✅ Multi-Tech Dispatch & Scheduling Calendar</li>
          <li>✅ Instant Mobile Invoicing & Stripe Payment Engine</li>
        </ul>
      </div>

      <p style="font-size: 13px; color: #64748b;">
        Need assistance or a 10-minute walkthrough? Simply reply directly to this email and our founding team will jump in.
      </p>
    </div>

    <div class="footer">
      <strong>The FlowLoop OS Team</strong> • <a href="${baseUrl}/pilot" style="color: #0284c7; text-decoration: none;">flowloopos.com/pilot</a><br/>
      FlowLoop Systems Inc. • 100 Innovation Way, Dallas TX / Winnipeg MB
    </div>
  </div>
</body>
</html>`;
}

async function generatePilotPaymentLink(
  orgId: string,
  companyName: string,
  email: string,
  currency: string = 'USD'
): Promise<string> {
  if (process.env.STRIPE_SECRET_KEY) {
    try {
      const { stripe } = await import('@/lib/stripe');
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        line_items: [
          {
            price_data: {
              currency: currency.toLowerCase(),
              product_data: {
                name: 'FlowLoop OS Founding Partner Pilot Cohort',
                description: `Lifetime $199/mo rate for ${companyName} with unlimited dispatch, scheduling & automated invoicing.`,
                tax_code: 'txcd_10103000',
              },
              unit_amount: 19900, // $199.00 / month
              recurring: {
                interval: 'month',
              },
            },
            quantity: 1,
          },
        ],
        client_reference_id: orgId,
        customer_email: email,
        metadata: {
          organizationId: orgId,
          companyName,
          pilotCohort: 'founding-2026',
        },
        success_url: `${BASE_URL}/dashboard?payment=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${BASE_URL}/pilot?payment=canceled`,
      });
      if (session.url) return session.url;
    } catch (stripeErr) {
      console.warn('Stripe checkout session creation note:', stripeErr);
    }
  }
  return `${BASE_URL}/pricing?org=${orgId}&cohort=pilot199`;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authorized = await isAuthorizedAdmin(req);
    if (!authorized) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized: Admin authentication required' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const leads = await getPilotLeads();
    let lead = leads.find((l) => l.id === id);

    if (!lead) {
      const { getColdProspects } = await import('@/lib/services/prospecting-service');
      const prospects = await getColdProspects();
      const prospect = prospects.find((p) => p.id === id);
      if (prospect) {
        lead = {
          id: prospect.id,
          companyName: prospect.companyName,
          contactName: prospect.contactName,
          email: prospect.email,
          phone: prospect.phone,
          website: prospect.website,
          city: prospect.city,
          province: prospect.state,
          technicianCount: prospect.technicianCount,
          painPoints: prospect.painPoints,
          notes: prospect.notes,
          status: 'QUALIFIED',
          source: 'cold_outbound',
          createdAt: prospect.createdAt,
          updatedAt: prospect.updatedAt,
        };
      }
    }

    if (!lead) {
      return NextResponse.json(
        { success: false, message: `Lead or Prospect not found with ID: ${id}` },
        { status: 404 }
      );
    }

    const cleanEmail = lead.email.toLowerCase().trim();
    const existingUser = await prisma.user.findUnique({
      where: { email: cleanEmail },
      include: {
        memberships: {
          include: { organization: true },
        },
      },
    });

    if (existingUser && existingUser.memberships.length > 0) {
      const existingOrg = existingUser.memberships[0].organization;
      await updatePilotLeadStatus(lead.id, 'ONBOARDED', `Existing Org: ${existingOrg.name}`);

      // Generate a fresh 3-Minute One-Time Secure Activation Token
      const rawActivationToken = randomBytes(32).toString('hex');
      const { hashToken } = await import('@/lib/auth/customer-session');
      const tokenHash = hashToken(rawActivationToken);
      const tokenExpiresAt = new Date(Date.now() + 3 * 60 * 1000); // 3 minutes strictly

      await prisma.passwordResetToken.create({
        data: {
          userId: existingUser.id,
          organizationId: existingOrg.id,
          tokenHash,
          expiresAt: tokenExpiresAt,
        },
      });

      const activationLink = `${BASE_URL}/auth/reset-password?token=${rawActivationToken}`;
      const paymentLink = await generatePilotPaymentLink(
        existingOrg.id,
        existingOrg.name,
        lead.email,
        existingOrg.currency || 'USD'
      );

      let emailSent = false;
      let emailError: string | null = null;
      if (process.env.RESEND_API_KEY) {
        try {
          const { Resend } = await import('resend');
          const resend = new Resend(process.env.RESEND_API_KEY);
          const fromEmail = process.env.RESEND_FROM_EMAIL || 'FlowLoop OS Onboarding <onboarding@flowloopos.com>';
          const emailRes = await resend.emails.send({
            from: fromEmail,
            to: lead.email,
            subject: `🎉 FlowLoop OS Founding Pilot Account & Activation (${lead.companyName})`,
            text: `Hi ${existingUser.firstName || 'there'},\n\nYour FlowLoop OS dedicated operating system has been provisioned for ${lead.companyName}!\n\n1️⃣ 3-MINUTE ACCOUNT ACTIVATION LINK:\n🔗 ${activationLink}\n⚠️ Note: This activation link expires in 3 minutes for security.\n\n2️⃣ 1-CLICK $199/MO FOUNDING PILOT PAYMENT LINK:\n💳 ${paymentLink}\n(Locks in your lifetime $199/mo rate with unlimited dispatch)\n\nBest regards,\nThe FlowLoop OS Founding Team\n${BASE_URL}`,
            html: generateReactivationEmailHtml({
              firstName: existingUser.firstName || 'there',
              companyName: lead.companyName,
              activationLink,
              paymentLink,
              baseUrl: BASE_URL,
            }),
          });
          if (!emailRes.error) emailSent = true;
          else emailError = emailRes.error.message;
        } catch (e: any) {
          emailError = e?.message;
        }
      }

      return NextResponse.json({
        success: true,
        alreadyProvisioned: true,
        message: `Fresh 3-minute activation link & payment link generated for ${lead.companyName}`,
        activationLink,
        paymentLink,
        tokenExpiresIn: '3 minutes',
        tokenExpiresAt: tokenExpiresAt.toISOString(),
        emailSent,
        emailError,
        organization: {
          id: existingOrg.id,
          name: existingOrg.name,
          slug: existingOrg.slug,
          currency: existingOrg.currency,
        },
        user: {
          id: existingUser.id,
          email: existingUser.email,
          firstName: existingUser.firstName,
          lastName: existingUser.lastName,
        },
        loginUrl: `${BASE_URL}/login`,
      });
    }

    // Split name into first and last
    const nameParts = lead.contactName.trim().split(/\s+/);
    const firstName = nameParts[0] || 'Owner';
    const lastName = nameParts.slice(1).join(' ') || 'Operator';

    // Generate secure temporary password
    const tempPassword = `FlowLoop-${randomBytes(4).toString('hex').toUpperCase()}!`;
    const passwordHash = await hashPassword(tempPassword);

    // Create unique slug
    const baseSlug = lead.companyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const entropy = randomBytes(2).toString('hex');
    const slug = `${baseSlug}-${entropy}`;

    // Determine state/province settings
    const stateCode = (lead.province || 'TX').toUpperCase().trim();
    const isUS = !['MB', 'ON', 'AB', 'BC', 'QC', 'SK', 'NS', 'NB', 'NL', 'PE'].includes(stateCode);
    const currency = isUS ? 'USD' : 'CAD';
    const country = isUS ? 'US' : 'CA';
    const timezone = US_TIMEZONES[stateCode] || (isUS ? 'America/Chicago' : 'America/Winnipeg');

    // Execute atomic provisioning transaction
    const provisionResult = await prisma.$transaction(async (tx) => {
      // 1. Create Organization
      const org = await tx.organization.create({
        data: {
          name: lead.companyName,
          slug,
          phone: lead.phone,
          email: lead.email,
          city: lead.city,
          province: stateCode,
          country,
          currency,
          timezone,
          taxRate: isUS ? 0.0825 : 0.05,
          onboardingStatus: 'ONBOARDING_COMPLETE',
          isActive: true,
        },
      });

      // 2. Create User (or attach if orphan)
      let user = existingUser;
      if (!user) {
        user = await tx.user.create({
          data: {
            email: cleanEmail,
            firstName,
            lastName,
            phone: lead.phone,
            passwordHash,
            emailVerified: true,
            isActive: true,
          },
          include: { memberships: { include: { organization: true } } },
        });
      }

      // 3. Create Super Admin Membership
      await tx.organizationMember.create({
        data: {
          userId: user.id,
          organizationId: org.id,
          role: ROLES.SUPER_ADMIN,
          isActive: true,
        },
      });

      // 4. Create primary technician profile for owner
      await tx.technician.create({
        data: {
          userId: user.id,
          organizationId: org.id,
          firstName,
          lastName,
          phone: lead.phone,
          isActive: true,
          availabilityStatus: 'AVAILABLE',
        },
      });

      // 5. Populate standard plumbing service catalog
      const standardServices = [
        {
          name: 'Emergency Drain Cleaning & Snake',
          slug: 'emergency-drain-cleaning',
          category: 'Drain & Sewer',
          estimatedDuration: 90,
          basePrice: 189.0,
          isEmergency: true,
        },
        {
          name: 'Water Heater Repair & Diagnostic',
          slug: 'water-heater-repair',
          category: 'Water Heaters',
          estimatedDuration: 60,
          basePrice: 149.0,
          isEmergency: false,
        },
        {
          name: 'Tankless / Tank Water Heater Replacement',
          slug: 'water-heater-replacement',
          category: 'Water Heaters',
          estimatedDuration: 240,
          basePrice: 1850.0,
          isEmergency: false,
        },
        {
          name: 'Leak Detection & Pipe Repair',
          slug: 'leak-detection-repair',
          category: 'General Plumbing',
          estimatedDuration: 90,
          basePrice: 220.0,
          isEmergency: true,
        },
        {
          name: 'High-Pressure Hydro Jetting',
          slug: 'hydro-jetting',
          category: 'Drain & Sewer',
          estimatedDuration: 120,
          basePrice: 450.0,
          isEmergency: false,
        },
        {
          name: 'Fixture & Faucet Installation',
          slug: 'fixture-installation',
          category: 'Fixtures',
          estimatedDuration: 60,
          basePrice: 125.0,
          isEmergency: false,
        },
      ];

      for (let i = 0; i < standardServices.length; i++) {
        const s = standardServices[i];
        await tx.service.create({
          data: {
            organizationId: org.id,
            name: s.name,
            slug: `${s.slug}-${org.id.slice(0, 4)}`,
            category: s.category,
            estimatedDuration: s.estimatedDuration,
            basePrice: s.basePrice,
            isEmergency: s.isEmergency,
            isActive: true,
            sortOrder: i,
          },
        });
      }

      // 6. Set standard business hours (Mon-Fri 8am-5pm + Sat Emergency)
      for (let day = 1; day <= 5; day++) {
        await tx.businessHours.create({
          data: {
            organizationId: org.id,
            dayOfWeek: day,
            openTime: '08:00',
            closeTime: '17:00',
            isClosed: false,
          },
        });
      }
      await tx.businessHours.create({
        data: {
          organizationId: org.id,
          dayOfWeek: 6,
          openTime: '09:00',
          closeTime: '14:00',
          isClosed: false,
        },
      });
      await tx.businessHours.create({
        data: {
          organizationId: org.id,
          dayOfWeek: 0,
          openTime: '00:00',
          closeTime: '00:00',
          isClosed: true,
        },
      });

      // 7. Generate 3-Minute One-Time Secure Activation Token
      const rawActivationToken = randomBytes(32).toString('hex');
      const { hashToken } = await import('@/lib/auth/customer-session');
      const tokenHash = hashToken(rawActivationToken);
      const tokenExpiresAt = new Date(Date.now() + 3 * 60 * 1000); // 3 minutes strictly

      await tx.passwordResetToken.create({
        data: {
          userId: user.id,
          organizationId: org.id,
          tokenHash,
          expiresAt: tokenExpiresAt,
        },
      });

      return { org, user, rawActivationToken, tokenExpiresAt };
    });

    const activationLink = `${BASE_URL}/auth/reset-password?token=${provisionResult.rawActivationToken}`;
    const paymentLink = await generatePilotPaymentLink(
      provisionResult.org.id,
      provisionResult.org.name,
      cleanEmail,
      currency
    );

    // 8. Update pilot lead status to ONBOARDED
    await updatePilotLeadStatus(
      lead.id,
      'ONBOARDED',
      `Provisioned Org: ${provisionResult.org.name} (${provisionResult.org.id})`
    );

    // 9. Dispatch Welcome & Activation Email via Resend
    let emailSent = false;
    let emailError: string | null = null;

    if (process.env.RESEND_API_KEY) {
      try {
        const { Resend } = await import('resend');
        const resend = new Resend(process.env.RESEND_API_KEY);
        const fromEmail = process.env.RESEND_FROM_EMAIL || 'FlowLoop OS Onboarding <onboarding@flowloopos.com>';

        const emailRes = await resend.emails.send({
          from: fromEmail,
          to: lead.email,
          subject: `🎉 Welcome to FlowLoop OS Founding Pilot — Activate & Lock In $199/mo (${lead.companyName})`,
          text: `Hi ${firstName},\n\nWelcome to the FlowLoop OS Founding Pilot cohort ($199/mo) for ${lead.companyName}!\n\nYour commercial plumbing operating system has been provisioned.\n\n1️⃣ 3-MINUTE ONE-TIME ACTIVATION LINK:\n🔗 ${activationLink}\n⚠️ IMPORTANT: For your security, this activation link is valid for 3 minutes.\nClick the link above to set your permanent password and access your dashboard.\n\n2️⃣ 1-CLICK $199/MO FOUNDING PILOT PAYMENT LINK:\n💳 ${paymentLink}\n(Locks in your lifetime $199/mo rate with unlimited dispatch)\n\nWHAT IS READY IN YOUR WORKSPACE:\n✅ ${lead.companyName} Organization Profile\n✅ 6 Pre-Configured Plumbing Services (Water Heaters, Drains, Leaks, Jetting)\n✅ Dispatch & Technician Scheduling Calendar\n✅ Instant Invoicing & Stripe Payment Engine\n\nIf you need any assistance or a 10-minute setup walkthrough, reply directly to this email.\n\nBest regards,\nThe FlowLoop OS Team\n${BASE_URL}/pilot`,
          html: generateWelcomeEmailHtml({
            firstName,
            companyName: lead.companyName,
            activationLink,
            paymentLink,
            baseUrl: BASE_URL,
          }),
        });

        if (emailRes.error) {
          emailError = emailRes.error.message;
          console.warn('Resend email error:', emailRes.error);
        } else {
          emailSent = true;
        }
      } catch (mailErr: any) {
        emailError = mailErr?.message || 'Email delivery exception';
        console.warn('Welcome email error note:', mailErr);
      }
    } else {
      emailError = 'RESEND_API_KEY not configured in Vercel environment variables';
    }

    return NextResponse.json({
      success: true,
      message: `Successfully provisioned ${lead.companyName}`,
      emailSent,
      emailError,
      activationLink,
      paymentLink,
      tokenExpiresIn: '3 minutes',
      tokenExpiresAt: provisionResult.tokenExpiresAt.toISOString(),
      organization: {
        id: provisionResult.org.id,
        name: provisionResult.org.name,
        slug: provisionResult.org.slug,
        currency,
        timezone,
      },
      user: {
        id: provisionResult.user.id,
        email: cleanEmail,
        firstName,
        lastName,
        tempPassword,
      },
      loginUrl: `${BASE_URL}/login`,
    });
  } catch (error) {
    console.error('Failed to auto-provision company:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Internal error auto-provisioning organization',
        error: String(error),
      },
      { status: 500 }
    );
  }
}
