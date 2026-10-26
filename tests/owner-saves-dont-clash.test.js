// Two saves of different fields on the same record at the same moment both
// stay saved (openspec/changes/owner-saves-dont-clash): a workshop service, a
// service group, a mechanic's time off, a person on the team, a supplier and
// a draft stock order. Each route used to read the record, change only the
// fields sent and write every field back, with nothing stopping a second save
// in between; the later write put back the old value of the field the other
// save had just changed.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

const ROUNDS = 30;

let server;
let owner;
let otherShop;
let mechanic;
let otherMechanic;

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl);
  otherShop = await staffSignup(server.baseUrl);
  mechanic = await seedMechanic(owner.shop.id, { name: '[mechanic]' });
  otherMechanic = await seedMechanic(otherShop.shop.id, { name: '[mechanic]' });
});
after(async () => {
  for (const s of [owner, otherShop]) if (s) await deleteTestShop(s.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const call = (path, options, who = owner) => staffRequest(server.baseUrl, who.cookie, path, options);
const put = (path, body, who = owner) => call(path, { method: 'PUT', body }, who);
const post = async (path, body, who = owner) => {
  const r = await call(path, { method: 'POST', body }, who);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body;
};

// Some of these have no GET of one record; read it from the list.
const fromList = (listPath, pick = (b) => b) => async (id, who = owner) =>
  pick((await call(listPath, undefined, who)).body).find((r) => r.id === id);
const readService = fromList('/api/workshop-services');
const readCategory = fromList('/api/workshop-service-categories');
const readBlock = fromList('/api/workshop-unavailability', (b) => b.blocks);
const readEmployee = fromList('/api/employees?all=1');
const readSupplier = fromList('/api/suppliers');
const readOrder = async (id, who = owner) => (await call(`/api/purchase-orders/${id}`, undefined, who)).body;

// Each round sets a known starting point, sends the two saves at once and
// reads back. Returns the rounds where one of the two changes was lost.
async function lostRounds(path, read, reset, first, second, kept) {
  const lost = [];
  for (let i = 0; i < ROUNDS; i += 1) {
    const r = await put(path, reset(i));
    assert.equal(r.status, 200, `the reset saves: ${JSON.stringify(r.body)}`);
    const [a, b] = await Promise.all([put(path, first(i)), put(path, second(i))]);
    assert.equal(a.status, 200, JSON.stringify(a.body));
    assert.equal(b.status, 200, JSON.stringify(b.body));
    if (!kept(await read(), i)) lost.push(i);
  }
  return lost;
}

const supplierName = () => `[supplier ${Math.random().toString(36).slice(2, 8)}]`;
const newSupplier = (who = owner) => post('/api/suppliers', { name: supplierName(), adapterType: 'mock_csv' }, who);
async function newDraftOrder(who = owner) {
  const supplier = await newSupplier(who);
  const product = await post('/api/products', { name: '[product]', price: 1 }, who);
  return post('/api/purchase-orders', { supplierId: supplier.id, items: [{ productId: product.id, qty: 1, unitCost: 1 }] }, who);
}

test('a workshop service: a reminder and a place saved at once both stay', async () => {
  const mine = await post('/api/workshop-services', { name: '[service]', price: 10 });
  const theirs = await post('/api/workshop-services', { name: '[service]', price: 10 }, otherShop);
  const theirsBefore = await readService(theirs.id, otherShop);
  // The Services box sends the name and price every time (both are needed),
  // and leaves out what it doesn't show; those are kept from the stored row.
  const lost = await lostRounds(
    `/api/workshop-services/${mine.id}`,
    () => readService(mine.id),
    () => ({ name: '[service]', price: 10, reminderMonths: null, position: 0 }),
    (i) => ({ name: '[service]', price: 10, reminderMonths: i + 1 }),
    (i) => ({ name: '[service]', price: 10, position: i + 1 }),
    (s, i) => s.reminderMonths === i + 1 && s.position === i + 1,
  );
  assert.deepEqual(lost, [], `a change was lost in ${lost.length} of ${ROUNDS} rounds`);
  assert.deepEqual(await readService(theirs.id, otherShop), theirsBefore);
});

test('a service group: a new name and a new place saved at once both stay', async () => {
  const mine = await post('/api/workshop-service-categories', { name: '[group]' });
  const theirs = await post('/api/workshop-service-categories', { name: '[group]' }, otherShop);
  const theirsBefore = await readCategory(theirs.id, otherShop);
  const lost = await lostRounds(
    `/api/workshop-service-categories/${mine.id}`,
    () => readCategory(mine.id),
    () => ({ name: '[group]', position: 0 }),
    (i) => ({ name: `[group ${i}]` }),
    (i) => ({ position: i + 1 }),
    (s, i) => s.name === `[group ${i}]` && s.position === i + 1,
  );
  assert.deepEqual(lost, [], `a change was lost in ${lost.length} of ${ROUNDS} rounds`);
  assert.deepEqual(await readCategory(theirs.id, otherShop), theirsBefore);
});

test('a mechanic’s time off: a new reason and a new end time saved at once both stay', async () => {
  const block = { kind: 'weekly', weekdays: [1, 2, 3, 4, 5], startTime: '13:00', endTime: '13:30', reason: '[reason]' };
  const mine = (await post('/api/workshop-unavailability', { ...block, mechanicId: mechanic })).block;
  const theirs = (await post('/api/workshop-unavailability', { ...block, mechanicId: otherMechanic }, otherShop)).block;
  const theirsBefore = await readBlock(theirs.id, otherShop);
  const lost = await lostRounds(
    `/api/workshop-unavailability/${mine.id}`,
    () => readBlock(mine.id),
    () => ({ reason: '[reason]', endTime: '13:30' }),
    (i) => ({ reason: `[reason ${i}]` }),
    (i) => ({ endTime: `14:${String(i).padStart(2, '0')}` }),
    (s, i) => s.reason === `[reason ${i}]` && s.endTime === `14:${String(i).padStart(2, '0')}`,
  );
  assert.deepEqual(lost, [], `a change was lost in ${lost.length} of ${ROUNDS} rounds`);
  assert.deepEqual(await readBlock(theirs.id, otherShop), theirsBefore);
});

test('a person on the team: a new name and new working days saved at once both stay', async () => {
  const mine = await seedMechanic(owner.shop.id, { name: '[employee]' });
  const theirs = await seedMechanic(otherShop.shop.id, { name: '[employee]' });
  const theirsBefore = await readEmployee(theirs, otherShop);
  const lost = await lostRounds(
    `/api/employees/${mine}`,
    () => readEmployee(mine),
    () => ({ name: '[employee]', workingDays: [1, 2, 3, 4, 5] }),
    (i) => ({ name: `[employee ${i}]` }),
    (i) => ({ workingDays: [i % 7] }),
    (s, i) => s.name === `[employee ${i}]` && JSON.stringify(s.workingDays) === JSON.stringify([i % 7]),
  );
  assert.deepEqual(lost, [], `a change was lost in ${lost.length} of ${ROUNDS} rounds`);
  assert.deepEqual(await readEmployee(theirs, otherShop), theirsBefore);
});

test('a supplier: a new contact and a new phone number saved at once both stay', async () => {
  const mine = await newSupplier();
  const theirs = await newSupplier(otherShop);
  const theirsBefore = await readSupplier(theirs.id, otherShop);
  const lost = await lostRounds(
    `/api/suppliers/${mine.id}`,
    () => readSupplier(mine.id),
    () => ({ contactName: '[contact]', phone: '[phone]' }),
    (i) => ({ contactName: `[contact ${i}]` }),
    (i) => ({ phone: `[phone ${i}]` }),
    (s, i) => s.contactName === `[contact ${i}]` && s.phone === `[phone ${i}]`,
  );
  assert.deepEqual(lost, [], `a change was lost in ${lost.length} of ${ROUNDS} rounds`);
  assert.deepEqual(await readSupplier(theirs.id, otherShop), theirsBefore);
});

test('a draft stock order: a new reference and new notes saved at once both stay', async () => {
  const mine = await newDraftOrder();
  const theirs = await newDraftOrder(otherShop);
  const theirsBefore = await readOrder(theirs.id, otherShop);
  const lost = await lostRounds(
    `/api/purchase-orders/${mine.id}`,
    () => readOrder(mine.id),
    () => ({ reference: '[reference]', notes: '[notes]' }),
    (i) => ({ reference: `[reference ${i}]` }),
    (i) => ({ notes: `[notes ${i}]` }),
    (s, i) => s.reference === `[reference ${i}]` && s.notes === `[notes ${i}]`,
  );
  assert.deepEqual(lost, [], `a change was lost in ${lost.length} of ${ROUNDS} rounds`);
  assert.deepEqual(await readOrder(theirs.id, otherShop), theirsBefore);
});

// The draft check was made on the order read before the transaction, so an
// order marked as ordered in between could still have its lines replaced.
// Here another transaction holds the order's row, marks it ordered and
// commits while the edit is waiting: the edit must then be refused.
test('an order marked as ordered while an edit waits: the edit is refused and its lines stay', async () => {
  const order = await newDraftOrder();
  const product = await post('/api/products', { name: '[product]', price: 1 });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.current_shop_id', $1, true)", [String(owner.shop.id)]);
    await client.query('SELECT id FROM purchase_orders WHERE id = $1 FOR UPDATE', [order.id]);
    const pending = put(`/api/purchase-orders/${order.id}`, { notes: '[too late]', items: [{ productId: product.id, qty: 5, unitCost: 2 }] });
    await new Promise((resolve) => setTimeout(resolve, 300));
    await client.query("UPDATE purchase_orders SET status = 'ordered' WHERE id = $1", [order.id]);
    await client.query('COMMIT');
    const r = await pending;
    assert.deepEqual([r.status, r.body.error], [400, 'Only a draft purchase order can be edited']);
  } finally {
    await client.query('ROLLBACK').catch(() => {});
    client.release();
  }
  const stored = await readOrder(order.id);
  assert.equal(stored.status, 'ordered');
  assert.equal(stored.notes, order.notes);
  assert.deepEqual(stored.items.map((it) => [it.productId, it.qtyOrdered]), order.items.map((it) => [it.productId, it.qtyOrdered]));
});

const refusedWith = async (path, body) => {
  const r = await put(path, body);
  return [r.status, r.body.error];
};

// Refusals are unchanged by the lock: a refused save writes nothing, and the
// next save goes straight through. Each refusal rolls its own transaction
// back: the request's connection would roll back one left open too, but
// warns when it has to, and that warning must never appear.
test('a refused save changes nothing, and the next save goes through', async () => {
  const logFrom = server.stderr.length;
  const service = await post('/api/workshop-services', { name: '[service]', price: 10, position: 3 });
  const servicePath = `/api/workshop-services/${service.id}`;
  assert.deepEqual(await refusedWith(servicePath, { name: '', price: 10, position: 9 }), [400, 'A service needs a name']);
  assert.deepEqual(await refusedWith(servicePath, { name: '[service]', price: 10, reminderMonths: 99, position: 9 }), [400, 'Remind after a whole number of months, from 1 to 60']);
  assert.equal((await readService(service.id)).position, 3);
  assert.equal((await put(servicePath, { name: '[service]', price: 10, position: 4 })).body.position, 4);

  const group = await post('/api/workshop-service-categories', { name: '[group]', position: 3 });
  const groupPath = `/api/workshop-service-categories/${group.id}`;
  assert.deepEqual(await refusedWith(groupPath, { name: '', position: 9 }), [400, 'A category needs a name']);
  assert.equal((await readCategory(group.id)).position, 3);
  assert.equal((await put(groupPath, { position: 4 })).body.position, 4);

  const block = (await post('/api/workshop-unavailability', { kind: 'weekly', mechanicId: mechanic, weekdays: [1], startTime: '13:00', endTime: '13:30', reason: '[reason]' })).block;
  const blockPath = `/api/workshop-unavailability/${block.id}`;
  assert.deepEqual(await refusedWith(blockPath, { endTime: '12:00', reason: '[refused]' }), [400, 'The end time must be after the start time']);
  assert.deepEqual(await refusedWith(blockPath, { mechanicId: otherMechanic, reason: '[refused]' }), [404, 'Mechanic not found']);
  assert.equal((await readBlock(block.id)).reason, '[reason]');
  assert.equal((await put(blockPath, { reason: '[next]' })).body.block.reason, '[next]');

  const person = await seedMechanic(owner.shop.id, { name: '[employee]' });
  const personPath = `/api/employees/${person}`;
  assert.deepEqual(await refusedWith(personPath, { name: '', isCashier: true }), [400, 'Employee name is required']);
  assert.deepEqual(await refusedWith(personPath, { workingDays: 'nonsense', isCashier: true }), [400, 'workingDays must be an array of day numbers (0-6)']);
  assert.equal((await readEmployee(person)).isCashier, false);
  assert.equal((await put(personPath, { isCashier: true })).body.isCashier, true);

  const supplier = await newSupplier();
  const taken = await newSupplier();
  const supplierPath = `/api/suppliers/${supplier.id}`;
  assert.deepEqual(await refusedWith(supplierPath, { name: '', phone: '[refused]' }), [400, 'Supplier name is required']);
  assert.deepEqual(await refusedWith(supplierPath, { name: taken.name, phone: '[refused]' }), [400, `A supplier named "${taken.name}" already exists`]);
  assert.equal((await readSupplier(supplier.id)).phone, supplier.phone);
  assert.equal((await put(supplierPath, { phone: '[next]' })).body.phone, '[next]');

  const order = await newDraftOrder();
  const orderPath = `/api/purchase-orders/${order.id}`;
  assert.deepEqual(await refusedWith(orderPath, { supplierId: 0, notes: '[refused]' }), [400, 'Supplier not found']);
  assert.deepEqual(await refusedWith(orderPath, { items: [], notes: '[refused]' }), [400, 'A purchase order must include at least one item']);
  assert.deepEqual(await refusedWith(orderPath, { items: [{ productId: 0, qty: 1, unitCost: 1 }], notes: '[refused]' }), [400, 'Each item needs a valid productId and positive qty']);
  assert.equal((await readOrder(order.id)).notes, order.notes);
  assert.equal((await put(orderPath, { notes: '[next]' })).body.notes, '[next]');
  assert.equal((await call(`/api/purchase-orders/${order.id}/mark-ordered`, { method: 'POST' })).status, 200);
  assert.deepEqual(await refusedWith(orderPath, { notes: '[refused]' }), [400, 'Only a draft purchase order can be edited']);
  assert.ok(!server.stderr.slice(logFrom).includes('transaction still open'), 'a refusal left its transaction open');
});

// Another shop's records can't be reached through any of the six saves.
test('another shop’s service, group, time off, person, supplier and order are not found, and stay as they were', async () => {
  const service = await post('/api/workshop-services', { name: '[service]', price: 10 }, otherShop);
  const group = await post('/api/workshop-service-categories', { name: '[group]' }, otherShop);
  const block = (await post('/api/workshop-unavailability', { kind: 'weekly', mechanicId: otherMechanic, weekdays: [1], startTime: '13:00', endTime: '13:30' }, otherShop)).block;
  const supplier = await newSupplier(otherShop);
  const order = await newDraftOrder(otherShop);
  for (const [path, body, read, id] of [
    [`/api/workshop-services/${service.id}`, { name: '[not mine]', price: 1 }, readService, service.id],
    [`/api/workshop-service-categories/${group.id}`, { name: '[not mine]' }, readCategory, group.id],
    [`/api/workshop-unavailability/${block.id}`, { reason: '[not mine]' }, readBlock, block.id],
    [`/api/employees/${otherMechanic}`, { name: '[not mine]' }, readEmployee, otherMechanic],
    [`/api/suppliers/${supplier.id}`, { name: '[not mine]' }, readSupplier, supplier.id],
    [`/api/purchase-orders/${order.id}`, { notes: '[not mine]' }, readOrder, order.id],
  ]) {
    const before = await read(id, otherShop);
    assert.ok(before, path);
    assert.equal((await put(path, body)).status, 404, path);
    assert.deepEqual(await read(id, otherShop), before, path);
  }
});
