import { describe, it, expect } from 'vitest';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth/password';

describe('Browser Workflow: Customer Management & Multi-Property CRM', () => {
  it('creates customer with multiple properties and maintains tenant scoping', async () => {
    const org = await prisma.organization.create({
      data: { name: 'CRM Org', slug: `crm-org-${Date.now()}` },
    });

    const user = await prisma.user.create({
      data: {
        email: `homeowner.${Date.now()}@example.com`,
        passwordHash: await hashPassword('password123'),
        firstName: 'Jane',
        lastName: 'Doe',
      },
    });

    const customer = await prisma.customer.create({
      data: {
        userId: user.id,
        organizationId: org.id,
        firstName: 'Jane',
        lastName: 'Doe',
        phone: '204-555-0144',
      },
    });

    // Add Primary Property
    const prop1 = await prisma.property.create({
      data: {
        organizationId: org.id,
        customerId: customer.id,
        address: '123 River Road',
        city: 'Winnipeg',
        province: 'MB',
        postalCode: 'R2M 3Z9',
      },
    });

    // Add Secondary Property
    const prop2 = await prisma.property.create({
      data: {
        organizationId: org.id,
        customerId: customer.id,
        address: '456 Portage Ave',
        unit: 'Suite 200',
        city: 'Winnipeg',
        province: 'MB',
        postalCode: 'R3C 0B1',
      },
    });

    const customerWithProps = await prisma.customer.findUnique({
      where: { id: customer.id },
      include: { properties: true },
    });

    expect(customerWithProps?.properties.length).toBe(2);
    expect(customerWithProps?.organizationId).toBe(org.id);
  });
});
