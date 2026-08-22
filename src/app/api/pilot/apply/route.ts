import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createPilotLead } from '@/lib/services/pilot-lead-service';

const pilotLeadSchema = z.object({
  companyName: z.string().min(2, 'Company name is required'),
  contactName: z.string().min(2, 'Your name is required'),
  email: z.string().email('Valid email address is required'),
  phone: z.string().min(7, 'Valid phone number is required'),
  website: z.string().optional().or(z.literal('')),
  city: z.string().min(2, 'City is required'),
  province: z.string().min(2, 'Province/State is required'),
  technicianCount: z.string().min(1, 'Please select technician count'),
  painPoints: z.array(z.string()).min(1, 'Please select at least one operational headache'),
  notes: z.string().optional(),
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
  utmContent: z.string().optional(),
  referrer: z.string().optional(),
});

// Simple IP-based rate limiter (max 5 submissions per 10 minutes per IP)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  if (process.env.NODE_ENV === 'test') {
    return true;
  }
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const current = rateLimitMap.get(ip);

  if (!current || now > current.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (current.count >= 10) {
    return false;
  }

  current.count += 1;
  return true;
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'anonymous';
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { success: false, message: 'Too many application attempts. Please try again in 10 minutes.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const validated = pilotLeadSchema.parse(body);

    // 1. Durably persist lead into PostgreSQL datastore (and sync backup)
    const { lead, isDuplicate } = await createPilotLead({
      companyName: validated.companyName,
      contactName: validated.contactName,
      email: validated.email,
      phone: validated.phone,
      website: validated.website,
      city: validated.city,
      province: validated.province,
      technicianCount: validated.technicianCount,
      painPoints: validated.painPoints,
      notes: validated.notes,
      source: validated.utmSource || 'direct',
      utmSource: validated.utmSource,
      utmMedium: validated.utmMedium,
      utmCampaign: validated.utmCampaign,
      utmContent: validated.utmContent,
      referrer: validated.referrer,
    });

    console.log('====================================================');
    console.log('🚨 NEW AQUAFLOW $199 PILOT APPLICATION PERSISTED 🚨');
    console.log(`Lead ID:     ${lead.id}`);
    console.log(`Company:     ${lead.companyName}`);
    console.log(`Contact:     ${lead.contactName}`);
    console.log(`Email:       ${lead.email}`);
    console.log(`Phone:       ${lead.phone}`);
    console.log(`Location:    ${lead.city}, ${lead.province}`);
    console.log(`Tech Count:  ${lead.technicianCount}`);
    console.log(`Pain Points: ${lead.painPoints.join(', ')}`);
    console.log(`Attribution: utm_source=${lead.utmSource || 'none'}, campaign=${lead.utmCampaign || 'none'}`);
    console.log(`Duplicate:   ${isDuplicate ? 'YES (Handled Gracefully)' : 'NO (Fresh Lead)'}`);
    console.log('====================================================');

    // 2. Dispatches internal founder notification (non-blocking / fail-safe)
    if (process.env.RESEND_API_KEY && !isDuplicate) {
      (async () => {
        try {
          const { Resend } = await import('resend');
          const resend = new Resend(process.env.RESEND_API_KEY);
          await resend.emails.send({
            from: 'AquaFlow Pilot <notifications@aquaflow.io>',
            to: process.env.FOUNDER_ALERT_EMAIL || 'founder@aquaflow.io',
            subject: `🚨 NEW PILOT APPLICATION: ${lead.companyName} (${lead.technicianCount})`,
            text: `New Founding Pilot Application:\n\nCompany: ${lead.companyName}\nContact: ${lead.contactName}\nEmail: ${lead.email}\nPhone: ${lead.phone}\nLocation: ${lead.city}, ${lead.province}\nTechnicians: ${lead.technicianCount}\nPain Points: ${lead.painPoints.join(', ')}\nSource: ${lead.utmSource || 'direct'}\nCampaign: ${lead.utmCampaign || 'direct'}\n\nLead ID: ${lead.id}`,
          });
        } catch (emailErr) {
          console.warn('Non-blocking lead notification email error:', emailErr);
        }
      })().catch(() => {});
    }

    return NextResponse.json({
      success: true,
      message: isDuplicate
        ? 'Your application has already been received! Our founding team will contact you shortly.'
        : 'Application received successfully. You are in the review queue for the 3 founding pilot spots.',
      leadId: lead.id,
      isDuplicate,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, errors: error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    console.error('Failed to process pilot application:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error processing application' },
      { status: 500 }
    );
  }
}
