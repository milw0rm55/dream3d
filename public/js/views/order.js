// Customer order page: /pedido/F3D-0043?t=<secret token>. Payment state comes only from the server (Stripe webhook).
const OrderView = {
  _polls: 0,

  render() {
    return `
<div class="view active" id="view-order">
  <div class="order-wrap" id="orderBox" aria-live="polite"><p class="form-note">Cargando tu pedido…</p></div>
</div>`;
  },

  async afterMount(param) {
    const url = new URL(param, location.origin);
    this._code = url.pathname.split('/').pop();
    this._token = url.searchParams.get('t') || '';
    this._result = url.searchParams.get('pago');
    this._polls = 0;
    await this._load();
  },

  async _load() {
    const box = document.getElementById('orderBox');
    if (!box) return;
    try {
      const r = await fetch(`/api/orders/${encodeURIComponent(this._code)}?t=${encodeURIComponent(this._token)}`);
      if (!r.ok) throw new Error();
      const order = await r.json();
      box.innerHTML = this._html(order);
      // back from Stripe before its confirmation arrived: check again for a short while
      if (this._result === 'ok' && !order.paid && this._polls++ < 10) setTimeout(() => this._load(), 2000);
    } catch (e) {
      box.innerHTML = `<h1>Pedido no encontrado</h1><p class="form-note">Revisa que el enlace esté completo o <a data-wa href="${escapeHtml(waLink(`Hola, no puedo abrir mi pedido ${this._code}`))}" target="_blank" rel="noopener">escríbeme por WhatsApp</a>.</p>`;
    }
  },

  _html(o) {
    const status = { pendiente: 'Pendiente', preparando: 'Preparando', 'en-camino': 'En camino', entregado: 'Entregado' }[o.status] || o.status;
    let banner;
    if (o.tracking) banner = `<p class="order-banner ok">Tu pedido está en camino. Código de seguimiento: <strong>${escapeHtml(o.tracking.code)}</strong>${o.tracking.url ? ` · <a href="${escapeHtml(o.tracking.url)}" target="_blank" rel="noopener">seguir el envío</a>` : ''}</p>`;
    else if (o.paid) banner = `<p class="order-banner ok">Pago recibido. ¡Gracias! Te escribiré para avisarte cuando tu pedido salga.</p>`;
    else if (this._result === 'ok') banner = `<p class="order-banner">Estamos confirmando tu pago con el banco… esta página se actualiza sola.</p>`;
    else if (this._result === 'cancelado') banner = `<p class="order-banner warn">El pago no se completó. Puedes intentarlo de nuevo cuando quieras.</p>`;
    else banner = `<p class="order-banner">Este pedido está pendiente de pago.</p>`;

    const pay = o.paid ? '' : `
      <div class="order-pay">
        ${o.card ? `
          <button class="btn-primary" type="button" onclick="OrderView.payCard(this)">pagar ${formatPrice(o.total)} con tarjeta, Apple Pay o Google Pay</button>
          <p class="form-status" role="status"></p>` : ''}
        ${o.bank ? `
          <div class="bank-box">
            <h2>Pago por transferencia</h2>
            <dl>
              <dt>Titular</dt><dd>${escapeHtml(o.bank.holder || '—')}</dd>
              <dt>IBAN</dt><dd><code>${escapeHtml(o.bank.iban.replace(/(.{4})/g, '$1 ').trim())}</code></dd>
              <dt>Importe</dt><dd>${formatPrice(o.total)}</dd>
              <dt>Concepto</dt><dd><code>${escapeHtml(o.bank.concept)}</code></dd>
            </dl>
            <p class="form-note">Prepararemos tu pedido en cuanto recibamos la transferencia (puede tardar 1 o 2 días laborables). Si no llega en 7 días, el pedido se cancela.</p>
          </div>` : ''}
      </div>`;

    const a = o.customer.address;
    return `
      <h1>Pedido ${escapeHtml(o.id)}</h1>
      <p class="form-note">${escapeHtml(new Date(o.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }))} · Estado: ${escapeHtml(status)}</p>
      ${banner}
      ${pay}
      <table class="order-lines">
        <tbody>
          ${o.items.map(i => `<tr><td>${escapeHtml(i.name)}${i.qty > 1 ? ` × ${i.qty}` : ''}</td><td>${formatPrice(i.price * i.qty)}</td></tr>`).join('')}
          <tr><td>Envío</td><td>${o.shipping ? formatPrice(o.shipping) : 'Gratis'}</td></tr>
          <tr class="sum"><td>Total</td><td>${formatPrice(o.total)}</td></tr>
        </tbody>
      </table>
      ${a ? `<p class="form-note">Envío a: ${escapeHtml(o.customer.name)}, ${escapeHtml(a.street)}, ${escapeHtml(a.zip)} ${escapeHtml(a.city)} (${escapeHtml(a.province)})</p>` : ''}
      <p class="form-note">Guarda este enlace para consultar tu pedido. ¿Alguna duda? <a data-wa href="${escapeHtml(waLink(`Hola, tengo una duda sobre mi pedido ${o.id}`))}" target="_blank" rel="noopener">Escríbeme por WhatsApp</a>.</p>`;
  },

  async payCard(btn) {
    const status = btn.nextElementSibling;
    btn.disabled = true;
    status.textContent = 'Abriendo la página de pago…';
    try {
      const r = await fetch(`/api/orders/${encodeURIComponent(this._code)}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ t: this._token }),
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(json.error || 'No se pudo abrir el pago.');
      location.href = json.redirect;
    } catch (err) {
      status.textContent = err.message;
      btn.disabled = false;
    }
  },
};
