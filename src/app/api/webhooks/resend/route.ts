import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { Webhook } from 'svix';
import { headers } from 'next/headers';

const RESEND_WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET;

export async function POST(req: Request) {
  try {
    const payloadString = await req.text();
    const headerPayload = await headers();
    
    // 1. Verify cryptographic signature
    if (RESEND_WEBHOOK_SECRET) {
      const svix_id = headerPayload.get("svix-id");
      const svix_timestamp = headerPayload.get("svix-timestamp");
      const svix_signature = headerPayload.get("svix-signature");

      if (!svix_id || !svix_timestamp || !svix_signature) {
        return new NextResponse('Missing svix headers', { status: 401 });
      }

      const wh = new Webhook(RESEND_WEBHOOK_SECRET);
      
      try {
        wh.verify(payloadString, {
          "svix-id": svix_id,
          "svix-timestamp": svix_timestamp,
          "svix-signature": svix_signature,
        });
      } catch (err) {
        return new NextResponse('Invalid signature', { status: 401 });
      }
    }

    const event = JSON.parse(payloadString);

    // Resend sends webhooks for delivery status
    // https://resend.com/docs/dashboard/webhooks/event-types
    const { type, data } = event;
    const providerId = data?.email_id;

    if (!providerId) {
      return NextResponse.json({ received: true });
    }

    let newStatus = null;
    if (type === 'email.delivered') {
      newStatus = 'DELIVERED';
    } else if (type === 'email.bounced' || type === 'email.complained') {
      newStatus = 'BOUNCED';
    } else if (type === 'email.delivery_delayed') {
      newStatus = 'PROCESSING';
    }

    if (newStatus) {
      await prisma.notification.updateMany({
        where: { providerId },
        data: { status: newStatus }
      });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Resend Webhook Error:', error);
    // Return 200 so Resend doesn't keep retrying if it's our internal parsing error
    return NextResponse.json({ received: true });
  }
}
