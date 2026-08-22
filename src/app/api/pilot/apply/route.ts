import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import fs from 'fs/promises';
import path from 'path';

const pilotLeadSchema = z.object({
  companyName: z.string().min(2, 'Company name is required'),
  contactName: z.string().min(2, 'Your name is required'),
  email: z.string().email('Valid email is required'),
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

interface LeadRecord {
  leadId: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  website?: string;
  city: string;
  province: string;
  technicianCount: string;
  painPoints: string[];
  notes?: string;
  source?: string;
  campaign?: string;
  utmData?: {
    source?: string;
    medium?: string;
    campaign?: string;
    content?: string;
    referrer?: string;
  };
  createdAt: string;
  status: 'NEW' | 'REVIEWING' | 'APPROVED' | 'WAITLIST' | 'CONTACTED' | 'ONBOARDED' | 'DECLINED';
}

const STORAGE_PATH = path.join(process.cwd(), 'storage', 'pilot-leads.json');

async function getLeads(): Promise<LeadRecord[]> {
  try {
    const data = await fs.readFile(STORAGE_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function saveLeads(leads: LeadRecord[]): Promise<void> {
  const dir = path.dirname(STORAGE_PATH);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(STORAGE_PATH, JSON.stringify(leads, null, 2), 'utf-8');
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = pilotLeadSchema.parse(body);

    const leads = await getLeads();

    // Check for recent duplicate submission from same email within 24h
    const existing = leads.find(
      (l) => l.email.toLowerCase() === validated.email.toLowerCase() &&
             new Date(l.createdAt).getTime() > Date.now() - 24 * 60 * 60 * 1000
    );

    if (existing) {
      return NextResponse.json({
        success: true,
        message: 'Your application has already been received! Our founding team will contact you shortly.',
        leadId: existing.leadId,
        isDuplicate: true,
      });
    }

    const newLead: LeadRecord = {
      leadId: randomUUID(),
      companyName: validated.companyName,
      contactName: validated.contactName,
      email: validated.email.toLowerCase(),
      phone: validated.phone,
      website: validated.website || undefined,
      city: validated.city,
      province: validated.province,
      technicianCount: validated.technicianCount,
      painPoints: validated.painPoints,
      notes: validated.notes,
      source: validated.utmSource || 'direct',
      campaign: validated.utmCampaign || 'pilot_199',
      utmData: {
        source: validated.utmSource,
        medium: validated.utmMedium,
        campaign: validated.utmCampaign,
        content: validated.utmContent,
        referrer: validated.referrer,
      },
      createdAt: new Date().toISOString(),
      status: 'NEW',
    };

    leads.push(newLead);
    await saveLeads(leads);

    console.log('====================================================');
    console.log('🚨 NEW AQUAFLOW $199 PILOT APPLICATION RECEIVED 🚨');
    console.log(`Lead ID:     ${newLead.leadId}`);
    console.log(`Company:     ${newLead.companyName}`);
    console.log(`Contact:     ${newLead.contactName}`);
    console.log(`Email:       ${newLead.email}`);
    console.log(`Phone:       ${newLead.phone}`);
    console.log(`Location:    ${newLead.city}, ${newLead.province}`);
    console.log(`Tech Count:  ${newLead.technicianCount}`);
    console.log(`Pain Points: ${newLead.painPoints.join(', ')}`);
    console.log('====================================================');

    // Optional: Send internal notification via Resend if RESEND_API_KEY is active
    if (process.env.RESEND_API_KEY) {
      try {
        const { Resend } = await import('resend');
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: 'AquaFlow Pilot <notifications@aquaflow.io>',
          to: process.env.FOUNDER_ALERT_EMAIL || 'founder@aquaflow.io',
          subject: `🚨 NEW PILOT APPLICATION: ${newLead.companyName} (${newLead.technicianCount})`,
          text: `New Founding Pilot Application:\n\nCompany: ${newLead.companyName}\nContact: ${newLead.contactName}\nEmail: ${newLead.email}\nPhone: ${newLead.phone}\nLocation: ${newLead.city}, ${newLead.province}\nTechnicians: ${newLead.technicianCount}\nPain Points: ${newLead.painPoints.join(', ')}\n\nLead ID: ${newLead.leadId}`,
        });
      } catch (emailErr) {
        console.warn('Could not dispatch external lead notification email (fallback to file log):', emailErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Application received successfully. You are in the review queue for the 3 founding pilot spots.',
      leadId: newLead.leadId,
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
