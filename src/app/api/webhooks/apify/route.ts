import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { ensureColdProspectsTable } from '@/lib/services/prospecting-service';
import { randomUUID } from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json().catch(() => ({}));
    console.log('📡 Apify Webhook Received Event:', payload.eventType || 'UNKNOWN');

    // Apify webhook resource provides the defaultDatasetId
    const defaultDatasetId =
      payload.resource?.defaultDatasetId ||
      payload.eventData?.defaultDatasetId ||
      payload.defaultDatasetId;

    if (!defaultDatasetId) {
      return NextResponse.json(
        { success: true, message: 'Webhook received (no dataset ID provided).' },
        { status: 200 }
      );
    }

    // Fetch scraped dataset items directly from Apify
    const token = process.env.APIFY_API_TOKEN;
    const datasetUrl = `https://api.apify.com/v2/datasets/${defaultDatasetId}/items?token=${token}&limit=250`;
    const datasetRes = await fetch(datasetUrl);
    const items = await datasetRes.json();

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: true, message: 'Dataset was empty or completed with 0 items.' },
        { status: 200 }
      );
    }

    await ensureColdProspectsTable();
    let imported = 0;
    const now = new Date();

    for (const item of items) {
      const companyName = item.title || item.name || item.companyName;
      if (!companyName) continue;

      const phone = item.phone || item.phoneNumber || '(555) 000-0000';
      const website = item.website || item.url || '';
      
      let domain = 'plumbingpartner.com';
      try {
        if (website) {
          const parsed = new URL(website);
          domain = parsed.hostname.replace(/^www\./, '');
        }
      } catch {}

      const email = item.email || (item.emails && item.emails[0]) || `owner@${domain}`;
      const city = item.city || item.addressCity || 'Houston';
      const state = item.state || item.addressState || 'TX';
      const contactName = item.owner || item.contactName || 'Managing Operator';
      const title = item.titleRole || 'Owner / Operator';
      
      const reviews = item.reviewsCount || item.reviews || 20;
      const technicianCount =
        reviews > 150 ? '11–25 Technicians' : reviews > 40 ? '4–10 Technicians' : '2–3 Technicians';

      const painPoints = [
        'Technician dispatch phone tag',
        'Unpaid / delayed invoices',
        'ServiceTitan is $1,200/mo and too bloated'
      ];

      try {
        const id = randomUUID();
        await prisma.$executeRawUnsafe(
          `INSERT INTO cold_prospects (
            id, company_name, contact_name, title, email, phone, website, city, state, technician_count, pain_points, interest_level, outreach_status, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          ON CONFLICT (email) DO UPDATE SET
            company_name = EXCLUDED.company_name,
            phone = EXCLUDED.phone,
            website = EXCLUDED.website,
            updated_at = EXCLUDED.updated_at`,
          id,
          companyName,
          contactName,
          title,
          email.toLowerCase().trim(),
          phone,
          website,
          city,
          state,
          technicianCount,
          JSON.stringify(painPoints),
          'UNDECIDED',
          'NOT_CONTACTED',
          now,
          now
        );
        imported++;

        // AUTOMATIC COLD EMAIL OUTREACH VIA RESEND
        if (process.env.RESEND_API_KEY) {
          try {
            const { sendProspectOutreachEmail } = await import('@/lib/services/outreach-service');
            await sendProspectOutreachEmail({
              id,
              companyName,
              contactName,
              title,
              email: email.toLowerCase().trim(),
              phone,
              website,
              city,
              state,
              technicianCount,
              painPoints,
              interestLevel: 'UNDECIDED',
              outreachStatus: 'NOT_CONTACTED',
              createdAt: now.toISOString(),
              updatedAt: now.toISOString(),
            });
          } catch (mErr) {
            console.warn(`Apify lead auto-outreach dispatch note for ${email}:`, mErr);
          }
        }
      } catch (e) {
        console.warn('Apify item insert error:', e);
      }
    }

    console.log(`✅ Apify Webhook processed & imported ${imported} plumbing contractors into PostgreSQL!`);
    return NextResponse.json({
      success: true,
      message: `Successfully processed Apify dataset and imported ${imported} contractors.`,
      imported,
    });
  } catch (error) {
    console.error('Failed to process Apify webhook:', error);
    return NextResponse.json(
      { success: false, message: 'Internal error processing Apify webhook.' },
      { status: 500 }
    );
  }
}
