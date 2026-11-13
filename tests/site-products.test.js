// The customer website's product routes (openspec/changes/website-browse,
// design 2 and 3, tasks 2.1–2.8): a category's products with its filters, a
// product page, suggestions and search, with one stock line for the chosen shop.
import '../server/load-env.js';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';
import { runWithShop, prepare, pool } from '../server/db.js';

let server;
let north;
let south;
let visitor = 0;
// Each test is its own visitor address, so the rate limit test is the only one that meets it.
const nextVisitor = () => `203.0.113.${++visitor}`;
const ids = {};

before(async () => {
  server = await startLiveServer({ env: { TRUST_PROXY: '1' } });
  north = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  south = await staffSignup(server.baseUrl, { shopName: 'South Road Bikes' });

  await runWithShop(north.shop.id, async () => {
    const one = (sql, ...args) => prepare(sql).get(...args);
    await prepare("UPDATE sites SET name = 'Bolton', code = 'B'").run();
    ids.bolton = (await one('SELECT id FROM sites')).id;
    ids.bury = (await one("INSERT INTO sites (name, code) VALUES ('Bury', 'BY') RETURNING id")).id;
    const category = async (name, path, parent = null) => (await one('INSERT INTO product_categories (parent_id, name, path) VALUES (?, ?, ?) RETURNING id', parent, name, path)).id;
    const detail = async (cat, name, kind, unit, position, choices = []) => (await one(
      'INSERT INTO category_details (category_id, name, kind, unit, position, choices) VALUES (?, ?, ?, ?, ?, ?::text[]) RETURNING id', cat, name, kind, unit, position, choices
    )).id;
    const answer = (detailId, productId, value) => (typeof value === 'number'
      ? prepare('INSERT INTO product_details (detail_id, product_id, value_number, value_key) VALUES (?, ?, ?, ?) RETURNING product_id').get(detailId, productId, value, Math.round(value * 10000))
      : prepare('INSERT INTO product_details (detail_id, product_id, value_text) VALUES (?, ?, ?) RETURNING product_id').get(detailId, productId, value));
    const stock = (siteId, productId, qty) => prepare('INSERT INTO product_stock (site_id, product_id, qty) VALUES (?, ?, ?) RETURNING product_id').get(siteId, productId, qty);
    let minute = 0;
    const product = async (p) => { const sku = p.sku ?? `[sku ${p.name}${p.size ?? ''}${p.colour ?? ''}]`; return (await one(
      `INSERT INTO products (sku, name, brand, category, price, cost, supplier, barcode, description, photo_url, show_online, active, group_id, size, colour, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 7, '[Supplier]', ?, ?, ?, ?, ?, ?, ?, ?, ?::timestamptz, now()) RETURNING id`,
      sku, p.name, p.brand ?? null, p.category, p.price, `[barcode ${sku}]`,
      p.description ?? '', p.photo ?? null, p.online ?? true, p.active ?? 1, p.group ?? null, p.size ?? null, p.colour ?? null,
      new Date(Date.UTC(2026, 8, 1, 0, p.minute ?? minute++)).toISOString(),
    )).id; };

    // Bearings, a category with three measured details and a written one (wb-category).
    ids.bearings = await category('Bearings', 'Bearings');
    ids.inner = await detail(ids.bearings, 'Inner diameter', 'number', 'mm', 0);
    ids.outer = await detail(ids.bearings, 'Outer diameter', 'number', 'mm', 1);
    ids.material = await detail(ids.bearings, '[Material]', 'text', null, 2);
    // name, price, brand, inner, outer, material, Bolton, Bury, added (minute)
    const bearings = [
      ['A', 10, '[Brand 1]', 30, 42, '[Steel]', 2, 0, 3],
      ['B', 15, '[Brand 2]', 30, 47, '[Steel]', 0, 1, 1],
      ['C', 20, '[Brand 1]', 25, 42, '[Ceramic]', 1, 0, 7],
      ['D', 25, '[Brand 2]', 25, 47, '[Ceramic]', 0, 0, 2],
      ['E', 30, '[Brand 1]', 28, 42, '[Ceramic]', 3, 0, 5],
      ['F', 35, '[Brand 2]', 30, 42, '[Ceramic]', 0, 0, 0],
      ['G', 40, '[Brand 1]', 28, 47, '[Ceramic]', 1, 0, 6],
      ['H', 45, '[Brand 2]', 25, 42, '[Ceramic]', 0, 0, 4],
    ];
    for (const [letter, price, brand, inner, outer, material, bolton, bury, added] of bearings) {
      const id = await product({ name: `[Bearing ${letter}]`, brand, category: 'Bearings', price, minute: added });
      ids[letter] = id;
      await answer(ids.inner, id, inner);
      await answer(ids.outer, id, outer);
      await answer(ids.material, id, material);
      if (bolton) await stock(ids.bolton, id, bolton);
      if (bury) await stock(ids.bury, id, bury);
    }
    // Never on the website: switched off, archived, or no price; each has a 30 mm answer.
    for (const p of [{ online: false }, { active: 0 }, { price: 0 }]) {
      const id = await product({ name: '[Hidden bearing]', brand: '[Brand 1]', category: 'Bearings', price: 50, ...p, sku: `[hidden ${JSON.stringify(p)}]`, minute: 20 });
      await answer(ids.inner, id, 30);
      await stock(ids.bolton, id, 5);
    }

    // Drivetrain, a parent category, and Derailleurs beneath it (wb-category-parent, wb-category-child).
    ids.drivetrain = await category('Drivetrain', 'Drivetrain');
    ids.derailleurs = await category('Derailleurs', 'Drivetrain › Derailleurs', ids.drivetrain);
    ids.gears = await detail(ids.derailleurs, 'Number of gears', 'number', null, 0);
    // Drivetrain passes its own detail down to Derailleurs (Stock: "A category SHALL pass its details down").
    ids.driveKind = await detail(ids.drivetrain, '[Drive kind]', 'text', null, 0);
    ids.chain = await product({ name: '[Chain]', brand: '[Brand 3]', category: 'Drivetrain', price: 12 });
    ids.mech = await product({ name: '[Rear mech]', brand: '[Brand 3]', category: 'Drivetrain › Derailleurs', price: 28 });
    await answer(ids.gears, ids.mech, 11);
    await answer(ids.driveKind, ids.chain, '[Kind 1]');
    await answer(ids.driveKind, ids.mech, '[Kind 1]');

    // Brakes: the product the drawings show, with a choice detail, cost and supplier (wb-product).
    ids.brakes = await category('Brakes', 'Brakes');
    ids.compound = await detail(ids.brakes, '[Compound]', 'choice', null, 0, ['[Resin]', '[Metal]']);
    ids.pads = await product({ sku: 'B05S-RX', name: 'Shimano brake pads B05S-RX', brand: 'Shimano', category: 'Brakes', price: 28, description: '[About it]', photo: '/uploads/[pads].jpg' });
    await answer(ids.compound, ids.pads, '[Resin]');
    // An answer kept from when the pads sat in Bearings: moving a product doesn't take its old answers off.
    await answer(ids.inner, ids.pads, 30);
    await stock(ids.bolton, ids.pads, 4);
    ids.rotor = await product({ name: '[Disc rotor]', brand: 'Shimano', category: 'Brakes', price: 30 });

    // A jersey in sizes and colours (wb-product-sizes, wb-product-size-other).
    ids.jerseyGroup = (await one("INSERT INTO product_groups (name, category, description, photo_url) VALUES ('[Jersey]', '[Clothing]', '[Jersey words]', '/uploads/[jersey].jpg') RETURNING id")).id;
    ids.clothing = await category('[Clothing]', '[Clothing]');
    ids.fit = await detail(ids.clothing, '[Fit]', 'text', null, 0);
    const size = (s, colour, price, photo, extra = {}) => product({ name: '[Jersey]', brand: '[Brand 4]', category: '[Clothing]', price, group: ids.jerseyGroup, size: s, colour, photo, ...extra });
    ids.sRed = await size('S', '[Colour 1]', 30, '/uploads/[jersey 1].jpg');
    ids.mRed = await size('M', '[Colour 1]', 32, '/uploads/[jersey].jpg');
    ids.sBlue = await size('S', '[Colour 2]', 30, '/uploads/[jersey 2].jpg');
    ids.mBlueOff = await size('M', '[Colour 2]', 32, '/uploads/[jersey off].jpg', { online: false });
    await answer(ids.fit, ids.sRed, '[Fit 1]');
    await answer(ids.fit, ids.mRed, '[Fit 2]');
    await answer(ids.fit, ids.sBlue, '[Fit 1]');
    await stock(ids.bolton, ids.sRed, 1);
    await stock(ids.bolton, ids.mRed, 0);
    await stock(ids.bury, ids.mRed, 2);
    await stock(ids.bolton, ids.mBlueOff, 9);
    // A cap priced between the jersey's sizes, for Price, high to low.
    await category('[Hats]', '[Hats]');
    ids.cap = await product({ name: '[Cap]', brand: '[Brand 4]', category: '[Hats]', price: 31 });

    // Bikes: the last one at Bolton held for a Cycle to Work order, by frame and by count (wb-product-held).
    await category('[Bikes]', '[Bikes]');
    ids.framed = await product({ name: '[Framed bike]', category: '[Bikes]', price: 1000 });
    await stock(ids.bolton, ids.framed, 1);
    await prepare("INSERT INTO stock_frames (product_id, site_id, frame_number, frame_key, state) VALUES (?, ?, '[FRAME-1]', '[frame-1]', 'held')").run(ids.framed, ids.bolton);
    ids.counted = await product({ name: '[Counted bike]', category: '[Bikes]', price: 900 });
    await stock(ids.bolton, ids.counted, 1);
    const provider = (await one("INSERT INTO c2w_providers (name, commission_kind, commission_value) VALUES ('[Provider]', 'percent', 500) RETURNING id")).id;
    const customer = (await one("INSERT INTO customers (name) VALUES ('[Customer]') RETURNING id")).id;
    await prepare("INSERT INTO c2w_orders (customer_id, provider_id, product_id, site_id, held_at, stage, quote_number, total_pence, customer_code) VALUES (?, ?, ?, ?, now(), 'waiting', 1, 90000, '[code 1]')")
      .run(customer, provider, ids.counted, ids.bolton);
    // One left at Bolton: an order that has been collected, and an open one holding nothing, leave it free.
    ids.notHeld = await product({ name: '[Bike not held]', category: '[Bikes]', price: 800 });
    await stock(ids.bolton, ids.notHeld, 1);
    await prepare("INSERT INTO c2w_orders (customer_id, provider_id, product_id, site_id, held_at, stage, quote_number, total_pence, customer_code) VALUES (?, ?, ?, ?, now(), 'collected', 2, 80000, '[code 2]')")
      .run(customer, provider, ids.notHeld, ids.bolton);
    await prepare("INSERT INTO c2w_orders (customer_id, provider_id, product_id, site_id, held_at, stage, quote_number, total_pence, customer_code) VALUES (?, ?, ?, ?, NULL, 'quote', 3, 80000, '[code 3]')")
      .run(customer, provider, ids.notHeld, ids.bolton);

    // Repairs: one bookable online, one not, one switched off.
    await prepare("INSERT INTO workshop_services (name, price, price_pence, minutes, bookable_online, active, updated_at) VALUES ('Brake service', 35, 3500, 60, 1, 1, now())").run();
    await prepare("INSERT INTO workshop_services (name, price, price_pence, minutes, bookable_online, active, updated_at) VALUES ('[Brake bleed in shop]', 20, 2000, 30, 0, 1, now())").run();
    await prepare("INSERT INTO workshop_services (name, price, price_pence, minutes, bookable_online, active, updated_at) VALUES ('[Old brake job]', 20, 2000, 30, 1, 0, now())").run();
    await prepare('UPDATE workshop_settings SET show_prices_online = 1').run();
  });
  await runWithShop(south.shop.id, async () => {
    await prepare("INSERT INTO product_categories (name, path) VALUES ('Bearings', 'Bearings')").run();
    ids.southBearing = (await prepare("INSERT INTO products (sku, name, category, price, cost, show_online, active, updated_at) VALUES ('[s]', '[South bearing]', 'Bearings', 5, 1, true, 1, now()) RETURNING id").get()).id;
    ids.southSite = (await prepare('SELECT id FROM sites').get()).id;
  });
  for (const shop of [north, south]) {
    const own = (p, o) => staffRequest(server.baseUrl, shop.cookie, p, o);
    assert.equal((await own('/api/website')).status, 200);
    assert.equal((await own('/api/website/turn-on', { method: 'POST' })).status, 200);
  }
});

after(async () => {
  for (const shop of [north, south]) if (shop) await deleteTestShop(shop.shop.id);
  if (server) await server.stop();
  await pool.end();
});

function ask(path, { from = nextVisitor() } = {}) {
  const base = new URL(server.baseUrl);
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: base.hostname, port: base.port, path, method: 'GET', headers: { 'x-forwarded-for': from } }, (res) => {
      let text = '';
      res.on('data', (c) => { text += c; });
      res.on('end', () => {
        let body = null;
        try { body = JSON.parse(text); } catch { body = text; }
        resolve({ status: res.statusCode, body, headers: res.headers });
      });
    });
    req.on('error', reject);
    req.end();
  });
}
const qs = (params) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) for (const one of [v].flat()) q.append(k, String(one));
  return q.toString();
};
const site = (shop, rest, params = {}, opts) => ask(`/store/${shop.shop.slug}/api/site${rest}${Object.keys(params).length ? `?${qs(params)}` : ''}`, opts);
const ok = (res) => { assert.equal(res.status, 200, JSON.stringify(res.body)); return res.body; };
const list = (params) => site(north, '/products', params).then(ok);
const names = (answer) => answer.products.map((p) => p.name);
const letters = (answer) => names(answer).map((n) => /\[Bearing (\w)\]/.exec(n)?.[1] ?? n);
const values = (answer, detailId) => Object.fromEntries(answer.filters.details.find((d) => d.id === detailId).values.map((v) => [v.value, v.count]));
const d = (id) => `d${id}`;

test('a category lists six at a time A to Z with the total and where the next six start; hidden products never appear', async () => {
  const first = await list({ category: ids.bearings });
  assert.deepEqual(letters(first), ['A', 'B', 'C', 'D', 'E', 'F']);
  assert.equal(first.total, 8);
  assert.equal(first.after, 6);
  assert.deepEqual(first.category, { id: ids.bearings, name: 'Bearings', path: 'Bearings', parentId: null });
  const second = await list({ category: ids.bearings, after: first.after });
  assert.deepEqual(letters(second), ['G', 'H']);
  assert.equal(second.after, null);
  // A card: name, brand, price, photo and the details every one of it shares; never cost, supplier or barcode.
  const card = first.products[0];
  assert.deepEqual(Object.keys(card).sort(), ['brand', 'details', 'id', 'name', 'photo', 'priceHighPence', 'pricePence', 'stock']);
  assert.equal(card.id, ids.A);
  assert.equal(card.pricePence, 1000);
  assert.deepEqual(card.details.map((x) => [x.name, x.value, x.unit]), [['Inner diameter', 30, 'mm'], ['Outer diameter', 42, 'mm'], ['[Material]', '[Steel]', null]]);
  const text = JSON.stringify(first);
  for (const secret of ['[Supplier]', '[barcode', '[Hidden bearing]', 'cost']) assert.ok(!text.includes(secret), secret);
  // Counts leave the hidden products out too.
  assert.equal(values(first, ids.inner)[30], 3);
});

test("a category's filters come from its own details; AND between details, OR within one; counts agree with the list", async () => {
  const start = await list({ category: ids.bearings });
  assert.deepEqual(start.filters.details.map((x) => [x.name, x.kind, x.unit]), [['Inner diameter', 'number', 'mm'], ['Outer diameter', 'number', 'mm'], ['[Material]', 'text', null]]);
  assert.deepEqual(values(start, ids.inner), { 25: 3, 28: 2, 30: 3 });
  assert.deepEqual(start.filters.brands, [{ value: '[Brand 1]', count: 4 }, { value: '[Brand 2]', count: 4 }]);
  assert.deepEqual(start.filters.price, { lowPence: 1000, highPence: 4500 });

  const thirty = await list({ category: ids.bearings, [d(ids.inner)]: 30 });
  assert.deepEqual(letters(thirty), ['A', 'B', 'F']);
  assert.equal(thirty.total, 3);
  // A detail's own counts ignore its own ticks, so another value can still be added.
  assert.deepEqual(values(thirty, ids.inner), { 25: 3, 28: 2, 30: 3 });
  assert.deepEqual(values(thirty, ids.outer), { 42: 2, 47: 1 });

  const combined = await list({ category: ids.bearings, [d(ids.inner)]: [30, 25], [d(ids.outer)]: 42 });
  assert.deepEqual(letters(combined), ['A', 'C', 'F', 'H']);
  assert.equal(values(combined, ids.outer)[42], combined.total);

  assert.deepEqual(letters(await list({ category: ids.bearings, [d(ids.material)]: '[Steel]' })), ['A', 'B']);
  assert.deepEqual(letters(await list({ category: ids.bearings, brand: '[Brand 1]' })), ['A', 'C', 'E', 'G']);
  assert.deepEqual(letters(await list({ category: ids.bearings, from: 20 })).slice(0, 6), ['C', 'D', 'E', 'F', 'G', 'H']);
  assert.deepEqual(letters(await list({ category: ids.bearings, to: 20 })), ['A', 'B', 'C']);
  assert.deepEqual(letters(await list({ category: ids.bearings, from: 20, to: 30 })), ['C', 'D', 'E']);

  const ready = await list({ category: ids.bearings, ready: 1, shop: ids.bolton });
  assert.deepEqual(letters(ready), ['A', 'C', 'E', 'G']);
  assert.deepEqual(start.filters.ready, null, 'no shop chosen: the filter asks for one');
  assert.deepEqual((await list({ category: ids.bearings, shop: ids.bolton })).filters.ready, { shop: 'Bolton', count: 4 });
  const readyThirty = await list({ category: ids.bearings, ready: 1, shop: ids.bolton, [d(ids.inner)]: 30 });
  assert.deepEqual(letters(readyThirty), ['A']);
  assert.deepEqual(readyThirty.filters.ready, { shop: 'Bolton', count: 1 });
  assert.equal(values(readyThirty, ids.inner)[25], 1, 'C is the only ready 25 mm');

  const nothing = await list({ category: ids.bearings, [d(ids.inner)]: 99 });
  assert.deepEqual(nothing.products, []);
  assert.equal(nothing.total, 0);
  // A detail of another category is no filter here: it matches nothing rather than everything.
  assert.equal((await list({ category: ids.bearings, [d(ids.gears)]: 11 })).total, 0);
});

test('cards carry the stock line for the chosen shop, and none when no shop is chosen', async () => {
  const atBolton = await list({ category: ids.bearings, shop: ids.bolton });
  assert.deepEqual(atBolton.shop, { id: ids.bolton, name: 'Bolton' });
  assert.deepEqual(atBolton.products[0].stock, { line: 'ready', shop: 'Bolton' });
  assert.deepEqual(atBolton.products[1].stock, { line: 'sold-out', shop: 'Bolton' });
  const noShop = await list({ category: ids.bearings });
  assert.equal(noShop.shop, null);
  assert.deepEqual(noShop.products[0].stock, { line: 'none' });
  // A shop that isn't one of this business's is ignored.
  for (const shop of [ids.southSite, 999999, 'x']) {
    const ignored = await list({ category: ids.bearings, shop });
    assert.equal(ignored.shop, null, String(shop));
    assert.deepEqual(ignored.products[0].stock, { line: 'none' });
  }
  // With one shop, that shop is always the chosen one.
  const south1 = ok(await site(south, '/products', { category: (await ok(await site(south, '/categories')))[0].id }));
  assert.equal(south1.shop.id, ids.southSite);
  assert.deepEqual(south1.products[0].stock.line, 'sold-out');
});

test('a parent category lists its subcategories and offers only Availability, Brand and Price; a subcategory its own details', async () => {
  const parent = await list({ category: ids.drivetrain });
  assert.deepEqual(parent.types, [{ id: ids.derailleurs, name: 'Derailleurs', products: 1 }]);
  assert.deepEqual(parent.filters.details, [], 'not even its own details, which its types have too');
  assert.deepEqual(names(parent), ['[Chain]', '[Rear mech]']);
  assert.deepEqual(parent.filters.brands, [{ value: '[Brand 3]', count: 2 }]);
  const child = await list({ category: ids.derailleurs });
  assert.deepEqual(child.category, { id: ids.derailleurs, name: 'Derailleurs', path: 'Drivetrain › Derailleurs', parentId: ids.drivetrain });
  assert.deepEqual(child.types, []);
  // Its own details and those passed down from above, top of the tree first.
  assert.deepEqual(child.filters.details.map((x) => x.name), ['[Drive kind]', 'Number of gears']);
  assert.deepEqual(names(child), ['[Rear mech]']);
  assert.equal((await list({ category: ids.derailleurs, [d(ids.driveKind)]: '[Kind 1]' })).total, 1, 'a detail from above filters');
  assert.deepEqual(child.products[0].details.map((x) => x.name), ['[Drive kind]', 'Number of gears']);
  // An unknown category, or another shop's, is a page that can't be found.
  assert.equal((await site(north, '/products', { category: 999999 })).status, 404);
  assert.deepEqual((await site(south, '/products', { category: ids.bearings })).body, { error: 'We can’t find that page' });
});

test('the sorts: A to Z, price low to high and high to low, and newest', async () => {
  assert.deepEqual(letters(await list({ category: ids.bearings, sort: 'az' })), ['A', 'B', 'C', 'D', 'E', 'F']);
  assert.deepEqual(letters(await list({ category: ids.bearings, sort: 'price-asc' })), ['A', 'B', 'C', 'D', 'E', 'F']);
  // Where price and name disagree: the £30 jersey before the £31 cap, though Cap comes first A to Z.
  assert.deepEqual(names(ok(await site(north, '/search', { q: '[brand 4]', sort: 'price-asc' }))), ['[Jersey]', '[Cap]']);
  assert.deepEqual(names(ok(await site(north, '/search', { q: '[brand 4]', sort: 'az' }))), ['[Cap]', '[Jersey]']);
  // A sort that isn't one is A to Z, never a failure.
  for (const sort of ['__proto__', 'constructor', 'toString', '[nothing]']) {
    assert.deepEqual(letters(await list({ category: ids.bearings, sort })), ['A', 'B', 'C', 'D', 'E', 'F'], sort);
  }
  assert.deepEqual(letters(await list({ category: ids.bearings, sort: 'price-desc' })), ['H', 'G', 'F', 'E', 'D', 'C']);
  assert.deepEqual(letters(await list({ category: ids.bearings, sort: 'newest' })), ['C', 'G', 'E', 'H', 'A', 'D']);
  // Paging keeps the sort.
  assert.deepEqual(letters(await list({ category: ids.bearings, sort: 'newest', after: 6 })), ['B', 'F']);
});

test('a product page answers the product with its stock at the chosen shop, never cost or supplier', async () => {
  const pads = ok(await site(north, `/products/${ids.pads}`, { shop: ids.bolton }));
  assert.equal(pads.name, 'Shimano brake pads B05S-RX');
  assert.equal(pads.brand, 'Shimano');
  assert.equal(pads.pricePence, 2800);
  assert.equal(pads.description, '[About it]');
  assert.deepEqual(pads.category, { id: ids.brakes, name: 'Brakes', path: 'Brakes' });
  assert.deepEqual(pads.photos, ['/uploads/[pads].jpg']);
  // Only its category's details: never an answer left from a category it has moved out of.
  assert.deepEqual(pads.specifications, [{ name: '[Compound]', value: '[Resin]', unit: null }]);
  assert.deepEqual(pads.stock, { line: 'ready', shop: 'Bolton', qty: 4 });
  assert.deepEqual(pads.items, []);
  const text = JSON.stringify(pads);
  for (const secret of ['[Supplier]', '[barcode', 'cost', 'supplier', 'stock_qty']) assert.ok(!text.includes(secret), secret);
  // No shop chosen: no stock line.
  assert.deepEqual(ok(await site(north, `/products/${ids.pads}`)).stock, { line: 'none' });
  // An unknown shop is ignored.
  assert.deepEqual(ok(await site(north, `/products/${ids.pads}`, { shop: ids.southSite })).stock, { line: 'none' });
  // No photo: none, for the name tile.
  assert.deepEqual(ok(await site(north, `/products/${ids.rotor}`)).photos, []);
});

test('a product with sizes and colours: each with its stock line, photos with no repeats, opened from any of its sizes', async () => {
  const jersey = ok(await site(north, `/products/${ids.mRed}`, { shop: ids.bolton }));
  assert.equal(jersey.id, ids.sRed, 'a group is known by its first size');
  assert.equal(jersey.name, '[Jersey]');
  assert.equal(jersey.description, '[Jersey words]');
  assert.equal(jersey.pricePence, 3000);
  assert.equal(jersey.priceHighPence, 3200);
  assert.deepEqual(jersey.sizes, ['S', 'M']);
  assert.deepEqual(jersey.colours, ['[Colour 1]', '[Colour 2]']);
  assert.deepEqual(jersey.photos, ['/uploads/[jersey].jpg', '/uploads/[jersey 1].jpg', '/uploads/[jersey 2].jpg']);
  assert.equal(jersey.stock, null, 'the stock line waits for a size and colour');
  const item = (s, c) => jersey.items.find((i) => i.size === s && i.colour === c);
  assert.equal(jersey.items.length, 3, 'the size that is off the website is left out');
  assert.deepEqual(item('S', '[Colour 1]').stock, { line: 'ready', shop: 'Bolton', qty: 1 });
  assert.deepEqual(item('M', '[Colour 1]').stock, { line: 'elsewhere', shop: 'Bolton', at: 'Bury' });
  assert.deepEqual(item('S', '[Colour 2]').stock, { line: 'sold-out', shop: 'Bolton' });
  assert.equal(item('M', '[Colour 1]').pricePence, 3200);
  // On a category page the jersey is one card.
  const clothing = await list({ category: (await ok(await site(north, '/categories'))).find((c) => c.name === '[Clothing]').id, shop: ids.bolton });
  assert.deepEqual(clothing.products.map((p) => [p.id, p.name, p.pricePence, p.priceHighPence]), [[ids.sRed, '[Jersey]', 3000, 3200]]);
  assert.equal(clothing.total, 1);
  // Ready at Bolton, only its small red one counts: its fit and its price, not the medium's.
  const readyClothing = await list({ category: ids.clothing, shop: ids.bolton, ready: 1 });
  assert.deepEqual(readyClothing.filters.details.find((x) => x.name === '[Fit]').values, [{ value: '[Fit 1]', count: 1 }]);
  assert.deepEqual(readyClothing.filters.price, { lowPence: 3000, highPence: 3000 });
  assert.deepEqual(clothing.filters.details.find((x) => x.name === '[Fit]').values, [{ value: '[Fit 1]', count: 1 }, { value: '[Fit 2]', count: 1 }]);
  // The menu counts it once too, so its count agrees with the category page.
  assert.equal((await ok(await site(north, '/categories'))).find((c) => c.name === '[Clothing]').products, 1);
  // Price, high to low goes by its dearest size: £32 before the £31 cap.
  assert.deepEqual(names(ok(await site(north, '/search', { q: '[brand 4]', sort: 'price-desc' }))), ['[Jersey]', '[Cap]']);
  // A product with sizes is found by one size that meets every filter, not by two sizes meeting one each:
  // the £32 size is sold out at Bolton and the ready one is £30.
  const clothingId = (await ok(await site(north, '/categories'))).find((c) => c.name === '[Clothing]').id;
  assert.equal((await list({ category: clothingId, shop: ids.bolton, ready: 1, from: 32, to: 32 })).total, 0);
  assert.equal((await list({ category: clothingId, shop: ids.bolton, ready: 1, from: 30, to: 30 })).total, 1);
  assert.equal((await list({ category: clothingId, from: 31, to: 31.5 })).total, 0, 'no size costs between £31 and £31.50');
  // The size that is off the website isn't a page of its own.
  assert.equal((await site(north, `/products/${ids.mBlueOff}`)).status, 404);
});

test('the last bike held for a Cycle to Work order counts as sold out, by frame or by count', async () => {
  for (const id of [ids.framed, ids.counted]) {
    assert.deepEqual(ok(await site(north, `/products/${id}`, { shop: ids.bolton })).stock, { line: 'sold-out', shop: 'Bolton' });
  }
  const bikes = await list({ category: (await ok(await site(north, '/categories'))).find((c) => c.name === '[Bikes]').id, shop: ids.bolton, ready: 1 });
  assert.deepEqual(names(bikes), ['[Bike not held]']);
  assert.deepEqual(ok(await site(north, `/products/${ids.notHeld}`, { shop: ids.bolton })).stock, { line: 'ready', shop: 'Bolton', qty: 1 });
});

test('a product that is off the website, or another shop’s, is a page that can’t be found', async () => {
  const hidden = await runWithShop(north.shop.id, () => prepare("SELECT id FROM products WHERE name = '[Hidden bearing]'").all());
  assert.equal(hidden.length, 3);
  for (const { id } of hidden) {
    const res = await site(north, `/products/${id}`);
    assert.equal(res.status, 404);
    assert.deepEqual(res.body, { error: 'We can’t find that page' });
    // Nothing in between may keep it: the product can be back on the website a moment later.
    assert.equal(res.headers['cache-control'], 'no-store');
  }
  assert.equal((await site(south, `/products/${ids.pads}`)).status, 404);
  assert.equal((await site(north, `/products/${ids.southBearing}`)).status, 404);
  assert.equal((await site(north, '/products/abc')).status, 404);
});

test('suggestions start from the second letter and group products, repairs, categories and pages', async () => {
  const one = ok(await site(north, '/suggest', { q: 'b' }));
  assert.deepEqual(one, { products: [], repairs: [], categories: [], pages: [] });
  const brake = ok(await site(north, '/suggest', { q: 'brake', shop: ids.bolton }));
  assert.deepEqual(brake.products[0], { id: ids.pads, name: 'Shimano brake pads B05S-RX', code: 'B05S-RX', pricePence: 2800, stock: { line: 'ready', shop: 'Bolton' } });
  assert.ok(brake.products.length <= 4);
  assert.deepEqual(brake.repairs, [{ id: brake.repairs[0].id, name: 'Brake service', pricePence: 3500 }]);
  assert.deepEqual(brake.categories, [{ id: ids.brakes, name: 'Brakes', path: 'Brakes' }]);
  assert.deepEqual(brake.pages, []);
  assert.deepEqual(ok(await site(north, '/suggest', { q: 'collection' })).pages, [{ key: 'collection-returns', name: 'Collection and returns' }]);
  const none = ok(await site(north, '/suggest', { q: '[nothing like it]' }));
  assert.deepEqual(none, { products: [], repairs: [], categories: [], pages: [] });
  // A shop that hides its prices online shows the repair without one.
  await runWithShop(north.shop.id, () => prepare('UPDATE workshop_settings SET show_prices_online = 0').run());
  try {
    assert.deepEqual(ok(await site(north, '/suggest', { q: 'brake' })).repairs.map((r) => [r.name, r.pricePence]), [['Brake service', null]]);
  } finally {
    await runWithShop(north.shop.id, () => prepare('UPDATE workshop_settings SET show_prices_online = 1').run());
  }
});

// Suggestions read only the products a search could find, and every size of
// one with sizes (task 6.5): "s[colour" is in the part codes of the small
// sizes only, yet the jersey's line still counts its medium, ready at Bury.
test('a suggested product with sizes counts every size, not only the sizes that matched', async () => {
  const found = ok(await site(north, '/suggest', { q: 's[colour', shop: ids.bury })).products;
  assert.deepEqual(found, [{ id: ids.sRed, name: '[Jersey]', code: null, pricePence: 3000, stock: { line: 'ready', shop: 'Bury' } }]);
});

test('suggestions have their own limit, apart from the rest of the website', async () => {
  const from = '198.51.100.9';
  let last;
  for (let i = 0; i < 121; i++) last = await site(north, '/suggest', { q: 'br' }, { from });
  assert.equal(last.status, 429);
  assert.equal((await site(north, '/categories', {}, { from })).status, 200);
  assert.equal((await site(north, '/suggest', { q: 'br' }, { from: '198.51.100.10' })).status, 200);
});

test('search answers repairs and pages that match and products by best match, with the filters', async () => {
  const brake = ok(await site(north, '/search', { q: 'brake', shop: ids.bolton }));
  assert.deepEqual(brake.repairs.map((r) => [r.name, r.pricePence]), [['Brake service', 3500]]);
  // The name matches first, then a product found by its category.
  assert.deepEqual(names(brake), ['Shimano brake pads B05S-RX', '[Disc rotor]']);
  assert.equal(brake.total, 2);
  assert.deepEqual(brake.filters.categories, [{ id: ids.brakes, name: 'Brakes', count: 2 }]);
  assert.deepEqual(brake.filters.ready, { shop: 'Bolton', count: 1 });
  assert.equal(brake.measure, null);
  assert.deepEqual(names(ok(await site(north, '/search', { q: 'brake', sort: 'price-desc' }))), ['[Disc rotor]', 'Shimano brake pads B05S-RX']);
  assert.deepEqual(names(ok(await site(north, '/search', { q: 'brake', category: ids.brakes, ready: 1, shop: ids.bolton }))), ['Shimano brake pads B05S-RX']);
  // The categories to narrow to keep counting what was found elsewhere when a detail is ticked.
  const ticked = ok(await site(north, '/search', { q: '[brand 3]', category: ids.derailleurs, [d(ids.gears)]: 11 }));
  assert.deepEqual(names(ticked), ['[Rear mech]']);
  assert.deepEqual(ticked.filters.categories, [{ id: ids.drivetrain, name: 'Drivetrain', count: 1 }, { id: ids.derailleurs, name: 'Derailleurs', count: 1 }]);
  // The part code, a size or a colour finds it too; the supplier and barcode never do.
  assert.deepEqual(names(ok(await site(north, '/search', { q: 'B05S-RX' }))), ['Shimano brake pads B05S-RX']);
  assert.deepEqual(names(ok(await site(north, '/search', { q: '[Colour 2]' }))), ['[Jersey]']);
  assert.equal(ok(await site(north, '/search', { q: '[Supplier]' })).total, 0);
  assert.deepEqual(ok(await site(north, '/search', { q: 'returns' })).pages, [{ key: 'collection-returns', name: 'Collection and returns' }]);
});

test('"bearing 30 mm" answers Bearings with inner diameter 30 mm ticked', async () => {
  const found = ok(await site(north, '/search', { q: 'bearing 30 mm', shop: ids.bolton }));
  assert.deepEqual(found.measure, {
    category: { id: ids.bearings, name: 'Bearings' },
    detail: { id: ids.inner, name: 'Inner diameter', unit: 'mm' },
    value: 30,
  });
  assert.deepEqual(letters(found), ['A', 'B', 'F']);
  assert.equal(found.total, 3);
  assert.deepEqual(found.filters.details.map((x) => x.name), ['Inner diameter', 'Outer diameter', '[Material]']);
  // Narrowing by category counts only the bearings that measure 30 mm.
  assert.deepEqual(found.filters.categories, [{ id: ids.bearings, name: 'Bearings', count: 3 }]);
  assert.deepEqual(letters(ok(await site(north, '/search', { q: 'bearing 30mm' }))), ['A', 'B', 'F']);
});

test('a long search reads only its first eight words, so it costs no more than a short one', async () => {
  const q = `brake pads ${'shimano '.repeat(6)}[nothing like it]`;
  assert.deepEqual(names(ok(await site(north, '/search', { q }))), ['Shimano brake pads B05S-RX']);
  assert.deepEqual(ok(await site(north, '/suggest', { q })).products.map((p) => p.name), ['Shimano brake pads B05S-RX']);
  // And only the first hundred letters count: a word after them is not read.
  const cut = `brake pads${' '.repeat(90)}[nothing like it]`;
  assert.deepEqual(names(ok(await site(north, '/search', { q: cut }))), ['Shimano brake pads B05S-RX']);
  const many = 'a '.repeat(5000);
  const started = Date.now();
  assert.equal((await site(north, '/suggest', { q: many })).status, 200);
  assert.equal((await site(north, '/search', { q: many })).status, 200);
  assert.ok(Date.now() - started < 2000, `${Date.now() - started} ms`);
});

test('a search that finds nothing answers empty', async () => {
  const none = ok(await site(north, '/search', { q: '[nothing like it]' }));
  assert.deepEqual([none.products, none.repairs, none.pages, none.total, none.after, none.measure], [[], [], [], 0, null, null]);
  // Another shop's products are never found.
  assert.equal(ok(await site(south, '/search', { q: 'brake' })).total, 0);
});

test('the home page answers the newest four online products with a photo, and the repairs with prices as the booking site shows them', async () => {
  // Lights added after everything else: five with a photo, one without, one switched off.
  const lights = [];
  await runWithShop(north.shop.id, async () => {
    await prepare("INSERT INTO product_categories (name, path) VALUES ('[Lights]', '[Lights]')").run();
    const add = async (n, extra = {}) => (await prepare(
      `INSERT INTO products (sku, name, category, price, cost, photo_url, show_online, active, created_at, updated_at)
       VALUES (?, ?, '[Lights]', 10, 1, ?, ?, 1, ?::timestamptz, now()) RETURNING id`
    ).get(`[light ${n}]`, `[Light ${n}]`, extra.photo === undefined ? `/uploads/[light ${n}].jpg` : extra.photo, extra.online ?? true, new Date(Date.UTC(2026, 8, 1, 2, n)).toISOString())).id;
    for (const n of [1, 2, 3, 4, 5]) lights.push(await add(n));
    lights.push(await add(6, { photo: null }));
    lights.push(await add(7, { online: false }));
    await prepare('INSERT INTO product_stock (site_id, product_id, qty) VALUES (?, ?, 2) RETURNING product_id').get(ids.bolton, lights[4]);
  });
  try {
    const home = ok(await site(north, '/home', { shop: ids.bolton }));
    assert.deepEqual(home.featured.map((p) => p.name), ['[Light 5]', '[Light 4]', '[Light 3]', '[Light 2]']);
    assert.equal(home.featured[0].photo, '/uploads/[light 5].jpg');
    assert.equal(home.featured[0].pricePence, 1000);
    assert.deepEqual(home.featured[0].stock, { line: 'ready', shop: 'Bolton' });
    assert.deepEqual(home.featured[1].stock, { line: 'sold-out', shop: 'Bolton' });
    // Only the services booked online and switched on, priced because the shop shows prices online.
    assert.deepEqual(home.repairs, [{ id: home.repairs[0].id, name: 'Brake service', pricePence: 3500 }]);
    // Never cost or supplier.
    assert.ok(!JSON.stringify(home).includes('cost'));
    // No shop chosen: no stock line.
    assert.deepEqual(ok(await site(north, '/home')).featured[0].stock, { line: 'none' });
    await runWithShop(north.shop.id, () => prepare('UPDATE workshop_settings SET show_prices_online = 0').run());
    assert.deepEqual(ok(await site(north, '/home')).repairs.map((r) => r.pricePence), [null]);
    // Another shop's products and services are never in it.
    const southHome = ok(await site(south, '/home'));
    assert.deepEqual(southHome, { featured: [], repairs: [] });
  } finally {
    await runWithShop(north.shop.id, async () => {
      await prepare('UPDATE workshop_settings SET show_prices_online = 1').run();
      await prepare('DELETE FROM product_stock WHERE product_id = ANY(?::int[])').run(lights);
      await prepare('DELETE FROM products WHERE id = ANY(?::int[])').run(lights);
      await prepare("DELETE FROM product_categories WHERE path = '[Lights]'").run();
    });
  }
});
