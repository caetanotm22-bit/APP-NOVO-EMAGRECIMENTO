// api/create-checkout-session.js
// Vercel Serverless Function — Stripe Live Mode
// As chaves ficam nas Environment Variables do Vercel (Settings > Env Vars)
const Stripe = require('stripe');

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  // Valida que as variáveis de ambiente estão configuradas
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_PRICE_ID) {
    console.error('[Config] Variáveis de ambiente STRIPE_SECRET_KEY ou STRIPE_PRICE_ID não definidas');
    return res.status(500).json({ error: 'Configuração do servidor incompleta. Contate o suporte.' });
  }

  const BASE_URL  = process.env.NEXT_PUBLIC_URL || 'https://app-novo-emagrecimento.vercel.app';
  // price_1TQx1iDGidYUEaas2RwQxbYb = preço recorrente mensal A$29 AUD (criado via API)
  const PRICE_ID  = process.env.STRIPE_PRICE_ID || 'price_1TQx1iDGidYUEaas2RwQxbYb';

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: PRICE_ID, quantity: 1 }],
      subscription_data: { trial_period_days: 14 },
      allow_promotion_codes: false,
      billing_address_collection: 'auto',
      success_url: `${BASE_URL}/sucesso.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${BASE_URL}/#precos`,
    });

    return res.status(200).json({ sessionId: session.id, url: session.url });

  } catch (err) {
    console.error('[Stripe Error]', err.message);
    return res.status(500).json({ error: err.message });
  }
};
