import { NextRequest, NextResponse } from 'next/server';

export interface SimulatedResponse {
  status: number;
  headers: Record<string, string>;
  body: any;
  latencyMs: number;
}

export class SimulatedClient {
  private cookies: Map<string, string> = new Map();
  private ipAddress: string;
  private userAgent: string;

  constructor(ipAddress?: string, userAgent?: string) {
    this.ipAddress = ipAddress || `10.100.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
    this.userAgent = userAgent || 'AquaFlow-LoadTester/1.0 (Node.js Simulated Client)';
  }

  public setCookie(name: string, value: string) {
    this.cookies.set(name, value);
  }

  public getCookie(name: string): string | undefined {
    return this.cookies.get(name);
  }

  public clearCookies() {
    this.cookies.clear();
  }

  public getCookieHeader(): string {
    return Array.from(this.cookies.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }

  /**
   * Dispatches a simulated NextRequest to a route handler and captures cookies + timing.
   */
  public async dispatch(
    handler: (req: NextRequest, ctx?: any) => Promise<Response | NextResponse>,
    url: string,
    options: {
      method?: string;
      body?: any;
      headers?: Record<string, string>;
      params?: any;
    } = {}
  ): Promise<SimulatedResponse> {
    const method = options.method || 'GET';
    const headers = new Headers(options.headers || {});

    headers.set('x-forwarded-for', this.ipAddress);
    headers.set('user-agent', this.userAgent);

    const cookieStr = this.getCookieHeader();
    if (cookieStr) {
      headers.set('cookie', cookieStr);
    }

    let requestBody: any = undefined;
    if (options.body) {
      if (typeof options.body === 'string') {
        requestBody = options.body;
      } else {
        headers.set('content-type', 'application/json');
        requestBody = JSON.stringify(options.body);
      }
    }

    const nextReq = new NextRequest(url, {
      method,
      headers,
      body: requestBody,
    });

    const start = performance.now();
    let res: Response | NextResponse;
    try {
      res = await handler(nextReq, options.params ? { params: Promise.resolve(options.params) } : undefined);
    } catch (err: any) {
      const latencyMs = performance.now() - start;
      return {
        status: 500,
        headers: {},
        body: { error: err.message || 'Handler exception' },
        latencyMs,
      };
    }
    const latencyMs = performance.now() - start;

    // Extract set-cookie headers
    const setCookieHeaders = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    const singleSetCookie = res.headers.get('set-cookie');
    if (singleSetCookie && setCookieHeaders.length === 0) {
      setCookieHeaders.push(singleSetCookie);
    }

    for (const cookieItem of setCookieHeaders) {
      const match = cookieItem.match(/^([^=;]+)=([^;]*)/);
      if (match) {
        this.cookies.set(match[1].trim(), match[2].trim());
      }
    }

    const responseHeaders: Record<string, string> = {};
    res.headers.forEach((val, key) => {
      responseHeaders[key] = val;
    });

    let body: any = null;
    const contentType = res.headers.get('content-type') || '';
    try {
      if (contentType.includes('application/json')) {
        body = await res.json();
      } else {
        body = await res.text();
      }
    } catch {
      body = null;
    }

    return {
      status: res.status,
      headers: responseHeaders,
      body,
      latencyMs,
    };
  }
}
