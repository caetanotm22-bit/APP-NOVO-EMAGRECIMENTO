// nexto-stripe.js — Stripe Checkout LIVE (loads Stripe on demand)
(function () {
  const API_URL = '/api/create-checkout-session';
  const STRIPE_PK = 'pk_live_51QMZNoDGidYUEaasOMRGZZIM9CQCXI4MJjWF584c9SWm3GSxI8tI1r5pBlUQhTSFwhqujBBjoNT4rXUP16Df8UWr00Y1RIyQ65';

  // Load Stripe.js dynamically — only when needed (saves ~80KB on initial load)
  function loadStripe() {
    return new Promise((resolve) => {
      if (window.Stripe) return resolve(window.Stripe);
      const script = document.createElement('script');
      script.src = 'https://js.stripe.com/v3/';
      script.onload = () => resolve(window.Stripe);
      document.head.appendChild(script);
    });
  }

  async function handleCheckout(btn) {
    const originalHTML = btn.innerHTML;
    try {
      btn.disabled = true;
      btn.innerHTML = '<span style="opacity:.75">⏳ Loading...</span>';

      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: 'nexto' }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Payment error');

      // Redirect directly if URL returned (no need to load Stripe SDK)
      if (data.url) {
        window.location.href = data.url;
        return;
      }

      // Fallback: load Stripe SDK and use redirectToCheckout
      const Stripe = await loadStripe();
      const stripe = Stripe(STRIPE_PK);
      const { error } = await stripe.redirectToCheckout({ sessionId: data.sessionId });
      if (error) throw new Error(error.message);

    } catch (err) {
      console.error('[Checkout]', err.message);
      alert('Something went wrong. Please try again.');
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
