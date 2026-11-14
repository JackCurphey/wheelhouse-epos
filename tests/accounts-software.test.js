// Accounts software: connecting and choosing (openspec/changes/reports-accounts-and-reopen, accounts-software
// spec; design decisions 4, 5 and 9; rp-accounts-connect, rp-accounts-map, rp-accounts-missing,
// rp-accounts-disconnect). Migration 152, server/accounts/ (the adapter and its pretend service) and
// /api/accounts. Everything is built against a pretend Xero or QuickBooks: no request leaves Wheelhouse.
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
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = '152_accounts_software.sql';
const OWNER_ONLY = "Only the shop's owner can connect accounts software";

let server;
let owner;
let other;
let jo;
const extra = [];
const as = (who) => (p, options) => staffRequest(server.baseUrl, who.cookie, p, options);
const get = (who = owner) => as(who)('/api/accounts');
const connect = (provider, who = owner) => as(who)('/api/accounts/connect', { method: 'POST', body: { provider } });
const choose = (line, accountId, who = owner) => as(who)('/api/accounts/choices', { method: 'PUT', body: { line, accountId } });
const disconnect = (who = owner) => as(who)('/api/accounts/disconnect', { method: 'POST', body: {} });
const lines = (body) => Object.fromEntries(body.groups.flatMap((g) => g.lines.map((l) => [l.key, l])));

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  other = await staffSignup(server.baseUrl, { shopName: 'Other Cycles' });
  const made = await as(owner)('/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `jo-${randomUUID().slice(0, 8)}@example.test`, password: 'password123' } });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  jo = { cookie: await staffFreshCookie(made.body.loginId) };
  await runWithShop(owner.shop.id, async () => {
    await prepare("INSERT INTO product_categories (name, path) VALUES ('Accessories', 'Accessories'), ('Drivetrain', 'Drivetrain')").run();
  });
});
after(async () => {
  for (const s of [owner, other, ...extra]) if (s) await deleteTestShop(s.shop.id);
  if (server) await server.stop();
  await pool.end();
});

test('152 runs from empty and twice, protects each shop, and allows one connection and one choice per line', async (t) => {
  let admin;
  try { admin = adminUrlFrom(process.env); } catch (err) { if (process.env.CI) throw err; t.skip('no superuser connection configured'); return; }
  const name = `epos_mig152_${process.pid}`;
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
    await client.query(SQL);
    const one = async (sql, args) => (await client.query(sql, args)).rows[0];
    for (const table of ['accounts_connections', 'accounts_choices']) {
      assert.deepEqual(await one('SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = $1', [table]), { relrowsecurity: true, relforcerowsecurity: true }, table);
      assert.equal((await one('SELECT count(*)::int AS n FROM pg_policies WHERE tablename = $1', [table])).n, 1, table);
    }
    const shop = (await one("INSERT INTO shops (name, slug) VALUES ('[Shop]', 's1') RETURNING id")).id;
    await client.query("SELECT set_config('app.current_shop_id', $1, false)", [String(shop)]);
    const login = (await one("INSERT INTO logins (shop_id, email, password_hash, name, is_owner) VALUES ($1, 'a@example.test', 'x', '[Person]', true) RETURNING id", [shop])).id;
    const conn = (provider, status = 'connected') => client.query('INSERT INTO accounts_connections (shop_id, provider, status, connected_by) VALUES ($1, $2, $3, $4)', [shop, provider, status, login]);
    await conn('xero');
    await assert.rejects(conn('quickbooks'), /unique|duplicate/i, 'one connection a shop');
    await assert.rejects(client.query("UPDATE accounts_connections SET provider = 'sage'"), /check/i);
    await assert.rejects(client.query("UPDATE accounts_connections SET status = 'broken'"), /check/i);
    const choice = (line, account, provider = 'xero') => client.query('INSERT INTO accounts_choices (shop_id, provider, line_key, account_id, account_name) VALUES ($1, $2, $3, $4, $5)', [shop, provider, line, account, `[${account}]`]);
    await choice('money:cash', 'x1');
    await assert.rejects(choice('money:cash', 'x2'), /unique|duplicate/i, 'one account a line');
    await choice('money:card', 'x1');
    await choice('money:cash', 'q1', 'quickbooks'); // the same line for the other service
    await client.query('DELETE FROM logins WHERE id = $1', [login]);
    assert.equal((await one('SELECT connected_by FROM accounts_connections')).connected_by, null, 'a person who goes does not hold the connection');
  } finally {
    await client.end();
  }
});

test('only the shop\'s owner can see or change it, and signed out is refused', async () => {
  for (const [method, p, body] of [['GET', '/api/accounts'], ['POST', '/api/accounts/connect', { provider: 'xero' }], ['PUT', '/api/accounts/choices', { line: 'money:cash', accountId: 'x' }], ['POST', '/api/accounts/disconnect', {}]]) {
    const res = await as(jo)(p, { method, body });
    assert.equal(res.status, 403, `${method} ${p}`);
    assert.equal(res.body.error, OWNER_ONLY);
    const anon = await fetch(`${server.baseUrl}${p}`, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    assert.equal(anon.status, 401, `${method} ${p} signed out`);
  }
});

test('before anything is connected it says so, and offers Xero and QuickBooks', async () => {
  const res = await get();
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual([res.body.status, res.body.connection, res.body.providers], ['not_connected', null, [{ id: 'xero', name: 'Xero' }, { id: 'quickbooks', name: 'QuickBooks' }]]);
  assert.equal(res.body.summary, 'Not connected');
});

test('connecting Xero with the pretend service saves who and when, and lists the lines with their choices', async () => {
  const res = await connect('xero');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const body = (await get()).body;
  assert.equal(body.status, 'connected');
  assert.deepEqual([body.connection.provider, body.connection.providerName, body.connection.connectedByName], ['xero', 'Xero', 'Jack Lewis']);
  assert.ok(!Number.isNaN(Date.parse(body.connection.connectedAt)));
  assert.equal(body.practice, true, 'the pretend service says so');
  assert.deepEqual(body.accounts.map((a) => a.name).slice(0, 2), ['[Xero account 1]', '[Xero account 2]']);
  assert.deepEqual(body.groups.map((g) => g.title), ['Sales go to', 'Money taken goes to', 'Everything else goes to']);
  assert.deepEqual(body.groups[0].lines.map((l) => l.label), ['Accessories', 'Drivetrain', 'Labour', 'Other sales']);
  assert.deepEqual(body.groups[1].lines.map((l) => l.label), ['Cash', 'Card', 'Customer accounts', 'Gift cards', 'Cycle to Work (owed by providers)', 'Online sales (paid on the website)']);
  assert.deepEqual(body.groups[2].lines.map((l) => l.label), ['Cash differences', 'Refunds', 'Discounts given', 'VAT on sales']);
  assert.ok(body.groups.every((g) => g.lines.every((l) => l.accountId === null)));
  // Refunds and Discounts given aren't recorded yet, so they don't hold a day up.
  assert.deepEqual([lines(body)['other:refunds'].recorded, lines(body)['other:discounts'].recorded, lines(body)['money:cash'].recorded], [false, false, true]);
  assert.equal(body.missing, 12, 'every recorded line still needs an account');
  assert.equal(body.summary, 'Connected to Xero · 12 accounts to choose');
});

test('connecting again is refused, and QuickBooks works for another shop', async () => {
  const again = await connect('xero');
  assert.deepEqual([again.status, again.body.error], [409, 'Already connected']);
  const bad = await connect('sage', other);
  assert.equal(bad.status, 400);
  const qb = await connect('quickbooks', other);
  assert.equal(qb.status, 200, JSON.stringify(qb.body));
  const body = (await get(other)).body;
  assert.deepEqual([body.connection.providerName, body.accounts[0].name], ['QuickBooks', '[QuickBooks account 1]']);
  assert.equal((await get()).body.connection.provider, 'xero', 'each shop has its own');
});

test('choosing an account saves it at once, clearing it puts the line back to needing one', async () => {
  const accounts = (await get()).body.accounts;
  const res = await choose('money:cash', accounts[2].id);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  let body = (await get()).body;
  assert.equal(lines(body)['money:cash'].accountId, accounts[2].id);
  assert.equal(lines(body)['money:cash'].accountName, accounts[2].name);
  assert.equal(body.missing, 11);
  assert.equal(body.summary, 'Connected to Xero · 11 accounts to choose');
  assert.equal((await choose('sales:Accessories', accounts[0].id)).status, 200);
  assert.equal((await choose('money:cash', accounts[3].id)).status, 200, 'changing it replaces it');
  assert.equal(lines((await get()).body)['money:cash'].accountId, accounts[3].id);
  assert.equal((await choose('money:cash', null)).status, 200);
  body = (await get()).body;
  assert.equal(lines(body)['money:cash'].accountId, null);
  assert.equal(body.missing, 11, 'Accessories chosen, Cash cleared again');
});

test('an account the service doesn\'t offer, a line that isn\'t one, or choosing before connecting is refused', async () => {
  const unknown = await choose('money:card', 'nope');
  assert.deepEqual([unknown.status, unknown.body.error], [400, 'That account isn’t one Xero offers']);
  const badLine = await choose('money:crypto', (await get()).body.accounts[0].id);
  assert.deepEqual([badLine.status, badLine.body.error], [400, 'That isn’t one of the lines']);
  const third = await staffSignup(server.baseUrl, { shopName: 'Third Cycles' });
  extra.push(third);
  const before = await choose('money:card', 'x', third);
  assert.deepEqual([before.status, before.body.error], [409, 'Connect accounts software first']);
});

test('disconnecting sends nothing, shows Not connected and keeps the choices for reconnecting', async () => {
  const keep = (await get()).body.accounts[0].id;
  assert.equal((await choose('money:card', keep)).status, 200);
  const res = await disconnect();
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const gone = (await get()).body;
  assert.deepEqual([gone.status, gone.connection, gone.summary], ['not_connected', null, 'Not connected']);
  const rows = await runWithShop(owner.shop.id, () => prepare('SELECT line_key, account_id FROM accounts_choices ORDER BY line_key').all());
  assert.ok(rows.some((r) => r.line_key === 'money:card' && r.account_id === keep), 'the choices are kept');
  const again = await disconnect();
  assert.deepEqual([again.status, again.body.error], [409, 'Not connected']);
  assert.equal((await connect('xero')).status, 200, 'reconnecting');
  assert.equal(lines((await get()).body)['money:card'].accountId, keep, 'finds the choices again');
  // A different service offers different accounts: it starts with its own choices, and Xero's are kept for coming back.
  await disconnect();
  assert.equal((await connect('quickbooks')).status, 200);
  assert.equal(lines((await get()).body)['money:card'].accountId, null);
  assert.equal((await choose('money:card', (await get()).body.accounts[1].id)).status, 200);
  await disconnect();
  assert.equal((await connect('xero')).status, 200);
  assert.equal(lines((await get()).body)['money:card'].accountId, keep, 'Xero\'s choice is still there');
});

test('a category added later is a line of its own, with no account chosen', async () => {
  await runWithShop(owner.shop.id, () => prepare("INSERT INTO product_categories (name, path) VALUES ('Clothing', 'Clothing')").run());
  const body = (await get()).body;
  assert.ok(body.groups[0].lines.some((l) => l.label === 'Clothing' && l.accountId === null));
});

test('another shop\'s choices never touch this one\'s, and a bad body is a 400', async () => {
  const mine = lines((await get()).body);
  const theirs = (await get(other)).body;
  assert.equal(theirs.status, 'connected');
  assert.equal((await choose('money:cash', theirs.accounts[0].id, other)).status, 200);
  assert.equal(lines((await get()).body)['money:cash'].accountId, mine['money:cash'].accountId, 'unchanged by the other shop');
  for (const [method, p] of [['POST', '/api/accounts/connect'], ['PUT', '/api/accounts/choices']]) {
    const res = await fetch(`${server.baseUrl}${p}`, { method, headers: { cookie: owner.cookie, 'content-type': 'application/json' }, body: '{nope' });
    assert.equal(res.status, 400, p);
  }
});

test('a category named like one of the fixed lines is that line, and a very long name is left out, not a failure', async () => {
  await runWithShop(owner.shop.id, () => prepare("INSERT INTO product_categories (name, path) VALUES ('Labour', 'Labour'), (?, ?)").run('x'.repeat(500), 'x'.repeat(500)));
  const body = (await get()).body;
  const labels = body.groups[0].lines.map((l) => l.label);
  assert.equal(labels.filter((l) => l === 'Labour').length, 1);
  assert.ok(!labels.some((l) => l.length > 300));
});

test('the pretend service makes no outside request', async () => {
  const { pretend } = await import('../server/accounts/pretend.js');
  const real = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('an outside request was made'); };
  try {
    await pretend.connect('xero');
    assert.equal((await pretend.listAccounts('quickbooks')).length, 8);
    await pretend.disconnect('xero');
  } finally {
    globalThis.fetch = real;
  }
});
