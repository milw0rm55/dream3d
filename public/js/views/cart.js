const CartView = {
  // display only: the server recalculates every amount from the database before charging
  _totals(items) {
    const cents = n => Math.round(n * 100) / 100;
    const subtotal = cents(items.reduce((s, i) => s + i.price * i.qty, 0));
    const shipping = subtotal >= Number(SITE.freeShippingFrom) ? 0 : Number(SITE.shippingCost);
    return { subtotal, shipping, total: cents(subtotal + shipping) };
  },

  _methods() {
    return [
      SITE.cardPayments && { value: 'tarjeta', label: 'Tarjeta, Apple Pay o Google Pay', hint: 'Pago seguro en la página de Stripe.' },
      SITE.bankIban && { value: 'transferencia', label: 'Transferencia bancaria', hint: 'Te mostramos el IBAN al confirmar; preparamos el pedido al recibirla.' },
    ].filter(Boolean);
  },

  render() {
    const items = App.cart.items;
    if (!items.length) {
      return `
<div id="view-cart" class="view active">
  <div class="cart-wrap">
    <h1>Tu carrito</h1>
    <div class="cart-empty">
      <h2>Tu carrito está vacío</h2>
      <p>Todavía no has añadido ninguna figura.</p>
      <a class="btn-yellow" href="/" data-link>Ver catálogo</a>
    </div>
  </div>
</div>`;
    }

    const { subtotal, shipping: envio, total } = this._totals(items);
    const methods = this._methods();

    const itemsHtml = items.map((item, idx) => `
      <div class="cart-item">
        <div class="cart-item-thumb" aria-hidden="true">${item.svg}</div>
        <div>
          <p class="cart-item-name">${escapeHtml(item.name)}</p>
          ${item.color ? `<p class="cart-item-variant">Color: <span class="cart-color" style="background:${escapeHtml(item.color)}"></span></p>` : ''}
          <div class="cart-item-qty">
            <button class="cart-qty-btn" aria-label="Quitar una unidad" onclick="App.cart.updateQty(${idx},-1)">−</button>
            <span aria-label="Cantidad">${item.qty}</span>
            <button class="cart-qty-btn" aria-label="Añadir una unidad" onclick="App.cart.updateQty(${idx},1)">+</button>
          </div>
        </div>
        <div style="display:flex;align-items:center">
          <span class="cart-item-price">${formatPrice(item.price * item.qty)}</span>
          <button class="cart-remove" aria-label="Quitar ${escapeHtml(item.name)} del carrito" onclick="App.cart.remove(${idx})">✕</button>
        </div>
      </div>`).join('');

    const checkout = methods.length ? `
      <form class="checkout-form" novalidate onsubmit="CartView.checkout(event)">
        <h2>Datos de envío</h2>
        <div class="contact-grid">
          <div class="form-group"><label for="coName">Nombre y apellidos</label><input id="coName" name="name" autocomplete="name" maxlength="80" required></div>
          <div class="form-group"><label for="coEmail">Correo electrónico</label><input id="coEmail" name="email" type="email" autocomplete="email" maxlength="120" required></div>
          <div class="form-group"><label for="coPhone">Teléfono</label><input id="coPhone" name="phone" type="tel" autocomplete="tel" maxlength="30" required></div>
          <div class="form-group"><label for="coStreet">Dirección</label><input id="coStreet" name="street" autocomplete="street-address" maxlength="160" required></div>
          <div class="form-group"><label for="coZip">Código postal</label><input id="coZip" name="zip" autocomplete="postal-code" inputmode="numeric" maxlength="5" required></div>
          <div class="form-group"><label for="coCity">Ciudad</label><input id="coCity" name="city" autocomplete="address-level2" maxlength="80" required></div>
          <div class="form-group"><label for="coProvince">Provincia</label><input id="coProvince" name="province" autocomplete="address-level1" maxlength="80" required></div>
          <div class="form-group full"><label for="coNotes">Notas (opcional)</label><textarea id="coNotes" name="notes" rows="2" maxlength="500" placeholder="Es un regalo, déjalo en portería…"></textarea></div>
        </div>
        <fieldset class="pay-methods">
          <legend>Forma de pago</legend>
          ${methods.map((m, i) => `
            <label class="pay-method">
              <input type="radio" name="method" value="${m.value}"${i === 0 ? ' checked' : ''}>
              <span><strong>${m.label}</strong><small>${m.hint}</small></span>
            </label>`).join('')}
        </fieldset>
        <p class="form-note">${siteText('deliveryTime')}</p>
        <label class="consent">
          <input type="checkbox" name="accept" required>
          <span>He leído y acepto las <a href="/condiciones" data-link>condiciones de venta</a> y la <a href="/privacidad" data-link>política de privacidad</a>.</span>
        </label>
        <div class="form-actions">
          <button class="btn-primary" type="submit">pagar ${formatPrice(total)}</button>
          <p class="form-status" role="status"></p>
        </div>
      </form>`
      : `<p class="form-note">El pago online aún no está activo. <a data-wa href="${escapeHtml(waLink('Hola, quiero hacer este pedido: ' + items.map(i => `${i.name} ×${i.qty}`).join(', ')))}" target="_blank" rel="noopener">Haz tu pedido por WhatsApp</a>.</p>`;

    return `
<div id="view-cart" class="view active">
  <div class="cart-wrap">
    <h1>Tu carrito</h1>
    <div class="cart-layout">
      <div>
        <div class="cart-items">${itemsHtml}</div>
        ${checkout}
      </div>
      <div class="cart-summary">
        <h2>Resumen del pedido</h2>
        <div class="summary-row"><span>Subtotal</span><span>${formatPrice(subtotal)}</span></div>
        <div class="summary-row">
          <span>Envío</span>
          <span>${envio === 0 ? '<span style="color:var(--success)">Gratis</span>' : formatPrice(envio)}</span>
        </div>
        ${envio > 0 ? `<div style="font-size:.75rem;color:var(--text-muted);margin-top:-.2rem">Gratis a partir de ${formatPrice(SITE.freeShippingFrom)}</div>` : ''}
        <div class="summary-row total"><span>Total</span><span>${formatPrice(total)}</span></div>
        <p class="form-note">Precios finales, impuestos incluidos.</p>
      </div>
    </div>
  </div>
</div>`;
  },

  async checkout(e) {
    e.preventDefault();
    const f = e.target;
    const status = f.querySelector('.form-status');
    const btn = f.querySelector('button[type=submit]');
    const val = name => f[name].value.trim();

    const required = ['name', 'email', 'phone', 'street', 'zip', 'city', 'province'];
    const empty = required.find(n => !val(n));
    if (empty) { status.textContent = 'Completa todos los datos de envío.'; f[empty].focus(); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val('email'))) { status.textContent = 'Revisa el correo electrónico.'; f.email.focus(); return; }
    if (!/^\d{5}$/.test(val('zip'))) { status.textContent = 'El código postal debe tener 5 cifras.'; f.zip.focus(); return; }
    if (!f.accept.checked) { status.textContent = 'Tienes que aceptar las condiciones de venta.'; f.accept.focus(); return; }

    btn.disabled = true;
    status.textContent = 'Preparando el pago…';
    try {
      const r = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: App.cart.items.map(i => ({ id: i.id, qty: i.qty, color: i.color })),
          customer: { name: val('name'), email: val('email'), phone: val('phone') },
          address: { street: val('street'), zip: val('zip'), city: val('city'), province: val('province') },
          notes: val('notes'),
          method: f.method.value,
          accept: true,
        }),
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(json.error || 'No se pudo crear el pedido.');
      App.cart.clear();
      if (json.redirect.startsWith('/')) App.go(json.redirect);
      else location.href = json.redirect; // Stripe's hosted payment page
    } catch (err) {
      status.textContent = err.message;
      btn.disabled = false;
    }
  },
};
