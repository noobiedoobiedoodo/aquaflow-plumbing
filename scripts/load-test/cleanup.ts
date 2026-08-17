import { prisma } from '../../src/lib/db';
import { LoadTestConfig } from './config';

export async function cleanupSyntheticData(
  config: LoadTestConfig,
  allPrefixes: boolean = true
): Promise<{ success: boolean; remainingCount: number }> {
  const targetPrefix = allPrefixes ? 'loadtest' : config.prefix.toLowerCase().replace(/_/g, '-');
  console.log(`[Cleanup] Starting dependency-aware cleanup for synthetic run prefix: ${targetPrefix}`);

  const orgs = await prisma.organization.findMany({
    where: {
      OR: [
        { slug: { contains: 'loadtest' } },
        { slug: { contains: config.prefix.toLowerCase().replace(/_/g, '-') } },
      ],
    },
    select: { id: true },
  });

  const orgIds = orgs.map((o) => o.id);

  if (orgIds.length > 0) {
    // 1. Delete Financial Records
    await prisma.payment.deleteMany({
      where: { invoice: { organizationId: { in: orgIds } } },
    });
    await prisma.invoiceTax.deleteMany({
      where: { invoice: { organizationId: { in: orgIds } } },
    });
    await prisma.invoiceLine.deleteMany({
      where: { invoice: { organizationId: { in: orgIds } } },
    });
    await prisma.financialActivity.deleteMany({
      where: { invoice: { organizationId: { in: orgIds } } },
    });
    await prisma.invoice.deleteMany({
      where: { organizationId: { in: orgIds } },
    });
    await prisma.estimateApproval.deleteMany({
      where: { estimate: { organizationId: { in: orgIds } } },
    });
    await prisma.estimateLine.deleteMany({
      where: { estimate: { organizationId: { in: orgIds } } },
    });
    await prisma.estimate.deleteMany({
      where: { organizationId: { in: orgIds } },
    });

    // 2. Delete Job and Appointment Records
    await prisma.customerSignature.deleteMany({ where: { job: { organizationId: { in: orgIds } } } });
    await prisma.jobPhoto.deleteMany({ where: { job: { organizationId: { in: orgIds } } } });
    await prisma.jobPart.deleteMany({ where: { job: { organizationId: { in: orgIds } } } });
    await prisma.jobTimeEntry.deleteMany({ where: { job: { organizationId: { in: orgIds } } } });
    await prisma.jobActivity.deleteMany({ where: { job: { organizationId: { in: orgIds } } } });
    await prisma.jobNote.deleteMany({ where: { job: { organizationId: { in: orgIds } } } });
    await prisma.jobAssignment.deleteMany({ where: { job: { organizationId: { in: orgIds } } } });
    await prisma.task.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.supportTicket.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.intelligenceRecommendation.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.job.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.appointment.deleteMany({ where: { organizationId: { in: orgIds } } });

    // 3. Delete Properties and Customer Sessions
    await prisma.property.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.customerCommunicationPreference.deleteMany({
      where: { customer: { organizationId: { in: orgIds } } },
    });
    await prisma.customerActivity.deleteMany({ where: { customer: { organizationId: { in: orgIds } } } });
    await prisma.customerSession.deleteMany({ where: { customer: { organizationId: { in: orgIds } } } });
    await prisma.magicLinkToken.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.passwordResetToken.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.customer.deleteMany({ where: { organizationId: { in: orgIds } } });

    // 4. Delete Technicians and Memberships
    await prisma.technician.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.organizationMember.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.businessHours.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.holiday.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.taxRule.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.serviceArea.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.service.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.notification.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.event.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.auditLog.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.stripeWebhookEvent.deleteMany({
      where: {
        OR: [
          { stripeEventId: { contains: 'loadtest' } },
          { stripeEventId: { contains: 'race' } },
        ],
      },
    });

    // 5. Delete Organizations
    await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
  }

  // 6. Delete Synthetic Users and any residual customer entities
  const testUsers = await prisma.user.findMany({
    where: {
      OR: [
        { email: { contains: 'loadtest' } },
        { email: { contains: 'aquaflow-loadtest.test' } },
        { email: { contains: config.prefix.toLowerCase() } },
      ],
    },
    select: { id: true },
  });

  const testUserIds = testUsers.map((u) => u.id);

  if (testUserIds.length > 0) {
    await prisma.appointment.deleteMany({
      where: { customer: { userId: { in: testUserIds } } },
    });
    await prisma.property.deleteMany({
      where: { customer: { userId: { in: testUserIds } } },
    });
    await prisma.customerSession.deleteMany({
      where: { customer: { userId: { in: testUserIds } } },
    });
    await prisma.customerActivity.deleteMany({
      where: { customer: { userId: { in: testUserIds } } },
    });
    await prisma.customer.deleteMany({
      where: { userId: { in: testUserIds } },
    });
    await prisma.session.deleteMany({
      where: { userId: { in: testUserIds } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: testUserIds } },
    });
  }

  // 7. Post-Cleanup Verification: Verify remaining synthetic records === 0
  const remainingOrgs = await prisma.organization.count({
    where: { slug: { contains: config.prefix.toLowerCase().replace(/_/g, '-') } },
  });

  const remainingUsers = await prisma.user.count({
    where: {
      OR: [
        { email: { contains: config.prefix.toLowerCase() } },
        { email: { contains: 'aquaflow-loadtest.test' } },
      ],
    },
  });

  const remainingCount = remainingOrgs + remainingUsers;
  const success = remainingCount === 0;

  console.log(`[Cleanup Complete] Status: ${success ? 'PASSED (0 residue)' : 'FAILED (residue detected)'}`);
  return { success, remainingCount };
}
