// Customers, the server side of the list and Add a customer
// (openspec/changes/customers-list; cs-list, cs-add, cs-add-match; customer
// service review 3, 5, 12).
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let owner;
let other;

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'Customer Cycles' });
  other = await staffSignup(server.baseUrl, { shopName: 'Elsewhere Cycles' });
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (other) await deleteTestShop(other.shop.id);
  if (server) await server.stop();
});

function staff(path, options, who = owner) {
  return staffRequest(server.baseUrl, who.cookie, path, options);
}
const add = async (body, who = owner) => (await staff('/api/customers', { method: 'POST', body }, who)).body;

test('adding keeps the address, postcode and offers, and reads them back', async () => {
  const maya = await add({ name: 'Maya Patel', phone: '07700 900142', address: '12 North Street, Bolton', postcode: 'BL1 2AB', marketingPermission: true });
  assert.equal(maya.address, '12 North Street, Bolton');
  assert.equal(maya.postcode, 'BL1 2AB');
  assert.equal(maya.marketingPermission, true);
  const read = (await staff(`/api/customers/${maya.id}`)).body;
  assert.deepEqual([read.address, read.postcode, read.marketingPermission], ['12 North Street, Bolton', 'BL1 2AB', true]);
  const plain = await add({ name: 'Sam Reed', phone: '07700 900500' });
  assert.equal(plain.marketingPermission, false, 'offers start off');
  assert.equal(plain.address, null);
});

test('recent customers: the newest job or change first', async () => {
  const older = await add({ name: 'Oliver Chen', phone: '07700 900600' });
  const newer = await add({ name: 'Aisha Khan', phone: '07700 900700' });
  // Oliver gets a job now, so he was seen most recently.
  await runWithShop(owner.shop.id, () => prepare("UPDATE customers SET updated_at = now() - interval '2 days' WHERE id IN (?, ?)").run(older.id, newer.id));
  await runWithShop(owner.shop.id, () => prepare("UPDATE customers SET updated_at = now() - interval '1 day' WHERE id = ?").run(newer.id));
  await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Gear tune', jobDate: '2026-09-20', customerId: older.id } });
  const ids = (await staff('/api/recent-customers')).body.map((c) => c.id);
  assert.ok(ids.indexOf(older.id) >= 0 && ids.indexOf(older.id) < ids.indexOf(newer.id), JSON.stringify(ids));
});

test('a recent customer carries their newest bike', async () => {
  const lena = await add({ name: 'Lena Fox', phone: '07700 900800' });
  await runWithShop(owner.shop.id, async () => {
    await prepare("INSERT INTO customer_bikes (customer_id, make, model, created_at) VALUES (?, 'Giant', 'Escape 2', now() - interval '1 year')").run(lena.id);
    await prepare("INSERT INTO customer_bikes (customer_id, make, model) VALUES (?, 'Cube', 'Attain')").run(lena.id);
  });
  const row = (await staff('/api/recent-customers')).body.find((c) => c.id === lena.id);
  assert.equal(row.bikeLabel, 'Cube Attain');
  assert.equal(row.phone, '07700 900800');
});

test('a match by phone however it’s spaced, or by email; not a removed one or another shop’s', async () => {
  const jamie = await add({ name: 'Jamie Brooks', phone: '07700 900300', email: 'jamie@example.com' });
  const match = async (q, who) => (await staff(`/api/customer-matches?${new URLSearchParams(q)}`, {}, who)).body;
  assert.deepEqual((await match({ phone: '07700900300' })).map((c) => c.id), [jamie.id]);
  assert.deepEqual((await match({ phone: '07700 900 300' })).map((c) => c.id), [jamie.id]);
  assert.deepEqual((await match({ email: 'JAMIE@example.com' })).map((c) => c.id), [jamie.id]);
  assert.deepEqual(await match({ phone: '0770' }), [], 'too short to be a number');
  assert.deepEqual(await match({ phone: '07700 900300' }, other), [], 'another shop’s');
  const m = (await match({ phone: '07700900300' }))[0];
  assert.deepEqual([m.name, m.phone], ['Jamie Brooks', '07700 900300']);
  assert.equal((await staff(`/api/customers/${jamie.id}`, { method: 'DELETE' })).status < 300, true);
  assert.deepEqual(await match({ phone: '07700900300' }), [], 'removed');
});

test('the header search finds a customer by postcode, however it’s typed', async () => {
  const priya = await add({ name: 'Priya Shah', phone: '07700 900900', postcode: 'BL3 5XY' });
  for (const q of ['BL3 5XY', 'bl35xy']) {
    assert.ok((await staff(`/api/search?q=${encodeURIComponent(q)}`)).body.customers.some((c) => c.id === priya.id), q);
  }
});
