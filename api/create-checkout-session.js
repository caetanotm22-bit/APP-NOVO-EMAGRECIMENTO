// api/create-checkout-session.js — Stripe Checkout (Live Mode)
const Stripe = require('stripe');

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_PRICE_ID) {
    console.error('[Config] Missing STRIPE_SECRET_KEY or STRIPE_PRICE_ID env vars');
    return res.status(500).json({ error: 'Server configuration error. Please contact support.' });
  }

  const BASE_URL = process.env.NEXT_PUBLIC_URL || 'https://app-novo-emagrecimento.vercel.app';
  // price_1TQx1iDGidYUEaas2RwQxbYb = recurring monthly A$29 AUD
  const PRICE_ID = process.env.STRIPE_PRICE_ID || 'price_1TQx1iDGidYUEaas2RwQxbYb';

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      locale: 'en',                          // ← Force English always
      payment_method_types: ['card'],
      line_items: [{ price: PRICE_ID, quantity: 1 }],
      subscription_data: { trial_period_days: 14 },
      allow_promotion_codes: false,
      billing_address_collection: 'auto',
      success_url: `${BASE_URL}/sucesso.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${BASE_URL}/#pricing`,   // ← Fixed: was #precos
    });

    return res.status(200).json({ sessionId: session.id, url: session.url });

  } catch (err) {
    console.error('[Stripe Error]', err.message);
    return res.status(500).json({ error: err.message });
  }
};
