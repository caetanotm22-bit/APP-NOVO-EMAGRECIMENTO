// nexto-stripe.js — Stripe Checkout LIVE
(function () {
  const API_URL = '/api/create-checkout-session';

  async function handleCheckout(btn) {
    const originalHTML = btn.innerHTML;

    try {
      btn.disabled = true;
      btn.innerHTML = '<span style="opacity:.75;pointer-events:none">⏳ Aguarde...</span>';

      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: 'nexto' }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Erro ao iniciar pagamento');

      // Redireciona direto para a URL do Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      } else {
        // Fallback: usa redirectToCheckout com sessionId
        const stripe = Stripe('pk_live_51QMZNoDGidYUEaasOMRGZZIM9CQCXI4MJjWF584c9SWm3GSxI8tI1r5pBlUQhTSFwhqujBBjoNT4rXUP16Df8UWr00Y1RIyQ65');
        const { error } = await stripe.redirectToCheckout({ sessionId: data.sessionId });
        if (error) throw new Error(error.message);
      }

    } catch (err) {
      console.error('[Checkout]', err.message);
      alert('Erro ao abrir o checkout. Por favor tente novamente.');
      btn.disabled = false;
      btn.innerHTML = originalHTML;
    }
  }

  function initButtons() {
    document.querySelectorAll('.stripe-checkout-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        handleCheckout(btn);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initButtons);
  } else {
    initButtons();
  }
})();
