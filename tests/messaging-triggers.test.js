// The first messages through the engine (the messages engine, Jack 20 Oct:
// pretend for now; openspec/changes/messages-engine/design.md "Triggers"):
// sending a quote queues Quote to approve, marking a job ready queues Bike
// ready with a minute to Undo (UX walk-through 1 H2), and the old app's
// one-off text goes through the pretend sender too.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';
import { formatOpeningHours } from '../server/messaging/templates.js';

let server;
let owner;
let alex;
let shopName;
before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  alex = await seedMechanic(owner.shop.id, { name: 'Alex Morgan' });
  shopName = (await staff('/api/shop-details')).body.name;
});
after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const staff = (path, options) => staffRequest(server.baseUrl, owner.cookie, path, options);
const inShop = (fn) => runWithShop(owner.shop.id, fn);
const messagesFor = (jobId) => inShop(() => prepare('SELECT * FROM customer_messages WHERE job_id = ? ORDER BY id').all(jobId));

// Maya Patel's Trek Domane AL 3 (the drawings' example), a job in progress
// with £111.00 of work on its order.
async function mayasJob({ phone = '07700 900142', email = null } = {}) {
  const customer = (await staff('/api/customers', { method: 'POST', body: { name: 'Maya Patel', phone, email } })).body;
  const bikeId = await inShop(async () => (await prepare("INSERT INTO customer_bikes (customer_id, make, model) VALUES (?, 'Trek', 'Domane AL 3') RETURNING id").get(customer.id)).id);
  let job = (await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Standard service', jobDate: '2026-10-13', mechanicId: alex, customerId: customer.id, bikeId } })).body;
  assert.ok(job.id, JSON.stringify(job));
  for (const step of ['book-in', 'start']) job = (await staff(`/api/workshop-jobs/${job.id}/${step}`, { method: 'POST', body: { version: job.version } })).body;
  const items = await staff(`/api/sale-documents/${job.orderId}/items`, { method: 'PUT', body: { items: [{ lineType: 'labour', name: 'Standard service', unitPrice: 111, minutes: 60 }] } });
  assert.equal(items.status, 200, JSON.stringify(items.body));
  return { customer, job };
}
const finish = (job) => staff(`/api/workshop-jobs/${job.id}/finish`, { method: 'POST', body: { version: job.version, signedOffBy: alex } });
// Whether a booking link still opens, through the customer's own API (the
// page itself answers 200 for any code).
const linkWorks = async (link) => {
  const [, slug, code] = new URL(link, server.baseUrl).pathname.match(/^\/book\/([^/]+)\/booking\/([0-9a-f]+)$/);
  return (await fetch(`${server.baseUrl}/api/portal/${slug}/booking-links/${code}`)).status === 200;
};
const giveLink = async (job) => (await staff(`/api/workshop-jobs/${job.id}/private-link`, { method: 'POST', body: {} })).body.privateLink;

test('opening hours read as days and times, like days of the week run together', () => {
  const day = (weekday, open = '09:00', close = '18:00') => ({ weekday, open, close });
  assert.equal(formatOpeningHours([1, 2, 3, 4, 5].map((w) => day(w)).concat(day(6, '09:00', '16:00'))), 'Mon to Fri 9:00 to 18:00, Sat 9:00 to 16:00');
  assert.equal(formatOpeningHours([day(2), day(4)]), 'Tue 9:00 to 18:00, Thu 9:00 to 18:00');
  assert.equal(formatOpeningHours([day(0, '10:00', '16:00'), day(1), day(2)]), 'Mon and Tue 9:00 to 18:00, Sun 10:00 to 16:00');
  assert.equal(formatOpeningHours([]), '');
});

test('marking a job ready queues Bike ready to go in a minute, the customer’s link left working, and Undo stops it', async () => {
  const { job } = await mayasJob();
  const old = await giveLink(job);
  assert.equal(await linkWorks(old), true);
  const before = Date.now();
  const res = await finish(job);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const ready = res.body.readyMessage;
  assert.equal(ready.channel, 'sms');
  assert.equal(ready.to, '07700 900142');
  const wait = Date.parse(ready.sendAfter) - before;
  assert.ok(wait > 55_000 && wait < 65_000, `about a minute, was ${wait} ms`);
  const [row] = await messagesFor(job.id);
  assert.equal(row.id, ready.id);
  assert.equal(row.template_key, 'bike_ready');
  assert.equal(row.intent_state, 'intended');
  const reference = (await staff(`/api/workshop-jobs/${job.id}`)).body.reference;
  assert.match(reference, /^WH-\d+$/);
  const expected = new RegExp(`^Hi Maya, your Trek Domane AL 3 is ready to collect from ${shopName}\\. £111\\.00 to pay on collection\\. See what we did: \\[link\\]\\. Job ${reference}\\. We’re open .+\\.$`);
  assert.match(row.body, expected);
  // The link in the message opens the job's booking page.
  // Pretend: no new link is issued, so the customer's own keeps working
  // (fresh review: a new link nobody receives only stops theirs).
  assert.equal(await linkWorks(old), true);
  const undone = await staff(`/api/messages/${ready.id}/undo`, { method: 'POST', body: {} });
  assert.equal(undone.status, 200, JSON.stringify(undone.body));
  assert.equal((await messagesFor(job.id))[0].intent_state, 'undone');
});

test('Bike ready switched off, or no way to reach the customer, sends nothing and says why', async () => {
  const off = await mayasJob();
  const offLink = await giveLink(off.job);
  assert.equal((await staff('/api/message-templates/bike_ready', { method: 'PUT', body: { enabled: false } })).status, 200);
  try {
    const res = await finish(off.job);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body.readyMessage, { skipped: 'off' });
    assert.equal((await messagesFor(off.job.id)).length, 0);
    assert.equal(await linkWorks(offLink), true, 'no message, so the customer keeps their link');
  } finally {
    await staff('/api/message-templates/bike_ready', { method: 'PUT', body: { enabled: true } });
  }
  const none = await mayasJob({ phone: null });
  const noneLink = await giveLink(none.job);
  const res = await finish(none.job);
  assert.deepEqual(res.body.readyMessage, { skipped: 'no_contact' });
  assert.equal(await linkWorks(noneLink), true);
});

test('reopening the work stops a Bike ready still waiting its minute', async () => {
  const { job } = await mayasJob();
  const done = (await finish(job)).body;
  const reopened = await staff(`/api/workshop-jobs/${job.id}/reopen-work`, { method: 'POST', body: { version: done.version } });
  assert.equal(reopened.status, 200, JSON.stringify(reopened.body));
  const [row] = await messagesFor(job.id);
  assert.equal(row.intent_state, 'undone');
});

test('Amount to pay leaves out a cancelled order', async () => {
  const { job } = await mayasJob();
  await inShop(() => prepare("INSERT INTO sale_documents (kind, status, subtotal, discount, total, workshop_job_id, title) VALUES ('order', 'cancelled', 999, 0, 999, ?, 'Old')").run(job.id));
  const res = await finish(job);
  const [row] = await messagesFor(job.id);
  assert.match(row.body, /£111\.00 to pay on collection/, res.body.readyMessage && row.body);
});

test('sending a quote queues Quote to approve through the engine, pretend, at once', async () => {
  const { customer, job } = await mayasJob({ phone: null, email: 'maya@example.test' });
  const quote = await staff(`/api/workshop-jobs/${job.id}/quotes`, { method: 'POST', body: { lines: [{ kind: 'labour', description: 'Rear brake bleed', unitAmount: 25 }] } });
  assert.equal(quote.status, 201, JSON.stringify(quote.body));
  const sent = await staff(`/api/quotes/${quote.body.id}/send`, { method: 'POST' });
  assert.equal(sent.status, 200, JSON.stringify(sent.body));
  assert.deepEqual(sent.body.message, { status: 'sent', channel: 'email', to: 'maya@example.test', pretend: true });
  const [row] = await messagesFor(job.id);
  assert.equal(row.template_key, 'quote_to_approve');
  assert.equal(row.customer_id, customer.id);
  assert.equal(row.channel, 'email');
  assert.equal(row.subject, `A quote to approve — ${shopName}`);
  assert.ok(row.body.includes(sent.body.link), 'the link that was issued');
  assert.ok(Date.parse(row.send_after) <= Date.now(), 'no further wait: the panel had its minute');
});

test('a quote for a customer with no phone or email, or with the message off, says why no message went', async () => {
  const { job } = await mayasJob({ phone: null });
  const quote = await staff(`/api/workshop-jobs/${job.id}/quotes`, { method: 'POST', body: { lines: [{ kind: 'labour', description: 'Rear brake bleed', unitAmount: 25 }] } });
  const sent = await staff(`/api/quotes/${quote.body.id}/send`, { method: 'POST' });
  assert.deepEqual(sent.body.message, { status: 'not_sent', reason: 'Maya Patel has no phone number or email on file.' });

  const second = await mayasJob();
  await staff('/api/message-templates/quote_to_approve', { method: 'PUT', body: { enabled: false } });
  try {
    const q = await staff(`/api/workshop-jobs/${second.job.id}/quotes`, { method: 'POST', body: { lines: [{ kind: 'labour', description: 'Rear brake bleed', unitAmount: 25 }] } });
    const res = await staff(`/api/quotes/${q.body.id}/send`, { method: 'POST' });
    assert.deepEqual(res.body.message, { status: 'not_sent', reason: 'Quote to approve is switched off in Settings › Messages.' });
  } finally {
    await staff('/api/message-templates/quote_to_approve', { method: 'PUT', body: { enabled: true } });
  }
});

test('the old app’s one-off text goes through the pretend sender, never really sent', async () => {
  const { customer } = await mayasJob();
  const res = await staff(`/api/customers/${customer.id}/texts`, { method: 'POST', body: { body: 'Your bike is ready' } });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.status, 'sent');
  const row = await inShop(() => prepare('SELECT * FROM customer_messages WHERE id = ?').get(res.body.id));
  assert.equal(row.pretend, true);
  assert.equal(row.intent_state, 'delivered');
  assert.equal(row.channel, 'sms');
  assert.equal(row.to_address, '07700 900142');
  assert.equal(row.provider_sid, 'pretend');
});
