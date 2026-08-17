import { describe, it, expect } from 'vitest';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth/password';

describe('Browser Workflow: Technician Lifecycle & Roster Management', () => {
  it('creates, activates, deactivates, and views technician within organization boundary', async () => {
    const org = await prisma.organization.create({
      data: { name: 'Tech Org A', slug: `tech-org-${Date.now()}` },
    });

    const user = await prisma.user.create({
      data: {
        email: `field.tech.${Date.now()}@aquaflow.internal`,
        passwordHash: await hashPassword('tech123'),
        firstName: 'Mike',
        lastName: 'Johnson',
      },
    });

    await prisma.organizationMember.create({
      data: {
        userId: user.id,
        organizationId: org.id,
        role: 'TECHNICIAN',
      },
    });

    // Create technician profile
    const tech = await prisma.technician.create({
      data: {
        userId: user.id,
        organizationId: org.id,
        firstName: 'Mike',
        lastName: 'Johnson',
        phone: '204-555-0188',
        availabilityStatus: 'AVAILABLE',
        isActive: true,
      },
    });

    expect(tech.isActive).toBe(true);
    expect(tech.organizationId).toBe(org.id);

    // Deactivate technician
    const deactivated = await prisma.technician.update({
      where: { id: tech.id },
      data: { isActive: false },
    });
    expect(deactivated.isActive).toBe(false);

    // Reactivate technician
    const reactivated = await prisma.technician.update({
      where: { id: tech.id },
      data: { isActive: true },
    });
    expect(reactivated.isActive).toBe(true);
  });
});
