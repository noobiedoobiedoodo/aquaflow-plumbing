import { prisma } from '@/lib/db';
import { requireRoleInOrg } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/constants';

export default async function CommunicationsDashboard() {
  const { user, organizationId } = await requireRoleInOrg(ADMIN_ROLES as any);

  // Aggregate stats
  const stats = await prisma.notification.groupBy({
    by: ['status'],
    where: { organizationId },
    _count: { status: true },
  });

  const pending = stats.find(s => s.status === 'PENDING' || s.status === 'PROCESSING')?._count.status || 0;
  const sent = stats.find(s => s.status === 'SENT' || s.status === 'DELIVERED')?._count.status || 0;
  const failed = stats.find(s => s.status === 'FAILED')?._count.status || 0;
  const bounced = stats.find(s => s.status === 'BOUNCED')?._count.status || 0;

  // Recent activity
  const recentNotifications = await prisma.notification.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900 tracking-tight">Communications</h1>
        <p className="text-sm text-neutral-500 mt-1">Monitor outbound customer notifications and delivery health.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-neutral-200 rounded-xl p-6 shadow-sm">
          <div className="text-sm font-medium text-neutral-500 mb-1">Pending</div>
          <div className="text-2xl font-bold text-neutral-900">{pending}</div>
        </div>
        <div className="bg-white border border-neutral-200 rounded-xl p-6 shadow-sm">
          <div className="text-sm font-medium text-neutral-500 mb-1">Sent / Delivered</div>
          <div className="text-2xl font-bold text-green-600">{sent}</div>
        </div>
        <div className="bg-white border border-neutral-200 rounded-xl p-6 shadow-sm">
          <div className="text-sm font-medium text-neutral-500 mb-1">Failed</div>
          <div className="text-2xl font-bold text-red-600">{failed}</div>
        </div>
        <div className="bg-white border border-neutral-200 rounded-xl p-6 shadow-sm">
          <div className="text-sm font-medium text-neutral-500 mb-1">Bounced</div>
          <div className="text-2xl font-bold text-orange-600">{bounced}</div>
        </div>
      </div>

      <div className="bg-white border border-neutral-200 shadow-sm rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-200 bg-neutral-50">
          <h2 className="font-semibold text-neutral-900">Recent Activity</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th className="px-6 py-4 font-medium text-neutral-500">Channel</th>
                <th className="px-6 py-4 font-medium text-neutral-500">Type</th>
                <th className="px-6 py-4 font-medium text-neutral-500">Subject / Content</th>
                <th className="px-6 py-4 font-medium text-neutral-500">Status</th>
                <th className="px-6 py-4 font-medium text-neutral-500 text-right">Attempts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {recentNotifications.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-neutral-500">
                    No communication records found.
                  </td>
                </tr>
              ) : (
                recentNotifications.map((notif) => (
                  <tr key={notif.id} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-neutral-900">
                      {notif.channel}
                    </td>
                    <td className="px-6 py-4 text-neutral-600">
                      {notif.type}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-neutral-900 truncate max-w-[300px]">
                        {notif.subject || notif.content}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                        ['SENT', 'DELIVERED'].includes(notif.status) ? 'bg-green-50 text-green-700 border-green-200' :
                        notif.status === 'FAILED' ? 'bg-red-50 text-red-700 border-red-200' :
                        notif.status === 'BOUNCED' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                        'bg-blue-50 text-blue-700 border-blue-200'
                      }`}>
                        {notif.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-neutral-500">
                      {notif.attempts}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
