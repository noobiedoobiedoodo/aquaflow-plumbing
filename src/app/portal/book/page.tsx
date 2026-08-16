import { requireCustomerSession } from '@/lib/auth/customer-session';
import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { Wrench, MapPin, Calendar, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { generateAppointmentNumber } from '@/lib/utils';

export default async function PortalRequestServicePage() {
  const session = await requireCustomerSession();
  const organizationId = session.customer.organizationId;
  const customerId = session.customerId;

  const [services, properties, org] = await Promise.all([
    prisma.service.findMany({
      where: { organizationId, isActive: true },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.property.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true, phone: true },
    }),
  ]);

  async function submitServiceRequest(formData: FormData) {
    'use server';
    const s = await requireCustomerSession();
    const currentOrgId = s.customer.organizationId;
    const currentCustId = s.customerId;

    const serviceId = formData.get('serviceId') as string;
    const propertyId = formData.get('propertyId') as string;
    const newAddress = (formData.get('newAddress') as string)?.trim();
    const newCity = (formData.get('newCity') as string)?.trim();
    const newPostalCode = (formData.get('newPostalCode') as string)?.trim();
    const dateStr = formData.get('date') as string;
    const timeSlot = formData.get('timeSlot') as string;
    const urgency = (formData.get('urgency') as string) || 'NORMAL';
    const problemDescription = formData.get('problemDescription') as string;
    const customerNotes = formData.get('customerNotes') as string;

    if (!serviceId) throw new Error('Please select a service');
    if (!dateStr || !timeSlot) throw new Error('Please select a date and time');
    if (!problemDescription || problemDescription.trim().length < 5) {
      throw new Error('Please provide a brief description of your issue');
    }

    const [startTime, endTime] = timeSlot.split('-');

    let resolvedPropertyId = propertyId;

    await prisma.$transaction(async (tx) => {
      // 1. Resolve or Create Property
      if (!resolvedPropertyId || resolvedPropertyId === 'new') {
        if (!newAddress || !newCity || !newPostalCode) {
          throw new Error('Please provide a valid property address');
        }
        const createdProperty = await tx.property.create({
          data: {
            organizationId: currentOrgId,
            customerId: currentCustId,
            address: newAddress,
            city: newCity,
            postalCode: newPostalCode,
          },
        });
        resolvedPropertyId = createdProperty.id;
      } else {
        // STRICT IDOR VALIDATION: Property MUST belong to authenticated customer & organization
        const verifiedProperty = await tx.property.findFirst({
          where: {
            id: resolvedPropertyId,
            customerId: currentCustId,
            organizationId: currentOrgId,
          },
          select: { id: true },
        });

        if (!verifiedProperty) {
          throw new Error('Unauthorized property: Service address does not belong to your account');
        }
        resolvedPropertyId = verifiedProperty.id;
      }

      // 1.5 Validate Service belongs to organization
      const verifiedService = await tx.service.findFirst({
        where: {
          id: serviceId,
          organizationId: currentOrgId,
          isActive: true,
        },
        select: { id: true },
      });

      if (!verifiedService) {
        throw new Error('Unauthorized service: Selected service is invalid or inactive');
      }

      // 2. Create Appointment
      const appointmentNumber = generateAppointmentNumber();
      const isEmergency = urgency === 'EMERGENCY';

      const appointment = await tx.appointment.create({
        data: {
          appointmentNumber,
          organizationId: currentOrgId,
          customerId: currentCustId,
          propertyId: resolvedPropertyId,
          serviceId: verifiedService.id,
          date: new Date(dateStr),
          startTime: startTime.trim(),
          endTime: endTime ? endTime.trim() : '17:00',
          status: 'PENDING',
          priority: urgency,
          isEmergency,
          problemDescription,
          customerNotes,
        },
      });

      // 3. Create Job
      const job = await tx.job.create({
        data: {
          appointmentId: appointment.id,
          organizationId: currentOrgId,
          status: 'CREATED',
        },
      });

      // 4. Outbox Event
      await tx.event.create({
        data: {
          organizationId: currentOrgId,
          type: 'booking.created',
          entityType: 'Appointment',
          entityId: appointment.id,
          data: JSON.stringify({
            appointmentNumber,
            jobId: job.id,
            customerId: currentCustId,
            isEmergency,
          }),
        },
      });
    });

    revalidatePath('/portal/dashboard');
    revalidatePath('/portal/jobs');
    redirect('/portal/jobs');
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Request Service</h1>
        <p className="text-neutral-500 text-sm mt-1">
          Schedule maintenance or emergency repairs directly with {org?.name || 'your plumbing team'}.
        </p>
      </div>

      <div className="bg-white border border-neutral-200 rounded-2xl p-6 sm:p-8 shadow-sm">
        <form action={submitServiceRequest} className="space-y-6">
          {/* Service Selection */}
          <div>
            <label className="block text-sm font-semibold text-neutral-900 mb-2">Select Service</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {services.map((s) => (
                <label
                  key={s.id}
                  className="flex items-start gap-3 p-3.5 border border-neutral-200 rounded-xl hover:border-blue-500 cursor-pointer transition has-[:checked]:border-blue-600 has-[:checked]:bg-blue-50/50"
                >
                  <input type="radio" name="serviceId" value={s.id} required className="mt-1 text-blue-600 focus:ring-blue-500" />
                  <div>
                    <div className="text-sm font-semibold text-neutral-900">{s.name}</div>
                    <div className="text-xs text-neutral-500 mt-0.5">{s.shortDescription || 'Diagnostic & repair'}</div>
                    {s.basePrice && <div className="text-xs font-medium text-neutral-700 mt-1">From ${s.basePrice.toFixed(0)}</div>}
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Property Selection */}
          <div>
            <label className="block text-sm font-semibold text-neutral-900 mb-2">Service Location</label>
            {properties.length > 0 ? (
              <div className="space-y-3">
                <select
                  name="propertyId"
                  defaultValue={properties[0]?.id}
                  className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                >
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.address}, {p.city} ({p.postalCode})
                    </option>
                  ))}
                  <option value="new">+ Add a new address...</option>
                </select>
              </div>
            ) : (
              <div className="space-y-3 p-4 bg-neutral-50 border border-neutral-200 rounded-xl">
                <p className="text-xs font-medium text-neutral-600">Enter your service address:</p>
                <input
                  type="text"
                  name="newAddress"
                  placeholder="Street address"
                  className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg text-sm"
                  required
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    name="newCity"
                    placeholder="City"
                    defaultValue="Winnipeg"
                    className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg text-sm"
                    required
                  />
                  <input
                    type="text"
                    name="newPostalCode"
                    placeholder="Postal Code"
                    className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg text-sm"
                    required
                  />
                </div>
              </div>
            )}
          </div>

          {/* Date and Time Slot */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="date" className="block text-sm font-semibold text-neutral-900 mb-2">Preferred Date</label>
              <input
                id="date"
                type="date"
                name="date"
                min={new Date().toISOString().split('T')[0]}
                required
                className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
              />
            </div>
            <div>
              <label htmlFor="timeSlot" className="block text-sm font-semibold text-neutral-900 mb-2">Time Window</label>
              <select
                id="timeSlot"
                name="timeSlot"
                required
                className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
              >
                <option value="08:00-12:00">Morning (08:00 AM - 12:00 PM)</option>
                <option value="12:00-16:00">Afternoon (12:00 PM - 04:00 PM)</option>
                <option value="16:00-19:00">Late Afternoon (04:00 PM - 07:00 PM)</option>
              </select>
            </div>
          </div>

          {/* Urgency */}
          <div>
            <label className="block text-sm font-semibold text-neutral-900 mb-2">Urgency Level</label>
            <div className="grid grid-cols-3 gap-3">
              <label className="flex items-center justify-center p-3 border border-neutral-200 rounded-xl hover:border-neutral-400 cursor-pointer text-xs font-medium has-[:checked]:border-blue-600 has-[:checked]:bg-blue-50">
                <input type="radio" name="urgency" value="NORMAL" defaultChecked className="sr-only" />
                <span>Standard</span>
              </label>
              <label className="flex items-center justify-center p-3 border border-neutral-200 rounded-xl hover:border-neutral-400 cursor-pointer text-xs font-medium has-[:checked]:border-amber-500 has-[:checked]:bg-amber-50">
                <input type="radio" name="urgency" value="HIGH" className="sr-only" />
                <span>Priority</span>
              </label>
              <label className="flex items-center justify-center p-3 border border-neutral-200 rounded-xl hover:border-neutral-400 cursor-pointer text-xs font-medium has-[:checked]:border-rose-600 has-[:checked]:bg-rose-50 text-rose-700">
                <input type="radio" name="urgency" value="EMERGENCY" className="sr-only" />
                <span>Emergency (24/7)</span>
              </label>
            </div>
          </div>

          {/* Problem Description */}
          <div>
            <label htmlFor="problemDescription" className="block text-sm font-semibold text-neutral-900 mb-2">
              Describe the Issue
            </label>
            <textarea
              id="problemDescription"
              name="problemDescription"
              rows={3}
              required
              placeholder="Please describe what is leaking, clogged, or needs replacement..."
              className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
            ></textarea>
          </div>

          {/* Additional Notes */}
          <div>
            <label htmlFor="customerNotes" className="block text-sm font-semibold text-neutral-900 mb-2">
              Access Notes (Optional)
            </label>
            <input
              id="customerNotes"
              type="text"
              name="customerNotes"
              placeholder="Gate code, dog on premises, parking notes..."
              className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm shadow-md transition"
          >
            Submit Service Request
          </button>
        </form>
      </div>
    </div>
  );
}
