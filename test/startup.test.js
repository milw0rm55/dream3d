// the server must refuse to start without its own admin password (no default outside npm run dev)
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const start = adminPass => spawnSync(process.execPath, [path.join(__dirname, '..', 'server.js')], {
  env: { ...process.env, NODE_ENV: '', DB_FILE: ':memory:', ADMIN_PASS: adminPass, PORT: '0' },
  encoding: 'utf8', timeout: 15000,
});

test('refuses to start without ADMIN_PASS', () => {
  const res = start('');
  assert.equal(res.status, 1);
  assert.match(res.stderr, /Define ADMIN_PASS/);
});

test('refuses to start with the documented default password', () => {
  const res = start('forma3d-admin');
  assert.equal(res.status, 1);
  assert.match(res.stderr, /Define ADMIN_PASS/);
});
