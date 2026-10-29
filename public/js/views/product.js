const ProductView = {
  _qty: 1,
  _product: null,
  _stars: 0,
  _palette: [],

  _visualHtml(p) {
    const photos = Turntable.frames(p);
    const stl = Turntable.hasStl(p);
    const first = photos.includes('front') ? 'front' : photos[0];

    const stage = photos.length
      ? `<div class="detail-visual turntable-stage${photos.length > 1 ? ' can-drag' : ''}" id="detailStage">
           ${Turntable.framesHtml(p, true)}
           ${photos.length > 1 ? '<span class="drag-hint">arrastra para girar</span>' : ''}
         </div>`
      : `<div class="detail-visual" id="detailStage"><div class="detail-svg" role="img" aria-label="${escapeHtml(p.name)}">${p.svg || ''}</div></div>`;

    const viewer = stl
      ? `<div class="detail-visual stl-stage" id="stlStage" hidden><p class="stl-status">cargando modelo 3D…</p><span class="drag-hint">arrastra para girar · rueda para hacer zoom</span></div>`
      : '';

    const thumbs = [
      ...photos.map(s => `<button class="view-thumb${s === first ? ' active' : ''}" data-slot="${s}" aria-label="Ver ${Turntable.LABEL[s]}">
          <img src="${Turntable.esc(p.media[s])}" alt="" loading="lazy" decoding="async"><span>${Turntable.LABEL[s]}</span></button>`),
      ...(!photos.length && stl ? [`<button class="view-thumb active" data-slot="art"><span class="view-icon">${p.svg ? 'ilustración' : '—'}</span></button>`] : []),
      ...(stl ? [`<button class="view-thumb view-3d" data-slot="3d" aria-label="Ver modelo 3D">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M12 2 3 7v10l9 5 9-5V7l-9-5z"/><path d="M3 7l9 5 9-5M12 12v10"/></svg>
          <span>modelo 3D</span></button>`] : []),
    ];

    return stage + viewer + (thumbs.length > 1 ? `<div class="view-switch">${thumbs.join('')}</div>` : '');
  },

  _bindVisual() {
    const p = this._product;
    const stage = document.getElementById('detailStage');
    const stlStage = document.getElementById('stlStage');
    const thumbs = [...document.querySelectorAll('.view-thumb')];
    if (!stage) return;

    const setSlot = stage.classList.contains('turntable-stage') ? Turntable.bindDrag(stage) : null;
    const mark = slot => thumbs.forEach(t => t.classList.toggle('active', t.dataset.slot === slot));
    stage.addEventListener('turntable:slot', e => mark(e.detail));

    thumbs.forEach(btn => btn.addEventListener('click', () => {
      const slot = btn.dataset.slot;
      if (slot === '3d') {
        stage.hidden = true;
        stlStage.hidden = false;
        mark('3d');
        this._open3d(p, stlStage);
        return;
      }
      if (stlStage) stlStage.hidden = true;
      stage.hidden = false;
      if (setSlot && slot !== 'art') setSlot(slot);
      mark(slot);
    }));
  },

  async _open3d(p, stlStage) {
    if (this._viewer || this._viewerLoading) return;
    this._viewerLoading = true;
    const status = stlStage.querySelector('.stl-status');
    try {
      const mod = await import('/js/stl-viewer.js');
      const geometry = await mod.loadStl(p.media.stl);
      if (!stlStage.isConnected || this._product !== p) return;
      this._viewer = mod.mountViewer(stlStage, geometry, { color: '#9929EA' });
      status?.remove();
    } catch (err) {
      if (status) status.textContent = 'no se pudo cargar el modelo 3D';
    } finally {
      this._viewerLoading = false;
    }
  },

  // WhatsApp message carries what the visitor picked on the page
  _waHref() {
    const p = this._product;
    const parts = [`Hola, quiero un presupuesto para: ${p.name}`];
    parts.push(`cantidad ${this._qty}`);
    return waLink(parts.join(' · '));
  },

  _updateWa() {
    const btn = document.getElementById('waOrderBtn');
    if (btn) btn.href = this._waHref();
  },

  render(id) {
    const p = PRODUCTS.find(x => x.id === id && x.active !== false);
    if (!p) return NotFoundView.render();
    if (this._viewer) { this._viewer.dispose(); this._viewer = null; }
    this._product = p;
    this._qty = 1;
    this._stars = 0;
    this._reviewStart = Date.now();

    const specs = p.specs.map(([k,v]) =>
      `<div class="spec-row"><span class="spec-label">${escapeHtml(k)}</span><span class="spec-val">${escapeHtml(v)}</span></div>`
    ).join('');

    return `
<div id="view-product" class="view active">
  <div class="product-detail-wrap">
    <nav class="breadcrumb" aria-label="Ruta">
      <a href="/" data-link>Inicio</a><span class="sep" aria-hidden="true">/</span>
      <span aria-current="page" style="color:var(--text);font-weight:600">${escapeHtml(p.name)}</span>
    </nav>
    <div class="detail-grid">
      <div class="detail-media">${this._visualHtml(p)}</div>
      <div>
        <span class="detail-tag">${escapeHtml(p.tag)}</span>
        <h1 class="detail-name">${escapeHtml(p.name)}</h1>
        <div class="detail-rating" id="detailRating"></div>
        <p class="detail-price">${p.price > 0 ? formatPrice(p.price) : 'A consultar'}</p>
        <p class="detail-desc">${escapeHtml(p.desc)}</p>
        <div class="qty-row">
          <span style="font-size:.82rem;font-weight:600;color:var(--text-muted);letter-spacing:.04em;text-transform:uppercase">Cantidad</span>
          <div class="qty-control">
            <button class="qty-btn" aria-label="Quitar una unidad" onclick="ProductView.changeQty(-1)">−</button>
            <span class="qty-num" id="qtyNum" aria-live="polite">1</span>
            <button class="qty-btn" aria-label="Añadir una unidad" onclick="ProductView.changeQty(1)">+</button>
          </div>
        </div>
        <div class="detail-actions">
          ${p.price > 0
            ? '<button class="btn-yellow" id="addToCartBtn" onclick="ProductView.addToCart()">Añadir al carrito</button>'
            : `<a class="btn-yellow" id="waOrderBtn" data-wa target="_blank" rel="noopener" href="${escapeHtml(this._waHref())}">Pedir presupuesto por WhatsApp</a>`}
        </div>
        ${p.price > 0 ? '<p class="secure-pay"><img src="/img/stripe-logo.png" alt="Stripe" height="22"> Pagos seguros con Stripe</p>' : ''}
        ${specs ? `<div class="detail-specs">
          <h4>Especificaciones</h4>${specs}
        </div>` : ''}
      </div>
    </div>

    <div class="reviews-section">
      <h2>Reseñas del producto</h2>
      <div id="reviewSummary"></div>
      <div class="review-list" id="reviewList"></div>
      <div class="write-review">
        <h3>Escribe una reseña</h3>
        <div class="form-group"><label>Valoración</label>
          <div class="star-picker" id="starPicker">
            ${[1,2,3,4,5].map(n=>`<button type="button" class="star-btn" aria-label="${n} de 5" onclick="ProductView.setStars(${n})">★</button>`).join('')}
          </div>
        </div>
        <div class="form-group"><label for="reviewName">Nombre</label><input type="text" id="reviewName" maxlength="60" placeholder="Tu nombre o un apodo"></div>
        <div class="form-group"><label for="reviewText">Reseña</label><textarea id="reviewText" maxlength="500" placeholder="¿Qué tal ha quedado la figura?"></textarea></div>
        <input type="text" id="reviewWebsite" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
        <div class="form-actions">
          <button class="btn-yellow" onclick="ProductView.submitReview()">Enviar reseña</button>
          <p class="form-status" id="reviewStatus" role="status"></p>
        </div>
        <p class="form-note">Las reseñas se publican después de revisarlas.</p>
      </div>
    </div>
  </div>
</div>`;
  },

  afterMount(palette) {
    this._palette = palette;
    if (!this._product || !document.getElementById('view-product')) return;
    this._bindVisual();
    const p = this._product;
    fetch(`/api/products/${p.id}/reviews`)
      .then(r => r.json())
      .then(list => {
        if (this._product !== p) return;
        this._renderSummary(list);
        document.getElementById('reviewList').innerHTML = this._renderReviews(list);
        this._renderBlobatars(palette);
      })
      .catch(() => this._renderSummary([]));
  },

  // the score is computed from approved reviews only, never shown when there are none
  _renderSummary(list) {
    const rating = document.getElementById('detailRating');
    const summary = document.getElementById('reviewSummary');
    if (!rating || !summary) return;
    if (!list.length) {
      rating.innerHTML = '';
      summary.innerHTML = '<p class="reviews-empty">Todavía no hay reseñas de este producto.</p>';
      return;
    }
    const counts = [5, 4, 3, 2, 1].map(s => list.filter(r => Math.round(r.stars) === s).length);
    const avg = list.reduce((s, r) => s + Number(r.stars), 0) / list.length;
    const avgText = avg.toLocaleString('es-ES', { maximumFractionDigits: 1 });
    const filled = '★'.repeat(Math.round(avg)) + '☆'.repeat(5 - Math.round(avg));
    const label = `${list.length} ${list.length === 1 ? 'reseña' : 'reseñas'}`;
    rating.innerHTML = `<span class="detail-stars" aria-label="${avgText} de 5">${filled}</span><span class="detail-rating-count">(${label})</span>`;
    summary.innerHTML = `
      <div class="reviews-summary">
        <div>
          <div class="big-score">${avgText}</div>
          <div class="score-stars" aria-hidden="true">${filled}</div>
          <div class="score-label">de 5 · ${label}</div>
        </div>
        <div class="rating-bars">${counts.map((n, i) => `
          <div class="bar-row"><span>${5 - i}★</span><div class="bar-track"><div class="bar-fill" style="width:${Math.round(n / list.length * 100)}%"></div></div><span>${n}</span></div>`).join('')}
        </div>
      </div>`;
  },

  _renderBlobatars(palette) {
    document.querySelectorAll('.review-item[data-seed]').forEach(el => {
      const av = el.querySelector('.review-avatar');
      if (av) av.innerHTML = Blobatar.generate(el.dataset.seed, palette);
    });
  },

  // review text comes from visitors: always escape
  _renderReviews(reviews) {
    const esc = Turntable.esc;
    return reviews.map(r => {
      const stars = Math.min(5, Math.max(0, Math.round(Number(r.stars) || 0)));
      return `
      <div class="review-item" data-seed="${esc(r.name)}">
        <div class="review-header">
          <div style="display:flex;align-items:center;gap:.6rem">
            <div class="author-avatar review-avatar" style="width:32px;height:32px"></div>
            <span class="reviewer-name">${esc(r.name)}</span>
          </div>
          <span class="reviewer-date">${esc(r.date)}</span>
        </div>
        <div class="review-stars" aria-label="${stars} de 5">${'★'.repeat(stars)}${'☆'.repeat(5 - stars)}</div>
        <p class="review-text">${esc(r.text)}</p>
        ${r.badge ? `<span class="review-badge">✓ ${esc(r.badge)}</span>` : ''}
      </div>`;
    }).join('');
  },

  changeQty(d) {
    this._qty = Math.max(1, this._qty + d);
    const el = document.getElementById('qtyNum');
    if (el) el.textContent = this._qty;
    this._updateWa();
  },

  addToCart() {
    if (!this._product) return;
    if (this._product.price === 0) { App.navigate('home'); return; }
    App.cart.add(this._product, this._qty);
    const btn = document.getElementById('addToCartBtn');
    if (btn) {
      App.flyToCart(btn);
      btn.textContent = '✓ Añadido';
      setTimeout(() => btn.textContent = 'Añadir al carrito', 2000);
    }
  },

  setStars(n) {
    this._stars = n;
    document.querySelectorAll('.star-btn').forEach((b,i) => b.classList.toggle('lit', i < n));
  },

  async submitReview() {
    const name = document.getElementById('reviewName').value.trim();
    const text = document.getElementById('reviewText').value.trim();
    const status = document.getElementById('reviewStatus');
    if (!this._stars || !name || !text) {
      status.textContent = 'Elige una valoración y escribe tu nombre y tu reseña.';
      return;
    }
    const btn = document.querySelector('.write-review .btn-yellow');
    btn.disabled = true;
    status.textContent = 'Enviando…';
    try {
      const r = await fetch(`/api/products/${this._product.id}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, stars: this._stars, text,
          website: document.getElementById('reviewWebsite').value,
          elapsed: Date.now() - this._reviewStart,
        }),
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(json.error || 'No se pudo enviar la reseña.');
      document.getElementById('reviewName').value = '';
      document.getElementById('reviewText').value = '';
      this.setStars(0);
      status.textContent = '¡Gracias! Tu reseña aparecerá cuando la revisemos.';
    } catch (err) {
      status.textContent = err.message;
    } finally {
      btn.disabled = false;
    }
  },
};
