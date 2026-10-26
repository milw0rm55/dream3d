/**
 * App — router, cart store, session store.
 * Carga /config.json para obtener la paleta de blobatars desde el servidor.
 */
const App = (() => {

  // ── state ─────────────────────────────────────
  let _palette  = ['#0A0A0A','#3A3A38','#6B6A66','#9C9A94','#C9C6BD','#E9E6DE','#55534E','#B5B2A9'];
  const USER_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>';
  let _current  = { view: 'home', param: null };
  const _app    = document.getElementById('app');

  // ── cart ──────────────────────────────────────
  const cart = {
    items: [],
    add(product, qty, color) {
      const ex = this.items.find(i => i.id === product.id && i.color === color);
      if (ex) ex.qty += qty;
      else this.items.push({ id: product.id, name: product.name, price: product.price, qty, color, svg: Turntable.thumbHtml(product), bg: product.bg });
      _updateBadge();
    },
    updateQty(idx, delta) {
      this.items[idx].qty = Math.max(1, this.items[idx].qty + delta);
      _updateBadge();
      navigate('cart');
    },
    remove(idx) {
      this.items.splice(idx, 1);
      _updateBadge();
      navigate('cart');
    },
    clear() {
      this.items.splice(0);
      _updateBadge();
    },
  };

  // ── session ───────────────────────────────────
  const session = {
    _user: null,
    set(user) { this._user = user; _updateNav(); },
    get()     { return this._user; },
    clear()   { this._user = null; _updateNav(); },
  };

  // ── internal ──────────────────────────────────
  function _updateBadge() {
    const total = cart.items.reduce((s,i) => s + i.qty, 0);
    ['cartBadge', 'mCartBadge'].forEach(id => {
      const badge = document.getElementById(id);
      if (badge) { badge.textContent = total; badge.classList.toggle('show', total > 0); }
    });
  }

  function _updateNav() {
    const btn    = document.getElementById('navAuthBtn');
    const avatar = document.getElementById('navAvatar');
    const mAvatar = document.getElementById('mNavAvatar');
    const user   = session.get();
    if (btn) {
      const label = user ? user.name.split(' ')[0].toLowerCase() : 'entrar';
      btn.textContent = label;
      btn.dataset.label = label;
    }
    if (avatar && user) {
      avatar.innerHTML = `<span class="nav-blobatar">${Blobatar.generate(user.email || user.name, _palette, 32)}</span>`;
    } else if (avatar) {
      avatar.innerHTML = USER_ICON;
    }
    if (mAvatar && user) {
      mAvatar.innerHTML = Blobatar.generate(user.email || user.name, _palette, 28);
    } else if (mAvatar) {
      mAvatar.innerHTML = USER_ICON;
    }
  }

  // brand pill stays hidden while the hero wordmark is on screen
  function _syncNavBrand() {
    const atTop = _current.view === 'home' && window.scrollY < 160;
    document.body.classList.toggle('nav-at-top', atTop);
  }
  window.addEventListener('scroll', _syncNavBrand, { passive: true });

  function _mount(html) {
    _app.innerHTML = html;
  }

  // ── routes (History API) ──────────────────────
  const ROUTES = {
    home: '/', cart: '/carrito', contact: '/contacto',
    login: '/entrar', register: '/registro', profile: '/perfil',
    legal: '/aviso-legal', privacy: '/privacidad', cookies: '/cookies', terms: '/condiciones',
  };
  const TITLES = {
    cart: 'Tu carrito', contact: 'Contacto', login: 'Iniciar sesión', register: 'Crear cuenta', profile: 'Mi perfil',
    legal: 'Aviso legal', privacy: 'Política de privacidad', cookies: 'Política de cookies', terms: 'Condiciones de venta',
    order: 'Tu pedido', notfound: 'Página no encontrada',
  };

  // notfound keeps the URL the visitor typed (param = that path); order keeps its ?t= token (param = path + query)
  function _pathFor(view, param) {
    if (view === 'product') return `/producto/${param}`;
    if (view === 'notfound' || view === 'order') return param || location.pathname;
    return ROUTES[view] || '/';
  }

  function _routeFrom(pathname, search = '') {
    const product = pathname.match(/^\/producto\/(\d+)\/?$/);
    if (product) return { view: 'product', param: Number(product[1]) };
    if (/^\/pedido\/F3D-\d+$/.test(pathname)) return { view: 'order', param: pathname + search };
    const clean = pathname.replace(/\/+$/, '') || '/';
    const view = Object.keys(ROUTES).find(v => ROUTES[v] === clean);
    return view ? { view, param: null } : { view: 'notfound', param: pathname };
  }

  function _titleFor(view, param) {
    const brand = SITE.brandName || 'dream3d';
    if (view === 'home') return SITE.seoTitle || brand;
    const product = view === 'product' && PRODUCTS.find(p => p.id === param && p.active !== false);
    if (product) return `${product.name} · ${brand}`;
    return `${TITLES[view === 'product' ? 'notfound' : view] || brand} · ${brand}`;
  }

  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  // ── public: navigate ──────────────────────────
  // opts.history: 'push' (default, user navigation) | 'replace' | 'none' (back/forward)
  function navigate(view, param, opts = {}) {
    const mode = opts.history || 'push';

    if (view === 'profile' && !session.get()) {
      return navigate('login', null, { history: mode === 'none' ? 'replace' : mode });
    }

    // remember where we were on the page we're leaving, for the back button
    if (mode !== 'none' && history.state) {
      history.replaceState({ ...history.state, scrollY: window.scrollY }, '');
    }

    // re-rendering the same page (e.g. cart quantity change) keeps the scroll position
    const samePage = mode !== 'none' && view !== 'home' && _pathFor(view, param) === location.pathname;
    const keepY = window.scrollY;

    _current = { view, param };
    if (view !== 'home') document.body.classList.remove('is-mobile-home');

    switch (view) {
      case 'home': {
        if (window.innerWidth < 768) {
          document.body.classList.add('is-mobile-home');
          _mount(MobileHomeView.render());
          MobileHomeView.afterMount(_palette);
        } else {
          document.body.classList.remove('is-mobile-home');
          _mount(HomeView.render());
          HomeView.afterMount(_palette);
        }
        break;
      }
      case 'product': {
        const id = param || 1;
        _mount(ProductView.render(id));
        ProductView.afterMount(_palette);
        refreshBlobatars();
        break;
      }
      case 'cart': {
        _mount(CartView.render());
        break;
      }
      case 'contact': {
        _mount(ContactView.render());
        break;
      }
      case 'login': {
        _mount(AuthView.renderLogin());
        break;
      }
      case 'register': {
        _mount(AuthView.renderRegister());
        break;
      }
      case 'profile': {
        const html = ProfileView.render(_palette);
        if (html) _mount(html);
        break;
      }
      case 'legal':   _mount(LegalView.aviso()); break;
      case 'privacy': _mount(LegalView.privacidad()); break;
      case 'cookies': _mount(LegalView.cookies()); break;
      case 'terms':   _mount(LegalView.condiciones()); break;
      case 'order':
        _mount(OrderView.render());
        OrderView.afterMount(param);
        break;
      default:        _mount(NotFoundView.render());
    }
    // legal links must be reachable from every page (LSSI); the desktop home already has its own footer
    if (view !== 'home') _app.insertAdjacentHTML('beforeend', siteFooterHtml());

    const path = _pathFor(view, param);
    const state = { view, param, scrollY: 0 };
    if (mode === 'push' && path !== location.pathname + location.search) history.pushState(state, '', path);
    else if (mode !== 'none') history.replaceState(state, '', path);

    document.title = _titleFor(view, param);

    window.scrollTo({ top: samePage ? keepY : (opts.scrollY || 0), behavior: 'instant' });
    // screen readers: announce the new page instead of staying on the clicked link
    if (mode === 'push' && !samePage) _app.focus({ preventScroll: true });
    _syncNavBrand();
    ThemeMode.refresh();
    if (!samePage) Stats.page(path.split('?')[0]); // never send the order token to analytics
  }

  function cardClick(event, id) {
    if (event.target.closest('a, button')) return; // the card's own links handle themselves
    if (event.ctrlKey || event.metaKey || event.shiftKey) window.open(`/producto/${id}`, '_blank');
    else navigate('product', id);
  }

  // ── cookieless analytics ───────────────────────
  const Stats = {
    _off: navigator.doNotTrack === '1' || navigator.globalPrivacyControl === true,
    _first: true,
    send(data) {
      if (this._off) return;
      const body = new Blob([JSON.stringify(data)], { type: 'application/json' });
      if (!(navigator.sendBeacon && navigator.sendBeacon('/api/stats', body))) {
        fetch('/api/stats', { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'application/json' } }).catch(() => {});
      }
    },
    page(path) {
      this.send({ path, ref: this._first ? document.referrer : '' });
      this._first = false;
    },
  };

  window.addEventListener('popstate', e => {
    const route = _routeFrom(location.pathname, location.search);
    navigate(route.view, route.param, { history: 'none', scrollY: e.state && e.state.scrollY });
  });

  function scrollTo(id) {
    if (_current.view !== 'home') navigate('home');
    setTimeout(() => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }, 60);
  }

  function quickAdd(id, btn) {
    const p = PRODUCTS.find(x => x.id === id);
    if (!p || p.price === 0) { navigate('product', id); return; }
    cart.add(p, 1, p.colors[0]);
    flyToCart(btn);
    if (!btn.dataset.idle) btn.dataset.idle = btn.textContent;
    btn.textContent = 'añadido';
    clearTimeout(btn._resetTimer);
    btn._resetTimer = setTimeout(() => btn.textContent = btn.dataset.idle, 1800);
  }

  // ── cart add animation ────────────────────────
  function _bumpBadge() {
    const desktop = document.getElementById('cartBadge');
    const mobile  = document.getElementById('mCartBadge');
    const badge   = (mobile && mobile.getBoundingClientRect().width > 0) ? mobile : desktop;
    if (!badge) return;
    badge.classList.remove('badge-bump');
    void badge.offsetWidth;
    badge.classList.add('badge-bump');
    badge.addEventListener('animationend', () => badge.classList.remove('badge-bump'), { once: true });
  }

  function flyToCart(sourceEl) {
    // prefer whichever badge is actually visible
    let badge = document.getElementById('cartBadge');
    const mobileBadge = document.getElementById('mCartBadge');
    if (mobileBadge && mobileBadge.getBoundingClientRect().width > 0) badge = mobileBadge;
    else if (badge && badge.getBoundingClientRect().width === 0) badge = null;
    if (!badge || !sourceEl) { _bumpBadge(); return; }

    const from = sourceEl.getBoundingClientRect();
    const to   = badge.getBoundingClientRect();
    const startX = from.left + from.width  / 2 - 6;
    const startY = from.top  + from.height / 2 - 6;
    const dx = (to.left + to.width  / 2 - 6) - startX;
    const dy = (to.top  + to.height / 2 - 6) - startY;

    const dot = document.createElement('div');
    dot.className = 'cart-fly-dot';
    dot.style.left = startX + 'px';
    dot.style.top  = startY + 'px';
    document.body.appendChild(dot);

    dot.animate([
      { transform: 'translate(0,0) scale(1)',              opacity: 1   },
      { transform: `translate(${dx}px,${dy}px) scale(0.25)`, opacity: 0.7 },
    ], {
      duration: 480,
      easing: 'cubic-bezier(0.23,1,0.32,1)',
    }).onfinish = () => { dot.remove(); _bumpBadge(); };
  }

  // re-render blobatars inside current view (after dynamic content added)
  function refreshBlobatars() {
    document.querySelectorAll('[data-seed]').forEach(el => {
      const seed = el.dataset.seed;
      const av = el.querySelector('.review-avatar');
      if (av && !av.innerHTML.trim()) {
        av.innerHTML = Blobatar.generate(seed, _palette);
      }
    });
  }

  // ── nav event delegation ───────────────────────
  document.addEventListener('click', e => {
    // WhatsApp: count the conversion; without a number configured the link points to /contacto
    const wa = e.target.closest('[data-wa]');
    if (wa) {
      Stats.send({ path: location.pathname, event: 'whatsapp' });
      if (wa.getAttribute('href').startsWith('/')) { e.preventDefault(); go(wa.getAttribute('href')); }
      return;
    }
    // internal <a href data-link>: real links for crawlers and new-tab clicks, in-app navigation otherwise
    const link = e.target.closest('a[data-link]');
    if (link && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) {
      e.preventDefault();
      go(link.getAttribute('href'));
      return;
    }
    const t = e.target.closest('[data-nav]');
    if (t) navigate(t.dataset.nav);
    const s = e.target.closest('[data-scroll]');
    if (s) scrollTo(s.dataset.scroll);
  });

  function go(path) {
    const url = new URL(path, location.origin);
    const route = _routeFrom(url.pathname, url.search);
    navigate(route.view, route.param);
  }

  // ── init ──────────────────────────────────────
  async function init() {
    try {
      const [cfg, serverProds] = await Promise.all([
        fetch('/config.json').then(r => r.json()),
        fetch('/api/products').then(r => r.json()),
      ]);
      if (cfg.blobatarColors) _palette = cfg.blobatarColors;
      if (cfg.defaultMode) ThemeMode.setDefault(cfg.defaultMode);
      // merge server product data (price, stock, active) into local PRODUCTS (which hold SVGs)
      serverProds.forEach(sp => {
        const local = PRODUCTS.find(p => p.id === sp.id);
        if (local) { Object.assign(local, sp); }
        else { PRODUCTS.push(sp); }
      });
      // sample products the server does not publish (unpublished or deleted in the admin) must stay hidden
      const served = new Set(serverProds.map(sp => sp.id));
      PRODUCTS.forEach(p => { if (!served.has(p.id)) p.active = false; });
    } catch (_) { /* use local data.js defaults */ }
    // products created in the admin don't carry these fields
    PRODUCTS.forEach(p => { p.colors = p.colors || []; p.specs = p.specs || []; p.reviews = p.reviews || []; });

    const brand = document.getElementById('navBrand');
    if (brand && SITE.brandName) brand.textContent = SITE.brandName;
    const waFloat = document.getElementById('waFloat');
    if (waFloat) waFloat.href = waLink();

    const route = _routeFrom(location.pathname, location.search);
    navigate(route.view, route.param, { history: 'replace' });
    _updateNav();
    _generateStandInFrames();
    CookieNotice.show();
  }

  // products without real photos get rendered 3D turntable frames, once the page is idle
  function _generateStandInFrames() {
    const pending = PRODUCTS.filter(p => p.model && p.active !== false && !Turntable.frames(p).length);
    if (!pending.length) return;
    const run = () => import('/js/product-models.js')
      .then(mod => {
        mod.renderTurntables(pending).forEach(({ product, frames }) => {
          product.media = { ...(product.media || {}), ...frames };
        });
        if (_current.view === 'product') {
          const media = document.querySelector('.detail-media');
          const p = ProductView._product;
          if (media && p && pending.includes(p)) {
            media.innerHTML = ProductView._visualHtml(p);
            ProductView._bindVisual();
          }
          return;
        }
        if (_current.view !== 'home') return;
        if (document.body.classList.contains('is-mobile-home')) MobileHomeView.afterMount(_palette);
        else HomeView._renderGrid();
      })
      .catch(err => console.warn('No se pudieron generar las vistas 3D:', err));
    if ('requestIdleCallback' in window) requestIdleCallback(run, { timeout: 2000 });
    else setTimeout(run, 800);
  }

  return { navigate, go, scrollTo, cardClick, quickAdd, refreshBlobatars, flyToCart, cart, session, init };
})();

App.init();
