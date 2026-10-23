/**
 * One-off import of the old data/*.json files. Each table is only filled while it is still empty,
 * so restarting the server never duplicates data. The JSON files are left untouched as a backup.
 * Postgres note: rows keep their original ids, so reset the identity sequences after importing there.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

async function importJsonOnce(db, repos, dataDir) {
  const read = (file, fallback) => {
    try { return JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8')); } catch { return fallback; }
  };
  const isEmpty = async table => Number((await db.get(`SELECT COUNT(*) AS n FROM ${table}`)).n) === 0;
  const imported = {};

  await db.transaction(async () => {
    if (await isEmpty('products')) {
      const list = read('products.json', []);
      for (const p of list) await repos.products.create(p);
      imported.products = list.length;
    }
    if (await isEmpty('orders')) {
      const list = read('orders.json', []);
      for (const o of list) await repos.orders.create(o);
      imported.orders = list.length;
    }
    if (await isEmpty('reviews')) {
      let n = 0;
      for (const [productId, list] of Object.entries(read('reviews.json', {}))) {
        if (!(await repos.products.get(Number(productId)))) continue; // product no longer exists
        for (const r of list) {
          await repos.reviews.create({
            ...r,
            id: r.id || crypto.randomUUID(),
            productId: Number(productId),
            status: r.status || 'approved', // reviews from before moderation were already public
          });
          n++;
        }
      }
      imported.reviews = n;
    }
    if (await isEmpty('messages')) {
      const list = read('messages.json', []);
      for (const m of list) await repos.messages.create({ ...m, id: m.id || crypto.randomUUID() });
      imported.messages = list.length;
    }
    if ((await repos.settings.get('pricing')) === null) {
      const pricing = read('pricing.json', null);
      if (pricing) {
        await repos.settings.set('pricing', pricing);
        imported.pricing = 1;
      }
    }
  });

  for (const k of Object.keys(imported)) if (!imported[k]) delete imported[k];
  return imported;
}

module.exports = { importJsonOnce };
