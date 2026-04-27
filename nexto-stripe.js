// nexto-stripe.js — Frontend Stripe Checkout
// Substitua pk_test_... pela sua chave PÚBLICA do Stripe (Developers > API Keys)
(function () {
  // ─── CONFIGURAÇÃO ──────────────────────────────────────────────
  // Esta chave pública é segura para ficar no frontend
  // Troque por pk_live_... quando for para produção
  const STRIPE_PK = 'pk_test_SUBSTITUA_PELA_SUA_CHAVE_PUBLICA';

  // Endpoint da API no Vercel (serverless function)
  const API_URL = '/api/create-checkout-session';

  // ─── INICIALIZA STRIPE ─────────────────────────────────────────
  if (typeof Stripe === 'undefined') {
    console.warn('Stripe.js não carregou ainda.');
    return;
  }

  const stripe = Stripe(STRIPE_PK);

  // ─── HANDLER DO BOTÃO ──────────────────────────────────────────
  async function handleCheckout(btn) {
    const originalText = btn.innerHTML;

    try {
      // Estado de loading no botão
      btn.disabled = true;
      btn.innerHTML = '<span style="opacity:0.7">⏳ Aguarde...</span>';

      // Chama a API serverless
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: 'nexto' }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Erro ao iniciar checkout');
      }

      const { sessionId } = await response.json();

      // Redireciona para o Stripe Checkout
      const { error } = await stripe.redirectToCheckout({ sessionId });

      if (error) throw new Error(error.message);

    } catch (err) {
      console.error('Checkout error:', err.message);
      alert('Ocorreu um erro ao iniciar o pagamento. Tente novamente.');
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  }

  // ─── LIGA OS BOTÕES ────────────────────────────────────────────
  function initButtons() {
    const btns = document.querySelectorAll('.stripe-checkout-btn');
    btns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        handleCheckout(btn);
      });
    });
  }

  // Aguarda DOM estar pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initButtons);
  } else {
    initButtons();
  }
})();
