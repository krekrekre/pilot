import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY && process.env.NODE_ENV === 'production') {
  throw new Error('STRIPE_SECRET_KEY is required in production');
}

export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

export const PLANS = {
  monthly: {
    name: 'Pro Monthly',
    priceId: process.env.STRIPE_PRICE_MONTHLY || '',
    amount: 999,
    interval: 'month' as const,
  },
  annual: {
    name: 'Pro Annual',
    priceId: process.env.STRIPE_PRICE_ANNUAL || '',
    amount: 7999,
    interval: 'year' as const,
  },
};
