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
    const lead = leads.find((l) => l.id === id);

    if (!lead) {
      return NextResponse.json(
        { success: false, message: `Pilot lead not found with ID: ${id}` },
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

      const activationLink = `https://aquaflow-plumbing-theta.vercel.app/auth/reset-password?token=${rawActivationToken}`;

      let emailSent = false;
      let emailError: string | null = null;
      if (process.env.RESEND_API_KEY) {
        try {
          const { Resend } = await import('resend');
          const resend = new Resend(process.env.RESEND_API_KEY);
          const fromEmail = process.env.RESEND_FROM_EMAIL || 'AquaFlow Onboarding <onboarding@resend.dev>';
          const emailRes = await resend.emails.send({
            from: fromEmail,
            to: lead.email,
            subject: `🎉 AquaFlow Account Activation Link (${lead.companyName})`,
            text: `Hi ${existingUser.firstName || 'there'},\n\nYour 3-minute one-time activation link is ready:\n🔗 ${activationLink}\n\n⚠️ Note: This activation link expires in 3 minutes for security.\n\nBest regards,\nThe AquaFlow Team`,
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
        message: `Fresh 3-minute activation link generated for ${lead.companyName}`,
        activationLink,
        tokenExpiresIn: '3 minutes',
        tokenExpiresAt: tokenExpiresAt.toISOString(),
        emailSent,
        emailError,
        organization: {
          id: existingOrg.id,
          name: existingOrg.name,
          slug: existingOrg.slug,
        },
        user: {
          id: existingUser.id,
          email: existingUser.email,
          firstName: existingUser.firstName,
          lastName: existingUser.lastName,
        },
        loginUrl: 'https://aquaflow-plumbing-theta.vercel.app/login',
      });
    }

    // Split name into first and last
    const nameParts = lead.contactName.trim().split(/\s+/);
    const firstName = nameParts[0] || 'Owner';
    const lastName = nameParts.slice(1).join(' ') || 'Operator';

    // Generate secure temporary password
    const tempPassword = `AquaFlow-${randomBytes(4).toString('hex').toUpperCase()}!`;
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

    const activationLink = `https://aquaflow-plumbing-theta.vercel.app/auth/reset-password?token=${provisionResult.rawActivationToken}`;

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
        const fromEmail = process.env.RESEND_FROM_EMAIL || 'AquaFlow Onboarding <onboarding@resend.dev>';

        const emailRes = await resend.emails.send({
          from: fromEmail,
          to: lead.email,
          subject: `🎉 Welcome to AquaFlow Founding Pilot — Activate Your Account (${lead.companyName})`,
          text: `Hi ${firstName},\n\nWelcome to the AquaFlow Founding Pilot cohort ($199/mo) for ${lead.companyName}!\n\nYour commercial plumbing operating system has been provisioned.\n\n🔒 3-MINUTE ONE-TIME ACTIVATION LINK:\n${activationLink}\n\n⚠️ IMPORTANT: For your security, this activation link is valid for 3 minutes.\nClick the link above to set your permanent password and access your dashboard.\n\nWHAT IS READY FOR YOU:\n✅ ${lead.companyName} Organization Profile\n✅ 6 Pre-Configured Plumbing Services (Water Heaters, Drains, Leaks, Jetting)\n✅ Dispatch & Technician Scheduling Calendar\n✅ Instant Invoicing & Stripe Payment Engine\n\nIf you need any assistance, feel free to reply directly to this email.\n\nBest regards,\nThe AquaFlow Team\nhttps://aquaflow-plumbing-theta.vercel.app/pilot`,
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
      loginUrl: 'https://aquaflow-plumbing-theta.vercel.app/login',
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
