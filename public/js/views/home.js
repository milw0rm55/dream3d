// Footer shared by the desktop home and the content pages
function siteFooterHtml() {
  const social = [
    SITE.instagram && `<a href="${escapeHtml(SITE.instagram)}" target="_blank" rel="noopener">instagram</a>`,
    SITE.tiktok && `<a href="${escapeHtml(SITE.tiktok)}" target="_blank" rel="noopener">tiktok</a>`,
    SITE.email && `<a href="mailto:${escapeHtml(SITE.email)}">${siteText('email')}</a>`,
  ].filter(Boolean).join(' · ');
  return `
  <footer class="site-footer">
    <p class="footer-wordmark">${siteText('brandName')}</p>
    <p>${siteLines('footerText')}</p>
    ${social ? `<p class="footer-links">${social}</p>` : ''}
    <p class="footer-links">
      <a href="/aviso-legal" data-link>aviso legal</a> ·
      <a href="/privacidad" data-link>privacidad</a> ·
      <a href="/cookies" data-link>cookies</a> ·
      <a href="/condiciones" data-link>condiciones de venta</a>
    </p>
    <p class="footer-small">© ${new Date().getFullYear()} ${siteText('brandName')}</p>
  </footer>`;
}

// Product cards: priced figures go to the cart (orders through the web); only made-to-measure ones (price 0) go to WhatsApp
function productCardButton(p, cls, label) {
  const name = escapeHtml(p.name);
  return p.price > 0
    ? `<button type="button" class="${cls}" onclick="App.quickAdd(${p.id}, this)" aria-label="Añadir ${name} al carrito">${label}</button>`
    : `<a class="${cls}" data-wa href="${escapeHtml(waLink(`Hola, quiero un presupuesto para: ${p.name}`))}" target="_blank" rel="noopener" aria-label="Pedir presupuesto de ${name} por WhatsApp">presupuesto</a>`;
}

const HomeView = {
  _tag: 'all',

  render() {
    const stats = [1, 2, 3, 4].map(i =>
      `<div class="stat-box"><p class="stat-num">${siteText(`stat${i}Num`)}</p><p class="stat-label">${siteText(`stat${i}Label`)}</p></div>`).join('');
    const steps = [1, 2, 3, 4].map(i =>
      `<div class="process-step"><p class="step-num">0${i}</p><p class="step-title">${siteText(`step${i}Title`)}</p><p class="step-desc">${siteText(`step${i}Text`)}</p></div>`).join('');
    const testimonials = [1, 2, 3].filter(i => SITE[`t${i}Text`]).map(i => `
      <div class="testimonial">
        <p class="testimonial-stars" aria-label="5 de 5">★★★★★</p>
        <p class="testimonial-text">“${siteText(`t${i}Text`)}”</p>
        <div class="testimonial-author">
          <div class="author-avatar" data-avatar="${siteText(`t${i}Name`)}"></div>
          <div><p class="author-name">${siteText(`t${i}Name`)}</p><p class="author-loc">${siteText(`t${i}Place`)}</p></div>
        </div>
      </div>`).join('');

    return `
<div id="view-home" class="view active">
  <section class="hero">
    <h1 class="hero-wordmark"><img src="/img/dream3d-full-dark.svg" width="1737" height="1738" alt="${siteText('brandName')}"></h1>
    <p class="hero-sub">${siteText('heroSub')}</p>
  </section>

  <section class="catalog" id="productos" aria-label="Catálogo">
    <div class="tag-row" id="tagRow"></div>
    <div class="catalog-grid" id="catalogGrid"></div>
  </section>

  <section class="section about" id="nosotros">
    <p class="section-label">${siteText('aboutLabel')}</p>
    <h2 class="section-title">${siteText('aboutTitle')}</h2>
    <div class="about-grid">
      <div>
        <p class="about-text">${siteLines('aboutText1')}</p>
        <p class="about-text">${siteLines('aboutText2')}</p>
      </div>
      <div class="about-stats">${stats}</div>
    </div>
  </section>

  <section class="section process" id="proceso">
    <p class="section-label">${siteText('processLabel')}</p>
    <h2 class="section-title">${siteText('processTitle')}</h2>
    <div class="process-steps">${steps}</div>
  </section>

  ${testimonials ? `
  <section class="section testimonials">
    <p class="section-label">${siteText('testimonialsLabel')}</p>
    <h2 class="section-title">${siteText('testimonialsTitle')}</h2>
    <div class="testimonials-grid">${testimonials}</div>
  </section>` : ''}

  <section class="cta-banner" id="contacto">
    <h2>${siteText('ctaTitle')}</h2>
    <p>${siteLines('ctaText')}</p>
    <div class="cta-banner-actions">
      <a class="btn-primary btn-cta" data-wa href="${escapeHtml(waLink())}" target="_blank" rel="noopener">${siteText('ctaButton')}</a>
    </div>
    <details class="contact-more">
      <summary>¿Prefieres escribir un correo? Usa el formulario</summary>
      ${ContactForm.html()}
    </details>
  </section>

  ${siteFooterHtml()}
</div>`;
  },

  afterMount(palette) {
    const tags = ['all', ...new Set(PRODUCTS.filter(p => p.active !== false).map(p => p.tag))];
    const row = document.getElementById('tagRow');
    if (row) {
      row.innerHTML = tags.map(t =>
        `<button class="tag-btn${t === this._tag ? ' active' : ''}" aria-pressed="${t === this._tag}" data-tag="${escapeHtml(t)}">${t === 'all' ? 'todo' : escapeHtml(t.toLowerCase())}</button>`
      ).join('');
      row.querySelectorAll('.tag-btn').forEach(b => b.addEventListener('click', () => this.filter(b.dataset.tag)));
    }
    this._renderGrid();

    document.querySelectorAll('[data-avatar]').forEach(el => {
      el.innerHTML = Blobatar.generate(el.dataset.avatar, palette);
    });
  },

  filter(tag) {
    this._tag = tag;
    document.querySelectorAll('.tag-btn').forEach(b => {
      const on = b.dataset.tag === tag;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', on);
    });
    this._renderGrid();
  },

  _renderGrid() {
    const grid = document.getElementById('catalogGrid');
    if (!grid) return;
    const list = PRODUCTS.filter(p => p.active !== false && (this._tag === 'all' || p.tag === this._tag));
    grid.innerHTML = list.map(p => {
      const name = escapeHtml(p.name);
      const price = p.price > 0 ? formatPrice(p.price) : 'a consultar';
      const material = p.specs && p.specs[0] ? escapeHtml(p.specs[0][1]) : '';
      const photos = Turntable.frames(p);
      return `
        <article class="product-card${photos.length ? ' has-photos' : ''}" onclick="App.cardClick(event, ${p.id})">
          <div class="card-art"${photos.length ? '' : ` role="img" aria-label="${name}"`}>${photos.length ? Turntable.framesHtml(p) : (p.svg || '')}</div>
          <div class="card-top">
            ${photos.length > 1 ? '<span class="card-chip">360°</span>' : ''}
            ${Turntable.hasStl(p) ? '<span class="card-chip">3D</span>' : ''}
            <span class="card-chip">${escapeHtml(p.tag)}</span>
            ${material ? `<span class="card-chip">${material}</span>` : ''}
          </div>
          <div class="card-bottom">
            <div>
              <h3 class="product-name"><a href="/producto/${p.id}" data-link>${name}</a></h3>
              <p class="product-price">${price}</p>
            </div>
            ${productCardButton(p, 'btn-add', 'añadir')}
          </div>
        </article>`;
    }).join('');
    grid.querySelectorAll('.product-card').forEach(card =>
      Turntable.bindHover(card, card.querySelector('.card-art')));
  },
};
