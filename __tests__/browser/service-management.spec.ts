import { describe, it, expect } from 'vitest';
import { prisma } from '@/lib/db';

describe('Browser Workflow: Service Management & Pricing', () => {
  it('creates, modifies price, and toggles active status for plumbing services', async () => {
    const org = await prisma.organization.create({
      data: { name: 'Service Org', slug: `service-org-${Date.now()}` },
    });

    const service = await prisma.service.create({
      data: {
        organizationId: org.id,
        name: 'Hydro-Jetting Main Sewer',
        slug: `hydro-jetting-${Date.now()}`,
        description: 'High-pressure water jetting to clear heavy root intrusions.',
        basePrice: 450.0,
        estimatedDuration: 90,
        isEmergency: true,
        isActive: true,
      },
    });

    expect(service.basePrice).toBe(450.0);
    expect(service.isEmergency).toBe(true);

    // Update price and deactivate
    const updated = await prisma.service.update({
      where: { id: service.id },
      data: { basePrice: 495.0, isActive: false },
    });

    expect(updated.basePrice).toBe(495.0);
    expect(updated.isActive).toBe(false);
  });
});
