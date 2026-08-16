import { requireAuth } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { notFound, redirect } from 'next/navigation';
import { JobWorkspace } from './JobWorkspace';
import { ROLES, ADMIN_ROLES } from '@/lib/constants';

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requireAuth();
  const { id } = await params;

  // Extract all organizations where the user has active membership
  const userOrgIds = user.memberships.map((m) => m.organizationId);
  if (userOrgIds.length === 0) {
    notFound();
  }

  // Tenant-scoped database query: job must belong to one of user's authorized organizations
  const job = await prisma.job.findFirst({
    where: {
      id,
      organizationId: { in: userOrgIds },
    },
    include: {
      appointment: {
        include: {
          property: true,
          customer: true,
          service: true,
        },
      },
      timeEntries: {
        where: { technicianId: user.id },
        orderBy: { startedAt: 'asc' },
      },
      parts: true,
      notes: {
        orderBy: { createdAt: 'desc' },
        include: { author: { select: { firstName: true, lastName: true } } },
      },
      photos: {
        orderBy: { createdAt: 'desc' },
      },
      signature: true,
    },
  });

  if (!job) {
    notFound();
  }

  // Check user's role specifically in THIS job's organization
  const membershipInOrg = user.memberships.find((m) => m.organizationId === job.organizationId);
  if (!membershipInOrg) {
    notFound();
  }

  const isAdminInOrg = ADMIN_ROLES.includes(membershipInOrg.role as any);
  const isTechnicianInOrg = membershipInOrg.role === ROLES.TECHNICIAN;

  if (isTechnicianInOrg && !isAdminInOrg) {
    const technician = await prisma.technician.findFirst({
      where: { userId: user.id, organizationId: job.organizationId },
    });

    if (!technician || job.technicianId !== technician.id) {
      redirect('/tech/dashboard');
    }
  }

  return <JobWorkspace job={job} user={user} />;
}

