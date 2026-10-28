// Test mode end to end: card checkout → simulated Stripe page → signed webhook → paid + emails in the mailbox
process.env.DB_FILE = ':memory:';
process.argv.push('--dev');

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { app, repos, mailbox, ready } = require('../server');

let server, base;
before(async () => {
  await ready();
  await repos.products.create({ id: 1, name: 'Caballero', price: 25 });
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const checkout = method => fetch(`${base}/api/checkout`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    items: [{ id: 1, qty: 1 }], method, accept: true,
    customer: { name: 'Ana', email: 'ana@correo.es', phone: '600000000' },
    address: { street: 'Calle Mayor 1', zip: '28013', city: 'Madrid', province: 'Madrid' },
  }),
}).then(r => r.json());

test('dev settings are seeded so card and transfer are both available', async () => {
  const html = await (await fetch(base + '/')).text();
  assert.match(html, /"cardPayments":true/);
  assert.match(html, /"bankIban":"ES9121000418450200051332"/);
  assert.match(html, /MODO PRUEBAS/);
});

test('simulated card payment goes through the real webhook code and sends the emails', async () => {
  const { order, redirect } = await checkout('tarjeta');
  const payPath = new URL(redirect).pathname;
  assert.match(payPath, /^\/dev\/pago\/cs_dev_/);
  assert.match(await (await fetch(base + payPath)).text(), /Simular pago correcto/);
  assert.equal((await repos.orders.get(order)).paid, false);

  const done = await fetch(`${base}${payPath}/ok`, { method: 'POST', redirect: 'manual' });
  assert.equal(done.status, 303);
  assert.match(done.headers.get('location'), new RegExp(`/pedido/${order}\\?t=[0-9a-f]{32}&pago=ok`));

  const paid = await repos.orders.get(order);
  assert.equal(paid.paid, true);
  assert.match(paid.paymentRef, /^pi_dev_/);
  await new Promise(r => setTimeout(r, 20));
  assert.deepEqual(mailbox.messages.slice(0, 2).map(m => m.to).sort(), ['ana@correo.es', 'tienda@dev.local']);

  const inbox = await (await fetch(base + '/dev')).text();
  assert.match(inbox, new RegExp(`Pago recibido · pedido ${order}`));
  // "Ver mi pedido" must open the real page in a new tab, not inside the script-less sandbox (blank)
  assert.match(inbox, /sandbox="allow-popups allow-popups-to-escape-sandbox" srcdoc="&lt;base target=&quot;_blank&quot;&gt;/);
});

test('cancelled simulated payment leaves the order unpaid', async () => {
  const { order, redirect } = await checkout('tarjeta');
  const res = await fetch(`${base}${new URL(redirect).pathname}/cancelar`, { method: 'POST', redirect: 'manual' });
  assert.match(res.headers.get('location'), /pago=cancelado/);
  assert.equal((await repos.orders.get(order)).paid, false);
});
