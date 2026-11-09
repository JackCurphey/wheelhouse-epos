// Bike warranties (openspec/changes/finish-customers, design 6; Jack's 9 Nov answers 3 and 4,
// and option 3 of the bike question): the Owner lists brands in Settings › Stockroom, each with
// Frame, Components and Electronics lines of whole years or Lifetime; a product holds a brand,
// matched to the list by name ignoring capitals and spaces at either end, is an e-bike by its
// category's mark, and can have its own lines in place of its brand's (question 17). Names from
// the drawings: Trek, Cube, the Trek Domane AL 3, Jack Lewis, Jo Taylor; the rest bracketed.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
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
  // No lines at all would read as "use the brand's", so it's refused, not saved as that (review).
  const none = await own(cube.id, []);
  assert.deepEqual([none.status, none.body.error], [400, 'Choose at least one line, or use the brand’s lines']);
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
