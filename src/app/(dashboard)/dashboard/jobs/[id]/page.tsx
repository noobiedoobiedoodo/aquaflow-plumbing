import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SchedulingService } from '@/lib/services/scheduling-service';
import { revalidatePath } from 'next/cache';

import { requireRoleInOrg } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/constants';

export default async function JobDetailPage({ params }: { params: { id: string } }) {
  const { user, organizationId } = await requireRoleInOrg(ADMIN_ROLES);
  const { id } = await params;

  const job = await prisma.job.findFirst({
    where: { id, organizationId },
    include: {
      appointment: { include: { property: true, service: true, customer: true } },
      technician: true,
      intelligenceRecommendations: {
        where: { status: 'SUGGESTED' },
        include: { technician: true },
        orderBy: { score: 'desc' }
      }
    }
  });

  if (!job) return notFound();

  async function assignTechAction(formData: FormData) {
    'use server';
    const recommendationId = formData.get('recommendationId') as string;
    if (!recommendationId) return;

    const session = await requireRoleInOrg(ADMIN_ROLES);
    await SchedulingService.acceptRecommendation(session.organizationId, recommendationId, session.user.id);
    
    revalidatePath(`/dashboard/jobs/${id}`);
  }

  async function rejectTechAction(formData: FormData) {
    'use server';
    const recommendationId = formData.get('recommendationId') as string;
    if (!recommendationId) return;

    const session = await requireRoleInOrg(ADMIN_ROLES);
    await SchedulingService.rejectRecommendation(session.organizationId, recommendationId, "Dispatcher preference");
    revalidatePath(`/dashboard/jobs/${id}`);
  }

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 flex flex-col md:flex-row gap-6">
      
      {/* LEFT COLUMN: Job Details */}
      <div className="flex-1 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Job: {job.appointment.service?.name || 'General Service'}</CardTitle>
            <CardDescription>Status: <Badge>{job.status}</Badge></CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-gray-500 font-semibold">Customer</p>
              <p>{job.appointment.customer.firstName} {job.appointment.customer.lastName}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 font-semibold">Location</p>
              <p>{job.appointment.property.address}, {job.appointment.property.city}, {job.appointment.property.province} {job.appointment.property.postalCode}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 font-semibold">Assigned Technician</p>
              <p>{job.technician ? `${job.technician.firstName} ${job.technician.lastName}` : 'Unassigned'}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* RIGHT COLUMN: Intelligence Recommendations */}
      <div className="flex-1 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Recommended Assignment</CardTitle>
            <CardDescription>AI-assisted heuristic assignment</CardDescription>
          </CardHeader>
          <CardContent>
            {job.technicianId ? (
              <div className="p-4 bg-green-50 text-green-700 rounded-md">
                Job is already assigned to {job.technician?.firstName}.
              </div>
            ) : job.intelligenceRecommendations.length === 0 ? (
              <div className="p-4 bg-gray-50 text-gray-500 rounded-md">
                No active recommendations available. (Wait for engine to process or check tech availability).
              </div>
            ) : (
              <div className="space-y-6">
                {job.intelligenceRecommendations.map((rec, index) => {
                  const factors = JSON.parse(rec.reasoningJson);
                  return (
                    <div key={rec.id} className="border rounded-md p-4">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="text-lg font-semibold">{rec.technician.firstName} {rec.technician.lastName}</h3>
                        <Badge variant={rec.score > 0.8 ? "default" : "outline"}>
                          {(rec.score * 100).toFixed(0)}% Match
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-4">
                        {rec.distanceKm ? `${rec.distanceKm.toFixed(1)} km` : 'Unknown dist'} · {rec.availabilityStatus} · {rec.skillMatch}
                      </p>

                      <table className="w-full text-sm mb-4">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left font-medium py-1">Factor</th>
                            <th className="text-right font-medium py-1">Score</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b">
                            <td className="py-1 text-gray-600">Distance</td>
                            <td className="text-right">{rec.distanceScore}/30</td>
                          </tr>
                          <tr className="border-b">
                            <td className="py-1 text-gray-600">Availability</td>
                            <td className="text-right">{rec.availabilityScore}/30</td>
                          </tr>
                          <tr className="border-b">
                            <td className="py-1 text-gray-600">Skills</td>
                            <td className="text-right">{rec.skillScore}/25</td>
                          </tr>
                          <tr>
                            <td className="py-1 text-gray-600">Workload</td>
                            <td className="text-right">{rec.workloadScore}/15</td>
                          </tr>
                        </tbody>
                      </table>

                      <div className="flex gap-2">
                        <form action={assignTechAction} className="flex-1">
                          <input type="hidden" name="recommendationId" value={rec.id} />
                          <Button type="submit" className="w-full">Assign {rec.technician.firstName}</Button>
                        </form>
                        <form action={rejectTechAction}>
                          <input type="hidden" name="recommendationId" value={rec.id} />
                          <Button variant="secondary" type="submit">Reject</Button>
                        </form>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
