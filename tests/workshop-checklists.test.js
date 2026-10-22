// Service checklists (Jack, 22 Oct, docs/decisions/2026-10-22-service-checklists.md;
// openspec/changes/service-checklists): each shop writes its own checklists in
// Settings and chooses the services that have each, with a full service
// template; a job has its first service's checklist, ticked and noted item by
// item on the job page, and keeps the copy it began with.
// Needs the compose Postgres up (npm run docker:up) or it hangs with no output.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import '../server/load-env.js';
import { pool } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie, seedMechanic } from './helpers/staff.js';
import { portalSignup, portalRequest } from './helpers/portal.js';
import { deleteTestShop } from './helpers/testShop.js';
import { BOOKING_CONTACT } from './helpers/bookable.js';
import { dayMaker } from './helpers/linkActions.js';

const TEMPLATE = ['Frame & fork', 'Wheels & tyres', 'Tyre pressure', 'Brakes bled & adjusted', 'Gears indexed',
  'Chain & drivetrain', 'Bottom bracket', 'Headset', 'Cables & housing', 'Bolts torqued'];

let server;
let owner;
let jo;
let other;
let sam;
let standard;
let safety;
let hub;
const nextDay = dayMaker();

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  other = await staffSignup(server.baseUrl, { shopName: 'Other Cycles' });
  const made = await staff('/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `jo-${randomUUID().slice(0, 8)}@example.test`, password: 'password123' } });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  jo = { cookie: await staffFreshCookie(made.body.loginId) };
  sam = await seedMechanic(owner.shop.id, { name: 'Sam' });
  const service = async (name) => (await staff('/api/workshop-services', { method: 'POST', body: { name, price: 65, minutes: 60, bookableOnline: true } })).body;
  standard = await service('Standard service');
  safety = await service('Safety check');
  hub = await service('Hub service');
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
const asJo = (path, options) => staffRequest(server.baseUrl, jo.cookie, path, options);
const list = async () => (await staff('/api/workshop-checklists')).body;
async function fromTemplate() {
  const made = await staff('/api/workshop-checklists', { method: 'POST', body: { template: true } });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  return made.body;
}
async function remove(id) {
  assert.equal((await staff(`/api/workshop-checklists/${id}`, { method: 'DELETE' })).status, 204);
}
async function staffJob(body = {}) {
  const made = await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Standard service', jobDate: nextDay(), startTime: '10:00', endTime: '11:00', mechanicId: sam, ...body } });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  return made.body;
}
const checklistOf = async (jobId) => (await staff(`/api/workshop-jobs/${jobId}/checklist`)).body;
const setItem = (jobId, index, body) => staff(`/api/workshop-jobs/${jobId}/checklist/items/${index}`, { method: 'PUT', body });

// ---------- Settings ----------

test('the template is the ten drawn items, named Full service checklist, used for no service yet', async () => {
  const made = await fromTemplate();
  try {
    assert.deepEqual({ name: made.name, items: made.items, serviceIds: made.serviceIds }, { name: 'Full service checklist', items: TEMPLATE, serviceIds: [] });
    assert.ok((await list()).some((c) => c.id === made.id));
  } finally {
    await remove(made.id);
  }
});

test('a shop writes its own checklist, renames it, changes its items and removes it', async () => {
  const made = await staff('/api/workshop-checklists', { method: 'POST', body: { name: ' Safety checklist ', items: [' Brakes ', 'Tyres'], serviceIds: [safety.id] } });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  assert.deepEqual({ name: made.body.name, items: made.body.items, serviceIds: made.body.serviceIds }, { name: 'Safety checklist', items: ['Brakes', 'Tyres'], serviceIds: [safety.id] });
  const changed = await staff(`/api/workshop-checklists/${made.body.id}`, { method: 'PUT', body: { name: 'Safety', items: ['Tyres', 'Brakes', 'Lights'] } });
  assert.equal(changed.status, 200, JSON.stringify(changed.body));
  assert.deepEqual({ name: changed.body.name, items: changed.body.items, serviceIds: changed.body.serviceIds }, { name: 'Safety', items: ['Tyres', 'Brakes', 'Lights'], serviceIds: [safety.id] });
  await remove(made.body.id);
  assert.ok(!(await list()).some((c) => c.id === made.body.id));
  assert.equal((await staff(`/api/workshop-checklists/${made.body.id}`, { method: 'DELETE' })).status, 404);
});

test('a service has one checklist at most: choosing it for another moves it', async () => {
  const full = await fromTemplate();
  const other2 = await staff('/api/workshop-checklists', { method: 'POST', body: { name: 'Safety checklist', items: ['Brakes'] } });
  try {
    assert.deepEqual((await staff(`/api/workshop-checklists/${full.id}`, { method: 'PUT', body: { serviceIds: [standard.id, safety.id] } })).body.serviceIds.sort(), [standard.id, safety.id].sort());
    await staff(`/api/workshop-checklists/${other2.body.id}`, { method: 'PUT', body: { serviceIds: [safety.id] } });
    const now = await list();
    assert.deepEqual(now.find((c) => c.id === full.id).serviceIds, [standard.id]);
    assert.deepEqual(now.find((c) => c.id === other2.body.id).serviceIds, [safety.id]);
    // The list is the whole choice: a service left out loses the checklist.
    await staff(`/api/workshop-checklists/${full.id}`, { method: 'PUT', body: { serviceIds: [] } });
    assert.deepEqual((await list()).find((c) => c.id === full.id).serviceIds, []);
  } finally {
    await remove(full.id);
    await remove(other2.body.id);
  }
});

test('a checklist needs a name and 1 to 50 items of up to 120 letters, and real services', async () => {
  const refused = async (body) => {
    const res = await staff('/api/workshop-checklists', { method: 'POST', body });
    assert.equal(res.status, 400, JSON.stringify([body, res.body]));
    return res.body.error;
  };
  await refused({ name: ' ', items: ['Brakes'] });
  await refused({ name: 'x'.repeat(81), items: ['Brakes'] });
  await refused({ name: 'Empty', items: [] });
  await refused({ name: 'Blank item', items: ['Brakes', ' '] });
  await refused({ name: 'Long item', items: ['x'.repeat(121)] });
  await refused({ name: 'Too many', items: Array.from({ length: 51 }, (_, i) => `Item ${i}`) });
  await refused({ name: 'No such service', items: ['Brakes'], serviceIds: [999999] });
  assert.equal((await staff('/api/workshop-checklists/999999', { method: 'PUT', body: { name: 'x' } })).status, 404);
});

test('only the Owner changes checklists; staff can read them', async () => {
  const full = await fromTemplate();
  try {
    assert.equal((await asJo('/api/workshop-checklists', { method: 'POST', body: { template: true } })).status, 403);
    assert.equal((await asJo(`/api/workshop-checklists/${full.id}`, { method: 'PUT', body: { name: 'Mine' } })).status, 403);
    assert.equal((await asJo(`/api/workshop-checklists/${full.id}`, { method: 'DELETE' })).status, 403);
    const read = await asJo('/api/workshop-checklists');
    assert.equal(read.status, 200);
    assert.ok(read.body.some((c) => c.id === full.id));
  } finally {
    await remove(full.id);
  }
});

test('another shop’s checklists are invisible', async () => {
  const full = await fromTemplate();
  try {
    const theirs = await staffRequest(server.baseUrl, other.cookie, '/api/workshop-checklists');
    assert.deepEqual(theirs.body, []);
    assert.equal((await staffRequest(server.baseUrl, other.cookie, `/api/workshop-checklists/${full.id}`, { method: 'PUT', body: { name: 'Taken' } })).status, 404);
  } finally {
    await remove(full.id);
  }
});

// ---------- A job's checklist ----------

test('a staff job made for a service with a checklist has it; one with none has no checklist', async () => {
  const full = await fromTemplate();
  try {
    await staff(`/api/workshop-checklists/${full.id}`, { method: 'PUT', body: { serviceIds: [standard.id] } });
    const job = await staffJob({ serviceIds: [standard.id] });
    assert.deepEqual(await checklistOf(job.id), { name: 'Full service checklist', items: TEMPLATE.map((label) => ({ label, done: false, note: null })), done: 0, total: 10, notes: 0 });
    assert.equal(await checklistOf((await staffJob({ serviceIds: [hub.id] })).id), null);
    assert.equal(await checklistOf((await staffJob()).id), null);
  } finally {
    await remove(full.id);
  }
});

test('an online booking has the checklist of its first service that has one', async () => {
  const full = await fromTemplate();
  try {
    await staff(`/api/workshop-checklists/${full.id}`, { method: 'PUT', body: { serviceIds: [standard.id] } });
    const customer = await portalSignup(server.baseUrl, owner.shop.slug, {});
    const booked = await portalRequest(server.baseUrl, customer.cookie, `/api/portal/${owner.shop.slug}/bookings`, { method: 'POST', body: {
      mechanicId: sam, jobDate: nextDay(), startTime: '10:00', description: 'Squeaks', newBike: { make: 'Dawes', model: 'Galaxy' },
      serviceIds: [hub.id, standard.id], ...BOOKING_CONTACT,
    } });
    assert.equal(booked.status, 201, JSON.stringify(booked.body));
    assert.equal((await checklistOf(booked.body.id)).name, 'Full service checklist');
  } finally {
    await remove(full.id);
  }
});

test('a job whose order has the service as a line has its checklist', async () => {
  const full = await fromTemplate();
  try {
    await staff(`/api/workshop-checklists/${full.id}`, { method: 'PUT', body: { serviceIds: [standard.id] } });
    const job = await staffJob();
    const lines = await staff(`/api/sale-documents/${job.orderId}/items`, { method: 'PUT', body: { items: [{ lineType: 'labour', serviceId: standard.id, qty: 1 }] } });
    assert.equal(lines.status, 200, JSON.stringify(lines.body));
    assert.equal((await checklistOf(job.id))?.total, 10);
  } finally {
    await remove(full.id);
  }
});

test('ticking and noting items, counted for the bar; an empty note is none', async () => {
  const full = await fromTemplate();
  try {
    await staff(`/api/workshop-checklists/${full.id}`, { method: 'PUT', body: { serviceIds: [standard.id] } });
    const job = await staffJob({ serviceIds: [standard.id] });
    assert.equal((await setItem(job.id, 0, { done: true })).status, 200);
    const noted = await setItem(job.id, 3, { note: ' The rear pads are worn. ' });
    assert.equal(noted.status, 200, JSON.stringify(noted.body));
    assert.deepEqual(noted.body.items[3], { label: 'Brakes bled & adjusted', done: false, note: 'The rear pads are worn.' });
    assert.deepEqual([noted.body.done, noted.body.total, noted.body.notes], [1, 10, 1]);
    // Staff who aren't the Owner tick too.
    assert.equal((await staffRequest(server.baseUrl, jo.cookie, `/api/workshop-jobs/${job.id}/checklist/items/1`, { method: 'PUT', body: { done: true } })).status, 200);
    const cleared = await setItem(job.id, 3, { note: '  ' });
    assert.equal(cleared.body.items[3].note, null);
    assert.deepEqual([cleared.body.done, cleared.body.notes], [2, 0]);
    assert.equal((await setItem(job.id, 0, { done: false })).body.done, 1);
  } finally {
    await remove(full.id);
  }
});

test('refusals: an item or job that isn’t there, a long note, a job with no checklist', async () => {
  const full = await fromTemplate();
  try {
    await staff(`/api/workshop-checklists/${full.id}`, { method: 'PUT', body: { serviceIds: [standard.id] } });
    const job = await staffJob({ serviceIds: [standard.id] });
    assert.equal((await setItem(job.id, 10, { done: true })).status, 404);
    assert.equal((await setItem(job.id, -1, { done: true })).status, 404);
    assert.equal((await setItem(job.id, 0, { note: 'x'.repeat(501) })).status, 400);
    assert.equal((await setItem(job.id, 0, { done: 'yes' })).status, 400);
    assert.equal((await setItem(999999, 0, { done: true })).status, 404);
    assert.equal((await setItem((await staffJob()).id, 0, { done: true })).status, 404);
  } finally {
    await remove(full.id);
  }
});

test('a job keeps the checklist it began with; one not yet ticked follows Settings', async () => {
  const full = await fromTemplate();
  try {
    await staff(`/api/workshop-checklists/${full.id}`, { method: 'PUT', body: { serviceIds: [standard.id] } });
    const begun = await staffJob({ serviceIds: [standard.id] });
    const untouched = await staffJob({ serviceIds: [standard.id] });
    await setItem(begun.id, 0, { done: true });
    await staff(`/api/workshop-checklists/${full.id}`, { method: 'PUT', body: { name: 'Service checklist', items: TEMPLATE.slice(0, 9) } });
    const kept = await checklistOf(begun.id);
    assert.deepEqual([kept.name, kept.total, kept.done], ['Full service checklist', 10, 1]);
    const followed = await checklistOf(untouched.id);
    assert.deepEqual([followed.name, followed.total], ['Service checklist', 9]);
    // Removing the checklist leaves the begun job's copy.
    await remove(full.id);
    assert.equal((await checklistOf(begun.id)).total, 10);
    assert.equal(await checklistOf(untouched.id), null);
  } catch (err) {
    await staff(`/api/workshop-checklists/${full.id}`, { method: 'DELETE' });
    throw err;
  }
});

test('finished work is frozen: ticks and notes are refused until it is reopened', async () => {
  const full = await fromTemplate();
  try {
    await staff(`/api/workshop-checklists/${full.id}`, { method: 'PUT', body: { serviceIds: [standard.id] } });
    let job = await staffJob({ serviceIds: [standard.id] });
    const step = async (action, body = {}) => {
      const res = await staff(`/api/workshop-jobs/${job.id}/${action}`, { method: 'POST', body: { version: job.version, ...body } });
      assert.equal(res.status, 200, JSON.stringify([action, res.body]));
      job = res.body;
    };
    await step('book-in');
    await step('start');
    await step('finish', { signedOffBy: sam });
    const refused = await setItem(job.id, 0, { done: true });
    assert.equal(refused.status, 409, JSON.stringify(refused.body));
    assert.equal(refused.body.code, 'illegal');
    await step('reopen-work');
    assert.equal((await setItem(job.id, 0, { done: true })).status, 200);
  } finally {
    await remove(full.id);
  }
});
