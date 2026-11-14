// A bike held for a Cycle to Work order is left out of the stock the shop can
// sell (openspec/changes/cycle-to-work task 5.4; decided-while-building
// 12 Nov, PR 5 item 7): the till's search, Stock's list and the product page.
// The storefront's side is in tests/site-products.test.js ("the last bike held
// for a Cycle to Work order counts as sold out"). The stock figure itself is
// left alone: a held bike is still in the shop. Days and prices are made-up
// test values; the drawings leave them bracketed.
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
import { productsToSend } from '../server/shopify/link.js';

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
  // A bike category, so Stock's list treats these as bikes counted by frame.
  await inShop(async () => prepare("INSERT INTO product_categories (name, path, bike_kind) VALUES ('Bikes', 'Bikes', 'bikes') RETURNING id").get());
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
    await prepare("UPDATE products SET category = 'Bikes' WHERE id = ?").run(id);
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

// The till's search (item-search.tsx: "[n] in stock" or "None in stock").
const inTill = async (productId) => {
  const res = await own(`/api/products?search=${encodeURIComponent('[Bike]')}`);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res.body.find((p) => p.id === productId);
};
const release = (id) => own(`/api/c2w/orders/${id}/release`, { method: 'POST', body: {} });

test('5.4 the till search leaves a held frame out of what is free, and the stock figure alone; Release puts it back', async () => {
  const bike = await framedBike(2);
  const held = (await quote(bike)).body.order;
  assert.equal(held.held, true);
  assert.deepEqual([(await inTill(bike)).stockQty, (await inTill(bike)).freeQty], [2, 1]);
  assert.equal((await release(held.id)).status, 200);
  assert.equal((await inTill(bike)).freeQty, 2);
});

test('5.4 the last bike held, by frame or by count, is none free at the till', async () => {
  const framed = await framedBike(1);
  const counted = await countedBike(1);
  assert.equal((await quote(framed)).body.order.held, true);
  assert.equal((await quote(counted)).body.order.held, true);
  assert.deepEqual([(await inTill(framed)).stockQty, (await inTill(framed)).freeQty], [1, 0]);
  assert.deepEqual([(await inTill(counted)).stockQty, (await inTill(counted)).freeQty], [1, 0]);
});

test('5.4 a quote without the hold leaves the bike free at the till', async () => {
  const bike = await countedBike(1);
  const open = (await quote(bike, { hold: false })).body.order;
  assert.equal(open.held, false, JSON.stringify(open));
  assert.equal((await inTill(bike)).freeQty, 1);
});

test('5.4 a bike held by count stays held after frames of the same bike are booked in, and is counted once', async () => {
  const bike = await countedBike(1);
  assert.equal((await quote(bike)).body.order.held, true);
  // One more of the same bike arrives, with a frame number, and a second quote holds that frame.
  await inShop(async () => {
    const key = `[FRAME-${tag()}]`;
    await prepare('INSERT INTO stock_frames (product_id, site_id, frame_number, frame_key) VALUES (?, ?, ?, ?) RETURNING id').get(bike, site, key, key);
    await prepare('UPDATE products SET stock_qty = stock_qty + 1 WHERE id = ?').run(bike);
    await prepare('UPDATE product_stock SET qty = qty + 1 WHERE product_id = ? AND site_id = ?').run(bike, site);
  });
  assert.equal((await inTill(bike)).freeQty, 1, 'the counted hold still counts once a frame is booked in');
  await inShop(async () => prepare("UPDATE stock_frames SET state = 'held' WHERE product_id = ? RETURNING id").get(bike));
  assert.equal((await inTill(bike)).freeQty, 0, 'a held frame and a counted hold add up');
});

test('5.4 a collected bike no longer counts as held: the sale has already lowered the figure', async () => {
  const bike = await countedBike(2);
  const held = (await quote(bike)).body.order;
  assert.equal((await inTill(bike)).freeQty, 1);
  await inShop(async () => {
    await prepare("UPDATE c2w_orders SET stage = 'collected' WHERE id = ?").run(held.id);
    await prepare('UPDATE products SET stock_qty = stock_qty - 1 WHERE id = ?').run(bike);
  });
  assert.equal((await inTill(bike)).freeQty, 1);
});

// Already true before this piece (Stock's list counts in-stock frames only); kept so it stays true.
test('5.4 Stock’s row for a bike counts only the frames free to sell', async () => {
  const bike = await framedBike(2);
  await quote(bike);
  const rows = (await own(`/api/stock-list?search=${encodeURIComponent('[Bike]')}`)).body.rows;
  assert.equal(rows.find((r) => r.id === bike).framesInStock, 1);
});

test('5.4 the product page says whose order a held frame is for and until when (st-product-bike: “Held for [Customer] until [date]”)', async () => {
  const bike = await framedBike(2);
  const held = (await quote(bike)).body.order;
  const page = (await own(`/api/products/${bike}`)).body;
  const [free, kept] = page.frames;
  assert.deepEqual([free.state, free.heldFor], ['in_stock', null]);
  assert.equal(kept.state, 'held');
  assert.deepEqual(kept.heldFor, { orderId: held.id, customerId: maya.id, customerName: 'Maya Patel', until: '2026-09-08' });
});

// Shopify (ws-shopify-connect; walk-through 5 M4): a held bike is sold out online, by frame or by count.
const online = async (bike) => inShop(async () => {
  await prepare('UPDATE products SET show_online = true WHERE id = ?').run(bike);
  return (await productsToSend([bike]))[0].stock;
});

test('5.4 Shopify is sent the stock less a bike held by count, and less held frames as well', async () => {
  const bike = await countedBike(3);
  assert.equal(await online(bike), 3);
  assert.equal((await quote(bike)).body.order.held, true);
  assert.equal(await online(bike), 2, 'a bike held by count is left out of what Shopify sells');
  await inShop(async () => {
    const key = `[FRAME-${tag()}]`;
    await prepare("INSERT INTO stock_frames (product_id, site_id, frame_number, frame_key, state) VALUES (?, ?, ?, ?, 'held') RETURNING id").get(bike, site, key, key);
  });
  assert.equal(await online(bike), 1, 'a held frame and a count hold add up');
});

test('5.4 an order holding a frame is left out of what Shopify sells once, not twice', async () => {
  const bike = await framedBike(3);
  assert.equal(await online(bike), 3);
  assert.equal((await quote(bike)).body.order.held, true);
  assert.equal(await online(bike), 2, 'a frame held for an order counts once');
});

// Shopify linked and sent once (a bike also needs online() to be queued). No sender serves
// this provider, so the queue stays put for the test to read.
const linkShopify = async () => inShop(async () => prepare("INSERT INTO shopify_link (provider, address, last_sent_at) VALUES ('[no sender]', '[shop].myshopify.com', now()) ON CONFLICT (shop_id) DO UPDATE SET state = 'idle', last_sent_at = now() RETURNING shop_id").get());
const queuedFor = async (bike) => inShop(async () => Boolean(await prepare('SELECT 1 FROM shopify_changed WHERE product_id = ?').get(bike)));
const clearQueue = async (...bikes) => inShop(async () => { for (const bike of bikes) await prepare('DELETE FROM shopify_changed WHERE product_id = ?').run(bike); });

test('5.4 a hold taken or let go by count queues the bike for Shopify, as a held frame does', async () => {
  const bike = await countedBike(2);
  await online(bike);
  await linkShopify();
  const queued = () => queuedFor(bike);
  const clear = () => clearQueue(bike);
  await clear();
  const held = (await quote(bike)).body.order;
  assert.equal(held.held, true);
  assert.equal(await queued(), true, 'the hold queues the bike');
  await clear();
  await inShop(async () => prepare("UPDATE c2w_orders SET stage = 'waiting' WHERE id = ?").run(held.id));
  assert.equal(await queued(), false, 'a change that leaves the hold as it was queues nothing');
  await inShop(async () => prepare("UPDATE c2w_orders SET stage = 'cancelled' WHERE id = ?").run(held.id));
  assert.equal(await queued(), true, 'letting the hold go queues the bike');
});

test('5.4 a count hold moved to another bike queues both bikes for Shopify', async () => {
  const [from, to] = [await countedBike(2), await countedBike(2)];
  await online(from);
  await online(to);
  await linkShopify();
  const held = (await quote(from)).body.order;
  assert.equal(held.held, true);
  await clearQueue(from, to);
  await inShop(async () => prepare('UPDATE c2w_orders SET product_id = ? WHERE id = ?').run(to, held.id));
  assert.equal(await queuedFor(from), true, 'the bike let go is queued');
  assert.equal(await queuedFor(to), true, 'the bike now held is queued');
});

test('5.4 an order holding a bike by count, deleted, queues the bike for Shopify', async () => {
  const bike = await countedBike(2);
  await online(bike);
  await linkShopify();
  const held = (await quote(bike)).body.order;
  assert.equal(held.held, true);
  await clearQueue(bike);
  await inShop(async () => {
    // Its events first: they point at the order, with no cascade.
    await prepare('DELETE FROM c2w_order_events WHERE order_id = ?').run(held.id);
    await prepare('DELETE FROM c2w_orders WHERE id = ?').run(held.id);
  });
  assert.equal(await queuedFor(bike), true, 'the deleted hold queues the bike');
});
