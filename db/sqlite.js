/**
 * SQLite adapter (built into Node ≥ 22.13: node:sqlite).
 *
 * Database contract used by every repository — a Postgres adapter must expose the same:
 *   db.dialect.autoId                 column definition for an auto-increment integer primary key
 *   await db.exec(sql)                DDL / several statements, no parameters
 *   await db.all(sql, params) → rows
 *   await db.get(sql, params) → row | undefined
 *   await db.run(sql, params) → { changes }
 *   await db.transaction(async () => …)
 *   db.close()
 * SQL is written with `?` placeholders; a Postgres adapter rewrites them to $1, $2… before sending.
 */
const { DatabaseSync } = require('node:sqlite');

function createSqliteDb(filename) {
  const conn = new DatabaseSync(filename);
  conn.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');

  const bind = params => params.map(v => (v === undefined ? null : v));
  const plain = row => (row ? { ...row } : row);

  return {
    dialect: { autoId: 'INTEGER PRIMARY KEY' },

    async exec(sql) {
      conn.exec(sql);
    },
    async all(sql, params = []) {
      return conn.prepare(sql).all(...bind(params)).map(plain);
    },
    async get(sql, params = []) {
      return plain(conn.prepare(sql).get(...bind(params)));
    },
    async run(sql, params = []) {
      const { changes } = conn.prepare(sql).run(...bind(params));
      return { changes: Number(changes) };
    },
    // shortcut: one shared connection, so queries from other requests during an open transaction join it;
    // only used for the one-off JSON import at startup. Postgres adapter: take a dedicated pool client.
    async transaction(fn) {
      conn.exec('BEGIN');
      try {
        const result = await fn();
        conn.exec('COMMIT');
        return result;
      } catch (err) {
        conn.exec('ROLLBACK');
        throw err;
      }
    },
    close() {
      conn.close();
    },
  };
}

module.exports = { createSqliteDb };
