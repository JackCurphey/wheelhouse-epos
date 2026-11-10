// A receipt from the account's history (openspec/changes/finish-account
// design 1 and 2; ac-receipt, ac-receipt-sent; Jack's answers of 9 Nov,
// docs/decisions/2026-11-09-account-answers.md): a till sale, with its
// receipt number, opens for its own customer only; Email it to me sends it to
// the account's own email, five an hour at most.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import '../server/load-env.js';
import { runWithShop, prepare } from '../server/db.js';
import { receiptFor, receiptText } from '../server/receipts.js';
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
let sam;
let till;
let jo;

const staff = (path, options, who = owner) => staffRequest(server.baseUrl, who.cookie, path, options);
async function portal(path, { cookie = mayaCookie, method = 'GET', body, shop = owner, headers = {} } = {}) {
  const res = await fetch(`${server.baseUrl}/api/portal/${shop.shop.slug}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

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

let receiptNo = 40;
// A till sale: a pump at 20% and a book at 0%, paid part cash, part card.
async function tillSale(customerId, { shopId = owner.shop.id, tillRow = till, employee = jo } = {}) {
  return runWithShop(shopId, async () => {
    const sale = (await prepare(
      `INSERT INTO till_sales (client_id, till_id, site_id, receipt_number, made_offline, till_clock_at, received_at, total_pence, vat_pence, customer_id, employee_id)
       VALUES (?, ?, ?, ?, false, '2026-08-25T09:05:00Z', '2026-08-25T09:05:00Z', 3700, 400, ?, ?) RETURNING id`
    ).get(randomUUID(), tillRow.id, tillRow.site_id, ++receiptNo, customerId, employee)).id;
    await prepare("INSERT INTO till_sale_lines (till_sale_id, description, qty, unit_price_pence, line_total_pence, vat_rate_bp, vat_pence) VALUES (?, 'Track pump', 2, 1200, 2400, 2000, 400)").run(sale);
    await prepare("INSERT INTO till_sale_lines (till_sale_id, description, qty, unit_price_pence, line_total_pence, vat_rate_bp, vat_pence) VALUES (?, 'Maintenance book', 1, 1300, 1300, 0, 0)").run(sale);
    await prepare("INSERT INTO till_sale_payments (till_sale_id, method, amount_pence) VALUES (?, 'cash', 1000)").run(sale);
    await prepare("INSERT INTO till_sale_payments (till_sale_id, method, amount_pence) VALUES (?, 'card', 2700)").run(sale);
    return sale;
  });
}

async function newTill(shopId) {
  return runWithShop(shopId, async () => {
    const site = await prepare("INSERT INTO sites (name, code) VALUES ('Bolton', 'B') RETURNING id").get();
    const t = await prepare("INSERT INTO tills (site_id, code, name, token_hash) VALUES (?, 'B1', 'Till 1', ?) RETURNING id, site_id").get(site.id, randomUUID());
    const e = (await prepare("INSERT INTO employees (name, is_cashier) VALUES ('Jo Taylor', 1) RETURNING id").get()).id;
    return { till: t, jo: e };
  });
}

before(async () => {
  server = await startLiveServer({ env: { TRUST_PROXY: '1', CUSTOMER_SIGNIN_PROVIDER: 'pretend', APP_PUBLIC_URL: 'https://wh.test' } });
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  other = await staffSignup(server.baseUrl, { shopName: 'Elsewhere Cycles' });
  await runWithShop(owner.shop.id, () => prepare("UPDATE shops SET address = '14 North Street, Bolton', phone = '01204 555 010', vat_number = 'GB123456789' WHERE id = ?").run(owner.shop.id));
  mayaEmail = `maya-${randomUUID().slice(0, 8)}@example.test`;
  maya = (await staff('/api/customers', { method: 'POST', body: { name: 'Maya Patel', email: mayaEmail, phone: '07700 900142' } })).body;
  await runWithShop(owner.shop.id, () => prepare('UPDATE customers SET email_from_customer = true WHERE id = ?').run(maya.id));
  mayaCookie = await signIn(mayaEmail);
  const samEmail = `sam-${randomUUID().slice(0, 8)}@example.test`;
  samCookie = await signIn(samEmail);
  sam = await runWithShop(owner.shop.id, () => prepare('SELECT customer_id AS id FROM customer_logins WHERE email = ?').get(samEmail));
  ({ till, jo } = await newTill(owner.shop.id));
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (other) await deleteTestShop(other.shop.id);
  if (server) await server.stop();
});

test('receiptFor: a till sale’s number, shop, lines, VAT at each rate and payments, in pence', async () => {
  const id = await tillSale(maya.id);
  const r = await runWithShop(owner.shop.id, () => receiptFor({ source: 'till', id }));
  assert.equal(r.heading, 'Receipt');
  assert.equal(r.number, `B1-00${receiptNo}`);
  assert.equal(r.at, '2026-08-25T09:05:00.000Z');
  assert.deepEqual(r.shop, { name: owner.shop.name, address: '14 North Street, Bolton', phone: '01204 555 010', vatNumber: 'GB123456789' });
  assert.equal(r.invoiceTo, null);
  assert.deepEqual(r.lines, [
    { name: 'Track pump', qty: 2, unitPence: 1200, totalPence: 2400 },
    { name: 'Maintenance book', qty: 1, unitPence: 1300, totalPence: 1300 },
  ]);
  assert.equal(r.totalPence, 3700);
  assert.deepEqual(r.vatLines, [{ ratePercent: 20, pence: 400 }]);
  assert.deepEqual(r.payments, [{ how: 'cash', pence: 1000 }, { how: 'card', pence: 2700 }]);
  assert.equal(r.customerId, maya.id);
  // An old-record sale, or none at all, has no receipt here yet (answer 1).
  assert.equal(await runWithShop(owner.shop.id, () => receiptFor({ source: 'old', id: 1 })), null);
  assert.equal(await runWithShop(owner.shop.id, () => receiptFor({ source: 'till', id: 999999999 })), null);
});

test('receiptFor: a company’s receipt is an Invoice, with Invoice to', async () => {
  const company = (await staff('/api/customers', { method: 'POST', body: { name: 'Bolton Couriers Ltd' } })).body;
  await runWithShop(owner.shop.id, () => prepare("UPDATE customers SET is_company = true, address = E'2 Mill Lane\\nBolton', vat_number = 'GB987654321' WHERE id = ?").run(company.id));
  const id = await tillSale(company.id);
  const r = await runWithShop(owner.shop.id, () => receiptFor({ source: 'till', id }));
  assert.equal(r.heading, 'Invoice');
  assert.deepEqual(r.invoiceTo, { name: 'Bolton Couriers Ltd', address: '2 Mill Lane Bolton', vatNumber: 'GB987654321' });
  const text = receiptText(r);
  assert.match(text, /^Invoice\n/);
  assert.match(text, /Invoice to\nBolton Couriers Ltd · 2 Mill Lane Bolton\nVAT number GB987654321/);
});

test('receiptText lays it out as the receipt email does: number, lines, VAT, payments', async () => {
  const id = await tillSale(maya.id);
  const text = receiptText(await runWithShop(owner.shop.id, () => receiptFor({ source: 'till', id })));
  assert.ok(text.startsWith(`Your receipt\n\n${owner.shop.name}\n14 North Street, Bolton\n01204 555 010\nVAT number GB123456789\n`), text);
  assert.match(text, new RegExp(`Receipt B1-00${receiptNo}\n25 Aug 2026 · 10:05`));
  assert.match(text, /Track pump 2 × £12\.00 {2}£24\.00/);
  assert.match(text, /Maintenance book {2}£13\.00/);
  assert.match(text, /Total \(includes VAT\) {2}£37\.00\nVAT at 20% {2}£4\.00\nPaid by cash {2}£10\.00\nPaid by card {2}£27\.00/);
});

test('GET receipts/till/:id: her own sale opens, and one moved to her by a merge', async () => {
  const id = await tillSale(maya.id);
  const res = await portal(`/receipts/till/${id}`);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.number, `B1-00${receiptNo}`);
  assert.equal(res.body.customerId, undefined, 'the customer id stays on the server');
  // An older record of Maya's, merged into her account's record.
  const older = (await staff('/api/customers', { method: 'POST', body: { name: 'M Patel' } })).body;
  const olderSale = await tillSale(older.id);
  const merged = await staff(`/api/customers/${maya.id}/merge`, { method: 'POST', body: { otherId: older.id, keep: { name: 'this' } } });
  assert.equal(merged.status, 200, JSON.stringify(merged.body));
  assert.equal((await portal(`/receipts/till/${olderSale}`)).status, 200);
});

test('GET receipts/till/:id: another customer’s, another shop’s, an old-record sale and nonsense are all "We can’t find that receipt"', async () => {
  const samSale = await tillSale(sam.id);
  const elsewhere = await newTill(other.shop.id);
  const otherSale = await tillSale(null, { shopId: other.shop.id, tillRow: elsewhere.till, employee: elsewhere.jo });
  const oldSale = await runWithShop(owner.shop.id, async () => (await prepare(
    "INSERT INTO sales (created_at, subtotal, total, payment_method, cash_amount, customer_id) VALUES ('2026-08-20T10:00:00Z', 12, 12, 'Cash', 12, ?) RETURNING id"
  ).get(maya.id)).id);
  for (const [why, path, opts] of [
    ['another customer’s', `/receipts/till/${samSale}`, {}],
    ['another shop’s', `/receipts/till/${otherSale}`, {}],
    ['an old-record sale', `/receipts/old/${oldSale}`, {}],
    ['an old-record id as a till one', `/receipts/till/${oldSale + 1000000}`, {}],
  ]) {
    const r = await portal(path, opts);
    assert.equal(r.status, 404, why);
    assert.deepEqual(r.body, { error: 'We can’t find that receipt' }, why);
  }
  assert.equal((await portal(`/receipts/till/${samSale}`, { cookie: null })).status, 401);
  assert.equal((await portal(`/receipts/till/${samSale}`, { cookie: samCookie })).status, 200);
});

test('a receipt shows its prices with Show prices online off (answer 5)', async () => {
  const id = await tillSale(maya.id);
  await staff('/api/workshop-settings', { method: 'PUT', body: { showPricesOnline: false } });
  try {
    const res = await portal(`/receipts/till/${id}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.totalPence, 3700);
    assert.equal(res.body.lines[0].totalPence, 2400);
  } finally {
    await staff('/api/workshop-settings', { method: 'PUT', body: { showPricesOnline: true } });
  }
});

test('Email it to me sends to the account’s own email whatever the request says', async () => {
  const id = await tillSale(maya.id);
  const res = await portal(`/receipts/till/${id}/email`, { method: 'POST', body: { email: 'someone@elsewhere.test', to: 'someone@elsewhere.test' } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(res.body, { sentTo: mayaEmail });
  const sent = await runWithShop(owner.shop.id, () => prepare("SELECT to_address, subject, body, customer_id FROM customer_messages WHERE template_key = 'account_receipt' ORDER BY id DESC LIMIT 1").get());
  assert.equal(sent.to_address, mayaEmail);
  assert.equal(sent.subject, `Your receipt — ${owner.shop.name}`);
  assert.equal(sent.customer_id, maya.id);
  assert.match(sent.body, new RegExp(`Receipt B1-00${receiptNo}`));
  // Someone else's receipt can't be sent at all.
  const samSale = await tillSale(sam.id);
  assert.equal((await portal(`/receipts/till/${samSale}/email`, { method: 'POST', body: {} })).status, 404);
});

test('Email it to me from another website is refused, and nothing is sent', async () => {
  const id = await tillSale(maya.id);
  const count = () => runWithShop(owner.shop.id, async () => (await prepare("SELECT count(*)::int AS n FROM customer_messages WHERE template_key = 'account_receipt'").get()).n);
  const before = await count();
  const res = await portal(`/receipts/till/${id}/email`, { method: 'POST', body: {}, headers: { 'sec-fetch-site': 'cross-site' } });
  assert.equal(res.status, 403);
  assert.equal(await count(), before);
});

test('the sixth receipt emailed in an hour is refused and not sent', async () => {
  const email = `lee-${randomUUID().slice(0, 8)}@example.test`;
  const cookie = await signIn(email);
  const lee = await runWithShop(owner.shop.id, () => prepare('SELECT customer_id AS id FROM customer_logins WHERE email = ?').get(email));
  const id = await tillSale(lee.id);
  const id2 = await tillSale(lee.id);
  for (let i = 0; i < 5; i++) {
    assert.equal((await portal(`/receipts/till/${i % 2 ? id : id2}/email`, { method: 'POST', body: {}, cookie })).status, 200, `send ${i + 1}`);
  }
  const sixth = await portal(`/receipts/till/${id}/email`, { method: 'POST', body: {}, cookie });
  assert.equal(sixth.status, 429);
  const n = await runWithShop(owner.shop.id, async () => (await prepare("SELECT count(*)::int AS n FROM customer_messages WHERE template_key = 'account_receipt' AND customer_id = ?").get(lee.id)).n);
  assert.equal(n, 5);
});

test('the history: a till purchase carries its receipt, an old-record one none, and a repair’s own sale is not a purchase too', async () => {
  const email = `ana-${randomUUID().slice(0, 8)}@example.test`;
  const cookie = await signIn(email);
  const ana = await runWithShop(owner.shop.id, () => prepare('SELECT customer_id AS id FROM customer_logins WHERE email = ?').get(email));
  const tillId = await tillSale(ana.id);
  const job = (await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Standard service', jobDate: '2026-09-03', customerId: ana.id } })).body;
  const orderId = (await staff(`/api/workshop-jobs/${job.id}`)).body.orderId;
  await runWithShop(owner.shop.id, async () => {
    const old = (await prepare("INSERT INTO sales (created_at, subtotal, total, payment_method, cash_amount, customer_id) VALUES ('2026-08-20T10:00:00Z', 12, 12, 'Cash', 12, ?) RETURNING id").get(ana.id)).id;
    await prepare("INSERT INTO sale_items (sale_id, name, unit_price, qty, line_total, line_type) VALUES (?, 'Inner tube', 12, 1, 12, 'labour')").run(old);
    const repairSale = (await prepare("INSERT INTO sales (created_at, subtotal, total, payment_method, card_amount, customer_id) VALUES ('2026-09-03T16:00:00Z', 65, 65, 'Card', 65, ?) RETURNING id").get(ana.id)).id;
    await prepare("INSERT INTO sale_items (sale_id, name, unit_price, qty, line_total, line_type) VALUES (?, 'Standard service', 65, 1, 65, 'labour')").run(repairSale);
    await prepare("UPDATE sale_documents SET status = 'converted', converted_sale_id = ? WHERE id = ?").run(repairSale, orderId);
  });
  const res = await portal('/history', { cookie });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const purchases = res.body.filter((h) => h.kind === 'purchase');
  assert.deepEqual(purchases.map((p) => [p.what, p.receipt]), [
    ['Track pump, Maintenance book', { source: 'till', id: tillId }],
    ['Inner tube', null],
  ]);
  assert.equal(res.body.filter((h) => h.kind === 'repair').length, 1, 'the repair, once');
});
