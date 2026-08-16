import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Phone, Clock, MapPin, Wrench, Shield, CheckCircle, ArrowRight, User } from 'lucide-react';
import { Metadata } from 'next';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const org = await prisma.organization.findUnique({
    where: { slug, isActive: true },
    select: { name: true, city: true, province: true },
  });

  if (!org) return { title: 'Plumbing Services' };

  return {
    title: `${org.name} | Expert Plumbing in ${org.city || 'Your Area'}`,
    description: `Professional plumbing and emergency service by ${org.name}. Book online today.`,
  };
}

export default async function PublicPlumberLandingPage({ params }: Props) {
  const { slug } = await params;

  const org = await prisma.organization.findUnique({
    where: { slug, isActive: true },
    include: {
      services: {
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      },
      serviceAreas: {
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      },
      businessHours: {
        orderBy: { dayOfWeek: 'asc' },
      },
      reviews: {
        where: { isPublished: true },
        take: 3,
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!org) {
    notFound();
  }

  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-cyan-500 selection:text-white">
      {/* Top Notification / Emergency Bar */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 border-b border-white/10 px-4 py-2 text-xs md:text-sm text-slate-300">
        <div className="max-w-6xl mx-auto flex flex-wrap justify-between items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Serving {org.city ? `${org.city}, ${org.province || 'MB'}` : 'Local Service Areas'}</span>
          </div>
          <div className="flex items-center gap-4">
            {org.emergencyPhone && (
              <a href={`tel:${org.emergencyPhone}`} className="text-amber-300 font-semibold hover:underline flex items-center gap-1">
                24/7 Emergency: {org.emergencyPhone}
              </a>
            )}
            <Link href={`/p/${slug}/login`} className="hover:text-white flex items-center gap-1 text-slate-400">
              <User className="w-3.5 h-3.5" /> Customer Portal
            </Link>
          </div>
        </div>
      </div>

      {/* Main Header / Nav */}
      <header className="border-b border-white/10 bg-slate-900/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {org.logoUrl ? (
              <img src={org.logoUrl} alt={org.name} className="h-10 w-auto rounded object-contain" />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center font-bold text-white text-lg shadow-lg shadow-cyan-500/20">
                {org.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="font-bold text-lg md:text-xl text-white tracking-tight leading-none">{org.name}</h1>
              <p className="text-xs text-slate-400 mt-0.5">Licensed & Insured Plumbing</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {org.phone && (
              <a
                href={`tel:${org.phone}`}
                className="hidden sm:flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-300 hover:text-white bg-slate-800/80 rounded-lg border border-slate-700 transition"
              >
                <Phone className="w-4 h-4 text-cyan-400" />
                {org.phone}
              </a>
            )}
            <Link
              href={`/p/${slug}/book`}
              className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-sm font-semibold rounded-lg shadow-md shadow-cyan-500/25 transition-all duration-150 flex items-center gap-1.5"
            >
              Book Service <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-16 pb-20 md:pt-24 md:pb-28 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-cyan-500/10 blur-[140px] rounded-full pointer-events-none -z-10"></div>
        <div className="max-w-5xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-medium mb-6">
            <Shield className="w-3.5 h-3.5" /> Verified Local Master Plumbers
          </div>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white max-w-3xl mx-auto leading-tight">
            Fast, Reliable Plumbing Solutions for <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">{org.name}</span> Customers
          </h2>
          <p className="mt-6 text-base sm:text-lg text-slate-400 max-w-2xl mx-auto">
            From emergency repairs to scheduled installations, our certified technicians are dispatched quickly with up-front pricing and real-time tracking.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href={`/p/${slug}/book`}
              className="w-full sm:w-auto px-8 py-4 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl shadow-lg shadow-cyan-500/30 transition-all text-base flex items-center justify-center gap-2"
            >
              <Wrench className="w-5 h-5" /> Request an Appointment
            </Link>
            {org.phone && (
              <a
                href={`tel:${org.phone}`}
                className="w-full sm:w-auto px-8 py-4 bg-slate-900/90 hover:bg-slate-850 text-white font-semibold rounded-xl border border-slate-700/80 transition-all text-base flex items-center justify-center gap-2"
              >
                <Phone className="w-5 h-5 text-cyan-400" /> Call {org.phone}
              </a>
            )}
          </div>

          <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 text-left max-w-4xl mx-auto pt-8 border-t border-white/5">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-cyan-400 shrink-0" />
              <span className="text-xs sm:text-sm text-slate-300">Upfront Estimates</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-cyan-400 shrink-0" />
              <span className="text-xs sm:text-sm text-slate-300">Real-Time Dispatch ETA</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-cyan-400 shrink-0" />
              <span className="text-xs sm:text-sm text-slate-300">Digital Invoicing & Pay</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-cyan-400 shrink-0" />
              <span className="text-xs sm:text-sm text-slate-300">Customer History Portal</span>
            </div>
          </div>
        </div>
      </section>

      {/* Services Grid */}
      <section className="py-16 bg-slate-900/40 border-y border-white/5">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h3 className="text-xs uppercase tracking-widest text-cyan-400 font-bold">Our Services</h3>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mt-2">Comprehensive Plumbing Care</h2>
            <p className="text-sm text-slate-400 mt-2">Select a service to book directly with {org.name}.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {org.services.length === 0 ? (
              <div className="col-span-full text-center py-12 text-slate-500 text-sm">
                General plumbing services available. Click below to book an inspection.
              </div>
            ) : (
              org.services.map((s) => (
                <div
                  key={s.id}
                  className="bg-slate-900/80 border border-slate-800 hover:border-cyan-500/40 rounded-2xl p-6 transition-all duration-200 flex flex-col justify-between group shadow-md"
                >
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-12 h-12 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center font-bold group-hover:bg-cyan-500/20 transition">
                        <Wrench className="w-6 h-6" />
                      </div>
                      {s.isEmergency && (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          Emergency
                        </span>
                      )}
                    </div>
                    <h4 className="text-lg font-bold text-white group-hover:text-cyan-300 transition">{s.name}</h4>
                    <p className="text-sm text-slate-400 mt-2 line-clamp-3">
                      {s.description || s.shortDescription || 'Professional diagnosis, repairs, and complete installation.'}
                    </p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between">
                    <div className="text-xs text-slate-500">
                      {s.basePrice ? `From $${s.basePrice.toFixed(0)}` : 'Custom Quote'}
                      {s.estimatedDuration && ` • ~${s.estimatedDuration} mins`}
                    </div>
                    <Link
                      href={`/p/${slug}/book?service=${s.id}`}
                      className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform"
                    >
                      Book <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Info: Areas & Hours */}
      <section className="py-16 max-w-6xl mx-auto px-4 grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Service Areas */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8">
          <div className="flex items-center gap-2.5 mb-4">
            <MapPin className="w-5 h-5 text-cyan-400" />
            <h3 className="text-lg font-bold text-white">Service Areas</h3>
          </div>
          <p className="text-sm text-slate-400 mb-4">
            We proudly provide on-site plumbing services across the following locations:
          </p>
          <div className="flex flex-wrap gap-2">
            {org.serviceAreas.length > 0 ? (
              org.serviceAreas.map((area) => (
                <span
                  key={area.id}
                  className="px-3 py-1 bg-slate-800 text-slate-200 text-xs font-medium rounded-lg border border-slate-700/60"
                >
                  {area.name}
                </span>
              ))
            ) : (
              <span className="text-xs text-slate-400">{org.city || 'Metropolitan Area'}, {org.province || 'MB'}</span>
            )}
          </div>
        </div>

        {/* Business Hours */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8">
          <div className="flex items-center gap-2.5 mb-4">
            <Clock className="w-5 h-5 text-cyan-400" />
            <h3 className="text-lg font-bold text-white">Business Hours</h3>
          </div>
          <div className="space-y-2">
            {org.businessHours.length > 0 ? (
              org.businessHours.map((bh) => (
                <div key={bh.id} className="flex justify-between text-sm py-1 border-b border-slate-800/60 last:border-0">
                  <span className="text-slate-400">{daysOfWeek[bh.dayOfWeek]}</span>
                  <span className="text-slate-200 font-medium">
                    {bh.isClosed ? 'Closed' : `${bh.openTime} - ${bh.closeTime}`}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-sm text-slate-400">
                <p>Monday – Friday: 08:00 AM – 05:00 PM</p>
                <p className="text-cyan-400 mt-1">24/7 Emergency Dispatch Available</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-slate-950 py-12 text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="text-slate-400 font-medium">{org.name} © {new Date().getFullYear()}</p>
            <p className="mt-1">Powered by AquaFlow Platform</p>
          </div>
          <div className="flex items-center gap-6">
            <Link href={`/p/${slug}/book`} className="hover:text-cyan-400 transition">Request Service</Link>
            <Link href={`/p/${slug}/login`} className="hover:text-cyan-400 transition">Customer Login</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
