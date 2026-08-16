import Stripe from 'stripe';

const isProduction = process.env.NODE_ENV === 'production';
const stripeKey = process.env.STRIPE_SECRET_KEY;

if (isProduction && (!stripeKey || stripeKey.includes('mock'))) {
  throw new Error('STRIPE_SECRET_KEY must be configured with a valid live or test mode key in production.');
}

export const stripe = new Stripe(stripeKey || 'sk_test_dev_placeholder_key', {
  apiVersion: '2024-06-20' as any,
  appInfo: {
    name: 'AquaFlow Plumbing',
    url: 'https://aquaflowplumbing.com',
  },
});
