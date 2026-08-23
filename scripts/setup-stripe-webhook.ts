import 'dotenv/config';
import fs from 'fs';
import { stripe } from '../src/lib/stripe';

async function setupWebhook() {
  console.log('\n======================================================');
  console.log('⚡ AUTOMATED STRIPE WEBHOOK PROVISIONING ENGINE');
  console.log('======================================================\n');

  const endpointUrl = 'https://aquaflow-plumbing-theta.vercel.app/api/webhooks/stripe';

  try {
    console.log(`📡 1. Checking existing webhooks for: ${endpointUrl}`);
    const existingEndpoints = await stripe.webhookEndpoints.list({ limit: 20 });
    const existing = existingEndpoints.data.find((e) => e.url === endpointUrl && e.status === 'enabled');

    let signingSecret = '';

    if (existing) {
      console.log(`✅ Found existing active webhook endpoint (ID: ${existing.id})`);
      if (existing.secret) {
        signingSecret = existing.secret;
      } else {
        console.log('   Generating new secret or creating fresh endpoint...');
      }
    }

    if (!signingSecret) {
      console.log('🚀 2. Creating new automated Stripe Webhook endpoint via API...');
      const created = await stripe.webhookEndpoints.create({
        url: endpointUrl,
        enabled_events: [
          'checkout.session.completed',
          'customer.subscription.updated',
          'customer.subscription.deleted',
          'payment_intent.succeeded',
          'payment_intent.payment_failed',
        ],
        description: 'AquaFlow Production & Pilot Automated Webhook',
      });

      console.log(`✅ Webhook Endpoint Created Successfully in Stripe! (ID: ${created.id})`);
      signingSecret = created.secret || '';
    }

    if (signingSecret) {
      console.log('\n------------------------------------------------------');
      console.log('🎉 YOUR STRIPE_WEBHOOK_SECRET HAS BEEN GENERATED:');
      console.log(`   ${signingSecret}`);
      console.log('------------------------------------------------------\n');

      // Update .env file automatically
      if (fs.existsSync('.env')) {
        let envContent = fs.readFileSync('.env', 'utf8');
        if (envContent.includes('STRIPE_WEBHOOK_SECRET=')) {
          envContent = envContent.replace(/STRIPE_WEBHOOK_SECRET=.*/g, `STRIPE_WEBHOOK_SECRET="${signingSecret}"`);
        } else {
          envContent += `\nSTRIPE_WEBHOOK_SECRET="${signingSecret}"\n`;
        }
        fs.writeFileSync('.env', envContent, 'utf8');
        console.log('💾 Automatically saved STRIPE_WEBHOOK_SECRET to your local .env file!');
      }

      console.log('\n📋 Next: Add this to Vercel Environment Variables:');
      console.log(`   STRIPE_WEBHOOK_SECRET = ${signingSecret}`);
    } else {
      console.log('⚠️ Webhook created, but signing secret must be viewed in Stripe dashboard.');
    }

    console.log('\n======================================================');
    console.log('✅ WEBHOOK PROVISIONING COMPLETE');
    console.log('======================================================\n');
  } catch (error: any) {
    console.error('❌ Error configuring Stripe Webhook:', error?.message || error);
    if (error?.message?.includes('Invalid API Key')) {
      console.log('\n👉 Please paste your real Stripe Secret Key (sk_test_... or sk_live_...) into .env first, then re-run!');
    }
  }
}

setupWebhook();
