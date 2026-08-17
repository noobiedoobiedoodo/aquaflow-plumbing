import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SchedulingService } from '@/lib/services/scheduling-service';
import { assignJob } from '@/app/actions/dispatch';
import { revalidatePath } from 'next/cache';
import { requireRoleInOrg } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/constants';
import { HardHat, UserCheck, Wrench, Clock, MapPin, AlertTriangle } from 'lucide-react';

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { organizationId } = await requireRoleInOrg(ADMIN_ROLES);
  const { id } = await params;

  const [job, activeTechs] = await Promise.all([
    prisma.job.findFirst({
      where: { id, organizationId },
      include: {
        appointment: { include: { property: true, service: true, customer: true } },
        technician: true,
        intelligenceRecommendations: {
          where: { status: 'SUGGESTED' },
          include: { technician: true },
          orderBy: { score: 'desc' },
        },
      },
    }),
    prisma.technician.findMany({
      where: { organizationId, isActive: true },
      orderBy: { firstName: 'asc' },
    }),
  ]);

  if (!job) return notFound();

  async function manualAssignAction(formData: FormData) {
    'use server';
    const techId = formData.get('technicianId') as string;
    if (!techId) return;

    await assignJob(id, techId);
    revalidatePath(`/dashboard/jobs/${id}`);
    revalidatePath('/dashboard/jobs');
    revalidatePath('/dashboard');
  }

  async function acceptRecommendationAction(formData: FormData) {
    'use server';
    const recommendationId = formData.get('recommendationId') as string;
    if (!recommendationId) return;

    const session = await requireRoleInOrg(ADMIN_ROLES);
    await SchedulingService.acceptRecommendation(session.organizationId, recommendationId, session.user.id);
    revalidatePath(`/dashboard/jobs/${id}`);
    revalidatePath('/dashboard/jobs');
    revalidatePath('/dashboard');
  }

  async function rejectRecommendationAction(formData: FormData) {
    'use server';
    const recommendationId = formData.get('recommendationId') as string;
    if (!recommendationId) return;

    const session = await requireRoleInOrg(ADMIN_ROLES);
    await SchedulingService.rejectRecommendation(session.organizationId, recommendationId, 'Dispatcher preference');
    revalidatePath(`/dashboard/jobs/${id}`);
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Wrench className="w-6 h-6 text-primary-blue" /> Job #{job.id.slice(-6)} Operations Detail
          </h1>
          <p className="text-sm text-muted-text mt-1">
            Review service scope, customer address, and dispatch technician assignments.
          </p>
        </div>
        <Badge className="text-sm px-3 py-1 bg-primary-blue/20 text-primary-blue border-primary-blue/30">
          {job.status.replace(/_/g, ' ')}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT: Job & Customer Details */}
        <div className="space-y-6">
          <div className="glass rounded-2xl border border-border/50 p-6 shadow-xl space-y-4">
            <h2 className="text-base font-bold text-white border-b border-border/40 pb-3">Service Scope</h2>
            <div>
              <div className="text-xs text-muted-text uppercase font-semibold">Service</div>
              <div className="text-lg font-bold text-white mt-0.5">
                {job.appointment.service?.name || 'Standard Plumbing Service'}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-text uppercase font-semibold">Problem Reported</div>
              <p className="text-sm text-slate-200 mt-1 bg-background/50 p-3 rounded-xl border border-border/40 whitespace-pre-wrap">
                {job.appointment.problemDescription || 'No description provided.'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div>
                <div className="text-xs text-muted-text uppercase font-semibold">Schedule Date</div>
                <div className="text-sm text-white font-medium mt-0.5">
                  {new Date(job.appointment.date).toLocaleDateString()}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-text uppercase font-semibold">Time Window</div>
                <div className="text-sm text-white font-medium mt-0.5">
                  {job.appointment.startTime} – {job.appointment.endTime}
                </div>
              </div>
            </div>
          </div>

          <div className="glass rounded-2xl border border-border/50 p-6 shadow-xl space-y-4">
            <h2 className="text-base font-bold text-white border-b border-border/40 pb-3">Customer & Location</h2>
            <div>
              <div className="text-xs text-muted-text uppercase font-semibold">Customer</div>
              <div className="text-sm font-semibold text-white mt-0.5">
                {job.appointment.customer.firstName} {job.appointment.customer.lastName}
              </div>
              <div className="text-xs text-muted-text mt-0.5">{job.appointment.customer.phone}</div>
            </div>
            <div>
              <div className="text-xs text-muted-text uppercase font-semibold">Service Property</div>
              <div className="text-sm text-slate-200 mt-0.5">
                {job.appointment.property.address}
                {job.appointment.property.unit ? `, Unit ${job.appointment.property.unit}` : ''}
              </div>
              <div className="text-xs text-muted-text">
                {job.appointment.property.city}, {job.appointment.property.province} {job.appointment.property.postalCode}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Dispatch Assignment & Recommendations */}
        <div className="space-y-6">
          {/* Current Technician & Direct Manual Assignment */}
          <div className="glass rounded-2xl border border-border/50 p-6 shadow-xl space-y-4">
            <h2 className="text-base font-bold text-white border-b border-border/40 pb-3 flex items-center gap-2">
              <HardHat className="w-5 h-5 text-primary-blue" /> Dispatch Technician Assignment
            </h2>

            {job.technician ? (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-bold text-emerald-400">Assigned Technician</div>
                  <Badge className="bg-emerald-500/20 text-emerald-300">Active Assignment</Badge>
                </div>
                <div className="text-base font-bold text-white">
                  {job.technician.firstName} {job.technician.lastName}
                </div>
                <div className="text-xs text-muted-text">Status: {job.technician.availabilityStatus}</div>
              </div>
            ) : (
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                This job is currently unassigned. Choose a technician below to dispatch.
              </div>
            )}

            {/* Direct Assignment Form */}
            <form action={manualAssignAction} className="pt-2 space-y-3">
              <label className="block text-xs font-semibold text-slate-300">
                {job.technician ? 'Reassign to Another Technician:' : 'Select Technician to Assign:'}
              </label>
              <div className="flex gap-2">
                <select
                  name="technicianId"
                  required
                  defaultValue={job.technicianId || ''}
                  className="flex-1 px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm text-white focus:ring-2 focus:ring-primary-blue"
                >
                  <option value="" disabled>-- Choose a Technician --</option>
                  {activeTechs.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.firstName} {t.lastName} ({t.availabilityStatus})
                    </option>
                  ))}
                </select>
                <Button type="submit" className="bg-primary-blue hover:bg-blue-600 text-white font-semibold">
                  {job.technician ? 'Reassign' : 'Assign'}
                </Button>
              </div>
            </form>
          </div>

          {/* AI Intelligence Recommendations */}
          {job.intelligenceRecommendations.length > 0 && !job.technicianId && (
            <div className="glass rounded-2xl border border-border/50 p-6 shadow-xl space-y-4">
              <h2 className="text-base font-bold text-white border-b border-border/40 pb-3 flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-water-cyan" /> AI Dispatch Recommendations
              </h2>

              <div className="space-y-4">
                {job.intelligenceRecommendations.map((rec) => (
                  <div key={rec.id} className="p-4 rounded-xl bg-background/50 border border-border/50 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-white">
                        {rec.technician.firstName} {rec.technician.lastName}
                      </div>
                      <Badge className="bg-primary-blue/20 text-primary-blue">
                        {(rec.score * 100).toFixed(0)}% Match
                      </Badge>
                    </div>

                    <div className="flex gap-2">
                      <form action={acceptRecommendationAction} className="flex-1">
                        <input type="hidden" name="recommendationId" value={rec.id} />
                        <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs">
                          Accept & Assign {rec.technician.firstName}
                        </Button>
                      </form>
                      <form action={rejectRecommendationAction}>
                        <input type="hidden" name="recommendationId" value={rec.id} />
                        <Button type="submit" variant="ghost" className="text-xs text-muted-text hover:text-white">
                          Dismiss
                        </Button>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
