// Notes with the shop: the customer writes from their booking page, staff
// answer from one inbox (decisions 3 and 7, docs/decisions/2026-10-01-account-and-reminders-review.md;
// account.mjs; openspec/changes/notes-with-the-shop).
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
let maya;
let mayaBike;

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'Notes Cycles' });
  other = await staffSignup(server.baseUrl, { shopName: 'Other Notes Cycles' });
  maya = (await staff('/api/customers', { method: 'POST', body: { name: 'Maya Patel', phone: '07700 900142' } })).body;
  mayaBike = (await staff(`/api/customers/${maya.id}/bikes`, { method: 'POST', body: { make: 'Trek', model: 'Domane AL 3' } })).body;
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (other) await deleteTestShop(other.shop.id);
  if (server) await server.stop();
});

function staff(path, options, who = owner) {
  return staffRequest(server.baseUrl, who.cookie, path, options);
}
async function portal(path, options = {}, shop = owner) {
  const res = await fetch(`${server.baseUrl}/api/portal/${shop.shop.slug}${path}`, {
    method: options.method ?? 'GET',
    headers: { 'content-type': 'application/json' },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}
let jobDay = 5;
async function mayasJob() {
  const job = (await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Standard service', jobDate: `2026-10-${String(jobDay++).padStart(2, '0')}`, customerId: maya.id, bikeId: mayaBike.id } })).body;
  const code = (await staff(`/api/workshop-jobs/${job.id}/private-link`, { method: 'POST', body: {} })).body.privateLink.split('/booking/')[1];
  return { job, code };
}
const note = (code, text) => portal(`/booking-links/${code}/notes`, { method: 'POST', body: { text } });
const reply = (jobId, text, who) => staff(`/api/workshop-jobs/${jobId}/notes`, { method: 'POST', body: { text } }, who);
// The inbox, one row per customer since ask-the-shop (the old per-job list is gone).
const conversations = async (filter = 'all') => (await staff(`/api/customer-conversations?filter=${filter}`)).body;
const mayasRow = async (filter = 'all') => (await conversations(filter)).items.find((c) => c.customerId === maya.id);

test('the customer adds a note from their booking page and reads it back as theirs', async () => {
  const { job, code } = await mayasJob();
  const res = await note(code, '  Can you check the back light too?  ');
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const read = await portal(`/booking-links/${code}/notes`);
  assert.equal(read.status, 200, JSON.stringify(read.body));
  assert.equal(read.body.length, 1);
  assert.equal(read.body[0].fromCustomer, true);
  assert.equal(read.body[0].text, 'Can you check the back light too?');
  assert.ok(read.body[0].at);
  // Staff see it on the job.
  const onJob = (await staff(`/api/workshop-jobs/${job.id}/notes`)).body;
  assert.deepEqual(onJob.map((n) => [n.fromCustomer, n.text]), [[true, 'Can you check the back light too?']]);
});

test('an empty note, or one over 1,000 letters, is refused; a wrong code reads nothing', async () => {
  const { code } = await mayasJob();
  for (const text of ['   ', 'x'.repeat(1001), 7]) {
    const res = await note(code, text);
    assert.equal(res.status, 400, JSON.stringify(text));
    assert.equal(res.body.error, 'Write a note of up to 1,000 letters.');
  }
  assert.equal((await portal(`/booking-links/${'c'.repeat(64)}/notes`)).status, 404);
  assert.equal((await note('c'.repeat(64), 'Hello')).status, 404);
});

test('the customer’s newest note puts her conversation under Needs a reply, about its job', async () => {
  const { job, code } = await mayasJob();
  await note(code, 'First note');
  await note(code, 'Second note');
  const row = await mayasRow('needs-reply');
  assert.ok(row, 'listed under Needs a reply');
  assert.equal(row.needsReply, true);
  assert.equal(row.customerName, 'Maya Patel');
  assert.deepEqual(row.about, { jobId: job.id, reference: job.reference, bikeLabel: 'Trek Domane AL 3' });
  assert.equal(row.lastText, 'Second note');
  assert.ok((await conversations('needs-reply')).count >= 1);
});

test('a staff reply is saved, takes the conversation out of Needs a reply, and the customer is told', async () => {
  const { job, code } = await mayasJob();
  await note(code, 'Can you check the back light too?');
  const res = await reply(job.id, ' Yes, we’ll check it. ');
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.message.status, 'sent');
  assert.equal(await mayasRow('needs-reply'), undefined);
  assert.equal((await mayasRow('all')).needsReply, false);
  const told = (await staff(`/api/messages?jobId=${job.id}`)).body.find((m) => m.key === 'shop_reply');
  assert.ok(told, 'a Reply from the shop message');
  assert.match(told.body, /^Notes Cycles[^(]* replied about your Trek Domane AL 3 \(WH-\d+\): Yes, we’ll check it\. Replies to this number aren’t read — reply on your page: /);
  const theirs = (await portal(`/booking-links/${code}/notes`)).body;
  assert.deepEqual(theirs.map((n) => [n.fromCustomer, n.text]), [[true, 'Can you check the back light too?'], [false, 'Yes, we’ll check it.']]);
});

test('the customer sees a staff name only with the shop’s Show who signed off switch on', async () => {
  const { job, code } = await mayasJob();
  await reply(job.id, 'Your bike is ready early.');
  const setNames = async (on) => assert.equal((await staff('/api/workshop-settings', { method: 'PUT', body: { showSignOffToCustomers: on } })).status, 200);
  try {
    await setNames(false);
    const off = (await portal(`/booking-links/${code}/notes`)).body[0];
    assert.ok(off.from.startsWith('Notes Cycles'));
    assert.ok(!off.from.includes(','), 'no staff name');
    await setNames(true);
    const on = (await portal(`/booking-links/${code}/notes`)).body[0];
    assert.match(on.from, /^.+, Notes Cycles/);
  } finally {
    await setNames(false);
  }
});

test('a reply to a job with no notes yet starts the conversation; empty replies are refused', async () => {
  const { job } = await mayasJob();
  assert.equal((await reply(job.id, '   ')).status, 400);
  assert.equal((await reply(job.id, 'x'.repeat(1001))).status, 400);
  assert.equal((await reply(job.id, 'We found a worn chain.')).status, 201);
  assert.equal((await mayasRow('all')).needsReply, false);
});

test('another shop can’t read or answer this shop’s notes', async () => {
  const { job, code } = await mayasJob();
  await note(code, 'Private to Notes Cycles');
  assert.equal((await staff(`/api/workshop-jobs/${job.id}/notes`, undefined, other)).status, 404);
  assert.equal((await reply(job.id, 'Hello from elsewhere', other)).status, 404);
  assert.equal((await staff('/api/customer-conversations?filter=all', undefined, other)).body.items.some((c) => c.lastText === 'Private to Notes Cycles'), false);
  assert.equal((await portal(`/booking-links/${code}/notes`, {}, other)).status, 404);
});

// From the fresh review.
async function expire(jobId) {
  // Collected well before the test clock's today (1 Sep 2026): its page has closed.
  await runWithShop(owner.shop.id, () => prepare(
    "UPDATE workshop_jobs SET custody_state = 'collected', collected_at = '2026-07-01T12:00:00Z' WHERE id = ?"
  ).run(jobId));
}

test('a closed booking page takes no notes and shows none', async () => {
  const { job, code } = await mayasJob();
  await note(code, 'Before it closed');
  await expire(job.id);
  assert.equal((await portal(`/booking-links/${code}/notes`)).status, 410);
  assert.equal((await note(code, 'After it closed')).status, 410);
});

test('a reply on a job whose page has closed is saved, and no text with a dead link goes', async () => {
  const { job } = await mayasJob();
  await expire(job.id);
  const res = await reply(job.id, 'Thanks for coming in.');
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.message.status, 'not_sent');
  assert.equal(res.body.message.reason, 'Maya Patel’s booking page has closed.');
  assert.equal((await staff(`/api/messages?jobId=${job.id}`)).body.filter((m) => m.key === 'shop_reply').length, 0);
});

test('with Reply from the shop switched off, the reply is saved and says no text went', async () => {
  assert.equal((await staff('/api/message-templates/shop_reply', { method: 'PUT', body: { enabled: false } })).status, 200);
  try {
    const { job } = await mayasJob();
    const res = await reply(job.id, 'Saved but not sent.');
    assert.equal(res.status, 201);
    assert.equal(res.body.message.status, 'not_sent');
    assert.match(res.body.message.reason, /switched off/);
  } finally {
    await staff('/api/message-templates/shop_reply', { method: 'PUT', body: { enabled: true } });
  }
});

test('a body that isn’t an object is refused in words, not an error page', async () => {
  const { job, code } = await mayasJob();
  const raw = await fetch(`${server.baseUrl}/api/portal/${owner.shop.slug}/booking-links/${code}/notes`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: 'null' });
  assert.equal(raw.status, 400);
  const staffRaw = await staffRequest(server.baseUrl, owner.cookie, `/api/workshop-jobs/${job.id}/notes`, { method: 'POST', body: null });
  assert.notEqual(staffRaw.status, 500);
});

test('Settings’ preview of Reply from the shop shows a reply', async () => {
  const preview = await staff('/api/message-templates/shop_reply/preview', { method: 'POST', body: {} });
  assert.equal(preview.status, 200, JSON.stringify(preview.body));
  assert.match(preview.body.text, /\(WH-1042\): \[Jo’s reply\]\. Replies to this number/);
});

test('All lists conversations needing a reply first, then the newest', async () => {
  const waiting = await mayasJob();
  await note(waiting.code, 'Older, still waiting');
  const oliver = (await staff('/api/customers', { method: 'POST', body: { name: 'Oliver Chen', phone: '07700 900143' } })).body;
  const job = (await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Standard service', jobDate: '2026-10-28', customerId: oliver.id } })).body;
  await reply(job.id, 'Answered just now');
  const items = (await conversations('all')).items;
  const at = (id) => items.findIndex((c) => c.customerId === id);
  assert.ok(at(oliver.id) >= 0 && at(maya.id) >= 0);
  assert.ok(at(maya.id) < at(oliver.id), 'waiting before the newer answered one');
});

test('the old per-job inbox list is gone', async () => {
  assert.equal((await staff('/api/job-notes/conversations?filter=all')).status, 404);
});
