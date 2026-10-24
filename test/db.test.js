// Run with: npm test   (uses an in-memory database, never touches data/forma3d.db)
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { createSqliteDb } = require('../db/sqlite');
const { migrate } = require('../db/schema');
const { createRepositories } = require('../db/repositories');
const { importJsonOnce } = require('../db/import-json');

async function freshDb() {
  const db = createSqliteDb(':memory:');
  await migrate(db);
  return { db, repos: createRepositories(db) };
}

test('products: create, update, media, delete cascades reviews', async () => {
  const { db, repos } = await freshDb();
  const p = await repos.products.create({ name: 'Figura', tag: 'Regalos', price: 12.345, desc: 'Hola', colors: ['#fff'] });
  assert.equal(p.price, 12.35);
  assert.equal(p.active, true);
  assert.deepEqual(p.media, {});

  const u = await repos.products.update(p.id, { price: 20, media: { front: '/hack' }, notes: 'interna' });
  assert.equal(u.price, 20);
  assert.equal(u.notes, 'interna');
  assert.deepEqual(u.media, {}, 'media is only editable through setMedia');

  const m = await repos.products.setMedia(p.id, 'front', '/uploads/products/1/front.webp');
  assert.equal(m.media.front, '/uploads/products/1/front.webp');
  assert.deepEqual((await repos.products.setMedia(p.id, 'front', null)).media, {});

  await repos.reviews.create({ id: 'r1', productId: p.id, name: 'A', stars: 5, text: 'ok', date: 'hoy' });
  assert.equal(await repos.products.remove(p.id), true);
  assert.equal((await repos.reviews.allWithProduct()).length, 0);
  db.close();
});

test('orders: database assigns sequential codes and patch only touches allowed fields', async () => {
  const { db, repos } = await freshDb();
  const a = await repos.orders.create({ customer: { name: 'X' }, items: [], subtotal: 18, shipping: 3.9, total: 21.9 });
  const b = await repos.orders.create({ customer: { name: 'Y' }, items: [] });
  assert.equal(a.id, 'F3D-0001');
  assert.equal(b.id, 'F3D-0002');
  assert.equal(a.total, 21.9);

  const u = await repos.orders.update('F3D-0001', { status: 'preparando', paid: true, total: 0 });
  assert.equal(u.status, 'preparando');
  assert.equal(u.paid, true);
  assert.equal(u.total, 21.9, 'totals are not editable');
  assert.equal(await repos.orders.update('nope', { paid: true }), null);
  db.close();
});

test('reviews: pending ones stay private until approved', async () => {
  const { db, repos } = await freshDb();
  const p = await repos.products.create({ name: 'Figura' });
  await repos.reviews.create({ id: 'r1', productId: p.id, name: 'Ana', stars: 4, text: 'Bien', date: '1 oct', createdAt: '2026-10-01' });
  assert.equal((await repos.reviews.approvedFor(p.id)).length, 0);
  assert.equal((await repos.reviews.allWithProduct())[0].productName, 'Figura');

  await repos.reviews.setStatus('r1', 'approved');
  const pub = await repos.reviews.approvedFor(p.id);
  assert.equal(pub.length, 1);
  assert.equal(pub[0].text, 'Bien');
  db.close();
});

test('messages and settings', async () => {
  const { db, repos } = await freshDb();
  await repos.messages.create({ id: 'm1', date: '2026-10-23T10:00:00Z', name: 'Eva', email: 'e@e.es', message: 'Hola hola hola' });
  assert.equal((await repos.messages.setRead('m1', true)).read, true);
  assert.equal((await repos.messages.all())[0].emailed, false);

  assert.equal(await repos.settings.get('pricing'), null);
  await repos.settings.set('pricing', { spoolPrice: 20 });
  await repos.settings.set('pricing', { spoolPrice: 25 });
  assert.deepEqual(await repos.settings.get('pricing'), { spoolPrice: 25 });
  db.close();
});

test('JSON import runs once and keeps ids', async () => {
  const { db, repos } = await freshDb();
  const dataDir = path.join(__dirname, '..', 'data');
  const first = await importJsonOnce(db, repos, dataDir);
  assert.ok(first.products > 0);
  const products = await repos.products.all();
  assert.equal(products[0].id, 1);
  assert.ok((await repos.orders.all()).some(o => o.id === 'F3D-0042'));

  assert.deepEqual(await importJsonOnce(db, repos, dataDir), {}, 'second run imports nothing');
  assert.equal((await repos.products.all()).length, products.length);

  const next = await repos.orders.create({ customer: {}, items: [] });
  assert.equal(next.id, 'F3D-0043', 'new orders continue after the imported ones');
  db.close();
});
