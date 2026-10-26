// Two saves of different fields on the same record at the same moment both
// stay saved (openspec/changes/more-saves-dont-clash). Each route used to read
// the record, change only the fields sent and write every field back, with
// nothing stopping a second save in between; the later write put back the old
// value of the field the other save had just changed.
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

// Each round sets a known starting point, sends the two saves at once and
// reads back. Returns the rounds where one of the two changes was lost.
async function lostRounds(path, reset, first, second, kept) {
  const lost = [];
  for (let i = 0; i < ROUNDS; i += 1) {
    assert.equal((await put(path, reset(i))).status, 200, 'the reset saves');
    const [a, b] = await Promise.all([put(path, first(i)), put(path, second(i))]);
    assert.equal(a.status, 200, JSON.stringify(a.body));
    assert.equal(b.status, 200, JSON.stringify(b.body));
    const stored = (await call(path)).body;
    if (!kept(stored, i)) lost.push(i);
  }
  return lost;
}

test('a customer: a new phone number and a new note saved at once both stay', async () => {
  const mine = await post('/api/customers', { name: '[customer]', phone: '[phone]' });
  const theirs = await post('/api/customers', { name: '[customer]', phone: '[phone]' }, otherShop);
  const theirsBefore = (await call(`/api/customers/${theirs.id}`, undefined, otherShop)).body;
  const lost = await lostRounds(
    `/api/customers/${mine.id}`,
    () => ({ phone: '[phone]', notes: '[notes]' }),
    (i) => ({ phone: `[phone ${i}]` }),
    (i) => ({ notes: `[notes ${i}]` }),
    (s, i) => s.phone === `[phone ${i}]` && s.notes === `[notes ${i}]`,
  );
  assert.deepEqual(lost, [], `a change was lost in ${lost.length} of ${ROUNDS} rounds`);
  assert.deepEqual((await call(`/api/customers/${theirs.id}`, undefined, otherShop)).body, theirsBefore);
});

test('a bike: a new colour and a new frame number saved at once both stay', async () => {
  const customer = await post('/api/customers', { name: '[customer]', phone: '[phone]' });
  const bike = await post(`/api/customers/${customer.id}/bikes`, { make: '[make]', model: '[model]' });
  const theirCustomer = await post('/api/customers', { name: '[customer]', phone: '[phone]' }, otherShop);
  const theirBike = await post(`/api/customers/${theirCustomer.id}/bikes`, { make: '[make]', model: '[model]' }, otherShop);
  const theirsBefore = (await call(`/api/bikes/${theirBike.id}`, undefined, otherShop)).body;
  const lost = await lostRounds(
    `/api/bikes/${bike.id}`,
    () => ({ colour: '[colour]', serialNumber: '[frame number]' }),
    (i) => ({ colour: `[colour ${i}]` }),
    (i) => ({ serialNumber: `[frame number ${i}]` }),
    (s, i) => s.colour === `[colour ${i}]` && s.serialNumber === `[frame number ${i}]`,
  );
  assert.deepEqual(lost, [], `a change was lost in ${lost.length} of ${ROUNDS} rounds`);
  assert.deepEqual((await call(`/api/bikes/${theirBike.id}`, undefined, otherShop)).body, theirsBefore);
});

test('a product: a new price and a new description saved at once both stay', async () => {
  const mine = await post('/api/products', { name: '[product]', price: 1 });
  const theirs = await post('/api/products', { name: '[product]', price: 1 }, otherShop);
  const theirsBefore = (await call(`/api/products/${theirs.id}`, undefined, otherShop)).body;
  const lost = await lostRounds(
    `/api/products/${mine.id}`,
    () => ({ price: 1, description: '[description]' }),
    (i) => ({ price: 2 + i }),
    (i) => ({ description: `[description ${i}]` }),
    (s, i) => s.price === 2 + i && s.description === `[description ${i}]`,
  );
  assert.deepEqual(lost, [], `a change was lost in ${lost.length} of ${ROUNDS} rounds`);
  assert.deepEqual((await call(`/api/products/${theirs.id}`, undefined, otherShop)).body, theirsBefore);
});

// The job's screens send the version they read, and a second save with the
// same version is refused as changed; this is a save without one, which the
// route still accepts.
test('a workshop job: a new title and a new note saved at once, without a version, both stay', async () => {
  const job = { jobDate: '2026-10-20', startTime: '10:00', endTime: '11:00' };
  const mine = await post('/api/workshop-jobs', { title: '[title]', mechanicId: mechanic, ...job });
  const theirs = await post('/api/workshop-jobs', { title: '[title]', mechanicId: otherMechanic, ...job }, otherShop);
  const theirsBefore = (await call(`/api/workshop-jobs/${theirs.id}`, undefined, otherShop)).body;
  const lost = await lostRounds(
    `/api/workshop-jobs/${mine.id}`,
    () => ({ title: '[title]', notes: '[notes]' }),
    (i) => ({ title: `[title ${i}]` }),
    (i) => ({ notes: `[notes ${i}]` }),
    (s, i) => s.title === `[title ${i}]` && s.notes === `[notes ${i}]`,
  );
  assert.deepEqual(lost, [], `a change was lost in ${lost.length} of ${ROUNDS} rounds`);
  assert.deepEqual((await call(`/api/workshop-jobs/${theirs.id}`, undefined, otherShop)).body, theirsBefore);
});

const refusedWith = async (path, body) => {
  const r = await put(path, body);
  return [r.status, r.body.error];
};

// Refusals are unchanged by the lock: a refused save writes nothing, and the
// next save goes straight through.
test('a refused save changes nothing, and the next save goes through', async () => {
  const customer = await post('/api/customers', { name: '[customer]', phone: '[phone]', notes: '[notes]' });
  assert.deepEqual(await refusedWith(`/api/customers/${customer.id}`, { name: '', notes: '[refused]' }), [400, 'Customer name is required']);
  assert.equal((await call(`/api/customers/${customer.id}`)).body.notes, '[notes]');
  assert.equal((await put(`/api/customers/${customer.id}`, { notes: '[next]' })).body.notes, '[next]');

  const bike = await post(`/api/customers/${customer.id}/bikes`, { make: '[make]', colour: '[colour]' });
  assert.deepEqual(await refusedWith(`/api/bikes/${bike.id}`, { make: '', model: '', colour: '[refused]' }), [400, 'Make or model is required']);
  assert.equal((await call(`/api/bikes/${bike.id}`)).body.colour, '[colour]');
  assert.equal((await put(`/api/bikes/${bike.id}`, { colour: '[next]' })).body.colour, '[next]');

  const product = await post('/api/products', { name: '[product]', price: 1, description: '[description]' });
  assert.deepEqual(await refusedWith(`/api/products/${product.id}`, { name: '', description: '[refused]' }), [400, 'Product name is required']);
  assert.equal((await call(`/api/products/${product.id}`)).body.description, '[description]');
  assert.equal((await put(`/api/products/${product.id}`, { description: '[next]' })).body.description, '[next]');

  const job = await post('/api/workshop-jobs', { title: '[title]', notes: '[notes]', mechanicId: mechanic, jobDate: '2026-10-21', startTime: '10:00', endTime: '11:00' });
  assert.deepEqual(await refusedWith(`/api/workshop-jobs/${job.id}`, { title: '', notes: '[refused]' }), [400, 'Job title is required']);
  assert.deepEqual(await refusedWith(`/api/workshop-jobs/${job.id}`, { jobDate: 'nonsense', notes: '[refused]' }), [400, 'A valid date is required']);
  assert.equal((await call(`/api/workshop-jobs/${job.id}`)).body.notes, '[notes]');
  assert.equal((await put(`/api/workshop-jobs/${job.id}`, { notes: '[next]' })).body.notes, '[next]');
});

// Another shop's record can't be reached through any of the four saves.
test('another shop’s customer, bike, product and job are not found, and stay as they were', async () => {
  const customer = await post('/api/customers', { name: '[customer]', phone: '[phone]' }, otherShop);
  const bike = await post(`/api/customers/${customer.id}/bikes`, { make: '[make]' }, otherShop);
  const product = await post('/api/products', { name: '[product]', price: 1 }, otherShop);
  const job = await post('/api/workshop-jobs', { title: '[title]', mechanicId: otherMechanic, jobDate: '2026-10-22', startTime: '10:00', endTime: '11:00' }, otherShop);
  for (const [path, body] of [
    [`/api/customers/${customer.id}`, { notes: '[not mine]' }],
    [`/api/bikes/${bike.id}`, { notes: '[not mine]' }],
    [`/api/products/${product.id}`, { description: '[not mine]' }],
    [`/api/workshop-jobs/${job.id}`, { notes: '[not mine]' }],
  ]) {
    const before = (await call(path, undefined, otherShop)).body;
    assert.equal((await put(path, body)).status, 404, path);
    assert.deepEqual((await call(path, undefined, otherShop)).body, before, path);
  }
});
