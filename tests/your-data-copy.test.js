// Download a copy of your data, the server (openspec/changes/your-data-copy,
// design 1 to 3; ac-download; account and reminders decision 4): a signed-in
// customer's own details, bikes, repairs, purchases, messages and answers, as
// one zip of spreadsheets, logged as a privacy request before it is sent.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import '../server/load-env.js';
import { runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let owner;
let other;
let maya;
let mayaEmail;
let mayaCookie;
let samCookie;
let otherCookie;
let job;

const staff = (p, options, who = owner) => staffRequest(server.baseUrl, who.cookie, p, options);
const inShop = (fn, shop = owner.shop.id) => runWithShop(shop, fn);

async function download({ cookie = mayaCookie, shop = owner, headers = {} } = {}) {
  const res = await fetch(`${server.baseUrl}/api/portal/${shop.shop.slug}/me/data-copy`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}), ...headers },
    body: '{}',
  });
  return { res, body: Buffer.from(await res.arrayBuffer()) };
}

// The zip's files, read back by `unzip`.
function filesOf(buffer, t) {
  const dir = mkdtempSync(path.join(tmpdir(), 'wh-data-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'copy.zip');
  writeFileSync(file, buffer);
  const names = execFileSync('unzip', ['-Z1', file], { encoding: 'utf8' }).trim().split('\n');
  return Object.fromEntries(names.map((n) => [n, execFileSync('unzip', ['-p', file, n], { encoding: 'utf8' })]));
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

const requests = (customerId) => inShop(() => prepare('SELECT kind, source, asked_at, done_at FROM privacy_requests WHERE customer_id = ? ORDER BY id').all(customerId));

before(async () => {
  server = await startLiveServer({ env: { TRUST_PROXY: '1', CUSTOMER_SIGNIN_PROVIDER: 'pretend', APP_PUBLIC_URL: 'https://wh.test' } });
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  other = await staffSignup(server.baseUrl, { shopName: 'Elsewhere Cycles' });
  mayaEmail = `maya-${randomUUID().slice(0, 8)}@example.test`;
  maya = (await staff('/api/customers', { method: 'POST', body: { name: 'Maya Patel', email: mayaEmail, phone: '07700 900 142' } })).body;
  const bike = (await staff(`/api/customers/${maya.id}/bikes`, { method: 'POST', body: { make: 'Trek', model: 'Domane AL 3', colour: 'green' } })).body;
  await inShop(async () => {
    await prepare("UPDATE customers SET email_from_customer = true, notes = '[Shop’s private note]', update_channel = 'sms', service_reminders = true, reminders_said_yes_at = '2026-08-20T10:00:00Z', reminders_said_yes_via = 'booking' WHERE id = ?").run(maya.id);
  });
  job = (await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Standard service', jobDate: '2026-09-05', customerId: maya.id, bikeId: bike.id } })).body;
  await inShop(async () => {
    const jo = (await prepare("INSERT INTO employees (name, is_cashier) VALUES ('Jo Taylor', 1) RETURNING id").get()).id;
    const sale = (await prepare(
      `INSERT INTO sales (created_at, subtotal, total, payment_method, cash_amount, customer_id, cashier_id)
       VALUES ('2026-08-20T10:00:00Z', 12, 12, 'Cash', 12, ?, ?) RETURNING id`
    ).get(maya.id, jo)).id;
    // A line a spreadsheet would read as a formula.
    await prepare("INSERT INTO sale_items (sale_id, name, unit_price, qty, line_total, line_type) VALUES (?, '=HYPERLINK(\"x\")', 12, 1, 12, 'labour')").run(sale);
    // Late on a summer evening in UTC: the next day in the shop (its day, by the database).
    const late = (await prepare(
      `INSERT INTO sales (created_at, subtotal, total, payment_method, cash_amount, customer_id, cashier_id)
       VALUES ('2026-08-23T23:30:00Z', 3, 3, 'Cash', 3, ?, ?) RETURNING id`
    ).get(maya.id, jo)).id;
    await prepare("INSERT INTO sale_items (sale_id, name, unit_price, qty, line_total, line_type) VALUES (?, '[Late sale]', 3, 1, 3, 'labour')").run(late);
    // A refund: a negative total stays a number in the spreadsheet (review).
    await prepare(
      `INSERT INTO sales (created_at, subtotal, total, payment_method, cash_amount, customer_id, cashier_id)
       VALUES ('2026-08-22T10:00:00Z', -5, -5, 'Cash', -5, ?, ?)`
    ).run(maya.id, jo);
    await prepare("INSERT INTO job_notes (customer_id, from_customer, body) VALUES (?, true, '[Maya’s message]')").run(maya.id);
    // The shop's own notes on her bike and her repair, and a bike taken off her account (review of #587).
    await prepare("UPDATE customer_bikes SET notes = '[Shop’s bike note]' WHERE id = ?").run(bike.id);
    await prepare("UPDATE workshop_jobs SET notes = '[Shop’s job note]', terms_accepted_at = '2026-08-30T09:15:00Z' WHERE id = ?").run(job.id);
    await prepare("INSERT INTO customer_bikes (customer_id, make, model, active) VALUES (?, '[Removed make]', '[Removed model]', 0)").run(maya.id);
    // Each a sale of its own, so each starts its cell: +, @, a tab, and -1+1 (review of #587).
    for (const name of ['+1', '@SUM(1)', '\tx', '-1+1']) {
      const one = (await prepare(
        `INSERT INTO sales (created_at, subtotal, total, payment_method, cash_amount, customer_id, cashier_id)
         VALUES ('2026-08-21T10:00:00Z', 1, 1, 'Cash', 1, ?, ?) RETURNING id`
      ).get(maya.id, jo)).id;
      await prepare("INSERT INTO sale_items (sale_id, name, unit_price, qty, line_total, line_type) VALUES (?, ?, 1, 1, 1, 'labour')").run(one, name);
    }
    await prepare("INSERT INTO customer_messages (customer_id, body, status, intent_state, channel, to_address, sent_at) VALUES (?, '[Bike ready text]', 'sent', 'delivered', 'sms', '07700 900 142', '2026-09-05T15:00:00Z')").run(maya.id);
    await prepare("INSERT INTO customer_messages (customer_id, body, status, intent_state, channel, to_address) VALUES (?, '[Taken back]', 'sent', 'undone', 'sms', '07700 900 142')").run(maya.id);
  });
  mayaCookie = await signIn(mayaEmail);
  samCookie = await signIn(`sam-${randomUUID().slice(0, 8)}@example.test`);
  const oluEmail = `olu-${randomUUID().slice(0, 8)}@example.test`;
  otherCookie = await signIn(oluEmail, other);
  // Another shop's customer with data of their own (review of #587).
  await inShop(async () => {
    const { customer_id: olu } = await prepare('SELECT customer_id FROM customer_logins WHERE email = ?').get(oluEmail);
    await prepare("INSERT INTO customer_bikes (customer_id, make, model) VALUES (?, '[Elsewhere make]', '[Elsewhere model]')").run(olu);
    await prepare("INSERT INTO job_notes (customer_id, from_customer, body) VALUES (?, true, '[Elsewhere message]')").run(olu);
  }, other.shop.id);
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (other) await deleteTestShop(other.shop.id);
  if (server) await server.stop();
});

test('Maya downloads one zip of her details, bikes, repairs, purchases, messages and answers', async (t) => {
  const { res, body } = await download();
  assert.equal(res.status, 200, body.toString());
  assert.equal(res.headers.get('content-type'), 'application/zip');
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.equal(res.headers.get('content-disposition'), `attachment; filename="${owner.shop.slug}-your-data-2026-09-01.zip"`);
  const files = filesOf(body, t);
  assert.deepEqual(Object.keys(files), ['your-details.csv', 'your-bikes.csv', 'your-repairs.csv', 'your-purchases.csv', 'your-messages.csv', 'what-you-agreed-to.csv']);
  assert.match(files['your-details.csv'], /Maya Patel/);
  assert.match(files['your-details.csv'], /07700 900 142/);
  assert.ok(files['your-details.csv'].includes(mayaEmail));
  assert.doesNotMatch(files['your-details.csv'], /private note/, 'the shop’s own note stays out (design 3)');
  assert.match(files['your-bikes.csv'], /Trek,Domane AL 3,green/);
  assert.doesNotMatch(files['your-bikes.csv'], /Removed/, 'a bike taken off the account stays out');
  const all = Object.values(files).join('\n');
  assert.doesNotMatch(all, /Shop’s (bike|job) note|private note/, 'the shop’s own notes stay out of every file');
  assert.doesNotMatch(all, /Elsewhere/, 'nothing of another shop’s');
  assert.match(files['your-repairs.csv'], /2026-08-30 10:15/, 'when she agreed to the booking terms, in the shop’s time');
  for (const cell of ["'+1", "'@SUM(1)", "'\tx", "'-1+1"]) assert.ok(files['your-purchases.csv'].includes(`,${cell},`), `${JSON.stringify(cell)} in ${files['your-purchases.csv']}`);
  assert.ok(files['your-repairs.csv'].includes(job.reference), files['your-repairs.csv']);
  assert.match(files['your-repairs.csv'], /Standard service/);
  assert.match(files['your-repairs.csv'], /2026-09-05/);
  assert.match(files['your-purchases.csv'], /12\.00/);
  assert.match(files['your-purchases.csv'], /,2026-08-24,\[Late sale\],/, 'the shop’s day, not UTC’s');
  assert.match(files['your-purchases.csv'], /,-5\.00\r\n/, 'a refund’s total stays a number');
  // Each file says it is UTF-8, so Excel shows £ and ’ as they are (review).
  for (const [name, text] of Object.entries(files)) assert.ok(text.startsWith('\uFEFF'), `${name} starts with the UTF-8 mark`);
  // A formula-looking cell is made safe (design 3).
  assert.ok(files['your-purchases.csv'].includes(`"'=HYPERLINK(""x"")"`), files['your-purchases.csv']);
  assert.match(files['your-messages.csv'], /\[Maya’s message\]/);
  assert.match(files['your-messages.csv'], /\[Bike ready text\]/);
  assert.doesNotMatch(files['your-messages.csv'], /Taken back/, 'only messages that went');
  assert.match(files['what-you-agreed-to.csv'], /Job updates by,Text/);
  assert.match(files['what-you-agreed-to.csv'], /Service reminders,Yes/);
  assert.match(files['what-you-agreed-to.csv'], /Review requests,No/);
  assert.match(files['what-you-agreed-to.csv'], /Offers and news,No/);
  assert.match(files['what-you-agreed-to.csv'], /at booking/);
});

test('the copy is logged as a privacy request from the account, done at once', async () => {
  const before = (await requests(maya.id)).length;
  const { res } = await download();
  assert.equal(res.status, 200);
  const logged = await requests(maya.id);
  assert.equal(logged.length, before + 1);
  const last = logged.at(-1);
  assert.equal(last.kind, 'copy');
  assert.equal(last.source, 'account');
  assert.ok(last.done_at instanceof Date);
  assert.equal(last.done_at.getTime(), last.asked_at.getTime());
});

test('only her own: another customer’s copy has nothing of Maya’s', async (t) => {
  const { res, body } = await download({ cookie: samCookie });
  assert.equal(res.status, 200);
  const all = Object.values(filesOf(body, t)).join('\n');
  assert.doesNotMatch(all, /Maya|Trek|Standard service|HYPERLINK|Bike ready/);
});

test('signed out, signed in to another shop, or from another website: refused, and nothing logged', async () => {
  const before = (await requests(maya.id)).length;
  assert.equal((await download({ cookie: null })).res.status, 401);
  assert.equal((await download({ cookie: otherCookie })).res.status, 401);
  assert.equal((await download({ headers: { 'sec-fetch-site': 'cross-site' } })).res.status, 403);
  assert.equal((await download({ headers: { 'sec-fetch-site': 'same-site' } })).res.status, 403, 'another site of the same domain too');
  assert.equal((await requests(maya.id)).length, before);
});

test('a merge carries the log with the customer, and its Undo carries it back', async () => {
  const twin = (await staff('/api/customers', { method: 'POST', body: { name: 'Maya P.', phone: '07700 900 142' } })).body;
  const logged = await inShop(async () => (await prepare("INSERT INTO privacy_requests (customer_id, kind, source, done_at) VALUES (?, 'copy', 'account', now()) RETURNING id").get(twin.id)).id);
  const ownerOf = () => inShop(async () => (await prepare('SELECT customer_id FROM privacy_requests WHERE id = ?').get(logged)).customer_id);
  const merged = await staff(`/api/customers/${maya.id}/merge`, { method: 'POST', body: { otherId: twin.id, keep: {} } });
  assert.equal(merged.status, 200, JSON.stringify(merged.body));
  assert.equal(await ownerOf(), maya.id);
  const undo = await staff(`/api/customer-merges/${merged.body.id}/undo`, { method: 'POST', body: {} });
  assert.equal(undo.status, 200, JSON.stringify(undo.body));
  assert.equal(await ownerOf(), twin.id);
});

test('a sign-in whose customer record was merged away gets nothing, and nothing is logged', async () => {
  const email = `kai-${randomUUID().slice(0, 8)}@example.test`;
  const cookie = await signIn(email);
  const kai = await inShop(() => prepare('SELECT customer_id FROM customer_logins WHERE email = ?').get(email));
  // As a merge leaves the other record: inactive and pointing at the kept one,
  // here without the sign-in moved, as a request racing the merge would see it.
  await inShop(() => prepare('UPDATE customers SET active = 0, merged_into_id = ? WHERE id = ?').run(maya.id, kai.customer_id));
  const { res } = await download({ cookie });
  assert.equal(res.status, 401);
  assert.equal((await requests(kai.customer_id)).length, 0);
});

test('a company’s details and every answer are in its copy', async (t) => {
  const email = `club-${randomUUID().slice(0, 8)}@example.test`;
  const cookie = await signIn(email);
  const { customer_id: id } = await inShop(() => prepare('SELECT customer_id FROM customer_logins WHERE email = ?').get(email));
  await inShop(() => prepare(
    `UPDATE customers SET name = '[Club name]', is_company = true, contact_name = '[Contact name]', vat_number = '[VAT number]',
            invoice_email = '[invoice email]', update_channel = 'email', review_requests = true, marketing_permission = true,
            reminders_said_yes_at = '2026-08-25T13:00:00Z', reminders_said_yes_via = 'account' WHERE id = ?`
  ).run(id));
  const { res, body } = await download({ cookie });
  assert.equal(res.status, 200);
  const files = filesOf(body, t);
  for (const line of ['Name,[Club name]', 'Contact name,[Contact name]', 'VAT number,[VAT number]', 'Send invoices to,[invoice email]', `Email you sign in with,${email}`]) {
    assert.ok(files['your-details.csv'].includes(line), `${line} in ${files['your-details.csv']}`);
  }
  for (const line of ['Job updates by,Email', 'Service reminders,No', 'Review requests,Yes', 'Offers and news,Yes', 'Said yes to reminders,"2026-08-25 14:00, from your account"']) {
    assert.ok(files['what-you-agreed-to.csv'].includes(line), `${line} in ${files['what-you-agreed-to.csv']}`);
  }
});

test('ten copies in a quarter of an hour, then a plain refusal, not logged', async () => {
  const email = `lena-${randomUUID().slice(0, 8)}@example.test`;
  const cookie = await signIn(email);
  const { customer_id: id } = await inShop(() => prepare('SELECT customer_id FROM customer_logins WHERE email = ?').get(email));
  for (let i = 0; i < 10; i += 1) assert.equal((await download({ cookie })).res.status, 200, `copy ${i + 1}`);
  const { res, body } = await download({ cookie });
  assert.equal(res.status, 429);
  assert.match(JSON.parse(body.toString()).error, /a lot of copies at once/);
  assert.equal((await requests(id)).length, 10);
  // Another sign-in isn't held up by hers.
  assert.equal((await download({ cookie: samCookie })).res.status, 200);
});

test('a copy downloaded by the merged-away person’s sign-in goes back with them on Undo', async () => {
  // Only one of two records may have an online account to be merged: the merged-away one here.
  const kept = (await staff('/api/customers', { method: 'POST', body: { name: '[Kept name]' } })).body;
  const goneEmail = `gone-${randomUUID().slice(0, 8)}@example.test`;
  const gone = (await staff('/api/customers', { method: 'POST', body: { name: '[Merged name]', email: goneEmail } })).body;
  await inShop(() => prepare('UPDATE customers SET email_from_customer = true WHERE id = ?').run(gone.id));
  const goneCookie = await signIn(goneEmail);
  const merged = await staff(`/api/customers/${kept.id}/merge`, { method: 'POST', body: { otherId: gone.id, keep: {} } });
  assert.equal(merged.status, 200, JSON.stringify(merged.body));
  // Their sign-in now reaches the kept record, and the copy is logged there.
  assert.equal((await download({ cookie: goneCookie })).res.status, 200);
  assert.equal((await requests(kept.id)).length, 1);
  // One the shop logged for the kept record itself stays with it.
  await inShop(() => prepare("INSERT INTO privacy_requests (customer_id, kind, source) VALUES (?, 'copy', 'shop')").run(kept.id));
  const undo = await staff(`/api/customer-merges/${merged.body.id}/undo`, { method: 'POST', body: {} });
  assert.equal(undo.status, 200, JSON.stringify(undo.body));
  assert.equal((await requests(gone.id)).length, 1, 'the merged-away person’s copy goes back with their sign-in');
  assert.deepEqual((await requests(kept.id)).map((r) => r.source), ['shop'], 'the kept record’s own request stays');
});
