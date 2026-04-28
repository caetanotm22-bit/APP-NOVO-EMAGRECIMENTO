// nexto-stripe.js — Stripe Checkout LIVE
// Features: on-demand Stripe load, session pre-warming, Facebook Pixel events
(function () {
  const API_URL = '/api/create-checkout-session';
  const STRIPE_PK = 'pk_live_51QMZNoDGidYUEaasOMRGZZIM9CQCXI4MJjWF584c9SWm3GSxI8tI1r5pBlUQhTSFwhqujBBjoNT4rXUP16Df8UWr00Y1RIyQ65';

  // ── Pre-warmed session (filled ~3s after page load) ──────────────────────────
  let prewarmedSession = null;   // { url, sessionId }
  let prewarming = false;
  let prewarmPromise = null;

  function trackFB(event, params) {
    if (typeof fbq === 'function') {
      fbq('track', event, params || {});
    }
  }

  // ── Load Stripe.js on demand ─────────────────────────────────────────────────
  function loadStripe() {
    return new Promise((resolve) => {
      if (window.Stripe) return resolve(window.Stripe);
      const s = document.createElement('script');
      s.src = 'https://js.stripe.com/v3/';
      s.onload = () => resolve(window.Stripe);
      document.head.appendChild(s);
    });
  }

  // ── Pre-warm: create a checkout session silently ~3 s after page load ────────
  function prewarm() {
    if (prewarming || prewarmedSession) return;
    prewarming = true;
    prewarmPromise = fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: 'nexto' }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.url || data.sessionId) {
          prewarmedSession = data;
          // Pre-load Stripe.js in background so SDK is ready instantly
          loadStripe();
        }
      })
      .catch(() => { /* silent fail — fresh session created on click */ });
  }

  // ── Handle checkout click ─────────────────────────────────────────────────────
  async function handleCheckout(btn) {
    const originalHTML = btn.innerHTML;

    // Fire FB InitiateCheckout immediately on click
    trackFB('InitiateCheckout', {
      content_name: 'Nexto Health Team',
      content_category: 'Subscription',
      value: 29.00,
      currency: 'AUD',
      num_items: 1,
    });

    try {
      btn.disabled = true;
      btn.innerHTML = '<span style="opacity:.75">⏳ Opening...</span>';

      let data;

      // Use pre-warmed session if available, otherwise fetch fresh
      if (prewarmedSession) {
        data = prewarmedSession;
        prewarmedSession = null; // consume — next click will warm a new one
        // Immediately start warming the next session in background
        prewarming = false;
        setTimeout(prewarm, 500);
      } else {
        // No pre-warmed session — fetch now (prewarm may still be in flight)
        if (prewarmPromise) {
          // Wait for any in-flight prewarm request first
          await prewarmPromise.catch(() => {});
          if (prewarmedSession) {
            data = prewarmedSession;
            prewarmedSession = null;
            prewarming = false;
            setTimeout(prewarm, 500);
          }
        }
        if (!data) {
          const res = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ plan: 'nexto' }),
          });
          data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Payment error');
        }
      }

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
        return;
      }

      // Fallback: use Stripe SDK
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

  // ── Wire all checkout buttons ─────────────────────────────────────────────────
  function initButtons() {
    document.querySelectorAll('.stripe-checkout-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        handleCheckout(btn);
      });
    });
  }

  // ── Fire FB ViewContent when pricing section enters viewport ─────────────────
  function observePricingSection() {
    const pricing = document.getElementById('pricing');
    if (!pricing || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          trackFB('ViewContent', {
            content_name: 'Nexto Pricing — A$29/mo',
            content_category: 'Subscription',
            value: 29.00,
            currency: 'AUD',
          });
          io.disconnect(); // fire once only
        }
      });
    }, { threshold: 0.3 });
    io.observe(pricing);
  }

  // ── Init ──────────────────────────────────────────────────────────────────────
  function init() {
    initButtons();
    observePricingSection();
    // Pre-warm checkout session 3 s after page load (user is reading the page)
    setTimeout(prewarm, 3000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
