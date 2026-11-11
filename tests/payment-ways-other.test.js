// Other ways to pay on the server (openspec/changes/owner-setup-till-payments-eod,
// design 4, task 5.1; Jack's answer 3 of 11 Nov,
// docs/decisions/2026-11-11-settings-rest-answers.md). The migration seeds the
// three drawn rows (setup.mjs payOther, set-pay-other) for every shop, a new
// shop gets them too, then the routes.
//
// Needs the compose Postgres up (npm run docker:up) or it hangs with no output.
import '../server/load-env.js';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { pool } from '../server/db.js';
import { createAppDatabase, dropDatabase, adminUrlFrom, appRoleFrom } from '../scripts/dev/new-db.mjs';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATE = path.join(ROOT, 'server/migrations/run-migrations.js');
const FILE = '133_payment_ways_other.sql';
const LATER = readdirSync(path.join(ROOT, 'server/migrations')).filter((f) => f.endsWith('.sql') && f >= FILE);
// The drawn rows and their lines (setup.mjs payOther).
const DRAWN = [
  { name: 'Finance', note: 'Recorded at the till; the finance company pays the shop', position: 0 },
  { name: 'Cycle to Work', note: 'Recorded at the till against a Cycle to Work order', position: 1 },
  { name: 'Payment link', note: 'Needs setting up with [payment provider] first', position: 2 },
];

function adminUrlOrSkip(t) {
  try {
    return adminUrlFrom(process.env);
  } catch (err) {
    if (process.env.CI) throw err;
    t.skip('no superuser connection configured');
    return null;
  }
}
async function withClient(url, fn) {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try { return await fn(client); } finally { await client.end(); }
}
const migrate = (env) => execFileSync('node', [MIGRATE], { env, encoding: 'utf8', stdio: 'pipe' });
const one = async (c, sql, args) => (await c.query(sql, args)).rows[0];
const asShop = (c, id) => c.query("SELECT set_config('app.current_shop_id', $1, false)", [String(id)]);
async function scratch(t, tag) {
  const admin = adminUrlOrSkip(t);
  if (!admin) return null;
  const name = `epos_pwo_${tag}_${process.pid}`;
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${name}`;
  await createAppDatabase(admin, name, appRoleFrom(process.env));
  t.after(() => dropDatabase(admin, name));
  return { url: url.href, env: { ...process.env, DATABASE_URL: url.href } };
}

// ---------- The migration ----------

test('133 seeds Finance, Cycle to Work and Payment link with their lines for every shop; each shop sees only its own', async (t) => {
  const db = await scratch(t, 'seed');
  if (!db) return;
  // Everything before 133, from empty.
  await withClient(db.url, async (c) => {
    await c.query('CREATE TABLE schema_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
    for (const f of LATER) await c.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [f]);
  });
  migrate(db.env);
  const ids = {};
  await withClient(db.url, async (c) => {
    ids.a = (await one(c, "INSERT INTO shops (name, slug) VALUES ('[Shop]', 's1') RETURNING id")).id;
    ids.b = (await one(c, "INSERT INTO shops (name, slug) VALUES ('[Other shop]', 's2') RETURNING id")).id;
    await c.query('DELETE FROM schema_migrations WHERE filename = ANY($1)', [LATER]);
  });
  assert.match(migrate(db.env), new RegExp(`Applied migration: ${FILE}`));
  const rows = (c) => c.query('SELECT shop_id, name, note, position FROM payment_ways_other ORDER BY position');
  await withClient(db.url, async (c) => {
    for (const shop of [ids.a, ids.b]) {
      await asShop(c, shop);
      assert.deepEqual((await rows(c)).rows, DRAWN.map((d) => ({ shop_id: shop, ...d })), `shop ${shop}`);
    }
    // A taken name is refused, ignoring capitals; names are 1 to 30 characters.
    await asShop(c, ids.a);
    await assert.rejects(c.query("INSERT INTO payment_ways_other (name, position) VALUES ('finance', 3)"), /unique|duplicate/i);
    await assert.rejects(c.query('INSERT INTO payment_ways_other (name, position) VALUES ($1, 3)', ['x'.repeat(31)]), /check/i);
    await assert.rejects(c.query("INSERT INTO payment_ways_other (name, position) VALUES ('', 3)"), /check/i);
    // The other shop can't write into this shop's list.
    await asShop(c, ids.b);
    await assert.rejects(c.query("INSERT INTO payment_ways_other (shop_id, name, position) VALUES ($1, '[Way]', 3)", [ids.a]), /row-level security/i);
  });
  // Run again: no second set.
  await withClient(db.url, (c) => c.query('DELETE FROM schema_migrations WHERE filename = $1', [FILE]));
  assert.match(migrate(db.env), new RegExp(`Applied migration: ${FILE}`));
  await withClient(db.url, async (c) => {
    await asShop(c, ids.a);
    assert.equal((await rows(c)).rowCount, 3);
  });
});

// ---------- The routes ----------

let server;
let owner;
let jo;
let other;
before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  other = await staffSignup(server.baseUrl);
  const made = await staffRequest(server.baseUrl, owner.cookie, '/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `jo-${randomUUID().slice(0, 8)}@example.test`, password: 'password123' } });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  jo = { cookie: await staffFreshCookie(made.body.loginId) };
});
after(async () => {
  for (const shop of [owner, other]) if (shop) await deleteTestShop(shop.shop.id);
  if (server) await server.stop();
  await pool.end();
});
const as = (who) => (p, options) => staffRequest(server.baseUrl, who.cookie, p, options);
const own = (p, options) => as(owner)(p, options);
const list = async (who = owner) => {
  const res = await as(who)('/api/payment-ways-other');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res.body.ways;
};
const shape = (ways) => ways.map(({ name, note, position }) => ({ name, note, position }));

test('a new shop starts with the three drawn rows; GET lists them in order, for anyone signed in', async () => {
  assert.deepEqual(shape(await list()), DRAWN);
  assert.deepEqual(shape(await list(jo)), DRAWN, 'Staff read the list too');
  assert.ok((await list()).every((w) => Number.isInteger(w.id)));
});

test('POST adds at the end with no line; a taken name (ignoring capitals) is 409, over 30 characters or empty is 400', async () => {
  const added = await own('/api/payment-ways-other', { method: 'POST', body: { name: '  Bank transfer ' } });
  assert.equal(added.status, 201, JSON.stringify(added.body));
  assert.deepEqual(shape(added.body.ways), [...DRAWN, { name: 'Bank transfer', note: null, position: 3 }]);
  assert.equal(added.body.id, added.body.ways[3].id);
  const taken = await own('/api/payment-ways-other', { method: 'POST', body: { name: 'bank TRANSFER' } });
  assert.deepEqual([taken.status, taken.body.code], [409, 'name_taken']);
  assert.equal((await own('/api/payment-ways-other', { method: 'POST', body: { name: 'x'.repeat(31) } })).status, 400);
  assert.equal((await own('/api/payment-ways-other', { method: 'POST', body: { name: '   ' } })).status, 400);
  assert.equal((await own('/api/payment-ways-other', { method: 'POST', body: {} })).status, 400);
  assert.equal((await own('/api/payment-ways-other', { method: 'POST', body: { name: 'x'.repeat(30) } })).status, 201, '30 is allowed');
  assert.equal((await list()).length, 5);
  const longest = (await list()).find((w) => w.name.length === 30);
  assert.equal((await own(`/api/payment-ways-other/${longest.id}`, { method: 'DELETE' })).status, 200);
});

test('DELETE removes and renumbers; Undo re-adds it in place with its line', async () => {
  const ways = await list();
  const link = ways.find((w) => w.name === 'Payment link');
  const removed = await own(`/api/payment-ways-other/${link.id}`, { method: 'DELETE' });
  assert.equal(removed.status, 200, JSON.stringify(removed.body));
  assert.deepEqual(removed.body.ways.map((w) => [w.name, w.position]), [['Finance', 0], ['Cycle to Work', 1], ['Bank transfer', 2]]);
  // Undo: put back where it was.
  const back = await own('/api/payment-ways-other', { method: 'POST', body: { name: link.name, note: link.note, position: link.position } });
  assert.equal(back.status, 201, JSON.stringify(back.body));
  assert.deepEqual(shape(back.body.ways), [...DRAWN, { name: 'Bank transfer', note: null, position: 3 }]);
  // Undo of an Add removes it again.
  const bank = back.body.ways.find((w) => w.name === 'Bank transfer');
  assert.equal((await own(`/api/payment-ways-other/${bank.id}`, { method: 'DELETE' })).status, 200);
  assert.deepEqual(shape(await list()), DRAWN);
  // Ids and positions are checked.
  assert.equal((await own('/api/payment-ways-other/3000000000', { method: 'DELETE' })).status, 404);
  assert.equal((await own('/api/payment-ways-other/abc', { method: 'DELETE' })).status, 404);
  assert.equal((await own('/api/payment-ways-other', { method: 'POST', body: { name: '[Way]', position: -1 } })).status, 400);
  assert.equal((await own('/api/payment-ways-other', { method: 'POST', body: { name: '[Way]', position: 1.5 } })).status, 400);
  assert.deepEqual(shape(await list()), DRAWN, 'nothing added by a refusal');
});

test('Staff are refused changes with 403, and nothing changes', async () => {
  const ways = await list();
  const add = await as(jo)('/api/payment-ways-other', { method: 'POST', body: { name: '[Way]' } });
  assert.deepEqual([add.status, add.body.code], [403, 'owner_only']);
  const remove = await as(jo)(`/api/payment-ways-other/${ways[0].id}`, { method: 'DELETE' });
  assert.deepEqual([remove.status, remove.body.code], [403, 'owner_only']);
  assert.deepEqual(await list(), ways);
});

test("another shop's list is never seen or changed: GET shows only its own, DELETE of another shop's id is 404", async () => {
  const added = await own('/api/payment-ways-other', { method: 'POST', body: { name: '[Our way]' } });
  assert.equal(added.status, 201);
  const ours = await list();
  const theirs = await list(other);
  assert.deepEqual(shape(theirs), DRAWN, 'their own drawn rows only');
  assert.ok(!theirs.some((w) => ours.some((o) => o.id === w.id)));
  const tryDelete = await as(other)(`/api/payment-ways-other/${ours[0].id}`, { method: 'DELETE' });
  assert.equal(tryDelete.status, 404);
  // Their own row with a name we use is fine: names are unique per shop.
  assert.equal((await as(other)('/api/payment-ways-other', { method: 'POST', body: { name: '[Our way]' } })).status, 201);
  assert.deepEqual(await list(), ours, 'nothing of ours changed');
});
