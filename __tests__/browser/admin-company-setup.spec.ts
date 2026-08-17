import { describe, it, expect } from 'vitest';
import { prisma } from '@/lib/db';

describe('Browser Workflow: Admin Company Setup & Settings', () => {
  it('allows administrator to configure company branding, emergency phone, and tax rules', async () => {
    const slug = `setup-test-${Date.now()}`;
    const org = await prisma.organization.create({
      data: {
        name: 'Initial Name',
        slug,
        phone: '204-555-0100',
      },
    });

    // Update organization profile
    const updated = await prisma.organization.update({
      where: { id: org.id },
      data: {
        name: 'AquaFlow Verified Plumbing Ltd',
        emergencyPhone: '204-555-0911',
        address: '500 Main St, Winnipeg, MB',
      },
    });

    expect(updated.name).toBe('AquaFlow Verified Plumbing Ltd');
    expect(updated.emergencyPhone).toBe('204-555-0911');

    // Create custom Tax Rule
    const taxRule = await prisma.taxRule.create({
      data: {
        organizationId: org.id,
        name: 'Manitoba Provincial Tax',
        jurisdiction: 'MB',
        rate: 0.12,
        appliesTo: 'ALL',
      },
    });

    expect(taxRule.rate).toBe(0.12);
    expect(taxRule.organizationId).toBe(org.id);
  });
});
