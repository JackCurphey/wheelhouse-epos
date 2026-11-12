// The certificate and Ready to collect for Cycle to Work orders
// (openspec/changes/cycle-to-work, tasks 6.1–6.2; drawings cw-certificate,
// cw-certificate-diff, cw-certificate-match, cw-certificate-more,
// cw-certificate-late, cw-certificate-released, cw-order-get-ready,
// cw-marked-ready in docs/design/user-journeys/generator/c2w.mjs). The drawings
// leave amounts and numbers bracketed, so the figures here are made-up test values.
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
let provider;
let maya;
let site;
let lock;
let light;
let pump;
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
  lock = await seedProduct(owner.shop.id, { name: '[Lock]', price: '40.00' });
  light = await seedProduct(owner.shop.id, { name: '[Light]', price: '25.00' });
  pump = await seedProduct(owner.shop.id, { name: '[Pump]', price: '20.00' });
});
after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
  await pool.end();
});

// A bike at £1,000 with frame numbers, `frames` of them in stock at the shop's site.
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
const quote = async (productId, body = {}) => {
  const res = await own('/api/c2w/orders', { method: 'POST', body: { customerId: maya.id, providerId: provider.id, productId, accessoryIds: [], ...body } });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body.order;
};
const order = async (id) => (await own(`/api/c2w/orders/${id}`)).body.order;
const post = (p, body) => own(p, { method: 'POST', body });
const certify = (id, body) => post(`/api/c2w/orders/${id}/certificate`, { number: '[certificate number]', ...body });
const frames = (productId) => inShop(async () => prepare('SELECT id, state, c2w_order_id FROM stock_frames WHERE product_id = ? ORDER BY id').all(productId));

// ---------- 6.1 ----------

test('6.1 the certificate, from Waiting: the stage moves on and the hold is firm, with no end date', async () => {
  const bike = await framedBike(1);
  const made = await quote(bike);
  assert.equal((await post(`/api/c2w/orders/${made.id}/applied`, {})).status, 200);
  const res = await certify(made.id, { amountPence: 100000, receivedOn: '2026-09-01' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const o = res.body.order;
  assert.deepEqual([o.stage, o.certificateNumber, o.certificatePence, o.certificateReceivedOn], ['certificate', '[certificate number]', 100000, '2026-09-01']);
  assert.deepEqual([o.held, o.holdUntil], [true, null], 'firm until collection (decision 3)');
  assert.deepEqual([o.providerPaysPence, o.customerPaysPence, o.certificateLate], [100000, 0, false]);
  // "added certificate [certificate number] · certificate £[£] · quote £[£]"
  const line = (await order(made.id)).events.at(-1);
  assert.equal(line.kind, 'certificate');
  assert.equal(line.by, 'Jack Lewis');
  assert.deepEqual(line.detail, { number: '[certificate number]', certificatePence: 100000, quotePence: 100000 });
  const [frame] = await frames(bike);
  assert.deepEqual([frame.state, frame.c2w_order_id], ['held', made.id], 'still put aside');
});

test('6.1 the certificate straight from the quote, received today unless a day is given; a second one is refused', async () => {
  const made = await quote(await framedBike(1));
  const res = await certify(made.id, { amountPence: 100000 });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual([res.body.order.stage, res.body.order.certificateReceivedOn], ['certificate', '2026-09-01']);
  const again = await certify(made.id, { amountPence: 100000 });
  assert.deepEqual([again.status, again.body.code], [409, 'wrong_stage']);
});

test('6.1 what a certificate needs: a number, an amount in whole pence, a received day no later than today', async () => {
  const made = await quote(await framedBike(1));
  for (const body of [
    { number: '', amountPence: 100000 },
    { number: 'x'.repeat(61), amountPence: 100000 },
    { amountPence: -1 },
    { amountPence: 1.5 },
    { amountPence: '100000' },
    { amountPence: 100000, receivedOn: '2026-09-02' },
    { amountPence: 100000, receivedOn: 'yesterday' },
  ]) {
    const res = await certify(made.id, body);
    assert.equal(res.status, 400, `${JSON.stringify(body)} → ${JSON.stringify(res.body)}`);
  }
  assert.equal((await order(made.id)).stage, 'quote', 'nothing saved');
});

test('6.1 the “bike is ready” tick goes on to Ready to collect; Undo goes back', async () => {
  const made = await quote(await framedBike(1));
  const res = await certify(made.id, { amountPence: 100000, ready: true });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.order.stage, 'ready');
  // "… · and marked the bike ready to collect": one line, not two.
  const lines = (await order(made.id)).events;
  assert.equal(lines.at(-1).kind, 'certificate');
  assert.equal(lines.at(-1).detail.ready, true);
  const undone = await post(`/api/c2w/orders/${made.id}/ready/undo`, {});
  assert.equal(undone.status, 200, JSON.stringify(undone.body));
  assert.equal(undone.body.order.stage, 'certificate');
  assert.equal((await order(made.id)).events.at(-1).kind, 'ready_undone');
  const again = await post(`/api/c2w/orders/${made.id}/ready/undo`, {});
  assert.deepEqual([again.status, again.body.code], [409, 'wrong_stage'], 'Undo only from Ready to collect');
});

test('6.1 Mark ready (cw-order-get-ready) moves a certificate order to Ready to collect, only from Certificate in', async () => {
  const made = await quote(await framedBike(1));
  const early = await post(`/api/c2w/orders/${made.id}/ready`, {});
  assert.deepEqual([early.status, early.body.code], [409, 'wrong_stage'], 'no certificate yet');
  assert.equal((await certify(made.id, { amountPence: 100000 })).status, 200);
  const res = await post(`/api/c2w/orders/${made.id}/ready`, {});
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.order.stage, 'ready');
  assert.equal((await order(made.id)).events.at(-1).kind, 'ready');
});

test('6.1 a bike not put aside can’t be marked ready', async () => {
  const bike = await framedBike(1);
  const first = await quote(bike);
  const second = await quote(bike);
  assert.equal(second.held, false, 'the only frame went to the first quote');
  // cw-certificate-released: "certificate [certificate number] saved", then what to do.
  const tick = await certify(second.id, { amountPence: 100000, ready: true });
  assert.equal(tick.status, 200, JSON.stringify(tick.body));
  assert.deepEqual([tick.body.order.stage, tick.body.notReady], ['certificate', 'not_held'], 'saved, not marked ready');
  assert.equal((await order(second.id)).events.at(-1).detail.ready, undefined);
  const mark = await post(`/api/c2w/orders/${second.id}/ready`, {});
  assert.deepEqual([mark.status, mark.body.code], [409, 'not_held']);
  assert.ok(first);
});

// ---------- 6.2 ----------

test('6.2 less than the order: a choice is needed; keeping the order, Maya pays the difference', async () => {
  const made = await quote(await framedBike(1), { accessoryIds: [lock] });
  assert.equal(made.totalPence, 104000);
  const noChoice = await certify(made.id, { amountPence: 100000 });
  assert.deepEqual([noChoice.status, noChoice.body.code], [400, 'difference_choice']);
  const res = await certify(made.id, { amountPence: 100000, difference: 'keep' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const o = res.body.order;
  assert.deepEqual([o.differenceChoice, o.totalPence, o.providerPaysPence, o.customerPaysPence], ['keep', 104000, 100000, 4000]);
});

test('6.2 less than the order, changed to match: what’s ticked off comes off, and the total may not stay above the certificate', async () => {
  const made = await quote(await framedBike(1), { accessoryIds: [lock, light] });
  assert.equal(made.totalPence, 106500);
  const tooMuch = await certify(made.id, { amountPence: 104000, difference: 'match', accessoryIds: [lock, light] });
  assert.equal(tooMuch.status, 400, 'still above the certificate');
  const res = await certify(made.id, { amountPence: 104000, difference: 'match', accessoryIds: [lock] });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const o = res.body.order;
  assert.deepEqual(o.accessories.map((a) => [a.productId, a.pricePence]), [[lock, 4000]]);
  assert.deepEqual([o.differenceChoice, o.totalPence, o.providerPaysPence, o.customerPaysPence], ['match', 104000, 104000, 0]);
  assert.ok(o.quoteRevisedAt, 'a revised quote');
});

test('6.2 more than the order: kept as quoted by default, the provider expected to pay the order’s total', async () => {
  const made = await quote(await framedBike(1));
  const res = await certify(made.id, { amountPence: 104000 });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const o = res.body.order;
  assert.deepEqual([o.differenceChoice, o.totalPence, o.providerPaysPence, o.customerPaysPence], ['keep', 100000, 100000, 0]);
});

test('6.2 more than the order, changed to match: what’s added is priced from the shop’s products, and may not take the total past the certificate', async () => {
  const made = await quote(await framedBike(1));
  const past = await certify(made.id, { amountPence: 104000, difference: 'match', accessoryIds: [lock, pump] });
  assert.equal(past.status, 400, 'past the certificate');
  const res = await certify(made.id, { amountPence: 104000, difference: 'match', accessoryIds: [lock] });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const o = res.body.order;
  assert.deepEqual(o.accessories.map((a) => [a.productId, a.name, a.pricePence]), [[lock, '[Lock]', 4000]]);
  assert.deepEqual([o.totalPence, o.providerPaysPence, o.customerPaysPence], [104000, 104000, 0]);
});

test('6.2 an accessory kept keeps its quoted price, even if the shop’s price has changed since', async () => {
  const made = await quote(await framedBike(1), { accessoryIds: [lock, light] });
  await inShop(async () => prepare('UPDATE products SET price = 45 WHERE id = ? RETURNING id').get(lock));
  try {
    const res = await certify(made.id, { amountPence: 104000, difference: 'match', accessoryIds: [lock] });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.order.accessories[0].pricePence, 4000);
  } finally {
    await inShop(async () => prepare('UPDATE products SET price = 40 WHERE id = ? RETURNING id').get(lock));
  }
});

test('6.2 a certificate received after the quote ran out is saved, marked late', async () => {
  const made = await quote(await framedBike(1));
  await inShop(async () => prepare("UPDATE c2w_orders SET valid_until = '2026-08-20' WHERE id = ? RETURNING id").get(made.id));
  const res = await certify(made.id, { amountPence: 100000 });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.order.certificateLate, true);
});

test('6.2 a released order takes a free frame at its site again', async () => {
  const bike = await framedBike(2);
  const made = await quote(bike);
  assert.equal((await post(`/api/c2w/orders/${made.id}/release`, {})).status, 200);
  const res = await certify(made.id, { amountPence: 100000 });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const o = res.body.order;
  assert.equal(o.held, true);
  const held = (await frames(bike)).filter((f) => f.c2w_order_id === made.id);
  assert.equal(held.length, 1);
  assert.deepEqual([held[0].state, held[0].id], ['held', o.frameId]);
  assert.equal(o.inStock, true);
  // "What's happened" says which frame was put aside again.
  assert.equal((await order(made.id)).events.at(-1).detail.heldFrameId, o.frameId);
});

test('6.2 a certificate for nothing is refused', async () => {
  const made = await quote(await framedBike(1));
  const res = await certify(made.id, { amountPence: 0, difference: 'keep' });
  assert.equal(res.status, 400, JSON.stringify(res.body));
});

test('6.2 changing to match is kept even when the certificate equals the order', async () => {
  const made = await quote(await framedBike(1), { accessoryIds: [lock] });
  const res = await certify(made.id, { amountPence: 104000, difference: 'match', accessoryIds: [] });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const o = res.body.order;
  assert.deepEqual([o.differenceChoice, o.totalPence, o.accessories.length], ['match', 100000, 0]);
});

test('6.2 an accessory chosen twice to match is refused, not charged twice', async () => {
  const made = await quote(await framedBike(1), { accessoryIds: [lock, light] });
  const res = await certify(made.id, { amountPence: 110000, difference: 'match', accessoryIds: [lock, lock] });
  assert.equal(res.status, 400, JSON.stringify(res.body));
  assert.equal((await order(made.id)).stage, 'quote', 'nothing saved');
});

test('6.2 a released order with no frame free is saved, not held, and counts as not in stock', async () => {
  const bike = await framedBike(1);
  const made = await quote(bike);
  assert.equal((await post(`/api/c2w/orders/${made.id}/release`, {})).status, 200);
  const other = await quote(bike);
  assert.equal(other.held, true, 'someone else has the frame now');
  const res = await certify(made.id, { amountPence: 100000 });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual([res.body.order.stage, res.body.order.held, res.body.order.inStock], ['certificate', false, false]);
});

test('6.1 a till with nobody checked in can’t add a certificate', async () => {
  const made = await quote(await framedBike(1));
  // The Owner's own sign-in counts as checked in; a fresh till with nobody in does not.
  const { staffFreshCookie } = await import('./helpers/staff.js');
  const cookie = await staffFreshCookie(owner.loginId);
  const setup = await fetch(`${server.baseUrl}/api/till-setup`, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ siteId: site, number: 8 }) });
  assert.equal(setup.status, 201);
  const tillCookie = [cookie, ...setup.headers.getSetCookie().map((l) => l.split(';')[0])].join('; ');
  const res = await fetch(`${server.baseUrl}/api/c2w/orders/${made.id}/certificate`, { method: 'POST', headers: { cookie: tillCookie, 'content-type': 'application/json' }, body: JSON.stringify({ number: '[n]', amountPence: 100000 }) });
  assert.equal(res.status, 409);
  assert.equal((await res.json()).code, 'check_in_first');
});
