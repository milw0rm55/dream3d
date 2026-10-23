/**
 * Data access. Every repository receives the database as a constructor parameter and only uses the
 * adapter contract described in db/sqlite.js, so switching engine is an infrastructure change.
 * Rows are mapped back to the exact shapes the API already returned before the database existed.
 */
const parse = (text, fallback) => {
  if (text == null) return fallback;
  try { return JSON.parse(text); } catch { return fallback; }
};
const crypto = require('crypto');
const money = n => Math.round((Number(n) || 0) * 100) / 100;
const flag = v => (v ? 1 : 0);

class ProductRepository {
  constructor(db) { this.db = db; }

  static toApi(r) {
    return r && {
      id: r.id, name: r.name, tag: r.tag, price: r.price, stock: r.stock, active: !!r.active,
      desc: r.description, notes: r.notes,
      colors: parse(r.colors, []), specs: parse(r.specs, []), media: parse(r.media, {}),
      pricing: parse(r.pricing, null),
    };
  }

  static values(p) {
    return [
      String(p.name || ''), String(p.tag || ''), money(p.price), Math.max(0, Math.round(Number(p.stock) || 0)),
      flag(p.active !== false), String(p.desc || ''), String(p.notes || ''),
      JSON.stringify(p.colors || []), JSON.stringify(p.specs || []), JSON.stringify(p.media || {}),
      p.pricing == null ? null : JSON.stringify(p.pricing),
    ];
  }

  async all() {
    return (await this.db.all('SELECT * FROM products ORDER BY id')).map(ProductRepository.toApi);
  }

  async get(id) {
    return ProductRepository.toApi(await this.db.get('SELECT * FROM products WHERE id = ?', [id]));
  }

  // data.id is only honoured for imports; routes never pass it
  async create(data) {
    const cols = 'name, tag, price, stock, active, description, notes, colors, specs, media, pricing';
    const row = Number.isInteger(data.id)
      ? await this.db.get(`INSERT INTO products (id, ${cols}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
          [data.id, ...ProductRepository.values(data)])
      : await this.db.get(`INSERT INTO products (${cols}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
          ProductRepository.values(data));
    return ProductRepository.toApi(row);
  }

  // media is not editable here: it only changes through setMedia (validated uploads)
  async update(id, patch) {
    const current = await this.get(id);
    if (!current) return null;
    const editable = ['name', 'tag', 'price', 'stock', 'active', 'desc', 'notes', 'colors', 'specs', 'pricing'];
    const next = { ...current };
    for (const k of editable) if (k in patch) next[k] = patch[k];
    const row = await this.db.get(
      `UPDATE products SET name = ?, tag = ?, price = ?, stock = ?, active = ?, description = ?, notes = ?,
         colors = ?, specs = ?, media = ?, pricing = ? WHERE id = ? RETURNING *`,
      [...ProductRepository.values(next), id]);
    return ProductRepository.toApi(row);
  }

  async setMedia(id, slot, url) {
    const current = await this.get(id);
    if (!current) return null;
    const media = { ...current.media };
    if (url) media[slot] = url; else delete media[slot];
    const row = await this.db.get('UPDATE products SET media = ? WHERE id = ? RETURNING *', [JSON.stringify(media), id]);
    return ProductRepository.toApi(row);
  }

  async remove(id) {
    return (await this.db.run('DELETE FROM products WHERE id = ?', [id])).changes > 0;
  }
}

const ORDER_PREFIX = 'F3D-';
const orderCode = id => ORDER_PREFIX + String(id).padStart(4, '0');
const orderId = code => {
  const m = /^F3D-(\d+)$/.exec(String(code));
  return m ? Number(m[1]) : null;
};

class OrderRepository {
  constructor(db) { this.db = db; }

  static toApi(r) {
    return r && {
      id: orderCode(r.id), date: r.created_on,
      customer: parse(r.customer, {}), items: parse(r.items, []),
      subtotal: r.subtotal, shipping: r.shipping, total: r.total,
      status: r.status, paid: !!r.paid, paymentMethod: r.payment_method, notes: r.notes,
      accessToken: r.access_token || null, paymentRef: r.payment_ref || null,
      trackingCode: r.tracking_code || null, shippedAt: r.shipped_at || null,
    };
  }

  // calling it again replaces the code (e.g. to correct a typo)
  async markShipped(code, trackingCode, when = new Date().toISOString()) {
    const id = orderId(code);
    if (!id) return null;
    return OrderRepository.toApi(await this.db.get(
      `UPDATE orders SET status = 'en-camino', tracking_code = ?, shipped_at = ? WHERE id = ? RETURNING *`,
      [trackingCode, when, id]));
  }

  async all() {
    return (await this.db.all('SELECT * FROM orders ORDER BY id DESC')).map(OrderRepository.toApi);
  }

  async get(code) {
    const id = orderId(code);
    return id ? OrderRepository.toApi(await this.db.get('SELECT * FROM orders WHERE id = ?', [id])) : null;
  }

  // the numeric id comes from the database, so two simultaneous checkouts can't get the same code;
  // the random token is what lets a customer open their own order page
  async create(o) {
    const cols = 'created_on, customer, items, subtotal, shipping, total, status, paid, payment_method, notes, access_token';
    const values = [
      o.date || new Date().toISOString().slice(0, 10), JSON.stringify(o.customer || {}), JSON.stringify(o.items || []),
      money(o.subtotal), money(o.shipping), money(o.total),
      o.status || 'pendiente', flag(o.paid), o.paymentMethod || 'pendiente', String(o.notes || ''),
      o.accessToken || crypto.randomBytes(16).toString('hex'),
    ];
    const id = orderId(o.id);
    const marks = values.map(() => '?').join(', ');
    const row = id
      ? await this.db.get(`INSERT INTO orders (id, ${cols}) VALUES (?, ${marks}) RETURNING *`, [id, ...values])
      : await this.db.get(`INSERT INTO orders (${cols}) VALUES (${marks}) RETURNING *`, values);
    return OrderRepository.toApi(row);
  }

  // atomic unpaid → paid: returns the order only to the caller that changed it (duplicate webhooks get null)
  async markPaid(code, { method, ref }) {
    const id = orderId(code);
    if (!id) return null;
    return OrderRepository.toApi(await this.db.get(
      'UPDATE orders SET paid = 1, payment_method = ?, payment_ref = ? WHERE id = ? AND paid = 0 RETURNING *',
      [method, ref || null, id]));
  }

  async update(code, patch) {
    const id = orderId(code);
    if (!id) return null;
    const current = await this.db.get('SELECT * FROM orders WHERE id = ?', [id]);
    if (!current) return null;
    const row = await this.db.get(
      'UPDATE orders SET status = ?, paid = ?, payment_method = ?, notes = ?, payment_ref = ? WHERE id = ? RETURNING *',
      [
        'status' in patch ? patch.status : current.status,
        'paid' in patch ? flag(patch.paid) : current.paid,
        'paymentMethod' in patch ? String(patch.paymentMethod) : current.payment_method,
        'notes' in patch ? String(patch.notes) : current.notes,
        'paymentRef' in patch ? patch.paymentRef : current.payment_ref,
        id,
      ]);
    return OrderRepository.toApi(row);
  }
}

class ReviewRepository {
  constructor(db) { this.db = db; }

  static toApi(r) {
    return r && {
      id: r.id, productId: r.product_id, name: r.name, stars: r.stars, text: r.body, date: r.date_label,
      createdAt: r.created_at, status: r.status, badge: r.badge || undefined,
      ...(r.product_name !== undefined ? { productName: r.product_name || `#${r.product_id}` } : {}),
    };
  }

  async approvedFor(productId) {
    return (await this.db.all(
      `SELECT * FROM reviews WHERE product_id = ? AND status = 'approved' ORDER BY COALESCE(created_at, '') DESC`,
      [productId])).map(ReviewRepository.toApi);
  }

  // pending first, newest first
  async allWithProduct() {
    return (await this.db.all(
      `SELECT r.*, p.name AS product_name FROM reviews r LEFT JOIN products p ON p.id = r.product_id
       ORDER BY CASE WHEN r.status = 'pending' THEN 0 ELSE 1 END, COALESCE(r.created_at, '') DESC`))
      .map(ReviewRepository.toApi);
  }

  async create(r) {
    const row = await this.db.get(
      `INSERT INTO reviews (id, product_id, name, stars, body, date_label, created_at, status, badge)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
      [r.id, r.productId, r.name, r.stars, r.text, r.date, r.createdAt || null, r.status || 'pending', r.badge || null]);
    return ReviewRepository.toApi(row);
  }

  async setStatus(id, status) {
    return ReviewRepository.toApi(await this.db.get('UPDATE reviews SET status = ? WHERE id = ? RETURNING *', [status, id]));
  }

  async remove(id) {
    return (await this.db.run('DELETE FROM reviews WHERE id = ?', [id])).changes > 0;
  }
}

class MessageRepository {
  constructor(db) { this.db = db; }

  static toApi(r) {
    return r && {
      id: r.id, date: r.sent_at, name: r.name, email: r.email, message: r.message,
      read: !!r.read, emailed: !!r.emailed, ...(r.mail_error ? { mailError: r.mail_error } : {}),
    };
  }

  async all() {
    return (await this.db.all('SELECT * FROM messages ORDER BY sent_at DESC')).map(MessageRepository.toApi);
  }

  async create(m) {
    return MessageRepository.toApi(await this.db.get(
      `INSERT INTO messages (id, sent_at, name, email, message, read, emailed, mail_error)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
      [m.id, m.date, m.name, m.email, m.message, flag(m.read), flag(m.emailed), m.mailError || null]));
  }

  async setRead(id, read) {
    return MessageRepository.toApi(await this.db.get('UPDATE messages SET read = ? WHERE id = ? RETURNING *', [flag(read), id]));
  }

  async remove(id) {
    return (await this.db.run('DELETE FROM messages WHERE id = ?', [id])).changes > 0;
  }
}

class SettingsRepository {
  constructor(db) { this.db = db; }

  async get(key, fallback = null) {
    const row = await this.db.get('SELECT value FROM settings WHERE key = ?', [key]);
    return row ? parse(row.value, fallback) : fallback;
  }

  async set(key, value) {
    await this.db.run(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
      [key, JSON.stringify(value)]);
  }
}

class AnalyticsRepository {
  constructor(db) { this.db = db; }

  async record({ path, referrer = '', event = 'pageview' }, day = new Date().toISOString().slice(0, 10)) {
    await this.db.run('INSERT INTO page_views (day, path, referrer, event) VALUES (?, ?, ?, ?)', [day, path, referrer, event]);
  }

  async summary(days = 30, today = new Date()) {
    const since = new Date(today.getTime() - (days - 1) * 86400000).toISOString().slice(0, 10);
    const [daily, pages, referrers] = await Promise.all([
      this.db.all(
        `SELECT day,
                SUM(CASE WHEN event = 'pageview' THEN 1 ELSE 0 END) AS views,
                SUM(CASE WHEN event = 'whatsapp' THEN 1 ELSE 0 END) AS whatsapp
         FROM page_views WHERE day >= ? GROUP BY day ORDER BY day`, [since]),
      this.db.all(
        `SELECT path, COUNT(*) AS n FROM page_views WHERE event = 'pageview' AND day >= ?
         GROUP BY path ORDER BY n DESC LIMIT 10`, [since]),
      this.db.all(
        `SELECT referrer, COUNT(*) AS n FROM page_views WHERE event = 'pageview' AND referrer <> '' AND day >= ?
         GROUP BY referrer ORDER BY n DESC LIMIT 10`, [since]),
    ]);
    // Number(): Postgres returns COUNT/SUM as strings
    const d = daily.map(r => ({ day: r.day, views: Number(r.views), whatsapp: Number(r.whatsapp) }));
    return {
      since,
      daily: d,
      totals: { views: d.reduce((s, r) => s + r.views, 0), whatsapp: d.reduce((s, r) => s + r.whatsapp, 0) },
      pages: pages.map(r => ({ path: r.path, n: Number(r.n) })),
      referrers: referrers.map(r => ({ referrer: r.referrer, n: Number(r.n) })),
    };
  }
}

function createRepositories(db) {
  return {
    products: new ProductRepository(db),
    orders: new OrderRepository(db),
    reviews: new ReviewRepository(db),
    messages: new MessageRepository(db),
    settings: new SettingsRepository(db),
    analytics: new AnalyticsRepository(db),
  };
}

module.exports = {
  createRepositories, ProductRepository, OrderRepository, ReviewRepository, MessageRepository, SettingsRepository,
  AnalyticsRepository,
  orderCode, orderId,
};
