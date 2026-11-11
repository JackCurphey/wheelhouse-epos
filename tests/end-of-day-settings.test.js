// Settings › Front desk › End of day: Close the day timing and Count first
// (openspec/changes/owner-setup-till-payments-eod design 3; set-eod-close;
// owner setup decisions 6 and 18; Jack's answer 2 of 11 Nov: every shop moves
// to 30 minutes before closing, existing ones included). Migration 132, the
// /api/end-of-day-settings route, and countFirst on /api/close-the-day. The
// live server's clock is pinned to 1 Sep 2026.
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
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = '132_end_of_day_settings.sql';

function adminUrlOrSkip(t) {
  try {
    return adminUrlFrom(process.env);
  } catch (err) {
    if (process.env.CI) throw err;
    t.skip('no superuser connection configured');
    return null;
  }
}

test('132 gives every shop 30 minutes before closing and Count first on, existing shops included, and runs twice', async (t) => {
  const admin = adminUrlOrSkip(t);
  if (!admin) return;
  const name = `epos_mig132_${process.pid}`;
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
    const one = async (sql, args) => (await client.query(sql, args)).rows[0];
    // A shop from before the change: the columns taken away, then the migration's own words, twice.
    await client.query('ALTER TABLE shops DROP COLUMN close_entry_minutes, DROP COLUMN count_first');
    const existing = (await one("INSERT INTO shops (name, slug) VALUES ('[Shop]', 's1') RETURNING id")).id;
    await client.query(SQL);
    await client.query(SQL);
    assert.deepEqual(await one('SELECT close_entry_minutes, count_first FROM shops WHERE id = $1', [existing]), { close_entry_minutes: 30, count_first: true });
    const fresh = (await one("INSERT INTO shops (name, slug) VALUES ('[Other shop]', 's2') RETURNING id")).id;
    assert.deepEqual(await one('SELECT close_entry_minutes, count_first FROM shops WHERE id = $1', [fresh]), { close_entry_minutes: 30, count_first: true });
    for (const bad of [15, 45, -30, 90]) await assert.rejects(client.query('UPDATE shops SET close_entry_minutes = $1 WHERE id = $2', [bad, fresh]), /check/i, String(bad));
    await assert.rejects(client.query('UPDATE shops SET count_first = NULL WHERE id = $1', [fresh]), /null/i);
  } finally {
    await client.end();
  }
});

let server;
const shops = [];
before(async () => {
  server = await startLiveServer();
});
after(async () => {
  for (const s of shops) await deleteTestShop(s.shop.id);
  if (server) await server.stop();
});

const call = (who, p, options) => staffRequest(server.baseUrl, who.cookie, p, options);
const put = (who, body) => call(who, '/api/end-of-day-settings', { method: 'PUT', body });
const settings = async (who) => (await call(who, '/api/end-of-day-settings')).body;
async function shop() {
  const owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  shops.push(owner);
  return owner;
}

test('a new shop: 30 minutes before closing, Count first on, no float', async () => {
  const owner = await shop();
  assert.deepEqual(await settings(owner), { floatPence: null, closeEntryMinutes: 30, countFirst: true });
});

test('the Owner saves each setting on its own, and the others stay', async () => {
  const owner = await shop();
  assert.deepEqual((await put(owner, { closeEntryMinutes: 60 })).body, { floatPence: null, closeEntryMinutes: 60, countFirst: true });
  assert.deepEqual((await put(owner, { countFirst: false })).body, { floatPence: null, closeEntryMinutes: 60, countFirst: false });
  assert.deepEqual((await put(owner, { floatPence: 15000 })).body, { floatPence: 15000, closeEntryMinutes: 60, countFirst: false });
  assert.deepEqual((await put(owner, { closeEntryMinutes: 0 })).body, { floatPence: 15000, closeEntryMinutes: 0, countFirst: false });
  assert.deepEqual(await settings(owner), { floatPence: 15000, closeEntryMinutes: 0, countFirst: false });
});

test('anything but the drawn choices is refused with 400, and nothing changes', async () => {
  const owner = await shop();
  for (const body of [{ closeEntryMinutes: 45 }, { closeEntryMinutes: '30' }, { closeEntryMinutes: null }, { countFirst: 'yes' }, { countFirst: null }, {}, { closeEntryMinutes: 60, countFirst: 1 }]) {
    const res = await put(owner, body);
    assert.equal(res.status, 400, JSON.stringify(body));
  }
  assert.deepEqual(await settings(owner), { floatPence: null, closeEntryMinutes: 30, countFirst: true });
});

test('Staff can’t change them (403)', async () => {
  const owner = await shop();
  const made = await call(owner, '/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `${randomUUID().slice(0, 8)}@example.test`, password: 'password123' } });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  const jo = { cookie: await staffFreshCookie(made.body.loginId) };
  for (const body of [{ closeEntryMinutes: 60 }, { countFirst: false }]) {
    const res = await put(jo, body);
    assert.deepEqual([res.status, res.body.code], [403, 'owner_only']);
  }
  assert.deepEqual(await settings(owner), { floatPence: null, closeEntryMinutes: 30, countFirst: true });
});

test('two saves at the same moment both stay', async () => {
  const owner = await shop();
  for (let i = 0; i < 3; i += 1) {
    const minutes = [60, 0, 30][i];
    const count = i % 2 === 1;
    await Promise.all([put(owner, { closeEntryMinutes: minutes }), put(owner, { countFirst: count }), put(owner, { floatPence: 10000 + i })]);
    assert.deepEqual(await settings(owner), { floatPence: 10000 + i, closeEntryMinutes: minutes, countFirst: count });
  }
});

test('Close the day sends countFirst', async () => {
  const owner = await shop();
  const read = async () => {
    const res = await call(owner, '/api/close-the-day');
    assert.equal(res.status, 200, JSON.stringify(res.body));
    return res.body.countFirst;
  };
  assert.equal(await read(), true);
  assert.equal((await put(owner, { countFirst: false })).status, 200);
  assert.equal(await read(), false);
});
