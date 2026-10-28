// Payments service with an in-memory database and a Stripe client whose network call is replaced
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Stripe = require('stripe');
const { createSqliteDb } = require('../db/sqlite');
const { migrate } = require('../db/schema');
const { createRepositories } = require('../db/repositories');
const { createPayments } = require('../payments');

const SECRET = 'whsec_test_secret';

async function setup({ onPaid } = {}) {
  const db = createSqliteDb(':memory:');
  await migrate(db);
  const repos = createRepositories(db);
  await repos.products.create({ id: 1, name: 'Caballero', price: 25 });
  await repos.products.create({ id: 2, name: 'Gato', price: 12.5 });
  await repos.products.create({ id: 3, name: 'Retirado', price: 10, active: false });

  const stripe = Stripe('sk_test_dummy');
  const created = [];
  stripe.checkout.sessions.create = async params => {
    created.push(params);
    return { id: `cs_test_${created.length}`, url: `https://checkout.stripe.com/c/pay/cs_test_${created.length}` };
  };
  const payments = createPayments({
    stripe, webhookSecret: SECRET, repos, siteUrl: 'https://dream3d.es', shipping: { cost: 3.9, freeFrom: 30 }, onPaid,
  });
  return { repos, stripe, payments, created };
}

const signed = (stripe, event) => {
  const payload = JSON.stringify(event);
  return [payload, stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET })];
};

test('cart prices come from the database, never from the browser', async () => {
  const { payments } = await setup();
  const r = await payments.priceCart([{ id: 2, qty: 2, price: 0.01 }]);
  assert.equal(r.subtotal, 25);
  assert.equal(r.shipping, 3.9, 'under 30 € pays shipping');
  assert.equal(r.total, 28.9);
  assert.equal(r.lines[0].price, 12.5);

  const free = await payments.priceCart([{ id: 1, qty: 2 }]);
  assert.equal(free.shipping, 0);

  for (const bad of [[], [{ id: 3, qty: 1 }], [{ id: 99, qty: 1 }], [{ id: 1, qty: 0 }], [{ id: 1, qty: 21 }], [{ id: 1, qty: 1.5 }]]) {
    await assert.rejects(payments.priceCart(bad), { status: 400 });
  }
});

test('checkout session: amounts in cents, shipping line, order linked', async () => {
  const { repos, payments, created } = await setup();
  const priced = await payments.priceCart([{ id: 2, qty: 1 }]);
  const order = await repos.orders.create({ customer: { email: 'a@b.es' }, items: priced.lines, ...priced });
  const url = await payments.checkoutUrl(order);
  assert.match(url, /^https:\/\/checkout\.stripe\.com\//);
  const p = created[0];
  assert.deepEqual(p.line_items.map(l => l.price_data.unit_amount), [1250, 390]);
  assert.equal(p.metadata.order, order.id);
  assert.equal(p.customer_email, 'a@b.es');
  assert.ok(p.success_url.startsWith(`https://dream3d.es/pedido/${order.id}?t=${order.accessToken}`));
  assert.equal((await repos.orders.get(order.id)).paymentRef, 'cs_test_1');
});

test('webhook: only a correctly signed, matching payment marks the order as paid, and notifies once', async () => {
  const notified = [];
  const { repos, stripe, payments } = await setup({ onPaid: async o => notified.push(o.id) });
  const order = await repos.orders.create({ customer: {}, items: [{ name: 'Gato', qty: 1, price: 12.5 }], subtotal: 12.5, shipping: 3.9, total: 16.4 });
  const event = amount => ({
    id: 'evt_1', object: 'event', type: 'checkout.session.completed',
    data: { object: { id: 'cs_1', object: 'checkout.session', payment_status: 'paid', amount_total: amount, payment_intent: 'pi_1', metadata: { order: order.id } } },
  });

  const [forged] = signed(stripe, event(1640));
  await assert.rejects(payments.handleWebhook(forged, 't=1,v1=deadbeef'), { type: 'StripeSignatureVerificationError' });
  assert.equal((await repos.orders.get(order.id)).paid, false);

  const original = console.error;
  console.error = () => {};
  await payments.handleWebhook(...signed(stripe, event(100)));
  console.error = original;
  assert.equal((await repos.orders.get(order.id)).paid, false, 'amount mismatch is not accepted');

  await payments.handleWebhook(...signed(stripe, event(1640)));
  const paid = await repos.orders.get(order.id);
  assert.equal(paid.paid, true);
  assert.equal(paid.paymentRef, 'pi_1');
  await payments.handleWebhook(...signed(stripe, event(1640))); // Stripe retry
  assert.deepEqual(notified, [order.id], 'payment email is sent exactly once');
  await assert.rejects(payments.checkoutUrl(paid), { status: 409 });
});
