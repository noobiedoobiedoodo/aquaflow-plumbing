function normalizeUrl(url: string): string {
  let cleaned = url.trim().replace(/\/+$/, '');
  if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
    cleaned = `https://${cleaned}`;
  }
  return cleaned;
}

function isValidAbsoluteUrl(url: string): boolean {
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    return Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

/**
 * Returns the canonical base URL for server-side execution.
 * Handles incoming request headers (x-forwarded-host / host),
 * Vercel environment variables, custom domains, and safe production fallbacks.
 * Guaranteed never to produce localhost in production runtime.
 */
export async function getServerBaseUrl(): Promise<string> {
  // 1. Check incoming request headers first (dynamically resolves exact custom domain or preview URL)
  if (typeof window === 'undefined') {
    try {
      const { headers } = await import('next/headers');
      const headersList = await headers();
      const host = headersList.get('x-forwarded-host') || headersList.get('host');
      if (host) {
        const isLocal = host.includes('localhost') || host.includes('127.0.0.1');
        const proto = headersList.get('x-forwarded-proto') || (isLocal ? 'http' : 'https');
        return `${proto}://${host}`;
      }
    } catch {
      // Headers are unavailable when called outside a Next.js request lifecycle
    }
  }

  // 2. Explicit environment variable (if non-local or in dev)
  const explicitUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.APP_URL;

  if (explicitUrl && isValidAbsoluteUrl(explicitUrl)) {
    const isLocal = explicitUrl.includes('localhost') || explicitUrl.includes('127.0.0.1');
    if (process.env.NODE_ENV !== 'production' || !isLocal) {
      return normalizeUrl(explicitUrl);
    }
  }

  // 3. Vercel Canonical Production Domain (e.g. aquaflow-plumbing-theta.vercel.app)
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }

  // 4. Vercel Current Deployment URL (e.g. preview deployment)
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  // 5. Production Failsafe (Guaranteed no localhost in production)
  if (process.env.NODE_ENV === 'production') {
    return 'https://aquaflow-plumbing-theta.vercel.app';
  }

  return 'http://localhost:3000';
}

/**
 * Synchronous / Client-safe base URL resolver.
 */
export function getBaseUrl(): string {
  // 1. Browser runtime
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }

  // 2. Explicit environment variable
  const explicitUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.APP_URL;

  if (explicitUrl && isValidAbsoluteUrl(explicitUrl)) {
    const isLocal = explicitUrl.includes('localhost') || explicitUrl.includes('127.0.0.1');
    if (process.env.NODE_ENV !== 'production' || !isLocal) {
      return normalizeUrl(explicitUrl);
    }
  }

  // 3. Vercel Canonical Production Domain
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }

  // 4. Vercel Current Deployment URL
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  // 5. Production Failsafe
  if (process.env.NODE_ENV === 'production') {
    return 'https://aquaflow-plumbing-theta.vercel.app';
  }

  return 'http://localhost:3000';
}

/**
 * Helper to generate absolute URLs on the server.
 */
export async function getAbsoluteServerUrl(path: string): Promise<string> {
  const base = await getServerBaseUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
}

/**
 * Helper to generate absolute URLs synchronously / client-side.
 */
export function getAbsoluteUrl(path: string): string {
  const base = getBaseUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
}
