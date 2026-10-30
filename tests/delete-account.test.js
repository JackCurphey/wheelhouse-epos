// The shop's privacy requests and deleting a customer's details
// (openspec/changes/delete-account, design 4 and 5; Jack's 30 Oct answer 3;
// cs-privacy, cs-privacy-delete, ac-customer-delete): the Owner sees the
// dated list and deletes someone's details, which clears what identifies
// them and keeps their sales and jobs whole, in one locked step. Asking and
// cancelling are in tests/delete-request.test.js.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import '../server/load-env.js';
import { runWithShop, prepare, pool } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';
import { UPLOADS_DIR } from './helpers/workshopFixtures.js';

let server;
let owner;
let other;
let jo;

const staff = (p, options, who = owner) => staffRequest(server.baseUrl, who.cookie, p, options);
const inShop = (fn, shop = owner.shop.id) => runWithShop(shop, fn);

async function portal(p, { cookie, method = 'GET', shop = owner, headers = {} } = {}) {
  const res = await fetch(`${server.baseUrl}/api/portal/${shop.shop.slug}${p}`, {
    method,
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}), ...headers },
    body: method === 'GET' ? undefined : '{}',
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

let network = 0;
async function signIn(email, shop = owner) {
  const ip = `203.0.113.${++network}`;
  const post = (p, body) => fetch(`${server.baseUrl}/api/portal/${shop.shop.slug}${p}`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': ip }, body: JSON.stringify(body),
  });
  await post('/sign-in/code', { email });
  const { code } = await runWithShop(shop.shop.id, () => prepare('SELECT code FROM pretend_signin_codes WHERE email = ? AND used_at IS NULL ORDER BY id DESC LIMIT 1').get(email));
  const res = await post('/sign-in/check', { email, code });
  assert.equal(res.status, 200, await res.text());
  return res.headers.get('set-cookie').split(';')[0];
}

// A customer of North Street Cycles with an online account of their own.
async function customer(name = 'Maya Patel') {
  const email = `c-${randomUUID().slice(0, 8)}@example.test`;
  const made = (await staff('/api/customers', { method: 'POST', body: { name, email, phone: '07700 900 142' } })).body;
  await inShop(() => prepare('UPDATE customers SET email_from_customer = true WHERE id = ?').run(made.id));
  const cookie = await signIn(email);
  const { id: loginId } = await inShop(() => prepare('SELECT id FROM customer_logins WHERE customer_id = ?').get(made.id));
  return { id: made.id, email, cookie, loginId };
}

// The shop's day for a moment, and a month on, as the database works them out.
const shopDay = (sqlMoment) => inShop(async () => (await prepare(
  `SELECT to_char((${sqlMoment}) AT TIME ZONE coalesce((SELECT time_zone FROM workshop_settings LIMIT 1), 'Europe/London'), 'YYYY-MM-DD') AS day`
).get()).day);
const monthOn = (sqlMoment) => inShop(async () => (await prepare(
  `SELECT to_char(((${sqlMoment}) AT TIME ZONE coalesce((SELECT time_zone FROM workshop_settings LIMIT 1), 'Europe/London'))::date + interval '1 month', 'YYYY-MM-DD') AS day`
).get()).day);

const ask = (c) => portal('/me/delete-request', { cookie: c.cookie, method: 'POST' });
const openFor = (customerId) => inShop(() => prepare("SELECT * FROM privacy_requests WHERE customer_id = ? AND kind = 'delete' AND done_at IS NULL AND cancelled_at IS NULL").all(customerId));
const jobFor = (customerId, custody = 'collected') => inShop(async () => {
  const { id } = await prepare(
    `INSERT INTO workshop_jobs (title, customer_id, job_date, start_time, end_time, booking_state, work_state, custody_state, notes, updated_at)
     VALUES ('Standard service', ?, '2026-09-05', '10:00', '11:00', 'scheduled', ?, ?, '[Shop’s workshop note]', now()) RETURNING id, reference`
  ).get(customerId, custody === 'expected' ? 'not_started' : 'complete', custody);
  return (await prepare('SELECT id, reference FROM workshop_jobs WHERE id = ?').get(id));
});

before(async () => {
  server = await startLiveServer({ env: { TRUST_PROXY: '1', CUSTOMER_SIGNIN_PROVIDER: 'pretend', APP_PUBLIC_URL: 'https://wh.test' } });
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  other = await staffSignup(server.baseUrl, { shopName: 'Elsewhere Cycles' });
  const made = await staff('/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `jo-${randomUUID().slice(0, 8)}@example.test`, password: 'password123' } });
  jo = { cookie: await staffFreshCookie(made.body.loginId) };
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (other) await deleteTestShop(other.shop.id);
  if (server) await server.stop();
});

// ---------- The shop's list ----------

test('the Owner’s list: who, what, where from, asked and due in the shop’s days, open first, overdue marked', async () => {
  const lena = await customer('[Lena’s name]');
  await ask(lena);
  // An older one, past its month.
  const late = await customer('[Late name]');
  await inShop(() => prepare("INSERT INTO privacy_requests (customer_id, kind, source, asked_at) VALUES (?, 'delete', 'account', now() - interval '40 days')").run(late.id));
  // A copy from the account: done at once.
  await inShop(() => prepare("INSERT INTO privacy_requests (customer_id, kind, source, asked_at, done_at) VALUES (?, 'copy', 'account', now(), now())").run(lena.id));
  const res = await staff('/api/privacy-requests');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const { requests, openCount } = res.body;
  const mine = requests.filter((r) => [lena.id, late.id].includes(r.customerId));
  const lenaDelete = mine.find((r) => r.customerId === lena.id && r.kind === 'delete');
  assert.deepEqual(
    { name: lenaDelete.name, source: lenaDelete.source, askedOn: lenaDelete.askedOn, dueBy: lenaDelete.dueBy, overdue: lenaDelete.overdue, doneOn: lenaDelete.doneOn, inTheWay: lenaDelete.inTheWay },
    { name: '[Lena’s name]', source: 'account', askedOn: await shopDay('now()'), dueBy: await monthOn('now()'), overdue: false, doneOn: null, inTheWay: [] },
  );
  assert.match(lenaDelete.reference, /^PR-\d+$/);
  const lateRow = mine.find((r) => r.customerId === late.id);
  assert.equal(lateRow.overdue, true);
  assert.equal(lateRow.dueBy, await monthOn("now() - interval '40 days'"));
  const copy = mine.find((r) => r.kind === 'copy');
  assert.equal(copy.doneOn, await shopDay('now()'));
  // Open ones first, the oldest asked first; then done.
  const order = requests.map((r) => r.id);
  assert.ok(order.indexOf(lateRow.id) < order.indexOf(lenaDelete.id));
  assert.ok(order.indexOf(lenaDelete.id) < order.indexOf(copy.id));
  assert.equal(openCount, requests.filter((r) => r.doneOn === null).length);
  assert.deepEqual((await staff('/api/privacy-requests/open-count', {}, jo)).body, { openCount });
});

test('only the Owner sees the list or deletes; another shop’s request is not found', async () => {
  const pat = await customer('[Pat’s name]');
  await ask(pat);
  const [req] = await openFor(pat.id);
  assert.equal((await staff('/api/privacy-requests', {}, jo)).status, 403);
  assert.equal((await staff(`/api/privacy-requests/${req.id}/delete`, { method: 'POST', body: {} }, jo)).status, 403);
  assert.equal((await staff(`/api/privacy-requests/${req.id}/delete`, { method: 'POST', body: {} }, other)).status, 404);
  assert.equal((await openFor(pat.id)).length, 1);
});

test('a bike still in the workshop holds the deletion back, and the customer page says so', async () => {
  const ola = await customer('[Ola’s name]');
  const job = await jobFor(ola.id, 'in_shop');
  await ask(ola);
  const [req] = await openFor(ola.id);
  const row = (await staff('/api/privacy-requests')).body.requests.find((r) => r.id === req.id);
  assert.deepEqual(row.inTheWay, [{ jobId: job.id, reference: job.reference }]);
  const page = (await staff(`/api/customers/${ola.id}`)).body;
  assert.deepEqual(page.deletionRequest, { askedOn: row.askedOn, dueBy: row.dueBy, source: 'account', inTheWay: row.inTheWay });
  const refused = await staff(`/api/privacy-requests/${req.id}/delete`, { method: 'POST', body: {} });
  assert.equal(refused.status, 409);
  assert.equal(refused.body.code, 'in_the_way');
  assert.equal((await inShop(() => prepare('SELECT name FROM customers WHERE id = ?').get(ola.id))).name, '[Ola’s name]', 'nothing cleared');
  // Collected: no longer in the way.
  await inShop(() => prepare("UPDATE workshop_jobs SET custody_state = 'collected' WHERE id = ?").run(job.id));
  assert.equal((await staff(`/api/privacy-requests/${req.id}/delete`, { method: 'POST', body: {} })).status, 200);
});

test('a request the customer cancelled isn’t on the list', async () => {
  const kai = await customer('[Kai’s name]');
  await ask(kai);
  assert.equal((await portal('/me/delete-request/cancel', { cookie: kai.cookie, method: 'POST' })).status, 200);
  assert.ok(!(await staff('/api/privacy-requests')).body.requests.some((r) => r.customerId === kai.id));
});

// ---------- Deleting someone's details ----------

test('deleting Maya’s details: what identifies her goes, her sales and jobs stay whole', async () => {
  const maya = await customer('Maya Patel');
  const twin = (await staff('/api/customers', { method: 'POST', body: { name: 'Maya P.', phone: '07700 900 142' } })).body;
  const bike = (await staff(`/api/customers/${maya.id}/bikes`, { method: 'POST', body: { make: 'Trek', model: 'Domane AL 3', colour: 'green' } })).body;
  const job = await jobFor(maya.id);
  const files = {};
  const ids = await inShop(async () => {
    await prepare("UPDATE customers SET notes = '[Shop’s note]', address = '[Address]', postcode = '[Postcode]', is_company = true, contact_name = '[Contact]', vat_number = '[VAT]', invoice_email = '[invoice email]', update_channel = 'sms', service_reminders = true, reminders_said_yes_at = now(), reminders_said_yes_via = 'booking', marketing_permission = true WHERE id = ?").run(maya.id);
    await prepare("UPDATE customer_bikes SET serial_number = '[Frame]', notes = '[Bike note]' WHERE id = ?").run(bike.id);
    await prepare('UPDATE workshop_jobs SET bike_id = ? WHERE id = ?').run(bike.id, job.id);
    const jo2 = (await prepare("INSERT INTO employees (name, is_cashier) VALUES ('Jo Taylor', 1) RETURNING id").get()).id;
    const sale = (await prepare("INSERT INTO sales (created_at, subtotal, total, payment_method, cash_amount, customer_id, cashier_id) VALUES (now(), 12, 12, 'Cash', 12, ?, ?) RETURNING id").get(maya.id, jo2)).id;
    await prepare("INSERT INTO sale_items (sale_id, name, unit_price, qty, line_total, line_type) VALUES (?, 'Labour', 12, 1, 12, 'labour')").run(sale);
    const note = (await prepare("INSERT INTO job_notes (customer_id, from_customer, body) VALUES (?, true, '[Maya’s message]') RETURNING id").get(maya.id)).id;
    const jobNote = (await prepare("INSERT INTO job_notes (workshop_job_id, from_customer, body) VALUES (?, false, '[Shop’s reply]') RETURNING id").get(job.id)).id;
    const sent = (await prepare("INSERT INTO customer_messages (customer_id, body, status, intent_state, channel, to_address) VALUES (?, '[Bike ready text]', 'sent', 'delivered', 'sms', '07700 900 142') RETURNING id").get(maya.id)).id;
    const waiting = (await prepare("INSERT INTO customer_messages (customer_id, body, status, intent_state, channel, to_address, send_after) VALUES (?, '[Reminder]', 'sent', 'intended', 'sms', '07700 900 142', now() + interval '6 months') RETURNING id").get(maya.id)).id;
    const receipt = (await prepare("INSERT INTO customer_messages (customer_id, sale_id, body, status, intent_state, channel, to_address) VALUES (NULL, ?, '[Receipt]', 'sent', 'delivered', 'email', 'maya@example.test') RETURNING id").get(sale)).id;
    mkdirSync(UPLOADS_DIR, { recursive: true });
    for (const k of ['theirs', 'shops']) {
      files[k] = `test-delete-${randomUUID()}`;
      writeFileSync(path.join(UPLOADS_DIR, files[k]), 'x');
    }
    const theirPhoto = (await prepare("INSERT INTO workshop_job_attachments (workshop_job_id, storage_key, original_name, content_type, size_bytes, from_customer) VALUES (?, ?, 'bike.jpg', 'image/jpeg', 1, true) RETURNING id").get(job.id, files.theirs)).id;
    const shopPhoto = (await prepare("INSERT INTO workshop_job_attachments (workshop_job_id, storage_key, original_name, content_type, size_bytes, from_customer) VALUES (?, ?, 'chain.jpg', 'image/jpeg', 1, false) RETURNING id").get(job.id, files.shops)).id;
    const group = (await prepare("INSERT INTO customer_groups (name) VALUES ('[Club name]') RETURNING id").get()).id;
    await prepare('INSERT INTO customer_group_members (group_id, customer_id) VALUES (?, ?)').run(group, maya.id);
    const copy = (await prepare("INSERT INTO privacy_requests (customer_id, customer_login_id, kind, source, done_at) VALUES (?, ?, 'copy', 'account', now()) RETURNING id").get(maya.id, maya.loginId)).id;
    return { sale, note, jobNote, sent, waiting, receipt, theirPhoto, shopPhoto, copy };
  });
  // The twin merged into her: its hidden record holds her details too.
  const merged = await staff(`/api/customers/${maya.id}/merge`, { method: 'POST', body: { otherId: twin.id, keep: {} } });
  assert.equal(merged.status, 200, JSON.stringify(merged.body));
  await ask(maya);
  const [req] = await openFor(maya.id);

  const res = await staff(`/api/privacy-requests/${req.id}/delete`, { method: 'POST', body: {} });
  assert.equal(res.status, 200, JSON.stringify(res.body));

  const gone = await inShop(async () => ({
    customers: await prepare('SELECT * FROM customers WHERE id = ANY(?::int[]) ORDER BY id').all([maya.id, twin.id]),
    bike: await prepare('SELECT * FROM customer_bikes WHERE id = ?').get(bike.id),
    job: await prepare('SELECT id, customer_id, bike_id, notes FROM workshop_jobs WHERE id = ?').get(job.id),
    sale: await prepare('SELECT customer_id, total FROM sales WHERE id = ?').get(ids.sale),
    notes: await prepare('SELECT id FROM job_notes WHERE id = ANY(?::int[])').all([ids.note, ids.jobNote]),
    messages: await prepare('SELECT id FROM customer_messages WHERE id = ANY(?::int[])').all([ids.sent, ids.waiting, ids.receipt]),
    photos: await prepare('SELECT id FROM workshop_job_attachments WHERE id = ANY(?::int[])').all([ids.theirPhoto, ids.shopPhoto]),
    merges: await prepare('SELECT id FROM customer_merges WHERE kept_id = ? OR other_id = ?').all(maya.id, twin.id),
    logins: await prepare('SELECT id FROM customer_logins WHERE customer_id = ANY(?::int[])').all([maya.id, twin.id]),
    groups: await prepare('SELECT 1 FROM customer_group_members WHERE customer_id = ?').all(maya.id),
    requests: await prepare('SELECT id, kind, done_at, customer_id FROM privacy_requests WHERE id = ANY(?::int[]) ORDER BY id').all([ids.copy, req.id]),
  }));
  for (const c of gone.customers) {
    assert.deepEqual(
      [c.name, c.email, c.phone, c.notes, c.address, c.postcode, c.is_company, c.contact_name, c.vat_number, c.invoice_email, c.update_channel, c.service_reminders, c.review_requests, c.marketing_permission, c.reminders_said_yes_at, c.reminders_said_yes_via, c.email_from_customer, c.active],
      ['', '', '', '', null, null, false, null, null, null, null, false, false, false, null, null, false, 0],
      `customer ${c.id} cleared`,
    );
    assert.ok(c.deleted_at instanceof Date);
  }
  assert.deepEqual([gone.bike.make, gone.bike.model, gone.bike.colour, gone.bike.serial_number, gone.bike.notes, gone.bike.active], ['', '', '', '', '', 0]);
  assert.deepEqual(gone.job, { id: job.id, customer_id: maya.id, bike_id: bike.id, notes: '[Shop’s workshop note]' }, 'the job and the shop’s own note stay');
  assert.deepEqual([gone.sale.customer_id, Number(gone.sale.total)], [maya.id, 12], 'the sale stays whole');
  assert.deepEqual(gone.notes, []);
  assert.deepEqual(gone.messages, [], 'sent, waiting and receipt messages all go');
  assert.deepEqual(gone.photos.map((p) => p.id), [ids.shopPhoto], 'her photo goes, the shop’s stays');
  for (let i = 0; i < 20 && existsSync(path.join(UPLOADS_DIR, files.theirs)); i += 1) await new Promise((r) => setTimeout(r, 50));
  assert.equal(existsSync(path.join(UPLOADS_DIR, files.theirs)), false, 'her photo’s file is removed, once the save is in');
  assert.equal(existsSync(path.join(UPLOADS_DIR, files.shops)), true);
  assert.deepEqual(gone.merges, []);
  assert.deepEqual(gone.logins, []);
  assert.deepEqual(gone.groups, []);
  assert.deepEqual(gone.requests.map((r) => [r.kind, r.done_at instanceof Date, r.customer_id]), [['copy', true, maya.id], ['delete', true, maya.id]]);
  // Her account is gone; the list shows the request by its reference, with no name.
  assert.equal((await portal('/me', { cookie: maya.cookie })).status, 401);
  const row = (await staff('/api/privacy-requests')).body.requests.find((r) => r.id === req.id);
  assert.deepEqual([row.name, row.doneOn, row.reference], [null, await shopDay('now()'), `PR-${req.id}`]);
  // Twice: not open any more.
  const again = await staff(`/api/privacy-requests/${req.id}/delete`, { method: 'POST', body: {} });
  assert.deepEqual([again.status, again.body.code], [409, 'not_open']);
  // The customer list never shows her.
  assert.ok(!(await staff("/api/customers?all=1")).body.some((c) => c.id === maya.id));
  if (existsSync(path.join(UPLOADS_DIR, files.shops))) (await import('node:fs')).unlinkSync(path.join(UPLOADS_DIR, files.shops));
});

// ---------- At the same moment ----------
// Another connection holds what a sale, a merge or a booking would hold,
// while the deletion is asked for; the deletion must wait and then see it.

async function holding(lockSql, args, during) {
  const conn = await pool.connect();
  try {
    await conn.query('BEGIN');
    await conn.query("SELECT set_config('app.current_shop_id', $1, true)", [String(owner.shop.id)]);
    for (const [sql, a] of [[lockSql, args]]) await conn.query(sql, a);
    return await during(conn);
  } finally {
    await conn.query('ROLLBACK').catch(() => {});
    conn.release();
  }
}

test('a sale being made while her details are deleted: the deletion waits, and the sale stays whole', async () => {
  const kim = await customer('[Kim’s name]');
  await ask(kim);
  const [req] = await openFor(kim.id);
  const jo2 = await inShop(async () => (await prepare("INSERT INTO employees (name, is_cashier) VALUES ('Jo Taylor', 1) RETURNING id").get()).id);
  const saleId = await holding(
    "INSERT INTO sales (created_at, subtotal, total, payment_method, cash_amount, customer_id, cashier_id) VALUES (now(), 7, 7, 'Cash', 7, $1, $2) RETURNING id",
    [kim.id, jo2],
    async (conn) => {
      const id = (await conn.query('SELECT max(id) AS id FROM sales WHERE customer_id = $1', [kim.id])).rows[0].id;
      // The sale's receipt, sent to her, in the same transaction.
      await conn.query("INSERT INTO customer_messages (customer_id, sale_id, body, status, intent_state, channel, to_address) VALUES ($1, $2, '[Receipt]', 'sent', 'delivered', 'email', 'kim@example.test')", [kim.id, id]);
      const deleting = staff(`/api/privacy-requests/${req.id}/delete`, { method: 'POST', body: {} });
      await new Promise((r) => setTimeout(r, 300));
      const before = await Promise.race([deleting.then(() => 'done'), new Promise((r) => setTimeout(() => r('waiting'), 50))]);
      assert.equal(before, 'waiting', 'the deletion waits for the sale');
      await conn.query('COMMIT');
      const res = await deleting;
      assert.equal(res.status, 200, JSON.stringify(res.body));
      return id;
    },
  );
  const after = await inShop(async () => ({
    sale: await prepare('SELECT customer_id, total FROM sales WHERE id = ?').get(saleId),
    messages: await prepare('SELECT id FROM customer_messages WHERE customer_id = ? OR sale_id = ?').all(kim.id, saleId),
    name: (await prepare('SELECT name FROM customers WHERE id = ?').get(kim.id)).name,
  }));
  assert.deepEqual([after.sale.customer_id, Number(after.sale.total)], [kim.id, 7]);
  assert.deepEqual(after.messages, [], 'the receipt sent during it goes too');
  assert.equal(after.name, '');
});

test('a booking taking her bike in while her details are deleted: the deletion waits, then finds the bike in the way', async () => {
  const ana = await customer('[Ana’s name]');
  await ask(ana);
  const [req] = await openFor(ana.id);
  const res = await holding(
    "INSERT INTO workshop_jobs (title, customer_id, job_date, booking_state, work_state, custody_state, updated_at) VALUES ('Standard service', $1, '2026-09-05', 'scheduled', 'not_started', 'in_shop', now())",
    [ana.id],
    async (conn) => {
      const deleting = staff(`/api/privacy-requests/${req.id}/delete`, { method: 'POST', body: {} });
      await new Promise((r) => setTimeout(r, 300));
      await conn.query('COMMIT');
      return deleting;
    },
  );
  assert.deepEqual([res.status, res.body.code], [409, 'in_the_way']);
  assert.equal((await inShop(() => prepare('SELECT name FROM customers WHERE id = ?').get(ana.id))).name, '[Ana’s name]', 'nothing half-cleared');
});

test('a merge holding her record while her details are deleted: the deletion waits its turn', async () => {
  const bo = await customer('[Bo’s name]');
  await ask(bo);
  const [req] = await openFor(bo.id);
  const res = await holding('SELECT id FROM customers WHERE id = $1 FOR UPDATE', [bo.id], async (conn) => {
    const deleting = staff(`/api/privacy-requests/${req.id}/delete`, { method: 'POST', body: {} });
    await new Promise((r) => setTimeout(r, 300));
    const before = await Promise.race([deleting.then(() => 'done'), new Promise((r) => setTimeout(() => r('waiting'), 50))]);
    assert.equal(before, 'waiting');
    await conn.query("UPDATE customers SET notes = '[Merged note]' WHERE id = $1", [bo.id]);
    await conn.query('COMMIT');
    return deleting;
  });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal((await inShop(() => prepare('SELECT notes FROM customers WHERE id = ?').get(bo.id))).notes, '', 'what the merge wrote is cleared too');
});

// ---------- The review of the server (deletion) ----------

test('a chain of merges is followed all the way: every record merged into hers is cleared', async () => {
  const ana = await customer('[Ana’s name]');
  const b = (await staff('/api/customers', { method: 'POST', body: { name: '[B name]', phone: '07700 900 001' } })).body;
  const c = (await staff('/api/customers', { method: 'POST', body: { name: '[C name]', phone: '07700 900 002' } })).body;
  assert.equal((await staff(`/api/customers/${b.id}/merge`, { method: 'POST', body: { otherId: c.id, keep: {} } })).status, 200);
  assert.equal((await staff(`/api/customers/${ana.id}/merge`, { method: 'POST', body: { otherId: b.id, keep: {} } })).status, 200);
  await ask(ana);
  const [req] = await openFor(ana.id);
  assert.equal((await staff(`/api/privacy-requests/${req.id}/delete`, { method: 'POST', body: {} })).status, 200);
  const rows = await inShop(() => prepare('SELECT id, name, phone, deleted_at FROM customers WHERE id = ANY(?::int[]) ORDER BY id').all([ana.id, b.id, c.id]));
  assert.deepEqual(rows.map((r) => [r.name, r.phone, r.deleted_at instanceof Date]), [['', '', true], ['', '', true], ['', '', true]]);
});

test('a merge into hers that lands while the deletion waits is cleared too', async () => {
  const eve = await customer('[Eve’s name]');
  const twin = (await staff('/api/customers', { method: 'POST', body: { name: '[Twin name]', phone: '07700 900 003' } })).body;
  await ask(eve);
  const [req] = await openFor(eve.id);
  const res = await holding('SELECT id FROM customers WHERE id = ANY($1::int[]) ORDER BY id FOR UPDATE', [[eve.id, twin.id]], async (conn) => {
    const deleting = staff(`/api/privacy-requests/${req.id}/delete`, { method: 'POST', body: {} });
    await new Promise((r) => setTimeout(r, 300));
    // What a merge of the twin into her writes, before it commits.
    await conn.query('UPDATE customers SET active = 0, merged_into_id = $1 WHERE id = $2', [eve.id, twin.id]);
    await conn.query("INSERT INTO customer_merges (kept_id, other_id, other_was_id, other_name, moved) VALUES ($1, $2, $2, '[Twin name]', '{}'::jsonb)", [eve.id, twin.id]);
    await conn.query('COMMIT');
    return deleting;
  });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(await inShop(() => prepare('SELECT name, phone FROM customers WHERE id = ?').get(twin.id)), { name: '', phone: '' });
});

test('an Undo of a merge into hers at the same moment: no deadlock, both go through', async () => {
  const ivy = await customer('[Ivy’s name]');
  const twin = (await staff('/api/customers', { method: 'POST', body: { name: '[Twin name]', phone: '07700 900 004' } })).body;
  const merged = await staff(`/api/customers/${ivy.id}/merge`, { method: 'POST', body: { otherId: twin.id, keep: {} } });
  await ask(ivy);
  const [req] = await openFor(ivy.id);
  let undoStep;
  const res = await holding('SELECT id FROM customer_merges WHERE id = $1 FOR UPDATE', [merged.body.id], async (conn) => {
    // Undo has its merge record; the deletion starts; Undo goes on to the customers.
    const deleting = staff(`/api/privacy-requests/${req.id}/delete`, { method: 'POST', body: {} });
    await new Promise((r) => setTimeout(r, 300));
    undoStep = await conn.query('SELECT id FROM customers WHERE id = ANY($1::int[]) ORDER BY id FOR UPDATE', [[ivy.id, twin.id]]).then(() => 'locked', (err) => err.message);
    await conn.query(undoStep === 'locked' ? 'COMMIT' : 'ROLLBACK');
    return deleting;
  });
  assert.equal(undoStep, 'locked');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.doesNotMatch(server.stderr, new RegExp(`Privacy request ${req.id}: deletion tried again`), 'no deadlock to retry: the locks were taken in order');
});

test('a job’s order paid at the till at the same moment: no deadlock, the payment goes through', async () => {
  const una = await customer('[Una’s name]');
  const job = await jobFor(una.id);
  await ask(una);
  const [req] = await openFor(una.id);
  const jo2 = await inShop(async () => (await prepare("INSERT INTO employees (name, is_cashier) VALUES ('Jo Taylor', 1) RETURNING id").get()).id);
  let payment;
  const res = await holding(
    "INSERT INTO sales (created_at, subtotal, total, payment_method, cash_amount, customer_id, cashier_id) VALUES (now(), 9, 9, 'Cash', 9, $1, $2)",
    [una.id, jo2],
    async (conn) => {
      // The payment has its sale; the deletion starts; the payment then moves the job on.
      const deleting = staff(`/api/privacy-requests/${req.id}/delete`, { method: 'POST', body: {} });
      await new Promise((r) => setTimeout(r, 300));
      payment = await conn.query('SELECT id FROM workshop_jobs WHERE id = $1 FOR UPDATE', [job.id]).then(() => 'paid', (err) => err.message);
      await conn.query(payment === 'paid' ? 'COMMIT' : 'ROLLBACK');
      return deleting;
    },
  );
  assert.equal(payment, 'paid');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.doesNotMatch(server.stderr, new RegExp(`Privacy request ${req.id}: deletion tried again`), 'no deadlock to retry: the locks were taken in order');
});

test('the till’s duplicate alert about her loses her name', async () => {
  const ted = await customer('[Ted’s name]');
  await inShop(() => prepare("INSERT INTO till_attention (kind, detail, customer_id) VALUES ('possible_duplicate_customer', '\"[Ted’s name]\" may be the same person as customer 1', ?)").run(ted.id));
  await ask(ted);
  const [req] = await openFor(ted.id);
  assert.equal((await staff(`/api/privacy-requests/${req.id}/delete`, { method: 'POST', body: {} })).status, 200);
  const { detail } = await inShop(() => prepare('SELECT detail FROM till_attention WHERE customer_id = ?').get(ted.id));
  assert.doesNotMatch(detail, /Ted/);
});

// The second review (A): a job's own route locks the job, then writes
// something for the customer (Mark ready queues Bike ready). The deletion
// holds the customer, then wants the job. Each waits for the other; the
// deletion must be the one that steps back, so the mechanic's save goes in.
test('Mark ready at the same moment: the deletion steps back and tries again, the mechanic’s save goes in', async () => {
  const lia = await customer('[Lia’s name]');
  const job = await jobFor(lia.id, 'expected');
  await ask(lia);
  const [req] = await openFor(lia.id);
  // A third connection holds her sign-in, which the deletion takes between
  // her record and her jobs, so Mark ready is waiting first, as in the review.
  const gate = await pool.connect();
  let marked;
  let res;
  try {
    await gate.query('BEGIN');
    await gate.query("SELECT set_config('app.current_shop_id', $1, true)", [String(owner.shop.id)]);
    await gate.query('SELECT id FROM customer_logins WHERE id = $1 FOR UPDATE', [lia.loginId]);
    res = await holding('SELECT id FROM workshop_jobs WHERE id = $1 FOR UPDATE', [job.id], async (conn) => {
      const deleting = staff(`/api/privacy-requests/${req.id}/delete`, { method: 'POST', body: {} });
      await new Promise((r) => setTimeout(r, 300));
      // Bike ready, queued for her in the same save: it waits on her record.
      const marking = conn.query("INSERT INTO customer_messages (customer_id, job_id, body, status, intent_state, channel, to_address) VALUES ($1, $2, '[Bike ready text]', 'sent', 'intended', 'sms', '07700 900 142')", [lia.id, job.id])
        .then(() => 'marked', (err) => err.message);
      await new Promise((r) => setTimeout(r, 50));
      await gate.query('COMMIT');
      marked = await marking;
      await conn.query(marked === 'marked' ? 'COMMIT' : 'ROLLBACK');
      return deleting;
    });
  } finally {
    await gate.query('ROLLBACK').catch(() => {});
    gate.release();
  }
  assert.equal(marked, 'marked', 'the mechanic’s save is never the one cancelled');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(await inShop(() => prepare('SELECT id FROM customer_messages WHERE customer_id = ?').all(lia.id)), [], 'and the message it queued goes with her details');
});
