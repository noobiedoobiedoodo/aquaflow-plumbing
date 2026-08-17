'use client';

import { useState } from 'react';
import { Settings, Building, Wrench, CreditCard, Clock, Plus, Loader2, CheckCircle2, ShieldCheck, DollarSign, X, Share2, Copy, ExternalLink, QrCode, Globe } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState<'PROFILE' | 'SERVICES' | 'HOURS' | 'ACQUISITION' | 'PAYMENTS'>('PROFILE');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAddServiceOpen, setIsAddServiceOpen] = useState(false);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://aquaflow-plumbing-theta.vercel.app';
  const bookingUrl = `${baseUrl}/p/${org.slug}/book`;
  const landingUrl = `${baseUrl}/p/${org.slug}`;
  const portalUrl = `${baseUrl}/p/${org.slug}/login`;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

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
          Configure your company profile, customer booking links, service catalog, operating hours, and payment settlement.
        </p>
      </div>

      {/* Tabs Navigation */}
      <div className="flex flex-wrap gap-2 border-b border-border/50 pb-2">
        {[
          { id: 'PROFILE', label: 'Company Profile', icon: Building },
          { id: 'ACQUISITION', label: 'Online Booking & Acquisition', icon: Share2 },
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
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Tenant Acquisition Identifier (Slug)</label>
                  <div className="px-3.5 py-2.5 bg-secondary-bg border border-border rounded-xl text-sm text-muted-text flex items-center justify-between font-mono">
                    <span>{org.slug}</span>
                    <span className="text-xs text-emerald-400 font-sans font-semibold">Active Tenant</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <Button type="submit" disabled={isSubmitting} className="bg-primary-blue text-white">
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Profile'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Tab: Online Booking & Customer Acquisition */}
      {activeTab === 'ACQUISITION' && (
        <div className="space-y-6 max-w-4xl">
          <div className="glass rounded-2xl border border-border/50 p-6 sm:p-8 shadow-xl space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Globe className="w-5 h-5 text-water-cyan" /> Direct Customer Acquisition Channels
              </h2>
              <p className="text-xs text-muted-text mt-1">
                Your company receives dedicated public URLs. Share these on Google Business Profile, Facebook, business cards, or your marketing website.
              </p>
            </div>

            {/* Direct Booking Link */}
            <div className="p-4 bg-background/60 border border-primary-blue/30 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-primary-blue">
                  1. Public Customer Booking Engine
                </span>
                <span className="text-[11px] bg-primary-blue/10 text-primary-blue px-2 py-0.5 rounded-full font-semibold">
                  Primary Funnel
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={bookingUrl}
                  className="flex-1 px-3 py-2 bg-secondary-bg border border-border rounded-lg text-xs font-mono text-white select-all"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={() => copyToClipboard(bookingUrl, 'Booking Link')}
                  className="bg-primary-blue text-white gap-1 text-xs shrink-0"
                >
                  <Copy className="w-3.5 h-3.5" /> Copy Link
                </Button>
                <a
                  href={`/p/${org.slug}/book`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 bg-secondary-bg hover:bg-white/10 text-white rounded-lg border border-border transition text-xs font-medium flex items-center gap-1 shrink-0"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Open
                </a>
              </div>
              <p className="text-[11px] text-muted-text">
                Customers choose their service, pick a date & time slot, enter problem details, and submit. Bookings route straight into your active dispatch board.
              </p>
            </div>

            {/* Public Landing Website */}
            <div className="p-4 bg-background/60 border border-border rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  2. Company Profile & Landing Page
                </span>
                <span className="text-[11px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-semibold">
                  Website
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={landingUrl}
                  className="flex-1 px-3 py-2 bg-secondary-bg border border-border rounded-lg text-xs font-mono text-white select-all"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => copyToClipboard(landingUrl, 'Website Link')}
                  className="gap-1 text-xs shrink-0 border-border text-white hover:bg-secondary-bg"
                >
                  <Copy className="w-3.5 h-3.5" /> Copy
                </Button>
                <a
                  href={`/p/${org.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 bg-secondary-bg hover:bg-white/10 text-white rounded-lg border border-border transition text-xs font-medium flex items-center gap-1 shrink-0"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Open
                </a>
              </div>
              <p className="text-[11px] text-muted-text">
                Displays your branding, verified reviews, service menu, 24/7 emergency phone, operating hours, and customer portal login.
              </p>
            </div>

            {/* Customer Self-Serve Portal Login */}
            <div className="p-4 bg-background/60 border border-border rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  3. Dedicated Homeowner Portal
                </span>
                <span className="text-[11px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full font-semibold">
                  Self-Serve
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={portalUrl}
                  className="flex-1 px-3 py-2 bg-secondary-bg border border-border rounded-lg text-xs font-mono text-white select-all"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => copyToClipboard(portalUrl, 'Customer Portal Link')}
                  className="gap-1 text-xs shrink-0 border-border text-white hover:bg-secondary-bg"
                >
                  <Copy className="w-3.5 h-3.5" /> Copy
                </Button>
                <a
                  href={`/p/${org.slug}/login`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 bg-secondary-bg hover:bg-white/10 text-white rounded-lg border border-border transition text-xs font-medium flex items-center gap-1 shrink-0"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Open
                </a>
              </div>
              <p className="text-[11px] text-muted-text">
                Your customers sign in here to review job progress, approve estimates, download invoices, pay online, and open support tickets.
              </p>
            </div>

            {/* Website Embed Snippet */}
            <div className="p-4 bg-background/40 border border-border/60 rounded-xl space-y-2">
              <div className="text-xs font-semibold text-slate-200">Embed on Your Existing Website</div>
              <pre className="p-3 bg-secondary-bg border border-border rounded-lg text-[11px] font-mono text-cyan-300 overflow-x-auto">
{`<iframe src="${bookingUrl}" width="100%" height="800px" frameborder="0"></iframe>`}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Services Catalog */}
      {activeTab === 'SERVICES' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-text">
              Active services configured specifically for <span className="text-white font-semibold">{org.name}</span>.
            </p>
            <Button onClick={() => setIsAddServiceOpen(true)} className="bg-primary-blue text-white gap-1.5 text-xs">
              <Plus className="w-4 h-4" /> Add Service
            </Button>
          </div>

          <div className="glass rounded-2xl border border-border/50 overflow-hidden shadow-xl">
            <table className="w-full text-left text-sm text-muted-text">
              <thead className="bg-secondary-bg/80 border-b border-border/50 text-xs font-semibold text-slate-300 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">Service Name</th>
                  <th className="px-6 py-3.5">Duration</th>
                  <th className="px-6 py-3.5">Base Price</th>
                  <th className="px-6 py-3.5">Type</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Action</th>
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
                      {svc.estimatedDuration} mins
                    </td>
                    <td className="px-6 py-4 font-semibold text-white">
                      ${svc.basePrice ? svc.basePrice.toFixed(2) : '0.00'}
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
            {businessHours.map((bh) => {
              const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
              const dayName = typeof bh.dayOfWeek === 'number' ? dayNames[bh.dayOfWeek] : bh.dayOfWeek;
              return (
                <div key={bh.id} className="pt-3 first:pt-0 flex items-center justify-between text-sm">
                  <span className="font-semibold text-white w-32">{dayName}</span>
                  {!bh.isClosed ? (
                    <span className="text-slate-300">
                      {bh.openTime} – {bh.closeTime}
                    </span>
                  ) : (
                    <span className="text-muted-text italic">Closed</span>
                  )}
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded ${!bh.isClosed ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-400'}`}>
                    {!bh.isClosed ? 'Open' : 'Closed'}
                  </span>
                </div>
              );
            })}
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
                    <span className="font-semibold text-white">{tr.jurisdiction}</span> — <span className="text-muted-text">{tr.name || tr.appliesTo}</span>
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
                    name="estimatedDuration"
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
