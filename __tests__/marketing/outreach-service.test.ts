import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateColdEmailContent } from '@/lib/services/outreach-service';

describe('Automated Cold Outreach Service Suite', () => {
  it('generates high-converting personalized cold email content', () => {
    const email = generateColdEmailContent({
      to: 'travis@lonestarplumbing.com',
      recipientName: 'Travis Walker',
      companyName: 'Lone Star Flow Plumbing',
      city: 'Houston',
      state: 'TX',
      painPoints: ['Technician dispatch phone tag', 'Unpaid invoices'],
      technicianCount: '4–10 Technicians',
    });

    expect(email.subject).toContain('Lone Star Flow Plumbing');
    expect(email.subject).toContain('Houston');
    expect(email.text).toContain('Hi Travis,');
    expect(email.text).toContain('4–10 Technicians');
    expect(email.text).toContain('technician dispatch phone tag');
    expect(email.text).toContain('$199/month lifetime cohort');
    expect(email.text).toContain('https://aquaflow-plumbing-theta.vercel.app/pilot');
    expect(email.html).toContain('Lone Star Flow Plumbing');
    expect(email.html).toContain('Claim Founding Pilot Spot');
  });

  it('includes proper CASL & CAN-SPAM compliant opt-out mechanism in footer', () => {
    const email = generateColdEmailContent({
      to: 'owner@alamodrain.com',
      recipientName: 'Hector',
      companyName: 'Alamo Drain',
      city: 'San Antonio',
      state: 'TX',
      painPoints: ['Emergency scheduling chaos'],
      technicianCount: '2–3 Technicians',
    });

    expect(email.text).toContain('reply "Unsubscribe"');
    expect(email.html).toContain('opt out');
    expect(email.html).toContain('AquaFlow Systems Inc.');
  });
});
