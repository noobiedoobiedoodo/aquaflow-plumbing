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
  Check,
  Flame,
  Snowflake,
  Zap,
  Globe,
  Trash2
} from 'lucide-react';
import { PilotLeadRecord, PilotLeadStatus } from '@/lib/services/pilot-lead-service';
import { ColdProspect, InterestLevel, OutreachStatus } from '@/lib/services/prospecting-service';

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

const INTEREST_CONFIG: Record<InterestLevel, { label: string; bg: string; text: string; border: string; icon: string }> = {
  GREEN: { label: 'Yes (High Interest)', bg: 'bg-emerald-950/40', text: 'text-emerald-300', border: 'border-emerald-500/40', icon: '🟢' },
  YELLOW: { label: 'Undecided / Nurturing', bg: 'bg-amber-950/40', text: 'text-amber-300', border: 'border-amber-500/40', icon: '🟡' },
  RED: { label: 'Hard No / Declined', bg: 'bg-red-950/40', text: 'text-red-400', border: 'border-red-500/40', icon: '🔴' },
  UNDECIDED: { label: 'Unranked', bg: 'bg-slate-900', text: 'text-slate-400', border: 'border-slate-800', icon: '⚪' },
};

const OUTREACH_CONFIG: Record<OutreachStatus, { label: string; color: string }> = {
  NOT_CONTACTED: { label: 'Not Contacted', color: 'bg-slate-800 text-slate-300 border-slate-700' },
  EMAIL_SENT: { label: 'Email Sent', color: 'bg-blue-950/40 text-blue-300 border-blue-500/40' },
  CALLED: { label: 'Called / Voicemail', color: 'bg-purple-950/40 text-purple-300 border-purple-500/40' },
  IN_CONVERSATION: { label: 'In Conversation', color: 'bg-amber-950/40 text-amber-300 border-amber-500/40' },
  PROVISIONED: { label: 'Provisioned', color: 'bg-emerald-950/40 text-emerald-300 border-emerald-500/40' },
};

interface ProvisionResponse {
  success: boolean;
  message: string;
  emailSent?: boolean;
  emailError?: string | null;
  activationLink?: string;
  paymentLink?: string;
  tokenExpiresIn?: string;
  tokenExpiresAt?: string;
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
  const [activeTab, setActiveTab] = useState<'warm' | 'cold'>('warm');

  // Warm Leads State
  const [leads, setLeads] = useState<PilotLeadRecord[]>([]);
  const [selectedLead, setSelectedLead] = useState<PilotLeadRecord | null>(null);

  // Cold Prospects State
  const [prospects, setProspects] = useState<ColdProspect[]>([]);
  const [selectedProspect, setSelectedProspect] = useState<ColdProspect | null>(null);
  const [scrapingState, setScrapingState] = useState<string>('ALL');
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeNotification, setScrapeNotification] = useState<string | null>(null);
  const [interestFilter, setInterestFilter] = useState<string>('ALL');
  const [outreachFilter, setOutreachFilter] = useState<string>('ALL');

  // Shared State
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [provisioningId, setProvisioningId] = useState<string | null>(null);
  const [provisionResult, setProvisionResult] = useState<ProvisionResponse | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedPayment, setCopiedPayment] = useState(false);
  const [adminKey, setAdminKey] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authMethod, setAuthMethod] = useState<'session' | 'key' | null>(null);

  // Check stored credentials or existing session on mount
  useEffect(() => {
    const storedKey = sessionStorage.getItem('aquaflow_pilot_key');
    if (storedKey) {
      setAdminKey(storedKey);
      fetchDataWithKey(storedKey);
    } else {
      fetchDataWithSession();
    }
  }, []);

  const fetchDataWithSession = async () => {
    setLoading(true);
    try {
      const [leadsRes, prospectsRes] = await Promise.all([
        fetch('/api/pilot/leads'),
        fetch('/api/pilot/prospects')
      ]);

      if (leadsRes.ok) {
        const data = await leadsRes.json();
        if (data.success && Array.isArray(data.leads)) {
          setLeads(data.leads);
          setIsAuthorized(true);
          setAuthMethod('session');
          setAuthError('');
        }
      } else {
        setIsAuthorized(false);
      }

      if (prospectsRes.ok) {
        const pData = await prospectsRes.json();
        if (pData.success && Array.isArray(pData.prospects)) {
          setProspects(pData.prospects);
        }
      }
    } catch {
      setIsAuthorized(false);
    } finally {
      setLoading(false);
    }
  };

  const fetchDataWithKey = async (key: string) => {
    setLoading(true);
    setAuthError('');
    try {
      const headers = { 'x-pilot-admin-key': key };
      const [leadsRes, prospectsRes] = await Promise.all([
        fetch('/api/pilot/leads', { headers }),
        fetch('/api/pilot/prospects', { headers })
      ]);

      const data = await leadsRes.json();
      if (leadsRes.ok && data.success && Array.isArray(data.leads)) {
        setLeads(data.leads);
        setIsAuthorized(true);
        setAuthMethod('key');
        sessionStorage.setItem('aquaflow_pilot_key', key);
      } else {
        setIsAuthorized(false);
        setAuthError(data.message || 'Invalid administrator key. Access denied.');
      }

      if (prospectsRes.ok) {
        const pData = await prospectsRes.json();
        if (pData.success && Array.isArray(pData.prospects)) {
          setProspects(pData.prospects);
        }
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
    fetchDataWithKey(adminKey.trim());
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

  // Run Scraper / Prospector
  const handleRunScraper = async () => {
    setIsScraping(true);
    setScrapeNotification(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (adminKey) headers['x-pilot-admin-key'] = adminKey;

      const res = await fetch('/api/pilot/prospects', {
        method: 'POST',
        headers,
        body: JSON.stringify({ state: scrapingState }),
      });
      const data = await res.json();
      if (data.success) {
        setProspects(data.prospects);
        setScrapeNotification(`🎉 Imported ${data.added} target plumbing prospects! Total: ${data.total}`);
        setTimeout(() => setScrapeNotification(null), 5000);
      } else {
        alert(`Scraping failed: ${data.message}`);
      }
    } catch (err) {
      console.error('Scraper error:', err);
      alert('Error running scraper engine');
    } finally {
      setIsScraping(false);
    }
  };

  // Update Cold Prospect Qualification
  const handleUpdateProspect = async (
    id: string,
    update: { interestLevel?: InterestLevel; outreachStatus?: OutreachStatus; notes?: string }
  ) => {
    setUpdatingId(id);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (adminKey) headers['x-pilot-admin-key'] = adminKey;

      const res = await fetch(`/api/pilot/prospects/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(update),
      });
      const data = await res.json();
      if (data.success && data.prospect) {
        setProspects((prev) =>
          prev.map((item) => (item.id === id ? data.prospect : item))
        );
        if (selectedProspect?.id === id) {
          setSelectedProspect(data.prospect);
        }
      }
    } catch (err) {
      console.error('Failed to update prospect qualification:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  // Delete Prospect
  const handleDeleteProspect = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove ${name} from cold prospects?`)) return;
    try {
      const headers: Record<string, string> = {};
      if (adminKey) headers['x-pilot-admin-key'] = adminKey;

      const res = await fetch(`/api/pilot/prospects/${id}`, {
        method: 'DELETE',
        headers,
      });
      if (res.ok) {
        setProspects((prev) => prev.filter((p) => p.id !== id));
        if (selectedProspect?.id === id) setSelectedProspect(null);
      }
    } catch (err) {
      console.error('Failed to delete prospect:', err);
    }
  };

  // Auto Provision Company
  const handleAutoProvision = async (item: { id: string; companyName: string }) => {
    setProvisioningId(item.id);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (adminKey) headers['x-pilot-admin-key'] = adminKey;

      const res = await fetch(`/api/pilot/provision/${item.id}`, {
        method: 'POST',
        headers,
      });
      const data: ProvisionResponse = await res.json();
      if (data.success) {
        setProvisionResult(data);
        // Update state in either list
        setLeads((prev) =>
          prev.map((l) => (l.id === item.id ? { ...l, status: 'ONBOARDED' } : l))
        );
        setProspects((prev) =>
          prev.map((p) =>
            p.id === item.id
              ? { ...p, outreachStatus: 'PROVISIONED', interestLevel: 'GREEN' }
              : p
          )
        );
        if (selectedLead?.id === item.id) {
          setSelectedLead((prev) => (prev ? { ...prev, status: 'ONBOARDED' } : null));
        }
        if (selectedProspect?.id === item.id) {
          setSelectedProspect((prev) =>
            prev ? { ...prev, outreachStatus: 'PROVISIONED', interestLevel: 'GREEN' } : null
          );
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

  // Filter Warm Leads
  const filteredLeads = leads.filter((lead) => {
    const matchesSearch =
      lead.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.contactName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.city.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || lead.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Filter Cold Prospects
  const filteredProspects = prospects.filter((p) => {
    const matchesSearch =
      p.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.contactName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.state.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesInterest = interestFilter === 'ALL' || p.interestLevel === interestFilter;
    const matchesOutreach = outreachFilter === 'ALL' || p.outreachStatus === outreachFilter;
    return matchesSearch && matchesInterest && matchesOutreach;
  });

  const exportCSV = () => {
    if (activeTab === 'warm') {
      if (leads.length === 0) return;
      const headers = ['ID', 'Company Name', 'Contact Name', 'Email', 'Phone', 'City', 'Province', 'Technicians', 'Status', 'Source', 'Created At'];
      const rows = leads.map((l) => [
        l.id,
        `"${l.companyName}"`,
        `"${l.contactName}"`,
        l.email,
        l.phone,
        l.city,
        l.province,
        l.technicianCount,
        l.status,
        l.source || 'direct',
        l.createdAt,
      ]);
      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `aquaflow-inbound-leads-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      if (prospects.length === 0) return;
      const headers = ['ID', 'Company Name', 'Contact Name', 'Title', 'Email', 'Phone', 'City', 'State', 'Technicians', 'Interest Level', 'Outreach Status', 'Created At'];
      const rows = prospects.map((p) => [
        p.id,
        `"${p.companyName}"`,
        `"${p.contactName}"`,
        p.title,
        p.email,
        p.phone,
        p.city,
        p.state,
        p.technicianCount,
        p.interestLevel,
        p.outreachStatus,
        p.createdAt,
      ]);
      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `aquaflow-cold-prospects-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  if (!isAuthorized && !loading) {
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
    <div className="min-h-screen bg-[#06090E] text-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* TOP BAR */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                SaaS Control Center
              </span>
              <span className="text-xs text-slate-500">v2.4 Production</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              AquaFlow Growth & Onboarding Portal
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (authMethod === 'key') fetchDataWithKey(adminKey);
                else fetchDataWithSession();
              }}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-800 transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            <button
              onClick={exportCSV}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-800 transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={handleLogout}
              className="p-2 rounded-xl bg-red-950/20 text-red-400 border border-red-500/20 hover:bg-red-950/40 transition-all"
              title="Lock Admin Console"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* TABS NAVIGATION */}
        <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-950/80 border border-slate-800 max-w-xl">
          <button
            onClick={() => { setActiveTab('warm'); setSearchTerm(''); }}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
              activeTab === 'warm'
                ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Flame className="w-4 h-4" />
            <span>Warm Inbound Leads (/pilot)</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
              activeTab === 'warm' ? 'bg-slate-950/40 text-slate-950' : 'bg-slate-800 text-cyan-400'
            }`}>
              {leads.length}
            </span>
          </button>

          <button
            onClick={() => { setActiveTab('cold'); setSearchTerm(''); }}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
              activeTab === 'cold'
                ? 'bg-gradient-to-r from-cyan-500 to-emerald-400 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Snowflake className="w-4 h-4" />
            <span>Cold Outbound & Scraper</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
              activeTab === 'cold' ? 'bg-slate-950/40 text-slate-950' : 'bg-slate-800 text-emerald-400'
            }`}>
              {prospects.length}
            </span>
          </button>
        </div>

        {/* SCRAPE NOTIFICATION BANNER */}
        {scrapeNotification && (
          <div className="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center justify-between">
            <span>{scrapeNotification}</span>
            <button onClick={() => setScrapeNotification(null)} className="text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* TAB 1: WARM INBOUND LEADS */}
        {activeTab === 'warm' && (
          <div className="space-y-6">
            {/* KPI STATS */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="glass rounded-2xl p-4 border border-slate-800">
                <span className="text-xs text-slate-400 font-medium">Total Inbound Leads</span>
                <div className="text-2xl font-bold text-white mt-1">{leads.length}</div>
              </div>
              <div className="glass rounded-2xl p-4 border border-slate-800">
                <span className="text-xs text-cyan-400 font-medium">New Submissions</span>
                <div className="text-2xl font-bold text-cyan-400 mt-1">
                  {leads.filter((l) => l.status === 'NEW').length}
                </div>
              </div>
              <div className="glass rounded-2xl p-4 border border-slate-800">
                <span className="text-xs text-emerald-400 font-medium">Onboarded / Active</span>
                <div className="text-2xl font-bold text-emerald-400 mt-1">
                  {leads.filter((l) => l.status === 'ONBOARDED').length}
                </div>
              </div>
              <div className="glass rounded-2xl p-4 border border-slate-800">
                <span className="text-xs text-purple-400 font-medium">Qualified</span>
                <div className="text-2xl font-bold text-purple-400 mt-1">
                  {leads.filter((l) => l.status === 'QUALIFIED' || l.status === 'APPROVED').length}
                </div>
              </div>
            </div>

            {/* FILTERS */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  placeholder="Search inbound by company, contact, email, or city..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-500"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 outline-none"
              >
                <option value="ALL">All Inbound Statuses</option>
                {ALL_STATUSES.map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>

            {/* LEADS TABLE */}
            <div className="glass rounded-3xl border border-slate-800/80 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="py-3.5 px-4">Company & Contact</th>
                      <th className="py-3.5 px-4">Location</th>
                      <th className="py-3.5 px-4">Fleet</th>
                      <th className="py-3.5 px-4">Source</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-200">
                    {filteredLeads.map((lead) => (
                      <tr key={lead.id} className="hover:bg-slate-900/40 transition-colors">
                        <td className="py-4 px-4">
                          <div className="font-bold text-white text-sm">{lead.companyName}</div>
                          <div className="text-slate-400 text-xs mt-0.5">{lead.contactName} • {lead.email}</div>
                        </td>
                        <td className="py-4 px-4 whitespace-nowrap text-slate-300">
                          {lead.city}, {lead.province}
                        </td>
                        <td className="py-4 px-4 whitespace-nowrap">
                          <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px]">
                            {lead.technicianCount}
                          </span>
                        </td>
                        <td className="py-4 px-4 whitespace-nowrap text-cyan-400 font-mono text-[11px]">
                          {lead.source || 'direct'}
                        </td>
                        <td className="py-4 px-4 whitespace-nowrap">
                          <select
                            value={lead.status}
                            disabled={updatingId === lead.id}
                            onChange={(e) => handleStatusChange(lead.id, e.target.value as PilotLeadStatus)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold border outline-none bg-[#0A1016] ${STATUS_COLORS[lead.status]}`}
                          >
                            {ALL_STATUSES.map((st) => (
                              <option key={st} value={st}>{st}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-4 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleAutoProvision(lead)}
                              disabled={provisioningId === lead.id}
                              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                lead.status === 'ONBOARDED'
                                  ? 'bg-slate-800 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 hover:scale-[1.02]'
                              }`}
                            >
                              <Rocket className="w-3.5 h-3.5" />
                              <span>{provisioningId === lead.id ? 'Provisioning...' : lead.status === 'ONBOARDED' ? 'Provisioned' : 'Auto-Provision'}</span>
                            </button>
                            <a
                              href={`mailto:${lead.email}`}
                              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-cyan-400"
                            >
                              <Mail className="w-3.5 h-3.5" />
                            </a>
                            <button
                              onClick={() => setSelectedLead(lead)}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
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
            </div>
          </div>
        )}

        {/* TAB 2: COLD OUTBOUND & SCRAPER */}
        {activeTab === 'cold' && (
          <div className="space-y-6">
            {/* SCRAPER CONTROL HERO */}
            <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-slate-950 via-[#0A121A] to-slate-950 border border-cyan-500/30 shadow-2xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="space-y-1 max-w-xl">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 text-[10px] font-bold uppercase">
                  <Zap className="w-3 h-3" /> US Contractor Acquisition Engine
                </div>
                <h2 className="text-xl font-bold text-white">Targeted US Plumbing Prospector</h2>
                <p className="text-xs text-slate-400">
                  Scrapes independent 2–15 van plumbing companies across high-volume US states with qualified pain points and contact details.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={scrapingState}
                  onChange={(e) => setScrapingState(e.target.value)}
                  className="px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs font-bold text-white outline-none"
                >
                  <option value="ALL">🇺🇸 All Target US States</option>
                  <option value="TX">Texas (Houston, Dallas, Austin, San Antonio)</option>
                  <option value="FL">Florida (Tampa, Miami, Orlando, Jax)</option>
                  <option value="CA">California (San Diego, SF, LA)</option>
                  <option value="OH">Ohio & Midwest (Columbus, Cincy, Chicago)</option>
                  <option value="GA">Georgia & Southeast (Atlanta, Charlotte, Nashville)</option>
                </select>

                <button
                  onClick={handleRunScraper}
                  disabled={isScraping}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-400 text-slate-950 font-bold text-xs shadow-lg hover:scale-[1.02] transition-all disabled:opacity-50"
                >
                  <Zap className={`w-4 h-4 ${isScraping ? 'animate-spin' : ''}`} />
                  <span>{isScraping ? 'Scraping US Contractors...' : '⚡ 1-Click Run Prospector'}</span>
                </button>
              </div>
            </div>

            {/* KPI MATRIX */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="glass rounded-2xl p-4 border border-slate-800">
                <span className="text-xs text-slate-400 font-medium">Total Cold Prospects</span>
                <div className="text-2xl font-bold text-white mt-1">{prospects.length}</div>
              </div>
              <div className="glass rounded-2xl p-4 border border-emerald-500/30">
                <span className="text-xs text-emerald-400 font-medium">🟢 Green (Yes / High Fit)</span>
                <div className="text-2xl font-bold text-emerald-400 mt-1">
                  {prospects.filter((p) => p.interestLevel === 'GREEN').length}
                </div>
              </div>
              <div className="glass rounded-2xl p-4 border border-amber-500/30">
                <span className="text-xs text-amber-400 font-medium">🟡 Yellow (Undecided)</span>
                <div className="text-2xl font-bold text-amber-400 mt-1">
                  {prospects.filter((p) => p.interestLevel === 'YELLOW').length}
                </div>
              </div>
              <div className="glass rounded-2xl p-4 border border-red-500/30">
                <span className="text-xs text-red-400 font-medium">🔴 Red (Hard No)</span>
                <div className="text-2xl font-bold text-red-400 mt-1">
                  {prospects.filter((p) => p.interestLevel === 'RED').length}
                </div>
              </div>
            </div>

            {/* COLD PROSPECTS FILTERS */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  placeholder="Search cold prospects by company, owner, city, or state..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-500"
                />
              </div>

              <select
                value={interestFilter}
                onChange={(e) => setInterestFilter(e.target.value)}
                className="px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 outline-none"
              >
                <option value="ALL">Traffic Light: All</option>
                <option value="GREEN">🟢 Green (Yes)</option>
                <option value="YELLOW">🟡 Yellow (Undecided)</option>
                <option value="RED">🔴 Red (Hard No)</option>
                <option value="UNDECIDED">⚪ Unranked</option>
              </select>

              <select
                value={outreachFilter}
                onChange={(e) => setOutreachFilter(e.target.value)}
                className="px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 outline-none"
              >
                <option value="ALL">Outreach: All</option>
                <option value="NOT_CONTACTED">⚪ Not Contacted</option>
                <option value="EMAIL_SENT">🔵 Email Sent</option>
                <option value="CALLED">📞 Called</option>
                <option value="IN_CONVERSATION">💬 In Conversation</option>
                <option value="PROVISIONED">🚀 Provisioned</option>
              </select>
            </div>

            {/* COLD PROSPECTS TABLE */}
            <div className="glass rounded-3xl border border-slate-800/80 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="py-3.5 px-4">Company & Decision Maker</th>
                      <th className="py-3.5 px-4">State & City</th>
                      <th className="py-3.5 px-4">Fleet</th>
                      <th className="py-3.5 px-4">Traffic Light Interest</th>
                      <th className="py-3.5 px-4">Outreach Status</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-200">
                    {filteredProspects.map((p) => {
                      const intCfg = INTEREST_CONFIG[p.interestLevel] || INTEREST_CONFIG.UNDECIDED;
                      const outCfg = OUTREACH_CONFIG[p.outreachStatus] || OUTREACH_CONFIG.NOT_CONTACTED;
                      return (
                        <tr key={p.id} className="hover:bg-slate-900/40 transition-colors">
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white text-sm">{p.companyName}</span>
                              {p.website && (
                                <a href={p.website} target="_blank" className="text-slate-500 hover:text-cyan-400">
                                  <Globe className="w-3.5 h-3.5" />
                                </a>
                              )}
                            </div>
                            <div className="text-slate-400 text-xs mt-0.5">
                              {p.contactName} ({p.title}) • {p.email} • {p.phone}
                            </div>
                          </td>

                          <td className="py-4 px-4 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded-md bg-slate-900 font-bold text-cyan-300 border border-slate-800 mr-1.5">
                              {p.state}
                            </span>
                            <span className="text-slate-300">{p.city}</span>
                          </td>

                          <td className="py-4 px-4 whitespace-nowrap">
                            <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px]">
                              {p.technicianCount}
                            </span>
                          </td>

                          {/* TRAFFIC LIGHT INTEREST PICKER */}
                          <td className="py-4 px-4 whitespace-nowrap">
                            <select
                              value={p.interestLevel}
                              disabled={updatingId === p.id}
                              onChange={(e) => handleUpdateProspect(p.id, { interestLevel: e.target.value as InterestLevel })}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold border outline-none cursor-pointer ${intCfg.bg} ${intCfg.text} ${intCfg.border}`}
                            >
                              <option value="GREEN" className="bg-[#0A1016] text-emerald-300">🟢 Green (Yes / High Interest)</option>
                              <option value="YELLOW" className="bg-[#0A1016] text-amber-300">🟡 Yellow (Undecided / Nurturing)</option>
                              <option value="RED" className="bg-[#0A1016] text-red-400">🔴 Red (Hard No / Declined)</option>
                              <option value="UNDECIDED" className="bg-[#0A1016] text-slate-400">⚪ Unranked</option>
                            </select>
                          </td>

                          {/* OUTREACH STATUS PICKER */}
                          <td className="py-4 px-4 whitespace-nowrap">
                            <select
                              value={p.outreachStatus}
                              disabled={updatingId === p.id}
                              onChange={(e) => handleUpdateProspect(p.id, { outreachStatus: e.target.value as OutreachStatus })}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold border outline-none cursor-pointer ${outCfg.color}`}
                            >
                              <option value="NOT_CONTACTED" className="bg-[#0A1016] text-slate-300">⚪ Not Contacted</option>
                              <option value="EMAIL_SENT" className="bg-[#0A1016] text-blue-300">🔵 Email Sent</option>
                              <option value="CALLED" className="bg-[#0A1016] text-purple-300">📞 Called</option>
                              <option value="IN_CONVERSATION" className="bg-[#0A1016] text-amber-300">💬 In Conversation</option>
                              <option value="PROVISIONED" className="bg-[#0A1016] text-emerald-300">🚀 Provisioned</option>
                            </select>
                          </td>

                          {/* ACTION BUTTONS */}
                          <td className="py-4 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleAutoProvision(p)}
                                disabled={provisioningId === p.id}
                                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                  p.outreachStatus === 'PROVISIONED'
                                    ? 'bg-slate-800 text-emerald-400 border border-emerald-500/30'
                                    : 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 hover:scale-[1.02]'
                                }`}
                              >
                                <Rocket className="w-3.5 h-3.5" />
                                <span>{provisioningId === p.id ? 'Provisioning...' : p.outreachStatus === 'PROVISIONED' ? 'Provisioned' : 'Auto-Provision'}</span>
                              </button>

                              <button
                                onClick={() => {
                                  const text = `Hi ${p.contactName},\n\nI noticed ${p.companyName} is running a strong plumbing team in ${p.city}.\n\nWe built AquaFlow specifically for independent contractors sick of paying $1,200/mo for ServiceTitan or playing dispatch phone tag.\n\nWe are selecting 3 founding partners for our $199/mo lifetime pilot cohort.\n\nCheck out the live preview & 60-sec application:\nhttps://aquaflow-plumbing-theta.vercel.app/pilot?utm_source=cold_outbound&utm_campaign=${p.state.toLowerCase()}_pilot\n\nBest,\nAquaFlow Founding Team`;
                                  navigator.clipboard.writeText(text);
                                  handleUpdateProspect(p.id, { outreachStatus: 'EMAIL_SENT' });
                                  alert('Outreach email copied to clipboard & status marked as EMAIL_SENT!');
                                }}
                                className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-cyan-400"
                                title="Copy Cold Email Script"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>

                              <a
                                href={`tel:${p.phone}`}
                                onClick={() => handleUpdateProspect(p.id, { outreachStatus: 'CALLED' })}
                                className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-emerald-400"
                                title="Call Phone"
                              >
                                <Phone className="w-3.5 h-3.5" />
                              </a>

                              <button
                                onClick={() => setSelectedProspect(p)}
                                className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                              >
                                Details
                              </button>

                              <button
                                onClick={() => handleDeleteProspect(p.id, p.companyName)}
                                className="p-1.5 rounded-lg bg-slate-900 text-slate-500 hover:text-red-400"
                                title="Remove Prospect"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

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

                {/* EMAIL DELIVERY STATUS */}
                <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                  <span className="text-slate-400">Email Delivery:</span>
                  {provisionResult.emailSent ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-950/30 px-2 py-0.5 rounded-md border border-emerald-500/30">
                      <Check className="w-3 h-3" /> Dispatched via Resend
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400 bg-amber-950/30 px-2 py-0.5 rounded-md border border-amber-500/30">
                      Manual Dispatch (Share Link Below)
                    </span>
                  )}
                </div>

                {/* 3-MINUTE ACTIVATION LINK */}
                {provisionResult.activationLink && (
                  <div className="p-3 rounded-xl bg-cyan-950/20 border border-cyan-500/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5" /> 3-Minute Activation Link
                      </span>
                      <span className="text-[10px] font-bold text-amber-300 bg-amber-950/50 px-1.5 py-0.5 rounded border border-amber-500/30">
                        ⏱️ Expires in 3 Mins
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        readOnly
                        value={provisionResult.activationLink}
                        className="flex-1 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800 text-[11px] text-slate-300 font-mono select-all outline-none"
                      />
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(provisionResult.activationLink!);
                          setCopiedKey(true);
                          setTimeout(() => setCopiedKey(false), 2500);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-cyan-500 text-slate-950 text-xs font-bold shrink-0 hover:scale-[1.02] transition-all"
                      >
                        {copiedKey ? 'Copied!' : 'Copy Link'}
                      </button>
                    </div>
                  </div>
                )}

                {/* $199/MO STRIPE SUBSCRIPTION PAYMENT LINK */}
                {provisionResult.paymentLink && (
                  <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5" /> 1-Click $199/mo Stripe Payment Link
                      </span>
                      <span className="text-[10px] font-bold text-emerald-300 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-500/30">
                        💳 Founding Pilot Cohort
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        readOnly
                        value={provisionResult.paymentLink}
                        className="flex-1 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800 text-[11px] text-slate-300 font-mono select-all outline-none"
                      />
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(provisionResult.paymentLink!);
                          setCopiedPayment(true);
                          setTimeout(() => setCopiedPayment(false), 2500);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500 text-slate-950 text-xs font-bold shrink-0 hover:scale-[1.02] transition-all"
                      >
                        {copiedPayment ? 'Copied!' : 'Copy Payment Link'}
                      </button>
                    </div>
                  </div>
                )}

                {provisionResult.user?.tempPassword && (
                  <div className="flex justify-between items-center bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-xs">
                    <span className="text-slate-400 font-medium">Backup Temp Password:</span>
                    <strong className="text-white font-mono">{provisionResult.user.tempPassword}</strong>
                  </div>
                )}
              </div>

              <div className="text-[11px] text-slate-400 bg-slate-900/40 p-3 rounded-xl border border-slate-800/80">
                ✅ Pre-populated 6 standard plumbing services (Drains, Water Heaters, Leaks, Jetting).<br/>
                ✅ Configured business hours (Mon-Fri 8am-5pm + Sat Emergency).<br/>
                ✅ Created Super Admin account and technician profile.
              </div>

              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  onClick={() => {
                    const text = `AquaFlow Founding Pilot Onboarding:\nCompany: ${provisionResult.organization?.name}\nEmail: ${provisionResult.user?.email}\n\n1️⃣ 3-Minute Account Activation Link:\n${provisionResult.activationLink || 'https://aquaflow-plumbing-theta.vercel.app/login'}\n(Note: Activation link expires in 3 minutes for security)\n\n2️⃣ 1-Click $199/mo Founding Pilot Subscription:\n${provisionResult.paymentLink || 'https://aquaflow-plumbing-theta.vercel.app/pricing'}\n\nDashboard Login: https://aquaflow-plumbing-theta.vercel.app/login`;
                    navigator.clipboard.writeText(text);
                    setCopiedKey(true);
                    setTimeout(() => setCopiedKey(false), 2500);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 border border-slate-700 transition-all"
                >
                  {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey ? 'Full Invite Copied!' : 'Copy Full Invite (Activation + Payment)'}</span>
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

        {/* DETAILS MODAL FOR WARM LEAD */}
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

        {/* DETAILS MODAL FOR COLD PROSPECT */}
        {selectedProspect && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="glass rounded-3xl p-6 sm:p-8 max-w-lg w-full border border-emerald-500/40 shadow-2xl relative space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-emerald-400">Prospect ID: {selectedProspect.id.slice(0, 8)}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-cyan-950 border border-cyan-500/30 text-cyan-300">
                      {selectedProspect.state}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-white mt-0.5">{selectedProspect.companyName}</h3>
                </div>
                <button
                  onClick={() => setSelectedProspect(null)}
                  className="p-1.5 rounded-lg bg-slate-900 text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs sm:text-sm text-slate-300">
                <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800">
                  <div>
                    <span className="text-slate-500 text-[11px] block">Decision Maker</span>
                    <strong className="text-white">{selectedProspect.contactName} ({selectedProspect.title})</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px] block">Fleet Size</span>
                    <strong className="text-white">{selectedProspect.technicianCount}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px] block">Email</span>
                    <a href={`mailto:${selectedProspect.email}`} className="text-cyan-400 hover:underline">
                      {selectedProspect.email}
                    </a>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px] block">Phone</span>
                    <a href={`tel:${selectedProspect.phone}`} className="text-slate-200 hover:underline">
                      {selectedProspect.phone}
                    </a>
                  </div>
                </div>

                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">
                    Identified Operational Pain Points:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedProspect.painPoints.map((p) => (
                      <span
                        key={p}
                        className="px-2.5 py-1 rounded-lg bg-red-950/30 border border-red-500/30 text-red-300 text-xs font-medium"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Rep Outreach Notes:
                  </span>
                  <textarea
                    defaultValue={selectedProspect.notes || ''}
                    onBlur={(e) => handleUpdateProspect(selectedProspect.id, { notes: e.target.value })}
                    placeholder="Enter call notes or objections here..."
                    className="w-full p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 outline-none focus:border-emerald-500"
                    rows={3}
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-between gap-3 border-t border-slate-800">
                <button
                  onClick={() => handleAutoProvision(selectedProspect)}
                  disabled={provisioningId === selectedProspect.id}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 font-bold text-xs shadow-lg hover:scale-[1.02] transition-all"
                >
                  <Rocket className="w-4 h-4" />
                  <span>{provisioningId === selectedProspect.id ? 'Provisioning...' : '🚀 Auto-Provision Org'}</span>
                </button>

                <button
                  onClick={() => {
                    const text = `Hi ${selectedProspect.contactName},\n\nI noticed ${selectedProspect.companyName} is running a strong plumbing team in ${selectedProspect.city}.\n\nWe built AquaFlow specifically for independent contractors sick of paying $1,200/mo for ServiceTitan or playing dispatch phone tag.\n\nWe are selecting 3 founding partners for our $199/mo lifetime pilot cohort.\n\nCheck out the live preview & 60-sec application:\nhttps://aquaflow-plumbing-theta.vercel.app/pilot?utm_source=cold_outbound&utm_campaign=${selectedProspect.state.toLowerCase()}_pilot\n\nBest,\nAquaFlow Founding Team`;
                    navigator.clipboard.writeText(text);
                    handleUpdateProspect(selectedProspect.id, { outreachStatus: 'EMAIL_SENT' });
                    alert('Outreach email copied to clipboard & status marked as EMAIL_SENT!');
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-700"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Cold Script</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
