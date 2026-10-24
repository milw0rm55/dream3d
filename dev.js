/**
 * Test mode helpers (npm run dev). Nothing here is loaded in production.
 * - devStripe: same interface the payments service uses; checkout pages are local and a "paid" click
 *   sends a correctly signed webhook through the real verification code.
 * - mailbox: an email transport that keeps messages in memory, shown at /dev.
 */
const crypto = require('crypto');
const Stripe = require('stripe');

const WEBHOOK_SECRET = 'whsec_dev_mode_only';

function createDevStripe(siteUrl) {
  const sdk = Stripe('sk_test_dev_mode_offline'); // used only to sign/verify webhooks: no network calls
  const sessions = new Map();
  return {
    webhookSecret: WEBHOOK_SECRET,
    sessions,
    webhooks: sdk.webhooks,
    checkout: {
      sessions: {
        async create(params) {
          const id = `cs_dev_${crypto.randomBytes(8).toString('hex')}`;
          sessions.set(id, params);
          return { id, url: `${siteUrl}/dev/pago/${id}` };
        },
      },
    },
  };
}

function createMailbox() {
  const messages = [];
  return {
    messages,
    async sendMail(m) {
      messages.unshift({ ...m, at: new Date() });
      messages.length = Math.min(messages.length, 100);
      return { messageId: `dev-${messages.length}` };
    },
  };
}

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const eur = cents => (cents / 100).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

function page(title, body) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${esc(title)}</title>
<link rel="stylesheet" href="/css/fonts.css"><link rel="stylesheet" href="/theme.css">
<style>
  body{font-family:var(--font-body);background:var(--bg);color:var(--text);margin:0;padding:2rem 1rem}
  main{max-width:820px;margin:0 auto;display:flex;flex-direction:column;gap:1rem}
  h1{font-weight:300;letter-spacing:-.04em;font-size:2.2rem;margin:0}
  .tag{display:inline-block;background:#E8740C;color:#fff;border-radius:4px;padding:.1em .5em;font-size:.75rem;font-weight:600}
  .box{border:2px solid var(--ink);border-radius:11px;padding:1rem 1.2rem}
  .muted{color:var(--text-muted);font-size:.85rem}
  table{width:100%;border-collapse:collapse} td{padding:.4rem 0;border-bottom:1px solid var(--line)} td:last-child{text-align:right}
  button,.btn{font:inherit;padding:.8em 1.4em;border-radius:6px;border:2px solid var(--ink);cursor:pointer;text-decoration:none;display:inline-block}
  .pay{background:var(--ink);color:var(--on-ink)} .cancel{background:var(--surface);color:var(--ink)}
  details{border:2px solid var(--line);border-radius:11px;padding:.8rem 1rem} summary{cursor:pointer}
  iframe{width:100%;height:520px;border:1px solid var(--line);border-radius:8px;background:#fff;margin-top:.8rem}
  a{color:inherit}
</style></head><body><main>${body}</main></body></html>`;
}

function registerDevRoutes(app, { stripe, mailbox, payments, siteUrl }) {
  // simulated Stripe Checkout page
  app.get('/dev/pago/:id', (req, res) => {
    const s = stripe.sessions.get(req.params.id);
    if (!s) return res.status(404).send(page('Pago no encontrado', '<h1>Sesión de pago no encontrada</h1><p class="muted">Las sesiones simuladas se pierden al reiniciar el servidor de pruebas.</p>'));
    const total = s.line_items.reduce((t, l) => t + l.price_data.unit_amount * l.quantity, 0);
    res.send(page('Pago simulado', `
      <p><span class="tag">MODO PRUEBAS</span> Esto sustituye a la página de Stripe: no se cobra nada.</p>
      <h1>Pagar ${eur(total)}</h1>
      <div class="box"><table>${s.line_items.map(l =>
        `<tr><td>${esc(l.price_data.product_data.name)} × ${l.quantity}</td><td>${eur(l.price_data.unit_amount * l.quantity)}</td></tr>`).join('')}
        <tr><td><strong>Total</strong></td><td><strong>${eur(total)}</strong></td></tr></table>
        <p class="muted">Pedido ${esc(s.metadata.order)}${s.customer_email ? ` · ${esc(s.customer_email)}` : ''}</p></div>
      <form method="post" action="/dev/pago/${esc(req.params.id)}/ok" style="display:flex;gap:.6rem;flex-wrap:wrap">
        <button class="pay" type="submit">Simular pago correcto</button>
        <button class="cancel" type="submit" formaction="/dev/pago/${esc(req.params.id)}/cancelar">Simular que el cliente cancela</button>
      </form>`));
  });

  // "paid": build the event Stripe would send, sign it, and run it through the real webhook handler
  app.post('/dev/pago/:id/ok', async (req, res, next) => {
    try {
      const s = stripe.sessions.get(req.params.id);
      if (!s) return res.status(404).end();
      const payload = JSON.stringify({
        id: `evt_dev_${crypto.randomBytes(6).toString('hex')}`, object: 'event', type: 'checkout.session.completed',
        data: { object: {
          id: req.params.id, object: 'checkout.session', payment_status: 'paid',
          amount_total: s.line_items.reduce((t, l) => t + l.price_data.unit_amount * l.quantity, 0),
          payment_intent: `pi_dev_${crypto.randomBytes(6).toString('hex')}`, metadata: s.metadata,
        } },
      });
      await payments.handleWebhook(payload, stripe.webhooks.generateTestHeaderString({ payload, secret: stripe.webhookSecret }));
      res.redirect(303, s.success_url);
    } catch (err) { next(err); }
  });

  app.post('/dev/pago/:id/cancelar', (req, res) => {
    const s = stripe.sessions.get(req.params.id);
    res.redirect(303, s ? s.cancel_url : '/');
  });

  // mailbox: every email the shop would have sent
  app.get('/dev', (req, res) => {
    const list = mailbox.messages.map(m => `
      <details>
        <summary><strong>${esc(m.subject)}</strong> <span class="muted">→ ${esc(m.to)} · ${m.at.toLocaleTimeString('es-ES')}</span></summary>
        ${m.html ? `<iframe sandbox="allow-popups allow-popups-to-escape-sandbox" srcdoc="${esc(`<base target="_blank">${m.html}`)}"></iframe>` : `<pre style="white-space:pre-wrap">${esc(m.text)}</pre>`}
      </details>`).join('');
    res.send(page('Modo pruebas', `
      <p><span class="tag">MODO PRUEBAS</span> Base de datos <code>data/dev.db</code>, fotos en <code>data/dev-uploads</code>. Pagos y correos simulados.</p>
      <h1>Bandeja de correos de prueba</h1>
      <p><a class="btn cancel" href="/">Abrir la tienda</a> <a class="btn cancel" href="/admin">Abrir el admin</a> <a class="btn cancel" href="/dev">Actualizar</a></p>
      ${list || '<p class="muted">Todavía no se ha enviado ningún correo. Haz un pedido, márcalo como pagado o enviado, o usa el formulario de contacto.</p>'}`));
  });
}

// sample settings so every feature is visible (WhatsApp, transfer, legal pages) — only when nothing is saved yet
const DEV_SITE = {
  whatsapp: '34600000000',
  instagram: 'https://www.instagram.com/',
  email: 'hola@dev.local',
  legalOwner: 'Titular de pruebas',
  legalNif: '00000000T',
  legalAddress: 'Calle de Pruebas 1, 28000 Madrid',
  legalEmail: 'legal@dev.local',
  bankHolder: 'Cuenta de pruebas',
  bankIban: 'ES9121000418450200051332',
};

// injected into store pages so a test tab can't be mistaken for the real shop
const DEV_BANNER = `<script>document.addEventListener('DOMContentLoaded',function(){document.body.insertAdjacentHTML('afterbegin',
'<a href="/dev" style="position:fixed;top:0;left:50%;transform:translateX(-50%);z-index:999;background:#E8740C;color:#fff;font:600 12px system-ui;padding:3px 10px;border-radius:0 0 6px 6px;text-decoration:none">MODO PRUEBAS · ver correos</a>')})</script>`;

module.exports = { createDevStripe, createMailbox, registerDevRoutes, DEV_SITE, DEV_BANNER };
