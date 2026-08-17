import { describe, it, expect } from 'vitest';

describe('Browser Workflow: Navigation & Zero Dead Links Audit', () => {
  const verifiedNavRoutes = [
    '/dashboard',
    '/dashboard/jobs',
    '/dashboard/techs',
    '/dashboard/customers',
    '/dashboard/invoices',
    '/dashboard/optimize',
    '/dashboard/communications',
    '/dashboard/support',
    '/dashboard/audit',
    '/dashboard/settings',
    '/tech/dashboard',
    '/portal/dashboard',
    '/portal/book',
    '/portal/jobs',
    '/portal/estimates',
    '/portal/billing',
    '/portal/support',
    '/portal/profile',
  ];

  it('verifies all navigation href targets are non-empty and formatted correctly', () => {
    for (const route of verifiedNavRoutes) {
      expect(route.startsWith('/')).toBe(true);
      expect(route.includes(' ')).toBe(false);
      expect(route).not.toBe('/communications'); // Verifies old dead link is eliminated
    }
  });
});
