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
    await prepare("INSERT INTO job_notes (customer_id, from_customer, body) VALUES (?, true, '[Maya’s message]')").run(maya.id);
    await prepare("INSERT INTO customer_messages (customer_id, body, status, intent_state, channel, to_address, sent_at) VALUES (?, '[Bike ready text]', 'sent', 'delivered', 'sms', '07700 900 142', '2026-09-05T15:00:00Z')").run(maya.id);
    await prepare("INSERT INTO customer_messages (customer_id, body, status, intent_state, channel, to_address) VALUES (?, '[Taken back]', 'sent', 'undone', 'sms', '07700 900 142')").run(maya.id);
  });
  mayaCookie = await signIn(mayaEmail);
  samCookie = await signIn(`sam-${randomUUID().slice(0, 8)}@example.test`);
  otherCookie = await signIn(`olu-${randomUUID().slice(0, 8)}@example.test`, other);
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
  assert.ok(files['your-repairs.csv'].includes(job.reference), files['your-repairs.csv']);
  assert.match(files['your-repairs.csv'], /Standard service/);
  assert.match(files['your-repairs.csv'], /2026-09-05/);
  assert.match(files['your-purchases.csv'], /12\.00/);
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
