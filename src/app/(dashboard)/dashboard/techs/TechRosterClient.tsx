'use client';

import { useState } from 'react';
import { HardHat, Plus, Phone, Mail, MapPin, X, Loader2, CheckCircle2, UserX, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createTechnicianManual, toggleTechnicianStatus } from '@/app/actions/technicians';
import { toast } from 'sonner';

export function TechRosterClient({ initialTechs }: { initialTechs: any[] }) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const res = await createTechnicianManual(formData);

    setIsSubmitting(false);
    if (res.success) {
      toast.success('Technician registered successfully');
      setIsAddModalOpen(false);
    } else {
      setError(res.error || 'Failed to add technician');
      toast.error(res.error || 'Failed to add technician');
    }
  };

  const handleToggleStatus = async (techId: string, currentStatus: boolean) => {
    const res = await toggleTechnicianStatus(techId, !currentStatus);
    if (res.success) {
      toast.success(`Technician marked as ${!currentStatus ? 'Active' : 'Inactive'}`);
    } else {
      toast.error(res.error || 'Failed to update status');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <HardHat className="w-6 h-6 text-primary-blue" /> Field Technicians Roster
          </h1>
          <p className="text-sm text-muted-text mt-1">
            Manage your service technicians, dispatch availability, and field team access.
          </p>
        </div>
        <Button
          onClick={() => setIsAddModalOpen(true)}
          className="bg-primary-blue hover:bg-blue-600 text-white font-semibold flex items-center gap-2 shadow-lg"
        >
          <Plus className="w-4 h-4" /> Add Technician
        </Button>
      </div>

      {/* Technicians Table */}
      <div className="glass rounded-2xl border border-border/50 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-secondary-bg/60 border-b border-border/50 text-xs uppercase tracking-wider text-muted-text font-semibold">
              <tr>
                <th className="px-6 py-4">Technician</th>
                <th className="px-6 py-4">Contact</th>
                <th className="px-6 py-4">Dispatch Status</th>
                <th className="px-6 py-4">Active Jobs</th>
                <th className="px-6 py-4">Account</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {initialTechs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-text">
                    <HardHat className="w-8 h-8 mx-auto mb-2 opacity-40 text-muted-text" />
                    No technicians registered. Click "Add Technician" to invite your first employee.
                  </td>
                </tr>
              ) : (
                initialTechs.map((t) => (
                  <tr key={t.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-white">
                        {t.firstName} {t.lastName}
                      </div>
                      <div className="text-xs text-muted-text mt-0.5">ID: #{t.id.slice(-6)}</div>
                    </td>

                    <td className="px-6 py-4 text-xs space-y-1">
                      <div className="flex items-center gap-1.5 text-slate-300">
                        <Mail className="w-3.5 h-3.5 text-muted-text" /> {t.user?.email}
                      </div>
                      {t.phone && (
                        <div className="flex items-center gap-1.5 text-muted-text">
                          <Phone className="w-3.5 h-3.5 text-muted-text" /> {t.phone}
                        </div>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          t.availabilityStatus === 'AVAILABLE'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : t.availabilityStatus === 'BUSY'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                        }`}
                      >
                        {t.availabilityStatus}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-xs">
                      {t.jobs?.length === 0 ? (
                        <span className="text-muted-text">0 active jobs</span>
                      ) : (
                        <span className="font-semibold text-primary-blue">
                          {t.jobs?.length || 0} in progress
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-xs">
                      {t.isActive ? (
                        <span className="text-emerald-400 font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Active
                        </span>
                      ) : (
                        <span className="text-slate-400 font-medium flex items-center gap-1">
                          <UserX className="w-3.5 h-3.5" /> Deactivated
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleToggleStatus(t.id, t.isActive)}
                        className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition ${
                          t.isActive
                            ? 'border-rose-500/30 text-rose-400 hover:bg-rose-500/10'
                            : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'
                        }`}
                      >
                        {t.isActive ? 'Deactivate' : 'Reactivate'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Technician Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-secondary-bg border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <HardHat className="w-5 h-5 text-primary-blue" /> Add Field Technician
                </h2>
                <p className="text-xs text-muted-text mt-1">Create a technician login and dispatch profile.</p>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/5 text-muted-text hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs font-semibold">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">First Name *</label>
                  <input
                    type="text"
                    name="firstName"
                    required
                    placeholder="Mike"
                    className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm text-white focus:ring-2 focus:ring-primary-blue"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Last Name *</label>
                  <input
                    type="text"
                    name="lastName"
                    required
                    placeholder="Johnson"
                    className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm text-white focus:ring-2 focus:ring-primary-blue"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Email Address *</label>
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="mike.j@aquaflowplumbing.com"
                  className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm text-white focus:ring-2 focus:ring-primary-blue"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Phone Number</label>
                <input
                  type="tel"
                  name="phone"
                  placeholder="(204) 555-0188"
                  className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm text-white focus:ring-2 focus:ring-primary-blue"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Temporary Password *</label>
                <input
                  type="password"
                  name="password"
                  required
                  defaultValue="tech123"
                  className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm text-white focus:ring-2 focus:ring-primary-blue"
                />
                <p className="text-[11px] text-muted-text mt-1">Technician will use this password to log in at /login.</p>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-border/40">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsAddModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-primary-blue hover:bg-blue-600 text-white font-semibold flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                    </>
                  ) : (
                    'Save Technician'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
