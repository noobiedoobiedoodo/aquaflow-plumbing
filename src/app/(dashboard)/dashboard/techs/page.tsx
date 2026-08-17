import { prisma } from '@/lib/db';
import { requireRoleInOrg } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/constants';
import { TechRosterClient } from './TechRosterClient';

export default async function TechsPage() {
  const { organizationId } = await requireRoleInOrg(ADMIN_ROLES);

  const techs = await prisma.technician.findMany({
    where: { organizationId },
    include: {
      user: { select: { email: true } },
      jobs: {
        where: { status: { in: ['ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'WORKING'] } },
        include: { appointment: { include: { service: true } } },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  return <TechRosterClient initialTechs={techs} />;
}
