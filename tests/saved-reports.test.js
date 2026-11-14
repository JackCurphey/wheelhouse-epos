// Saving a changed report (openspec/changes/reports-your-own, design 7 to 9;
// rp-save, rp-save-taken, rp-home). Migration 146, the lib and
// GET/POST /api/reports/saved. A saved report belongs to the person who saved
// it, keeps the kind of period (never dates), and opens on the latest one.
import '../server/load-env.js';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { createAppDatabase, dropDatabase, adminUrlFrom, appRoleFrom } from '../scripts/dev/new-db.mjs';
import { runWithShop, prepare, pool } from '../server/db.js';
import { listSaved } from '../server/lib/saved-reports.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie, firstShopIsBolton } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = '146_saved_reports.sql';
const TAKEN = 'You already have a report with this name. Choose another name.';

let server;
let owner;
let other;
let jo;
let joLoginId;

const as = (who) => (path_, options) => staffRequest(server.baseUrl, who.cookie, path_, options);
const save = (body, who = owner) => as(who)('/api/reports/saved', { method: 'POST', body });
const items = { name: 'Bottles', base: 'sales', measure: 'items', split: 'product', only: ['Accessories'], supplier: '', period: 'this-week', shared: false };

before(async () => {
  server = await startLiveServer({ env: { WHEELHOUSE_TEST_CLOCK: '2026-09-17T11:00:00Z' } });
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  await firstShopIsBolton(owner);
  other = await staffSignup(server.baseUrl, { shopName: 'Other Cycles' });
  const made = await as(owner)('/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `jo-${randomUUID().slice(0, 8)}@example.test`, password: 'password123' } });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  joLoginId = made.body.loginId;
  jo = { cookie: await staffFreshCookie(joLoginId) };
  await runWithShop(owner.shop.id, () => prepare("INSERT INTO product_categories (name, path) VALUES ('Accessories', 'Accessories')").run());
});
after(async () => {
  for (const s of [owner, other]) if (s) await deleteTestShop(s.shop.id);
  if (server) await server.stop();
  await pool.end();
});

test('146 runs from empty and twice, protects each shop, and keeps one live name per person', async (t) => {
  let admin;
  try { admin = adminUrlFrom(process.env); } catch (err) { if (process.env.CI) throw err; t.skip('no superuser connection configured'); return; }
  const name = `epos_mig146_${process.pid}`;
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${name}`;
  await createAppDatabase(admin, name, appRoleFrom(process.env));
  t.after(() => dropDatabase(admin, name));
  const env = { ...process.env, DATABASE_URL: url.href };
  const migrated = execFileSync('node', [path.join(ROOT, 'server/migrations/run-migrations.js')], { env, encoding: 'utf8', stdio: 'pipe' });
  assert.match(migrated, new RegExp(`Applied migration: ${FILE}`));
  const SQL = readFileSync(path.join(ROOT, 'server/migrations', FILE), 'utf8');
  const client = new pg.Client({ connectionString: url.href });
  await client.connect();
  try {
    await client.query(SQL);
    await client.query(SQL); // twice: nothing breaks and nothing is added again
    const one = async (sql, args) => (await client.query(sql, args)).rows[0];
    const rls = await one("SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = 'saved_reports'");
    assert.deepEqual(rls, { relrowsecurity: true, relforcerowsecurity: true });
    assert.equal((await one("SELECT count(*)::int AS n FROM pg_policies WHERE tablename = 'saved_reports'")).n, 1);
    const shop = (await one("INSERT INTO shops (name, slug) VALUES ('[Shop]', 's1') RETURNING id")).id;
    await client.query("SELECT set_config('app.current_shop_id', $1, false)", [String(shop)]); // row-level security needs the shop
    const login = async (email) => (await one("INSERT INTO logins (shop_id, email, password_hash, name, is_owner) VALUES ($1, $2, 'x', '[Person]', true) RETURNING id", [shop, email])).id;
    const a = await login('a@example.test');
    const b = await login('b@example.test');
    const insert = (loginId, nm) => client.query(
      "INSERT INTO saved_reports (shop_id, login_id, base, measure, split, period, name) VALUES ($1, $2, 'sales', 'takings', 'day', 'this-week', $3)", [shop, loginId, nm]);
    await insert(a, 'Weekly');
    await assert.rejects(insert(a, 'weekly'), /unique|duplicate/i, 'the same name, whatever its capitals, twice for one person');
    await insert(b, 'Weekly'); // another person may use it
    await client.query("UPDATE saved_reports SET deleted_at = now() WHERE login_id = $1", [a]);
    await insert(a, 'Weekly'); // and so may the same person once it is deleted
    await assert.rejects(insert(a, '   '), /check/i, 'an empty name');
    await assert.rejects(insert(a, 'x'.repeat(81)), /check/i, 'a name over 80 characters');
    await client.query('DELETE FROM logins WHERE id = $1', [b]);
    assert.equal((await one('SELECT count(*)::int AS n FROM saved_reports WHERE login_id = $1', [b])).n, 0, 'a person who goes takes their reports');
  } finally {
    await client.end();
  }
});

test('saving keeps the choices and the kind of period, trimmed, and lists them for the person', async () => {
  const res = await save({ ...items, name: '  Bottles by product  ' });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.name, 'Bottles by product');
  const list = await as(owner)('/api/reports/saved');
  assert.equal(list.status, 200);
  const mine = list.body.reports.find((r) => r.name === 'Bottles by product');
  assert.deepEqual([mine.base, mine.measure, mine.split, mine.only, mine.supplier, mine.period, mine.shared], ['sales', 'items', 'product', ['Accessories'], '', 'this-week', false]);
  assert.equal(mine.what, 'Sales: items sold by product · Accessories only');
});

test('a report saved on Pick dates keeps no dates and opens on the report\'s first period', async () => {
  const res = await save({ ...items, name: 'Picked', period: 'dates' });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const mine = (await as(owner)('/api/reports/saved')).body.reports.find((r) => r.name === 'Picked');
  assert.equal(mine.period, 'dates');
  assert.equal(mine.opensOn, 'this-week');
  const row = await runWithShop(owner.shop.id, () => prepare("SELECT * FROM saved_reports WHERE name = 'Picked'").get());
  assert.ok(!Object.keys(row).some((k) => /^(from|to)/.test(k)), 'no dates are kept');
});

test('a name the person already has is refused, whatever its capitals, and nothing is saved', async () => {
  assert.equal((await save({ ...items, name: 'Weekly takings', measure: 'takings', split: 'day', only: [] })).status, 201);
  const again = await save({ ...items, name: 'weekly TAKINGS' });
  assert.equal(again.status, 400);
  assert.equal(again.body.error, TAKEN);
  const list = (await as(owner)('/api/reports/saved')).body.reports.filter((r) => r.name.toLowerCase() === 'weekly takings');
  assert.equal(list.length, 1);
});

test('another person may use the same name, and a deleted name can be used again', async () => {
  const lib = await import('../server/lib/saved-reports.js');
  await runWithShop(owner.shop.id, async () => {
    const mineId = (await prepare("SELECT id FROM saved_reports WHERE name = 'Weekly takings'").get()).id;
    await lib.createSaved(joLoginId, { ...items, name: 'Weekly takings' });
    assert.deepEqual((await lib.listSaved(joLoginId)).map((r) => r.name), ['Weekly takings']);
    assert.ok(!(await lib.listSaved(joLoginId)).some((r) => r.id === mineId), 'Jo does not see Jack\'s');
    await prepare('UPDATE saved_reports SET deleted_at = now() WHERE id = ?').run(mineId);
  });
  assert.equal((await save({ ...items, name: 'Weekly takings' })).status, 201);
});

test('no name, a long name and sharing are refused with their reasons', async () => {
  const empty = await save({ ...items, name: '   ' });
  assert.equal(empty.status, 400);
  assert.equal(empty.body.error, 'Type its name');
  const long = await save({ ...items, name: 'x'.repeat(81) });
  assert.equal(long.status, 400);
  assert.equal(long.body.error, 'A report’s name can be up to 80 characters');
  const shared = await save({ ...items, name: 'Shared one', shared: true });
  assert.equal(shared.status, 400);
  assert.equal(shared.body.error, 'there are no managers until staff roles are set up');
});

test('a report that does not fit together, or is not a report, is not saved', async () => {
  const cases = [
    [{ measure: 'items', split: 'payment' }, 'payments aren’t split by item'],
    [{ measure: 'jobs' }, 'workshop only — choose it from the Workshop report'],
    [{ base: 'nonsense' }, 'Choose Sales, Takings and cash-ups, Workshop or Cycle to Work'],
    [{ period: 'next-year' }, 'Choose Today, This week, This month, Last month, Last 12 months or Pick dates'],
    [{ only: 'Accessories' }, 'Choose what to limit it to again'],
  ];
  for (const [change, error] of cases) {
    const res = await save({ ...items, name: `Bad ${JSON.stringify(change)}`, ...change });
    assert.equal(res.status, 400, JSON.stringify(change));
    assert.equal(res.body.error, error, JSON.stringify(change));
  }
});

test('only the shop\'s owner can save or list, and another shop sees nothing', async () => {
  for (const [method, body] of [['GET'], ['POST', { ...items, name: 'Jo\'s' }]]) {
    const res = await as(jo)('/api/reports/saved', { method, body });
    assert.equal(res.status, 403, method);
    assert.equal(res.body.error, "Only the shop's owner can see reports");
  }
  const theirs = await as(other)('/api/reports/saved');
  assert.equal(theirs.status, 200);
  assert.deepEqual(theirs.body.reports, []);
  assert.equal((await save({ ...items, name: 'Bottles by product' }, other)).status, 201, 'the same name in another shop is fine');
});

test('a category that has gone is left out of what the saved report says', async () => {
  await save({ ...items, name: 'Gone category', only: ['Accessories', 'No such category'] });
  const mine = (await as(owner)('/api/reports/saved')).body.reports.find((r) => r.name === 'Gone category');
  assert.ok(!mine.what.includes('No such category'));
  assert.ok(typeof listSaved === 'function');
});

test('two saves of the same name at once: one is saved and the other is told the name is taken', async () => {
  const both = await Promise.all([save({ ...items, name: 'Race' }), save({ ...items, name: 'Race' })]);
  assert.deepEqual(both.map((r) => r.status).sort(), [201, 400], JSON.stringify(both.map((r) => r.body)));
  assert.equal(both.find((r) => r.status === 400).body.error, TAKEN);
});

test('one saved report that no longer makes sense does not stop the rest being listed', async () => {
  await runWithShop(owner.shop.id, async () => {
    const login = await prepare('SELECT login_id FROM saved_reports WHERE name = ?').get('Bottles by product');
    await prepare("INSERT INTO saved_reports (login_id, base, measure, split, period, name) VALUES (?, 'sales', 'retired-measure', 'day', 'this-week', 'Old one')").run(login.login_id);
  });
  const res = await as(owner)('/api/reports/saved');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.ok(res.body.reports.some((r) => r.name === 'Old one'));
  assert.ok(res.body.reports.some((r) => r.name === 'Bottles by product'));
});

test('limits that are too long, too many or not text are refused, and so is a broken body', async () => {
  const many = await save({ ...items, name: 'Many', only: Array.from({ length: 51 }, (_, i) => `C${i}`) });
  assert.equal(many.status, 400);
  const nul = await save({ ...items, name: 'Nul', supplier: 'a\u0000b' });
  assert.equal(nul.status, 400);
  const longSupplier = await save({ ...items, name: 'Long', supplier: 'x'.repeat(201) });
  assert.equal(longSupplier.status, 400);
  const nulName = await save({ ...items, name: 'a\u0000b' });
  assert.equal(nulName.status, 400);
  const broken = await fetch(`${server.baseUrl}/api/reports/saved`, { method: 'POST', headers: { cookie: owner.cookie, 'content-type': 'application/json' }, body: '{nope' });
  assert.equal(broken.status, 400);
});
