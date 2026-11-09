// Bike warranties (openspec/changes/finish-customers, design 6; Jack's 9 Nov answers 3 and 4,
// questions 15 and 19; the server's clock is pinned to 1 Sep 2026,
// and option 3 of the bike question): the Owner lists brands in Settings › Stockroom, each with
// Frame, Components and Electronics lines of whole years or Lifetime; a product holds a brand,
// matched to the list by name ignoring capitals and spaces at either end, is an e-bike by its
// category's mark, and can have its own lines in place of its brand's (question 17). Names from
// the drawings: Trek, Cube, the Trek Domane AL 3, Jack Lewis, Jo Taylor; the rest bracketed.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import '../server/load-env.js';
import { pool, runWithShop, prepare, dbExec } from '../server/db.js';
import { bikeSoldTo, monthsTo, yearsOn } from '../server/lib/bike-warranty.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let owner;
let other;
let jo;
before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  other = await staffSignup(server.baseUrl, { shopName: '[Other shop]' });
  const made = await staffRequest(server.baseUrl, owner.cookie, '/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `jo-${randomUUID().slice(0, 8)}@example.test`, password: 'password123' } });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  jo = await staffFreshCookie(made.body.loginId);
  for (const shop of [owner.shop, other.shop]) {
    await runWithShop(shop.id, async () => {
      const top = (await prepare("INSERT INTO product_categories (name, path, bike_kind) VALUES ('Bikes', 'Bikes', 'bikes') RETURNING id").get()).id;
      await prepare("INSERT INTO product_categories (parent_id, name, path, bike_kind) VALUES (?, 'E-bikes', 'Bikes › E-bikes', 'ebikes')").run(top);
    });
  }
});
after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (other) await deleteTestShop(other.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const asOwner = (path, options) => staffRequest(server.baseUrl, owner.cookie, path, options);
const asJo = (path, options) => staffRequest(server.baseUrl, jo, path, options);
const asOther = (path, options) => staffRequest(server.baseUrl, other.cookie, path, options);
const LIFETIME = null;
const lines = (frame, components, electronics) => [
  ...(frame !== undefined ? [{ part: 'frame', years: frame }] : []),
  ...(components !== undefined ? [{ part: 'components', years: components }] : []),
  ...(electronics !== undefined ? [{ part: 'electronics', years: electronics }] : []),
];
const addBrand = (brand, l, as = asOwner) => as('/api/bike-warranties', { method: 'POST', body: { brand, lines: l } });
const product = async (body, as = asOwner) => {
  const res = await as('/api/products', { method: 'POST', body: { sku: `[Supplier code]-${randomUUID().slice(0, 6)}`, price: 28, ...body } });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body;
};
const page = async (id, as = asOwner) => (await as(`/api/products/${id}`)).body;

test('the Owner lists Trek and Cube with their lines; capitals ignored; Staff read only', async () => {
  const trek = await addBrand('Trek', lines(LIFETIME, 2, 2));
  assert.equal(trek.status, 201, JSON.stringify(trek.body));
  assert.equal((await addBrand(' Cube ', lines(10, 2))).status, 201);
  assert.deepEqual((await asOwner('/api/bike-warranties')).body.brands.map((b) => [b.brand, b.lines]), [
    ['Cube', [{ part: 'frame', years: 10 }, { part: 'components', years: 2 }]],
    ['Trek', [{ part: 'frame', years: null }, { part: 'components', years: 2 }, { part: 'electronics', years: 2 }]],
  ]);
  const twice = await addBrand('trek', lines(5));
  assert.equal(twice.status, 409);
  assert.equal(twice.body.error, 'Trek is already listed');

  // Jo sees them and can't change them.
  assert.equal((await asJo('/api/bike-warranties')).body.brands.length, 2);
  assert.equal((await addBrand('[Brand]', lines(1), asJo)).status, 403);
  assert.equal((await asJo(`/api/bike-warranties/${trek.body.id}`, { method: 'PUT', body: { brand: 'Trek', lines: lines(1) } })).status, 403);

  // The Owner changes Trek's lines; the brand's name too, but not onto another listed one.
  const changed = await asOwner(`/api/bike-warranties/${trek.body.id}`, { method: 'PUT', body: { brand: 'Trek', lines: lines(LIFETIME, 3) } });
  assert.equal(changed.status, 200, JSON.stringify(changed.body));
  assert.deepEqual(changed.body.lines, [{ part: 'frame', years: null }, { part: 'components', years: 3 }]);
  assert.equal((await asOwner(`/api/bike-warranties/${trek.body.id}`, { method: 'PUT', body: { brand: 'CUBE', lines: lines(1) } })).status, 409);
  assert.equal((await asOwner('/api/bike-warranties/999999', { method: 'PUT', body: { brand: 'Trek', lines: lines(1) } })).status, 404);
  await asOwner(`/api/bike-warranties/${trek.body.id}`, { method: 'PUT', body: { brand: 'Trek', lines: lines(LIFETIME, 2, 2) } });

  // Another business sees none of them, and can list its own Trek.
  assert.deepEqual((await asOther('/api/bike-warranties')).body.brands, []);
  assert.equal((await addBrand('Trek', lines(1), asOther)).status, 201);
});

test('a line is whole years from 1 to 50 or Lifetime, each part once, and a brand has a name', async () => {
  const refused = 'Type whole years, from 1 to 50, or choose Lifetime';
  for (const years of [0, -1, 1.5, 51, '2', true]) {
    const res = await addBrand(`[Brand ${years}]`, lines(years));
    assert.equal(res.status, 400, String(years));
    assert.equal(res.body.error, refused);
  }
  assert.equal((await addBrand('[Brand]', [{ part: 'saddle', years: 1 }])).status, 400);
  assert.equal((await addBrand('[Brand]', [{ part: 'frame', years: 1 }, { part: 'frame', years: 2 }])).status, 400);
  assert.equal((await addBrand('[Brand]', 'frame')).status, 400);
  assert.equal((await addBrand('  ', lines(1))).status, 400);
  assert.equal((await addBrand('[Brand 50]', lines(50))).status, 201);
  assert.equal((await addBrand('[No lines]', [])).status, 201, 'a brand with no lines yet');
});

test('a product’s brand matches the list ignoring capitals and spaces; its warranty is its brand’s; Electronics only for an e-bike', async () => {
  const road = await product({ name: 'Trek Domane AL 3', category: 'Bikes', brand: '  trek ' });
  assert.equal(road.brand, 'trek', 'kept as typed, trimmed');
  assert.equal(road.isEbike, false);
  let p = await page(road.id);
  assert.deepEqual(p.warranty, { own: false, brand: 'Trek', lines: [{ part: 'frame', years: null }, { part: 'components', years: 2 }] });

  const ebike = await product({ name: '[Trek e-bike]', category: 'Bikes › E-bikes', brand: 'Trek' });
  assert.equal(ebike.isEbike, true);
  assert.deepEqual((await page(ebike.id)).warranty.lines.map((l) => l.part), ['frame', 'components', 'electronics']);

  // A brand not in the list, or none: the brand shows and no warranty.
  const unknown = await product({ name: '[Bike]', category: 'Bikes', brand: '[Brand not listed]' });
  assert.equal((await page(unknown.id)).brand, '[Brand not listed]');
  assert.equal((await page(unknown.id)).warranty, null);
  assert.equal((await page((await product({ name: '[Bike]', category: 'Bikes' })).id)).warranty, null);

  // Changing the brand on Edit; Staff with the product editor can, as any detail.
  const res = await asOwner(`/api/products/${unknown.id}`, { method: 'PUT', body: { brand: 'Cube' } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.brand, 'Cube');
  assert.deepEqual((await page(unknown.id)).warranty.lines, [{ part: 'frame', years: 10 }, { part: 'components', years: 2 }]);
  assert.equal((await asOwner(`/api/products/${unknown.id}`, { method: 'PUT', body: { name: '[Renamed]' } })).body.brand, 'Cube', 'a save without a brand keeps it');
  assert.equal((await asOwner(`/api/products/${unknown.id}`, { method: 'PUT', body: { brand: '' } })).body.brand, null, 'cleared');
  assert.equal((await asOwner(`/api/products/${unknown.id}`, { method: 'PUT', body: { brand: 'x'.repeat(61) } })).status, 400);

  // Another business's Trek lines are never this business's.
  const theirs = await product({ name: '[Their Trek]', category: 'Bikes', brand: 'Trek' }, asOther);
  assert.deepEqual((await page(theirs.id, asOther)).warranty.lines, [{ part: 'frame', years: 1 }]);
  p = await page(road.id);
  assert.deepEqual(p.warranty.lines, [{ part: 'frame', years: null }, { part: 'components', years: 2 }]);
});

test('a model’s own lines replace its brand’s, set by the Owner and put back to its brand’s', async () => {
  const cube = await product({ name: '[Cube model]', category: 'Bikes', brand: 'Cube' });
  const sibling = await product({ name: '[Other Cube model]', category: 'Bikes', brand: 'Cube' });
  const own = (id, l, as = asOwner) => as(`/api/products/${id}/warranty`, { method: 'PUT', body: { lines: l } });
  assert.equal((await own(cube.id, lines(LIFETIME, 2), asJo)).status, 403);
  assert.equal((await own(cube.id, lines(0))).status, 400);
  const set = await own(cube.id, lines(LIFETIME, 2));
  assert.equal(set.status, 200, JSON.stringify(set.body));
  assert.deepEqual(set.body.warranty, { own: true, brand: 'Cube', lines: [{ part: 'frame', years: null }, { part: 'components', years: 2 }] });
  assert.deepEqual((await page(cube.id)).warranty, set.body.warranty);
  assert.equal((await page(sibling.id)).warranty.own, false, 'other Cube models keep Cube’s');
  assert.deepEqual((await page(sibling.id)).warranty.lines[0], { part: 'frame', years: 10 });

  // Own lines hold with no brand listed, too; null puts it back to its brand's.
  const back = await own(cube.id, null);
  assert.equal(back.status, 200);
  assert.deepEqual(back.body.warranty, { own: false, brand: 'Cube', lines: [{ part: 'frame', years: 10 }, { part: 'components', years: 2 }] });
  const plain = await product({ name: '[Unbranded]', category: 'Bikes' });
  assert.deepEqual((await own(plain.id, lines(5))).body.warranty, { own: true, brand: null, lines: [{ part: 'frame', years: 5 }] });

  // Another business's product isn't found.
  assert.equal((await own(cube.id, lines(1), asOther)).status, 404);
});

// A bike sold through Wheelhouse (bikeSoldTo; not called from any sale until the till's half).
const deliver = (body) => asJo('/api/deliveries/receive', { method: 'POST', body });
const frame = () => `[frame ${randomUUID().slice(0, 8)}]`;
let supplierId;
let maya;
async function bookedIn(productId, frames) {
  if (!supplierId) supplierId = await runWithShop(owner.shop.id, async () => (await prepare("INSERT INTO suppliers (name, adapter_type, config, updated_at) VALUES ('[Supplier]', 'mock_csv', '{}', now())").run()).lastInsertRowid);
  const res = await deliver({ supplierId, items: [{ productId, qty: frames.length, frames }] });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return runWithShop(owner.shop.id, async () => Promise.all(frames.map(async (f) => (await prepare('SELECT id FROM stock_frames WHERE frame_number = ?').get(f)).id)));
}
const sell = (frameId, soldOn = '2026-08-01', customerId = maya.id) => runWithShop(owner.shop.id, async () => {
  await dbExec('BEGIN');
  try {
    const out = await bikeSoldTo(customerId, frameId, soldOn);
    await dbExec('COMMIT');
    return out;
  } catch (err) {
    await dbExec('ROLLBACK');
    throw err;
  }
});
const bikeLines = (bikeId) => runWithShop(owner.shop.id, async () => (await prepare("SELECT part, to_char(ends_on, 'YYYY-MM-DD') AS ends_on FROM bike_warranty_lines WHERE customer_bike_id = ? ORDER BY array_position(ARRAY['frame','components','electronics'], part)").all(bikeId)).map((l) => [l.part, l.ends_on]));

test('bikeSoldTo: a frame booked in becomes Maya’s bike, bought here, with Trek’s lines from that day', async () => {
  maya = (await asOwner('/api/customers', { method: 'POST', body: { name: 'Maya Patel' } })).body;
  const trek = await product({ name: 'Trek Domane AL 3', category: 'Bikes', brand: 'Trek' });
  const [f1, f2] = [frame(), frame()];
  const [frame1, frame2] = await bookedIn(trek.id, [f1, f2]);

  const sold = await sell(frame1);
  assert.ok(sold.bikeId, JSON.stringify(sold));
  const bike = await runWithShop(owner.shop.id, () => prepare("SELECT customer_id, make, model, serial_number, to_char(bought_here_on, 'YYYY-MM-DD') AS bought, is_ebike, warranty_brand, warranty_product_id FROM customer_bikes WHERE id = ?").get(sold.bikeId));
  assert.deepEqual(bike, { customer_id: maya.id, make: 'Trek', model: 'Trek Domane AL 3', serial_number: f1, bought: '2026-08-01', is_ebike: false, warranty_brand: 'Trek', warranty_product_id: trek.id });
  const f = await runWithShop(owner.shop.id, () => prepare('SELECT state, customer_id, customer_bike_id, sold_at IS NOT NULL AS sold FROM stock_frames WHERE id = ?').get(frame1));
  assert.deepEqual(f, { state: 'sold', customer_id: maya.id, customer_bike_id: sold.bikeId, sold: true });
  assert.deepEqual(await bikeLines(sold.bikeId), [['frame', null], ['components', '2028-08-01']], 'no Electronics: not an e-bike');

  // Her bike already in Wheelhouse with that frame number, typed differently, is reused.
  const hers = (await asJo(`/api/customers/${maya.id}/bikes`, { method: 'POST', body: { make: 'Trek', serialNumber: f2.toUpperCase().replace(" ", "  ") } })).body;
  assert.equal((await sell(frame2)).bikeId, hers.id);
  assert.deepEqual(await bikeLines(hers.id), [['frame', null], ['components', '2028-08-01']]);

  // A frame already sold, or another business's, isn't sold again.
  assert.match((await sell(frame1)).error, /sold/);
  const theirs = await runWithShop(other.shop.id, async () => (await prepare("INSERT INTO products (sku, name, category, price, cost, stock_qty, updated_at) VALUES ('[sku]', '[Bike]', 'Bikes', 1, 1, 0, now()) RETURNING id").get()).id);
  const theirFrame = await runWithShop(other.shop.id, async () => (await prepare("INSERT INTO stock_frames (product_id, frame_number, frame_key) VALUES (?, '[frame]', '[FRAME]') RETURNING id").get(theirs)).id);
  assert.match((await sell(theirFrame)).error, /not found/i);
});

test('an e-bike adds Electronics; Cube’s frame runs ten years; a sold bike keeps its lines when Trek’s change', async () => {
  const ebike = await product({ name: '[Trek e-bike]', category: 'Bikes › E-bikes', brand: 'Trek' });
  const cube = await product({ name: '[Cube model]', category: 'Bikes', brand: 'cube' });
  const [e1] = await bookedIn(ebike.id, [frame()]);
  const [c1] = await bookedIn(cube.id, [frame()]);
  const e = await sell(e1);
  assert.deepEqual(await bikeLines(e.bikeId), [['frame', null], ['components', '2028-08-01'], ['electronics', '2028-08-01']]);
  assert.equal((await runWithShop(owner.shop.id, () => prepare('SELECT is_ebike FROM customer_bikes WHERE id = ?').get(e.bikeId))).is_ebike, true);
  const c = await sell(c1, '2026-02-28');
  assert.deepEqual(await bikeLines(c.bikeId), [['frame', '2036-02-28'], ['components', '2028-02-28']]);

  const trekId = (await asOwner('/api/bike-warranties')).body.brands.find((b) => b.brand === 'Trek').id;
  await asOwner(`/api/bike-warranties/${trekId}`, { method: 'PUT', body: { brand: 'Trek', lines: lines(LIFETIME, 3, 2) } });
  assert.deepEqual(await bikeLines(e.bikeId), [['frame', null], ['components', '2028-08-01'], ['electronics', '2028-08-01']], 'unchanged');
  const [e2] = await bookedIn(ebike.id, [frame()]);
  assert.deepEqual((await bikeLines((await sell(e2)).bikeId))[1], ['components', '2029-08-01'], 'sold after: three years');
  await asOwner(`/api/bike-warranties/${trekId}`, { method: 'PUT', body: { brand: 'Trek', lines: lines(LIFETIME, 2, 2) } });
});

test('Edit’s Bought here on: a brand and e-bike write the lines, changing rewrites them, clearing removes them, never in the future', async () => {
  const bike = (await asJo(`/api/customers/${maya.id}/bikes`, { method: 'POST', body: { make: 'Trek', model: 'Domane AL 3' } })).body;
  const edit = (body) => asJo(`/api/bikes/${bike.id}`, { method: 'PUT', body });
  const warrantyOf = async () => (await asJo(`/api/bikes/${bike.id}`)).body.warranty;
  assert.equal(await warrantyOf(), null, 'a bike from elsewhere');
  assert.equal((await asJo(`/api/customers/${maya.id}/bikes`)).body.find((b) => b.id === bike.id).warranty, null);

  let res = await edit({ boughtHereOn: '2026-01-15', warrantyBrand: ' trek ' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const expected = { boughtHereOn: '2026-01-15', brand: 'Trek', running: true, endedOn: null, lines: [
    { part: 'frame', endsOn: null, monthsLeft: null, ended: false },
    { part: 'components', endsOn: '2028-01-15', monthsLeft: 16, ended: false },
  ] };
  assert.deepEqual(await warrantyOf(), expected);
  assert.deepEqual((await asJo(`/api/customers/${maya.id}/bikes`)).body.find((b) => b.id === bike.id).warranty, expected, 'the customer page’s Bikes too');
  assert.equal((await edit({ colour: '[Colour]' })).status, 200);
  assert.deepEqual(await warrantyOf(), expected, 'a save without them leaves the lines');

  res = await edit({ isEbike: true });
  assert.deepEqual((await warrantyOf()).lines.map((l) => l.part), ['frame', 'components', 'electronics']);
  // A model with its own lines: those, not Trek's.
  const model = await product({ name: '[Trek model]', category: 'Bikes', brand: 'Trek' });
  await asOwner(`/api/products/${model.id}/warranty`, { method: 'PUT', body: { lines: lines(5) } });
  await edit({ warrantyProductId: model.id, isEbike: false });
  assert.deepEqual((await warrantyOf()).lines, [{ part: 'frame', endsOn: '2031-01-15', monthsLeft: 52, ended: false }]);
  assert.equal((await edit({ warrantyProductId: 999999 })).status, 400);

  // Under a month left; a line ended; every line ended; a brand not listed.
  await edit({ warrantyProductId: null, boughtHereOn: '2024-09-20' });
  assert.deepEqual((await warrantyOf()).lines[1], { part: 'components', endsOn: '2026-09-20', monthsLeft: 0, ended: false });
  await edit({ boughtHereOn: '2024-08-15' });
  const ended = await warrantyOf();
  assert.deepEqual([ended.running, ended.lines[1]], [true, { part: 'components', endsOn: '2026-08-15', monthsLeft: null, ended: true }]);
  await asOwner('/api/bike-warranties', { method: 'POST', body: { brand: '[Short brand]', lines: lines(1, 1) } });
  await edit({ warrantyBrand: '[Short brand]', boughtHereOn: '2024-01-10' });
  assert.deepEqual(await warrantyOf(), { boughtHereOn: '2024-01-10', brand: '[Short brand]', running: false, endedOn: '2025-01-10', lines: [
    { part: 'frame', endsOn: '2025-01-10', monthsLeft: null, ended: true }, { part: 'components', endsOn: '2025-01-10', monthsLeft: null, ended: true },
  ] });
  await edit({ warrantyBrand: '[Brand not listed]' });
  assert.deepEqual(await warrantyOf(), { boughtHereOn: '2024-01-10', brand: null, running: false, endedOn: null, lines: [] });

  // Not a sensible date; cleared.
  for (const day of ['2026-09-02', '2026-02-30', 'yesterday']) {
    res = await edit({ boughtHereOn: day });
    assert.equal(res.status, 400, day);
  }
  assert.equal((await edit({ boughtHereOn: '2026-09-02' })).body.error, 'Bought here on can’t be in the future');
  await edit({ boughtHereOn: null });
  assert.equal(await warrantyOf(), null);
  assert.deepEqual(await bikeLines(bike.id), []);
});

test('months left are whole calendar months, rounded down; years on keeps the day, 29 Feb becoming the 28th', () => {
  assert.equal(monthsTo('2026-09-15', '2028-01-15'), 16);
  assert.equal(monthsTo('2026-09-15', '2028-01-14'), 15);
  assert.equal(monthsTo('2026-09-15', '2026-10-14'), 0, 'less than a month left');
  assert.equal(monthsTo('2026-09-30', '2026-10-31'), 1);
  assert.equal(yearsOn('2026-08-01', 2), '2028-08-01');
  assert.equal(yearsOn('2024-02-29', 1), '2025-02-28');
  assert.equal(yearsOn('2024-02-29', 4), '2028-02-29');
});
