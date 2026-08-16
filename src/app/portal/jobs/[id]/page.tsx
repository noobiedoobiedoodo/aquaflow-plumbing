import { requireCustomerSession } from '@/lib/auth/customer-session';
import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import { FileImage, FileSignature, AlignLeft } from 'lucide-react';
import Image from 'next/image';

export default async function PortalJobDetail({ params }: { params: { id: string } }) {
  const { customerId } = await requireCustomerSession();
  const { id } = await params;

  // STRICT SCOPING: Must belong to customerId
  const job = await prisma.job.findFirst({
    where: { id, appointment: { customerId } },
    include: {
      appointment: { include: { property: true, service: true } },
      technician: { include: { user: true } },
      notes: {
        // ONLY fetch customer visible notes
        where: { type: 'CUSTOMER_VISIBLE' },
        orderBy: { createdAt: 'desc' }
      },
      photos: {
        // ONLY fetch customer visible photos
        where: { customerVisible: true },
        orderBy: { createdAt: 'desc' }
      },
      signature: true,
      parts: true
    }
  });

  if (!job) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Job Details</h1>
          <p className="text-neutral-500 mt-1">#{job.id}</p>
        </div>
        <span className={`inline-flex self-start items-center px-3 py-1 rounded-full text-sm font-medium border ${
          job.status === 'COMPLETED' ? 'bg-green-50 text-green-700 border-green-200' :
          job.status === 'IN_PROGRESS' ? 'bg-blue-50 text-blue-700 border-blue-200' :
          job.status === 'CANCELLED' ? 'bg-red-50 text-red-700 border-red-200' :
          'bg-neutral-50 text-neutral-700 border-neutral-200'
        }`}>
          {job.status.replace('_', ' ')}
        </span>
      </div>

      {job.status === 'EN_ROUTE' && job.technician && job.appointment?.property && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-6 flex flex-col md:flex-row items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-blue-900">Your technician is on the way</h2>
            <p className="text-blue-700 mt-1">
              {job.technician.firstName} {job.technician.lastName} is heading to your location.
            </p>
          </div>
          <div className="mt-4 md:mt-0 px-4 py-2 bg-white rounded-lg shadow-sm border border-blue-100 font-medium text-blue-800">
            {/* Server-Side calculated ETA */}
            {await (async () => {
              if (!job.technician?.currentLat || !job.technician?.currentLng || !job.appointment?.property?.latitude || !job.appointment?.property?.longitude) {
                return 'ETA unavailable';
              }
              const { routingProvider } = await import('@/lib/intelligence/routing-provider');
              const route = await routingProvider.getRoute(
                job.technician.currentLat, job.technician.currentLng,
                job.appointment.property.latitude, job.appointment.property.longitude
              );
              
              if (route.durationSeconds) {
                const arrival = new Date(Date.now() + route.durationSeconds * 1000);
                return `Estimated arrival: ${arrival.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
              } else if (route.distanceMeters) {
                return `Technician is approximately ${(route.distanceMeters / 1000).toFixed(1)} km away`;
              }
              return 'ETA unavailable';
            })()}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          
          {/* Photos */}
          {job.photos.length > 0 && (
            <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-neutral-200 flex items-center gap-2">
                <FileImage className="h-5 w-5 text-neutral-400" />
                <h2 className="font-semibold text-neutral-900">Job Photos</h2>
              </div>
              <div className="p-6 grid grid-cols-2 md:grid-cols-3 gap-4">
                {job.photos.map(photo => (
                  <div key={photo.id} className="relative group rounded-lg overflow-hidden border border-neutral-200 aspect-square">
                    <Image
                      src={`/api/files/${photo.storageKey}`}
                      alt={photo.caption || photo.type}
                      fill
                      className="object-cover"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-black/50 p-2 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                      {photo.caption || photo.type}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-200 flex items-center gap-2">
              <AlignLeft className="h-5 w-5 text-neutral-400" />
              <h2 className="font-semibold text-neutral-900">Service Notes</h2>
            </div>
            <div className="divide-y divide-neutral-100">
              {job.notes.length === 0 ? (
                <div className="p-6 text-neutral-500 text-sm">No notes provided for this job.</div>
              ) : (
                job.notes.map(note => (
                  <div key={note.id} className="p-6 text-neutral-700 text-sm whitespace-pre-wrap">
                    {note.content}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Signature */}
          {job.signature && (
            <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-neutral-200 flex items-center gap-2">
                <FileSignature className="h-5 w-5 text-neutral-400" />
                <h2 className="font-semibold text-neutral-900">Completion Signature</h2>
              </div>
              <div className="p-6 bg-neutral-50 flex justify-center">
                <Image
                  src={`/api/files/${job.signature.storageKey}`}
                  alt="Customer Signature"
                  width={300}
                  height={150}
                  className="max-w-full rounded border border-neutral-200 bg-white"
                />
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white border border-neutral-200 rounded-xl p-6">
            <h3 className="font-semibold text-neutral-900 mb-4">Job Info</h3>
            <div className="space-y-3 text-sm">
              <div>
                <div className="text-neutral-500">Service</div>
                <div className="font-medium text-neutral-900">{job.appointment.service?.name || 'General Service'}</div>
              </div>
              <div>
                <div className="text-neutral-500">Date</div>
                <div className="font-medium text-neutral-900">{new Date(job.createdAt).toLocaleDateString()}</div>
              </div>
              {job.completedAt && (
                <div>
                  <div className="text-neutral-500">Completed On</div>
                  <div className="font-medium text-neutral-900">{new Date(job.completedAt).toLocaleDateString()}</div>
                </div>
              )}
              {job.technician && (
                <div>
                  <div className="text-neutral-500">Technician</div>
                  <div className="font-medium text-neutral-900">{job.technician.user.firstName} {job.technician.user.lastName}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
