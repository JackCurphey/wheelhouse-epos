// "Ask the shop a question": one running conversation per customer (Jack, 26
// Oct, docs/decisions/2026-10-26-day-answers.md sections 2 and 8; account.mjs
// conversationPage, ac-ask, ac-question, ac-account-asked;
// openspec/changes/ask-the-shop-server). The customer's general messages, their
// notes on each repair (marked with it) and the shop's replies, in one thread
// on their account and one row in the staff inbox.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
import { readCookie } from './helpers/http.js';
import { CUSTOMER_SESSION_COOKIE } from '../server/customer-auth.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let owner;
let other;

before(async () => {
  // Each sign-up from its own network, past the sign-up limit.
  server = await startLiveServer({ env: { TRUST_PROXY: '1' } });
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  other = await staffSignup(server.baseUrl, { shopName: 'Elsewhere Cycles' });
});
after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (other) await deleteTestShop(other.shop.id);
  if (server) await server.stop();
});

const staff = (path, options, who = owner) => staffRequest(server.baseUrl, who.cookie, path, options);
async function portal(path, { cookie, method = 'GET', body, shop = owner, headers = {} } = {}) {
  const res = await fetch(`${server.baseUrl}/api/portal/${shop.shop.slug}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null), cache: res.headers.get('cache-control') };
}

// A customer signed in at the shop, with a bike, as the account's customers are.
let network = 0;
async function customer(name) {
  const res = await fetch(`${server.baseUrl}/api/portal/${owner.shop.slug}/signup`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': `198.51.100.${++network}` },
    body: JSON.stringify({ name, email: `c${network}-${Date.now()}@example.test`, password: 'password123' }),
  });
  const login = await res.json();
  assert.equal(res.status, 201, JSON.stringify(login));
  const cookie = readCookie(res, CUSTOMER_SESSION_COOKIE);
  const { rows: [l] } = await pool.query('SELECT customer_id FROM customer_logins WHERE id = $1', [login.id]);
  const bike = (await staff(`/api/customers/${l.customer_id}/bikes`, { method: 'POST', body: { make: 'Trek', model: 'Domane AL 3' } })).body;
  return { id: l.customer_id, cookie, bike };
}
let jobDay = 5;
async function jobFor(c) {
  const job = (await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Standard service', jobDate: `2026-10-${String(jobDay++).padStart(2, '0')}`, customerId: c.id, bikeId: c.bike.id } })).body;
  const code = (await staff(`/api/workshop-jobs/${job.id}/private-link`, { method: 'POST', body: {} })).body.privateLink.split('/booking/')[1];
  return { job, code };
}
const jobNote = (code, text) => portal(`/booking-links/${code}/notes`, { method: 'POST', body: { text } });
const ask = (c, text, headers = {}) => portal('/messages', { cookie: c.cookie, method: 'POST', body: { text }, headers });
const read = (c) => portal('/messages', { cookie: c.cookie });
const inbox = async (filter = 'all', who = owner) => (await staff(`/api/customer-conversations?filter=${filter}`, undefined, who)).body;
const staffReply = (c, body, who = owner) => staff(`/api/customer-conversations/${c.id}/messages`, { method: 'POST', body }, who);
const queued = (customerId, key) => runWithShop(owner.shop.id, () => prepare(
  'SELECT body, channel FROM customer_messages WHERE customer_id = ? AND template_key = ? ORDER BY id'
).all(customerId, key));

test('Maya’s conversation: her note on a repair, marked with it, the shop’s reply, then her question, oldest first', async () => {
  const maya = await customer('Maya Patel');
  const { job, code } = await jobFor(maya);
  assert.equal((await jobNote(code, '[Maya’s note to the shop]')).status, 201);
  assert.equal((await staff(`/api/workshop-jobs/${job.id}/notes`, { method: 'POST', body: { text: '[Jo’s reply]' } })).status, 201);
  const sent = await ask(maya, '  [Maya’s message]  ');
  assert.equal(sent.status, 201, JSON.stringify(sent.body));
  assert.equal(sent.cache, 'no-store');
  const res = await read(maya);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.cache, 'no-store');
  assert.match(res.body.shopName, /^North Street Cycles/);
  assert.deepEqual(res.body.items.map((m) => [m.fromCustomer, m.text, m.about?.reference ?? null]), [
    [true, '[Maya’s note to the shop]', job.reference],
    [false, '[Jo’s reply]', job.reference],
    [true, '[Maya’s message]', null],
  ]);
  assert.equal(res.body.items[0].about.jobId, job.id);
  assert.equal(res.body.items[0].from, 'You');
  assert.match(res.body.items[1].from, /^North Street Cycles/);
  assert.ok(res.body.items.every((m) => Date.parse(m.at)));
  assert.deepEqual(sent.body.items, res.body.items, 'the POST answers with the conversation');
});

test('an empty message, one over 1,000 letters or one that isn’t words is refused, and nothing is added', async () => {
  const sam = await customer('Sam Reed');
  for (const text of ['   ', 'x'.repeat(1001), 7]) {
    const res = await ask(sam, text);
    assert.equal(res.status, 400, JSON.stringify(text));
    assert.equal(res.body.error, 'Write a message of up to 1,000 letters.');
  }
  assert.deepEqual((await read(sam)).body.items, []);
});

test('only the signed-in customer reads or writes their conversation, at their own shop', async () => {
  const maya = await customer('Maya Patel');
  const sam = await customer('Sam Reed');
  await ask(maya, 'Private to Maya');
  assert.equal((await portal('/messages')).status, 401, 'signed out');
  assert.equal((await portal('/messages', { method: 'POST', body: { text: 'Hello' } })).status, 401);
  assert.equal((await read(sam)).body.items.some((m) => m.text === 'Private to Maya'), false, 'another customer');
  assert.equal((await portal('/messages', { cookie: maya.cookie, shop: other })).status, 401, 'another shop');
  assert.equal((await portal('/messages', { cookie: maya.cookie, shop: other, method: 'POST', body: { text: 'Hi' } })).status, 401);
});

test('a message from another website is refused and nothing is added; from the shop’s own pages it goes', async () => {
  const maya = await customer('Maya Patel');
  const res = await ask(maya, 'From elsewhere', { 'sec-fetch-site': 'cross-site' });
  assert.equal(res.status, 403);
  assert.equal(res.body.error, 'This can only be done from the shop’s own pages');
  assert.equal((await ask(maya, 'From elsewhere', { 'sec-fetch-site': 'same-site' })).status, 403);
  assert.deepEqual((await read(maya)).body.items, []);
  assert.equal((await ask(maya, 'From here', { 'sec-fetch-site': 'same-origin' })).status, 201);
});

test('the history has one messages item: when, and whether the shop has replied', async () => {
  const maya = await customer('Maya Patel');
  const none = await portal('/history', { cookie: maya.cookie });
  assert.equal(none.body.some((i) => i.kind === 'messages'), false, 'nothing until a message');
  const { job, code } = await jobFor(maya);
  await jobNote(code, 'About the repair');
  await ask(maya, 'A question');
  let items = (await portal('/history', { cookie: maya.cookie })).body.filter((i) => i.kind === 'messages');
  assert.equal(items.length, 1, 'one row for the conversation');
  assert.equal(items[0].shopReplied, false);
  const newest = (await read(maya)).body.items.at(-1).at;
  assert.equal(items[0].at, newest);
  await staffReply(maya, { text: 'An answer' });
  items = (await portal('/history', { cookie: maya.cookie })).body.filter((i) => i.kind === 'messages');
  assert.equal(items[0].shopReplied, true);
  assert.ok(job.id);
});

test('the inbox has one row per customer, needing a reply while the customer spoke last', async () => {
  const maya = await customer('Maya Patel');
  const first = await jobFor(maya);
  const second = await jobFor(maya);
  await jobNote(first.code, 'On the first repair');
  await jobNote(second.code, 'On the second repair');
  await ask(maya, 'And a question');
  const rows = (await inbox('needs-reply')).items.filter((r) => r.customerId === maya.id);
  assert.equal(rows.length, 1, 'one row for Maya');
  assert.deepEqual([rows[0].customerName, rows[0].lastText, rows[0].needsReply, rows[0].about], ['Maya Patel', 'And a question', true, null]);
  assert.ok(Date.parse(rows[0].lastAt));
  // Her repair note newest: the row says which repair.
  await jobNote(second.code, 'Newest, on the second');
  const row = (await inbox('all')).items.find((r) => r.customerId === maya.id);
  assert.deepEqual(row.about, { jobId: second.job.id, reference: second.job.reference, bikeLabel: 'Trek Domane AL 3' });
  // The thread, for staff: everything, each repair note marked.
  const thread = await staff(`/api/customer-conversations/${maya.id}`);
  assert.equal(thread.status, 200, JSON.stringify(thread.body));
  assert.equal(thread.body.customerName, 'Maya Patel');
  assert.deepEqual(thread.body.items.map((m) => [m.text, m.about?.reference ?? null]), [
    ['On the first repair', first.job.reference], ['On the second repair', second.job.reference], ['And a question', null], ['Newest, on the second', second.job.reference],
  ]);
});

test('a general reply is saved, answers the conversation and sends Reply to a message', async () => {
  const maya = await customer('Maya Patel');
  await ask(maya, 'Do you sell inner tubes?');
  const res = await staffReply(maya, { text: ' Yes, we do. ' });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.message.status, 'sent');
  assert.equal(res.body.items.at(-1).text, 'Yes, we do.');
  assert.equal(res.body.items.at(-1).about, null);
  assert.equal((await inbox('needs-reply')).items.some((r) => r.customerId === maya.id), false);
  const told = await queued(maya.id, 'message_reply');
  assert.equal(told.length, 1);
  assert.match(told[0].body, /^North Street Cycles.* replied to your message: \[link\]$/);
  assert.equal((await read(maya)).body.items.at(-1).text, 'Yes, we do.');
});

test('a reply about one of her repairs is a note on it, and sends Reply from the shop', async () => {
  const maya = await customer('Maya Patel');
  const sam = await customer('Sam Reed');
  const { job, code } = await jobFor(maya);
  await jobNote(code, 'Can you check the back light?');
  const res = await staffReply(maya, { text: 'Yes, we’ll check it.', jobId: job.id });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.message.status, 'sent');
  assert.equal(res.body.items.at(-1).about.jobId, job.id);
  const onJob = (await staff(`/api/workshop-jobs/${job.id}/notes`)).body;
  assert.equal(onJob.at(-1).text, 'Yes, we’ll check it.');
  assert.equal((await queued(maya.id, 'shop_reply')).length, 1);
  assert.equal((await queued(maya.id, 'message_reply')).length, 0);
  // Someone else's repair, an empty reply: refused, nothing saved.
  const samsJob = (await jobFor(sam)).job;
  assert.equal((await staffReply(maya, { text: 'Wrong job', jobId: samsJob.id })).status, 404);
  assert.equal((await staffReply(maya, { text: '   ' })).status, 400);
  assert.equal((await staff(`/api/workshop-jobs/${samsJob.id}/notes`)).body.length, 0);
});

test('with Reply to a message switched off, the reply is saved and says no message went', async () => {
  assert.equal((await staff('/api/message-templates/message_reply', { method: 'PUT', body: { enabled: false } })).status, 200);
  try {
    const maya = await customer('Maya Patel');
    await ask(maya, 'Are you open Sunday?');
    const res = await staffReply(maya, { text: 'No, sorry.' });
    assert.equal(res.status, 201);
    assert.equal(res.body.message.status, 'not_sent');
    assert.match(res.body.message.reason, /Reply to a message is switched off/);
    assert.equal((await queued(maya.id, 'message_reply')).length, 0);
  } finally {
    await staff('/api/message-templates/message_reply', { method: 'PUT', body: { enabled: true } });
  }
});

test('Settings’ preview of Reply to a message', async () => {
  const preview = await staff('/api/message-templates/message_reply/preview', { method: 'POST', body: {} });
  assert.equal(preview.status, 200, JSON.stringify(preview.body));
  assert.match(preview.body.text, /replied to your message: \[link\]$/);
});

test('another shop can’t see or answer this shop’s conversations', async () => {
  const maya = await customer('Maya Patel');
  await ask(maya, 'Private to North Street');
  assert.equal((await inbox('all', other)).items.some((r) => r.customerId === maya.id), false);
  assert.equal((await staff(`/api/customer-conversations/${maya.id}`, undefined, other)).status, 404);
  assert.equal((await staffReply(maya, { text: 'Hello from elsewhere' }, other)).status, 404);
  assert.equal((await read(maya)).body.items.length, 1);
});

test('Today counts customers waiting, as the inbox does', async () => {
  const before = (await inbox('needs-reply')).count;
  const lena = await customer('Lena Fox');
  const a = await jobFor(lena);
  const b = await jobFor(lena);
  await jobNote(a.code, 'One');
  await jobNote(b.code, 'Two');
  await ask(lena, 'Three');
  const count = (await inbox('needs-reply')).count;
  assert.equal(count, before + 1, 'Lena once');
  const line = (await staff('/api/needs-attention')).body.items.find((i) => i.kind === 'replies');
  assert.equal(line.count, count);
});
