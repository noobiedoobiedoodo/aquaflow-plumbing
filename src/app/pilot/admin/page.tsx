'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Users,
  Search,
  RefreshCw,
  Download,
  Filter,
  Phone,
  Mail,
  Building,
  MapPin,
  Calendar,
  Sparkles,
  CheckCircle2,
  Clock,
  ChevronRight,
  ExternalLink,
  ShieldCheck,
  Lock,
  ArrowLeft,
  X,
  KeyRound,
  LogOut,
  AlertTriangle,
  Rocket,
  Copy,
  Check
} from 'lucide-react';
import { PilotLeadRecord, PilotLeadStatus } from '@/lib/services/pilot-lead-service';

const STATUS_COLORS: Record<PilotLeadStatus, string> = {
  NEW: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
  CONTACTED: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  QUALIFIED: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  APPROVED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  WAITLIST: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  ONBOARDING: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
  ONBOARDED: 'bg-teal-500/10 text-teal-300 border-teal-500/30',
  DECLINED: 'bg-red-500/10 text-red-400 border-red-500/30',
};

const ALL_STATUSES: PilotLeadStatus[] = [
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'APPROVED',
  'WAITLIST',
  'ONBOARDING',
  'ONBOARDED',
  'DECLINED',
];

interface ProvisionResponse {
  success: boolean;
  message: string;
  organization?: {
    id: string;
    name: string;
    slug: string;
    currency?: string;
    timezone?: string;
  };
  user?: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    tempPassword?: string;
  };
  loginUrl?: string;
  alreadyProvisioned?: boolean;
}

export default function PilotAdminDashboard() {
  const [leads, setLeads] = useState<PilotLeadRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedLead, setSelectedLead] = useState<PilotLeadRecord | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [provisioningId, setProvisioningId] = useState<string | null>(null);
  const [provisionResult, setProvisionResult] = useState<ProvisionResponse | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [adminKey, setAdminKey] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authMethod, setAuthMethod] = useState<'session' | 'key' | null>(null);

  // Check stored credentials or existing session on mount
  useEffect(() => {
    const storedKey = sessionStorage.getItem('aquaflow_pilot_key');
    if (storedKey) {
      setAdminKey(storedKey);
      fetchLeadsWithKey(storedKey);
    } else {
      // Try fetching using existing SaaS session cookie
      fetchLeadsWithSession();
    }
  }, []);

  const fetchLeadsWithSession = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/pilot/leads');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.leads)) {
          setLeads(data.leads);
          setIsAuthorized(true);
          setAuthMethod('session');
          setAuthError('');
          return;
        }
      }
      // If session not found/unauthorized, stay in lock state
      setIsAuthorized(false);
    } catch {
      setIsAuthorized(false);
    } finally {
      setLoading(false);
    }
  };

  const fetchLeadsWithKey = async (key: string) => {
    setLoading(true);
    setAuthError('');
    try {
      const res = await fetch('/api/pilot/leads', {
        headers: { 'x-pilot-admin-key': key },
      });
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.leads)) {
        setLeads(data.leads);
        setIsAuthorized(true);
        setAuthMethod('key');
        sessionStorage.setItem('aquaflow_pilot_key', key);
      } else {
        setIsAuthorized(false);
        setAuthError(data.message || 'Invalid administrator key. Access denied.');
      }
    } catch {
      setAuthError('Connection error verifying administrator credentials.');
      setIsAuthorized(false);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminKey.trim()) {
      setAuthError('Please enter the server admin key.');
      return;
    }
    fetchLeadsWithKey(adminKey.trim());
  };

  const handleLogout = () => {
    sessionStorage.removeItem('aquaflow_pilot_key');
    setAdminKey('');
    setIsAuthorized(false);
    setAuthMethod(null);
  };

  const handleStatusChange = async (id: string, newStatus: PilotLeadStatus) => {
    setUpdatingId(id);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (adminKey) headers['x-pilot-admin-key'] = adminKey;

      const res = await fetch(`/api/pilot/leads/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success && data.lead) {
        setLeads((prev) =>
          prev.map((item) => (item.id === id ? { ...item, status: newStatus } : item))
        );
        if (selectedLead?.id === id) {
          setSelectedLead((prev) => (prev ? { ...prev, status: newStatus } : null));
        }
      }
    } catch (err) {
      console.error('Failed to update lead status:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleAutoProvision = async (lead: PilotLeadRecord) => {
    setProvisioningId(lead.id);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (adminKey) headers['x-pilot-admin-key'] = adminKey;

      const res = await fetch(`/api/pilot/provision/${lead.id}`, {
        method: 'POST',
        headers,
      });
      const data: ProvisionResponse = await res.json();
      if (data.success) {
        setProvisionResult(data);
        setLeads((prev) =>
          prev.map((item) => (item.id === lead.id ? { ...item, status: 'ONBOARDED' } : item))
        );
        if (selectedLead?.id === lead.id) {
          setSelectedLead((prev) => (prev ? { ...prev, status: 'ONBOARDED' } : null));
        }
      } else {
        alert(`Auto-provisioning failed: ${data.message}`);
      }
    } catch (err) {
      console.error('Auto provision error:', err);
      alert('Network error provisioning company.');
    } finally {
      setProvisioningId(null);
    }
  };

  const exportCSV = () => {
    if (leads.length === 0) return;
    const headers = [
      'ID',
      'Company Name',
      'Contact Name',
      'Email',
      'Phone',
      'City',
      'Province',
      'Technicians',
      'Status',
      'Source',
      'UTM Campaign',
      'Created At',
    ];
    const rows = leads.map((l) => [
      l.id,
      `"${l.companyName}"`,
      `"${l.contactName}"`,
      l.email,
      l.phone,
      `"${l.city}"`,
      `"${l.province}"`,
      `"${l.technicianCount}"`,
      l.status,
      l.source || 'direct',
      l.utmCampaign || '',
      l.createdAt,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aquaflow-pilot-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const filteredLeads = leads.filter((l) => {
    const matchesStatus = statusFilter === 'ALL' || l.status === statusFilter;
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      l.companyName.toLowerCase().includes(q) ||
      l.contactName.toLowerCase().includes(q) ||
      l.email.toLowerCase().includes(q) ||
      l.phone.toLowerCase().includes(q) ||
      l.city.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const countNew = leads.filter((l) => l.status === 'NEW').length;
  const countApproved = leads.filter((l) => l.status === 'APPROVED' || l.status === 'ONBOARDED').length;

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-[#05080B] flex items-center justify-center p-4">
        <div className="max-w-md w-full glass rounded-3xl p-8 border border-cyan-500/30 shadow-2xl space-y-6">
          <div className="text-center">
            <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center mx-auto mb-4 shadow-[0_0_25px_rgba(0,229,255,0.3)]">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <h2 className="text-2xl font-extrabold text-white">AquaFlow Admin Access</h2>
            <p className="text-xs text-slate-400 mt-1">
              Cryptographically protected server-side lead management portal
            </p>
          </div>

          {authError && (
            <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          {/* Login Option 1: Existing SaaS Session */}
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
              Method 1: Authenticated Founder Login
            </span>
            <p className="text-xs text-slate-300">
              Sign in with your verified AquaFlow owner / administrator credentials.
            </p>
            <Link
              href="/login?redirect=/pilot/admin"
              className="mt-2 w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-700 transition-all"
            >
              <span>Sign in with AquaFlow Account</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Login Option 2: Server Admin Key */}
          <form onSubmit={handleKeyLogin} className="space-y-3 pt-2 border-t border-slate-800">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
              Method 2: Server-Side Secret Key
            </span>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
              <input
                type="password"
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                placeholder="Enter PILOT_ADMIN_SECRET..."
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder:text-slate-600 text-xs focus:border-cyan-400 outline-none font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-slate-950 font-bold text-xs shadow-lg hover:scale-[1.02] transition-all disabled:opacity-50"
            >
              {loading ? 'Authenticating with Server...' : 'Verify Admin Secret'}
            </button>
          </form>

          <div className="pt-2 text-center">
            <Link href="/pilot" className="text-xs text-slate-500 hover:text-cyan-400 inline-flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" /> Return to Public Pilot Landing Page
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#05080B] text-slate-100 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* TOP BAR */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <Link href="/pilot" className="text-xs font-semibold text-cyan-400 hover:underline flex items-center gap-1">
                <ArrowLeft className="w-3.5 h-3.5" /> AquaFlow /pilot
              </Link>
              <span className="text-slate-600">•</span>
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 rounded border border-emerald-500/40 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                Verified Admin ({authMethod === 'session' ? 'RBAC Session' : 'API Secret'})
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
              Pilot Applications Console
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => (adminKey ? fetchLeadsWithKey(adminKey) : fetchLeadsWithSession())}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-xs font-semibold hover:border-cyan-500/50 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            <button
              onClick={exportCSV}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-slate-950 text-xs font-bold shadow-md hover:scale-[1.02] transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={handleLogout}
              className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-red-400 hover:border-red-500/30 transition-all"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* METRICS ROW */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
            <span className="text-xs font-medium text-slate-400">Total Applications</span>
            <div className="text-2xl sm:text-3xl font-extrabold text-white mt-1">{leads.length}</div>
            <span className="text-[11px] text-cyan-400">Neon cloud database</span>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
            <span className="text-xs font-medium text-slate-400">Unreviewed (NEW)</span>
            <div className="text-2xl sm:text-3xl font-extrabold text-cyan-400 mt-1">{countNew}</div>
            <span className="text-[11px] text-slate-500">Require outreach</span>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
            <span className="text-xs font-medium text-slate-400">Approved / Onboarded</span>
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400 mt-1">{countApproved} / 3</div>
            <span className="text-[11px] text-slate-500">Target: 3 founding spots</span>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
            <span className="text-xs font-medium text-slate-400">Cohort Pricing</span>
            <div className="text-2xl sm:text-3xl font-extrabold text-white mt-1">$199 <span className="text-xs font-normal text-slate-400">/mo</span></div>
            <span className="text-[11px] text-emerald-400">High-touch founder support</span>
          </div>
        </div>

        {/* SEARCH & STATUS FILTER */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search company, name, email, city..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder:text-slate-500 text-xs focus:border-cyan-400 outline-none"
            />
          </div>

          {/* STATUS TABS */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all ${
                statusFilter === 'ALL' ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              All ({leads.length})
            </button>
            {ALL_STATUSES.map((st) => {
              const count = leads.filter((l) => l.status === st).length;
              return (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all ${
                    statusFilter === st ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {st} {count > 0 ? `(${count})` : ''}
                </button>
              );
            })}
          </div>
        </div>

        {/* APPLICATIONS LIST */}
        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 overflow-hidden shadow-xl">
          {loading ? (
            <div className="py-16 text-center text-slate-500 text-sm">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-cyan-400" />
              Loading pilot applications...
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="py-16 text-center text-slate-500 text-sm">
              No applications match your criteria.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-[11px] uppercase tracking-wider bg-slate-900/60">
                    <th className="py-3 px-4 font-semibold">Date</th>
                    <th className="py-3 px-4 font-semibold">Company & Contact</th>
                    <th className="py-3 px-4 font-semibold">Location</th>
                    <th className="py-3 px-4 font-semibold">Fleet Size</th>
                    <th className="py-3 px-4 font-semibold">Attribution</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {filteredLeads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-4 px-4 font-mono text-slate-400 text-xs whitespace-nowrap">
                        {new Date(lead.createdAt).toLocaleDateString()}
                        <div className="text-[10px] text-slate-500">
                          {new Date(lead.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        <div className="font-bold text-white text-sm">{lead.companyName}</div>
                        <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                          <span>{lead.contactName}</span>
                          <span className="text-slate-600">•</span>
                          <a href={`mailto:${lead.email}`} className="text-cyan-400 hover:underline">
                            {lead.email}
                          </a>
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          <a href={`tel:${lead.phone}`} className="hover:underline text-slate-300">
                            {lead.phone}
                          </a>
                        </div>
                      </td>

                      <td className="py-4 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1 text-slate-300">
                          <MapPin className="w-3.5 h-3.5 text-slate-500" />
                          <span>{lead.city}, {lead.province}</span>
                        </div>
                      </td>

                      <td className="py-4 px-4 whitespace-nowrap">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs font-medium text-slate-300">
                          {lead.technicianCount}
                        </span>
                      </td>

                      <td className="py-4 px-4">
                        <div className="text-xs font-mono text-cyan-300">{lead.source || 'direct'}</div>
                        {lead.utmCampaign && (
                          <div className="text-[10px] text-slate-500 truncate max-w-[120px]">
                            {lead.utmCampaign}
                          </div>
                        )}
                      </td>

                      <td className="py-4 px-4 whitespace-nowrap">
                        <select
                          value={lead.status}
                          disabled={updatingId === lead.id}
                          onChange={(e) => handleStatusChange(lead.id, e.target.value as PilotLeadStatus)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold border outline-none cursor-pointer bg-[#0A1016] ${STATUS_COLORS[lead.status]}`}
                        >
                          {ALL_STATUSES.map((st) => (
                            <option key={st} value={st} className="bg-[#0A1016] text-slate-200">
                              {st}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="py-4 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleAutoProvision(lead)}
                            disabled={provisioningId === lead.id}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-md ${
                              lead.status === 'ONBOARDED'
                                ? 'bg-slate-800 text-emerald-400 border border-emerald-500/30'
                                : 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 hover:scale-[1.03]'
                            }`}
                          >
                            <Rocket className={`w-3.5 h-3.5 ${provisioningId === lead.id ? 'animate-bounce' : ''}`} />
                            <span>{provisioningId === lead.id ? 'Provisioning...' : lead.status === 'ONBOARDED' ? 'Provisioned' : 'Auto-Provision'}</span>
                          </button>

                          <a
                            href={`mailto:${lead.email}?subject=AquaFlow Founding Pilot Next Steps (${lead.companyName})`}
                            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/40 transition-all"
                            title="Email Applicant"
                          >
                            <Mail className="w-3.5 h-3.5" />
                          </a>
                          <a
                            href={`tel:${lead.phone}`}
                            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/40 transition-all"
                            title="Call Phone"
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </a>
                          <button
                            onClick={() => setSelectedLead(lead)}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-all"
                          >
                            Details
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* PROVISION SUCCESS MODAL */}
        {provisionResult && (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <div className="glass rounded-3xl p-6 sm:p-8 max-w-lg w-full border border-emerald-500/50 shadow-2xl space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/40">
                    <Rocket className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Company Provisioned Successfully!</h3>
                    <span className="text-xs text-slate-400">PostgreSQL Organization & Owner account created</span>
                  </div>
                </div>
                <button
                  onClick={() => setProvisionResult(null)}
                  className="p-1.5 rounded-lg bg-slate-900 text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3 text-xs sm:text-sm">
                <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                  <span className="text-slate-400">Organization:</span>
                  <strong className="text-white">{provisionResult.organization?.name}</strong>
                </div>

                <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                  <span className="text-slate-400">Owner Login Email:</span>
                  <strong className="text-cyan-400 font-mono">{provisionResult.user?.email}</strong>
                </div>

                {provisionResult.user?.tempPassword && (
                  <div className="flex justify-between items-center pb-2 border-b border-slate-800 bg-emerald-950/20 p-2 rounded-xl border border-emerald-500/20">
                    <span className="text-emerald-300 font-medium">Temporary Password:</span>
                    <strong className="text-white font-mono text-xs">{provisionResult.user.tempPassword}</strong>
                  </div>
                )}

                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Login Portal URL:</span>
                  <a
                    href="https://aquaflow-plumbing-theta.vercel.app/login"
                    target="_blank"
                    className="text-cyan-400 hover:underline flex items-center gap-1 font-mono text-xs"
                  >
                    <span>/login</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              <div className="text-[11px] text-slate-400 bg-slate-900/40 p-3 rounded-xl border border-slate-800/80">
                ✅ Pre-populated 6 standard plumbing services (Drains, Water Heaters, Leaks, Jetting).<br/>
                ✅ Generated business hours (Mon-Fri 8am-5pm + Sat Emergency).<br/>
                ✅ Created Super Admin membership and technician profile.
              </div>

              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  onClick={() => {
                    const text = `AquaFlow Login Credentials:\nCompany: ${provisionResult.organization?.name}\nEmail: ${provisionResult.user?.email}\nTemporary Password: ${provisionResult.user?.tempPassword || '(Already Set)'}\nLogin: https://aquaflow-plumbing-theta.vercel.app/login`;
                    navigator.clipboard.writeText(text);
                    setCopiedKey(true);
                    setTimeout(() => setCopiedKey(false), 2500);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 border border-slate-700 transition-all"
                >
                  {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey ? 'Credentials Copied!' : 'Copy Credentials to Clipboard'}</span>
                </button>

                <button
                  onClick={() => setProvisionResult(null)}
                  className="px-5 py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs shadow-md"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* DETAILS MODAL */}
        {selectedLead && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="glass rounded-3xl p-6 sm:p-8 max-w-lg w-full border border-cyan-500/40 shadow-2xl relative space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <span className="text-xs font-mono text-cyan-400">Lead ID: {selectedLead.id}</span>
                  <h3 className="text-xl font-bold text-white mt-0.5">{selectedLead.companyName}</h3>
                </div>
                <button
                  onClick={() => setSelectedLead(null)}
                  className="p-1.5 rounded-lg bg-slate-900 text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs sm:text-sm text-slate-300">
                <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800">
                  <div>
                    <span className="text-slate-500 text-[11px] block">Contact</span>
                    <strong className="text-white">{selectedLead.contactName}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px] block">Fleet Size</span>
                    <strong className="text-white">{selectedLead.technicianCount}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px] block">Email</span>
                    <a href={`mailto:${selectedLead.email}`} className="text-cyan-400 hover:underline">
                      {selectedLead.email}
                    </a>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px] block">Phone</span>
                    <a href={`tel:${selectedLead.phone}`} className="text-slate-200 hover:underline">
                      {selectedLead.phone}
                    </a>
                  </div>
                </div>

                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">
                    Reported Operational Pain Points:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedLead.painPoints.map((p) => (
                      <span
                        key={p}
                        className="px-2.5 py-1 rounded-lg bg-red-950/30 border border-red-500/30 text-red-300 text-xs font-medium"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                </div>

                {selectedLead.notes && (
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                      Applicant Notes:
                    </span>
                    <p className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200">
                      {selectedLead.notes}
                    </p>
                  </div>
                )}

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Source:</span>
                    <span className="text-slate-300">{selectedLead.source || 'direct'}</span>
                  </div>
                  {selectedLead.utmCampaign && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">UTM Campaign:</span>
                      <span className="text-cyan-400">{selectedLead.utmCampaign}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-500">Created:</span>
                    <span className="text-slate-400">{new Date(selectedLead.createdAt).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-between gap-3 border-t border-slate-800">
                <button
                  onClick={() => handleAutoProvision(selectedLead)}
                  disabled={provisioningId === selectedLead.id}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 font-bold text-xs shadow-lg hover:scale-[1.02] transition-all"
                >
                  <Rocket className="w-4 h-4" />
                  <span>{provisioningId === selectedLead.id ? 'Provisioning...' : '🚀 Auto-Provision Org'}</span>
                </button>

                <a
                  href={`mailto:${selectedLead.email}?subject=AquaFlow Founding Pilot Onboarding Setup (${selectedLead.companyName})`}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-700"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Email Lead</span>
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
