// Changes made in Wheelhouse go to the shop's Shopify as they happen (Jack's
// answer to Q2, 12 Nov evening, docs/decisions/2026-11-12-website-defaults-taken.md;
// drawing ws-shopify-on: "sent as you change them in Wheelhouse"). A sale, a
// stock change, a held bike, or an edit to a product shown online is queued
// by the database (migration 150) and the background job sends it through
// the adapter's pretend Shopify, with nothing to press. Paused, changes wait
// for Resume; switched to Wheelhouse's website, nothing is queued.
//
// Needs the compose Postgres up (npm run docker:up) or it hangs with no output.
import '../server/load-env.js';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';
import { sendRound, startShopifySending } from '../server/shopify/sending.js';
import { pretendShopify as pretend } from '../server/shopify/pretend.js';

process.env.SHOPIFY_PROVIDER = 'pretend';

let server;
before(async () => { server = await startLiveServer(); });
after(async () => {
  if (server) await server.stop();
  await pool.end();
});
const ok = (res, status = 200) => { assert.equal(res.status, status, JSON.stringify(res.body)); return res.body; };
const ADDRESS = 'live-street.myshopify.com';

async function freshShop(t, name) {
  const s = await staffSignup(server.baseUrl, { shopName: name });
  t.after(() => deleteTestShop(s.shop.id));
  const req = (p, options) => staffRequest(server.baseUrl, s.cookie, p, options);
  const inShop = (fn) => runWithShop(s.shop.id, fn);
  return { ...s, req, inShop };
}
async function connect(shop) {
  const { address: page } = ok(await shop.req('/api/shopify/connect', { method: 'POST', body: { address: ADDRESS } }));
  const opened = await fetch(new URL(page, server.baseUrl), { headers: { cookie: shop.cookie } });
  const approve = (await opened.text()).match(/<a href="([^"]+)"[^>]*>Approve<\/a>/)[1].replaceAll('&amp;', '&');
  await fetch(new URL(approve, server.baseUrl), { headers: { cookie: shop.cookie }, redirect: 'manual' });
}
const addProduct = (shop, { sku, price = 10, photo = `/p/${sku}.jpg`, stock = 5, online = true, category = 'Parts' }) => shop.inShop(() => prepare(
  `INSERT INTO products (sku, name, category, price, cost, stock_qty, show_online, photo_url, active, updated_at)
   VALUES (?, ?, ?, ?, 0, ?, ?, ?, 1, now()) RETURNING id`
).get(sku, `[${sku}]`, category, price, stock, online, photo)).then((r) => r.id);
const inShopify = async (shop) => {
  const row = await shop.inShop(() => prepare('SELECT products FROM pretend_shopify WHERE address = ?').get(ADDRESS));
  return new Map((row?.products ?? []).map((p) => [p.sku, p]));
};
const queued = (shop) => shop.inShop(() => prepare('SELECT product_id FROM shopify_changed ORDER BY product_id').all()).then((r) => r.map((x) => x.product_id));
const link = async (shop) => ok(await shop.req('/api/website')).shopify;
// The background job's rounds, run here until it has nothing left.
async function rounds(shop) {
  for (let i = 0; i < 20; i += 1) if (!(await sendRound(shop.shop.id))) return;
  assert.fail('sending didn’t finish');
}
// Connected, with every product sent once by Send, and nothing waiting.
async function connectedAndSent(t, name, products) {
  const shop = await freshShop(t, name);
  const ids = {};
  for (const p of products) ids[p.sku] = await addProduct(shop, p);
  await connect(shop);
  ok(await shop.req('/api/shopify/send', { method: 'POST' }), 202);
  await rounds(shop);
  assert.deepEqual(await queued(shop), [], 'what Send sent is not queued again');
  return { shop, ids };
}

test('a sale at the till lowers the stock in Shopify, with nothing pressed', async (t) => {
  const sku = `TUBE-${randomUUID().slice(0, 6)}`;
  const { shop, ids } = await connectedAndSent(t, 'Live sale', [{ sku, stock: 6 }]);
  assert.equal((await inShopify(shop)).get(sku).stock, 6);
  const cashier = ok(await shop.req('/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `jo-${randomUUID().slice(0, 8)}@example.test`, password: 'password123' } }), 201);
  ok(await shop.req('/api/sales', { method: 'POST', body: { cashierId: cashier.employeeId, items: [{ productId: ids[sku], qty: 2 }], cashAmount: 20, cashTendered: 20 } }), 201);
  assert.deepEqual(await queued(shop), [ids[sku]], 'the sale queued the product');
  await rounds(shop);
  assert.equal((await inShopify(shop)).get(sku).stock, 4);
  assert.deepEqual(await queued(shop), []);
  assert.ok((await link(shop)).lastSentAt, 'last sent moves on');
});

test('a price or photo edit goes; a product not shown online, or a field Shopify doesn’t take, queues nothing', async (t) => {
  const { shop, ids } = await connectedAndSent(t, 'Live edits', [{ sku: 'E1' }, { sku: 'E2' }, { sku: 'E3' }, { sku: 'OFF', online: false }]);
  await shop.inShop(async () => {
    await prepare('UPDATE products SET price = 12.5 WHERE id = ?').run(ids.E1);
    await prepare("UPDATE products SET photo_url = '/p/new.jpg' WHERE id = ?").run(ids.E2);
    await prepare('UPDATE products SET price = 99 WHERE id = ?').run(ids.OFF);
    await prepare("UPDATE products SET supplier = '[Supplier]' WHERE id = ?").run(ids.E3);
  });
  assert.deepEqual(await queued(shop), [ids.E1, ids.E2].sort((a, b) => a - b));
  await rounds(shop);
  const there = await inShopify(shop);
  assert.equal(there.get('E1').pricePence, 1250);
  assert.equal(there.get('E2').photoUrl, '/p/new.jpg');
  assert.equal(there.has('OFF'), false);
});

test('a product switched to show online goes to Shopify as it is switched', async (t) => {
  const { shop, ids } = await connectedAndSent(t, 'Live switch on', [{ sku: 'LATER', online: false }]);
  await shop.inShop(() => prepare('UPDATE products SET show_online = true WHERE id = ?').run(ids.LATER));
  await rounds(shop);
  assert.equal((await inShopify(shop)).get('LATER').stock, 5);
  assert.equal((await link(shop)).products, 1, 'the count of products in Shopify goes up');
});

test('a bike held for someone leaves the stock Shopify sells, as it happens', async (t) => {
  const { shop, ids } = await connectedAndSent(t, 'Live hold', [{ sku: 'BIKE', stock: 2, category: 'Bikes' }]);
  const frame = await shop.inShop(() => prepare(
    "INSERT INTO stock_frames (product_id, frame_number, frame_key) VALUES (?, 'WTU123', 'WTU123') RETURNING id"
  ).get(ids.BIKE));
  await rounds(shop);
  await shop.inShop(() => prepare("UPDATE stock_frames SET state = 'held' WHERE id = ?").run(frame.id));
  assert.deepEqual(await queued(shop), [ids.BIKE]);
  await rounds(shop);
  assert.equal((await inShopify(shop)).get('BIKE').stock, 1);
});

test('paused, changes wait and go on Resume; switched to Wheelhouse’s website, nothing is queued', async (t) => {
  const { shop, ids } = await connectedAndSent(t, 'Live paused', [{ sku: 'P1', stock: 5 }]);
  ok(await shop.req('/api/shopify/pause', { method: 'POST' }));
  await shop.inShop(() => prepare('UPDATE products SET stock_qty = 3 WHERE id = ?').run(ids.P1));
  await rounds(shop);
  assert.equal((await inShopify(shop)).get('P1').stock, 5, 'nothing sent while paused');
  assert.deepEqual(await queued(shop), [ids.P1], 'still waiting');
  ok(await shop.req('/api/shopify/resume', { method: 'POST' }));
  await rounds(shop);
  assert.equal((await inShopify(shop)).get('P1').stock, 3);

  ok(await shop.req('/api/shopify/switch-to-wheelhouse', { method: 'POST' }));
  await shop.inShop(() => prepare('UPDATE products SET stock_qty = 1 WHERE id = ?').run(ids.P1));
  assert.deepEqual(await queued(shop), [], 'nothing queued once the shop uses Wheelhouse’s website');
});

test('paused with a change waiting, connecting again or switching to Wheelhouse’s website drops it', async (t) => {
  const { shop, ids } = await connectedAndSent(t, 'Live drop', [{ sku: 'D1', stock: 5 }]);
  ok(await shop.req('/api/shopify/pause', { method: 'POST' }));
  await shop.inShop(() => prepare('UPDATE products SET stock_qty = 3 WHERE id = ?').run(ids.D1));
  assert.deepEqual(await queued(shop), [ids.D1]);
  await connect(shop);
  assert.deepEqual(await queued(shop), [], 'connecting again starts afresh, with Send');

  const other = await connectedAndSent(t, 'Live drop 2', [{ sku: 'D2', stock: 5 }]);
  ok(await other.shop.req('/api/shopify/pause', { method: 'POST' }));
  await other.shop.inShop(() => prepare('UPDATE products SET stock_qty = 3 WHERE id = ?').run(other.ids.D2));
  assert.deepEqual(await queued(other.shop), [other.ids.D2]);
  ok(await other.shop.req('/api/shopify/switch-to-wheelhouse', { method: 'POST' }));
  assert.deepEqual(await queued(other.shop), []);
});

test('connected but never sent, a change waits for the first Send', async (t) => {
  const shop = await freshShop(t, 'Live unsent');
  const id = await addProduct(shop, { sku: 'U1', stock: 5 });
  await connect(shop);
  await shop.inShop(() => prepare('UPDATE products SET stock_qty = 4 WHERE id = ?').run(id));
  assert.deepEqual(await queued(shop), [], 'nothing queued before Send');
  await rounds(shop);
  assert.equal((await inShopify(shop)).size, 0, 'nothing in Shopify before Send');
  assert.equal((await link(shop)).lastSentAt, null);
});

test('the background job sends a change by itself', async (t) => {
  const { shop, ids } = await connectedAndSent(t, 'Live timer', [{ sku: 'T1', stock: 5 }]);
  await shop.inShop(() => prepare('UPDATE products SET stock_qty = 2 WHERE id = ?').run(ids.T1));
  const stop = startShopifySending(50, { scanAtStart: false, liveMs: 100 });
  try {
    for (let i = 0; i < 100 && (await queued(shop)).length; i += 1) await new Promise((r) => { setTimeout(r, 50); });
  } finally { await stop(); }
  assert.deepEqual(await queued(shop), []);
  assert.equal((await inShopify(shop)).get('T1').stock, 2);
});

test('Shopify not answering leaves the rest of a long queue for the next round', async (t) => {
  const products = Array.from({ length: 12 }, (_, i) => ({ sku: `L${i}`, stock: 5 }));
  const { shop, ids } = await connectedAndSent(t, 'Live long', products);
  await shop.inShop(() => prepare('UPDATE products SET stock_qty = 4 WHERE id = ANY(?::int[])').run(Object.values(ids)));
  let calls = 0;
  t.mock.method(pretend, 'send', async () => { calls += 1; throw Object.assign(new Error('no answer'), { code: 'ETIMEDOUT' }); });
  await rounds(shop);
  assert.equal(calls, 1, 'one round, one question');
  assert.equal((await queued(shop)).length, 2, 'the rest wait for the next round');
});

test('once a day Wheelhouse catches Shopify up with anything a change missed', async (t) => {
  const { shop } = await connectedAndSent(t, 'Live catch-up', [{ sku: 'C1', stock: 5 }]);
  const drift = () => shop.inShop(() => prepare(
    `UPDATE pretend_shopify SET products = (SELECT jsonb_agg(jsonb_set(p, '{stock}', '99')) FROM jsonb_array_elements(products) p) WHERE address = ?`
  ).run(ADDRESS));
  await drift();
  await rounds(shop);
  assert.equal((await inShopify(shop)).get('C1').stock, 99, 'not checked again within the day');
  process.env.WH_SHOPIFY_CATCH_UP_MS = '0';
  t.after(() => { delete process.env.WH_SHOPIFY_CATCH_UP_MS; });
  await rounds(shop);
  assert.equal((await inShopify(shop)).get('C1').stock, 5, 'put right by the daily check');
});

test('a shop with no Shopify queues nothing, and its stock changes as usual', async (t) => {
  const shop = await freshShop(t, 'Live none');
  const id = await addProduct(shop, { sku: 'N1' });
  await shop.inShop(() => prepare('UPDATE products SET stock_qty = 2 WHERE id = ?').run(id));
  assert.deepEqual(await queued(shop), []);
  assert.equal((await shop.inShop(() => prepare('SELECT stock_qty FROM products WHERE id = ?').get(id))).stock_qty, 2);
});

test('a change Shopify won’t take is a problem until it goes; no price yet isn’t sent', async (t) => {
  const { shop, ids } = await connectedAndSent(t, 'Live problems', [{ sku: 'Q1' }]);
  await shop.inShop(() => prepare('UPDATE products SET price = 0 WHERE id = ?').run(ids.Q1));
  await rounds(shop);
  assert.equal((await inShopify(shop)).get('Q1').pricePence, 1000, 'a price of 0 isn’t sent');
  assert.deepEqual((await link(shop)).problems.map((p) => [p.sku, p.kind]), [['Q1', 'no_price']]);
  await shop.inShop(() => prepare('UPDATE products SET price = 15 WHERE id = ?').run(ids.Q1));
  await rounds(shop);
  assert.equal((await inShopify(shop)).get('Q1').pricePence, 1500);
  assert.deepEqual((await link(shop)).problems, [], 'the problem goes once the product is sent');
});

test('Shopify not answering keeps the change as a problem, and Wheelhouse doesn’t keep asking by itself', async (t) => {
  const { shop, ids } = await connectedAndSent(t, 'Live silent', [{ sku: 'S1', stock: 5 }, { sku: 'S2', stock: 5 }]);
  await shop.inShop(() => prepare('UPDATE products SET stock_qty = 4 WHERE id = ANY(?::int[])').run([ids.S1, ids.S2]));
  let calls = 0;
  t.mock.method(pretend, 'send', async () => {
    calls += 1;
    throw Object.assign(new Error('no answer'), { code: 'ETIMEDOUT' });
  });
  await rounds(shop);
  await rounds(shop);
  assert.equal(calls, 1, 'stops at the first product Shopify doesn’t answer for');
  assert.deepEqual((await link(shop)).problems.map((p) => [p.sku, p.kind]), [['S1', 'no_answer'], ['S2', 'no_answer']]);
  assert.deepEqual(await queued(shop), [], 'Try sending again sends them');
});
