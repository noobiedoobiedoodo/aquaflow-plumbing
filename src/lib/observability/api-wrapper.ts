import { NextResponse } from 'next/server';
import { Logger } from './logger';

type ApiHandler = (req: Request, ...args: any[]) => Promise<NextResponse>;

export function withErrorHandling(operationName: string, handler: ApiHandler): ApiHandler {
  return async (req: Request, ...args: any[]) => {
    const requestId = Logger.generateRequestId();
    const startTime = Date.now();
    
    try {
      const response = await handler(req, ...args);
      
      const durationMs = Date.now() - startTime;
      if (!response.ok && response.status >= 500) {
        Logger.error(`API Error in ${operationName}`, new Error(`Status ${response.status}`), {
          operation: operationName,
          requestId,
          durationMs,
          endpoint: req.url
        });
      }
      return response;
    } catch (error: any) {
      const durationMs = Date.now() - startTime;
      
      Logger.error(`Unhandled Exception in ${operationName}`, error, {
        operation: operationName,
        requestId,
        durationMs,
        endpoint: req.url
      });

      return NextResponse.json(
        { error: 'Internal Server Error', requestId },
        { status: 500 }
      );
    }
  };
}
