// Cycle to Work on Today, in the header search and on a customer's page
// (openspec/changes/cycle-to-work, tasks 10.1 and 10.2, pull request 10a;
// drawings cw-today-held, op-today-c2w in c2w.mjs and opening.mjs, and
// cs-search-c2w, cs-page-c2w, cs-page-c2w-collected in customer.mjs). The
// drawings leave names of bikes and numbers bracketed, so those here are
// made-up test values.
//
// The server clock is pinned to 1 Sep 2026 (WHEELHOUSE_TEST_CLOCK).
// Needs the compose Postgres up (npm run docker:up) or it hangs with no output.
import '../server/load-env.js';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';
import { seedProduct } from './helpers/till.js';

let server;
let owner;
let other;
let jo;
let provider;
let bike;
let maya;
let sam;
const as = (who) => (p, options) => staffRequest(server.baseUrl, who.cookie, p, options);
const own = (p, options) => as(owner)(p, options);
const inShop = (fn, shop = owner.shop.id) => runWithShop(shop, fn);
const tag = () => randomUUID().slice(0, 8);

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  other = await staffSignup(server.baseUrl);
  const made = await own('/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `jo-${tag()}@example.test`, password: 'password123' } });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  jo = { cookie: await staffFreshCookie(made.body.loginId) };
  const set = await own('/api/c2w/settings', { method: 'PUT', body: { holdDays: 7, remindDays: 2, quoteValidDays: 30 } });
  assert.equal(set.status, 200, JSON.stringify(set.body));
  provider = (await own('/api/c2w/providers', { method: 'POST', body: { name: '[Provider]' } })).body.provider;
  bike = await seedProduct(owner.shop.id, { name: '[Bike] · [Size]', price: '1000.00', stock: 100 });
  const site = await inShop(async () => (await prepare('SELECT id FROM sites ORDER BY id LIMIT 1').get()).id);
  await inShop(async () => prepare('INSERT INTO product_stock (site_id, product_id, qty) VALUES (?, ?, 100) RETURNING product_id').get(site, bike));
  maya = (await own('/api/customers', { method: 'POST', body: { name: 'Maya Patel', phone: '07700 900 142', email: `maya-${tag()}@example.test` } })).body;
  sam = (await own('/api/customers', { method: 'POST', body: { name: '[Customer]', email: `c-${tag()}@example.test` } })).body;
});
after(async () => {
  for (const shop of [owner, other]) if (shop) await deleteTestShop(shop.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const quote = async (customer = maya, body = {}) => {
  const res = await own('/api/c2w/orders', { method: 'POST', body: { customerId: customer.id, providerId: provider.id, productId: bike, accessoryIds: [], ...body } });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body.order;
};
const set = (id, columns) => inShop(async () => {
  const keys = Object.keys(columns);
  return prepare(`UPDATE c2w_orders SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ? RETURNING id`).get(...keys.map((k) => columns[k]), id);
});
const c2wLines = async (who = owner) => {
  const res = await as(who)('/api/needs-attention');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res.body.items.filter((i) => i.kind.startsWith('c2w_'));
};

// ---------- 10.1 Today ----------

test('10.1 Today: a hold that ended with nobody choosing is a line, oldest first; a hold still running, released or past the certificate is not', async () => {
  const later = await quote();
  const first = await quote(sam);
  const running = await quote();
  const released = await quote();
  const certified = await quote();
  await set(later.id, { hold_until: '2026-08-31' });
  await set(first.id, { hold_until: '2026-08-25' });
  await set(released.id, { hold_until: '2026-08-31' });
  assert.equal((await own(`/api/c2w/orders/${released.id}/release`, { method: 'POST', body: {} })).status, 200);
  await set(certified.id, { hold_until: '2026-08-31', stage: 'certificate' });
  const lines = await c2wLines();
  const ours = lines.filter((l) => [later.id, first.id, running.id, released.id, certified.id].includes(l.orderId));
  assert.deepEqual(ours, [
    { kind: 'c2w_hold_ended', orderId: first.id, customerName: '[Customer]', bike: '[Bike] · [Size]', holdUntil: '2026-08-25' },
    { kind: 'c2w_hold_ended', orderId: later.id, customerName: 'Maya Patel', bike: '[Bike] · [Size]', holdUntil: '2026-08-31' },
  ]);
  assert.equal(running.holdUntil, '2026-09-08', 'the running hold is still in date');
});

test('10.1 Today: the lines go when “On Today” is off in Settings, and come back when it is on', async () => {
  const ended = await quote();
  await set(ended.id, { hold_until: '2026-08-30' });
  assert.ok((await c2wLines()).some((l) => l.orderId === ended.id));
  assert.equal((await own('/api/c2w/settings', { method: 'PUT', body: { todayLines: false } })).status, 200);
  assert.deepEqual(await c2wLines(), [], 'none while it is off');
  assert.equal((await own('/api/c2w/settings', { method: 'PUT', body: { todayLines: true } })).status, 200);
  assert.ok((await c2wLines()).some((l) => l.orderId === ended.id));
});

test('10.1 Today: the lines are the Owner’s; another shop sees none of them', async () => {
  const ended = await quote();
  await set(ended.id, { hold_until: '2026-08-30' });
  const staff = await as(jo)('/api/needs-attention');
  assert.equal(staff.status, 403);
  assert.deepEqual(await c2wLines(other), []);
});

// ---------- 10.2 Search ----------

test('10.2 search finds an order by the customer’s name, its quote number and its certificate number, for anyone signed in', async () => {
  const made = await quote();
  await set(made.id, { certificate_number: `[CERT-${made.quoteNumber}]` });
  for (const q of ['Maya Pat', made.quoteRef, made.quoteRef.toLowerCase(), `[CERT-${made.quoteNumber}]`]) {
    const res = await as(jo)(`/api/search?q=${encodeURIComponent(q)}`);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const found = res.body.c2wOrders.find((o) => o.id === made.id);
    assert.deepEqual(found, {
      id: made.id, customerName: 'Maya Patel', bike: '[Bike] · [Size]', stage: 'quote', quoteRef: made.quoteRef,
      holdUntil: '2026-09-08', certificateNumber: `[CERT-${made.quoteNumber}]`,
    }, q);
  }
  const none = await as(jo)('/api/search?q=nobody-here');
  assert.deepEqual(none.body.c2wOrders, []);
  assert.deepEqual((await as(other)(`/api/search?q=${made.quoteRef}`)).body.c2wOrders, [], 'not another shop’s');
});

test('10.2 search: a customer found says how many Cycle to Work orders they have', async () => {
  const res = await own('/api/search?q=Maya%20Patel');
  const found = res.body.customers.find((c) => c.id === maya.id);
  const { n } = await inShop(async () => prepare('SELECT count(*)::int AS n FROM c2w_orders WHERE customer_id = ?').get(maya.id));
  assert.ok(n > 0);
  assert.equal(found.c2wOrders, n);
});

// ---------- 10.2 The customer's page ----------

test('10.2 the customer’s page lists their orders, open and collected, each with its own words; nobody else’s', async () => {
  const open = await quote(sam);
  const collected = await quote(sam);
  await set(collected.id, { stage: 'collected', certificate_number: '[CERT-1]', collected_at: '2026-08-20T10:00:00Z', hold_until: null });
  await quote(maya);
  const items = (await own(`/api/customers/${sam.id}/history`)).body.items.filter((i) => i.kind === 'c2w_order');
  const mine = (id) => items.find((i) => i.id === id);
  assert.deepEqual(mine(open.id), {
    kind: 'c2w_order', id: open.id, stage: 'quote', open: true, quoteRef: open.quoteRef, bike: '[Bike] · [Size]', providerName: '[Provider]',
    holdUntil: '2026-09-08', certificateNumber: null, collectedAt: null, at: open.quoteGivenAt,
  });
  assert.deepEqual(mine(collected.id), {
    kind: 'c2w_order', id: collected.id, stage: 'collected', open: false, quoteRef: collected.quoteRef, bike: '[Bike] · [Size]', providerName: '[Provider]',
    holdUntil: null, certificateNumber: '[CERT-1]', collectedAt: '2026-08-20T10:00:00.000Z', at: '2026-08-20T10:00:00.000Z',
  });
  const { n } = await inShop(async () => prepare('SELECT count(*)::int AS n FROM c2w_orders WHERE customer_id = ?').get(sam.id));
  assert.equal(items.length, n, 'only theirs');
});
