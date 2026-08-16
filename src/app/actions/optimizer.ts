'use server';

import { revalidatePath } from 'next/cache';
import { ScheduleOptimizer } from '@/lib/intelligence/schedule-optimizer';
import { requireRoleInOrg } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/constants';

export async function acceptOptimizerProposal(proposalId: string) {
  try {
    const { organizationId } = await requireRoleInOrg(ADMIN_ROLES);
    await ScheduleOptimizer.acceptProposal(proposalId, organizationId);
    revalidatePath('/dashboard/optimize');
    revalidatePath('/dashboard/jobs');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
