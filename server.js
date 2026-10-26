const path    = require('path');
const fs      = require('fs');
const crypto  = require('crypto');

// secrets (SMTP, admin password) live in .env, never in the config files
if (fs.existsSync(path.join(__dirname, '.env'))) process.loadEnvFile(path.join(__dirname, '.env'));

const express    = require('express');
const nodemailer = require('nodemailer');
const theme      = require('./config/theme');
const mailConfig = require('./config/mail');
const { createSqliteDb }     = require('./db/sqlite');
const { migrate }            = require('./db/schema');
const { createRepositories } = require('./db/repositories');
const { importJsonOnce }     = require('./db/import-json');
const { createPayments, userError } = require('./payments');
const { createMailer, trackingLink } = require('./mailer');

// `npm run dev` (= node server.js --dev): test mode with its own database and uploads, simulated card
// payments and an in-app mailbox. Real Stripe/SMTP keys in .env are ignored. Refuses to run in production.
const DEV = process.argv.includes('--dev');

const app  = express();
app.set('trust proxy', 'loopback'); // real client IP for the rate limiter when nginx proxies on the same host
const PORT = process.env.PORT || (DEV ? 3001 : 3000);
const ADMIN_PASS = process.env.ADMIN_PASS || (DEV ? 'forma3d-admin' : '');

const DATA_DIR     = path.join(__dirname, 'data');
const PUBLIC_DIR   = path.join(__dirname, 'public');
const UPLOADS_ROOT = DEV ? path.join(DATA_DIR, 'dev-uploads') : path.join(PUBLIC_DIR, 'uploads');
const UPLOAD_DIR   = path.join(UPLOADS_ROOT, 'products');
const pricingDefaults = require('./config/pricing');
const siteDefaults    = require('./config/site');
const SITE_URL   = DEV ? `http://localhost:${PORT}` : (process.env.SITE_URL || 'https://dream3d.es').replace(/\/+$/, '');
const SITE_HOSTS = [new URL(SITE_URL).hostname.replace(/^www\./, ''), 'localhost', '127.0.0.1'];

// the only engine-specific line: swap for a Postgres adapter with the same contract to change infrastructure
const db    = createSqliteDb(process.env.DB_FILE || path.join(DATA_DIR, DEV ? 'dev.db' : 'forma3d.db'));
const repos = createRepositories(db);

const MEDIA_SLOTS    = ['front', 'right', 'back', 'left', 'stl'];
const ORDER_STATUSES = ['pendiente', 'preparando', 'en-camino', 'entregado'];
const MAX_IMAGE_B    = 10 * 1024 * 1024;
const MAX_STL_B      = 200 * 1024 * 1024; // STL and photo uploads

// Express 4 doesn't catch rejected promises from async handlers
const h = fn => (req, res, next) => fn(req, res, next).catch(next);

// notes and cost breakdown never leave the admin API
function publicProduct({ notes, pricing, ...rest }) {
  return rest;
}

// identify uploads by content, not by name or declared type
function sniffMedia(buf, slot) {
  if (slot === 'stl') {
    if (buf.length >= 84) {
      const tris = buf.readUInt32LE(80);
      if (tris > 0 && buf.length === 84 + tris * 50) return 'stl';
    }
    const head = buf.subarray(0, 256).toString('latin1').trimStart();
    return head.startsWith('solid') && buf.includes('facet') ? 'stl' : null;
  }
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return 'jpg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))) return 'png';
  if (buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp';
  return null;
}

function removeMediaFile(url) {
  if (!url || !url.startsWith('/uploads/')) return;
  const file = path.resolve(UPLOADS_ROOT, '.' + url.slice('/uploads'.length));
  if (file.startsWith(UPLOAD_DIR + path.sep)) fs.rmSync(file, { force: true });
}

// small in-memory limiter for public forms: `max` hits per `windowMs` per IP
function rateLimit(max, windowMs) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const recent = (hits.get(req.ip) || []).filter(t => now - t < windowMs);
    if (recent.length >= max) return res.status(429).json({ error: 'Demasiados envíos. Inténtalo más tarde.' });
    recent.push(now);
    hits.set(req.ip, recent);
    next();
  };
}

const cleanLine = (v, max) => String(v ?? '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, max);
const cleanText = (v, max) => String(v ?? '').replace(/\r\n/g, '\n').trim().slice(0, max);
const EMAIL_RE  = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// forms filled faster than a human can type are bots; old clients that don't send the field still pass
const tooFast = body => Number.isFinite(Number(body && body.elapsed)) && Number(body.elapsed) < 2500;

// ISO 13616 check digits (mod 97), so a typo in the IBAN can't send transfers to nowhere
function validIban(iban) {
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) return false;
  const digits = (iban.slice(4) + iban.slice(0, 4)).replace(/[A-Z]/g, ch => String(ch.charCodeAt(0) - 55));
  return BigInt(digits) % 97n === 1n;
}

async function getSite() {
  return { ...siteDefaults, ...(await repos.settings.get('site', {})) };
}

// ── mail and payments (simulated in test mode) ───────────
const devKit = DEV ? require('./dev') : null;
const mailbox = DEV ? devKit.createMailbox() : null;
const devStripe = DEV ? devKit.createDevStripe(SITE_URL) : null;

const transporter = DEV ? mailbox : (mailConfig.smtp.host && mailConfig.smtp.user && mailConfig.smtp.pass) ? nodemailer.createTransport({
  host: mailConfig.smtp.host,
  port: mailConfig.smtp.port,
  secure: mailConfig.smtp.secure,
  auth: { user: mailConfig.smtp.user, pass: mailConfig.smtp.pass },
}) : null;
const OWNER_TO  = DEV ? 'tienda@dev.local' : mailConfig.to;
const MAIL_FROM = DEV ? 'dream3d (pruebas) <tienda@dev.local>' : mailConfig.from;
const mailReady = !!(transporter && OWNER_TO); // contact form needs a recipient; order emails go to the customer
const mailer = createMailer({ transport: transporter, from: MAIL_FROM, ownerTo: OWNER_TO, siteUrl: SITE_URL, getSite });

// card payments only exist when the Stripe keys are in .env
const WEBHOOK_SECRET = DEV ? devStripe.webhookSecret : (process.env.STRIPE_WEBHOOK_SECRET || '');
const payments = createPayments({
  stripe: DEV ? devStripe : process.env.STRIPE_SECRET_KEY ? require('stripe')(process.env.STRIPE_SECRET_KEY) : null,
  webhookSecret: WEBHOOK_SECRET,
  repos,
  siteUrl: SITE_URL,
  shipping: { cost: siteDefaults.shippingCost, freeFrom: siteDefaults.freeShippingFrom },
  onPaid: order => mailer.paymentReceived(order),
});

// ── Stripe webhook: needs the raw body to verify the signature, so it goes before express.json ──
app.post('/api/stripe/webhook', express.raw({ type: 'application/json', limit: '1mb' }), h(async (req, res) => {
  if (!payments.cardEnabled || !WEBHOOK_SECRET) return res.status(404).end();
  try {
    await payments.handleWebhook(req.body, req.get('stripe-signature'));
  } catch (err) {
    if (err.type === 'StripeSignatureVerificationError') return res.status(400).send('Firma no válida');
    throw err;
  }
  res.json({ received: true });
}));

app.use(express.json());

if (DEV) devKit.registerDevRoutes(app, { stripe: devStripe, mailbox, payments, siteUrl: SITE_URL });

// ── /theme.css ─────────────────────────────────────────
app.get('/theme.css', (req, res) => {
  const c = theme.colors;
  const r = theme.radius;
  const s = theme.spacing;
  const m = theme.motion;

  const palette = (p, scheme) => `
  color-scheme: ${scheme};
  --ink:           ${p.ink};
  --bg:            ${p.paper};
  --surface:       ${p.paper};
  --surface-alt:   ${p.surfaceAlt};
  --text:          ${p.ink};
  --text-muted:    ${p.textMuted};
  --line:          ${p.line};
  --border:        ${p.line};
  --accent:        ${p.accent};
  --accent-strong: ${p.accentStrong};
  --on-ink:        ${p.onInk};
  --inverse-bg:    ${p.inverseBg};
  --inverse-fg:    ${p.inverseFg};
  --success:       ${p.success};
  --danger:        ${p.danger};
  --yellow:      ${p.accent};
  --yellow-dark: ${p.accentStrong};
  --blue:        ${p.ink};
  --lime-deep:   ${p.success};`;
  const light = palette(c, 'light');
  const dark  = palette(c.dark, 'dark');

  // data-theme on <html>: "light" | "dark" | "auto"; absent = config default
  const mode = ['light', 'dark'].includes(theme.defaultMode) ? theme.defaultMode : 'auto';
  const autoSelectors = mode === 'auto' ? ':root[data-theme="auto"], :root:not([data-theme])' : ':root[data-theme="auto"]';

  const css = `
:root {${light}
}
:root[data-theme="dark"]${mode === 'dark' ? ', :root:not([data-theme])' : ''} {${dark}
}
@media (prefers-color-scheme: dark) {
  ${autoSelectors} {${dark}
  }
}
:root {
  --r-sm:   ${r.sm};
  --r-md:   ${r.md};
  --r-lg:   ${r.lg};
  --r-xl:   ${r.xl};
  --r-pill: ${r.pill};
  --nav-h:  ${s.navHeight};

  --ease-out: ${m.easeOut};
  --dur-fast: ${m.fast};
  --dur-base: ${m.base};

  --font-display: '${theme.fonts.display}', system-ui, sans-serif;
  --font-body:    '${theme.fonts.body}', system-ui, sans-serif;
}`.trim();

  res.setHeader('Content-Type', 'text/css');
  res.send(css);
});

// ── /config.json ────────────────────────────────────────
app.get('/config.json', (req, res) => {
  res.json({ blobatarColors: theme.colors.blobatar, fonts: theme.fonts, defaultMode: theme.defaultMode || 'auto' });
});

// ── PUBLIC: GET /api/products ────────────────────────────
app.get('/api/products', h(async (req, res) => {
  res.json((await repos.products.all()).filter(p => p.active).map(publicProduct));
}));

// ── PUBLIC: reviews (only approved ones are public) ─────
app.get('/api/products/:id/reviews', h(async (req, res) => {
  const list = await repos.reviews.approvedFor(Number(req.params.id));
  res.json(list.map(({ name, stars, text, date, badge }) => ({ name, stars, text, date, badge })));
}));

app.post('/api/products/:id/reviews', rateLimit(5, 10 * 60 * 1000), h(async (req, res) => {
  const { name, stars, text, website } = req.body || {};
  if (website || tooFast(req.body)) return res.status(202).json({ ok: true, pending: true }); // bot: pretend success
  const product = await repos.products.get(Number(req.params.id));
  const n = Number(stars);
  if (!product || !cleanLine(name, 60) || !cleanText(text, 500) || !(n >= 1 && n <= 5)) {
    return res.status(400).json({ error: 'Completa nombre, valoración y reseña.' });
  }
  await repos.reviews.create({
    id: crypto.randomUUID(),
    productId: product.id,
    name: cleanLine(name, 60),
    stars: Math.round(n),
    text: cleanText(text, 500),
    date: new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }),
    createdAt: new Date().toISOString(),
    status: 'pending',
  });
  res.status(202).json({ ok: true, pending: true });
}));

// ── PUBLIC: contact form ─────────────────────────────────
app.post('/api/contact', rateLimit(5, 60 * 60 * 1000), h(async (req, res) => {
  const { name, email, message, consent, website } = req.body || {};
  if (website || tooFast(req.body)) return res.status(201).json({ ok: true });
  const clean = {
    name: cleanLine(name, 80),
    email: cleanLine(email, 120),
    message: cleanText(message, 3000),
  };
  if (!clean.name || !EMAIL_RE.test(clean.email) || clean.message.length < 10) {
    return res.status(400).json({ error: 'Revisa el nombre, el correo y el mensaje (mínimo 10 caracteres).' });
  }
  if (consent !== true) return res.status(400).json({ error: 'Tienes que aceptar el uso de tus datos para poder responderte.' });

  const entry = { id: crypto.randomUUID(), date: new Date().toISOString(), ...clean, read: false, emailed: false };

  if (mailReady) {
    const { brandName } = await getSite();
    try {
      await transporter.sendMail({
        from: MAIL_FROM,
        to: OWNER_TO,
        replyTo: { name: clean.name, address: clean.email },
        subject: `Nuevo mensaje de ${clean.name} · ${brandName}`,
        text: `${clean.message}\n\n— ${clean.name} <${clean.email}>\nEnviado desde el formulario de contacto de ${brandName}.`,
      });
      entry.emailed = true;
    } catch (err) {
      entry.mailError = String(err.message || err).slice(0, 200);
      console.error('No se pudo enviar el correo de contacto:', entry.mailError);
    }
  }

  await repos.messages.create(entry);
  res.status(201).json({ ok: true });
}));

// ── PUBLIC: checkout (amounts recalculated from the database) ──
const orderPagePath = o => `/pedido/${o.id}?t=${o.accessToken}`;

app.post('/api/checkout', rateLimit(10, 60 * 60 * 1000), h(async (req, res) => {
  const { items, customer = {}, address = {}, notes, method, accept } = req.body || {};
  const site = await getSite();
  const c = {
    name: cleanLine(customer.name, 80),
    email: cleanLine(customer.email, 120),
    phone: cleanLine(customer.phone, 30),
    address: {
      street: cleanLine(address.street, 160), zip: cleanLine(address.zip, 5),
      city: cleanLine(address.city, 80), province: cleanLine(address.province, 80),
    },
  };
  if (!c.name || !EMAIL_RE.test(c.email) || !c.phone || !c.address.street || !/^\d{5}$/.test(c.address.zip)
      || !c.address.city || !c.address.province) {
    throw userError('Revisa los datos de envío.');
  }
  // free shipping covers the peninsula and Balearics only; Canarias (35, 38), Ceuta (51) and Melilla (52) cost more and need customs papers
  if (/^(35|38|51|52)/.test(c.address.zip)) throw userError('Para Canarias, Ceuta y Melilla escríbeme por WhatsApp y te paso el envío.');
  if (accept !== true) throw userError('Tienes que aceptar las condiciones de venta.');
  if (method === 'tarjeta' && !payments.cardEnabled) throw userError('El pago con tarjeta no está disponible.');
  if (method === 'transferencia' && !site.bankIban) throw userError('La transferencia no está disponible.');
  if (!['tarjeta', 'transferencia'].includes(method)) throw userError('Elige una forma de pago.');

  const priced = await payments.priceCart(items);
  const order = await repos.orders.create({
    customer: c,
    items: priced.lines,
    subtotal: priced.subtotal,
    shipping: priced.shipping,
    total: priced.total,
    paymentMethod: method,
    notes: cleanText(notes, 500),
  });
  const redirect = method === 'tarjeta' ? await payments.checkoutUrl(order) : orderPagePath(order);
  // card orders get their email once Stripe confirms payment; abandoned card checkouts send nothing.
  // Not awaited: a slow SMTP server must not delay the customer.
  if (method === 'transferencia') mailer.orderReceived(order).catch(err => console.error(err));
  res.status(201).json({ order: order.id, redirect });
}));

// ── PUBLIC: a customer's own order (needs the secret token from their link) ──
async function orderForCustomer(req) {
  const order = await repos.orders.get(req.params.code);
  const token = String(req.query.t || (req.body && req.body.t) || '');
  const ok = order && order.accessToken && token.length === order.accessToken.length
    && crypto.timingSafeEqual(Buffer.from(token), Buffer.from(order.accessToken));
  if (!ok) throw userError('Pedido no encontrado', 404);
  return order;
}

app.get('/api/orders/:code', rateLimit(60, 60 * 1000), h(async (req, res) => {
  const o = await orderForCustomer(req);
  const site = await getSite();
  res.json({
    id: o.id, date: o.date, status: o.status, paid: o.paid, paymentMethod: o.paymentMethod,
    items: o.items.map(({ name, qty, price, color }) => ({ name, qty, price, color })),
    subtotal: o.subtotal, shipping: o.shipping, total: o.total,
    customer: { name: o.customer.name, address: o.customer.address || null },
    tracking: o.trackingCode ? { code: o.trackingCode, url: trackingLink(site.trackingUrl, o.trackingCode) || null } : null,
    card: payments.cardEnabled && !o.paid,
    bank: !o.paid && site.bankIban ? { holder: site.bankHolder, iban: site.bankIban, concept: o.id } : null,
  });
}));

app.post('/api/orders/:code/pay', rateLimit(10, 60 * 60 * 1000), h(async (req, res) => {
  const order = await orderForCustomer(req);
  res.json({ redirect: await payments.checkoutUrl(order) });
}));

// ── ADMIN AUTH MIDDLEWARE ────────────────────────────────
// only wrong passwords reach the limiter: 10 per 15 min per IP, then 429 for every wrong try
const adminFailLimit = rateLimit(10, 15 * 60 * 1000);
function requireAdmin(req, res, next) {
  if (!ADMIN_PASS || req.headers['x-admin-pass'] !== ADMIN_PASS) {
    return adminFailLimit(req, res, () => res.status(401).json({ error: 'No autorizado' }));
  }
  next();
}

// ── ADMIN: products ──────────────────────────────────────
app.get('/api/admin/products', requireAdmin, h(async (req, res) => {
  res.json(await repos.products.all());
}));

app.post('/api/admin/products', requireAdmin, h(async (req, res) => {
  const { id, media, ...body } = req.body || {};
  if (!String(body.name || '').trim()) return res.status(400).json({ error: 'Falta el nombre' });
  res.status(201).json(await repos.products.create(body));
}));

app.put('/api/admin/products/:id', requireAdmin, h(async (req, res) => {
  const product = await repos.products.update(Number(req.params.id), req.body || {});
  if (!product) return res.status(404).json({ error: 'not found' });
  res.json(product);
}));

app.delete('/api/admin/products/:id', requireAdmin, h(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'id inválido' });
  await repos.products.remove(id); // its reviews go with it (ON DELETE CASCADE)
  fs.rmSync(path.join(UPLOAD_DIR, String(id)), { recursive: true, force: true });
  res.json({ ok: true });
}));

// ── ADMIN: product media (photos per side + STL) ─────────
app.post('/api/admin/products/:id/media/:slot', requireAdmin,
  express.raw({ type: () => true, limit: MAX_STL_B }),
  h(async (req, res) => {
    const { slot } = req.params;
    if (!MEDIA_SLOTS.includes(slot)) return res.status(400).json({ error: 'Vista inválida' });

    const product = await repos.products.get(Number(req.params.id));
    if (!product) return res.status(404).json({ error: 'not found' });

    const buf = req.body;
    if (!Buffer.isBuffer(buf) || !buf.length) return res.status(400).json({ error: 'Archivo vacío' });
    const ext = sniffMedia(buf, slot);
    if (!ext) return res.status(415).json({ error: slot === 'stl' ? 'El archivo no es un STL válido' : 'Usa JPG, PNG o WebP' });
    if (slot !== 'stl' && buf.length > MAX_IMAGE_B) return res.status(413).json({ error: 'La foto supera 10 MB' });

    const dir = path.join(UPLOAD_DIR, String(product.id));
    fs.mkdirSync(dir, { recursive: true });
    const file = `${slot}-${Date.now()}.${ext}`;
    fs.writeFileSync(path.join(dir, file), buf);

    const updated = await repos.products.setMedia(product.id, slot, `/uploads/products/${product.id}/${file}`);
    removeMediaFile(product.media[slot]); // old file only once the new path is saved
    res.json(updated);
  }));

app.delete('/api/admin/products/:id/media/:slot', requireAdmin, h(async (req, res) => {
  const { slot } = req.params;
  if (!MEDIA_SLOTS.includes(slot)) return res.status(400).json({ error: 'Vista inválida' });
  const product = await repos.products.get(Number(req.params.id));
  if (!product) return res.status(404).json({ error: 'not found' });
  const updated = await repos.products.setMedia(product.id, slot, null);
  removeMediaFile(product.media[slot]);
  res.json(updated);
}));

// ── ADMIN: pricing calculator defaults ───────────────────
app.get('/api/admin/pricing', requireAdmin, h(async (req, res) => {
  res.json({ ...pricingDefaults, ...(await repos.settings.get('pricing', {})) });
}));

app.put('/api/admin/pricing', requireAdmin, h(async (req, res) => {
  const saved = {};
  for (const [k, v] of Object.entries(req.body || {})) {
    if (k === 'material' && typeof v === 'string' && pricingDefaults.densities[v]) saved[k] = v;
    else if (k in pricingDefaults && typeof pricingDefaults[k] === 'number' && Number.isFinite(Number(v))) saved[k] = Number(v);
  }
  await repos.settings.set('pricing', saved);
  res.json({ ...pricingDefaults, ...saved });
}));

// ── ADMIN: review moderation ─────────────────────────────
app.get('/api/admin/reviews', requireAdmin, h(async (req, res) => {
  res.json(await repos.reviews.allWithProduct());
}));

app.patch('/api/admin/reviews/:id', requireAdmin, h(async (req, res) => {
  const status = req.body && req.body.status;
  if (!['approved', 'pending'].includes(status)) return res.status(400).json({ error: 'Estado inválido' });
  const review = await repos.reviews.setStatus(req.params.id, status);
  if (!review) return res.status(404).json({ error: 'not found' });
  res.json(review);
}));

app.delete('/api/admin/reviews/:id', requireAdmin, h(async (req, res) => {
  if (!(await repos.reviews.remove(req.params.id))) return res.status(404).json({ error: 'not found' });
  res.json({ ok: true });
}));

// ── ADMIN: contact messages ──────────────────────────────
app.get('/api/admin/messages', requireAdmin, h(async (req, res) => {
  res.json({
    mail: { configured: mailReady, to: OWNER_TO || null },
    messages: await repos.messages.all(),
  });
}));

app.patch('/api/admin/messages/:id', requireAdmin, h(async (req, res) => {
  if (typeof (req.body && req.body.read) !== 'boolean') return res.status(400).json({ error: 'read debe ser true o false' });
  const msg = await repos.messages.setRead(req.params.id, req.body.read);
  if (!msg) return res.status(404).json({ error: 'not found' });
  res.json(msg);
}));

app.delete('/api/admin/messages/:id', requireAdmin, h(async (req, res) => {
  await repos.messages.remove(req.params.id);
  res.json({ ok: true });
}));

// ── ADMIN: orders ────────────────────────────────────────
app.get('/api/admin/orders', requireAdmin, h(async (req, res) => {
  res.json(await repos.orders.all());
}));

// orders agreed over WhatsApp (custom figures, quotes): the customer then pays from their order link
app.post('/api/admin/orders', requireAdmin, h(async (req, res) => {
  const { name, phone, email, description, amount, shipping, notes } = req.body || {};
  const price = Math.round(Number(amount) * 100) / 100;
  const ship = Math.round((Number(shipping) || 0) * 100) / 100;
  if (!cleanLine(name, 80) || !cleanLine(description, 200)) throw userError('Faltan el nombre del cliente o el concepto.');
  if (!(price > 0) || price > 10000 || ship < 0 || ship > 500) throw userError('Importe no válido.');
  if (email && !EMAIL_RE.test(String(email).trim())) throw userError('Correo no válido.');
  const order = await repos.orders.create({
    customer: { name: cleanLine(name, 80), phone: cleanLine(phone, 30), email: cleanLine(email, 120) },
    items: [{ name: cleanLine(description, 200), qty: 1, price }],
    subtotal: price, shipping: ship, total: price + ship,
    notes: cleanText(notes, 500),
  });
  res.status(201).json(order);
}));

// shipped: store the tracking code, set "en camino" and email the customer (again if the code is corrected)
app.post('/api/admin/orders/:id/ship', requireAdmin, h(async (req, res) => {
  const code = String((req.body && req.body.trackingCode) || '').trim().toUpperCase();
  if (!/^[A-Z0-9-]{5,40}$/.test(code)) throw userError('Código de envío no válido (letras, números y guiones).');
  const order = await repos.orders.markShipped(req.params.id, code);
  if (!order) return res.status(404).json({ error: 'not found' });
  const emailed = await mailer.orderShipped(order);
  res.json({ order, emailed, reason: emailed ? null : (order.customer.email ? 'El correo no está configurado o falló' : 'El pedido no tiene correo') });
}));

app.patch('/api/admin/orders/:id', requireAdmin, h(async (req, res) => {
  const patch = req.body || {};
  if ('status' in patch && !ORDER_STATUSES.includes(patch.status)) return res.status(400).json({ error: 'Estado inválido' });
  if ('paid' in patch && typeof patch.paid !== 'boolean') return res.status(400).json({ error: 'paid debe ser true o false' });
  const current = await repos.orders.get(req.params.id);
  if (!current) return res.status(404).json({ error: 'not found' });

  // unpaid → paid goes through the same atomic step as Stripe, so the customer email is sent exactly once
  const { paid, ...rest } = patch;
  const newlyPaid = paid === true
    ? await repos.orders.markPaid(current.id, { method: current.paymentMethod, ref: current.paymentRef })
    : null;
  const order = await repos.orders.update(current.id, paid === false ? patch : rest);
  if (newlyPaid) mailer.paymentReceived(order, { owner: false }).catch(err => console.error(err));
  res.json(order);
}));

// ── ADMIN: metrics ───────────────────────────────────────
app.get('/api/admin/metrics', requireAdmin, h(async (req, res) => {
  const [orders, products] = await Promise.all([repos.orders.all(), repos.products.all()]);

  const totalRevenue = orders.filter(o => o.paid).reduce((s, o) => s + o.total, 0);
  const byStatus     = { pendiente: 0, preparando: 0, 'en-camino': 0, entregado: 0 };
  orders.forEach(o => { if (byStatus[o.status] !== undefined) byStatus[o.status]++; });

  // revenue by tag
  const byTag = {};
  orders.filter(o => o.paid).forEach(o => {
    o.items.forEach(item => {
      const prod = products.find(p => p.id === item.productId);
      const tag  = prod ? prod.tag : 'Otro';
      byTag[tag] = (byTag[tag] || 0) + item.price * item.qty;
    });
  });

  // weekly revenue (last 5 weeks)
  const weeks = [];
  for (let i = 4; i >= 0; i--) {
    const end   = new Date();
    end.setDate(end.getDate() - i * 7);
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    const label = start.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    const rev   = orders
      .filter(o => o.paid && o.date >= start.toISOString().slice(0,10) && o.date <= end.toISOString().slice(0,10))
      .reduce((s, o) => s + o.total, 0);
    weeks.push({ label, revenue: rev });
  }

  res.json({ totalRevenue, byStatus, byTag, weeklyRevenue: weeks, totalOrders: orders.length, activeProducts: products.filter(p => p.active).length });
}));

// ── ADMIN: site texts, contact and legal data ────────────
app.get('/api/admin/site', requireAdmin, h(async (req, res) => {
  res.json({ ...(await getSite()), cardPayments: payments.cardEnabled });
}));

app.put('/api/admin/site', requireAdmin, h(async (req, res) => {
  const saved = {};
  for (const key of Object.keys(siteDefaults)) {
    const v = req.body && req.body[key];
    if (typeof v === 'string') saved[key] = cleanText(v, 3000);
  }
  if (saved.whatsapp) saved.whatsapp = saved.whatsapp.replace(/\D/g, '');
  for (const key of ['instagram', 'tiktok']) {
    if (saved[key] && !/^https:\/\//.test(saved[key])) return res.status(400).json({ error: `${key}: usa una URL que empiece por https://` });
  }
  if (saved.email && !EMAIL_RE.test(saved.email)) return res.status(400).json({ error: 'Correo de contacto inválido' });
  if (saved.trackingUrl && !(/^https:\/\//.test(saved.trackingUrl) && saved.trackingUrl.includes('{code}'))) {
    return res.status(400).json({ error: 'El enlace de seguimiento debe empezar por https:// e incluir {code}' });
  }
  if (saved.bankIban) {
    saved.bankIban = saved.bankIban.replace(/\s+/g, '').toUpperCase();
    if (!validIban(saved.bankIban)) return res.status(400).json({ error: 'El IBAN no es válido: revisa los dígitos' });
  }
  if (saved.legalEmail && !EMAIL_RE.test(saved.legalEmail)) return res.status(400).json({ error: 'Correo legal inválido' });
  await repos.settings.set('site', saved);
  res.json({ ...(await getSite()), cardPayments: payments.cardEnabled });
}));

// ── analytics (cookieless, aggregated) ───────────────────
const BOT_RE = /bot|crawl|spider|slurp|preview|headless|lighthouse|facebookexternalhit|whatsapp/i;

app.post('/api/stats', rateLimit(120, 60 * 1000), h(async (req, res) => {
  if (BOT_RE.test(req.get('user-agent') || '')) return res.status(204).end();
  const { path: page, ref, event = 'pageview' } = req.body || {};
  if (typeof page !== 'string' || !/^\/[\w\-./%]{0,200}$/.test(page) || !['pageview', 'whatsapp'].includes(event)) {
    return res.status(400).end();
  }
  let referrer = '';
  try {
    const host = new URL(String(ref || '')).hostname.replace(/^www\./, '');
    if (host && !SITE_HOSTS.includes(host)) referrer = host.slice(0, 100);
  } catch { /* no or invalid referrer */ }
  await repos.analytics.record({ path: page, referrer, event });
  res.status(204).end();
}));

app.get('/api/admin/stats', requireAdmin, h(async (req, res) => {
  res.json(await repos.analytics.summary(30));
}));

// ── SEO: robots, sitemap ─────────────────────────────────
const LEGAL_PATHS = ['/aviso-legal', '/privacidad', '/cookies', '/condiciones'];

app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send([
    'User-agent: *',
    'Disallow: /admin', 'Disallow: /api/', 'Disallow: /carrito', 'Disallow: /perfil', 'Disallow: /entrar', 'Disallow: /registro',
    '', `Sitemap: ${SITE_URL}/sitemap.xml`, '',
  ].join('\n'));
});

app.get('/sitemap.xml', h(async (req, res) => {
  const products = (await repos.products.all()).filter(p => p.active);
  const paths = ['/', ...products.map(p => `/producto/${p.id}`), '/contacto', ...LEGAL_PATHS];
  res.type('application/xml').send(
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + paths.map(p => `  <url><loc>${SITE_URL}${p}</loc></url>`).join('\n')
    + '\n</urlset>\n');
}));

app.get('/favicon.ico', (req, res) => res.redirect(301, '/favicon.svg'));
app.get('/index.html', (req, res) => res.redirect(301, '/'));

app.get(['/admin', '/admin/'], (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'admin', 'index.html'));
});

// ── self-hosted libraries and fonts (no third-party requests from visitors' browsers) ──
const vendor = dir => express.static(path.join(__dirname, 'node_modules', dir), { maxAge: '30d' });
app.use('/vendor/three', vendor('three'));
app.use('/vendor/chart.js', vendor('chart.js/dist'));
app.use('/fonts', vendor('@fontsource/work-sans/files'));

// ── static files ─────────────────────────────────────────
// upload names carry a timestamp, so they never change: cache for a year
app.use('/uploads', express.static(UPLOADS_ROOT, { maxAge: '365d', immutable: true, fallthrough: false }));
app.use(express.static(PUBLIC_DIR, { index: false, redirect: false }));

// ── store pages: per-URL title, meta, JSON-LD and real 404s ──
const escHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const inlineJson = v => JSON.stringify(v).replace(/</g, '\\u003c');
let indexCache = null;
const indexHtml = () => (process.env.NODE_ENV === 'production' && indexCache)
  || (indexCache = fs.readFileSync(path.join(PUBLIC_DIR, 'index.html'), 'utf8'));

const PAGES = {
  '/contacto':    { title: 'Contacto', desc: 'Pide tu figura impresa en 3D o pregunta lo que necesites. Respuesta en menos de 24 horas.' },
  '/aviso-legal': { title: 'Aviso legal' },
  '/privacidad':  { title: 'Política de privacidad' },
  '/cookies':     { title: 'Política de cookies' },
  '/condiciones': { title: 'Condiciones de venta' },
  '/carrito':     { title: 'Tu carrito', noindex: true },
  '/entrar':      { title: 'Iniciar sesión', noindex: true },
  '/registro':    { title: 'Crear cuenta', noindex: true },
  '/perfil':      { title: 'Mi perfil', noindex: true },
};

function storeLd(site) {
  const digits = (site.whatsapp || '').replace(/\D/g, '');
  return [
    {
      '@context': 'https://schema.org', '@type': 'OnlineStore',
      name: site.brandName, url: `${SITE_URL}/`, logo: `${SITE_URL}/favicon.svg`,
      description: site.seoDescription,
      ...(site.email ? { email: site.email } : {}),
      ...(digits ? { contactPoint: { '@type': 'ContactPoint', telephone: `+${digits}`, contactType: 'customer service', availableLanguage: 'es' } } : {}),
      sameAs: [site.instagram, site.tiktok].filter(Boolean),
    },
    { '@context': 'https://schema.org', '@type': 'WebSite', name: site.brandName, url: `${SITE_URL}/` },
  ];
}

function productLd(p, site) {
  const url = `${SITE_URL}/producto/${p.id}`;
  const images = ['front', 'right', 'back', 'left'].filter(s => p.media[s]).map(s => SITE_URL + p.media[s]);
  return [
    {
      '@context': 'https://schema.org', '@type': 'Product',
      name: p.name, description: p.desc, sku: String(p.id), category: p.tag, url,
      ...(images.length ? { image: images } : {}),
      brand: { '@type': 'Brand', name: site.brandName },
      offers: {
        '@type': 'Offer', url, priceCurrency: 'EUR', price: p.price.toFixed(2),
        itemCondition: 'https://schema.org/NewCondition',
        // figures are printed on demand when there is no stock
        availability: p.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/MadeToOrder',
        seller: { '@type': 'Organization', name: site.brandName },
      },
    },
    {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Inicio', item: `${SITE_URL}/` },
        { '@type': 'ListItem', position: 2, name: p.name, item: url },
      ],
    },
  ];
}

app.get('*', h(async (req, res) => {
  const site = await getSite();
  const pathname = req.path.replace(/\/+$/, '') || '/';
  const product = /^\/producto\/(\d+)$/.exec(pathname);

  let status = 200, title = site.seoTitle, desc = site.seoDescription, noindex = false, image = null, type = 'website', ld = [];
  if (pathname === '/') {
    ld = storeLd(site);
  } else if (product) {
    const p = await repos.products.get(Number(product[1]));
    if (p && p.active) {
      title = `${p.name} · ${site.brandName}`;
      desc = (p.desc || desc).slice(0, 160);
      image = p.media.front ? SITE_URL + p.media.front : null;
      type = 'product';
      if (p.price > 0) ld = productLd(p, site);
    } else {
      status = 404;
    }
  } else if (/^\/pedido\/F3D-\d+$/.test(pathname)) {
    title = `Tu pedido · ${site.brandName}`;
    noindex = true;
  } else if (PAGES[pathname]) {
    title = `${PAGES[pathname].title} · ${site.brandName}`;
    desc = PAGES[pathname].desc || desc;
    noindex = !!PAGES[pathname].noindex;
  } else {
    status = 404;
  }
  if (status === 404) {
    title = `Página no encontrada · ${site.brandName}`;
    noindex = true;
  }

  const head = [
    `<meta name="description" content="${escHtml(desc)}">`,
    noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${SITE_URL}${pathname === '/' ? '/' : pathname}">`,
    `<meta property="og:type" content="${type}">`,
    `<meta property="og:site_name" content="${escHtml(site.brandName)}">`,
    `<meta property="og:title" content="${escHtml(title)}">`,
    `<meta property="og:description" content="${escHtml(desc)}">`,
    `<meta property="og:url" content="${SITE_URL}${pathname}">`,
    '<meta property="og:locale" content="es_ES">',
    image ? `<meta property="og:image" content="${escHtml(image)}">` : '',
    `<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">`,
    pathname === '/' && site.googleVerification ? `<meta name="google-site-verification" content="${escHtml(site.googleVerification)}">` : '',
    ...ld.map(o => `<script type="application/ld+json">${inlineJson(o)}</script>`),
    `<script>window.SITE = ${inlineJson({ ...site, cardPayments: payments.cardEnabled })};</script>`,
    DEV ? devKit.DEV_BANNER : '',
  ].filter(Boolean).join('\n');

  res.status(status).type('html').send(
    indexHtml()
      .replace(/<title>[\s\S]*?<\/title>/, `<title>${escHtml(title)}</title>`)
      .replace('<!--HEAD-->', head));
}));

app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.expose ? err.message : 'Error interno del servidor' });
});

async function prepare() {
  await migrate(db);
  // test mode: sample WhatsApp, IBAN and legal data so every feature shows up (only if nothing was saved)
  if (DEV && !(await repos.settings.get('site'))) await repos.settings.set('site', devKit.DEV_SITE);
}

async function start() {
  if (process.env.NODE_ENV === 'production' && DEV) throw new Error('El modo pruebas (--dev) no puede usarse en producción');
  if (!DEV && (!process.env.ADMIN_PASS || process.env.ADMIN_PASS === 'forma3d-admin')) {
    throw new Error('Define ADMIN_PASS en .env con una contraseña propia (no puede ser la de ejemplo ni estar vacía)');
  }
  await prepare();
  const imported = await importJsonOnce(db, repos, DATA_DIR);
  if (Object.keys(imported).length) console.log('Datos importados desde data/*.json:', imported);

  // HOST=127.0.0.1 in production so only nginx can reach the app
  app.listen(PORT, process.env.HOST, () => {
    if (DEV) {
      console.log(`MODO PRUEBAS en http://localhost:${PORT}  ·  correos y pagos simulados en http://localhost:${PORT}/dev`);
      console.log('Datos de prueba en data/dev.db y data/dev-uploads (bórralos para empezar de cero). Stripe y SMTP reales: ignorados.');
    } else {
      console.log(`Forma3D corriendo en http://localhost:${PORT}`);
    }
    console.log(`Admin panel: http://localhost:${PORT}/admin${DEV ? '  (pass por defecto: forma3d-admin)' : ''}`);
    if (!DEV) console.log(mailReady
      ? `Correo: formulario y avisos de pedidos a ${OWNER_TO}; confirmaciones a cada cliente`
      : transporter
        ? 'Correo: confirmaciones a clientes activas; falta CONTACT_TO para el formulario y tus avisos'
        : 'Correo sin configurar (ver .env.example): no se envían confirmaciones; los mensajes solo se guardan en el admin');
  });
}

if (require.main === module) {
  start().catch(err => {
    console.error('No se pudo arrancar:', err);
    process.exit(1);
  });
}

module.exports = { app, db, repos, payments, mailer, mailbox, ready: prepare };
