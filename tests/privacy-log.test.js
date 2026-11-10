// Logging a privacy request by hand, sending the copy, and store credit lost on deletion
// (openspec/changes/finish-customers, design 7, task 7.1; cs-privacy; Jack's 9 Nov answer 6;
// question 7). The Owner logs that Maya Patel asked in person, by phone, email or letter; the
// answer is due one month on. Send the copy gives the account's copy with the shop's notes
// added, downloaded or emailed, and marks the request done. Privacy requests' days are the
// database's, as tests/delete-account.test.js has them, so they're worked out from its today.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import '../server/load-env.js';
import { runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let owner;
let jo;

const staff = (p, options, who = owner) => staffRequest(server.baseUrl, who.cookie, p, options);
const inShop = (fn) => runWithShop(owner.shop.id, fn);
// The shop's day, days from its today (and a month on), as the database works them out.
const dayFrom = (days, month = false) => inShop(async () => (await prepare(
  `SELECT to_char((now() AT TIME ZONE coalesce((SELECT time_zone FROM workshop_settings LIMIT 1), 'Europe/London'))::date + ?::int${month ? " + interval '1 month'" : ''}, 'YYYY-MM-DD') AS day`
).get(days)).day);
let today;

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  const made = await staff('/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `jo-${randomUUID().slice(0, 8)}@example.test`, password: 'password123' } });
  jo = { cookie: await staffFreshCookie(made.body.loginId) };
  today = await dayFrom(0);
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
});

// Maya Patel, with the shop's own note about her and her Trek.
async function maya({ email = 'maya@example.test' } = {}) {
  const made = (await staff('/api/customers', { method: 'POST', body: { name: 'Maya Patel', email } })).body;
  const bike = (await staff(`/api/customers/${made.id}/bikes`, { method: 'POST', body: { make: 'Trek', model: 'Domane AL 3', colour: 'Green' } })).body;
  await inShop(async () => {
    await prepare('UPDATE customers SET notes = ? WHERE id = ?').run('[Shop’s note about her]', made.id);
    await prepare('UPDATE customer_bikes SET notes = ? WHERE id = ?').run('[Shop’s note about her bike]', bike.id);
  });
  return made.id;
}
const log = (body, who = owner) => staff('/api/privacy-requests', { method: 'POST', body }, who);
const rowOf = async (id) => (await staff('/api/privacy-requests')).body.requests.find((r) => r.id === id);
async function sendCopy(id, send, who = owner) {
  const res = await fetch(`${server.baseUrl}/api/privacy-requests/${id}/copy`, {
    method: 'POST', headers: { 'content-type': 'application/json', cookie: who.cookie }, body: JSON.stringify({ send }),
  });
  const type = res.headers.get('content-type') ?? '';
  return { status: res.status, type, disposition: res.headers.get('content-disposition'), body: type.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer()) };
}

test('the Owner logs that Maya asked in person today: from the shop, how she asked, due one month on', async () => {
  const id = await maya();
  const made = await log({ customerId: id, kind: 'copy', askedOn: today, how: 'in_person' });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  const row = await rowOf(made.body.id);
  const due = await dayFrom(0, true);
  assert.deepEqual(
    { name: row.name, kind: row.kind, source: row.source, how: row.how, askedOn: row.askedOn, dueBy: row.dueBy, overdue: row.overdue, doneOn: row.doneOn, hasEmail: row.hasEmail },
    { name: 'Maya Patel', kind: 'copy', source: 'shop', how: 'in_person', askedOn: today, dueBy: due, overdue: false, doneOn: null, hasEmail: true },
  );
});

test('a letter that came more than a month ago is Overdue at once', async () => {
  const id = await maya();
  const made = await log({ customerId: id, kind: 'delete', askedOn: await dayFrom(-40), how: 'letter' });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  const row = await rowOf(made.body.id);
  assert.equal(row.dueBy, await dayFrom(-40, true));
  assert.equal(row.overdue, true);
});

test('what can’t be logged: a day after today, no how, no kind, nobody, a second open one of the same kind; only the Owner', async () => {
  const id = await maya();
  const good = { customerId: id, kind: 'copy', askedOn: today, how: 'phone' };
  const tomorrow = await dayFrom(1);
  assert.deepEqual([(await log({ ...good, askedOn: tomorrow })).status, (await log({ ...good, askedOn: tomorrow })).body.error], [400, 'The day they asked can’t be in the future']);
  assert.deepEqual([(await log({ ...good, askedOn: '[date]' })).status, (await log({ ...good, askedOn: '[date]' })).body.error], [400, 'Give the day they asked']);
  assert.deepEqual((await log({ ...good, how: 'carrier pigeon' })).body.error, 'Choose how they asked');
  assert.deepEqual((await log({ ...good, kind: 'both' })).body.error, 'Choose what they asked for');
  assert.equal((await log({ ...good, customerId: 999999 })).status, 404);
  assert.equal((await log(good, jo)).status, 403);
  assert.equal((await log(good)).status, 201);
  const again = await log({ ...good, how: 'email' });
  assert.deepEqual([again.status, again.body.error], [409, 'Maya Patel already has an open request for a copy of their data']);
  // A deletion is another kind, so it can be logged beside it.
  assert.equal((await log({ ...good, kind: 'delete' })).status, 201);
  const open = await inShop(() => prepare("SELECT count(*)::int AS n FROM privacy_requests WHERE customer_id = ? AND source = 'shop'").get(id));
  assert.equal(open.n, 2);
});

test('Download it: the account’s copy with the shop’s notes on her and her bike, and the request is done', async () => {
  const id = await maya();
  const { body: { id: req } } = await log({ customerId: id, kind: 'copy', askedOn: today, how: 'in_person' });
  assert.equal((await sendCopy(req, 'download', jo)).status, 403);
  assert.equal((await rowOf(req)).doneOn, null);
  const got = await sendCopy(req, 'download');
  assert.equal(got.status, 200);
  assert.equal(got.type, 'application/zip');
  assert.equal(got.disposition, `attachment; filename="${owner.shop.slug}-maya-patel-data-${today}.zip"`);
  // Stored, not compressed, so each file's words are in the zip as they are.
  const text = got.body.toString('utf8');
  for (const name of ['your-details.csv', 'your-bikes.csv', 'shop-notes.csv']) assert.ok(text.includes(name), name);
  assert.ok(text.includes('Maya Patel'));
  assert.ok(text.includes('[Shop’s note about her]'));
  assert.ok(text.includes('Trek Domane AL 3') && text.includes('[Shop’s note about her bike]'));
  assert.equal((await rowOf(req)).doneOn, today);
  const twice = await sendCopy(req, 'download');
  assert.deepEqual([twice.status, twice.body.error], [409, 'That request has already been dealt with.']);
});

test('Email it: one email with her copy is queued to her, and the request is done', async () => {
  const id = await maya();
  const { body: { id: req } } = await log({ customerId: id, kind: 'copy', askedOn: today, how: 'email' });
  const sent = await sendCopy(req, 'email');
  assert.equal(sent.status, 200, JSON.stringify(sent.body));
  const emails = await inShop(() => prepare("SELECT to_address, subject, body, template_key FROM customer_messages WHERE customer_id = ? AND channel = 'email'").all(id));
  assert.equal(emails.length, 1);
  assert.equal(emails[0].to_address, 'maya@example.test');
  assert.equal(emails[0].template_key, 'data_copy');
  assert.equal(emails[0].subject, `Your data from ${owner.shop.name}`);
  assert.ok(emails[0].body.includes('shop-notes.csv') && emails[0].body.includes('[Shop’s note about her bike]'));
  assert.equal((await rowOf(req)).doneOn, today);
});

test('no email: Email it is refused and nothing is sent; Download it still works', async () => {
  const id = await maya({ email: '' });
  const { body: { id: req } } = await log({ customerId: id, kind: 'copy', askedOn: today, how: 'phone' });
  assert.equal((await rowOf(req)).hasEmail, false);
  const sent = await sendCopy(req, 'email');
  assert.deepEqual([sent.status, sent.body.error], [409, 'Maya Patel has no email address. Download the copy instead.']);
  assert.equal((await inShop(() => prepare('SELECT count(*)::int AS n FROM customer_messages WHERE customer_id = ?').get(id))).n, 0);
  assert.equal((await rowOf(req)).doneOn, null);
  assert.equal((await sendCopy(req, 'download')).status, 200);
});

test('a deletion request has no copy to send', async () => {
  const id = await maya();
  const { body: { id: req } } = await log({ customerId: id, kind: 'delete', askedOn: today, how: 'in_person' });
  assert.equal((await sendCopy(req, 'download')).status, 404);
  assert.equal((await sendCopy(req, 'post')).status, 400);
});

test('store credit shows on her deletion row without holding it back, and is written off with no name when deleted', async () => {
  const id = await maya();
  await inShop(() => prepare("INSERT INTO store_credit_entries (customer_id, change_pence, kind, reason, who_name) VALUES (?, 2500, 'added', '[Reason]', 'Jack Lewis')").run(id));
  const { body: { id: req } } = await log({ customerId: id, kind: 'delete', askedOn: today, how: 'in_person' });
  const row = await rowOf(req);
  assert.equal(row.storeCreditPence, 2500);
  assert.deepEqual(row.inTheWay, []);
  assert.equal((await staff(`/api/privacy-requests/${req}/delete`, { method: 'POST' })).status, 200);
  const entries = await inShop(() => prepare('SELECT change_pence, kind, reason, who_name, login_id FROM store_credit_entries WHERE customer_id = ? ORDER BY id').all(id));
  assert.deepEqual(entries.at(-1), { change_pence: -2500, kind: 'lost_on_deletion', reason: 'Lost when their details were deleted', who_name: null, login_id: null });
  assert.equal(entries.reduce((s, e) => s + e.change_pence, 0), 0);
  assert.equal((await rowOf(req)).storeCreditPence, undefined);
});
