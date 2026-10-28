// HTTP smoke test of the production-facing routes, against an in-memory database
process.env.DB_FILE = ':memory:';
process.env.SITE_URL = 'https://dream3d.es';
process.env.ADMIN_PASS = 'prueba-admin-123';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { app, repos, mailer, ready } = require('../server');

const emails = [];
mailer.transport = { sendMail: async m => { emails.push(m); } };
const settle = () => new Promise(r => setTimeout(r, 50)); // order emails are sent without blocking the response

let server, base;
const ADMIN = { 'x-admin-pass': 'prueba-admin-123', 'Content-Type': 'application/json' };
const get = path => fetch(base + path, { redirect: 'manual' });
const post = (path, body, headers = { 'Content-Type': 'application/json' }) =>
  fetch(base + path, { method: 'POST', headers, body: JSON.stringify(body) });

before(async () => {
  await ready();
  await repos.products.create({ id: 1, name: 'Caballero <Épico>', tag: 'Videojuegos', price: 25, stock: 0, desc: 'Figura de caballero' });
  await repos.products.create({ id: 2, name: 'Oculto', price: 10, active: false });
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

test('home: SEO head, JSON-LD and site texts are server-rendered', async () => {
  const res = await get('/');
  const html = await res.text();
  assert.equal(res.status, 200);
  assert.match(html, /<link rel="canonical" href="https:\/\/dream3d.es\/">/);
  assert.match(html, /<meta name="description" content="[^"]+">/);
  assert.match(html, /"@type":"OnlineStore"/);
  assert.match(html, /window\.SITE = \{/);
  assert.doesNotMatch(html, /<!--HEAD-->/);
});

test('product page: title, Product schema, escaping; inactive or unknown products are real 404s', async () => {
  const html = await (await get('/producto/1')).text();
  assert.match(html, /<title>Caballero &lt;Épico&gt; · dream3d<\/title>/);
  assert.match(html, /"@type":"Product"/);
  assert.match(html, /"availability":"https:\/\/schema.org\/MadeToOrder"/);
  assert.doesNotMatch(html, /Caballero <Épico>/, 'raw product name must never reach the HTML');

  for (const path of ['/producto/2', '/producto/999', '/no-existe']) {
    const res = await get(path);
    assert.equal(res.status, 404, path);
    assert.match(await res.text(), /<meta name="robots" content="noindex">/);
  }
  assert.equal((await get('/aviso-legal')).status, 200);
  assert.equal((await get('/dev')).status, 404, 'test-mode pages do not exist outside npm run dev');
  assert.equal((await fetch(base + '/dev/pago/x/ok', { method: 'POST' })).status, 404);
});

test('robots.txt and sitemap.xml list only public, active pages', async () => {
  const robots = await (await get('/robots.txt')).text();
  assert.match(robots, /Disallow: \/admin/);
  assert.match(robots, /Sitemap: https:\/\/dream3d.es\/sitemap.xml/);
  const sitemap = await (await get('/sitemap.xml')).text();
  assert.match(sitemap, /<loc>https:\/\/dream3d.es\/producto\/1<\/loc>/);
  assert.doesNotMatch(sitemap, /producto\/2/);
  assert.match(sitemap, /privacidad/);
});

test('analytics: records real visits, ignores bots, rejects junk', async () => {
  assert.equal((await post('/api/stats', { path: '/producto/1', ref: 'https://www.google.com/search' })).status, 204);
  assert.equal((await post('/api/stats', { path: '/', event: 'whatsapp' })).status, 204);
  assert.equal((await post('/api/stats', { path: '/' }, { 'Content-Type': 'application/json', 'User-Agent': 'Googlebot/2.1' })).status, 204);
  assert.equal((await post('/api/stats', { path: 'javascript:alert(1)' })).status, 400);
  const s = await repos.analytics.summary(30);
  assert.equal(s.totals.views, 1);
  assert.equal(s.totals.whatsapp, 1);
  assert.deepEqual(s.referrers, [{ referrer: 'google.com', n: 1 }]);
});

test('forms: bots that submit too fast or fill the honeypot are silently dropped', async () => {
  const msg = { name: 'Ana', email: 'ana@correo.es', message: 'Quiero un dragón azul', consent: true };
  assert.equal((await post('/api/contact', { ...msg, elapsed: 300 })).status, 201);
  assert.equal((await post('/api/contact', { ...msg, website: 'spam.com', elapsed: 9000 })).status, 201);
  assert.equal((await repos.messages.all()).length, 0);
  assert.equal((await post('/api/contact', { ...msg, elapsed: 9000 })).status, 201);
  assert.equal((await repos.messages.all()).length, 1);
});

test('admin site settings: protected, validated, applied to pages', async () => {
  assert.equal((await fetch(base + '/api/admin/site', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 401);
  const bad = await fetch(base + '/api/admin/site', { method: 'PUT', headers: ADMIN, body: JSON.stringify({ instagram: 'javascript:alert(1)' }) });
  assert.equal(bad.status, 400);
  const ok = await fetch(base + '/api/admin/site', { method: 'PUT', headers: ADMIN, body: JSON.stringify({ brandName: 'dream3d', whatsapp: '+34 612 34 56 78' }) });
  assert.equal((await ok.json()).whatsapp, '34612345678');
  assert.match(await (await get('/contacto')).text(), /<title>Contacto · dream3d<\/title>/);
});

test('checkout by bank transfer: server prices, private order page, IBAN check digits', async () => {
  const badIban = await fetch(base + '/api/admin/site', { method: 'PUT', headers: ADMIN, body: JSON.stringify({ bankIban: 'ES9121000418450200051333' }) });
  assert.equal(badIban.status, 400);
  const okIban = await fetch(base + '/api/admin/site', { method: 'PUT', headers: ADMIN,
    body: JSON.stringify({ brandName: 'dream3d', bankHolder: 'Titular', bankIban: 'es91 2100 0418 4502 0005 1332' }) });
  assert.equal((await okIban.json()).bankIban, 'ES9121000418450200051332');

  const body = {
    items: [{ id: 1, qty: 2, price: 0.01 }],
    customer: { name: 'Ana', email: 'ana@correo.es', phone: '600000000' },
    address: { street: 'Calle Mayor 1', zip: '28013', city: 'Madrid', province: 'Madrid' },
    method: 'tarjeta', accept: true,
  };
  assert.equal((await post('/api/checkout', body)).status, 400, 'card disabled without Stripe keys');
  assert.equal((await post('/api/checkout', { ...body, method: 'transferencia', accept: false })).status, 400);
  const canarias = await post('/api/checkout', { ...body, method: 'transferencia', address: { ...body.address, zip: '35001' } });
  assert.equal(canarias.status, 400, 'free shipping does not reach Canarias, Ceuta or Melilla');
  assert.match((await canarias.json()).error, /Canarias/);

  const res = await post('/api/checkout', { ...body, method: 'transferencia' });
  assert.equal(res.status, 201);
  const { order, redirect } = await res.json();
  assert.match(redirect, /^\/pedido\/F3D-\d+\?t=[0-9a-f]{32}$/);

  const saved = await repos.orders.get(order);
  assert.equal(saved.total, 50, '2 × 25 € from the database, free shipping, browser price ignored');

  assert.equal((await get(`/api/orders/${order}`)).status, 404, 'no token, no order');
  assert.equal((await get(`/api/orders/${order}?t=${'0'.repeat(32)}`)).status, 404);
  const view = await (await get(redirect.replace('/pedido/', '/api/orders/'))).json();
  assert.equal(view.total, 50);
  assert.equal(view.bank.iban, 'ES9121000418450200051332');
  assert.equal(view.bank.concept, order);
  assert.equal(view.customer.email, undefined, 'order page exposes only what it needs');

  const page = await get(redirect);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /<meta name="robots" content="noindex">/);

  await settle();
  const confirmation = emails.find(m => m.to === 'ana@correo.es');
  assert.match(confirmation.subject, new RegExp(`Pedido ${order} recibido`));
  assert.match(confirmation.text, /ES91 2100/);

  emails.length = 0;
  const markPaid = () => fetch(`${base}/api/admin/orders/${order}`, { method: 'PATCH', headers: ADMIN, body: JSON.stringify({ paid: true }) });
  assert.equal((await (await markPaid()).json()).paid, true);
  await markPaid();
  await settle();
  assert.deepEqual(emails.map(m => m.subject), [`Pago recibido · pedido ${order} · dream3d`], 'one payment email, even if marked twice');
});

test('stock: a paid order takes its units once, a refunded-to-unpaid one gives them back, never below 0', async () => {
  await repos.products.create({ id: 50, name: 'Stock', tag: 'Otros', price: 10, stock: 3 });
  const stock = async () => (await repos.products.get(50)).stock;
  const line = { productId: 50, name: 'Stock', qty: 2, price: 10 };
  const o = await repos.orders.create({ customer: { name: 'Eva' }, items: [line], total: 20 });

  assert.ok(await repos.orders.markPaid(o.id, { method: 'tarjeta' }));
  assert.equal(await stock(), 1);
  assert.ok(!(await repos.orders.markPaid(o.id, { method: 'tarjeta' })), 'duplicate webhook');
  assert.equal(await stock(), 1, 'not taken twice');

  await repos.orders.update(o.id, { paid: false });
  assert.equal(await stock(), 3, 'un-marking gives the units back');

  const big = await repos.orders.create({ customer: { name: 'Hugo' }, items: [{ ...line, qty: 5 }], total: 50 });
  await repos.orders.markPaid(big.id, { method: 'transferencia' });
  assert.equal(await stock(), 0, 'stock never goes negative');

  const quote = await repos.orders.create({ customer: { name: 'Ana' }, items: [{ name: 'Presupuesto', qty: 1, price: 30 }], total: 30 });
  await repos.orders.markPaid(quote.id, { method: 'transferencia' });
  assert.equal(await stock(), 0, 'lines without a product are skipped');
});

test('shipping: tracking code is validated, stored, emailed and shown on the customer order page', async () => {
  const o = await repos.orders.create({ customer: { name: 'Luis', email: 'luis@correo.es' }, items: [{ name: 'Figura', qty: 1, price: 20 }], total: 20, paid: true });
  const ship = code => fetch(`${base}/api/admin/orders/${o.id}/ship`, { method: 'POST', headers: ADMIN, body: JSON.stringify({ trackingCode: code }) });

  assert.equal((await ship('<script>')).status, 400);
  emails.length = 0;
  const r = await (await ship('pq4f6p0712345670128001x')).json();
  assert.equal(r.emailed, true);
  assert.equal(r.order.status, 'en-camino');
  assert.equal(r.order.trackingCode, 'PQ4F6P0712345670128001X');
  assert.match(emails[0].text, /PQ4F6P0712345670128001X/);

  await ship('PQ4F6P0712345670128002X'); // corrected code: stored and the customer is told again
  assert.equal(emails.length, 2);
  const view = await (await get(`/api/orders/${o.id}?t=${o.accessToken}`)).json();
  assert.equal(view.tracking.code, 'PQ4F6P0712345670128002X');
  assert.match(view.tracking.url, /correos\.es.*tracking-number=PQ4F6P0712345670128002X/);
});

test('admin and self-hosted assets are served', async () => {
  assert.equal((await get('/admin')).status, 200);
  assert.equal((await get('/admin/')).status, 200);
  assert.equal((await get('/favicon.svg')).status, 200);
  assert.equal((await get('/fonts/work-sans-latin-400-normal.woff2')).status, 200);
  assert.equal((await get('/vendor/three/build/three.module.min.js')).status, 200);
  assert.equal((await get('/vendor/chart.js/chart.umd.js')).status, 200);
});

test('public product list hides unpublished products', async () => {
  const list = await (await get('/api/products')).json();
  assert.ok(list.some(p => p.id === 1));
  assert.ok(!list.some(p => p.id === 2), 'product 2 is inactive');
});

// keep last: it spends the wrong-password budget of this IP
test('admin login: wrong passwords are limited, the right one is never blocked', async () => {
  const wrong = { 'x-admin-pass': 'adivina', 'Content-Type': 'application/json' };
  // earlier tests in this file already used some of this IP's budget, so count tries until the 429
  let status, tries = 0;
  do { status = (await fetch(base + '/api/admin/products', { headers: wrong })).status; tries++; } while (status === 401 && tries < 20);
  assert.equal(status, 429);
  assert.ok(tries <= 10, `limit after ${tries} wrong tries`);
  assert.equal((await fetch(base + '/api/admin/products', { headers: ADMIN })).status, 200);
});
