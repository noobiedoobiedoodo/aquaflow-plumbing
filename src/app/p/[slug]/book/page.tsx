import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import { BookingWizard } from '@/components/booking/BookingWizard';
import Link from 'next/link';
import { ArrowLeft, Shield } from 'lucide-react';
import { Metadata } from 'next';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const org = await prisma.organization.findUnique({
    where: { slug, isActive: true },
    select: { name: true, city: true },
  });

  if (!org) return { title: 'Book Service' };

  return {
    title: `Book Service | ${org.name}`,
    description: `Online service booking and emergency plumbing request with ${org.name}.`,
  };
}

export default async function PlumberBookingPage({ params }: Props) {
  const { slug } = await params;

  const org = await prisma.organization.findUnique({
    where: { slug, isActive: true },
    include: {
      services: {
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          name: true,
          shortDescription: true,
          icon: true,
          isEmergency: true,
        },
      },
    },
  });

  if (!org) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 relative overflow-hidden pt-8 pb-24">
      {/* Background ambient glow */}
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-cyan-500/5 rounded-full blur-[140px] -z-10 pointer-events-none"></div>

      <div className="container mx-auto px-4 max-w-4xl relative z-10">
        {/* Top Back Link & Plumber Branding */}
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/10">
          <Link
            href={`/p/${slug}`}
            className="text-xs font-semibold text-slate-400 hover:text-white flex items-center gap-1.5 transition"
          >
            <ArrowLeft className="w-4 h-4" /> Back to {org.name}
          </Link>
          <div className="text-right">
            <span className="text-sm font-bold text-white block">{org.name}</span>
            <span className="text-xs text-slate-400">Direct Dispatch</span>
          </div>
        </div>

        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-medium mb-3">
            <Shield className="w-3.5 h-3.5" /> Official Booking Portal
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">Request Service</h1>
          <p className="text-slate-400 text-sm md:text-base mt-2 max-w-lg mx-auto">
            Choose your service and time slot. Our dispatchers will schedule certified technicians for your location.
          </p>
        </div>

        <BookingWizard services={org.services} />
      </div>
    </div>
  );
}
