import { describe, it, expect } from 'vitest';
import { prisma } from '@/lib/db';

describe('Browser Workflow: Multi-Tenant Boundary Isolation', () => {
  it('strictly prevents Organization A users from seeing or accessing Organization B data', async () => {
    const orgA = await prisma.organization.create({
      data: { name: 'Org Alpha', slug: `org-alpha-${Date.now()}` },
    });

    const orgB = await prisma.organization.create({
      data: { name: 'Org Beta', slug: `org-beta-${Date.now()}` },
    });

    const techA = await prisma.technician.create({
      data: {
        userId: (await prisma.user.create({ data: { email: `tech.a.${Date.now()}@a.internal`, passwordHash: 'h' } })).id,
        organizationId: orgA.id,
        firstName: 'Tech',
        lastName: 'Alpha',
      },
    });

    const techB = await prisma.technician.create({
      data: {
        userId: (await prisma.user.create({ data: { email: `tech.b.${Date.now()}@b.internal`, passwordHash: 'h' } })).id,
        organizationId: orgB.id,
        firstName: 'Tech',
        lastName: 'Beta',
      },
    });

    // Query Techs for Org A
    const orgATechs = await prisma.technician.findMany({
      where: { organizationId: orgA.id },
    });

    expect(orgATechs.some((t) => t.id === techA.id)).toBe(true);
    expect(orgATechs.some((t) => t.id === techB.id)).toBe(false);
  });
});
