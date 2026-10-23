const ContactForm = {
  html() {
    return `
<form class="contact-form" novalidate onsubmit="ContactForm.submit(event)" data-started="${Date.now()}">
  <div class="contact-grid">
    <div class="form-group">
      <label for="cfName">Nombre</label>
      <input id="cfName" name="name" maxlength="80" autocomplete="name" required>
    </div>
    <div class="form-group">
      <label for="cfEmail">Correo electrónico</label>
      <input id="cfEmail" name="email" type="email" maxlength="120" autocomplete="email" required>
    </div>
    <div class="form-group full">
      <label for="cfMessage">Mensaje</label>
      <textarea id="cfMessage" name="message" rows="5" maxlength="3000" required
        placeholder="Cuéntame qué figura quieres, el tamaño, los colores…"></textarea>
    </div>
  </div>
  <input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
  <label class="consent">
    <input type="checkbox" name="consent" required>
    <span>Acepto que mis datos se usen solo para responder a este mensaje, según la <a href="/privacidad" data-link>política de privacidad</a>.</span>
  </label>
  <div class="form-actions">
    <button class="btn-primary" type="submit">enviar mensaje</button>
    <p class="form-status" role="status"></p>
  </div>
</form>`;
  },

  async submit(e) {
    e.preventDefault();
    const form = e.target;
    const status = form.querySelector('.form-status');
    const btn = form.querySelector('button[type=submit]');
    const data = {
      name: form.name.value.trim(),
      email: form.email.value.trim(),
      message: form.message.value.trim(),
      consent: form.consent.checked,
      website: form.website.value,
      elapsed: Date.now() - Number(form.dataset.started),
    };

    if (!data.name) return this._fail(form.name, status, 'Escribe tu nombre.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email)) return this._fail(form.email, status, 'Revisa el correo electrónico.');
    if (data.message.length < 10) return this._fail(form.message, status, 'El mensaje es muy corto (mínimo 10 caracteres).');
    if (!data.consent) return this._fail(form.consent, status, 'Marca la casilla para que pueda responderte.');

    btn.disabled = true;
    status.textContent = 'Enviando…';
    try {
      const r = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(json.error || 'No se pudo enviar el mensaje.');
      form.reset();
      status.textContent = '¡Mensaje enviado! Te responderé en menos de 24 horas.';
    } catch (err) {
      status.textContent = err.message;
    } finally {
      btn.disabled = false;
    }
  },

  _fail(field, status, msg) {
    status.textContent = msg;
    field.focus();
  },
};

const ContactView = {
  render() {
    return `
<div id="view-contact" class="view active">
  <div class="contact-wrap">
    <h1>contacto</h1>
    <p class="contact-sub">${siteLines('ctaText')}</p>
    ${SITE.whatsapp ? `<p><a class="btn-primary btn-cta" data-wa href="${escapeHtml(waLink())}" target="_blank" rel="noopener">${siteText('ctaButton')}</a></p>
    <p class="contact-alt">o, si lo prefieres, escríbeme un correo:</p>` : ''}
    ${ContactForm.html()}
  </div>
</div>`;
  },
};
