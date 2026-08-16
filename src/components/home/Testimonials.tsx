import { prisma } from '@/lib/db';
import { Star, Quote } from 'lucide-react';
import { AnimatedSection, AnimatedStagger, AnimatedItem } from '@/components/ui/animated-section';

export async function Testimonials() {
  const reviews = await prisma.review.findMany({
    where: { 
      isPublished: true,
      isFeatured: true 
    },
    orderBy: { createdAt: 'desc' },
    take: 3,
  });

  if (reviews.length === 0) return null;

  return (
    <section className="py-24 bg-secondary-bg relative overflow-hidden">
      <div className="container mx-auto px-4 relative z-10">
        <AnimatedSection className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-sm font-bold tracking-wider text-water-cyan uppercase mb-3">Client Success</h2>
          <h3 className="text-3xl md:text-5xl font-bold text-white mb-6">Trusted by Homeowners & Businesses</h3>
        </AnimatedSection>

        <AnimatedStagger className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {reviews.map((review) => (
            <AnimatedItem key={review.id}>
              <div className="glass rounded-2xl p-8 h-full flex flex-col relative">
                <Quote className="absolute top-6 right-6 w-12 h-12 text-white/5" />
                
                <div className="flex items-center gap-1 mb-6">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star 
                      key={i} 
                      className={`w-5 h-5 ${i < review.rating ? 'text-warning fill-warning' : 'text-border fill-transparent'}`} 
                    />
                  ))}
                </div>
                
                <p className="text-white text-lg leading-relaxed mb-8 flex-1 italic">
                  "{review.content}"
                </p>
                
                <div className="mt-auto">
                  <div className="font-bold text-white">{review.customerName}</div>
                  <div className="text-muted-text text-sm capitalize">Verified {review.source} Review</div>
                </div>
              </div>
            </AnimatedItem>
          ))}
        </AnimatedStagger>
      </div>
    </section>
  );
}
