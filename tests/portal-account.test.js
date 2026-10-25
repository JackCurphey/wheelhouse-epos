// The customer's account, the server (openspec/changes/customer-account-server;
// docs/decisions/2026-10-26-customer-account.md answer 2): a signed-in customer
// opens their own repairs by `job-<id>` in place of the private code, and reads
// their history of repairs and purchases.
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
let mayaBike;
let mayaCookie;
let samCookie;

const staff = (path, options, who = owner) => staffRequest(server.baseUrl, who.cookie, path, options);
async function portal(path, { cookie = mayaCookie, method = 'GET', body, shop = owner } = {}) {
  const res = await fetch(`${server.baseUrl}/api/portal/${shop.shop.slug}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

// Sign in by code (the pretend provider keeps its codes where a test can read them).
let network = 0;
async function signIn(email, shop = owner) {
  const ip = `203.0.113.${++network}`;
  const post = (path, body) => fetch(`${server.baseUrl}/api/portal/${shop.shop.slug}${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': ip }, body: JSON.stringify(body),
  });
  await post('/sign-in/code', { email });
  const { code } = await runWithShop(shop.shop.id, () => prepare('SELECT code FROM pretend_signin_codes WHERE email = ? AND used_at IS NULL ORDER BY id DESC LIMIT 1').get(email));
  const res = await post('/sign-in/check', { email, code });
  assert.equal(res.status, 200, await res.text());
  return res.headers.get('set-cookie').split(';')[0];
}

let jobDay = 5;
async function mayasJob() {
  const job = (await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Standard service', jobDate: `2026-10-${String(jobDay++).padStart(2, '0')}`, customerId: maya.id, bikeId: mayaBike.id } })).body;
  const code = (await staff(`/api/workshop-jobs/${job.id}/private-link`, { method: 'POST', body: {} })).body.privateLink.split('/booking/')[1];
  return { job, code };
}

before(async () => {
  server = await startLiveServer({ env: { TRUST_PROXY: '1', CUSTOMER_SIGNIN_PROVIDER: 'pretend', APP_PUBLIC_URL: 'https://wh.test' } });
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  other = await staffSignup(server.baseUrl, { shopName: 'Elsewhere Cycles' });
  const email = `maya-${randomUUID().slice(0, 8)}@example.test`;
  maya = (await staff('/api/customers', { method: 'POST', body: { name: 'Maya Patel', email, phone: '07700 900142' } })).body;
  mayaBike = (await staff(`/api/customers/${maya.id}/bikes`, { method: 'POST', body: { make: 'Trek', model: 'Domane AL 3' } })).body;
  // Maya booked as a guest, so her email is her own (option 2); her code
  // sign-in joins her (answer 1).
  await runWithShop(owner.shop.id, () => prepare('UPDATE customers SET email_from_customer = true WHERE id = ?').run(maya.id));
  mayaCookie = await signIn(email);
  samCookie = await signIn(`sam-${randomUUID().slice(0, 8)}@example.test`);
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (other) await deleteTestShop(other.shop.id);
  if (server) await server.stop();
});

test('signed in, Maya opens her own repair by job-<id>, as its private link would', async () => {
  const { job, code } = await mayasJob();
  const byLink = await portal(`/booking-links/${code}`, { cookie: null });
  const bySignIn = await portal(`/booking-links/job-${job.id}`);
  assert.equal(bySignIn.status, 200, JSON.stringify(bySignIn.body));
  assert.deepEqual(bySignIn.body, byLink.body);
});

test('the quote and the notes work by job-<id> too', async () => {
  const { job } = await mayasJob();
  const note = await portal(`/booking-links/job-${job.id}/notes`, { method: 'POST', body: { text: 'Can you check the back light too?' } });
  assert.equal(note.status, 201, JSON.stringify(note.body));
  const notes = await portal(`/booking-links/job-${job.id}/notes`);
  assert.equal(notes.status, 200);
  assert.equal(notes.body.length, 1);
  // The quote answers the same by sign-in as by the private link (here, no quote yet).
  const { code } = await (async () => ({ code: (await staff(`/api/workshop-jobs/${job.id}/private-link`, { method: 'POST', body: {} })).body.privateLink.split('/booking/')[1] }))();
  const byLink = await portal(`/booking-links/${code}/quote`, { cookie: null });
  const bySignIn = await portal(`/booking-links/job-${job.id}/quote`);
  assert.deepEqual([bySignIn.status, bySignIn.body], [byLink.status, byLink.body]);
});

test('someone else’s repair, another shop, no sign-in or a made-up id all answer as a bad link does', async () => {
  const { job } = await mayasJob();
  const bad = await portal(`/booking-links/${'0'.repeat(64)}`, { cookie: null });
  assert.equal(bad.status, 404);
  for (const [why, path, opts] of [
    ['another customer', `/booking-links/job-${job.id}`, { cookie: samCookie }],
    ['not signed in', `/booking-links/job-${job.id}`, { cookie: null }],
    ['no such job', '/booking-links/job-999999999', {}],
    ['not a number', '/booking-links/job-1x', {}],
    ['another shop', `/booking-links/job-${job.id}`, { shop: other }],
  ]) {
    const r = await portal(path, opts);
    assert.equal(r.status, 404, why);
    assert.deepEqual(r.body, bad.body, why);
  }
});

test('a repair collected long ago still opens for its owner, though its private link has run out', async () => {
  const { job, code } = await mayasJob();
  await runWithShop(owner.shop.id, () => prepare("UPDATE workshop_jobs SET custody_state = 'collected', collected_at = '2026-06-01T10:00:00Z' WHERE id = ?").run(job.id));
  assert.equal((await portal(`/booking-links/${code}`, { cookie: null })).status, 410);
  assert.equal((await portal(`/booking-links/job-${job.id}`)).status, 200);
});

// While sending is pretend every message's link reads [link] (messageLink), so
// the account link itself shows only once real sending is on; what's checked
// here is the cancel going through and its message never carrying job-<id>.
test('cancelling from the account goes through and sends Booking cancelled, never with a job-<id> link', async () => {
  const { job } = await mayasJob();
  await staff(`/api/workshop-jobs/${job.id}/accept`, { method: 'POST', body: {} });
  const res = await portal(`/booking-links/job-${job.id}/cancel`, { method: 'POST', body: {} });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const sent = await runWithShop(owner.shop.id, () => prepare("SELECT body FROM customer_messages WHERE job_id = ? AND template_key = 'booking_cancelled'").get(job.id));
  assert.ok(sent, 'Booking cancelled is queued');
  assert.doesNotMatch(sent.body, /job-\d+/);
});

test('the history: repairs with their stage and total, and purchases from both records, newest first', async () => {
  const { job } = await mayasJob();
  await runWithShop(owner.shop.id, async () => {
    const jo = (await prepare("INSERT INTO employees (name, is_cashier) VALUES ('Jo Taylor', 1) RETURNING id").get()).id;
    const old = (await prepare(
      `INSERT INTO sales (created_at, subtotal, total, payment_method, cash_amount, customer_id, cashier_id)
       VALUES ('2026-08-20T10:00:00Z', 12, 12, 'Cash', 12, ?, ?) RETURNING id`
    ).get(maya.id, jo)).id;
    await prepare("INSERT INTO sale_items (sale_id, name, unit_price, qty, line_total, line_type) VALUES (?, 'Labour', 12, 1, 12, 'labour')").run(old);
    const site = await prepare("INSERT INTO sites (name, code) VALUES ('Bolton', 'B') RETURNING id").get();
    const till = await prepare('INSERT INTO tills (site_id, code, name, token_hash) VALUES (?, ?, ?, ?) RETURNING id').get(site.id, 'B1', 'Till 1', randomUUID());
    const sale = (await prepare(
      `INSERT INTO till_sales (client_id, till_id, site_id, receipt_number, made_offline, till_clock_at, received_at, total_pence, vat_pence, customer_id, employee_id)
       VALUES (?, ?, ?, 7, false, '2026-08-25T09:00:00Z', '2026-08-25T09:00:00Z', 2500, 417, ?, ?) RETURNING id`
    ).get(randomUUID(), till.id, site.id, maya.id, jo)).id;
    await prepare("INSERT INTO till_sale_lines (till_sale_id, description, qty, unit_price_pence, line_total_pence, vat_rate_bp, vat_pence) VALUES (?, 'Pump', 1, 2500, 2500, 2000, 417)").run(sale);
  });
  const res = await portal('/history');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const repair = res.body.find((h) => h.kind === 'repair' && h.jobId === job.id);
  assert.ok(repair, JSON.stringify(res.body));
  assert.equal(repair.title, 'Standard service');
  assert.equal(repair.bikeLabel, 'Trek Domane AL 3');
  assert.equal(typeof repair.stage, 'string');
  assert.ok(repair.reference);
  const purchases = res.body.filter((h) => h.kind === 'purchase');
  assert.deepEqual(purchases.map((p) => [p.source, p.what, p.totalPence]), [['till', 'Pump', 2500], ['old', 'Labour', 1200]]);
  assert.equal(purchases[0].receiptNumber, 7);
  const ats = res.body.map((h) => h.at);
  assert.deepEqual(ats, [...ats].sort().reverse(), 'newest first');
  // Only Maya's: Sam sees none of it.
  assert.deepEqual((await portal('/history', { cookie: samCookie })).body, []);
  assert.equal((await portal('/history', { cookie: null })).status, 401);
});

// The review of 26 Oct.
test('an action by job-<id> from another website is refused; from this one it goes through', async () => {
  const { job } = await mayasJob();
  const post = (site) => fetch(`${server.baseUrl}/api/portal/${owner.shop.slug}/booking-links/job-${job.id}/notes`, {
    method: 'POST', headers: { 'content-type': 'application/json', cookie: mayaCookie, 'sec-fetch-site': site }, body: JSON.stringify({ text: 'Hello' }),
  });
  assert.equal((await post('cross-site')).status, 403);
  assert.equal((await post('same-origin')).status, 201);
});

test('another customer can’t act on Maya’s repair by job-<id>', async () => {
  const { job } = await mayasJob();
  const cancel = await portal(`/booking-links/job-${job.id}/cancel`, { method: 'POST', body: {}, cookie: samCookie });
  assert.equal(cancel.status, 404);
  const note = await portal(`/booking-links/job-${job.id}/notes`, { method: 'POST', body: { text: 'Not mine' }, cookie: samCookie });
  assert.equal(note.status, 404);
});

test('opening her own repairs never uses up the private links’ attempt limit, and isn’t kept by the browser', async () => {
  const { job } = await mayasJob();
  for (let i = 0; i < 35; i++) {
    const r = await fetch(`${server.baseUrl}/api/portal/${owner.shop.slug}/booking-links/job-${job.id}`, { headers: { cookie: mayaCookie, 'x-forwarded-for': '198.51.100.250' } });
    assert.equal(r.status, 200, `load ${i + 1}`);
    if (i === 0) assert.equal(r.headers.get('cache-control'), 'no-store');
  }
});

test('the history leaves a repair’s total out when the shop hides prices, as the repair page does', async () => {
  const { job } = await mayasJob();
  const full = (await staff(`/api/workshop-jobs/${job.id}`)).body;
  const lines = await staff(`/api/sale-documents/${full.orderId}/items`, { method: 'PUT', body: { items: [{ lineType: 'labour', name: 'Standard service', unitPrice: 65, minutes: 60 }] } });
  assert.equal(lines.status, 200, JSON.stringify(lines.body));
  const totalFor = async () => (await portal('/history')).body.find((h) => h.kind === 'repair' && h.jobId === job.id).totalPence;
  await staff('/api/workshop-settings', { method: 'PUT', body: { showPricesOnline: true } });
  assert.equal(await totalFor(), 6500);
  await staff('/api/workshop-settings', { method: 'PUT', body: { showPricesOnline: false } });
  assert.equal(await totalFor(), null);
});

// customer-account-screens design 1: what the account page reads.
test('/me gives her mobile and how the shop contacts her; /history each repair’s bike and whether work has begun', async () => {
  await runWithShop(owner.shop.id, () => prepare("UPDATE customers SET update_channel = 'email', marketing_permission = true, service_reminders = true, reminders_said_yes_at = now(), reminders_said_yes_via = 'booking' WHERE id = ?").run(maya.id));
  const me = (await portal('/me')).body;
  assert.deepEqual([me.phone, me.updateChannel, me.serviceReminders, me.reviewRequests, me.marketingPermission], ['07700 900142', 'email', true, false, true]);
  const { job } = await mayasJob();
  const repair = (await portal('/history')).body.find((h) => h.jobId === job.id);
  assert.equal(repair.bikeId, mayaBike.id);
  assert.equal(repair.workStarted, false);
});
