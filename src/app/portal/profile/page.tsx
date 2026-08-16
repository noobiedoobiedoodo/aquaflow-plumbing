import { requireCustomerSession } from '@/lib/auth/customer-session';
import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { User, Phone, Mail, MapPin, Building, Shield, CheckCircle2 } from 'lucide-react';

export default async function CustomerProfilePage() {
  const session = await requireCustomerSession();
  const customerId = session.customerId;

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      user: {
        select: { email: true, firstName: true, lastName: true },
      },
      organization: {
        select: { name: true, phone: true, email: true },
      },
      properties: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!customer) {
    return null;
  }

  async function updateContactAction(formData: FormData) {
    'use server';
    const s = await requireCustomerSession();
    const phone = (formData.get('phone') as string)?.trim();
    const firstName = (formData.get('firstName') as string)?.trim();
    const lastName = (formData.get('lastName') as string)?.trim();

    if (!firstName || !lastName) throw new Error('First and last name are required');

    await prisma.customer.update({
      where: { id: s.customerId },
      data: { firstName, lastName, phone },
    });

    revalidatePath('/portal/profile');
  }

  async function addPropertyAction(formData: FormData) {
    'use server';
    const s = await requireCustomerSession();
    const address = (formData.get('address') as string)?.trim();
    const unit = (formData.get('unit') as string)?.trim() || null;
    const city = (formData.get('city') as string)?.trim();
    const province = (formData.get('province') as string)?.trim() || 'MB';
    const postalCode = (formData.get('postalCode') as string)?.trim();

    if (!address || !city || !postalCode) {
      throw new Error('Address, city, and postal code are required.');
    }

    await prisma.property.create({
      data: {
        organizationId: s.customer.organizationId,
        customerId: s.customerId,
        address,
        unit,
        city,
        province,
        postalCode,
      },
    });

    revalidatePath('/portal/profile');
    revalidatePath('/portal/book');
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Customer Profile</h1>
        <p className="text-neutral-500 text-sm mt-1">
          Manage your contact information and registered service addresses with {customer.organization.name}.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left: Contact Info Form */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-neutral-900">Personal Info</h3>
                <p className="text-xs text-neutral-500">{customer.user.email}</p>
              </div>
            </div>

            <form action={updateContactAction} className="space-y-4">
              <div>
                <label htmlFor="firstName" className="block text-xs font-semibold text-neutral-700 mb-1">First Name</label>
                <input
                  id="firstName"
                  type="text"
                  name="firstName"
                  defaultValue={customer.firstName}
                  required
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div>
                <label htmlFor="lastName" className="block text-xs font-semibold text-neutral-700 mb-1">Last Name</label>
                <input
                  id="lastName"
                  type="text"
                  name="lastName"
                  defaultValue={customer.lastName}
                  required
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div>
                <label htmlFor="phone" className="block text-xs font-semibold text-neutral-700 mb-1">Phone Number</label>
                <input
                  id="phone"
                  type="tel"
                  name="phone"
                  defaultValue={customer.phone || ''}
                  placeholder="(204) 555-0199"
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Primary Email</label>
                <input
                  type="email"
                  disabled
                  value={customer.user.email}
                  className="w-full px-3 py-2 bg-neutral-100 border border-neutral-200 rounded-lg text-sm text-neutral-500 cursor-not-allowed"
                />
                <p className="text-[11px] text-neutral-400 mt-1">Managed via global identity.</p>
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-neutral-900 hover:bg-neutral-800 text-white font-medium rounded-lg text-sm transition"
              >
                Save Changes
              </button>
            </form>
          </div>

          <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-5 text-xs text-blue-900 space-y-2">
            <div className="flex items-center gap-1.5 font-semibold text-blue-950">
              <Shield className="w-4 h-4 text-blue-600" /> Plumber Tenant Isolation
            </div>
            <p className="text-blue-800/90 leading-relaxed">
              Your profile is registered with <strong>{customer.organization.name}</strong>. If you use other services powered by AquaFlow, your records and job history remain completely separated.
            </p>
          </div>
        </div>

        {/* Right: Service Locations / Properties */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-neutral-900">Service Locations</h3>
                  <p className="text-xs text-neutral-500">Addresses where technicians can perform work</p>
                </div>
              </div>
            </div>

            {/* Existing Properties List */}
            <div className="space-y-3 mb-6">
              {customer.properties.length === 0 ? (
                <div className="p-4 text-center text-sm text-neutral-500 border border-dashed border-neutral-200 rounded-xl">
                  No service properties saved yet. Add one below.
                </div>
              ) : (
                customer.properties.map((prop, idx) => (
                  <div
                    key={prop.id}
                    className="p-4 border border-neutral-200 rounded-xl flex items-start justify-between bg-neutral-50/40 hover:bg-white transition"
                  >
                    <div className="flex items-start gap-3">
                      <Building className="w-4 h-4 text-neutral-400 mt-1 shrink-0" />
                      <div>
                        <div className="text-sm font-semibold text-neutral-900">
                          {prop.address} {prop.unit ? `(Unit ${prop.unit})` : ''}
                        </div>
                        <div className="text-xs text-neutral-500 mt-0.5">
                          {prop.city}, {prop.province} {prop.postalCode}
                        </div>
                      </div>
                    </div>
                    {idx === 0 && (
                      <span className="text-[10px] font-semibold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                        Primary
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Add New Property Form */}
            <div className="pt-4 border-t border-neutral-100">
              <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-700 mb-3">+ Add New Address</h4>
              <form action={addPropertyAction} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <input
                    type="text"
                    name="address"
                    required
                    placeholder="Street address (e.g. 742 Evergreen Terrace)"
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
                <div>
                  <input
                    type="text"
                    name="unit"
                    placeholder="Unit / Apt # (Optional)"
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
                <div>
                  <input
                    type="text"
                    name="city"
                    required
                    placeholder="City (e.g. Winnipeg)"
                    defaultValue="Winnipeg"
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
                <div>
                  <input
                    type="text"
                    name="province"
                    defaultValue="MB"
                    required
                    placeholder="Province (e.g. MB)"
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
                <div>
                  <input
                    type="text"
                    name="postalCode"
                    required
                    placeholder="Postal Code (e.g. R3C 1A5)"
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm transition shadow-sm"
                  >
                    Add Service Location
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
