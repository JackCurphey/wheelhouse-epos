// A product's details, and finding products by them (openspec/changes/product-editing;
// stock control decision 10: "bearing 30 mm" finds bearings with a 30 mm outer diameter;
// st-search-measure, st-filter-bearings, st-product's Details · [Category]). Bearings with
// Inner diameter, Outer diameter and Height in mm, and Drivetrain › Derailleurs with
// Number of gears, as drawn; Jack Lewis and Jo Taylor as drawn; the rest placeholders.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import '../server/load-env.js';
import { pool } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let owner;
let other;
let jo;
const d = {};
const p = {};
before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  other = await staffSignup(server.baseUrl);
  const made = await staffRequest(server.baseUrl, owner.cookie, '/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `${randomUUID().slice(0, 8)}@example.test`, password: 'password123' } });
  jo = { cookie: await staffFreshCookie(made.body.loginId) };
  const call = (path, method, body) => staffRequest(server.baseUrl, owner.cookie, path, { method, body });
  const bearings = (await call('/api/product-categories', 'POST', { name: 'Bearings' })).body;
  await call(`/api/product-categories/${bearings.id}`, 'PUT', { details: ['Inner diameter', 'Outer diameter', 'Height'].map((name) => ({ name, kind: 'number', unit: 'mm' })) });
  const drivetrain = (await call('/api/product-categories', 'POST', { name: 'Drivetrain' })).body;
  await call(`/api/product-categories/${drivetrain.id}`, 'PUT', { details: [{ name: '[Brand]', kind: 'text' }] });
  const derailleurs = (await call('/api/product-categories', 'POST', { name: 'Derailleurs', parentId: drivetrain.id })).body;
  await call(`/api/product-categories/${derailleurs.id}`, 'PUT', { details: [{ name: 'Number of gears', kind: 'choice', choices: ['[11]', '[12]'] }] });
  for (const c of (await call('/api/product-categories', 'GET')).body.categories) for (const x of c.details) d[x.name] = x.id;
  const add = async (key, name, category) => { p[key] = (await call('/api/products', 'POST', { name, sku: `${key}-${randomUUID().slice(0, 4)}`, category, price: 5 })).body.id; };
  await add('b30', '[Bearing A]', 'Bearings');
  await add('b32', '[Bearing B]', 'Bearings');
  await add('rd', '[Rear derailleur]', 'Drivetrain › Derailleurs');
  // A number in another unit, the same figure.
  const wheels = (await call('/api/product-categories', 'POST', { name: '[Wheels]' })).body;
  await call(`/api/product-categories/${wheels.id}`, 'PUT', { details: [{ name: '[Width]', kind: 'number', unit: 'cm' }] });
  await add('wheel', '[Wheel]', '[Wheels]');
  const width = (await call('/api/product-categories', 'GET')).body.categories.find((c) => c.id === wheels.id).details[0].id;
  await call(`/api/products/${p.wheel}/details`, 'PUT', { answers: [{ detailId: width, value: 30 }] });
});
after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (other) await deleteTestShop(other.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const as = (who, path, method = 'GET', body) => staffRequest(server.baseUrl, who.cookie, path, { method, body });
const answer = (id, answers, who = owner) => as(who, `/api/products/${id}/details`, 'PUT', { answers });
const detailsOf = async (id) => (await as(owner, `/api/products/${id}`)).body.details;
const search = async (q, extra = '') => (await as(owner, `/api/stock-list?search=${encodeURIComponent(q)}${extra}`)).body.rows.map((r) => r.id).sort((a, b) => a - b);

test('a product’s details: its category’s, and those passed down, each with its answer', async () => {
  assert.equal((await answer(p.b30, [{ detailId: d['Inner diameter'], value: '10' }, { detailId: d['Outer diameter'], value: 30 }, { detailId: d.Height, value: '9.5' }])).status, 200);
  assert.deepEqual((await detailsOf(p.b30)).map((x) => [x.name, x.unit, x.value]), [['Inner diameter', 'mm', 10], ['Outer diameter', 'mm', 30], ['Height', 'mm', 9.5]]);
  assert.equal((await answer(p.rd, [{ detailId: d['[Brand]'], value: ' [Maker] ' }, { detailId: d['Number of gears'], value: '[12]' }])).status, 200);
  assert.deepEqual((await detailsOf(p.rd)).map((x) => [x.name, x.from, x.value]), [['[Brand]', 'Drivetrain', '[Maker]'], ['Number of gears', 'Derailleurs', '[12]']]);
  assert.equal((await answer(p.b32, [{ detailId: d['Outer diameter'], value: '32' }])).status, 200);
});

test('an answer that doesn’t fit is refused, and nothing is saved', async () => {
  const refused = async (answers, why) => {
    const res = await answer(p.b30, answers);
    assert.equal(res.status, 400, JSON.stringify(res.body));
    assert.match(res.body.error, why);
  };
  await refused([{ detailId: d.Height, value: 'tall' }], /Height takes a number/);
  await refused([{ detailId: d.Height, value: '1.23456' }], /Height takes a number/);
  await refused([{ detailId: d['Number of gears'], value: '[12]' }], /isn’t one of this product’s details/);
  await refused([{ detailId: 999999999, value: '1' }], /isn’t one of this product’s details/);
  assert.equal((await answer(p.rd, [{ detailId: d['Number of gears'], value: '[13]' }])).status, 400);
  assert.deepEqual((await detailsOf(p.b30)).map((x) => x.value), [10, 30, 9.5]);
});

test('a choice is saved as the choice is written; an empty answer takes it off', async () => {
  assert.equal((await answer(p.rd, [{ detailId: d['Number of gears'], value: '[11]' }])).status, 200);
  assert.equal((await detailsOf(p.rd)).find((x) => x.name === 'Number of gears').value, '[11]');
  assert.equal((await answer(p.rd, [{ detailId: d['[Brand]'], value: '' }])).status, 200);
  assert.equal((await detailsOf(p.rd)).find((x) => x.name === '[Brand]').value, null);
});

test('staff can’t answer; another business’s product isn’t found', async () => {
  assert.equal((await answer(p.b30, [{ detailId: d.Height, value: '1' }], jo)).status, 403);
  assert.equal((await answer(p.b30, [{ detailId: d.Height, value: '1' }], other)).status, 404);
});

test('“bearing 30 mm” finds bearings with a 30 mm detail; so does “30mm”, not “30 cm”', async () => {
  assert.deepEqual(await search('bearing 30 mm'), [p.b30]);
  assert.deepEqual(await search('bearing 30mm'), [p.b30]);
  assert.deepEqual(await search('bearing 30 cm'), []);
  assert.deepEqual(await search('32 mm'), [p.b32]);
  assert.deepEqual(await search('bearing 9.5 mm'), [p.b30]);
  // The unit counts: 30 cm isn't 30 mm, written apart or together.
  assert.deepEqual(await search('30 mm'), [p.b30]);
  assert.deepEqual(await search('30mm'), [p.b30]);
  assert.deepEqual(await search('30 cm'), [p.wheel]);
  assert.deepEqual(await search('30cm'), [p.wheel]);
});

test('picking a category takes those inside it; a detail’s filter narrows it', async () => {
  assert.deepEqual(await search('', '&category=Drivetrain'), [p.rd]);
  assert.deepEqual(await search('', `&category=Bearings&d${d['Outer diameter']}=32`), [p.b32]);
  assert.deepEqual(await search('', `&category=Drivetrain&d${d['Number of gears']}=${encodeURIComponent('[11]')}`), [p.rd]);
  assert.deepEqual(await search('', `&d${d['Outer diameter']}=40`), []);
});

test('a word of digits and letters is a measurement only where a detail has that unit; otherwise, or as well, the name', async () => {
  const call = (path, method, body) => staffRequest(server.baseUrl, owner.cookie, path, { method, body });
  const add = async (key, name, category = 'Uncategorised') => { p[key] = (await call('/api/products', 'POST', { name, sku: `${key}-${randomUUID().slice(0, 4)}`, category, price: 5 })).body.id; };
  await add('tube', '[Inner tube 700c]');
  await add('niner', '[Frame 29er]');
  await add('light', '[Light 12v]');
  await add('tyre', '[Tyre 28mm]');
  assert.deepEqual(await search('700c'), [p.tube]);
  assert.deepEqual(await search('29er'), [p.niner]);
  assert.deepEqual(await search('12V'), [p.light]);
  // mm is a unit here: 28mm is a 28 mm detail, or 28mm in the name.
  assert.deepEqual(await search('28mm'), [p.tyre]);
  await call(`/api/products/${p.b32}/details`, 'PUT', { answers: [{ detailId: d.Height, value: 28 }] });
  assert.deepEqual(await search('28mm'), [p.b32, p.tyre].sort((a, b) => a - b));
  assert.deepEqual(await search('28 mm'), [p.b32, p.tyre].sort((a, b) => a - b));
});
