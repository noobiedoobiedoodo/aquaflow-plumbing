import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { POST } from '@/app/api/pilot/apply/route';
import { NextRequest } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

describe('Pilot Offer Lead Capture & Application API Suite', () => {
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
      notes: 'Interested in moving off ServiceTitan',
      utmSource: 'google_ads',
      utmCampaign: 'plumber_pilot_199',
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

    // Verify lead was written to storage file
    const fileContent = await fs.readFile(testStoragePath, 'utf-8');
    const storedLeads = JSON.parse(fileContent);
    const saved = storedLeads.find((l: any) => l.leadId === data.leadId);

    expect(saved).toBeDefined();
    expect(saved.companyName).toBe('Timberline Plumbing Services');
    expect(saved.contactName).toBe('Mark Timberline');
    expect(saved.technicianCount).toBe('4–10 Technicians');
    expect(saved.status).toBe('NEW');
    expect(saved.source).toBe('google_ads');
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

  it('Duplicate Handling: Repeated submission from same email returns friendly confirmation', async () => {
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
});
