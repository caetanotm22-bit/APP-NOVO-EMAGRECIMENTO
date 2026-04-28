// nexto-stripe.js — Stripe Checkout LIVE + Facebook Pixel maximizado
(function () {
  const API_URL = '/api/create-checkout-session';
  const STRIPE_PK = 'pk_live_51QMZNoDGidYUEaasOMRGZZIM9CQCXI4MJjWF584c9SWm3GSxI8tI1r5pBlUQhTSFwhqujBBjoNT4rXUP16Df8UWr00Y1RIyQ65';
  const PLAN_VALUE = 29.00;
  const PLAN_CURRENCY = 'AUD';

  // ── Helpers Facebook Pixel ───────────────────────────────────────────────────
  function fbTrack(event, params) {
    if (typeof fbq === 'function') {
      fbq('track', event, params || {});
    }
  }
  function fbTrackCustom(event, params) {
    if (typeof fbq === 'function') {
      fbq('trackCustom', event, params || {});
    }
  }

  // Dados do plano para todos os eventos
  const planParams = {
    content_ids:      ['nexto-health-team-29aud'],
    content_name:     'Nexto Health Team — A$29/mo',
    content_category: 'Health Subscription',
    content_type:     'product',
    value:            PLAN_VALUE,
    currency:         PLAN_CURRENCY,
    num_items:        1,
  };

  // ── Pre-warmed session ───────────────────────────────────────────────────────
  let prewarmedSession = null;
  let prewarming        = false;
  let prewarmPromise    = null;

  // ── Carrega Stripe.js apenas quando necessário ───────────────────────────────
  function loadStripe() {
    return new Promise((resolve) => {
      if (window.Stripe) return resolve(window.Stripe);
      const s = document.createElement('script');
      s.src = 'https://js.stripe.com/v3/';
      s.onload = () => resolve(window.Stripe);
      document.head.appendChild(s);
    });
  }

  // ── Pre-warm: cria sessão silenciosamente 3s após carregar ───────────────────
  function prewarm() {
    if (prewarming || prewarmedSession) return;
    prewarming    = true;
    prewarmPromise = fetch(API_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ plan: 'nexto' }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.url || data.sessionId) {
          prewarmedSession = data;
          loadStripe(); // pré-carrega Stripe.js em background também
        }
      })
      .catch(() => { /* falha silenciosa — nova sessão criada no clique */ });
  }

  // ── Checkout handler ─────────────────────────────────────────────────────────
  async function handleCheckout(btn) {
    const originalHTML = btn.innerHTML;

    // FB: InitiateCheckout — momento exato do clique no botão do plano
    fbTrack('InitiateCheckout', {
      ...planParams,
      predicted_ltv: PLAN_VALUE * 12, // valor anual estimado
    });

    try {
      btn.disabled  = true;
      btn.innerHTML = '<span style="opacity:.75">⏳ Opening...</span>';

      let data;

      // Usa sessão pré-aquecida se disponível
      if (prewarmedSession) {
        data            = prewarmedSession;
        prewarmedSession = null;
        prewarming       = false;
        setTimeout(prewarm, 500); // já aquece a próxima
      } else {
        // Aguarda eventual pre-warm em andamento
        if (prewarmPromise) {
          await prewarmPromise.catch(() => {});
          if (prewarmedSession) {
            data            = prewarmedSession;
            prewarmedSession = null;
            prewarming       = false;
            setTimeout(prewarm, 500);
          }
        }
        // Se ainda não tem sessão, busca agora
        if (!data) {
          const res = await fetch(API_URL, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ plan: 'nexto' }),
          });
          data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Payment error');
        }
      }

      // Redireciona para o Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
        return;
      }

      // Fallback: SDK Stripe
      const Stripe = await loadStripe();
      const stripe = Stripe(STRIPE_PK);
      const { error } = await stripe.redirectToCheckout({ sessionId: data.sessionId });
      if (error) throw new Error(error.message);

    } catch (err) {
      console.error('[Checkout]', err.message);
      alert('Something went wrong. Please try again.');
      btn.disabled  = false;
      btn.innerHTML = originalHTML;
    }
  }

  // ── Botão de compra no pricing card ─────────────────────────────────────────
  function initCheckoutButton() {
    document.querySelectorAll('.stripe-checkout-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        handleCheckout(btn);
      });
    });
  }

  // ── Eventos de scroll / visibilidade ────────────────────────────────────────
  function observeSections() {
    if (typeof IntersectionObserver === 'undefined') return;

    // ViewContent — quando a seção de preços fica visível
    const pricing = document.getElementById('pricing');
    if (pricing) {
      const ioPricing = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            fbTrack('ViewContent', planParams);
            ioPricing.disconnect();
          }
        });
      }, { threshold: 0.25 });
      ioPricing.observe(pricing);
    }

    // CustomEvent: ScrollDepth — mede engajamento (25%, 50%, 75%, 90%)
    const depths = [25, 50, 75, 90];
    const fired  = new Set();
    window.addEventListener('scroll', () => {
      const pct = Math.round(
        (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100
      );
      depths.forEach((d) => {
        if (pct >= d && !fired.has(d)) {
          fired.add(d);
          fbTrackCustom('ScrollDepth', { depth_pct: d, page: 'nexto-landing' });
        }
      });
    }, { passive: true });

    // CustomEvent: TimeOnPage — 30s e 60s (sinal de interesse alto)
    [30000, 60000].forEach((ms) => {
      setTimeout(() => {
        fbTrackCustom('TimeOnPage', { seconds: ms / 1000, page: 'nexto-landing' });
      }, ms);
    });
  }

  // ── Rastreia cliques nos botões de scroll (interesse antes do checkout) ──────
  function trackScrollBtnClicks() {
    document.querySelectorAll('.cta-scroll-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        fbTrackCustom('CTAClick', {
          button_text: btn.innerText?.trim().slice(0, 50),
          page:        'nexto-landing',
        });
      });
    });
  }

  // ── Init ─────────────────────────────────────────────────────────────────────
  function init() {
    initCheckoutButton();
    observeSections();
    trackScrollBtnClicks();
    // Pre-warm: 3s após load para não competir com recursos da página
    setTimeout(prewarm, 3000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
