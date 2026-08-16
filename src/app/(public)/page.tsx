import { Hero } from '@/components/home/Hero';
import { ServicesGrid } from '@/components/home/ServicesGrid';
import { Testimonials } from '@/components/home/Testimonials';
import { ServiceAreas } from '@/components/home/ServiceAreas';

export const metadata = {
  title: 'AquaFlow Plumbing | Next-Generation Plumbing Solutions',
  description: 'Premium plumbing solutions for residential and commercial properties. Advanced technology meets expert craftsmanship.',
};

export default function HomePage() {
  return (
    <>
      <Hero />
      <ServicesGrid />
      <Testimonials />
      <ServiceAreas />
    </>
  );
}
