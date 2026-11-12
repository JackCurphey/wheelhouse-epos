// Holding bikes for Cycle to Work orders (openspec/changes/cycle-to-work,
// design 4, tasks 5.1–5.3; drawings cw-new, cw-order-held, cw-hold-ending,
// cw-list-hold-ended in docs/design/user-journeys/generator/c2w.mjs). The
// drawings leave days and prices bracketed, so the numbers here are made-up
// test values.
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
let provider;
let maya;
let site;
const own = (p, options) => staffRequest(server.baseUrl, owner.cookie, p, options);
const inShop = (fn) => runWithShop(owner.shop.id, fn);
const tag = () => randomUUID().slice(0, 8);

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  const set = await own('/api/c2w/settings', { method: 'PUT', body: { holdDays: 7, remindDays: 2, quoteValidDays: 30 } });
  assert.equal(set.status, 200, JSON.stringify(set.body));
  provider = (await own('/api/c2w/providers', { method: 'POST', body: { name: '[Provider]' } })).body.provider;
  maya = (await own('/api/customers', { method: 'POST', body: { name: 'Maya Patel', email: `maya-${tag()}@example.test` } })).body;
  site = await inShop(async () => (await prepare('SELECT id FROM sites ORDER BY id LIMIT 1').get()).id);
});
after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
  await pool.end();
});

// A bike with frame numbers, `frames` of them in stock at the shop's site.
async function framedBike(frames) {
  const id = await seedProduct(owner.shop.id, { name: '[Bike] · [Size]', price: '1000.00', stock: frames });
  await inShop(async () => {
    await prepare('INSERT INTO product_stock (site_id, product_id, qty) VALUES (?, ?, ?) RETURNING product_id').get(site, id, frames);
    for (let i = 0; i < frames; i += 1) {
      const key = `[FRAME-${tag()}]`;
      await prepare('INSERT INTO stock_frames (product_id, site_id, frame_number, frame_key) VALUES (?, ?, ?, ?) RETURNING id').get(id, site, key, key);
    }
  });
  return id;
}
// A bike with no frame numbers: only the site's stock figure.
async function countedBike(qty) {
  const id = await seedProduct(owner.shop.id, { name: '[Bike] · [Size]', price: '1000.00', stock: qty });
  await inShop(async () => prepare('INSERT INTO product_stock (site_id, product_id, qty) VALUES (?, ?, ?) RETURNING product_id').get(site, id, qty));
  return id;
}
const quote = async (productId, body = {}) => own('/api/c2w/orders', {
  method: 'POST', body: { customerId: maya.id, providerId: provider.id, productId, accessoryIds: [], ...body },
});
const order = async (id) => (await own(`/api/c2w/orders/${id}`)).body.order;
const frames = (productId) => inShop(async () => prepare('SELECT id, state, c2w_order_id FROM stock_frames WHERE product_id = ? ORDER BY id').all(productId));
const stockOf = async (productId) => (await own(`/api/c2w/stock?productId=${productId}`)).body;
const counts = async () => (await own('/api/c2w/orders')).body.counts;
const setHoldUntil = (id, day) => inShop(async () => prepare('UPDATE c2w_orders SET hold_until = ? WHERE id = ? RETURNING id').get(day, id));

// A till of its own at the shop, signed in as the Owner, with nobody checked in.
async function tillNobodyIn() {
  const jar = new Map();
  const cookieOwn = await staffFreshCookie(owner.loginId);
  const send = async (path, body) => {
    const cookie = [cookieOwn, ...[...jar].map(([k, v]) => `${k}=${v}`)].join('; ');
    const res = await fetch(`${server.baseUrl}${path}`, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify(body) });
    for (const line of res.headers.getSetCookie()) {
      const [pair] = line.split(';');
      jar.set(pair.slice(0, pair.indexOf('=')), pair.slice(pair.indexOf('=') + 1));
    }
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  };
  assert.equal((await send('/api/till-setup', { siteId: site, number: 9 })).status, 201);
  return send;
}

// ---------- 5.1 ----------

test('5.1 a quote with the hold takes one free frame at the site, linked to the order; two quotes for the last frame — only one holds it', async () => {
  const bike = await framedBike(1);
  const [a, b] = await Promise.all([quote(bike), quote(bike)]);
  assert.equal(a.status, 201, JSON.stringify(a.body));
  assert.equal(b.status, 201, JSON.stringify(b.body));
  const [winner, loser] = a.body.order.frameId ? [a.body.order, b.body.order] : [b.body.order, a.body.order];
  const [frame] = await frames(bike);
  assert.equal(winner.frameId, frame.id);
  assert.deepEqual([winner.held, winner.holdUntil, winner.inStock], [true, '2026-09-08', true]);
  assert.deepEqual([frame.state, frame.c2w_order_id], ['held', winner.id], 'the frame is put aside for this order');
  // The other quote found nothing free: it is the one the shop orders in (cw-new-not-in-stock).
  assert.deepEqual([loser.frameId, loser.held, loser.holdUntil, loser.inStock], [null, false, null, false]);
  // "What's happened": the quote, then the hold (cw-order-held).
  const full = await order(winner.id);
  assert.deepEqual(full.events.map((e) => e.kind), ['quote_given', 'held']);
  assert.equal(full.events[1].detail.until, '2026-09-08');
  // Held when the quote was given, on the shop's clock (not the database's).
  const times = await inShop(async () => prepare('SELECT held_at = quote_given_at AS same FROM c2w_orders WHERE id = ?').get(winner.id));
  assert.equal(times.same, true, 'held at the moment of the quote');
  const stock = await stockOf(bike);
  assert.deepEqual(stock.sites.map((s) => [s.siteId, s.free, s.held]), [[site, 0, 1]]);
});

test('5.1 a bike with no frame numbers is held as a count: the free number leaves held orders out', async () => {
  const bike = await countedBike(1);
  const first = (await quote(bike)).body.order;
  assert.deepEqual([first.frameId, first.held, first.holdUntil], [null, true, '2026-09-08']);
  const second = (await quote(bike)).body.order;
  assert.deepEqual([second.held, second.inStock], [false, false], 'the one in the shop is already held');
  const stock = await stockOf(bike);
  assert.deepEqual([stock.sites[0].free, stock.sites[0].held], [0, 1]);
  // "Don't hold this one" leaves the bike free.
  const loose = await countedBike(1);
  const unheld = (await quote(loose, { hold: false })).body.order;
  assert.deepEqual([unheld.held, unheld.inStock], [false, true]);
  assert.equal((await stockOf(loose)).sites[0].free, 1);
});

// ---------- 5.2 ----------

test('5.2 a hold never ends by itself: the reminder day shows “hold ending soon”, after the date it stays held with “hold ended — choose”', async () => {
  const bike = await framedBike(1);
  const held = (await quote(bike)).body.order;
  const before = await counts();
  // Two days left: the reminder days in Settings.
  await setHoldUntil(held.id, '2026-09-03');
  const soon = await counts();
  assert.equal(soon.holdEndingSoon, before.holdEndingSoon + 1);
  // The date has passed: still held, and the row asks the shop to choose.
  await setHoldUntil(held.id, '2026-08-31');
  const ended = await counts();
  assert.equal(ended.holdEnded, before.holdEnded + 1);
  assert.equal(ended.holdEndingSoon, before.holdEndingSoon);
  const list = (await own('/api/c2w/orders')).body.groups.waiting;
  const row = list.find((r) => r.id === held.id);
  assert.deepEqual([row.next, row.held, row.holdUntil], ['choose', true, '2026-08-31']);
  const [frame] = await frames(bike);
  assert.deepEqual([frame.state, frame.c2w_order_id], ['held', held.id], 'nothing let the frame go');
  assert.equal((await stockOf(bike)).sites[0].free, 0);
});

// ---------- 5.3 ----------

test('5.3 Hold longer moves the date on by the Settings days, from today when it has already ended', async () => {
  const bike = await framedBike(1);
  const held = (await quote(bike)).body.order;
  const longer = await own(`/api/c2w/orders/${held.id}/hold-longer`, { method: 'POST', body: {} });
  assert.equal(longer.status, 200, JSON.stringify(longer.body));
  assert.equal(longer.body.order.holdUntil, '2026-09-15', 'another 7 days on from 8 September');
  await setHoldUntil(held.id, '2026-08-31');
  const again = (await own(`/api/c2w/orders/${held.id}/hold-longer`, { method: 'POST', body: {} })).body.order;
  assert.equal(again.holdUntil, '2026-09-08', 'an ended hold runs 7 days from today');
  const lines = (await order(held.id)).events.filter((e) => e.kind === 'hold_longer');
  assert.deepEqual(lines.map((e) => [e.detail.from, e.detail.until]), [['2026-09-08', '2026-09-15'], ['2026-08-31', '2026-09-08']]);
  // A bike that isn't held can't be held longer.
  const away = (await quote(await countedBike(0))).body.order;
  const refused = await own(`/api/c2w/orders/${away.id}/hold-longer`, { method: 'POST', body: {} });
  assert.equal(refused.status, 409);
  assert.equal(refused.body.code, 'not_held');
});

test('5.3 Release the bike frees the frame and keeps the order open at its stage, saying who released it', async () => {
  const bike = await framedBike(1);
  const held = (await quote(bike)).body.order;
  assert.equal((await own(`/api/c2w/orders/${held.id}/applied`, { method: 'POST', body: {} })).status, 200);
  const released = await own(`/api/c2w/orders/${held.id}/release`, { method: 'POST', body: {} });
  assert.equal(released.status, 200, JSON.stringify(released.body));
  const o = released.body.order;
  assert.deepEqual([o.stage, o.held, o.frameId, o.holdUntil], ['waiting', false, null, null]);
  assert.ok(o.releasedAt, 'when it was released');
  const [frame] = await frames(bike);
  assert.deepEqual([frame.state, frame.c2w_order_id], ['in_stock', null], 'back on sale');
  assert.equal((await stockOf(bike)).sites[0].free, 1);
  const line = (await order(held.id)).events.find((e) => e.kind === 'released');
  assert.equal(line.by, 'Jack Lewis');
  // Released once is released: a second press, or Hold longer, changes nothing.
  const twice = await own(`/api/c2w/orders/${held.id}/release`, { method: 'POST', body: {} });
  assert.deepEqual([twice.status, twice.body.code], [409, 'not_held']);
  assert.equal((await own(`/api/c2w/orders/${held.id}/hold-longer`, { method: 'POST', body: {} })).status, 409);
  // The freed frame can be held for the next quote.
  const next = (await quote(bike)).body.order;
  assert.equal(next.frameId, frame.id);
});

test('5.3 Release on a count-held bike frees one; holding and releasing need someone checked in', async () => {
  const bike = await countedBike(1);
  const held = (await quote(bike)).body.order;
  const till = await tillNobodyIn();
  assert.equal((await till(`/api/c2w/orders/${held.id}/release`, {})).status, 409);
  assert.equal((await till(`/api/c2w/orders/${held.id}/hold-longer`, {})).status, 409);
  assert.equal((await order(held.id)).held, true, 'nothing changed');
  assert.equal((await own(`/api/c2w/orders/${held.id}/release`, { method: 'POST', body: {} })).status, 200);
  assert.equal((await stockOf(bike)).sites[0].free, 1);
});

test('the stock check names the sites, oldest first, with what is free and held at each', async () => {
  const bike = await countedBike(2);
  await quote(bike);
  const stock = await stockOf(bike);
  assert.equal(stock.here, site);
  assert.deepEqual(stock.sites.map((s) => [s.siteId, s.free, s.held]), [[site, 1, 1]]);
  assert.equal(typeof stock.sites[0].siteName, 'string');
  assert.equal((await own('/api/c2w/stock?productId=nope')).status, 400);
  assert.equal((await own('/api/c2w/stock?productId=999999999')).status, 404);
});
