const IG_SVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>`;
const WA_SVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>`;
const TK_SVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.73a8.27 8.27 0 0 0 4.83 1.54V6.82a4.85 4.85 0 0 1-1.06-.13z"/></svg>`;

const MobileHomeView = {
  render() {
    return `
<div id="view-mobile-home" class="view active">
  <!-- TOP BAR -->
  <div class="m-topbar">
    <a class="m-logo" href="/" data-link>${siteText('brandName')}</a>
    <div class="m-topbar-actions">
      <button class="m-icon-btn" type="button" data-theme-toggle aria-label="Modo de color"></button>
      <button class="m-icon-btn" data-nav="cart" aria-label="Carrito">
        ${_cartSvg()}
        <span class="cart-badge" id="mCartBadge">0</span>
      </button>
      <button class="m-icon-btn" data-nav="profile" aria-label="Perfil">
        <span id="mNavAvatar"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg></span>
      </button>
    </div>
  </div>

  <!-- PRODUCT GRID -->
  <div class="m-grid" id="mobileGrid"></div>

  <!-- BOTTOM BAR -->
  <footer class="m-bottombar">
    <div class="m-bottom-brand">
      <p class="m-bottom-logo">${siteText('brandName')}</p>
      <p class="m-bottom-desc">${siteLines('footerText')}</p>
    </div>
    <a class="m-contact-btn" href="/contacto" data-link>escríbeme</a>
    <div class="m-rrss">
      ${SITE.instagram ? `<a class="m-social" href="${escapeHtml(SITE.instagram)}" target="_blank" rel="noopener" aria-label="Instagram">${IG_SVG}</a>` : ''}
      ${SITE.whatsapp ? `<a class="m-social" data-wa href="${escapeHtml(waLink())}" target="_blank" rel="noopener" aria-label="WhatsApp">${WA_SVG}</a>` : ''}
      ${SITE.tiktok ? `<a class="m-social" href="${escapeHtml(SITE.tiktok)}" target="_blank" rel="noopener" aria-label="TikTok">${TK_SVG}</a>` : ''}
    </div>
    <p class="m-legal"><a href="/aviso-legal" data-link>aviso legal</a> · <a href="/privacidad" data-link>privacidad</a> · <a href="/cookies" data-link>cookies</a> · <a href="/condiciones" data-link>condiciones</a></p>
    <p class="m-copyright">© ${new Date().getFullYear()} ${siteText('brandName')}</p>
  </footer>
</div>`;
  },

  afterMount(palette) {
    const grid = document.getElementById('mobileGrid');
    if (!grid) return;
    grid.innerHTML = PRODUCTS.filter(p => p.active !== false).map(p => {
      const name = escapeHtml(p.name);
      const desc = String(p.desc || '');
      const price = p.price > 0
        ? `<span class="m-card-price">${formatPrice(p.price)}</span>`
        : `<span class="m-card-price consult">A consultar</span>`;
      const hasPhoto = Turntable.frames(p).length > 0;
      return `
<article class="m-card" onclick="App.cardClick(event, ${p.id})">
  <div class="m-card-thumb"${hasPhoto ? '' : ` role="img" aria-label="${name}"`}>${Turntable.thumbHtml(p)}</div>
  <div class="m-card-info">
    <span class="m-card-tag">${escapeHtml(p.tag)}</span>
    <h2 class="m-card-name"><a href="/producto/${p.id}" data-link>${name}</a></h2>
    <p class="m-card-desc">${escapeHtml(desc.length > 72 ? desc.slice(0, 72) + '…' : desc)}</p>
    ${price}
    ${productCardButton(p, 'm-card-btn', 'Añadir al carrito')}
  </div>
</article>`;
    }).join('');

    // sync badge + avatar with current state
    const total = App.cart.items.reduce((s,i) => s + i.qty, 0);
    const badge = document.getElementById('mCartBadge');
    if (badge) { badge.textContent = total; badge.classList.toggle('show', total > 0); }

    const user = App.session.get();
    const avatar = document.getElementById('mNavAvatar');
    if (avatar && user) {
      avatar.innerHTML = Blobatar.generate(user.email || user.name, palette, 28);
    }
  },
};

function _cartSvg() {
  return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>`;
}
