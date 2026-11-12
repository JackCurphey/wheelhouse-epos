// The customer's view of their Cycle to Work order (openspec/changes/cycle-to-work,
// design 8, tasks 9.2–9.3; drawings cw-customer-view, cw-customer-released,
// cw-customer-cancelled in c2w.mjs and ac-account-c2w in account.mjs): the
// order's private link, with no sign-in, and the signed-in customer's own orders.
// Only the allowed fields reach the customer: no commission, cost, frame, supplier
// or staff name. The drawings leave days and prices bracketed, so the numbers
// here are made-up test values.
//
// The server clock is pinned to 1 Sep 2026 (WHEELHOUSE_TEST_CLOCK).
// Needs the compose Postgres up (npm run docker:up) or it hangs with no output.
import '../server/load-env.js';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';
import { seedProduct } from './helpers/till.js';

let server;
let owner;
let other;
let provider;
let maya;
let mayaEmail;
let mayaCookie;
let ravi;
let site;
const own = (p, options, who = owner) => staffRequest(server.baseUrl, who.cookie, p, options);
const inShop = (fn, who = owner) => runWithShop(who.shop.id, fn);
const tag = () => randomUUID().slice(0, 8);

let ip = 0;
async function portal(path, { cookie, shop = owner, from } = {}) {
  const res = await fetch(`${server.baseUrl}/api/portal/${shop.shop.slug}${path}`, {
    headers: { 'x-forwarded-for': from ?? `198.51.100.${(++ip % 250) + 1}`, ...(cookie ? { cookie } : {}) },
  });
  return { status: res.status, body: await res.json().catch(() => null), cache: res.headers.get('cache-control') };
}

// Sign in by code (the pretend provider keeps its codes where a test can read them).
async function signIn(email) {
  const from = `203.0.113.${(++ip % 250) + 1}`;
  const post = (path, body) => fetch(`${server.baseUrl}/api/portal/${owner.shop.slug}${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': from }, body: JSON.stringify(body),
  });
  await post('/sign-in/code', { email });
  const { code } = await inShop(() => prepare('SELECT code FROM pretend_signin_codes WHERE email = ? AND used_at IS NULL ORDER BY id DESC LIMIT 1').get(email));
  const res = await post('/sign-in/check', { email, code });
  assert.equal(res.status, 200, await res.text());
  return res.headers.get('set-cookie').split(';')[0];
}

before(async () => {
  server = await startLiveServer({ env: { TRUST_PROXY: '1', CUSTOMER_SIGNIN_PROVIDER: 'pretend', APP_PUBLIC_URL: 'https://wh.test' } });
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  other = await staffSignup(server.baseUrl, { shopName: 'Elsewhere Cycles' });
  const set = await own('/api/c2w/settings', { method: 'PUT', body: { holdDays: 7, remindDays: 2, quoteValidDays: 30, howToApply: '[The shop’s own words, from Settings]' } });
  assert.equal(set.status, 200, JSON.stringify(set.body));
  provider = (await own('/api/c2w/providers', { method: 'POST', body: { name: '[Provider]', commissionKind: 'percent', commissionValue: 800 } })).body.provider;
  mayaEmail = `maya-${tag()}@example.test`;
  maya = (await own('/api/customers', { method: 'POST', body: { name: 'Maya Patel', email: mayaEmail } })).body;
  ravi = (await own('/api/customers', { method: 'POST', body: { name: 'Ravi Shah', email: `ravi-${tag()}@example.test` } })).body;
  site = await inShop(async () => (await prepare('SELECT id FROM sites ORDER BY id LIMIT 1').get()).id);
  // Maya's email is her own, so her code sign-in joins her record (as portal-account.test.js).
  await inShop(() => prepare('UPDATE customers SET email_from_customer = true WHERE id = ? RETURNING id').get(maya.id));
  mayaCookie = await signIn(mayaEmail);
});
after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (other) await deleteTestShop(other.shop.id);
  if (server) await server.stop();
  await pool.end();
});

// A bike with one frame in stock at the shop's site, and an accessory.
async function framedBike() {
  const id = await seedProduct(owner.shop.id, { name: '[Bike] · [Size]', price: '1000.00', stock: 1 });
  await inShop(async () => {
    await prepare('INSERT INTO product_stock (site_id, product_id, qty) VALUES (?, ?, 1) RETURNING product_id').get(site, id);
    const key = `[FRAME-${tag()}]`;
    await prepare('INSERT INTO stock_frames (product_id, site_id, frame_number, frame_key) VALUES (?, ?, ?, ?) RETURNING id').get(id, site, key, key);
  });
  return id;
}
async function quoteFor(customer, body = {}) {
  const accessory = await seedProduct(owner.shop.id, { name: '[Accessory]', price: '50.00', stock: 5 });
  const res = await own('/api/c2w/orders', {
    method: 'POST', body: { customerId: customer.id, providerId: provider.id, productId: await framedBike(), accessoryIds: [accessory], hold: true, ...body },
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const order = res.body.order;
  const { customer_code: code } = await inShop(() => prepare('SELECT customer_code FROM c2w_orders WHERE id = ?').get(order.id));
  return { order, code };
}
const setOrder = (id, sql, ...args) => inShop(() => prepare(`UPDATE c2w_orders SET ${sql} WHERE id = ? RETURNING id`).get(...args, id));

const ALLOWED = ['accessories', 'bike', 'collectedAt', 'customerPaysPence', 'holdUntil', 'howToApply', 'place', 'providerName', 'quoteRef',
  'shopName', 'stage', 'stageIndex', 'stages', 'state', 'totalPence'].sort();
// The signed-in account's rows also carry their id and the receipt's sale; the link doesn't.
const ACCOUNT = ['id', 'saleId', ...ALLOWED].sort();

test('9.2 the private link gives the allowed fields only, with no sign-in', async () => {
  const { order, code } = await quoteFor(maya);
  const res = await portal(`/c2w-links/${code}`);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.cache, 'no-store');
  const v = res.body;
  assert.deepEqual(Object.keys(v).sort(), ALLOWED);
  assert.deepEqual(
    [v.quoteRef, v.shopName, v.place, v.providerName, v.bike, v.accessories, v.totalPence, v.state, v.holdUntil, v.stageIndex, v.howToApply],
    [order.quoteRef, owner.shop.name, null, '[Provider]', '[Bike] · [Size]', ['[Accessory]'], 105000, 'held', order.holdUntil, 0, '[The shop’s own words, from Settings]'],
  );
  assert.deepEqual(v.stages, ['Quote given', 'Waiting for the certificate', 'Certificate received', 'Ready to collect', 'Collected']);
  assert.ok(order.holdUntil, 'the order is held until a day');
  const text = JSON.stringify(v);
  for (const hidden of ['commission', 'frame', 'supplier', 'Jack Lewis', 'cost', 'customerId', 'Maya']) assert.ok(!text.includes(hidden), `no ${hidden}`);
});

test('9.2 a wrong code, a code of the wrong shape and another shop’s link all get the same answer', async () => {
  const { code } = await quoteFor(maya);
  const answers = [
    await portal(`/c2w-links/${'0'.repeat(64)}`),
    await portal('/c2w-links/not-a-code'),
    await portal(`/c2w-links/${code}`, { shop: other }),
  ];
  for (const a of answers) {
    assert.equal(a.status, 404);
    assert.deepEqual(a.body, { error: 'This link doesn’t work' });
  }
});

test('9.2 the link stops working once the customer’s record is deleted', async () => {
  const gone = (await own('/api/customers', { method: 'POST', body: { name: 'Sam Ellis', email: `sam-${tag()}@example.test` } })).body;
  const { code } = await quoteFor(gone);
  assert.equal((await portal(`/c2w-links/${code}`)).status, 200);
  await inShop(() => prepare('UPDATE customers SET deleted_at = now() WHERE id = ? RETURNING id').get(gone.id));
  assert.equal((await portal(`/c2w-links/${code}`)).status, 404);
});

test('9.2 released: no longer put aside, with no hold day; waiting moves the stage on', async () => {
  const { order, code } = await quoteFor(maya);
  assert.equal((await own(`/api/c2w/orders/${order.id}/release`, { method: 'POST', body: {} })).status, 200);
  await setOrder(order.id, "stage = 'waiting'");
  const v = (await portal(`/c2w-links/${code}`)).body;
  assert.deepEqual([v.state, v.holdUntil, v.stage, v.stageIndex], ['released', null, 'waiting', 1]);
});

test('9.2 cancelled: no stage, no hold day and no "How to apply"', async () => {
  const { order, code } = await quoteFor(maya);
  await setOrder(order.id, "stage = 'cancelled', certificate_pence = 100000, certificate_number = '[n]', certificate_received_on = '2026-09-01'");
  const v = (await portal(`/c2w-links/${code}`)).body;
  assert.deepEqual([v.state, v.stageIndex, v.holdUntil, v.howToApply, v.customerPaysPence], ['cancelled', null, null, null, null]);
});

test('9.2 after the certificate: what the customer pays at collection is the total less what the provider pays', async () => {
  const { order, code } = await quoteFor(maya);
  await setOrder(order.id, "stage = 'certificate', certificate_pence = ?, certificate_number = '[n]', certificate_received_on = '2026-09-01'", 100000);
  const v = (await portal(`/c2w-links/${code}`)).body;
  assert.deepEqual([v.stageIndex, v.customerPaysPence], [2, 5000]);
  await setOrder(order.id, "stage = 'paid'");
  const paid = (await portal(`/c2w-links/${code}`)).body;
  assert.deepEqual([paid.stageIndex, paid.stage], [4, 'collected'], 'paid by the provider shows the customer Collected');
  assert.deepEqual([paid.state, paid.holdUntil], [null, null], 'a collected bike isn’t “put aside”');
});

test('9.2 from the certificate on, a held or released bike says nothing of being put aside', async () => {
  const { order, code } = await quoteFor(maya);
  // The certificate clears the hold's day while the bike stays held for collection.
  await setOrder(order.id, "stage = 'certificate', hold_until = NULL, certificate_pence = ?, certificate_number = '[n]', certificate_received_on = '2026-09-01'", 100000);
  const held = (await portal(`/c2w-links/${code}`)).body;
  assert.deepEqual([held.state, held.holdUntil, held.stageIndex], [null, null, 2]);
  await setOrder(order.id, 'held_at = NULL, released_at = now()');
  assert.equal((await portal(`/c2w-links/${code}`)).body.state, null);
});

test('9.2 a certificate for more than the total leaves nothing to pay at collection', async () => {
  const { order, code } = await quoteFor(maya);
  await setOrder(order.id, "stage = 'certificate', certificate_pence = ?, certificate_number = '[n]', certificate_received_on = '2026-09-01'", 200000);
  assert.equal((await portal(`/c2w-links/${code}`)).body.customerPaysPence, 0);
});

test('9.2 the link is rate limited, like the stop page', async () => {
  const from = '192.0.2.77';
  let last;
  for (let i = 0; i < 31; i += 1) last = await portal(`/c2w-links/${'1'.repeat(64)}`, { from });
  assert.equal(last.status, 429);
});

test('9.3 the account lists only the signed-in customer’s own orders, newest first', async () => {
  const first = await quoteFor(maya);
  const second = await quoteFor(maya);
  const notHers = await quoteFor(ravi);
  assert.equal((await portal('/c2w-orders')).status, 401, 'not signed in');
  const res = await portal('/c2w-orders', { cookie: mayaCookie });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const ids = res.body.map((o) => o.id);
  assert.ok(ids.indexOf(second.order.id) < ids.indexOf(first.order.id), 'newest first');
  assert.ok(!ids.includes(notHers.order.id), 'not another customer’s');
  const row = res.body.find((o) => o.id === first.order.id);
  assert.deepEqual(Object.keys(row).sort(), ACCOUNT);
  assert.equal(row.quoteRef, first.order.quoteRef);
  assert.equal(res.cache, 'no-store');
  await setOrder(first.order.id, "stage = 'certificate', certificate_pence = ?, certificate_number = '[n]', certificate_received_on = '2026-09-01'", 100000);
  const after = (await portal('/c2w-orders', { cookie: mayaCookie })).body.find((o) => o.id === first.order.id);
  assert.equal(after.customerPaysPence, 5000, 'what she pays at collection, on the account too');
  assert.equal((await portal('/c2w-orders', { cookie: mayaCookie, shop: other })).status, 401, 'another shop’s address with her cookie');
});

test('9.3 one of the account’s orders opens by its id, only the customer’s own', async () => {
  const hers = await quoteFor(maya);
  const notHers = await quoteFor(ravi);
  const res = await portal(`/c2w-orders/${hers.order.id}`, { cookie: mayaCookie });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.quoteRef, hers.order.quoteRef);
  assert.deepEqual(Object.keys(res.body).sort(), ACCOUNT);
  assert.equal(res.cache, 'no-store');
  assert.equal((await portal(`/c2w-orders/${hers.order.id}`, { cookie: mayaCookie, shop: other })).status, 401, 'another shop’s address with her cookie');
  assert.equal((await portal(`/c2w-orders/${notHers.order.id}`, { cookie: mayaCookie })).status, 404);
  assert.equal((await portal(`/c2w-orders/${hers.order.id}`)).status, 401);
  assert.equal((await portal('/c2w-orders/abc', { cookie: mayaCookie })).status, 404);
});
