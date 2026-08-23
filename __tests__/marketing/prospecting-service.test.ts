import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  US_PROSPECTS_DATABASE,
  updateColdProspectQualification,
} from '@/lib/services/prospecting-service';
import { prisma } from '@/lib/db';

describe('US Plumbing Prospector & Cold Lead Service Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('has valid US plumbing prospect data with 2-15 van criteria and pain points', () => {
    expect(US_PROSPECTS_DATABASE.length).toBeGreaterThanOrEqual(14);
    for (const p of US_PROSPECTS_DATABASE) {
      expect(p.companyName).toBeTruthy();
      expect(p.contactName).toBeTruthy();
      expect(p.email).toContain('@');
      expect(p.phone).toBeTruthy();
      expect(p.city).toBeTruthy();
      expect(p.state).toBeTruthy();
      expect(p.technicianCount).toBeTruthy();
      expect(p.painPoints.length).toBeGreaterThan(0);
    }
  });

  it('filters prospects by target US states correctly', () => {
    const txProspects = US_PROSPECTS_DATABASE.filter((p) => p.state === 'TX');
    const flProspects = US_PROSPECTS_DATABASE.filter((p) => p.state === 'FL');
    const caProspects = US_PROSPECTS_DATABASE.filter((p) => p.state === 'CA');

    expect(txProspects.length).toBeGreaterThan(0);
    expect(flProspects.length).toBeGreaterThan(0);
    expect(caProspects.length).toBeGreaterThan(0);
  });

  it('updates prospect qualification with Traffic Light (GREEN/YELLOW/RED) and outreach status', async () => {
    const mockId = 'prospect-test-123';
    const mockRows = [
      {
        id: mockId,
        company_name: 'Lone Star Flow Plumbing',
        contact_name: 'Travis Walker',
        title: 'Owner',
        email: 'travis@lonestarflow.com',
        phone: '(713) 555-0142',
        website: 'https://lonestarflow.com',
        city: 'Houston',
        state: 'TX',
        technician_count: '4–10 Technicians',
        pain_points: '["Dispatch phone tag"]',
        interest_level: 'GREEN',
        outreach_status: 'EMAIL_SENT',
        notes: 'Interested in $199/mo cohort',
        created_at: new Date(),
        updated_at: new Date(),
      },
    ];

    vi.spyOn(prisma, '$executeRawUnsafe').mockResolvedValue(1 as any);
    vi.spyOn(prisma, '$queryRawUnsafe').mockResolvedValue(mockRows as any);

    const result = await updateColdProspectQualification(mockId, {
      interestLevel: 'GREEN',
      outreachStatus: 'EMAIL_SENT',
      notes: 'Interested in $199/mo cohort',
    });

    expect(result).toBeDefined();
    expect(result?.interestLevel).toBe('GREEN');
    expect(result?.outreachStatus).toBe('EMAIL_SENT');
    expect(result?.companyName).toBe('Lone Star Flow Plumbing');
  });
});
