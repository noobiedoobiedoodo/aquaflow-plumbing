import { randomUUID } from 'crypto';

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'FATAL';

export interface LogEvent {
  level: LogLevel;
  message: string;
  requestId?: string;
  organizationId?: string;
  userId?: string;
  operation: string;
  endpoint?: string;
  durationMs?: number;
  errorCategory?: string;
  externalProvider?: string;
  metadata?: Record<string, any>;
  stack?: string;
}

const SENSITIVE_KEYS = new Set([
  'password', 'passwordhash', 'token', 'secret', 'key', 'stripesecret', 'creditcard', 'ssn',
  'apikey', 'authheader', 'authorization', 'cvv', 'magiclink', 'resend_api_key', 'twilio_auth_token',
  'session_secret', 'webhook_secret', 'privatekey', 'bearer'
]);

export class Logger {
  
  /**
   * Generates a correlation ID for tracking requests across boundaries
   */
  static generateRequestId(): string {
    return randomUUID();
  }

  /**
   * Filters sensitive data from metadata objects recursively
   */
  private static filterSecrets(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(this.filterSecrets.bind(this));
    
    const sanitized = { ...obj };
    for (const key of Object.keys(sanitized)) {
      if (SENSITIVE_KEYS.has(key.toLowerCase()) || key.toLowerCase().includes('password') || key.toLowerCase().includes('secret')) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof sanitized[key] === 'object') {
        sanitized[key] = this.filterSecrets(sanitized[key]);
      }
    }
    return sanitized;
  }

  static log(event: LogEvent) {
    const timestamp = new Date().toISOString();
    const sanitizedMetadata = event.metadata ? this.filterSecrets(event.metadata) : undefined;
    
    const structuredLog = {
      timestamp,
      ...event,
      metadata: sanitizedMetadata
    };

    // In production, this would ship to Datadog, Sentry, or CloudWatch
    // For now, we write to stdout for Docker/PM2 to capture
    const logString = JSON.stringify(structuredLog);
    
    if (event.level === 'ERROR' || event.level === 'FATAL') {
      console.error(logString);
    } else if (event.level === 'WARN') {
      console.warn(logString);
    } else {
      console.info(logString);
    }
  }

  static info(message: string, context: Omit<LogEvent, 'level' | 'message'>) {
    this.log({ level: 'INFO', message, ...context });
  }

  static warn(message: string, context: Omit<LogEvent, 'level' | 'message'>) {
    this.log({ level: 'WARN', message, ...context });
  }

  static error(message: string, error: Error | any, context: Omit<LogEvent, 'level' | 'message'>) {
    this.log({ 
      level: 'ERROR', 
      message, 
      stack: error instanceof Error ? error.stack : undefined,
      errorCategory: error?.name || 'UnknownError',
      ...context 
    });
  }
}
