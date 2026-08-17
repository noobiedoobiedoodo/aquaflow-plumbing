import { prisma } from '@/lib/db';
import { requireRoleInOrg } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/constants';
import { notFound } from 'next/navigation';
import { SettingsHubClient } from './SettingsHubClient';

export default async function SettingsPage() {
  const { organizationId } = await requireRoleInOrg(ADMIN_ROLES);

  const [org, services, taxRules, businessHours] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId },
    }),
    prisma.service.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
    }),
    prisma.taxRule.findMany({
      where: { organizationId },
      orderBy: { jurisdiction: 'asc' },
    }),
    prisma.businessHours.findMany({
      where: { organizationId },
      orderBy: { id: 'asc' },
    }),
  ]);

  if (!org) notFound();

  return (
    <SettingsHubClient
      org={org}
      services={services}
      taxRules={taxRules}
      businessHours={businessHours}
    />
  );
}
