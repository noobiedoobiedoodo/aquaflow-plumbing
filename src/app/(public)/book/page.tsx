import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';

export const metadata = {
  title: 'Book Service | AquaFlow Plumbing',
  description: 'Request a plumbing appointment or emergency service online.',
};

export default async function BookPage() {
  // Public booking requires tenant-scoped context (/p/[slug]/book).
  // Redirect to the first active organization if available, or to homepage.
  const defaultOrg = await prisma.organization.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { slug: true },
  });

  if (defaultOrg) {
    redirect(`/p/${defaultOrg.slug}/book`);
  }

  redirect('/');
}
