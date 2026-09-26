// Migration 031: which individual services a full service includes, one row
// per link, in the shop's order; each shop sees only its own links.
// Spec: docs/superpowers/specs/2026-09-26-book-server-8-service-includes-design.md
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let owner;

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl);
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const column = async (name) => (await pool.query(
  `SELECT is_nullable FROM information_schema.columns
   WHERE table_name = 'workshop_service_includes' AND column_name = $1`, [name]
)).rows[0];

const svc = (name, kind) => prepare(
  'INSERT INTO workshop_services (name, price, minutes, kind, updated_at) VALUES (?, 10, 30, ?, now())'
).run(name, kind).then((r) => r.lastInsertRowid);
const link = (full, part, position = 0) => prepare(
  'INSERT INTO workshop_service_includes (service_id, included_service_id, position) VALUES (?, ?, ?)'
).run(full, part, position);

test('workshop_service_includes has the full service, the included one and the order, all required', async () => {
  for (const name of ['id', 'shop_id', 'service_id', 'included_service_id', 'position']) {
    const c = await column(name);
    assert.ok(c, `${name} missing`);
    assert.equal(c.is_nullable, 'NO', `${name} should be required`);
  }
});

test('row-level security is enabled and forced', async () => {
  const { rows: [t] } = await pool.query(
    "SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = 'workshop_service_includes'");
  assert.equal(t.relrowsecurity, true);
  assert.equal(t.relforcerowsecurity, true);
});

test('another shop cannot see a shop\'s links', async () => {
  const other = await staffSignup(server.baseUrl);
  try {
    await runWithShop(owner.shop.id, async () => {
      await link(await svc('Iso full', 'full'), await svc('Iso part', 'individual'));
    });
    // A row must exist for the owner first - zero rows in an empty table
    // proves nothing about the policy.
    const own = await runWithShop(owner.shop.id, () => prepare(
      'SELECT count(*)::int AS n FROM workshop_service_includes WHERE shop_id = ?').get(owner.shop.id));
    assert.equal(own.n, 1);
    const seen = await runWithShop(other.shop.id, () => prepare(
      'SELECT count(*)::int AS n FROM workshop_service_includes WHERE shop_id = ?').get(owner.shop.id));
    assert.equal(seen.n, 0);
  } finally {
    await deleteTestShop(other.shop.id);
  }
});

test('a link to a service that does not exist is refused', async () => {
  await runWithShop(owner.shop.id, async () => {
    await assert.rejects(link(await svc('Fk full', 'full'), 2147483647), /foreign key/i);
  });
});

// Each expected refusal gets its own runWithShop: in 'transaction' scope mode
// a failed statement aborts the scope, and a second statement in it would
// fail for that reason instead of the one under test.
test('the same link twice, and a service including itself, are refused', async () => {
  const shop = (fn) => runWithShop(owner.shop.id, fn);
  const full = await shop(() => svc('Twice full', 'full'));
  const part = await shop(() => svc('Twice part', 'individual'));
  await shop(() => link(full, part, 0));
  await assert.rejects(shop(() => link(full, part, 1)), /unique|duplicate/i);
  await assert.rejects(shop(() => link(full, full, 2)), /check constraint/i);
});

test('links go when the service they belong to is deleted', async () => {
  await runWithShop(owner.shop.id, async () => {
    const full = await svc('Gone full', 'full');
    const part = await svc('Gone part', 'individual');
    await link(full, part);
    await prepare('DELETE FROM workshop_services WHERE id = ?').run(part);
    const left = await prepare('SELECT count(*)::int AS n FROM workshop_service_includes WHERE service_id = ?').get(full);
    assert.equal(left.n, 0);
  });
});
