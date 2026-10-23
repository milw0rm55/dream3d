// Portable DDL: JSON as TEXT, booleans as INTEGER 0/1, dates as ISO TEXT.
async function migrate(db) {
  const id = db.dialect.autoId;
  await db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id          ${id},
      name        TEXT    NOT NULL,
      tag         TEXT    NOT NULL DEFAULT '',
      price       REAL    NOT NULL DEFAULT 0,
      stock       INTEGER NOT NULL DEFAULT 0,
      active      INTEGER NOT NULL DEFAULT 1,
      description TEXT    NOT NULL DEFAULT '',
      notes       TEXT    NOT NULL DEFAULT '',
      colors      TEXT    NOT NULL DEFAULT '[]',
      specs       TEXT    NOT NULL DEFAULT '[]',
      media       TEXT    NOT NULL DEFAULT '{}',
      pricing     TEXT
    );

    CREATE TABLE IF NOT EXISTS orders (
      id             ${id},
      created_on     TEXT    NOT NULL,
      customer       TEXT    NOT NULL,
      items          TEXT    NOT NULL,
      subtotal       REAL    NOT NULL DEFAULT 0,
      shipping       REAL    NOT NULL DEFAULT 0,
      total          REAL    NOT NULL DEFAULT 0,
      status         TEXT    NOT NULL DEFAULT 'pendiente',
      paid           INTEGER NOT NULL DEFAULT 0,
      payment_method TEXT    NOT NULL DEFAULT 'pendiente',
      notes          TEXT    NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id         TEXT    PRIMARY KEY,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      name       TEXT    NOT NULL,
      stars      INTEGER NOT NULL,
      body       TEXT    NOT NULL,
      date_label TEXT    NOT NULL,
      created_at TEXT,
      status     TEXT    NOT NULL DEFAULT 'pending',
      badge      TEXT
    );
    CREATE INDEX IF NOT EXISTS reviews_product ON reviews (product_id, status);

    CREATE TABLE IF NOT EXISTS messages (
      id         TEXT    PRIMARY KEY,
      sent_at    TEXT    NOT NULL,
      name       TEXT    NOT NULL,
      email      TEXT    NOT NULL,
      message    TEXT    NOT NULL,
      read       INTEGER NOT NULL DEFAULT 0,
      emailed    INTEGER NOT NULL DEFAULT 0,
      mail_error TEXT
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- cookieless analytics: no IP, no user agent, no identifier of any kind
    CREATE TABLE IF NOT EXISTS page_views (
      id       ${id},
      day      TEXT NOT NULL,
      path     TEXT NOT NULL,
      referrer TEXT NOT NULL DEFAULT '',
      event    TEXT NOT NULL DEFAULT 'pageview'
    );
    CREATE INDEX IF NOT EXISTS page_views_day ON page_views (day, event);
  `);

  // numbered changes to existing tables; the applied version is stored in settings
  const MIGRATIONS = [
    // 1: orders get a secret token (customer order page) and the payment provider reference
    `ALTER TABLE orders ADD COLUMN access_token TEXT;
     ALTER TABLE orders ADD COLUMN payment_ref TEXT;`,
    // 2: shipment tracking code and when it was sent
    `ALTER TABLE orders ADD COLUMN tracking_code TEXT;
     ALTER TABLE orders ADD COLUMN shipped_at TEXT;`,
  ];
  const row = await db.get(`SELECT value FROM settings WHERE key = 'schema_version'`);
  let version = row ? Number(JSON.parse(row.value)) : 0;
  while (version < MIGRATIONS.length) {
    await db.exec(MIGRATIONS[version]);
    version++;
    await db.run(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
      ['schema_version', JSON.stringify(version)]);
  }
}

module.exports = { migrate };
