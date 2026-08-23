import Stripe from 'stripe';

const stripeKey = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder_build_key';

export const stripe = new Stripe(stripeKey, {
  apiVersion: '2025-03-31.basil' as any,
  appInfo: {
    name: 'AquaFlow Plumbing',
    url: 'https://aquaflowplumbing.com',
  },
});
