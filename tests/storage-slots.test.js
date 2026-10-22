// Storage slots (Workshop day 27, 27 Sep; drawn as set-workshop-diary's Storage
// slots, New job's "Where the bike is kept", till-book-in, the job page's
// "Kept on Hook 3"; built 22 Oct on Jack's word; openspec/changes/storage-slots).
// A shop's own list of hooks and spaces; a bike's slot is chosen at book-in,
// changed while it's in, and cleared when it's collected.
// Needs the compose Postgres up (npm run docker:up) or it hangs with no output.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import '../server/load-env.js';
import { pool } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie, seedMechanic } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';
import { dayMaker } from './helpers/linkActions.js';

let server;
let owner;
let other;
let jo;
let sam;
const nextDay = dayMaker();

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl);
  other = await staffSignup(server.baseUrl);
  const made = await staff('/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `jo-${randomUUID().slice(0, 8)}@example.test`, password: 'password123' } });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  jo = await staffFreshCookie(made.body.loginId);
  sam = await seedMechanic(owner.shop.id, { name: 'Sam' });
});
after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (other) await deleteTestShop(other.shop.id);
  if (server) await server.stop();
  await pool.end();
});

function staff(path, options) {
  return staffRequest(server.baseUrl, owner.cookie, path, options);
}
const slots = async () => (await staff('/api/storage-slots')).body;
async function addSlot(name) {
  const res = await staff('/api/storage-slots', { method: 'POST', body: { name } });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body;
}
async function newJob() {
  const res = await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Standard service', jobDate: nextDay(), startTime: '10:00', endTime: '11:00', mechanicId: sam } });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body;
}
const act = (job, action, body = {}) => staff(`/api/workshop-jobs/${job.id}/${action}`, { method: 'POST', body: { version: job.version, ...body } });
const putSlot = (job, storageSlotId) => staff(`/api/workshop-jobs/${job.id}/storage-slot`, { method: 'PUT', body: { storageSlotId } });

// ---------- Settings ----------

test('slots are off to start and the Owner switches them on', async () => {
  assert.equal((await staff('/api/workshop-settings')).body.storageSlotsOn, false);
  const on = await staff('/api/workshop-settings', { method: 'PUT', body: { storageSlotsOn: true } });
  assert.equal(on.status, 200, JSON.stringify(on.body));
  assert.equal(on.body.storageSlotsOn, true);
});

test('the shop keeps its own list, in the order added; a slot is removed', async () => {
  const a = await addSlot(' Hook 1 ');
  const b = await addSlot('Workshop floor');
  assert.deepEqual((await slots()).filter((s) => [a.id, b.id].includes(s.id)), [{ id: a.id, name: 'Hook 1' }, { id: b.id, name: 'Workshop floor' }]);
  assert.equal((await staff(`/api/storage-slots/${a.id}`, { method: 'DELETE' })).status, 204);
  assert.ok(!(await slots()).some((s) => s.id === a.id));
  assert.equal((await staff(`/api/storage-slots/${a.id}`, { method: 'DELETE' })).status, 404);
  await staff(`/api/storage-slots/${b.id}`, { method: 'DELETE' });
});

test('a slot needs a name of up to 40 letters, not used twice', async () => {
  const kept = await addSlot('Front window');
  for (const name of ['', '  ', 'x'.repeat(41), 'front window', 7]) {
    const res = await staff('/api/storage-slots', { method: 'POST', body: { name } });
    assert.equal(res.status, 400, JSON.stringify([name, res.body]));
  }
  await staff(`/api/storage-slots/${kept.id}`, { method: 'DELETE' });
});

test('only the Owner changes slots; staff read them; another shop’s are invisible', async () => {
  const hook = await addSlot('Hook 9');
  assert.equal((await staffRequest(server.baseUrl, jo, '/api/storage-slots', { method: 'POST', body: { name: 'Mine' } })).status, 403);
  assert.equal((await staffRequest(server.baseUrl, jo, `/api/storage-slots/${hook.id}`, { method: 'DELETE' })).status, 403);
  assert.ok((await staffRequest(server.baseUrl, jo, '/api/storage-slots')).body.some((s) => s.id === hook.id));
  assert.deepEqual((await staffRequest(server.baseUrl, other.cookie, '/api/storage-slots')).body, []);
  assert.equal((await staffRequest(server.baseUrl, other.cookie, `/api/storage-slots/${hook.id}`, { method: 'DELETE' })).status, 404);
  await staff(`/api/storage-slots/${hook.id}`, { method: 'DELETE' });
});

// ---------- A bike's slot ----------

test('a job starts with no slot; book-in may put it on one, and the job says so', async () => {
  const hook = await addSlot('Hook 3');
  try {
    const job = await newJob();
    assert.deepEqual([job.storageSlotId, job.storageSlotName], [null, null]);
    const booked = await act(job, 'book-in', { storageSlotId: hook.id });
    assert.equal(booked.status, 200, JSON.stringify(booked.body));
    assert.deepEqual([booked.body.storageSlotId, booked.body.storageSlotName], [hook.id, 'Hook 3']);
    const read = (await staff(`/api/workshop-jobs/${job.id}`)).body;
    assert.equal(read.storageSlotName, 'Hook 3');
    // Not required.
    const plain = await act(await newJob(), 'book-in');
    assert.equal(plain.status, 200);
    assert.equal(plain.body.storageSlotId, null);
  } finally {
    await staff(`/api/storage-slots/${hook.id}`, { method: 'DELETE' });
  }
});

test('a slot that isn’t the shop’s is refused at book-in, and nothing moves', async () => {
  const theirs = (await staffRequest(server.baseUrl, other.cookie, '/api/storage-slots', { method: 'POST', body: { name: 'Their hook' } })).body;
  const job = await newJob();
  for (const storageSlotId of [theirs.id, 999999, '3']) {
    const res = await act(job, 'book-in', { storageSlotId });
    assert.equal(res.status, 400, JSON.stringify([storageSlotId, res.body]));
  }
  assert.equal((await staff(`/api/workshop-jobs/${job.id}`)).body.custodyState, 'expected');
});

test('while the bike is in, its slot changes or clears; collecting it clears it', async () => {
  const hook3 = await addSlot('Hook 3b');
  const hook5 = await addSlot('Hook 5');
  try {
    let job = (await act(await newJob(), 'book-in', { storageSlotId: hook3.id })).body;
    const moved = await putSlot(job, hook5.id);
    assert.equal(moved.status, 200, JSON.stringify(moved.body));
    assert.equal(moved.body.storageSlotName, 'Hook 5');
    assert.equal((await putSlot(job, null)).body.storageSlotId, null);
    job = (await putSlot(job, hook3.id)).body;
    const collected = await act(job, 'collect');
    assert.equal(collected.status, 200, JSON.stringify(collected.body));
    assert.equal(collected.body.storageSlotId, null);
  } finally {
    await staff(`/api/storage-slots/${hook3.id}`, { method: 'DELETE' });
    await staff(`/api/storage-slots/${hook5.id}`, { method: 'DELETE' });
  }
});

test('a bike not in the shop can’t be put on a slot', async () => {
  const hook = await addSlot('Hook 7');
  try {
    const res = await putSlot(await newJob(), hook.id);
    assert.equal(res.status, 409, JSON.stringify(res.body));
    assert.equal(res.body.code, 'illegal');
    assert.equal((await staff('/api/workshop-jobs/999999/storage-slot', { method: 'PUT', body: { storageSlotId: null } })).status, 404);
  } finally {
    await staff(`/api/storage-slots/${hook.id}`, { method: 'DELETE' });
  }
});

test('two bikes may share a slot; removing the slot clears both', async () => {
  const hook = await addSlot('Hook 8');
  const a = (await act(await newJob(), 'book-in', { storageSlotId: hook.id })).body;
  const b = (await act(await newJob(), 'book-in', { storageSlotId: hook.id })).body;
  assert.deepEqual([a.storageSlotId, b.storageSlotId], [hook.id, hook.id]);
  await staff(`/api/storage-slots/${hook.id}`, { method: 'DELETE' });
  for (const j of [a, b]) assert.equal((await staff(`/api/workshop-jobs/${j.id}`)).body.storageSlotId, null);
});

// ---------- Fresh review, 22 Oct ----------

test('a job made with the bike already in goes on its slot as it’s made', async () => {
  const hook = await addSlot('Hook 11');
  try {
    const made = await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Wheel build', jobDate: nextDay(), startTime: '12:00', endTime: '13:00', mechanicId: sam, status: 'waiting_parts', storageSlotId: hook.id } });
    assert.equal(made.status, 201, JSON.stringify(made.body));
    assert.deepEqual([made.body.custodyState, made.body.storageSlotName], ['in_shop', 'Hook 11']);
    // A bike that isn't in yet has no slot to go on.
    const expected = await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Wheel build', jobDate: nextDay(), startTime: '12:00', endTime: '13:00', mechanicId: sam, storageSlotId: hook.id } });
    assert.equal(expected.status, 400, JSON.stringify(expected.body));
  } finally {
    await staff(`/api/storage-slots/${hook.id}`, { method: 'DELETE' });
  }
});

test('a refused book-in leaves no slot; another shop can’t put this shop’s bike on a slot', async () => {
  const hook = await addSlot('Hook 12');
  try {
    const job = await newJob();
    const stale = await staff(`/api/workshop-jobs/${job.id}/book-in`, { method: 'POST', body: { version: job.version + 5, storageSlotId: hook.id } });
    assert.equal(stale.status, 409, JSON.stringify(stale.body));
    assert.equal((await staff(`/api/workshop-jobs/${job.id}`)).body.storageSlotId, null);
    const inShop = (await act(job, 'book-in')).body;
    assert.equal((await staffRequest(server.baseUrl, other.cookie, `/api/workshop-jobs/${inShop.id}/storage-slot`, { method: 'PUT', body: { storageSlotId: null } })).status, 404);
  } finally {
    await staff(`/api/storage-slots/${hook.id}`, { method: 'DELETE' });
  }
});

test('with slots switched off, a bike can’t be put on one', async () => {
  const hook = await addSlot('Hook 13');
  try {
    await staff('/api/workshop-settings', { method: 'PUT', body: { storageSlotsOn: false } });
    const job = await newJob();
    const res = await act(job, 'book-in', { storageSlotId: hook.id });
    assert.equal(res.status, 400, JSON.stringify(res.body));
    assert.equal((await staff(`/api/workshop-jobs/${job.id}`)).body.custodyState, 'expected');
    const inShop = (await act(job, 'book-in')).body;
    assert.equal((await putSlot(inShop, hook.id)).status, 400);
  } finally {
    await staff('/api/workshop-settings', { method: 'PUT', body: { storageSlotsOn: true } });
    await staff(`/api/storage-slots/${hook.id}`, { method: 'DELETE' });
  }
});
