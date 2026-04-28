// api/webhook.js — Stripe Webhook + Facebook Conversions API (server-side)
// Server-side FB events bypass ad-blockers and are the most reliable signal
const Stripe = require('stripe');
const https = require('https');
const crypto = require('crypto');

// Disable default body parser — Stripe needs raw body to validate signature
export const config = {
  api: { bodyParser: false },
};

// Read raw body from request stream
async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// Hash email for Facebook Conversions API (required — must be SHA256 lowercase)
function hashEmail(email) {
  if (!email) return null;
  return crypto.createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
}

// Send event to Facebook Conversions API (server-side)
async function sendFBConversion({ eventName, email, value, currency, orderId }) {
  const pixelId = process.env.FB_PIXEL_ID;
  const accessToken = process.env.FB_ACCESS_TOKEN;
  if (!pixelId || !accessToken) return; // skip if env vars not set

  const eventData = {
    data: [
      {
        event_name: eventName,
        event_time: Math.floor(Date.now() / 1000),
        action_source: 'website',
        event_source_url: process.env.NEXT_PUBLIC_URL || 'https://app-novo-emagrecimento.vercel.app',
        user_data: {
          em: email ? [hashEmail(email)] : [],
        },
        ...(value !== undefined && {
          custom_data: {
            value: value,
            currency: currency || 'AUD',
            order_id: orderId || undefined,
          },
        }),
      },
    ],
    test_event_code: process.env.FB_TEST_EVENT_CODE || undefined, // remove in production
  };

  const body = JSON.stringify(eventData);

  return new Promise((resolve) => {
    const options = {
      hostname: 'graph.facebook.com',
      path: `/v19.0/${pixelId}/events?access_token=${accessToken}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      res.on('data', () => {});
      res.on('end', resolve);
    });
    req.on('error', (e) => console.error('[FB CAPI]', e.message));
    req.write(body);
    req.end();
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const sig = req.headers['stripe-signature'];
  const rawBody = await getRawBody(req);

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  // ── Handle Stripe events ─────────────────────────────────────────────────────
  switch (event.type) {

    case 'checkout.session.completed': {
      const session = event.data.object;
      const email = session.customer_details?.email || session.customer_email;
      const amountTotal = (session.amount_total || 2900) / 100;

      console.log('✅ New subscriber:', email);
      console.log('   Customer ID:', session.customer);
      console.log('   Subscription ID:', session.subscription);

      // Server-side FB Purchase event — fires even if browser pixel was blocked
      await sendFBConversion({
        eventName: 'Purchase',
        email,
        value: amountTotal,
        currency: session.currency?.toUpperCase() || 'AUD',
        orderId: session.id,
      });

      break;
    }

    case 'invoice.paid': {
      const invoice = event.data.object;
      const amountPaid = invoice.amount_paid / 100;
      const email = invoice.customer_email;
      const isFirstPayment = invoice.billing_reason === 'subscription_create';

      console.log(`💰 Payment received: ${email} — A$${amountPaid}`);

      // Only track recurring renewals (not trial conversions — those come from checkout.session.completed)
      if (!isFirstPayment) {
        await sendFBConversion({
          eventName: 'Subscribe',
          email,
          value: amountPaid,
          currency: invoice.currency?.toUpperCase() || 'AUD',
          orderId: invoice.id,
        });
      }
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      console.log('❌ Payment failed:', invoice.customer_email);
      // TODO: send recovery email (e.g. via Resend/Sendgrid) and suspend access
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object;
      console.log('🚫 Subscription cancelled:', sub.customer, '— Status:', sub.status);
      // TODO: revoke app access for this customer
      break;
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object;
      console.log('🔄 Subscription updated:', sub.customer, '— Status:', sub.status);
      break;
    }

    default:
      console.log('Unhandled event:', event.type);
  }

  return res.status(200).json({ received: true });
};
