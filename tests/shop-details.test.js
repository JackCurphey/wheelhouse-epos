// Shop details (Jack, 18 Oct, docs/decisions/2026-10-18-shop-details.md;
// openspec/changes/shop-details design.md's contract): one set of details for
// the whole business, for now - name, address, phone, email, VAT number.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let a;
let b;
// The sign-up helper makes each test shop's name unique, so read it back.
let aName;
let bName;
before(async () => {
  server = await startLiveServer();
  a = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  b = await staffSignup(server.baseUrl, { shopName: 'Other Cycles' });
  aName = (await staffRequest(server.baseUrl, a.cookie, '/api/auth/me')).body.shopName;
  bName = (await staffRequest(server.baseUrl, b.cookie, '/api/auth/me')).body.shopName;
});
after(async () => {
  if (a) await deleteTestShop(a.shop.id);
  if (b) await deleteTestShop(b.shop.id);
  if (server) await server.stop();
  await pool.end();
});
const as = (who) => (path, options) => staffRequest(server.baseUrl, who.cookie, path, options);

test('a new shop has its name and no details yet', async () => {
  const res = await as(a)('/api/shop-details');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(res.body, { name: aName, address: null, phone: null, email: null, vatNumber: null });
});

test('details save trimmed, a field left out keeps its value, and blank clears one', async () => {
  const put = (body) => as(a)('/api/shop-details', { method: 'PUT', body });
  const first = await put({ address: '  [Shop address]  ', phone: '[shop phone]', vatNumber: '[VAT number]' });
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.deepEqual(first.body, { name: aName, address: '[Shop address]', phone: '[shop phone]', email: null, vatNumber: '[VAT number]' });
  const second = await put({ email: '[email address]', vatNumber: '   ' });
  assert.deepEqual(second.body, { name: aName, address: '[Shop address]', phone: '[shop phone]', email: '[email address]', vatNumber: null });
  assert.deepEqual((await as(a)('/api/shop-details')).body, second.body);
});

test('the name can change but can’t be blank; over-long text is refused', async () => {
  const put = (body) => as(a)('/api/shop-details', { method: 'PUT', body });
  const blank = await put({ name: '  ' });
  assert.equal(blank.status, 400);
  assert.equal(blank.body.error, 'The shop needs a name');
  const long = await put({ phone: '0'.repeat(41) });
  assert.equal(long.status, 400);
  assert.match(long.body.error, /Phone/);
  const renamed = await put({ name: 'North Street Cycles Ltd' });
  assert.equal(renamed.status, 200, JSON.stringify(renamed.body));
  assert.equal(renamed.body.name, 'North Street Cycles Ltd');
  assert.equal((await as(a)('/api/auth/me')).body.shopName, 'North Street Cycles Ltd');
  await put({ name: aName });
});

test('one shop never sees or changes another’s details', async () => {
  await as(a)('/api/shop-details', { method: 'PUT', body: { phone: '[shop phone]' } });
  await as(b)('/api/shop-details', { method: 'PUT', body: { phone: '[other phone]' } });
  assert.equal((await as(a)('/api/shop-details')).body.phone, '[shop phone]');
  assert.equal((await as(b)('/api/shop-details')).body.phone, '[other phone]');
  assert.equal((await as(b)('/api/shop-details')).body.name, bName);
});
