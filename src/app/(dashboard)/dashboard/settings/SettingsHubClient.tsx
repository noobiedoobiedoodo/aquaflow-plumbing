'use client';

import { useState } from 'react';
import { Settings, Building, Wrench, CreditCard, Clock, Plus, Loader2, CheckCircle2, ShieldCheck, DollarSign, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createServiceManual, toggleServiceStatus, updateCompanyProfile } from '@/app/actions/settings';
import { toast } from 'sonner';

export function SettingsHubClient({
  org,
  services,
  taxRules,
  businessHours,
}: {
  org: any;
  services: any[];
  taxRules: any[];
  businessHours: any[];
}) {
  const [activeTab, setActiveTab] = useState<'PROFILE' | 'SERVICES' | 'HOURS' | 'PAYMENTS'>('PROFILE');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAddServiceOpen, setIsAddServiceOpen] = useState(false);

  const handleProfileSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const res = await updateCompanyProfile(formData);
    setIsSubmitting(false);

    if (res.success) {
      toast.success('Company profile updated successfully');
    } else {
      toast.error(res.error || 'Failed to update profile');
    }
  };

  const handleAddServiceSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const res = await createServiceManual(formData);
    setIsSubmitting(false);

    if (res.success) {
      toast.success('Plumbing service created');
      setIsAddServiceOpen(false);
    } else {
      toast.error(res.error || 'Failed to create service');
    }
  };

  const handleToggleService = async (serviceId: string, currentActive: boolean) => {
    const res = await toggleServiceStatus(serviceId, !currentActive);
    if (res.success) {
      toast.success(`Service ${!currentActive ? 'Activated' : 'Deactivated'}`);
    } else {
      toast.error(res.error || 'Failed to toggle service');
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
          <Settings className="w-6 h-6 text-primary-blue" /> Organization & Service Settings
        </h1>
        <p className="text-sm text-muted-text mt-1">
          Configure your company profile, service catalog, operating hours, and Stripe Connect settlement.
        </p>
      </div>

      {/* Tabs Navigation */}
      <div className="flex gap-2 border-b border-border/50 pb-2">
        {[
          { id: 'PROFILE', label: 'Company Profile', icon: Building },
          { id: 'SERVICES', label: `Services (${services.length})`, icon: Wrench },
          { id: 'HOURS', label: 'Business Hours', icon: Clock },
          { id: 'PAYMENTS', label: 'Stripe & Billing', icon: CreditCard },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition ${
                activeTab === tab.id
                  ? 'bg-primary-blue text-white shadow-md'
                  : 'text-muted-text hover:bg-secondary-bg hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab: Company Profile */}
      {activeTab === 'PROFILE' && (
        <div className="glass rounded-2xl border border-border/50 p-6 sm:p-8 shadow-xl">
          <form onSubmit={handleProfileSubmit} className="space-y-6 max-w-2xl">
            <div>
              <h2 className="text-base font-bold text-white mb-4">Business Information</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Company Name *</label>
                  <input
                    type="text"
                    name="name"
                    required
                    defaultValue={org.name}
                    className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm text-white focus:ring-2 focus:ring-primary-blue"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Company Phone</label>
                    <input
                      type="tel"
                      name="phone"
                      defaultValue={org.phone || ''}
                      placeholder="(204) 555-0199"
                      className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm text-white focus:ring-2 focus:ring-primary-blue"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">24/7 Emergency Line</label>
                    <input
                      type="tel"
                      name="emergencyPhone"
                      defaultValue={org.emergencyPhone || ''}
                      placeholder="(204) 555-0911"
                      className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm text-white focus:ring-2 focus:ring-primary-blue"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Headquarters Address</label>
                  <input
                    type="text"
                    name="address"
                    defaultValue={org.address || ''}
                    placeholder="100 Portage Ave, Winnipeg, MB"
                    className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm text-white focus:ring-2 focus:ring-primary-blue"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Public Booking Slug</label>
                  <div className="px-3.5 py-2.5 bg-secondary-bg border border-border rounded-xl text-sm text-muted-text flex items-center justify-between">
                    <span>/p/{org.slug}/book</span>
                    <span className="text-xs text-emerald-400 font-semibold">Active Portal</span>
                  </div>
                </div>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-primary-blue hover:bg-blue-600 text-white font-semibold flex items-center gap-2"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Profile Changes'}
            </Button>
          </form>
        </div>
      )}

      {/* Tab: Services Catalog */}
      {activeTab === 'SERVICES' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-base font-bold text-white">Plumbing Services Catalog</h2>
              <p className="text-xs text-muted-text">Services listed here appear on your self-serve customer booking portal.</p>
            </div>
            <Button
              onClick={() => setIsAddServiceOpen(true)}
              className="bg-primary-blue hover:bg-blue-600 text-white font-semibold flex items-center gap-2 text-xs"
            >
              <Plus className="w-4 h-4" /> Add Service
            </Button>
          </div>

          <div className="glass rounded-2xl border border-border/50 overflow-hidden shadow-xl">
            <table className="w-full text-left text-sm">
              <thead className="bg-secondary-bg/60 border-b border-border/50 text-xs uppercase tracking-wider text-muted-text font-semibold">
                <tr>
                  <th className="px-6 py-4">Service</th>
                  <th className="px-6 py-4">Est. Duration</th>
                  <th className="px-6 py-4">Base Price</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {services.map((svc) => (
                  <tr key={svc.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-white">{svc.name}</div>
                      <div className="text-xs text-muted-text line-clamp-1">{svc.description}</div>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-300 font-medium">
                      {svc.estimatedDurationMinutes} mins
                    </td>
                    <td className="px-6 py-4 font-semibold text-white">
                      ${svc.basePrice.toFixed(2)}
                    </td>
                    <td className="px-6 py-4">
                      {svc.isEmergency ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          Emergency 24/7
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-primary-blue border border-primary-blue/20">
                          Standard
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs">
                      {svc.isActive ? (
                        <span className="text-emerald-400 font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Active
                        </span>
                      ) : (
                        <span className="text-slate-400 font-medium">Inactive</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleToggleService(svc.id, svc.isActive)}
                        className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition ${
                          svc.isActive
                            ? 'border-rose-500/30 text-rose-400 hover:bg-rose-500/10'
                            : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'
                        }`}
                      >
                        {svc.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Business Hours */}
      {activeTab === 'HOURS' && (
        <div className="glass rounded-2xl border border-border/50 p-6 sm:p-8 shadow-xl max-w-2xl">
          <h2 className="text-base font-bold text-white mb-4">Operating Schedule</h2>
          <div className="space-y-3 divide-y divide-border/30">
            {businessHours.map((bh) => (
              <div key={bh.id} className="pt-3 first:pt-0 flex items-center justify-between text-sm">
                <span className="font-semibold text-white w-32">{bh.dayOfWeek}</span>
                {bh.isOpen ? (
                  <span className="text-slate-300">
                    {bh.openTime} – {bh.closeTime}
                  </span>
                ) : (
                  <span className="text-muted-text italic">Closed</span>
                )}
                <span className={`text-xs font-semibold px-2 py-0.5 rounded ${bh.isOpen ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-400'}`}>
                  {bh.isOpen ? 'Open' : 'Closed'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Stripe & Payments */}
      {activeTab === 'PAYMENTS' && (
        <div className="space-y-6 max-w-3xl">
          <div className="glass rounded-2xl border border-border/50 p-6 sm:p-8 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-blue/20 flex items-center justify-center text-primary-blue">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Stripe Connect Settlement</h2>
                <p className="text-xs text-muted-text">Route customer invoice payments directly into your company bank account.</p>
              </div>
            </div>

            <div className="p-4 bg-background/50 border border-border/60 rounded-xl flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-text">Connected Account ID</div>
                <div className="text-sm font-mono text-white mt-0.5">
                  {org.stripeAccountId ? org.stripeAccountId : 'No connected Stripe account yet'}
                </div>
              </div>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${org.stripeAccountId ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                {org.stripeAccountId ? 'Connected & Verified' : 'Pending Setup'}
              </span>
            </div>
          </div>

          <div className="glass rounded-2xl border border-border/50 p-6 sm:p-8 shadow-xl space-y-4">
            <h2 className="text-base font-bold text-white">Tax Rules ({taxRules.length})</h2>
            <div className="space-y-2">
              {taxRules.map((tr) => (
                <div key={tr.id} className="p-3 bg-background/40 border border-border/40 rounded-xl flex items-center justify-between text-sm">
                  <div>
                    <span className="font-semibold text-white">{tr.jurisdiction}</span> — <span className="text-muted-text">{tr.type}</span>
                  </div>
                  <span className="font-bold text-emerald-400">{(tr.rate * 100).toFixed(2)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Add Service Modal */}
      {isAddServiceOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-secondary-bg border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Add Plumbing Service</h2>
              <button onClick={() => setIsAddServiceOpen(false)} className="text-muted-text hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddServiceSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Service Name *</label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="e.g. Sump Pump Installation"
                  className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm text-white focus:ring-2 focus:ring-primary-blue"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Description *</label>
                <textarea
                  name="description"
                  required
                  rows={2}
                  placeholder="Professional replacement or installation of basement sump pump..."
                  className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm text-white focus:ring-2 focus:ring-primary-blue"
                ></textarea>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Base Price ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    name="basePrice"
                    required
                    defaultValue="250.00"
                    className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm text-white focus:ring-2 focus:ring-primary-blue"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Duration (mins) *</label>
                  <input
                    type="number"
                    name="estimatedDurationMinutes"
                    required
                    defaultValue="60"
                    className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm text-white focus:ring-2 focus:ring-primary-blue"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input type="checkbox" id="isEmergency" name="isEmergency" className="rounded border-border text-primary-blue" />
                <label htmlFor="isEmergency" className="text-xs font-medium text-slate-300">
                  Mark as 24/7 Emergency Service
                </label>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-border/40">
                <Button type="button" variant="ghost" onClick={() => setIsAddServiceOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting} className="bg-primary-blue text-white">
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Service'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
