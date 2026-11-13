// Cancelling a Cycle to Work order (openspec/changes/cycle-to-work, task 8.5 and
// 8.7's cancel message; decision 2026-10-02-cycle-to-work-review line 166; drawings
// cw-cancel and cw-cancel-ordered, "Cancel the order…" on More, in
// docs/design/user-journeys/generator/c2w.mjs; wording on cw-texts-cancelled).
// Deposits aren't built yet (pull request 11), so every order here has none and
// anyone checked in can cancel it. Names and numbers are made-up test values.
//
// The server clock is pinned to 1 Sep 2026 (WHEELHOUSE_TEST_CLOCK). Sending is
// pretend in tests.
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
let jo;
let provider;
let site;
const own = (p, options) => staffRequest(server.baseUrl, owner.cookie, p, options);
const asJo = (p, options) => staffRequest(server.baseUrl, jo, p, options);
const inShop = (fn) => runWithShop(owner.shop.id, fn);
const tag = () => randomUUID().slice(0, 8);
const post = (p, body, as = own) => as(p, { method: 'POST', body });

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  const made = await own('/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `jo-${tag()}@example.test`, password: 'password123' } });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  jo = await staffFreshCookie(made.body.loginId);
  const set = await own('/api/c2w/settings', { method: 'PUT', body: { holdDays: 7, remindDays: 2, quoteValidDays: 30 } });
  assert.equal(set.status, 200, JSON.stringify(set.body));
  const phone = await own('/api/shop-details', { method: 'PUT', body: { phone: '[Shop phone]' } });
  assert.equal(phone.status, 200, JSON.stringify(phone.body));
  provider = (await own('/api/c2w/providers', { method: 'POST', body: { name: '[Provider]' } })).body.provider;
  site = await inShop(async () => (await prepare('SELECT id FROM sites ORDER BY id LIMIT 1').get()).id);
  await inShop(() => prepare("INSERT INTO suppliers (name, adapter_type, config, updated_at) VALUES ('[Supplier]', 'mock_csv', '{}', now())").run());
});
after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const newMaya = async () => (await own('/api/customers', { method: 'POST', body: { name: 'Maya Patel', email: `maya-${tag()}@example.test` } })).body;
// A £1,000 bike with one frame in stock at the shop's site.
async function framedBike() {
  const id = await seedProduct(owner.shop.id, { name: '[Bike] · [Size]', price: '1000.00', stock: 1 });
  await inShop(async () => {
    await prepare('INSERT INTO product_stock (site_id, product_id, qty) VALUES (?, ?, 1) RETURNING product_id').get(site, id);
    const key = `[FRAME-${tag()}]`;
    await prepare('INSERT INTO stock_frames (product_id, site_id, frame_number, frame_key) VALUES (?, ?, ?, ?) RETURNING id').get(id, site, key, key);
  });
  return id;
}
// A bike none of is in stock, from [Supplier].
const unstockedBike = () => inShop(async () => (await prepare(
  "INSERT INTO products (sku, name, supplier, price, cost, stock_qty, updated_at) VALUES (?, '[Bike] · [Size]', '[Supplier]', 1000, 600, 0, now())",
).run(`[Supplier code]-${tag()}`)).lastInsertRowid);
const quote = async (maya, productId) => {
  const res = await own('/api/c2w/orders', { method: 'POST', body: { customerId: maya.id, providerId: provider.id, productId, accessoryIds: [] } });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body.order;
};
const order = async (id) => (await own(`/api/c2w/orders/${id}`)).body.order;
const cancel = (id, body = {}, as = own) => post(`/api/c2w/orders/${id}/cancel`, body, as);
const frames = (productId) => inShop(() => prepare('SELECT state, c2w_order_id FROM stock_frames WHERE product_id = ?').all(productId));
const linesFor = (productId) => inShop(() => prepare('SELECT qty_ordered, c2w_order_id FROM purchase_order_items WHERE product_id = ?').all(productId));
const messagesTo = (maya) => inShop(() => prepare(
  "SELECT template_key, body FROM customer_messages WHERE customer_id = ? AND template_key LIKE 'c2w\\_cancelled%' ORDER BY id",
).all(maya.id));

test('8.5 cancelling frees the held frame and keeps the order, cancelled, with what happened', async () => {
  const maya = await newMaya();
  const bike = await framedBike();
  const made = await quote(maya, bike);
  assert.deepEqual((await frames(bike)).map((f) => f.state), ['held']);
  const res = await cancel(made.id, { reason: '[reason]' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.order.stage, 'cancelled');
  assert.deepEqual(await frames(bike), [{ state: 'in_stock', c2w_order_id: null }]);
  const o = await order(made.id);
  assert.equal(o.stage, 'cancelled');
  const line = o.events.at(-1);
  assert.equal(line.kind, 'cancelled');
  assert.equal(line.by, 'Jack Lewis');
  assert.equal(line.reason, '[reason]');
  const kept = await inShop(() => prepare('SELECT frame_id, held_at, hold_until FROM c2w_orders WHERE id = ?').get(made.id));
  assert.deepEqual(kept, { frame_id: null, held_at: null, hold_until: null });
  // The freed frame can go to someone else's order straight away.
  const next = await quote(await newMaya(), bike);
  assert.equal(next.held, true);
});

test('8.5 Staff can cancel an order with no deposit, from any open stage', async () => {
  const maya = await newMaya();
  const waiting = await quote(maya, await framedBike());
  assert.equal((await post(`/api/c2w/orders/${waiting.id}/applied`, {})).status, 200);
  const res = await cancel(waiting.id, {}, asJo);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.order.stage, 'cancelled');
  assert.equal((await order(waiting.id)).events.at(-1).by, 'Jo Taylor');

  const ready = await quote(maya, await framedBike());
  const cert = await post(`/api/c2w/orders/${ready.id}/certificate`, { number: '[certificate number]', amountPence: 100000, ready: true });
  assert.equal(cert.status, 200, JSON.stringify(cert.body));
  assert.equal((await order(ready.id)).stage, 'ready');
  assert.equal((await cancel(ready.id, {}, asJo)).status, 200);
  assert.equal((await order(ready.id)).stage, 'cancelled');
  assert.deepEqual(await frames(ready.productId), [{ state: 'in_stock', c2w_order_id: null }]);
});

test('8.5 a cancelled order can’t be cancelled again, and a missing one is not found', async () => {
  const made = await quote(await newMaya(), await framedBike());
  assert.equal((await cancel(made.id)).status, 200);
  const again = await cancel(made.id);
  assert.equal(again.status, 409, JSON.stringify(again.body));
  assert.equal(again.body.code, 'wrong_stage');
  assert.equal((await cancel(999999)).status, 404);
  const done = await quote(await newMaya(), await framedBike());
  await inShop(() => prepare("UPDATE c2w_orders SET stage = 'collected' WHERE id = ?").run(done.id));
  const late = await cancel(done.id);
  assert.deepEqual([late.status, late.body.code], [409, 'wrong_stage']);
  const long = await cancel((await quote(await newMaya(), await framedBike())).id, { reason: 'x'.repeat(501) });
  assert.equal(long.status, 400);
});

test('8.5 a bike already ordered is kept as shop stock: its order line no longer names the Cycle to Work order', async () => {
  const bike = await unstockedBike();
  const made = await quote(await newMaya(), bike);
  const ordered = await post(`/api/c2w/orders/${made.id}/order`, { anyway: true, reason: '[reason]' });
  assert.equal(ordered.status, 200, JSON.stringify(ordered.body));
  const choose = await cancel(made.id);
  assert.equal(choose.status, 400, 'an ordered bike needs Keep it as shop stock or Send it back');
  assert.equal((await order(made.id)).stage, 'quote');
  const res = await cancel(made.id, { bike: 'keep' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(await linesFor(bike), [{ qty_ordered: 1, c2w_order_id: null }]);
  assert.equal((await order(made.id)).events.at(-1).detail.bike, 'keep');
});

test('8.5 a bike on a supplier order that has been sent, or partly delivered, is kept as shop stock too', async () => {
  for (const status of ['ordered', 'partially_received']) {
    const bike = await unstockedBike();
    const made = await quote(await newMaya(), bike);
    assert.equal((await post(`/api/c2w/orders/${made.id}/order`, { anyway: true, reason: '[reason]' })).status, 200);
    await inShop(() => prepare('UPDATE purchase_orders SET status = ? WHERE id = (SELECT purchase_order_id FROM purchase_order_items WHERE c2w_order_id = ?)').run(status, made.id));
    const res = await cancel(made.id, { bike: 'keep' });
    assert.equal(res.status, 200, `${status}: ${JSON.stringify(res.body)}`);
    assert.deepEqual(await linesFor(bike), [{ qty_ordered: 1, c2w_order_id: null }], status);
  }
});

test('8.5 a choice for the bike that isn’t keep or send back is refused, and nothing changes', async () => {
  const bike = await framedBike();
  const made = await quote(await newMaya(), bike);
  const res = await cancel(made.id, { bike: 'bin' });
  assert.equal(res.status, 400, JSON.stringify(res.body));
  assert.equal((await order(made.id)).stage, 'quote');
  assert.deepEqual((await frames(bike)).map((f) => f.state), ['held']);
});

test('8.5 a bike held by count (no frame numbers) is let go when the order is cancelled', async () => {
  const bike = await seedProduct(owner.shop.id, { name: '[Bike] · [Size]', price: '1000.00', stock: 1 });
  await inShop(() => prepare('INSERT INTO product_stock (site_id, product_id, qty) VALUES (?, ?, 1) RETURNING product_id').get(site, bike));
  const made = await quote(await newMaya(), bike);
  assert.equal(made.held, true);
  assert.equal((await cancel(made.id)).status, 200);
  assert.equal((await inShop(() => prepare('SELECT held_at FROM c2w_orders WHERE id = ?').get(made.id))).held_at, null);
  assert.equal((await quote(await newMaya(), bike)).held, true, 'the one in stock can be held for someone else');
});

test('8.7 a Ready to collect or Certificate received still waiting to go is stopped when the order is cancelled', async () => {
  const pending = (maya) => inShop(() => prepare(
    "SELECT template_key, intent_state FROM customer_messages WHERE customer_id = ? AND template_key IN ('c2w_ready', 'c2w_certificate', 'c2w_certificate_less') ORDER BY id",
  ).all(maya.id));
  const maya = await newMaya();
  const ready = await quote(maya, await framedBike());
  assert.equal((await post(`/api/c2w/orders/${ready.id}/certificate`, { number: '[certificate number]', amountPence: 100000, ready: true })).status, 200);
  assert.deepEqual(await pending(maya), [{ template_key: 'c2w_ready', intent_state: 'intended' }]);
  assert.equal((await cancel(ready.id)).status, 200);
  assert.deepEqual(await pending(maya), [{ template_key: 'c2w_ready', intent_state: 'undone' }]);

  const sam = await newMaya();
  const cert = await quote(sam, await framedBike());
  assert.equal((await post(`/api/c2w/orders/${cert.id}/certificate`, { number: '[certificate number]', amountPence: 100000 })).status, 200);
  assert.deepEqual((await pending(sam)).map((m) => m.intent_state), ['intended']);
  assert.equal((await cancel(cert.id)).status, 200);
  assert.deepEqual((await pending(sam)).map((m) => m.intent_state), ['undone']);
});

test('8.5 "Send it back to [supplier]" isn’t built yet, and says so without cancelling', async () => {
  const bike = await unstockedBike();
  const made = await quote(await newMaya(), bike);
  assert.equal((await post(`/api/c2w/orders/${made.id}/order`, { anyway: true, reason: '[reason]' })).status, 200);
  const res = await cancel(made.id, { bike: 'return' });
  assert.deepEqual([res.status, res.body.code], [400, 'return_not_built'], JSON.stringify(res.body));
  assert.equal((await order(made.id)).stage, 'quote');
  assert.equal((await linesFor(bike))[0].c2w_order_id, made.id);
});

test('8.7 Tell Maya: "Your order is cancelled" goes with the drawn words and the shop’s phone, and only when ticked', async () => {
  const maya = await newMaya();
  const made = await quote(maya, await framedBike());
  assert.equal((await cancel(made.id, { tell: true })).status, 200);
  const [m, ...more] = await messagesTo(maya);
  assert.deepEqual(more, []);
  assert.equal(m.template_key, 'c2w_cancelled');
  assert.equal(m.body, `Hi Maya, your Cycle to Work order, quote ${made.quoteRef}, is cancelled. Questions? Call [Shop phone].`);

  const quiet = await newMaya();
  assert.equal((await cancel((await quote(quiet, await framedBike())).id, { tell: false })).status, 200);
  assert.deepEqual(await messagesTo(quiet), []);
});

test('8.7 switching "Your order is cancelled" off in Settings › Messages stops it', async () => {
  const off = await own('/api/message-templates/c2w_cancelled', { method: 'PUT', body: { enabled: false } });
  assert.equal(off.status, 200, JSON.stringify(off.body));
  try {
    const maya = await newMaya();
    assert.equal((await cancel((await quote(maya, await framedBike())).id, { tell: true })).status, 200);
    assert.deepEqual(await messagesTo(maya), []);
  } finally {
    await own('/api/message-templates/c2w_cancelled', { method: 'PUT', body: { enabled: true } });
  }
});

test('8.7 with no shop phone, "Your order is cancelled" isn’t sent, and the order is still cancelled', async () => {
  await inShop(() => prepare("UPDATE shops SET phone = NULL WHERE id = current_setting('app.current_shop_id')::int").run());
  try {
    const maya = await newMaya();
    const made = await quote(maya, await framedBike());
    assert.equal((await cancel(made.id, { tell: true })).status, 200);
    const o = await order(made.id);
    assert.equal(o.stage, 'cancelled');
    assert.deepEqual(await messagesTo(maya), []);
    assert.equal(o.events.at(-1).detail.told, undefined, 'not told when nothing was sent');
  } finally {
    await inShop(() => prepare("UPDATE shops SET phone = '[Shop phone]' WHERE id = current_setting('app.current_shop_id')::int").run());
  }
});

test('8.5 a till with nobody checked in can’t cancel an order', async () => {
  const made = await quote(await newMaya(), await framedBike());
  // The Owner's own sign-in counts as checked in; a fresh till with nobody in does not.
  const cookie = await staffFreshCookie(owner.loginId);
  const setup = await fetch(`${server.baseUrl}/api/till-setup`, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ siteId: site, number: 9 }) });
  assert.equal(setup.status, 201);
  const tillCookie = [cookie, ...setup.headers.getSetCookie().map((l) => l.split(';')[0])].join('; ');
  const res = await fetch(`${server.baseUrl}/api/c2w/orders/${made.id}/cancel`, { method: 'POST', headers: { cookie: tillCookie, 'content-type': 'application/json' }, body: '{}' });
  assert.equal(res.status, 409);
  assert.equal((await res.json()).code, 'check_in_first');
  assert.equal((await order(made.id)).stage, 'quote');
});
