'use client';

import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, AlertCircle, Loader2, Sparkles, Building, User, Mail, Phone, Globe, MapPin, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const TECH_COUNT_OPTIONS = [
  'Just me (Solo Operator)',
  '2–3 Technicians',
  '4–10 Technicians',
  '11–25 Technicians',
  '25+ Technicians',
];

const PAIN_POINTS_OPTIONS = [
  'Scheduling conflicts & calendar mess',
  'Dispatch & knowing where techs are',
  'Missed calls & lost customer jobs',
  'Technician communication & phone tag',
  'Paper invoices & lost job sheets',
  'Getting paid on time / 30-day delays',
  'Too many disconnected software apps',
  'Late-night admin & paperwork shifts',
  'Customer follow-ups & review requests',
  'Other operational bottleneck',
];

export function PilotApplicationForm() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    companyName: '',
    contactName: '',
    email: '',
    phone: '',
    website: '',
    city: '',
    province: '',
    technicianCount: '',
    painPoints: [] as string[],
    notes: '',
  });

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successResult, setSuccessResult] = useState<{ leadId: string; message: string } | null>(null);

  const handlePainPointToggle = (item: string) => {
    setFormData((prev) => ({
      ...prev,
      painPoints: prev.painPoints.includes(item)
        ? prev.painPoints.filter((p) => p !== item)
        : [...prev.painPoints, item],
    }));
  };

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (step === 1) {
      if (!formData.companyName || !formData.contactName || !formData.email || !formData.phone || !formData.city || !formData.province) {
        setErrorMessage('Please fill out all required company and contact fields.');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!formData.technicianCount) {
        setErrorMessage('Please select your current operational size.');
        return;
      }
      setStep(3);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (formData.painPoints.length === 0) {
      setErrorMessage('Please select at least one operational headache.');
      return;
    }

    setLoading(true);

    try {
      // Capture UTM parameters from URL if present
      const urlParams = new URLSearchParams(window.location.search);
      const payload = {
        ...formData,
        utmSource: urlParams.get('utm_source') || undefined,
        utmMedium: urlParams.get('utm_medium') || undefined,
        utmCampaign: urlParams.get('utm_campaign') || undefined,
        utmContent: urlParams.get('utm_content') || undefined,
        referrer: typeof document !== 'undefined' ? document.referrer : undefined,
      };

      const res = await fetch('/api/pilot/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to submit application. Please check your fields.');
      }

      setSuccessResult({
        leadId: data.leadId,
        message: data.message,
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="apply" className="py-24 bg-[#05080B] relative overflow-hidden">
      {/* Glow backgrounds */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[650px] bg-gradient-to-tr from-blue-600/20 via-cyan-500/15 to-transparent rounded-full blur-[160px] pointer-events-none" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-950/40 border border-cyan-500/30 text-cyan-400 text-xs font-bold uppercase tracking-wider mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            Founding Cohort Application
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
            Apply for the $199/month Pilot.
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-300">
            We are accepting <span className="text-white font-semibold">only 3 commercial plumbing companies</span> in this founding cohort to ensure hands-on, high-touch onboarding and direct founder support.
          </p>
        </div>

        {/* Form Container */}
        <div className="glass rounded-3xl p-6 sm:p-10 border border-cyan-500/30 shadow-[0_20px_60px_rgba(0,0,0,0.8)]">
          {successResult ? (
            /* SUCCESS CONFIRMATION STATE */
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-10 space-y-6"
            >
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-400 text-slate-950 flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(0,229,255,0.6)]">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <h3 className="text-2xl sm:text-3xl font-extrabold text-white">
                Application Received!
              </h3>

              <p className="text-slate-300 max-w-lg mx-auto text-sm sm:text-base leading-relaxed">
                Thank you, <span className="text-white font-semibold">{formData.contactName}</span>. Your application for <span className="text-white font-semibold">{formData.companyName}</span> is now in the review queue for the 3 founding pilot spots.
              </p>

              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 max-w-md mx-auto text-left space-y-2 text-xs text-slate-300">
                <div className="flex justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-400">Application Reference:</span>
                  <span className="font-mono text-cyan-400 font-bold">{successResult.leadId.slice(0, 13)}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-400">Status:</span>
                  <span className="text-emerald-400 font-bold">In Review (24h turnaround)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Next Step:</span>
                  <span>Direct founder outreach via phone/email</span>
                </div>
              </div>

              <div className="pt-4">
                <a
                  href="#how-it-works"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-400 hover:text-cyan-300"
                >
                  <span>Review How AquaFlow Works in the Meantime</span>
                  <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            </motion.div>
          ) : (
            /* MULTI-STEP APPLICATION FORM */
            <div>
              {/* Stepper Progress Bar */}
              <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${step >= 1 ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
                    1
                  </span>
                  <span className={`text-xs font-semibold hidden sm:inline ${step >= 1 ? 'text-white' : 'text-slate-500'}`}>
                    Company Info
                  </span>
                </div>
                <div className="w-12 h-[2px] bg-slate-800" />
                <div className="flex items-center gap-3">
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${step >= 2 ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
                    2
                  </span>
                  <span className={`text-xs font-semibold hidden sm:inline ${step >= 2 ? 'text-white' : 'text-slate-500'}`}>
                    Operation Size
                  </span>
                </div>
                <div className="w-12 h-[2px] bg-slate-800" />
                <div className="flex items-center gap-3">
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${step >= 3 ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
                    3
                  </span>
                  <span className={`text-xs font-semibold hidden sm:inline ${step >= 3 ? 'text-white' : 'text-slate-500'}`}>
                    Pain Points
                  </span>
                </div>
              </div>

              {errorMessage && (
                <div className="mb-6 p-4 rounded-2xl bg-red-950/40 border border-red-500/40 text-red-300 text-xs sm:text-sm flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* STEP 1: COMPANY & CONTACT */}
              {step === 1 && (
                <motion.form
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  onSubmit={handleNext}
                  className="space-y-5"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">Company Name *</label>
                      <div className="relative">
                        <Building className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                        <input
                          type="text"
                          required
                          value={formData.companyName}
                          onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                          placeholder="e.g. Apex Plumbing & Heating"
                          className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-900/90 border border-slate-700 text-white placeholder:text-slate-600 text-sm focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">Your Name *</label>
                      <div className="relative">
                        <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                        <input
                          type="text"
                          required
                          value={formData.contactName}
                          onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                          placeholder="e.g. John Miller"
                          className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-900/90 border border-slate-700 text-white placeholder:text-slate-600 text-sm focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">Business Email *</label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                        <input
                          type="email"
                          required
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          placeholder="john@apexplumbing.com"
                          className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-900/90 border border-slate-700 text-white placeholder:text-slate-600 text-sm focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">Phone Number *</label>
                      <div className="relative">
                        <Phone className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                        <input
                          type="tel"
                          required
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          placeholder="(555) 019-2834"
                          className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-900/90 border border-slate-700 text-white placeholder:text-slate-600 text-sm focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">City *</label>
                      <div className="relative">
                        <MapPin className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                        <input
                          type="text"
                          required
                          value={formData.city}
                          onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                          placeholder="e.g. Calgary"
                          className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-900/90 border border-slate-700 text-white placeholder:text-slate-600 text-sm focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">Province / State *</label>
                      <input
                        type="text"
                        required
                        value={formData.province}
                        onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                        placeholder="e.g. Alberta / AB"
                        className="w-full px-4 py-3 rounded-xl bg-slate-900/90 border border-slate-700 text-white placeholder:text-slate-600 text-sm focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Website (Optional)</label>
                    <div className="relative">
                      <Globe className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                      <input
                        type="text"
                        value={formData.website}
                        onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                        placeholder="https://yourplumbingcompany.com"
                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-900/90 border border-slate-700 text-white placeholder:text-slate-600 text-sm focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 outline-none"
                      />
                    </div>
                  </div>

                  <div className="pt-4">
                    <button
                      type="submit"
                      className="w-full inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-blue-600 via-cyan-500 to-cyan-400 text-slate-950 font-bold text-base shadow-[0_0_25px_rgba(0,229,255,0.4)] hover:shadow-[0_0_35px_rgba(0,229,255,0.6)] transition-all"
                    >
                      <span>Continue to Step 2: Fleet Size</span>
                      <ArrowRight className="w-5 h-5" />
                    </button>
                  </div>
                </motion.form>
              )}

              {/* STEP 2: OPERATION SIZE */}
              {step === 2 && (
                <motion.form
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  onSubmit={handleNext}
                  className="space-y-6"
                >
                  <div>
                    <h3 className="text-lg font-bold text-white mb-2">How big is your plumbing operation?</h3>
                    <p className="text-xs text-slate-400 mb-6">Select the option that best reflects your current fleet and technicians in the field.</p>

                    <div className="space-y-3">
                      {TECH_COUNT_OPTIONS.map((opt) => (
                        <label
                          key={opt}
                          onClick={() => setFormData({ ...formData, technicianCount: opt })}
                          className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all ${
                            formData.technicianCount === opt
                              ? 'bg-cyan-950/40 border-cyan-400 shadow-[0_0_20px_rgba(0,229,255,0.2)]'
                              : 'bg-slate-900/50 hover:bg-slate-800/50 border-slate-800 text-slate-300'
                          }`}
                        >
                          <span className={`text-sm font-semibold ${formData.technicianCount === opt ? 'text-white' : 'text-slate-300'}`}>
                            {opt}
                          </span>
                          <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${formData.technicianCount === opt ? 'border-cyan-400 bg-cyan-400 text-slate-950' : 'border-slate-700'}`}>
                            {formData.technicianCount === opt && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="px-6 py-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm transition-all"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      className="flex-1 inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-blue-600 via-cyan-500 to-cyan-400 text-slate-950 font-bold text-base shadow-[0_0_25px_rgba(0,229,255,0.4)] hover:shadow-[0_0_35px_rgba(0,229,255,0.6)] transition-all"
                    >
                      <span>Continue to Step 3: Pain Points</span>
                      <ArrowRight className="w-5 h-5" />
                    </button>
                  </div>
                </motion.form>
              )}

              {/* STEP 3: PAIN POINTS & SUBMIT */}
              {step === 3 && (
                <motion.form
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  onSubmit={handleSubmit}
                  className="space-y-6"
                >
                  <div>
                    <h3 className="text-lg font-bold text-white mb-2">What is currently causing the most headaches?</h3>
                    <p className="text-xs text-slate-400 mb-6">Select all areas where your operation loses time or money.</p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {PAIN_POINTS_OPTIONS.map((pain) => {
                        const isSelected = formData.painPoints.includes(pain);
                        return (
                          <div
                            key={pain}
                            onClick={() => handlePainPointToggle(pain)}
                            className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                              isSelected
                                ? 'bg-cyan-950/40 border-cyan-400 text-white'
                                : 'bg-slate-900/50 hover:bg-slate-800/50 border-slate-800 text-slate-300'
                            }`}
                          >
                            <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${isSelected ? 'bg-cyan-400 border-cyan-400 text-slate-950' : 'border-slate-700'}`}>
                              {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>
                            <span className="text-xs font-medium">{pain}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-4 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      disabled={loading}
                      className="px-6 py-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm transition-all"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl bg-gradient-to-r from-blue-600 via-cyan-500 to-cyan-400 text-slate-950 font-extrabold text-base shadow-[0_0_35px_rgba(0,229,255,0.5)] hover:shadow-[0_0_50px_rgba(0,229,255,0.8)] transition-all disabled:opacity-50"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>Submitting Application...</span>
                        </>
                      ) : (
                        <>
                          <span>Apply for the Founding Pilot</span>
                          <ArrowRight className="w-5 h-5" />
                        </>
                      )}
                    </button>
                  </div>

                  <div className="text-center text-xs text-slate-400 pt-2">
                    $199/month • First 3 companies only • High-touch founder onboarding & direct support
                  </div>
                </motion.form>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
