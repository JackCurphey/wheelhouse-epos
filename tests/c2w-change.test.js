// Changing a Cycle to Work order after the quote (openspec/changes/cycle-to-work
// tasks 4.8; drawings cw-more and cw-quote-revised in
// docs/design/user-journeys/generator/c2w.mjs): change the bike or size, the
// accessories or the provider, each making a revised quote that is sent only on
// Email. The drawings leave prices bracketed, so the numbers here are made-up
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
import { staffSignup, staffRequest } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';
import { seedProduct } from './helpers/till.js';

let server;
let owner;
let provider;
let other;
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
  other = (await own('/api/c2w/providers', { method: 'POST', body: { name: '[Other provider]' } })).body.provider;
  maya = (await own('/api/customers', { method: 'POST', body: { name: 'Maya Patel', email: `maya-${tag()}@example.test` } })).body;
  site = await inShop(async () => (await prepare('SELECT id FROM sites ORDER BY id LIMIT 1').get()).id);
});
after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
  await pool.end();
});

async function framedBike(frames, price = '1000.00') {
  const id = await seedProduct(owner.shop.id, { name: `[Bike ${tag()}] · [Size]`, price, stock: frames });
  await inShop(async () => {
    await prepare('INSERT INTO product_stock (site_id, product_id, qty) VALUES (?, ?, ?) RETURNING product_id').get(site, id, frames);
    for (let i = 0; i < frames; i += 1) {
      const key = `[FRAME-${tag()}]`;
      await prepare('INSERT INTO stock_frames (product_id, site_id, frame_number, frame_key) VALUES (?, ?, ?, ?) RETURNING id').get(id, site, key, key);
    }
  });
  return id;
}
async function countedBike(qty, price = '1000.00') {
  const id = await seedProduct(owner.shop.id, { name: `[Bike ${tag()}] · [Size]`, price, stock: qty });
  await inShop(async () => prepare('INSERT INTO product_stock (site_id, product_id, qty) VALUES (?, ?, ?) RETURNING product_id').get(site, id, qty));
  return id;
}
const accessory = (price) => seedProduct(owner.shop.id, { name: `[Accessory ${tag()}]`, price, stock: 5 });
const quote = async (productId, body = {}) => {
  const r = await own('/api/c2w/orders', { method: 'POST', body: { customerId: maya.id, providerId: provider.id, productId, accessoryIds: [], ...body } });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body.order;
};
const change = (id, body) => own(`/api/c2w/orders/${id}/change`, { method: 'POST', body });
const order = async (id) => (await own(`/api/c2w/orders/${id}`)).body.order;
const frames = (productId) => inShop(async () => prepare('SELECT id, state, c2w_order_id FROM stock_frames WHERE product_id = ? ORDER BY id').all(productId));
// price_pence is worked out from price, so the price is set in pounds.
const setPrice = (productId, pence) => inShop(async () => prepare('UPDATE products SET price = ? WHERE id = ? RETURNING id').get((pence / 100).toFixed(2), productId));

test('4.8 changing the bike moves the hold: the old frame goes back on sale, a free frame of the new bike is held, the total follows, and nothing is sent', async () => {
  const before = await framedBike(1, '1000.00');
  const after = await framedBike(1, '1200.00');
  const extra = await accessory('50.00');
  const o = await quote(before, { accessoryIds: [extra] });
  assert.equal(o.held, true);
  const r = await change(o.id, { what: 'bike', productId: after });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const [oldFrame] = await frames(before);
  const [newFrame] = await frames(after);
  assert.deepEqual([oldFrame.state, oldFrame.c2w_order_id], ['in_stock', null], 'the old bike is back on sale');
  assert.deepEqual([newFrame.state, newFrame.c2w_order_id], ['held', o.id], 'the new bike is put aside for the order');
  const now = await order(o.id);
  assert.deepEqual([now.productId, now.frameId, now.held, now.holdUntil, now.totalPence], [after, newFrame.id, true, o.holdUntil, 125000]);
  assert.ok(now.quoteRevisedAt, 'the quote is revised');
  const last = now.events.at(-1);
  assert.equal(last.kind, 'changed');
  assert.deepEqual([last.detail.what, last.detail.from, last.detail.to, last.detail.held], ['bike', o.bike, now.bike, true]);
  const sent = await inShop(async () => prepare('SELECT count(*)::int AS n FROM customer_messages WHERE customer_id = ? AND created_at > ?').get(maya.id, o.quoteGivenAt));
  const atQuote = await inShop(async () => prepare("SELECT count(*)::int AS n FROM customer_messages WHERE customer_id = ? AND template_key = 'c2w_put_aside'").get(maya.id));
  assert.equal(sent.n, atQuote.n, 'no message goes until Email is pressed');
});

test('4.8 changing to a bike with none free here lets the old one go, and the order needs the new one ordering in', async () => {
  const before = await framedBike(1);
  const none = await framedBike(0);
  const o = await quote(before);
  const r = await change(o.id, { what: 'bike', productId: none });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal((await frames(before))[0].state, 'in_stock');
  const now = await order(o.id);
  assert.deepEqual([now.frameId, now.held, now.holdUntil, now.inStock], [null, false, null, false]);
  assert.equal(now.events.at(-1).detail.held, false);
});

test('4.8 a bike with no frame numbers moves its count: the old one is free again, the new one is held', async () => {
  const before = await countedBike(1);
  const after = await countedBike(1);
  const o = await quote(before);
  assert.equal(o.held, true);
  assert.equal((await change(o.id, { what: 'bike', productId: after })).status, 200);
  const stock = async (p) => (await own(`/api/c2w/stock?productId=${p}`)).body.sites[0];
  assert.deepEqual([(await stock(before)).free, (await stock(after)).free, (await stock(after)).held], [1, 0, 1]);
});

test('4.8 an order not held stays unheld when its bike changes before the certificate, unless the hold was wanted and never released', async () => {
  const before = await framedBike(1);
  const after = await framedBike(1);
  const loose = await quote(before, { hold: false });
  assert.equal((await change(loose.id, { what: 'bike', productId: after })).status, 200);
  const unheld = await order(loose.id);
  assert.equal(unheld.held, false, '"Don’t hold" stays as chosen');
  assert.ok(!('held' in unheld.events.at(-1).detail), 'no hold wanted, so the history says nothing about holding');
  assert.equal((await frames(after))[0].state, 'in_stock');
  // Quoted when none was free (the hold wanted): the new bike, free, is held.
  const gone = await framedBike(0);
  const wanted = await quote(gone);
  assert.equal(wanted.held, false);
  assert.equal((await change(wanted.id, { what: 'bike', productId: after })).status, 200);
  const now = await order(wanted.id);
  assert.deepEqual([now.held, now.holdUntil], [true, '2026-09-08']);
});

test('4.8 changing the accessories: kept ones keep their quoted price, added ones take today’s price, removed ones come off the total', async () => {
  const bike = await framedBike(1, '1000.00');
  const a = await accessory('20.00');
  const b = await accessory('30.00');
  const c = await accessory('40.00');
  const o = await quote(bike, { accessoryIds: [a, b] });
  assert.equal(o.totalPence, 105000);
  await setPrice(a, 2500);
  const r = await change(o.id, { what: 'accessories', accessoryIds: [a, c] });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const now = await order(o.id);
  assert.deepEqual(now.accessories.map((x) => [x.productId, x.pricePence]), [[a, 2000], [c, 4000]]);
  assert.equal(now.totalPence, 106000);
  const last = now.events.at(-1);
  assert.equal(last.detail.what, 'accessories');
  assert.deepEqual([last.detail.added, last.detail.removed], [[now.accessories[1].name], [o.accessories[1].name]]);
  assert.equal(now.held, true, 'the bike stays held');
});

test('4.8 changing the provider, before the certificate only; a retired one is refused', async () => {
  const bike = await framedBike(2);
  const o = await quote(bike);
  const r = await change(o.id, { what: 'provider', providerId: other.id });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const now = await order(o.id);
  assert.equal(now.providerId, other.id);
  assert.deepEqual([now.events.at(-1).detail.from, now.events.at(-1).detail.to], ['[Provider]', '[Other provider]']);
  const retired = (await own('/api/c2w/providers', { method: 'POST', body: { name: '[Retired provider]' } })).body.provider;
  await inShop(async () => prepare('UPDATE c2w_providers SET retired_at = now() WHERE id = ? RETURNING id').get(retired.id));
  assert.equal((await change(o.id, { what: 'provider', providerId: retired.id })).body.code, 'retired_provider');
  // After the certificate, the provider is the one on it.
  const cert = await own(`/api/c2w/orders/${o.id}/certificate`, { method: 'POST', body: { number: '[certificate number]', amountPence: now.totalPence } });
  assert.equal(cert.status, 200, JSON.stringify(cert.body));
  assert.equal((await change(o.id, { what: 'provider', providerId: provider.id })).body.code, 'wrong_stage');
});

test('4.8 after the certificate the bike can still change; the hold stays firm with no end date, and the difference follows the new total', async () => {
  const before = await framedBike(1, '1000.00');
  const after = await framedBike(1, '1200.00');
  const o = await quote(before);
  await own(`/api/c2w/orders/${o.id}/certificate`, { method: 'POST', body: { number: '[certificate number]', amountPence: 100000 } });
  const r = await change(o.id, { what: 'bike', productId: after });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const now = await order(o.id);
  assert.deepEqual([now.stage, now.held, now.holdUntil, now.totalPence], ['certificate', true, null, 120000]);
  assert.deepEqual([now.providerPaysPence, now.customerPaysPence], [100000, 20000]);
  assert.equal(now.differenceChoice, 'keep', 'the customer pays the extra at collection');
  // Back to a bike at the certificate's amount: no difference left.
  assert.equal((await change(o.id, { what: 'bike', productId: before })).status, 200);
  assert.equal((await order(o.id)).differenceChoice, null);
});

test('4.8 refusals: the same bike or provider, a stage past the certificate, and a bike on order with the supplier', async () => {
  const bike = await framedBike(2);
  const o = await quote(bike);
  assert.equal((await change(o.id, { what: 'bike', productId: bike })).body.code, 'same_choice');
  assert.equal((await change(o.id, { what: 'provider', providerId: provider.id })).body.code, 'same_choice');
  assert.equal((await change(o.id, { what: 'frame' })).status, 400);
  assert.equal((await change(o.id, { what: 'bike', productId: 999999999 })).status, 400);
  // Ready to collect: the bike is waiting at the counter.
  await own(`/api/c2w/orders/${o.id}/certificate`, { method: 'POST', body: { number: '[certificate number]', amountPence: o.totalPence, ready: true } });
  assert.equal((await change(o.id, { what: 'bike', productId: await framedBike(1) })).body.code, 'wrong_stage');
  // On order with the supplier: undo that first.
  const none = await framedBike(0);
  const supplier = `[Supplier ${tag()}]`;
  await inShop(async () => {
    await prepare("INSERT INTO suppliers (name, adapter_type, config, updated_at) VALUES (?, 'mock_csv', '{}', now()) RETURNING id").get(supplier);
    await prepare('UPDATE products SET supplier = ? WHERE id = ? RETURNING id').get(supplier, none);
  });
  const ordered = await quote(none);
  const placed = await own(`/api/c2w/orders/${ordered.id}/order`, { method: 'POST', body: { anyway: true, reason: '[reason]' } });
  assert.equal(placed.status, 200, JSON.stringify(placed.body));
  assert.equal((await change(ordered.id, { what: 'bike', productId: bike })).body.code, 'on_order');
  assert.equal((await change(ordered.id, { what: 'accessories', accessoryIds: [await accessory('20.00')] })).status, 200, 'the accessories can still change');
});

test('4.8 a product taken off sale can’t be picked: not as the bike, not as an added accessory; one already on the order can stay', async () => {
  const bike = await framedBike(1);
  const a = await accessory('20.00');
  const o = await quote(bike, { accessoryIds: [a] });
  const offSale = (id) => inShop(async () => prepare('UPDATE products SET active = 0 WHERE id = ? RETURNING id').get(id));
  const gone = await framedBike(1);
  const goneAcc = await accessory('30.00');
  await offSale(gone);
  await offSale(goneAcc);
  const asBike = await change(o.id, { what: 'bike', productId: gone });
  assert.equal(asBike.status, 400, 'a bike taken off sale is refused');
  assert.equal(asBike.body.error, 'Choose the bike');
  const asAcc = await change(o.id, { what: 'accessories', accessoryIds: [a, goneAcc] });
  assert.equal(asAcc.status, 400, 'an accessory taken off sale is refused');
  assert.equal(asAcc.body.error, 'Choose the accessories from the shop’s products');
  const still = await order(o.id);
  assert.equal(still.productId, bike, 'the bike is as it was');
  assert.deepEqual(still.accessories.map((x) => x.productId), [a], 'the accessories are as they were');
  assert.deepEqual((await frames(gone)).map((f) => f.state), ['in_stock'], 'nothing of the refused bike is held');
  // The certificate's "change it to match" picks accessories the same way.
  const matched = await own(`/api/c2w/orders/${o.id}/certificate`, { method: 'POST', body: { number: '[certificate number]', amountPence: o.totalPence - 100, difference: 'match', accessoryIds: [goneAcc] } });
  assert.equal(matched.status, 400, 'the certificate can’t add an accessory taken off sale either');
  assert.equal(matched.body.error, 'Choose the accessories from the shop’s products');
  assert.equal((await order(o.id)).stage, 'quote', 'the certificate was not taken');
  // The order's own accessory taken off sale since the quote stays on it.
  await offSale(a);
  const kept = await change(o.id, { what: 'accessories', accessoryIds: [a, await accessory('40.00')] });
  assert.equal(kept.status, 200, JSON.stringify(kept.body));
});

test('4.8 the quote says what changed and whether it has been emailed since (cw-quote-revised)', async () => {
  const before = await framedBike(1);
  const after = await framedBike(1);
  const o = await quote(before);
  const q0 = (await own(`/api/c2w/orders/${o.id}/quote`)).body.quote;
  assert.deepEqual([q0.revisedOn, q0.revision], [null, null]);
  await change(o.id, { what: 'bike', productId: after });
  const q1 = (await own(`/api/c2w/orders/${o.id}/quote`)).body.quote;
  assert.deepEqual(q1.revision, { what: 'bike', on: '2026-09-01', sent: false });
  assert.equal(q1.revisedOn, '2026-09-01');
  assert.equal((await own(`/api/c2w/orders/${o.id}/email-quote`, { method: 'POST', body: {} })).status, 200);
  const q2 = (await own(`/api/c2w/orders/${o.id}/quote`)).body.quote;
  assert.deepEqual(q2.revision, { what: 'bike', on: '2026-09-01', sent: true });
});

// From the self-review (reviewer, risky-area-reviewer and /review, 14 Nov).
test('4.8 the same accessories again is refused: nothing to revise', async () => {
  const bike = await framedBike(1);
  const a = await accessory('20.00');
  const b = await accessory('30.00');
  const o = await quote(bike, { accessoryIds: [a, b] });
  const had = (await order(o.id)).events.length;
  assert.equal((await change(o.id, { what: 'accessories', accessoryIds: [a, b] })).body.code, 'same_choice');
  assert.equal((await change(o.id, { what: 'accessories', accessoryIds: [b, a] })).body.code, 'same_choice', 'the same ones in another order');
  const now = await order(o.id);
  assert.deepEqual([now.quoteRevisedAt, now.events.length], [null, had]);
});

test('4.8 the accessories list is checked: each once, whole ids, up to 20', async () => {
  const bike = await framedBike(1);
  const a = await accessory('20.00');
  const o = await quote(bike);
  assert.equal((await change(o.id, { what: 'accessories', accessoryIds: [a, a] })).status, 400);
  assert.equal((await change(o.id, { what: 'accessories', accessoryIds: ['x'] })).status, 400);
  assert.equal((await change(o.id, { what: 'accessories', accessoryIds: Array.from({ length: 21 }, (_, i) => i + 1) })).status, 400);
  assert.equal((await change(o.id, { what: 'accessories', accessoryIds: 'all' })).status, 400);
});

test('4.8 at Ready to collect nothing changes: not the accessories, not the provider', async () => {
  const bike = await framedBike(1);
  const a = await accessory('20.00');
  const o = await quote(bike);
  await own(`/api/c2w/orders/${o.id}/certificate`, { method: 'POST', body: { number: '[certificate number]', amountPence: o.totalPence, ready: true } });
  assert.equal((await change(o.id, { what: 'accessories', accessoryIds: [a] })).body.code, 'wrong_stage');
  assert.equal((await change(o.id, { what: 'provider', providerId: other.id })).body.code, 'wrong_stage');
});

test('4.8 accessories changed after the certificate: the difference follows the new total', async () => {
  const bike = await framedBike(1, '1000.00');
  const a = await accessory('100.00');
  const o = await quote(bike);
  await own(`/api/c2w/orders/${o.id}/certificate`, { method: 'POST', body: { number: '[certificate number]', amountPence: 100000 } });
  assert.equal((await order(o.id)).differenceChoice, null);
  assert.equal((await change(o.id, { what: 'accessories', accessoryIds: [a] })).status, 200);
  const now = await order(o.id);
  assert.deepEqual([now.totalPence, now.differenceChoice, now.providerPaysPence, now.customerPaysPence], [110000, 'keep', 100000, 10000]);
  assert.equal((await change(o.id, { what: 'accessories', accessoryIds: [] })).status, 200);
  assert.equal((await order(o.id)).differenceChoice, null);
});

test('4.8 after the certificate, a bike with none free lets the firm hold go: the order needs one ordering in (logged)', async () => {
  const before = await framedBike(1);
  const none = await framedBike(0);
  const o = await quote(before);
  await own(`/api/c2w/orders/${o.id}/certificate`, { method: 'POST', body: { number: '[certificate number]', amountPence: o.totalPence } });
  assert.equal((await change(o.id, { what: 'bike', productId: none })).status, 200);
  assert.equal((await frames(before))[0].state, 'in_stock', 'the old bike is back on sale');
  const now = await order(o.id);
  assert.deepEqual([now.stage, now.held, now.frameId, now.events.at(-1).detail.held], ['certificate', false, null, false]);
});

test('4.8 the hold keeps its date, even one already pushed back with Hold longer; stock counts never move', async () => {
  const before = await framedBike(1);
  const after = await framedBike(1);
  const o = await quote(before);
  assert.equal((await own(`/api/c2w/orders/${o.id}/hold-longer`, { method: 'POST', body: {} })).status, 200);
  const longer = (await order(o.id)).holdUntil;
  assert.equal(longer, '2026-09-15');
  const qty = () => inShop(async () => prepare('SELECT id, stock_qty FROM products WHERE id = ANY(?::int[]) ORDER BY id').all([before, after]));
  const was = await qty();
  assert.equal((await change(o.id, { what: 'bike', productId: after })).status, 200);
  assert.equal((await order(o.id)).holdUntil, longer);
  assert.deepEqual(await qty(), was, 'a hold is not a sale: stock_qty stays');
});

test('4.8 a released order whose bike changes stays let go, and no longer says its old bike has been sold', async () => {
  const before = await framedBike(1);
  const after = await framedBike(1);
  const o = await quote(before);
  assert.equal((await own(`/api/c2w/orders/${o.id}/release`, { method: 'POST', body: {} })).status, 200);
  await inShop(async () => prepare("UPDATE stock_frames SET state = 'sold' WHERE product_id = ? RETURNING id").get(before));
  assert.equal((await order(o.id)).releasedSold, true);
  assert.equal((await change(o.id, { what: 'bike', productId: after })).status, 200);
  const now = await order(o.id);
  assert.deepEqual([now.held, now.releasedSold], [false, false]);
  assert.ok(!('held' in now.events.at(-1).detail), 'let go, so no hold was wanted');
});

test('4.8 the revised quote dates the change itself, not a later revision', async () => {
  const before = await framedBike(1);
  const after = await framedBike(1);
  const o = await quote(before);
  await change(o.id, { what: 'bike', productId: after });
  // A later revision (the certificate's "change it to match") moves quote_revised_at.
  await inShop(async () => prepare("UPDATE c2w_orders SET quote_revised_at = '2026-09-05T10:00:00Z' WHERE id = ? RETURNING id").get(o.id));
  const q = (await own(`/api/c2w/orders/${o.id}/quote`)).body.quote;
  assert.deepEqual(q.revision, { what: 'bike', on: '2026-09-01', sent: false });
});
