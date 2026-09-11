import { Hero } from '@/components/home/Hero';
import { ServicesGrid } from '@/components/home/ServicesGrid';
import { Testimonials } from '@/components/home/Testimonials';
import { ServiceAreas } from '@/components/home/ServiceAreas';

export const metadata = {
  title: 'Services & Operations | FlowLoop OS',
  description: 'Comprehensive plumbing solutions and field dispatch capabilities powered by FlowLoop OS.',
};

export default function ServicesPage() {
  return (
    <>
      <Hero />
      <ServicesGrid />
      <Testimonials />
      <ServiceAreas />
    </>
  );
}
