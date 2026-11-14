// Sending each closed day to the accounts software (openspec/changes/reports-accounts-and-reopen, accounts-software
// spec: 'Each closed day is sent once, as one summary', 'What was sent', 'When the connection is lost', 'A reopened
// day is corrected, not added to'; design decisions 5 to 7; Jack's answers 1 to 3 of 12 Nov). Migration 153,
// server/accounts/summary.js and send.js, the send after a close, and GET /api/accounts/log. Everything goes to the
// pretend service, which keeps what it is sent in Wheelhouse's own tables. The live server's clock is pinned to
// 07:00 on 1 Sep 2026 in London, so "today" is 2026-09-01.
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
import { sendClosedDay } from '../server/accounts/send.js';
import { buildSummary, moneyBucket } from '../server/accounts/summary.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie, checkInAtTill } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = '153_accounts_sends.sql';
const FLOAT = 15000;
const TODAY = '2026-09-01';
const YESTERDAY = '2026-08-31';
let server;
const shops = [];
before(async () => { server = await startLiveServer(); });
after(async () => {
  for (const s of shops) await deleteTestShop(s.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const call = (who, p, options) => staffRequest(server.baseUrl, who.cookie, p, options);
const post = (who, p, body) => call(who, p, { method: 'POST', body });
const one = (owner, text, ...args) => runWithShop(owner.shop.id, () => prepare(text).get(...args));
const all = (owner, text, ...args) => runWithShop(owner.shop.id, () => prepare(text).all(...args));

// A shop checked in at the till with its float set and this morning's float check; categories and products;
// connected to the pretend Xero with an account chosen for every line a day might use (`choose`).
async function shop({ connect = true, choose = true } = {}) {
  const owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  shops.push(owner);
  const till = await checkInAtTill(server.baseUrl, owner.cookie);
  Object.assign(owner, { session: owner.cookie, cookie: till.cookie });
  assert.equal((await call(owner, '/api/end-of-day-settings', { method: 'PUT', body: { floatPence: FLOAT } })).status, 200);
  owner.yesterdayCheck = await one(owner, 'INSERT INTO float_checks (day, login_id, expected_pence, counted_pence, checked_at) VALUES (?, ?, ?, ?, ?) RETURNING id', YESTERDAY, owner.loginId, FLOAT, FLOAT, `${YESTERDAY}T06:00:00Z`);
  const res = await post(owner, '/api/float-check', { countedPence: null });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  await one(owner, "UPDATE float_checks SET checked_at = '2026-09-01T06:00:00Z' WHERE id = ? RETURNING id", res.body.check.id);
  await runWithShop(owner.shop.id, async () => {
    await prepare("INSERT INTO product_categories (name, path) VALUES ('Accessories', 'Accessories'), ('Drivetrain', 'Drivetrain')").run();
  });
  owner.chain = await one(owner, "INSERT INTO products (name, category, price) VALUES ('Chain', 'Drivetrain', 20) RETURNING id");
  owner.bottle = await one(owner, "INSERT INTO products (name, category, price) VALUES ('Bottle', 'Accessories', 10) RETURNING id");
  if (connect) {
    assert.equal((await post(owner, '/api/accounts/connect', { provider: 'xero' })).status, 200);
    if (choose) {
      const accounts = (await call(owner, '/api/accounts')).body.accounts;
      const lines = ['sales:Drivetrain', 'sales:Accessories', 'sales:Labour', 'sales:Other sales', 'money:cash', 'money:card', 'money:accounts', 'money:gift', 'money:c2w', 'money:online', 'other:cash_difference', 'other:vat'];
      for (const [i, line] of lines.entries()) {
        assert.equal((await call(owner, '/api/accounts/choices', { method: 'PUT', body: { line, accountId: accounts[i % accounts.length].id } })).status, 200, line);
      }
    }
  }
  return owner;
}
const chooseOne = async (owner, line) => {
  const accounts = (await call(owner, '/api/accounts')).body.accounts;
  assert.equal((await call(owner, '/api/accounts/choices', { method: 'PUT', body: { line, accountId: accounts[0].id } })).status, 200);
};
// An old-record sale (pounds, no VAT) with lines.
async function oldSale(owner, at, { cash = 0, card = 0, extra = [], lines }) {
  const total = cash + card + extra.reduce((n, e) => n + e.amount, 0);
  const sale = await one(owner, "INSERT INTO sales (created_at, subtotal, total, payment_method, cash_amount, card_amount) VALUES (?, ?, ?, 'Split', ?, ?) RETURNING id", at, total, total, cash, card);
  for (const l of lines) await one(owner, 'INSERT INTO sale_items (sale_id, product_id, name, unit_price, qty, line_total, line_type) VALUES (?, ?, ?, ?, 1, ?, ?) RETURNING id', sale.id, l.product ?? null, l.name, l.total, l.total, l.type ?? 'product');
  for (const e of extra) await one(owner, 'INSERT INTO sale_payments (sale_id, tender_type, amount) VALUES (?, ?, ?) RETURNING id', sale.id, e.tenderType, e.amount);
  return sale;
}
// A till-record sale (pence, with VAT per line), with its payments.
async function tillSale(owner, { lines, payments, total }) {
  await one(owner, "INSERT INTO sites (name, code) VALUES ('Bolton', 'B') ON CONFLICT (shop_id, code) DO UPDATE SET name = EXCLUDED.name RETURNING id");
  const site = await one(owner, "SELECT id FROM sites WHERE code = 'B'");
  await one(owner, "INSERT INTO tills (site_id, code, name, token_hash) VALUES (?, 'B1', 'Till B1', ?) ON CONFLICT (shop_id, code) DO UPDATE SET name = EXCLUDED.name RETURNING id", site.id, randomUUID());
  const till = await one(owner, "SELECT id FROM tills WHERE code = 'B1'");
  const sale = await one(owner,
    `INSERT INTO till_sales (client_id, till_id, site_id, receipt_number, made_offline, till_clock_at, total_pence, vat_pence) VALUES (?, ?, ?, ?, false, ?, ?, ?) RETURNING id`,
    randomUUID(), till.id, site.id, Math.floor(Math.random() * 1e6), '2026-09-01T11:00:00Z', total ?? payments.reduce((n, p) => n + p.pence, 0), lines.reduce((n, l) => n + l.vat, 0));
  for (const l of lines) await one(owner, 'INSERT INTO till_sale_lines (till_sale_id, product_id, description, qty, unit_price_pence, line_total_pence, vat_rate_bp, vat_pence) VALUES (?, ?, ?, 1, ?, ?, 2000, ?) RETURNING id', sale.id, l.product, l.name, l.gross, l.gross, l.vat);
  for (const p of payments) await one(owner, 'INSERT INTO till_sale_payments (till_sale_id, method, amount_pence) VALUES (?, ?, ?) RETURNING id', sale.id, p.method, p.pence);
}
// Today's ordinary sales: £30.00 cash in the old record (a chain £20, a bottle £10, no VAT recorded) and £30.00 by
// card in the till record (the same, with £5.00 of VAT in all). £60.00 in all: £55.00 of sales and £5.00 of VAT.
async function ordinaryDay(owner) {
  await oldSale(owner, '2026-09-01T10:00:00Z', { cash: 30, lines: [{ product: owner.chain.id, name: 'Chain', total: 20 }, { product: owner.bottle.id, name: 'Bottle', total: 10 }] });
  await tillSale(owner, { lines: [{ product: owner.chain.id, name: 'Chain', gross: 2000, vat: 333 }, { product: owner.bottle.id, name: 'Bottle', gross: 1000, vat: 167 }], payments: [{ method: 'card', pence: 3000 }] });
}
const closeToday = async (owner, countedPence) => {
  const res = await post(owner, '/api/close-the-day', { countedPence });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body.close;
};
const sends = (owner) => all(owner, "SELECT *, to_char(day, 'YYYY-MM-DD') AS day_text FROM accounts_sends ORDER BY day");
const pretendSummaries = (owner) => all(owner, "SELECT *, to_char(day, 'YYYY-MM-DD') AS day_text FROM accounts_pretend_summaries ORDER BY day");
const log = (owner) => call(owner, '/api/accounts/log');
const yesterdayClose = (owner) => one(owner,
  `INSERT INTO day_closes (day, login_id, closed_at, float_check_id, float_start_pence, cash_pence, paid_outs_pence, expected_pence, counted_pence,
     float_pence, banked_pence, takings_pence, card_pence, other_pence) VALUES (?, ?, ?, ?, 15000, 0, 0, 15000, 15000, 15000, 0, 0, 0, 0) RETURNING id`,
  YESTERDAY, owner.loginId, `${YESTERDAY}T17:00:00Z`, owner.yesterdayCheck.id);

test('153 runs from empty and twice, protects each shop, and keeps one send and one pretend summary a day', async (t) => {
  let admin;
  try { admin = adminUrlFrom(process.env); } catch (err) { if (process.env.CI) throw err; t.skip('no superuser connection configured'); return; }
  const name = `epos_mig153_${process.pid}`;
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
    const q = async (sql, args) => (await client.query(sql, args)).rows[0];
    for (const table of ['accounts_sends', 'accounts_pretend_summaries']) {
      assert.deepEqual(await q('SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = $1', [table]), { relrowsecurity: true, relforcerowsecurity: true }, table);
      assert.equal((await q('SELECT count(*)::int AS n FROM pg_policies WHERE tablename = $1', [table])).n, 1, table);
    }
    const shopId = (await q("INSERT INTO shops (name, slug) VALUES ('[Shop]', 's1') RETURNING id")).id;
    await client.query("SELECT set_config('app.current_shop_id', $1, false)", [String(shopId)]);
    const send = (day, status) => client.query("INSERT INTO accounts_sends (shop_id, day, status) VALUES ($1, $2, $3)", [shopId, day, status]);
    await send('2026-09-01', 'sent');
    await assert.rejects(send('2026-09-01', 'waiting'), /unique|duplicate/i, 'one send a day');
    await assert.rejects(send('2026-09-02', 'broken'), /check/i);
    const summary = (day, ext) => client.query("INSERT INTO accounts_pretend_summaries (shop_id, provider, external_id, day, version, summary) VALUES ($1, 'xero', $2, $3, 1, '{}')", [shopId, ext, day]);
    await summary('2026-09-01', 'p1');
    await assert.rejects(summary('2026-09-01', 'p2'), /unique|duplicate/i, 'the pretend service holds one summary a day for each service');
  } finally {
    await client.end();
  }
});

test('closing a day while connected sends one balanced summary built from the sales that close counted', async () => {
  const owner = await shop();
  await ordinaryDay(owner);
  const close = await closeToday(owner, FLOAT + 3000);
  const [row] = await sends(owner);
  assert.deepEqual([row.status, row.day_text, row.amount_pence, row.version], ['sent', TODAY, 6000, 1]);
  assert.ok(row.external_id && row.sent_at);
  const held = await pretendSummaries(owner);
  assert.equal(held.length, 1);
  const lines = Object.fromEntries(held[0].summary.lines.map((l) => [l.key, l.amountPence]));
  assert.deepEqual(lines, {
    'sales:Drivetrain': 2000 + 1667, 'sales:Accessories': 1000 + 833, 'other:vat': 500, 'money:cash': 3000, 'money:card': 3000,
  });
  const sum = (keys) => keys.reduce((n, k) => n + (lines[k] ?? 0), 0);
  assert.equal(sum(['sales:Drivetrain', 'sales:Accessories', 'other:vat']), sum(['money:cash', 'money:card']), 'it balances');
  assert.ok(held[0].summary.lines.every((l) => l.accountId && l.accountName), 'each line has the account chosen for it');
  assert.ok(held[0].summary.notRecorded.includes('Refunds') && held[0].summary.notRecorded.includes('Discounts given'));
  assert.ok(held[0].summary.notRecorded.includes('VAT on old-record sales'), 'the old record keeps no VAT (Jack\'s answer 2)');
  const entry = (await log(owner)).body.days.find((d) => d.day === TODAY);
  assert.deepEqual([entry.status, entry.amountPence, entry.closeId], ['sent', 6000, close.id]);
  assert.ok(entry.sentAt);
  // A second close attempt, or sending again, never sends it twice.
  await runWithShop(owner.shop.id, () => sendClosedDay(close.id));
  assert.equal((await pretendSummaries(owner)).length, 1);
  assert.equal((await sends(owner))[0].version, 1);
});

test('a short or over count goes as the cash difference, and the day still balances', async () => {
  const owner = await shop();
  await ordinaryDay(owner);
  await closeToday(owner, FLOAT + 3000 - 500);
  const held = (await pretendSummaries(owner))[0];
  const lines = Object.fromEntries(held.summary.lines.map((l) => [l.key, l.amountPence]));
  assert.equal(lines['other:cash_difference'], -500);
  assert.equal(held.summary.balanced, true);
});

test('online money, customer accounts and gift cards each go to their own line', async () => {
  const owner = await shop();
  await oldSale(owner, '2026-09-01T10:00:00Z', { extra: [{ tenderType: 'Shopify', amount: 20 }, { tenderType: 'Store credit', amount: 5 }, { tenderType: 'Customer account', amount: 7 }], lines: [{ product: owner.chain.id, name: 'Chain', total: 32 }] });
  await closeToday(owner, FLOAT);
  const lines = Object.fromEntries((await pretendSummaries(owner))[0].summary.lines.map((l) => [l.key, l.amountPence]));
  assert.deepEqual([lines['money:online'], lines['money:gift'], lines['money:accounts']], [2000, 500, 700]);
  assert.equal(lines['sales:Drivetrain'], 3200);
});

// A Cycle to Work hand-over's provider share is owed by the provider: its own line, the same way online money has
// one, not Gift cards (Jack, 14 Nov, merge-c2w Q1 option 2).
test('Cycle to Work money goes to its own line, not Gift cards', async () => {
  const owner = await shop();
  await oldSale(owner, '2026-09-01T10:00:00Z', { extra: [{ tenderType: 'Cycle to Work · Cyclescheme', amount: 880 }, { tenderType: 'Gift card', amount: 5 }], lines: [{ product: owner.chain.id, name: 'Bike', total: 885 }] });
  await closeToday(owner, FLOAT);
  const held = (await pretendSummaries(owner))[0];
  const lines = Object.fromEntries(held.summary.lines.map((l) => [l.key, l.amountPence]));
  assert.deepEqual([lines['money:c2w'], lines['money:gift']], [88000, 500]);
  assert.equal(held.summary.lines.find((l) => l.key === 'money:c2w').label, 'Cycle to Work (owed by providers)');
  assert.equal(held.summary.balanced, true);
  assert.deepEqual(['cycle to work · bike2work', ' Cycle to Work · Acme Account ', 'Customer account', 'Gift card'].map(moneyBucket), ['c2w', 'c2w', 'accounts', 'gift']);
});

// A hand-over is saved in the old record; the till record's payments are never one. Close-the-day counts a till
// payment that isn't cash or card as Other, so the summary files it under Gift cards, whatever it is called, and
// Xero and the end-of-day report agree.
test('a till payment called Cycle to Work goes where close-the-day counts it, Gift cards', async () => {
  const owner = await shop();
  await tillSale(owner, { lines: [{ product: owner.chain.id, name: 'Chain', gross: 2000, vat: 333 }], payments: [{ method: 'Cycle to Work · Cyclescheme', pence: 2000 }] });
  const close = await closeToday(owner, FLOAT);
  assert.deepEqual([close.otherPence, close.c2wPence], [2000, 0]);
  const lines = Object.fromEntries((await pretendSummaries(owner))[0].summary.lines.map((l) => [l.key, l.amountPence]));
  assert.deepEqual([lines['money:gift'], lines['money:c2w']], [2000, undefined]);
});

// The line is recorded, so a day with Cycle to Work money waits until an account is chosen for it.
test('a day with Cycle to Work money and no account chosen for its line is not sent, saying which', async () => {
  const owner = await shop({ choose: false });
  for (const line of ['sales:Drivetrain', 'money:gift', 'other:vat']) await chooseOne(owner, line);
  await oldSale(owner, '2026-09-01T10:00:00Z', { extra: [{ tenderType: 'Cycle to Work · Cyclescheme', amount: 880 }], lines: [{ product: owner.chain.id, name: 'Bike', total: 880 }] });
  await closeToday(owner, FLOAT);
  const [row] = await sends(owner);
  assert.deepEqual([row.status, row.reason, row.failed_line], ['failed', 'Cycle to Work (owed by providers) has no Xero account chosen', 'money:c2w']);
  await chooseOne(owner, 'money:c2w');
  assert.equal((await sends(owner))[0].status, 'sent', 'choosing the account sends the day');
});

test('labour and a sale with no category have their own lines', async () => {
  const owner = await shop();
  await oldSale(owner, '2026-09-01T10:00:00Z', { cash: 15, lines: [{ name: 'Fit tyre', total: 15, type: 'labour' }] });
  await tillSale(owner, { lines: [{ product: null, name: 'Typed item', gross: 2500, vat: 417 }], payments: [{ method: 'cash', pence: 2500 }] });
  await closeToday(owner, FLOAT + 4000);
  const lines = Object.fromEntries((await pretendSummaries(owner))[0].summary.lines.map((l) => [l.key, l.amountPence]));
  assert.deepEqual([lines['sales:Labour'], lines['sales:Other sales'], lines['other:vat']], [1500, 2500 - 417, 417]);
});

test('a line with no account chosen leaves the day closed and not sent, saying which, and choosing it sends the day', async () => {
  const owner = await shop({ choose: false });
  for (const line of ['sales:Drivetrain', 'money:cash', 'money:card', 'other:vat']) await chooseOne(owner, line);
  await ordinaryDay(owner);
  const close = await closeToday(owner, FLOAT + 3000);
  assert.ok(close.id, 'the day is closed whatever happens to the send');
  const [row] = await sends(owner);
  assert.deepEqual([row.status, row.reason, row.failed_line], ['failed', 'Accessories has no Xero account chosen', 'sales:Accessories']);
  assert.equal((await pretendSummaries(owner)).length, 0);
  const entry = (await log(owner)).body.days.find((d) => d.day === TODAY);
  assert.deepEqual([entry.status, entry.reason, entry.missingLine], ['failed', 'Accessories has no Xero account chosen', 'Accessories']);
  await chooseOne(owner, 'sales:Accessories');
  assert.equal((await sends(owner))[0].status, 'sent', 'choosing the account sends the day');
  assert.equal((await pretendSummaries(owner)).length, 1);
});

test('a day closed while disconnected waits, and reconnecting sends the waiting days oldest first, each once', async () => {
  const owner = await shop();
  assert.equal((await post(owner, '/api/accounts/disconnect', {})).status, 200);
  const yesterday = await yesterdayClose(owner);
  await runWithShop(owner.shop.id, () => sendClosedDay(yesterday.id));
  await ordinaryDay(owner);
  await closeToday(owner, FLOAT + 3000);
  assert.deepEqual((await sends(owner)).map((s) => [s.day_text, s.status]), [[YESTERDAY, 'waiting'], [TODAY, 'waiting']]);
  assert.equal((await pretendSummaries(owner)).length, 0, 'nothing is sent while disconnected');
  const entry = (await log(owner)).body.days.find((d) => d.day === TODAY);
  assert.deepEqual([entry.status, entry.text], ['waiting', 'sends when Xero is reconnected']);
  assert.equal((await post(owner, '/api/accounts/connect', { provider: 'xero' })).status, 200);
  const held = await pretendSummaries(owner);
  assert.deepEqual(held.map((h) => h.day_text), [YESTERDAY, TODAY]);
  assert.ok(held[0].id < held[1].id, 'oldest first');
  assert.deepEqual((await sends(owner)).map((s) => s.status), ['sent', 'sent']);
});

test('a refused or expired connection marks it lost and keeps the day waiting; reconnecting sends it', async () => {
  const owner = await shop();
  await ordinaryDay(owner);
  process.env.ACCOUNTS_PRETEND_REFUSE = 'lost';
  try {
    await closeToday(owner, FLOAT + 3000); // the server's own environment is unchanged: close it, then send under the refusal below
  } finally {
    delete process.env.ACCOUNTS_PRETEND_REFUSE;
  }
  const close = await one(owner, 'SELECT id FROM day_closes WHERE day = ?', TODAY);
  await one(owner, "UPDATE accounts_sends SET status = 'waiting', external_id = NULL, sent_at = NULL, version = 0 WHERE day = ? RETURNING id", TODAY);
  await all(owner, 'DELETE FROM accounts_pretend_summaries');
  process.env.ACCOUNTS_PRETEND_REFUSE = 'lost';
  try {
    await runWithShop(owner.shop.id, () => sendClosedDay(close.id));
  } finally {
    delete process.env.ACCOUNTS_PRETEND_REFUSE;
  }
  const state = (await call(owner, '/api/accounts')).body;
  assert.deepEqual([state.status, state.summary], ['lost', 'Xero disconnected']);
  assert.ok(state.lostOn, 'it says when');
  assert.equal((await sends(owner))[0].status, 'waiting');
  assert.equal((await pretendSummaries(owner)).length, 0);
  assert.equal((await post(owner, '/api/accounts/connect', { provider: 'xero' })).status, 200, 'Reconnect');
  assert.equal((await sends(owner))[0].status, 'sent');
});

test('a summary that does not balance is not sent, and says so', async () => {
  const owner = await shop();
  // A till sale whose payments are £5.00 short of its total: the money doesn't match the sales.
  await tillSale(owner, { lines: [{ product: owner.chain.id, name: 'Chain', gross: 2000, vat: 333 }], payments: [{ method: 'card', pence: 1500 }], total: 2000 });
  await closeToday(owner, FLOAT);
  const [row] = await sends(owner);
  assert.deepEqual([row.status, row.reason], ['failed', 'The day’s lines don’t add up: money taken £15.00, sales and VAT £20.00']);
  assert.equal((await pretendSummaries(owner)).length, 0);
});

test('a reopened day is not sent while it is reopened, and its summary is replaced, once, when it closes again', async () => {
  const owner = await shop();
  await ordinaryDay(owner);
  const close = await closeToday(owner, FLOAT + 3000);
  const first = (await pretendSummaries(owner))[0];
  assert.equal((await post(owner, `/api/reports/days/${close.id}/reopen`, { reason: 'miscounted' })).status, 200);
  assert.equal((await pretendSummaries(owner)).length, 1);
  assert.equal((await log(owner)).body.days.find((d) => d.day === TODAY).status, 'reopened');
  await closeToday(owner, FLOAT + 3000 - 200);
  const held = await pretendSummaries(owner);
  assert.equal(held.length, 1, 'replaced, not added to');
  assert.equal(held[0].external_id, first.external_id);
  assert.equal(held[0].version, 2);
  assert.equal(held[0].summary.lines.find((l) => l.key === 'other:cash_difference').amountPence, -200);
  const [row] = await sends(owner);
  assert.deepEqual([row.status, row.version], ['sent', 2]);
});

test('a shop that never connected has no sends and no log, and the log is the Owner\'s', async () => {
  const owner = await shop({ connect: false });
  await ordinaryDay(owner);
  await closeToday(owner, FLOAT + 3000);
  assert.equal((await sends(owner)).length, 0);
  const res = await log(owner);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.days, []);
  const made = await post(owner, '/api/team', { name: 'Jo Taylor', isCashier: true, email: `jo-${randomUUID().slice(0, 8)}@example.test`, password: 'password123' });
  const jo = { cookie: await staffFreshCookie(made.body.loginId) };
  const refused = await call(jo, '/api/accounts/log');
  assert.deepEqual([refused.status, refused.body.error], [403, "Only the shop's owner can connect accounts software"]);
});

test('Today lists a day that did not go, with the line to choose, and it goes once the day is sent', async () => {
  const owner = await shop({ choose: false });
  for (const line of ['sales:Drivetrain', 'money:cash', 'money:card', 'other:vat']) await chooseOne(owner, line);
  await ordinaryDay(owner);
  await closeToday(owner, FLOAT + 3000);
  const items = async () => (await call(owner, '/api/needs-attention')).body.items.filter((i) => i.kind === 'day_not_sent');
  const [line] = await items();
  assert.deepEqual({ ...line, closedAt: 0 }, { kind: 'day_not_sent', day: TODAY, providerName: 'Xero', closedAt: 0, reason: 'Accessories has no Xero account chosen', missingLine: 'Accessories', line: 'sales:Accessories' });
  await chooseOne(owner, 'sales:Accessories');
  assert.equal((await items()).length, 0);
});

test('the summary is worked out from the close\'s own sales, not by the clock', async () => {
  const owner = await shop();
  await ordinaryDay(owner);
  const close = await closeToday(owner, FLOAT + 3000);
  await oldSale(owner, '2026-09-01T12:00:00Z', { cash: 99, lines: [{ product: owner.chain.id, name: 'Chain', total: 99 }] }); // saved after the close: the next close's
  const built = await runWithShop(owner.shop.id, () => buildSummary(close.id));
  assert.equal(built.totalPence, 6000);
});

test('Takings and cash-ups says where each day went, only while accounts software is connected or lost', async () => {
  const owner = await shop({ choose: false });
  for (const line of ['sales:Drivetrain', 'money:cash', 'money:card', 'other:vat']) await chooseOne(owner, line);
  await ordinaryDay(owner);
  await closeToday(owner, FLOAT + 3000); // Accessories has no account: not sent
  const report = (await call(owner, '/api/reports/takings?period=this-week')).body;
  assert.deepEqual(report.accounts, { providerName: 'Xero', status: 'connected' });
  const day = report.rows.find((r) => r.kind === 'day' && r.key === TODAY);
  const online = report.rows.find((r) => r.kind === 'online' && r.key === TODAY);
  assert.deepEqual([day.sent, online.sent], ['failed', 'failed'], 'the Online row says what its day does');
  await chooseOne(owner, 'sales:Accessories');
  assert.equal((await call(owner, '/api/reports/takings?period=this-week')).body.rows.find((r) => r.kind === 'day' && r.key === TODAY).sent, 'sent');
  await post(owner, '/api/accounts/disconnect', {});
  assert.equal((await call(owner, '/api/reports/takings?period=this-week')).body.accounts, null, 'no column without accounts software');
});

test('a service that is down leaves the day not sent, and it goes on the next try', async () => {
  const owner = await shop();
  await ordinaryDay(owner);
  process.env.ACCOUNTS_PRETEND_REFUSE = 'down';
  try { await closeToday(owner, FLOAT + 3000); } finally { delete process.env.ACCOUNTS_PRETEND_REFUSE; }
  // The live server's own environment is unchanged, so it sent; put the day back to failed, then refuse here.
  const close = await one(owner, 'SELECT id FROM day_closes WHERE day = ?', TODAY);
  await one(owner, "UPDATE accounts_sends SET status = 'waiting', external_id = NULL, sent_at = NULL, version = 0 WHERE day = ? RETURNING id", TODAY);
  await all(owner, 'DELETE FROM accounts_pretend_summaries');
  process.env.ACCOUNTS_PRETEND_REFUSE = 'down';
  try { await runWithShop(owner.shop.id, () => sendClosedDay(close.id)); } finally { delete process.env.ACCOUNTS_PRETEND_REFUSE; }
  const [row] = await sends(owner);
  assert.equal(row.status, 'failed');
  assert.match(row.reason, /Xero didn’t take it/);
  assert.equal((await pretendSummaries(owner)).length, 0);
  await runWithShop(owner.shop.id, () => sendClosedDay(close.id));
  assert.equal((await sends(owner))[0].status, 'sent');
});

test('a discount is shared across a sale\'s lines, so the lines still add up to what was paid', async () => {
  const owner = await shop();
  // £30.00 of lines with £5.00 off: £25.00 paid by card, VAT £5.00 on the lines.
  await tillSale(owner, { lines: [{ product: owner.chain.id, name: 'Chain', gross: 2000, vat: 333 }, { product: owner.bottle.id, name: 'Bottle', gross: 1000, vat: 167 }], payments: [{ method: 'card', pence: 2500 }], total: 2500 });
  await closeToday(owner, FLOAT);
  const [held] = await pretendSummaries(owner);
  const by = Object.fromEntries(held.summary.lines.map((l) => [l.key, l.amountPence]));
  assert.equal(held.summary.balanced, true);
  assert.equal(by['money:card'], 2500);
  assert.equal(by['sales:Drivetrain'] + by['sales:Accessories'] + by['other:vat'], 2500);
  assert.ok(by['sales:Drivetrain'] < 2000 - 333, 'the discount took something off the chain');
});

test('a product whose category is not in the categories list goes to Other sales', async () => {
  const owner = await shop();
  const gizmo = await one(owner, "INSERT INTO products (name, category, price) VALUES ('Gizmo', 'Mystery', 10) RETURNING id");
  await tillSale(owner, { lines: [{ product: gizmo.id, name: 'Gizmo', gross: 1200, vat: 200 }], payments: [{ method: 'cash', pence: 1200 }] });
  await closeToday(owner, FLOAT + 1200);
  const by = Object.fromEntries((await pretendSummaries(owner))[0].summary.lines.map((l) => [l.key, l.amountPence]));
  assert.equal(by['sales:Other sales'], 1000);
});

test('two sends of one day at the same moment post it once', async () => {
  const owner = await shop();
  assert.equal((await post(owner, '/api/accounts/disconnect', {})).status, 200);
  await ordinaryDay(owner);
  await closeToday(owner, FLOAT + 3000);
  await one(owner, "UPDATE accounts_connections SET status = 'connected', disconnected_at = NULL RETURNING id");
  const close = await one(owner, 'SELECT id FROM day_closes WHERE day = ?', TODAY);
  await Promise.all([1, 2].map(() => runWithShop(owner.shop.id, () => sendClosedDay(close.id))));
  assert.equal((await pretendSummaries(owner)).length, 1);
  assert.deepEqual((await sends(owner)).map((r) => r.status), ['sent']);
});

test('a day sent to one service and corrected after the shop moved to another is posted fresh there', async () => {
  const owner = await shop();
  await ordinaryDay(owner);
  const close = await closeToday(owner, FLOAT + 3000);
  const first = (await pretendSummaries(owner))[0];
  assert.equal((await post(owner, `/api/reports/days/${close.id}/reopen`, { reason: 'miscounted' })).status, 200);
  assert.equal((await post(owner, '/api/accounts/disconnect', {})).status, 200);
  assert.equal((await post(owner, '/api/accounts/connect', { provider: 'quickbooks' })).status, 200);
  const accounts = (await call(owner, '/api/accounts')).body.accounts;
  const lines = ['sales:Drivetrain', 'sales:Accessories', 'money:cash', 'money:card', 'other:vat'];
  for (const line of lines) assert.equal((await call(owner, '/api/accounts/choices', { method: 'PUT', body: { line, accountId: accounts[0].id } })).status, 200);
  await closeToday(owner, FLOAT + 3000);
  const held = await pretendSummaries(owner);
  const quickbooks = held.find((h) => h.provider === 'quickbooks');
  assert.ok(quickbooks, 'QuickBooks has the day');
  assert.notEqual(quickbooks.external_id, first.external_id);
  assert.equal(quickbooks.version, 1);
});
