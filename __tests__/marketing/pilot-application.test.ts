import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { POST } from '@/app/api/pilot/apply/route';
import { createPilotLead, getPilotLeads } from '@/lib/services/pilot-lead-service';
import { NextRequest } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

describe('Pilot Offer Lead Capture & Hardened Durability Suite', () => {
  const testStoragePath = path.join(process.cwd(), 'storage', 'pilot-leads.json');
  let originalData: string | null = null;

  beforeEach(async () => {
    try {
      originalData = await fs.readFile(testStoragePath, 'utf-8');
    } catch {
      originalData = null;
    }
  });

  afterEach(async () => {
    if (originalData !== null) {
      await fs.writeFile(testStoragePath, originalData, 'utf-8');
    }
  });

  it('Lead Submission: Valid application persists lead and returns success with leadId', async () => {
    const payload = {
      companyName: 'Timberline Plumbing Services',
      contactName: 'Mark Timberline',
      email: `mark.timberline.${Date.now()}@example.com`,
      phone: '403-555-0199',
      city: 'Calgary',
      province: 'AB',
      technicianCount: '4–10 Technicians',
      painPoints: ['Scheduling conflicts & calendar mess', 'Paper invoices & lost job sheets'],
      notes: 'Interested in moving off legacy tool',
      utmSource: 'facebook',
      utmMedium: 'paid_social',
      utmCampaign: 'pilot_founding_199',
      utmContent: 'video_ad_1',
      referrer: 'https://m.facebook.com/',
    };

    const req = new NextRequest('http://localhost:3000/api/pilot/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.leadId).toBeDefined();

    // Verify lead persistence via durable service
    const storedLeads = await getPilotLeads();
    const saved = storedLeads.find((l: any) => l.id === data.leadId);

    expect(saved).toBeDefined();
    expect(saved?.companyName).toBe('Timberline Plumbing Services');
    expect(saved?.contactName).toBe('Mark Timberline');
    expect(saved?.technicianCount).toBe('4–10 Technicians');
    expect(saved?.status).toBe('NEW');
    expect(saved?.utmSource).toBe('facebook');
    expect(saved?.utmMedium).toBe('paid_social');
    expect(saved?.utmCampaign).toBe('pilot_founding_199');
    expect(saved?.utmContent).toBe('video_ad_1');
    expect(saved?.referrer).toBe('https://m.facebook.com/');
  });

  it('Validation: Rejects incomplete applications with 400 Bad Request', async () => {
    const invalidPayload = {
      companyName: '', // empty
      contactName: 'Test',
      email: 'not-an-email',
      phone: '',
      city: '',
      province: '',
      technicianCount: '',
      painPoints: [],
    };

    const req = new NextRequest('http://localhost:3000/api/pilot/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidPayload),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.errors).toBeDefined();
    expect(data.errors.companyName).toBeDefined();
    expect(data.errors.email).toBeDefined();
    expect(data.errors.painPoints).toBeDefined();
  });

  it('Duplicate Handling: Repeated submission from same email returns friendly confirmation without corruption', async () => {
    const uniqueEmail = `pilot.duplicate.${Date.now()}@example.com`;
    const payload = {
      companyName: 'Twin River Plumbing',
      contactName: 'Jake River',
      email: uniqueEmail,
      phone: '204-555-0144',
      city: 'Winnipeg',
      province: 'MB',
      technicianCount: '2–3 Technicians',
      painPoints: ['Missed calls & lost customer jobs'],
    };

    // First submission
    const req1 = new NextRequest('http://localhost:3000/api/pilot/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const res1 = await POST(req1);
    const data1 = await res1.json();
    expect(res1.status).toBe(200);
    expect(data1.success).toBe(true);

    // Immediate second submission
    const req2 = new NextRequest('http://localhost:3000/api/pilot/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const res2 = await POST(req2);
    const data2 = await res2.json();
    expect(res2.status).toBe(200);
    expect(data2.success).toBe(true);
    expect(data2.isDuplicate).toBe(true);
    expect(data2.leadId).toBe(data1.leadId);
  });

  it('Concurrency: Simultaneous applications from different companies succeed without race conditions or data loss', async () => {
    const ts = Date.now();
    const payloadA = {
      companyName: 'Alpha Flow Plumbing',
      contactName: 'Aaron Alpha',
      email: `alpha.${ts}@example.com`,
      phone: '604-555-0111',
      city: 'Vancouver',
      province: 'BC',
      technicianCount: '4–10 Technicians',
      painPoints: ['Scheduling conflicts & calendar mess'],
      utmSource: 'google',
      utmCampaign: 'pilot_search_bc',
    };

    const payloadB = {
      companyName: 'Beta Drain Masters',
      contactName: 'Brian Beta',
      email: `beta.${ts}@example.com`,
      phone: '780-555-0222',
      city: 'Edmonton',
      province: 'AB',
      technicianCount: '11–25 Technicians',
      painPoints: ['Getting paid on time / 30-day delays'],
      utmSource: 'linkedin',
      utmCampaign: 'pilot_b2b_ab',
    };

    // Run both submissions concurrently
    const [resA, resB] = await Promise.all([
      POST(
        new NextRequest('http://localhost:3000/api/pilot/apply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payloadA),
        })
      ),
      POST(
        new NextRequest('http://localhost:3000/api/pilot/apply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payloadB),
        })
      ),
    ]);

    const dataA = await resA.json();
    const dataB = await resB.json();

    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);
    expect(dataA.success).toBe(true);
    expect(dataB.success).toBe(true);
    expect(dataA.leadId).not.toBe(dataB.leadId);

    // Verify both exist in durable storage
    const allLeads = await getPilotLeads();
    const foundA = allLeads.find((l) => l.id === dataA.leadId);
    const foundB = allLeads.find((l) => l.id === dataB.leadId);

    expect(foundA).toBeDefined();
    expect(foundB).toBeDefined();
    expect(foundA?.companyName).toBe('Alpha Flow Plumbing');
    expect(foundB?.companyName).toBe('Beta Drain Masters');
  });
});
