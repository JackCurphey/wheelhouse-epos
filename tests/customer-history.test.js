// A customer's page, the history (openspec/changes/customer-page; cs-page;
// customer service review 12; walk-through 9 L5).
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import '../server/load-env.js';
import { runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let owner;
let other;
let maya;

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'History Cycles' });
  other = await staffSignup(server.baseUrl, { shopName: 'Elsewhere Cycles' });
  maya = (await staff('/api/customers', { method: 'POST', body: { name: 'Maya Patel', phone: '07700 900142' } })).body;
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (other) await deleteTestShop(other.shop.id);
  if (server) await server.stop();
});

function staff(path, options, who = owner) {
  return staffRequest(server.baseUrl, who.cookie, path, options);
}
const history = async (id = maya.id, who = owner) => staff(`/api/customers/${id}/history`, {}, who);

test('her jobs, sales and messages, newest first, each with what its row shows', async () => {
  const job = (await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Standard service', jobDate: '2026-09-17', startTime: '11:30', endTime: '12:30', customerId: maya.id } })).body;
  const cashier = (await staff('/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `jo-${randomUUID().slice(0, 8)}@example.test`, password: 'password123' } })).body;
  const tube = (await staff('/api/products', { method: 'POST', body: { name: 'Inner tube', price: 5, sku: `TUBE-${randomUUID().slice(0, 6)}`, stockQty: 10 } })).body;
  const sale = (await staff('/api/sales', { method: 'POST', body: { cashierId: cashier.employeeId, customerId: maya.id, items: [{ productId: tube.id, qty: 2 }], cashAmount: 10, cashTendered: 10 } })).body;
  await runWithShop(owner.shop.id, () => prepare("UPDATE sales SET created_at = now() - interval '30 days' WHERE id = ?").run(sale.id));
  await runWithShop(owner.shop.id, () => prepare(
    "INSERT INTO customer_messages (customer_id, job_id, body, status, intent_state, channel, template_key, to_address, sent_at) VALUES (?, ?, 'Hi Maya', 'delivered', 'delivered', 'sms', 'bike_ready', '07700 900142', now() - interval '1 day')"
  ).run(maya.id, job.id));
  const res = await history();
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const { items } = res.body;
  const j = items.find((i) => i.kind === 'job');
  assert.deepEqual([j.id, j.reference, j.title, j.jobDate, j.open], [job.id, job.reference, 'Standard service', '2026-09-17', true]);
  assert.ok('bookingState' in j && 'workState' in j && 'mechanicName' in j);
  const s = items.find((i) => i.kind === 'sale');
  assert.deepEqual([s.id, s.total, s.what], [sale.id, 10, 'Inner tube × 2']);
  const m = items.find((i) => i.kind === 'message');
  assert.deepEqual([m.name, m.channel, m.to], ['Bike ready', 'sms', '07700 900142']);
  const order = items.map((i) => i.kind);
  assert.ok(order.indexOf('message') < order.indexOf('sale'), `newest first: ${order}`);
});

test('a collected bike’s job, or a cancelled one, isn’t open', async () => {
  let job = (await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Gear tune', jobDate: '2026-09-10', customerId: maya.id } })).body;
  job = (await staff(`/api/workshop-jobs/${job.id}/book-in`, { method: 'POST', body: { version: job.version } })).body;
  assert.equal((await staff(`/api/workshop-jobs/${job.id}/collect`, { method: 'POST', body: { version: job.version } })).status, 200);
  const cancelled = (await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Safety check', jobDate: '2026-09-11', customerId: maya.id } })).body;
  await runWithShop(owner.shop.id, () => prepare("UPDATE workshop_jobs SET booking_state = 'cancelled' WHERE id = ?").run(cancelled.id));
  const items = (await history()).body.items;
  assert.equal(items.find((i) => i.id === job.id && i.kind === 'job').open, false);
  assert.equal(items.find((i) => i.id === cancelled.id && i.kind === 'job').open, false);
});

test('someone new has nothing; an unknown customer, or another shop’s, isn’t found', async () => {
  const lena = (await staff('/api/customers', { method: 'POST', body: { name: 'Lena Fox', phone: '07700 900800' } })).body;
  assert.deepEqual((await history(lena.id)).body, { items: [] });
  assert.equal((await history(999999999)).status, 404);
  assert.equal((await history(maya.id, other)).status, 404);
});

test('a job’s time is the shop’s, so it sorts with sales by the real hour (review)', async () => {
  const lena = (await staff('/api/customers', { method: 'POST', body: { name: 'Lena Fox', phone: '07700 900811' } })).body;
  // 10:00 on 1 Sep in the shop is 09:00 in UTC (summer time); a sale at 09:30 UTC is after it.
  const job = (await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Gear tune', jobDate: '2026-09-01', startTime: '10:00', endTime: '11:00', customerId: lena.id } })).body;
  await runWithShop(owner.shop.id, () => prepare(
    "INSERT INTO customer_messages (customer_id, body, status, intent_state, channel, template_key, to_address, sent_at) VALUES (?, 'Hi', 'delivered', 'delivered', 'sms', 'bike_ready', '07700 900811', '2026-09-01T09:30:00Z')"
  ).run(lena.id));
  const items = (await history(lena.id)).body.items;
  assert.deepEqual(items.map((i) => i.kind), ['message', 'job'], 'the 09:30 UTC message is after the 10:00 BST job');
  assert.equal(items.find((i) => i.kind === 'job').at, '2026-09-01T09:00:00.000Z');
  assert.equal(items.find((i) => i.kind === 'job').id, job.id);
});

test('a job never booked in, whose day has gone, isn’t open (review)', async () => {
  const sam = (await staff('/api/customers', { method: 'POST', body: { name: 'Sam Reed', phone: '07700 900500' } })).body;
  const gone = (await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Safety check', jobDate: '2026-08-20', customerId: sam.id } })).body;
  const coming = (await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Safety check', jobDate: '2026-09-20', customerId: sam.id } })).body;
  const items = (await history(sam.id)).body.items;
  assert.equal(items.find((i) => i.id === gone.id).open, false, 'a no-show from August');
  assert.equal(items.find((i) => i.id === coming.id).open, true, 'still to come');
});
