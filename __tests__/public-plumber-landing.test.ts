import { describe, it, expect } from 'vitest';
import { DEFAULT_SERVICES } from '@/lib/constants';
import * as fs from 'fs';
import * as path from 'path';

describe('Public Marketing & Homepage Landing Security & Route Validity Matrix', () => {
  it('No homepage component contains links to /services or /services/:slug', () => {
    const servicesGridPath = path.join(process.cwd(), 'src', 'components', 'home', 'ServicesGrid.tsx');
    const content = fs.readFileSync(servicesGridPath, 'utf-8');

    expect(content).not.toMatch(/\/services\//);
    expect(content).not.toMatch(/href=["']\/services["']/);
    expect(content).not.toMatch(/href=\{`\/services/);
  });

  it('No layout navigation contains dead /services links', () => {
    const headerPath = path.join(process.cwd(), 'src', 'components', 'layout', 'Header.tsx');
    const footerPath = path.join(process.cwd(), 'src', 'components', 'layout', 'Footer.tsx');
    
    const headerContent = fs.readFileSync(headerPath, 'utf-8');
    const footerContent = fs.readFileSync(footerPath, 'utf-8');

    expect(headerContent).not.toMatch(/href=["']\/services["']/);
    expect(footerContent).not.toMatch(/\/services\//);
    expect(footerContent).not.toMatch(/href=["']\/services["']/);
  });

  it('All homepage CTAs point to valid existing routes (/book or anchor)', () => {
    const servicesGridPath = path.join(process.cwd(), 'src', 'components', 'home', 'ServicesGrid.tsx');
    const content = fs.readFileSync(servicesGridPath, 'utf-8');

    // Matches href attributes in ServicesGrid
    const hrefMatches = Array.from(content.matchAll(/href=["']([^"']+)["']/g)).map(m => m[1]);
    expect(hrefMatches.length).toBeGreaterThan(0);

    for (const href of hrefMatches) {
      // Must be /book, /, or anchor #
      expect(href === '/book' || href === '/' || href.startsWith('#')).toBe(true);
    }
  });

  it('Global homepage relies exclusively on DEFAULT_SERVICES without leaking tenant-specific custom services', () => {
    expect(DEFAULT_SERVICES).toBeDefined();
    expect(DEFAULT_SERVICES.length).toBeGreaterThanOrEqual(6);

    for (const s of DEFAULT_SERVICES) {
      expect(s.slug).toBeDefined();
      expect(s.name).toBeDefined();
      expect(s.description).toBeDefined();
      // Verify no organizationId attached to platform default services
      expect((s as any).organizationId).toBeUndefined();
    }
  });
});
