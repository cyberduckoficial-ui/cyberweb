/* =========================
   CYBERDUCK — ANALYTICS v2
   Motor central de métricas
   Carga DESPUÉS de script.js
========================= */

(function () {
  'use strict';

  const ANALYTICS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbzdHugbApj8bUvF6UQ9g-LolHPp_3DN7MbVh83_muXlalJTmV0_CfTwlQsci_8efTQ/exec';
  const ANALYTICS_KEY      = 'cyberduck:analytics';
  const MAX_SESSIONS       = 200;
  const MAX_EVENTS         = 100;

  function safeRead(key, fallback) {
    try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; }
    catch (e) { return fallback; }
  }
  function safeWrite(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch (e) {}
  }
  function generateId() {
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  }
  function nowISO() { return new Date().toISOString(); }

  function detectDevice() {
    const ua = navigator.userAgent;
    if (/Mobi|Android/i.test(ua)) return 'mobile';
    if (/Tablet|iPad/i.test(ua))  return 'tablet';
    return 'desktop';
  }
  function detectReferrer() {
    const ref = document.referrer;
    if (!ref)                             return 'directo';
    if (/google\./i.test(ref))           return 'google';
    if (/facebook\./i.test(ref))         return 'facebook';
    if (/instagram\./i.test(ref))        return 'instagram';
    if (/whatsapp\./i.test(ref))         return 'whatsapp';
    if (ref.includes(location.hostname)) return 'interno';
    return 'otro';
  }
  function detectUTM() {
    const p = new URLSearchParams(location.search);
    return { source: p.get('utm_source') || '', medium: p.get('utm_medium') || '', campaign: p.get('utm_campaign') || '' };
  }
  function getCurrentPage() {
    return location.pathname.split('/').pop() || 'index.html';
  }

  function createSession() {
    return {
      session_id:         generateId(),
      started_at:         nowISO(),
      ended_at:           null,
      page:               getCurrentPage(),
      device:             detectDevice(),
      referrer:           detectReferrer(),
      utm:                detectUTM(),
      viewport:           window.innerWidth + 'x' + window.innerHeight,
      language:           navigator.language || '',
      time_on_page_s:     0,
      max_scroll_pct:     0,
      cart_items_at_exit: 0,
      checkout_reached:   false,
      order_completed:    false,
      events:             []
    };
  }

  const _session       = createSession();
  let   _pageStartTime = Date.now();
  let   _hidden        = false;
  let   _sent          = false;

  function track(eventType, metadata) {
    if (_session.events.length >= MAX_EVENTS) return;
    const ev = { t: nowISO(), type: eventType };
    if (metadata && typeof metadata === 'object') Object.assign(ev, metadata);
    _session.events.push(ev);
  }

  function buildSessionPayload() {
    const evs = _session.events || [];
    return {
      session_id:              _session.session_id,
      fecha:                   (_session.started_at || '').slice(0, 10),
      hora_inicio:             (_session.started_at || '').slice(11, 19),
      pagina:                  _session.page,
      dispositivo:             _session.device,
      referrer:                _session.referrer,
      utm_source:              _session.utm.source,
      utm_campaign:            _session.utm.campaign,
      viewport:                _session.viewport,
      tiempo_en_pagina_s:      _session.time_on_page_s,
      max_scroll_pct:          _session.max_scroll_pct,
      total_eventos:           evs.length,
      items_carrito_salida:    _session.cart_items_at_exit,
      llego_checkout:          _session.checkout_reached ? 'SI' : 'NO',
      orden_completada:        _session.order_completed  ? 'SI' : 'NO',
      abandono_carrito:        (_session.cart_items_at_exit > 0 && !_session.order_completed) ? 'SI' : 'NO',
      clicks_producto:         evs.filter(e => e.type === 'product_click').length,
      clicks_agregar_carrito:  evs.filter(e => e.type === 'add_to_cart').length,
      busquedas:               evs.filter(e => e.type === 'search_query').length,
      hora_fin:                (_session.ended_at || '').slice(11, 19)
    };
  }

  function buildEventsPayload() {
    return (_session.events || []).map(ev => {
      let d1 = '', d2 = '', d3 = '';
      if (ev.name)                    d1 = 'nombre: ' + ev.name;
      if (ev.category)                d1 += (d1 ? ' | ' : '') + 'cat: ' + ev.category;
      if (ev.price)                   d2 = 'precio: ' + ev.price;
      if (ev.query)                   d1 = 'búsqueda: ' + ev.query;
      if (ev.field)                   d1 = 'campo: ' + ev.field;
      if (ev.payment)                 d1 = 'pago: ' + ev.payment;
      if (ev.items !== undefined)     d1 = 'items: ' + ev.items;
      if (ev.pct !== undefined)       d1 = 'scroll: ' + ev.pct + '%';
      if (ev.direction)               d1 = 'dir: ' + ev.direction;
      if (ev.href)                    d2 = ev.href;
      if (ev.text)                    d3 = ev.text;
      if (ev.has_discount !== undefined) d2 = 'descuento: ' + (ev.has_discount ? 'SI' : 'NO');
      return {
        session_id: _session.session_id,
        timestamp:  ev.t   || '',
        event_type: ev.type || '',
        pagina:     ev.page || _session.page,
        detalle_1:  d1,
        detalle_2:  d2,
        detalle_3:  d3
      };
    });
  }

  function sendToSheet() {
    if (_sent) return;
    _sent = true;

    // Respaldo local
    const all = safeRead(ANALYTICS_KEY, []);
    all.push({ ..._session });
    if (all.length > MAX_SESSIONS) all.splice(0, all.length - MAX_SESSIONS);
    safeWrite(ANALYTICS_KEY, all);

    // Sesión → Sheet (no-cors evita el preflight que bloquea Apps Script)
    fetch(ANALYTICS_ENDPOINT, {
      method: 'POST',
      body: JSON.stringify({ type: 'session', data: buildSessionPayload() }),
      headers: { 'Content-Type': 'text/plain' },
      keepalive: true,
      mode: 'no-cors'
    }).catch(() => {});

    // Eventos → Sheet
    const evs = buildEventsPayload();
    if (evs.length > 0) {
      fetch(ANALYTICS_ENDPOINT, {
        method: 'POST',
        body: JSON.stringify({ type: 'events', data: evs }),
        headers: { 'Content-Type': 'text/plain' },
        keepalive: true,
        mode: 'no-cors'
      }).catch(() => {});
    }
  }

  function finalizeSession() {
    _session.ended_at = nowISO();
    if (!_hidden) {
      _session.time_on_page_s += Math.round((Date.now() - _pageStartTime) / 1000);
    }
    try {
      const cart = JSON.parse(localStorage.getItem('cyberduck:cart') || '[]');
      _session.cart_items_at_exit = Array.isArray(cart) ? cart.length : 0;
    } catch (_) { _session.cart_items_at_exit = 0; }
    sendToSheet();
  }

  /* ── Tiempo en página ── */
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      _hidden = true;
      _session.time_on_page_s += Math.round((Date.now() - _pageStartTime) / 1000);
      track('tab_hidden');
    } else {
      _hidden = false;
      _pageStartTime = Date.now();
      track('tab_visible');
    }
  });

  /* ── Scroll depth ── */
  (function () {
    let ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const scrolled  = window.scrollY || document.documentElement.scrollTop;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const pct = docHeight > 0 ? Math.round((scrolled / docHeight) * 100) : 0;
        if (pct > _session.max_scroll_pct) {
          _session.max_scroll_pct = pct;
          [25, 50, 75, 100].forEach(m => {
            if (pct >= m && !_session['_sm_' + m]) {
              _session['_sm_' + m] = true;
              track('scroll_milestone', { pct: m });
            }
          });
        }
        ticking = false;
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
  })();

  /* ── Clicks delegados ── */
  document.addEventListener('click', function (e) {
    const t = e.target;

    const galleryItem = t.closest('.gallery__item, .custom-card');
    if (galleryItem) {
      const name  = (galleryItem.querySelector('.gallery__name, .custom-title') || {}).textContent || '';
      const price = (galleryItem.querySelector('.gallery__price') || {}).textContent || '';
      const cat   = galleryItem.getAttribute('data-category') || galleryItem.getAttribute('data-custom') || '';
      track('product_click', { name: name.trim(), price: price.trim(), category: cat, page: getCurrentPage() });
      return;
    }

    // #pd-add es el botón de product.html
    const addBtn = t.closest('#pd-add, #addToCart, [data-action="add-to-cart"]');
    if (addBtn) {
      let pd = null;
      try { pd = JSON.parse(localStorage.getItem('cyberduck:selectedProduct') || 'null'); } catch (_) {}
      track('add_to_cart', {
        name:     pd ? (pd.name     || '') : '',
        price:    pd ? (pd.price    || '') : '',
        category: pd ? (pd.category || '') : '',
        page:     getCurrentPage()
      });
      return;
    }

    const filterTab = t.closest('.filter-tab');
    if (filterTab) {
      track('filter_click', { category: filterTab.getAttribute('data-cat') || '' });
      return;
    }

    const navLink = t.closest('.nav__link, .nav__dropdown-link');
    if (navLink) {
      track('nav_click', { href: navLink.getAttribute('href') || '', text: (navLink.textContent || '').trim() });
      return;
    }

    const searchBtn = t.closest('.iconbtn[aria-label="Buscar"]');
    if (searchBtn) { track('search_open', { page: getCurrentPage() }); return; }

    const cartBtn = t.closest('#cartButton, .iconbtn[aria-label="Carrito"]');
    if (cartBtn) { track('cart_open', { page: getCurrentPage() }); return; }

    const checkoutBtn = t.closest('#cartCheckout, a[href*="checkout"]');
    if (checkoutBtn) {
      _session.checkout_reached = true;
      track('checkout_start', { page: getCurrentPage() });
      return;
    }

    const sliderBtn = t.closest('#prev, #next');
    if (sliderBtn) { track('slider_click', { direction: sliderBtn.id }); return; }

    const giftBtn = t.closest('#giftBuyBtn');
    if (giftBtn) { track('gift_card_click'); return; }

    const waBtn = t.closest('a[href*="wa.me"], a[href*="whatsapp"]');
    if (waBtn) { track('whatsapp_click', { page: getCurrentPage() }); return; }

    const personalizarBtn = t.closest('a[href*="personalizar"]');
    if (personalizarBtn) { track('personalizar_click', { page: getCurrentPage() }); return; }

  }, true);

  /* ── Checkout ── */
  (function () {
    const form = document.getElementById('checkoutForm');
    if (!form) return;
    ['fullname', 'email', 'phone', 'paymentMethod'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('change', () => track('checkout_field_filled', { field: id }));
    });
    form.addEventListener('submit', () => {
      _session.checkout_reached = true;
      _session.order_completed  = true;
      track('checkout_submit', {
        payment:      (document.getElementById('paymentMethod') || {}).value || '',
        has_discount: !!((document.getElementById('discount') || {}).value || '').trim()
      });
      finalizeSession(); // enviar antes del redirect a WhatsApp
    });
  })();

  /* ── Producto visto en product.html ── */
  (function () {
    if (getCurrentPage() !== 'product.html') return;
    try {
      const d = JSON.parse(localStorage.getItem('cyberduck:selectedProduct') || 'null');
      if (d) track('product_view', { name: d.name || '', price: d.price || '', category: d.category || '' });
    } catch (_) {}
  })();

  /* ── Búsqueda interna ── */
  (function () {
    let _lastQuery = '';
    document.addEventListener('input', function (e) {
      if (e.target && e.target.id === 'searchInput') {
        const q = (e.target.value || '').trim();
        if (q.length >= 3 && q !== _lastQuery) {
          _lastQuery = q;
          track('search_query', { query: q });
        }
      }
    });
  })();

  /* ── Cierre / abandono ── */
  window.addEventListener('beforeunload', function () {
    try {
      const cart    = JSON.parse(localStorage.getItem('cyberduck:cart') || '[]');
      const cartLen = Array.isArray(cart) ? cart.length : 0;
      if (cartLen > 0 && !_session.order_completed) {
        track('cart_abandon', { items: cartLen, page: getCurrentPage() });
      }
    } catch (_) {}
    finalizeSession();
  });

  /* ── API pública ── */
  function getAllSessions() { return safeRead(ANALYTICS_KEY, []); }

  function exportCSV() {
    const sessions = getAllSessions();
    if (!sessions.length) return '';
    const keys = ['session_id','page','started_at','ended_at','device','referrer',
                  'time_on_page_s','max_scroll_pct','cart_items_at_exit',
                  'checkout_reached','order_completed'];
    const lines = [keys.join(',')];
    sessions.forEach(s => {
      lines.push(keys.map(k => {
        const v = s[k] === undefined || s[k] === null ? '' : String(s[k]);
        return /[,"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
      }).join(','));
    });
    return lines.join('\n');
  }

  function downloadCSV() {
    const csv = exportCSV();
    if (!csv) { console.warn('[analytics] Sin sesiones.'); return; }
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = 'cyberduck_analytics_' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  if (typeof globalThis.cyberduck === 'object' && globalThis.cyberduck) {
    globalThis.cyberduck.analytics = {
      track,
      getAllSessions,
      exportCSV,
      downloadCSV,
      clearAnalytics: () => localStorage.removeItem(ANALYTICS_KEY),
      currentSession: _session
    };
  }

  track('page_view', { page: getCurrentPage(), referrer: detectReferrer() });

})();