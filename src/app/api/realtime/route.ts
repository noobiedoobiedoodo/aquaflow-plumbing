import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/session';
import { ADMIN_ROLES, Role } from '@/lib/constants';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireAuth();

    // 1. Determine and verify explicit organization authorization
    const requestedOrgId = req.nextUrl.searchParams.get('organizationId');

    const validMemberships = user.memberships.filter((m) =>
      ADMIN_ROLES.includes(m.role as Role)
    );

    if (validMemberships.length === 0) {
      return new Response('Unauthorized: Insufficient permissions for realtime events', {
        status: 403,
      });
    }

    let organizationId: string;

    if (requestedOrgId) {
      const match = validMemberships.find((m) => m.organizationId === requestedOrgId);
      if (!match) {
        return new Response('Forbidden: You are not authorized for this organization', {
          status: 403,
        });
      }
      organizationId = match.organizationId;
    } else {
      if (validMemberships.length > 1) {
        return new Response(
          'Ambiguous organization: You belong to multiple organizations, please specify ?organizationId=<id>',
          { status: 400 }
        );
      }
      organizationId = validMemberships[0].organizationId;
    }

    // 2. Set up SSE headers
    const headers = new Headers({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    let isClosed = false;
    let pollInterval: NodeJS.Timeout | null = null;

    const stream = new ReadableStream({
      start(controller) {
        const sendEvent = (data: Record<string, any>) => {
          if (isClosed) return;
          try {
            controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`));
          } catch {
            cleanup();
          }
        };

        const cleanup = () => {
          if (isClosed) return;
          isClosed = true;
          if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
          }
          try {
            controller.close();
          } catch {
            // Stream might already be closed
          }
        };

        sendEvent({ type: 'CONNECTED', organizationId });

        // Lightweight periodic check with proper cleanup
        pollInterval = setInterval(async () => {
          if (isClosed) {
            cleanup();
            return;
          }

          try {
            const recentTasks = await prisma.task.findMany({
              where: {
                createdAt: { gt: new Date(Date.now() - 10000) },
                organizationId,
              },
              take: 20,
              orderBy: { createdAt: 'desc' },
            });

            if (recentTasks.length > 0) {
              sendEvent({ type: 'NEW_TASKS', tasks: recentTasks });
            } else {
              sendEvent({ type: 'PING', time: new Date().toISOString() });
            }
          } catch {
            // Non-fatal error during polling
          }
        }, 10000);

        req.signal.addEventListener('abort', () => {
          cleanup();
        });
      },
      cancel() {
        if (pollInterval) {
          clearInterval(pollInterval);
          pollInterval = null;
        }
        isClosed = true;
      },
    });

    return new Response(stream, { headers });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return new Response('Unauthorized', { status: 401 });
    }
    return new Response('Internal Server Error', { status: 500 });
  }
}
