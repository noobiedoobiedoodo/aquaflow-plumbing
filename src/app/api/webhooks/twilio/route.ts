import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import twilio from 'twilio';
import { headers } from 'next/headers';

const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const NEXT_PUBLIC_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

export async function POST(req: Request) {
  try {
    const textData = await req.text();
    const params = new URLSearchParams(textData);
    const headerPayload = await headers();

    // 1. Verify cryptographic signature
    if (TWILIO_AUTH_TOKEN) {
      const twilioSignature = headerPayload.get('x-twilio-signature');
      
      if (!twilioSignature) {
        return new NextResponse('Missing twilio signature', { status: 401 });
      }

      // Reconstruct params as an object for twilio validator
      const paramsObject: Record<string, string> = {};
      params.forEach((value, key) => {
        paramsObject[key] = value;
      });

      const url = `${NEXT_PUBLIC_BASE_URL}/api/webhooks/twilio`;

      const isValid = twilio.validateRequest(TWILIO_AUTH_TOKEN, twilioSignature, url, paramsObject);

      if (!isValid) {
        return new NextResponse('Invalid signature', { status: 401 });
      }
    }

    const MessageSid = params.get('MessageSid');
    const MessageStatus = params.get('MessageStatus');

    if (!MessageSid) {
      return NextResponse.json({ received: true });
    }

    let newStatus = null;
    if (MessageStatus === 'delivered') {
      newStatus = 'DELIVERED';
    } else if (MessageStatus === 'undelivered' || MessageStatus === 'failed') {
      newStatus = 'FAILED';
    } else if (MessageStatus === 'sent') {
      newStatus = 'SENT';
    }

    if (newStatus) {
      await prisma.notification.updateMany({
        where: { providerId: MessageSid },
        data: { 
          status: newStatus,
          ...(newStatus === 'FAILED' ? { failureReason: 'Twilio reported undelivered/failed status' } : {})
        }
      });
    }

    // Twilio expects XML response for TwiML, but for status callbacks a 200 OK empty or small response is fine.
    return new NextResponse('<Response></Response>', {
      headers: { 'Content-Type': 'text/xml' }
    });
  } catch (error) {
    console.error('Twilio Webhook Error:', error);
    return new NextResponse('<Response></Response>', {
      headers: { 'Content-Type': 'text/xml' }
    });
  }
}
