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
import { startLiveServer, TEST_CLOCK_PIN } from './helpers/liveServer.js';
import { shopToday } from '../server/clock.js';
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
// Days from the pinned day (1 Sep 2026), never a fixed date before it.
const PINNED_TODAY = shopToday('Europe/London', new Date(TEST_CLOCK_PIN));
const day = (n) => { const d = new Date(`${PINNED_TODAY}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

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
  await set(later.id, { hold_until: day(-1) });
  await set(first.id, { hold_until: day(-7) });
  await set(released.id, { hold_until: day(-1) });
  assert.equal((await own(`/api/c2w/orders/${released.id}/release`, { method: 'POST', body: {} })).status, 200);
  await set(certified.id, { hold_until: day(-1), stage: 'certificate' });
  const lines = await c2wLines();
  const ours = lines.filter((l) => [later.id, first.id, running.id, released.id, certified.id].includes(l.orderId));
  assert.deepEqual(ours, [
    { kind: 'c2w_hold_ended', orderId: first.id, customerName: '[Customer]', bike: '[Bike] · [Size]', holdUntil: day(-7) },
    { kind: 'c2w_hold_ended', orderId: later.id, customerName: 'Maya Patel', bike: '[Bike] · [Size]', holdUntil: day(-1) },
  ]);
  assert.equal(running.holdUntil, day(7), 'the running hold is still in date');
});

test('10.1 Today: a hold ending today is not yet a line; the day after, it is', async () => {
  const ends = await quote();
  await set(ends.id, { hold_until: PINNED_TODAY });
  assert.ok(!(await c2wLines()).some((l) => l.orderId === ends.id), 'it ends today: nothing to choose yet');
  await set(ends.id, { hold_until: day(-1) });
  assert.ok((await c2wLines()).some((l) => l.orderId === ends.id));
});

test('10.1 Today: the lines go when “On Today” is off in Settings, and come back when it is on', async () => {
  const ended = await quote();
  await set(ended.id, { hold_until: day(-2) });
  assert.ok((await c2wLines()).some((l) => l.orderId === ended.id));
  assert.equal((await own('/api/c2w/settings', { method: 'PUT', body: { todayLines: false } })).status, 200);
  assert.deepEqual(await c2wLines(), [], 'none while it is off');
  assert.equal((await own('/api/c2w/settings', { method: 'PUT', body: { todayLines: true } })).status, 200);
  assert.ok((await c2wLines()).some((l) => l.orderId === ended.id));
});

test('10.1 Today: the lines are the Owner’s; another shop sees none of them', async () => {
  const ended = await quote();
  await set(ended.id, { hold_until: day(-2) });
  const staff = await as(jo)('/api/needs-attention');
  assert.equal(staff.status, 403);
  assert.deepEqual(await c2wLines(other), []);
});

test('10.1 Today: a quote given the “No certificate after” days ago or more is a “no certificate yet” line, oldest first; a newer one, one whose hold ended and one past the certificate are not', async () => {
  assert.equal((await own('/api/c2w/settings', { method: 'PUT', body: { noCertificateDays: 5 } })).status, 200);
  const given = (n) => `${day(-n)}T12:00:00.000Z`;
  const oldest = await quote();
  const waiting = await quote(sam);
  const onTheDay = await quote();
  const newer = await quote();
  const ended = await quote();
  const certified = await quote();
  await set(oldest.id, { quote_given_at: given(9) });
  await set(waiting.id, { quote_given_at: given(6), stage: 'waiting' });
  await set(onTheDay.id, { quote_given_at: given(5) });
  assert.equal((await own(`/api/c2w/orders/${onTheDay.id}/release`, { method: 'POST', body: {} })).status, 200);
  await set(newer.id, { quote_given_at: given(4) });
  await set(ended.id, { quote_given_at: given(9), hold_until: day(-1) });
  await set(certified.id, { quote_given_at: given(9), stage: 'certificate' });
  const ids = [oldest.id, waiting.id, onTheDay.id, newer.id, ended.id, certified.id];
  const ours = (await c2wLines()).filter((l) => ids.includes(l.orderId));
  assert.deepEqual(ours, [
    { kind: 'c2w_no_certificate', orderId: oldest.id, customerName: 'Maya Patel', bike: '[Bike] · [Size]', quotedDays: 9, holdUntil: day(7) },
    { kind: 'c2w_no_certificate', orderId: waiting.id, customerName: '[Customer]', bike: '[Bike] · [Size]', quotedDays: 6, holdUntil: day(7) },
    { kind: 'c2w_no_certificate', orderId: onTheDay.id, customerName: 'Maya Patel', bike: '[Bike] · [Size]', quotedDays: 5, holdUntil: null },
    { kind: 'c2w_hold_ended', orderId: ended.id, customerName: 'Maya Patel', bike: '[Bike] · [Size]', holdUntil: day(-1) },
  ], 'as drawn, no certificate first; one line an order: a hold that ended asks to choose instead; a released bike has no hold date');
  assert.equal((await own('/api/c2w/settings', { method: 'PUT', body: { noCertificateDays: null } })).status, 200);
  assert.ok(!(await c2wLines()).some((l) => l.kind === 'c2w_no_certificate'), 'no days set in Settings, no line');
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
      id: made.id, customerName: 'Maya Patel', customerId: maya.id, bike: '[Bike] · [Size]', stage: 'quote', quoteRef: made.quoteRef,
      holdUntil: day(7), holdEnded: false, certificateNumber: `[CERT-${made.quoteNumber}]`,
    }, q);
  }
  const none = await as(jo)('/api/search?q=nobody-here');
  assert.deepEqual(none.body.c2wOrders, []);
  assert.deepEqual((await as(other)(`/api/search?q=${made.quoteRef}`)).body.c2wOrders, [], 'not another shop’s');
});

test('10.2 search: a customer found says how many Cycle to Work orders they have, leaving out cancelled and closed ones', async () => {
  const gone = await quote();
  await set(gone.id, { stage: 'cancelled', hold_until: null });
  const shut = await quote();
  await set(shut.id, { stage: 'closed', hold_until: null });
  const res = await own('/api/search?q=Maya%20Patel');
  const found = res.body.customers.filter((c) => c.id === maya.id);
  assert.equal(found.length, 1, 'once, found by name and by her orders');
  const { n } = await inShop(async () => prepare("SELECT count(*)::int AS n FROM c2w_orders WHERE customer_id = ? AND stage NOT IN ('cancelled', 'closed')").get(maya.id));
  assert.ok(n > 0);
  assert.equal(found[0].c2wOrders, n);
});

test('10.2 search: a quote or certificate number also finds its customer (cs-search-c2w)', async () => {
  const made = await quote(sam);
  await set(made.id, { certificate_number: `[SAM-${made.quoteNumber}]` });
  for (const q of [made.quoteRef, `[SAM-${made.quoteNumber}]`]) {
    const customers = (await own(`/api/search?q=${encodeURIComponent(q)}`)).body.customers;
    assert.deepEqual(customers.filter((c) => c.id === sam.id).map((c) => c.name), ['[Customer]'], q);
  }
});

test('10.2 search: an exact quote or certificate number comes first, however many newer ones contain it', async () => {
  const exact = await quote();
  const newer = [];
  for (let i = 0; i < 10; i += 1) newer.push(await quote());
  await set(exact.id, { quote_number: 9012, certificate_number: '[CERT]-77' });
  for (const [i, o] of newer.entries()) await set(o.id, { quote_number: 90120 + i, certificate_number: `[CERT]-77${i}` });
  for (const q of ['9012', 'CW-9012', 'cw-9012', '[CERT]-77']) {
    const found = (await own(`/api/search?q=${encodeURIComponent(q)}`)).body.c2wOrders;
    assert.equal(found[0]?.id, exact.id, q);
    assert.equal(found.length, 5, 'five at most');
  }
});

test('10.2 search: a removed customer’s order isn’t found, by name or by quote number', async () => {
  const gone = (await own('/api/customers', { method: 'POST', body: { name: `[Removed ${tag()}]`, email: `r-${tag()}@example.test` } })).body;
  const made = await quote(gone);
  assert.ok((await own(`/api/search?q=${encodeURIComponent(made.quoteRef)}`)).body.c2wOrders.some((o) => o.id === made.id), 'found before');
  await inShop(async () => prepare('UPDATE customers SET active = 0 WHERE id = ? RETURNING id').get(gone.id));
  for (const q of [gone.name, made.quoteRef]) {
    const body = (await own(`/api/search?q=${encodeURIComponent(q)}`)).body;
    assert.ok(!body.c2wOrders.some((o) => o.id === made.id), q);
    assert.ok(!body.customers.some((c) => c.id === gone.id), q);
  }
});

test('10.2 search: a hold that has ended says so, by the list’s rule and the shop’s day; one ending today is still held', async () => {
  const made = await quote();
  const holdOf = async () => (await own(`/api/search?q=${encodeURIComponent(made.quoteRef)}`)).body.c2wOrders.find((o) => o.id === made.id);
  await set(made.id, { hold_until: PINNED_TODAY });
  assert.deepEqual([(await holdOf()).holdUntil, (await holdOf()).holdEnded], [PINNED_TODAY, false]);
  await set(made.id, { hold_until: day(-1) });
  assert.deepEqual([(await holdOf()).holdUntil, (await holdOf()).holdEnded], [day(-1), true]);
  const mine = (await own(`/api/customers/${maya.id}/history`)).body.items.find((i) => i.id === made.id && i.kind === 'c2w_order');
  assert.equal(mine.holdEnded, true, 'and on her page');
});

test('10.2 search: what’s typed is a plain search, never a pattern, in a shop with Cycle to Work orders', async () => {
  await quote();
  for (const q of ['%_%', '%%', '__']) {
    const res = await own(`/api/search?q=${encodeURIComponent(q)}`);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.c2wOrders, [], `${q}: a % or _ matched everything`);
    assert.deepEqual(res.body.customers, [], q);
  }
});

// ---------- 10.2 The customer's page ----------

test('10.2 the customer’s page lists their orders, open and collected, each with its own words; nobody else’s', async () => {
  const open = await quote(sam);
  const collected = await quote(sam);
  const collectedAt = `${day(-12)}T10:00:00.000Z`;
  await set(collected.id, { stage: 'collected', certificate_number: '[CERT-1]', collected_at: collectedAt, hold_until: null });
  await quote(maya);
  const items = (await own(`/api/customers/${sam.id}/history`)).body.items.filter((i) => i.kind === 'c2w_order');
  const mine = (id) => items.find((i) => i.id === id);
  assert.deepEqual(mine(open.id), {
    kind: 'c2w_order', id: open.id, stage: 'quote', open: true, quoteRef: open.quoteRef, bike: '[Bike] · [Size]', providerName: '[Provider]',
    holdUntil: day(7), holdEnded: false, certificateNumber: null, collectedAt: null, at: open.quoteGivenAt,
  });
  assert.deepEqual(mine(collected.id), {
    kind: 'c2w_order', id: collected.id, stage: 'collected', open: false, quoteRef: collected.quoteRef, bike: '[Bike] · [Size]', providerName: '[Provider]',
    holdUntil: null, holdEnded: false, certificateNumber: '[CERT-1]', collectedAt, at: collectedAt,
  });
  const { n } = await inShop(async () => prepare('SELECT count(*)::int AS n FROM c2w_orders WHERE customer_id = ?').get(sam.id));
  assert.equal(items.length, n, 'only theirs');
});
