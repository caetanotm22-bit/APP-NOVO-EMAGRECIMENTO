// api/webhook.js
// Vercel Serverless Function — recebe eventos do Stripe via webhook
const Stripe = require('stripe');

// Desabilita o bodyParser padrão — Stripe precisa do raw body para validar assinatura
export const config = {
  api: { bodyParser: false },
};

// Lê o body raw da requisição
async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
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

  // ─── Trata os eventos ────────────────────────────────────────────
  switch (event.type) {

    case 'checkout.session.completed': {
      const session = event.data.object;
      console.log('✅ Novo assinante:', session.customer_email);
      console.log('   Customer ID:', session.customer);
      console.log('   Subscription ID:', session.subscription);
      // TODO: salvar no banco de dados e liberar acesso ao app
      break;
    }

    case 'invoice.paid': {
      const invoice = event.data.object;
      console.log('💰 Pagamento recebido:', invoice.customer_email, '- R$', invoice.amount_paid / 100);
      // TODO: renovar acesso mensal
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      console.log('❌ Pagamento falhou:', invoice.customer_email);
      // TODO: enviar email avisando e suspender acesso
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object;
      console.log('🚫 Assinatura cancelada:', sub.customer);
      // TODO: revogar acesso ao app
      break;
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object;
      console.log('🔄 Assinatura atualizada:', sub.customer, '- Status:', sub.status);
      break;
    }

    default:
      console.log('Evento não tratado:', event.type);
  }

  return res.status(200).json({ received: true });
};
