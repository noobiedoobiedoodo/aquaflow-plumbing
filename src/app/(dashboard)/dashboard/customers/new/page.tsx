'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, UserPlus, Shield, Loader2 } from 'lucide-react';
import { createCustomerManually } from '@/app/actions/customers';

export default function NewCustomerPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const result = await createCustomerManually(formData);

    setIsSubmitting(false);

    if (!result.success) {
      setError(result.error || 'Failed to create customer');
    } else {
      router.push(`/dashboard/customers/${result.customerId}`);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Link
          href="/dashboard/customers"
          className="inline-flex items-center gap-1.5 text-xs text-muted-text hover:text-white transition mb-4 font-medium"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Customers
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
          <UserPlus className="w-6 h-6 text-primary-blue" /> Add New Customer
        </h1>
        <p className="text-sm text-muted-text mt-1">
          Register a customer for phone-in bookings, estimates, and field dispatching.
        </p>
      </div>

      <div className="glass rounded-2xl border border-border/50 p-6 sm:p-8 shadow-xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs font-semibold">
              {error}
            </div>
          )}

          {/* Customer Personal Details */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-primary-blue mb-3">Customer Contact</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">First Name *</label>
                <input
                  type="text"
                  name="firstName"
                  required
                  placeholder="e.g. John"
                  className="w-full px-3.5 py-2.5 bg-secondary-bg border border-border rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-blue"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Last Name *</label>
                <input
                  type="text"
                  name="lastName"
                  required
                  placeholder="e.g. Smith"
                  className="w-full px-3.5 py-2.5 bg-secondary-bg border border-border rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-blue"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Email Address *</label>
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="john.smith@example.com"
                  className="w-full px-3.5 py-2.5 bg-secondary-bg border border-border rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-blue"
                />
                <p className="text-[11px] text-muted-text mt-1">If the email exists globally, their identity is securely linked to your organization.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Phone Number</label>
                <input
                  type="tel"
                  name="phone"
                  placeholder="(204) 555-0199"
                  className="w-full px-3.5 py-2.5 bg-secondary-bg border border-border rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-blue"
                />
              </div>
            </div>
          </div>

          {/* Primary Service Location */}
          <div className="pt-4 border-t border-border/40">
            <h3 className="text-xs font-bold uppercase tracking-wider text-primary-blue mb-3">Service Location Address</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Street Address *</label>
                <input
                  type="text"
                  name="address"
                  required
                  placeholder="123 Main Street"
                  className="w-full px-3.5 py-2.5 bg-secondary-bg border border-border rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-blue"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Unit / Suite / Apt</label>
                <input
                  type="text"
                  name="unit"
                  placeholder="Unit 4B"
                  className="w-full px-3.5 py-2.5 bg-secondary-bg border border-border rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-blue"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">City *</label>
                <input
                  type="text"
                  name="city"
                  required
                  defaultValue="Winnipeg"
                  className="w-full px-3.5 py-2.5 bg-secondary-bg border border-border rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-blue"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Province *</label>
                <input
                  type="text"
                  name="province"
                  required
                  defaultValue="MB"
                  className="w-full px-3.5 py-2.5 bg-secondary-bg border border-border rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-blue"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Postal Code *</label>
                <input
                  type="text"
                  name="postalCode"
                  required
                  placeholder="R3C 1A5"
                  className="w-full px-3.5 py-2.5 bg-secondary-bg border border-border rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-blue"
                />
              </div>
            </div>
          </div>

          {/* Internal Notes */}
          <div className="pt-4 border-t border-border/40">
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Internal Notes</label>
            <textarea
              name="notes"
              rows={3}
              placeholder="Private dispatcher notes (gate codes, customer preferences, past history)..."
              className="w-full px-3.5 py-2.5 bg-secondary-bg border border-border rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-blue"
            ></textarea>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <Link
              href="/dashboard/customers"
              className="px-4 py-2.5 text-xs font-semibold text-muted-text hover:text-white transition"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-primary-blue hover:bg-blue-600 text-white font-semibold rounded-xl text-sm shadow-md transition flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Saving Customer...
                </>
              ) : (
                'Create Customer'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
