// Emailing a receipt, the email side (openspec/changes/receipt-email;
// cp-receipt-email, cp-receipt-address; leftover screens review 1–3; print
// receipt answer 2; Jack, 23 Oct, answer 3).
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
let sale;

before(async () => {
  server = await startLiveServer({ env: { WH_MESSAGES_TICK_MS: '100' } });
  owner = await staffSignup(server.baseUrl, { shopName: 'Receipt Cycles' });
  other = await staffSignup(server.baseUrl, { shopName: 'Elsewhere Cycles' });
  const cashier = (await staff('/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `jo-${randomUUID().slice(0, 8)}@example.test`, password: 'password123' } })).body;
  maya = (await staff('/api/customers', { method: 'POST', body: { name: 'Maya Patel', email: 'maya.saved@example.com' } })).body;
  const tube = (await staff('/api/products', { method: 'POST', body: { name: 'Inner tube', price: 5, sku: `TUBE-${randomUUID().slice(0, 6)}`, stockQty: 10 } })).body;
  const pads = (await staff('/api/products', { method: 'POST', body: { name: 'Shimano brake pads', price: 28, sku: `PADS-${randomUUID().slice(0, 6)}`, stockQty: 10 } })).body;
  const made = await staff('/api/sales', { method: 'POST', body: { cashierId: cashier.employeeId, customerId: maya.id, items: [{ productId: tube.id, qty: 2 }, { productId: pads.id, qty: 1 }], cardAmount: 38 } });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  sale = made.body;
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (other) await deleteTestShop(other.shop.id);
  if (server) await server.stop();
});

function staff(path, options, who = owner) {
  return staffRequest(server.baseUrl, who.cookie, path, options);
}
const send = (saleId, email, who = owner) => staff(`/api/sales/${saleId}/email-receipt`, { method: 'POST', body: { email } }, who);
const receiptsFor = (saleId) => runWithShop(owner.shop.id, () => prepare("SELECT * FROM customer_messages WHERE sale_id = ? AND template_key = 'receipt' ORDER BY id").all(saleId));

test('a sale’s receipt goes to the address given, with its lines, total and payment, and no VAT line', async () => {
  const res = await send(sale.id, 'maya@example.com');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.to, 'maya@example.com');
  const [m, ...more] = await receiptsFor(sale.id);
  assert.ok(m, 'a receipt message');
  assert.equal(more.length, 0);
  assert.equal(m.channel, 'email');
  assert.equal(m.to_address, 'maya@example.com');
  assert.equal(m.customer_id, maya.id, 'the sale’s customer, for their history');
  assert.match(m.subject, /^Your receipt — Receipt Cycles/);
  const body = m.body;
  assert.match(body, /^Your receipt\n/);
  assert.match(body, new RegExp(`\\nSale ${sale.id}\\n`));
  assert.match(body, /\nInner tube 2 × £5\.00 +£10\.00\n/);
  assert.match(body, /\nShimano brake pads +£28\.00\n/);
  assert.match(body, /\nTotal +£38\.00\n/);
  assert.match(body, /\nPaid by card +£38\.00\n/);
  assert.doesNotMatch(body, /VAT/);
  assert.match(body, /Keep this for returns\. Show this email or give the sale number\.$/);
});

test('it is sent through the pretend sender, and the customer’s saved address is unchanged', async () => {
  await send(sale.id, 'someone.else@example.com');
  let row;
  for (let i = 0; i < 100; i++) {
    row = (await receiptsFor(sale.id)).find((r) => r.to_address === 'someone.else@example.com');
    if (row?.sent_at) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.ok(row?.sent_at, `sent, was ${row?.intent_state}`);
  assert.equal((await staff(`/api/customers/${maya.id}`)).body.email, 'maya.saved@example.com');
});

test('an address that isn’t one is refused in the drawn words, and nothing is sent', async () => {
  const before = (await receiptsFor(sale.id)).length;
  for (const email of ['maya@example', 'maya example.com', '', null, 42, `${'a'.repeat(250)}@example.com`]) {
    const res = await send(sale.id, email);
    assert.equal(res.status, 400, JSON.stringify(email));
    assert.equal(res.body.error, 'That doesn’t look like an email address — check it');
  }
  assert.equal((await receiptsFor(sale.id)).length, before);
});

test('an unknown sale, or another shop’s, isn’t found', async () => {
  assert.equal((await send(999999999, 'maya@example.com')).status, 404);
  assert.equal((await send(sale.id, 'maya@example.com', other)).status, 404);
});

test('signed out is refused', async () => {
  const res = await fetch(`${server.baseUrl}/api/sales/${sale.id}/email-receipt`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'maya@example.com' }) });
  assert.equal(res.status, 401);
});

test('in the customer’s history it is called Receipt, and the old app’s texts leave it out (review)', async () => {
  await send(sale.id, 'maya@example.com');
  const history = (await staff(`/api/messages?customerId=${maya.id}`)).body;
  assert.ok(history.length > 0 && history.every((m) => m.key !== 'receipt' || m.name === 'Receipt'), JSON.stringify(history.map((m) => m.name)));
  const texts = (await staff(`/api/customers/${maya.id}/texts`)).body;
  assert.ok(Array.isArray(texts) && !texts.some((t) => /Your receipt/.test(t.body ?? '')), 'a receipt among the texts');
});

test('one sale’s receipt can be sent five times in an hour, not more (review)', async () => {
  const cashier = (await staff('/api/team', { method: 'POST', body: { name: 'Sam Reed', isCashier: true, email: `sam-${randomUUID().slice(0, 8)}@example.test`, password: 'password123' } })).body;
  const tube = (await staff('/api/products', { method: 'POST', body: { name: 'Valve cap', price: 1, sku: `CAP-${randomUUID().slice(0, 6)}`, stockQty: 10 } })).body;
  const fresh = (await staff('/api/sales', { method: 'POST', body: { cashierId: cashier.employeeId, items: [{ productId: tube.id, qty: 1 }], cashAmount: 1, cashTendered: 1 } })).body;
  for (let i = 0; i < 5; i++) assert.equal((await send(fresh.id, `a${i}@example.com`)).status, 200);
  const sixth = await send(fresh.id, 'a6@example.com');
  assert.equal(sixth.status, 429, JSON.stringify(sixth.body));
  assert.equal(sixth.body.error, 'This receipt has been sent five times in the last hour. Try again later.');
  assert.equal((await receiptsFor(fresh.id)).length, 5);
});

// A company's receipt is an invoice (openspec/changes/company-customers
// design 4; collect.mjs receiptBody with invoice; leftover screens H2 and
// Jack's generic VAT invoice, 2 Oct; day answers 26 Oct, 3). Headed "Invoice",
// not the drawn "VAT invoice", until sales record VAT (day answers 26 Oct,
// 10). Example details are the drawing's placeholders.
async function companySale(details) {
  const club = (await staff('/api/customers', { method: 'POST', body: { isCompany: true, name: '[Company name]', contactName: '[Contact name]', phone: '07700 900777', ...details } })).body;
  const cashier = (await staff('/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `jo-${randomUUID().slice(0, 8)}@example.test`, password: 'password123' } })).body;
  const tube = (await staff('/api/products', { method: 'POST', body: { name: 'Inner tube', price: 5, sku: `TUBE-${randomUUID().slice(0, 6)}`, stockQty: 10 } })).body;
  const made = await staff('/api/sales', { method: 'POST', body: { cashierId: cashier.employeeId, customerId: club.id, items: [{ productId: tube.id, qty: 1 }], cardAmount: 5 } });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  return made.body;
}

test('a company’s receipt is headed Invoice, not VAT invoice, until VAT is recorded, with Invoice to from its record', async () => {
  const s = await companySale({ address: '[Company address]', postcode: '[postcode]', vatNumber: '[Company VAT number]', invoiceEmail: 'accounts@example.com' });
  assert.equal((await send(s.id, 'accounts@example.com')).status, 200);
  const [m] = await receiptsFor(s.id);
  assert.match(m.subject, /^Invoice — Receipt Cycles/);
  assert.match(m.body, /^Invoice\n/);
  assert.doesNotMatch(m.body, /VAT invoice/, 'no VAT invoice without its VAT amount');
  assert.doesNotMatch(m.body, /Your receipt/);
  assert.match(m.body, /\n\nInvoice to\n\[Company name\] · \[Company address\], \[postcode\]\nVAT number \[Company VAT number\]\n\nSale /);
  assert.match(m.body, /\nInner tube +£5\.00\n/);
});

test('a blank line in Invoice to is left out', async () => {
  const s = await companySale({});
  assert.equal((await send(s.id, 'accounts@example.com')).status, 200);
  const [m] = await receiptsFor(s.id);
  assert.match(m.body, /\n\nInvoice to\n\[Company name\]\n\nSale /);
  assert.doesNotMatch(m.body, /VAT number \[/);
});

test('a person’s receipt has no Invoice to', async () => {
  const s = (await staff(`/api/customers/${maya.id}`)).body;
  assert.equal(s.isCompany, false);
  const before = (await receiptsFor(sale.id)).length;
  await send(sale.id, 'maya@example.com');
  const m = (await receiptsFor(sale.id))[before];
  assert.match(m.body, /^Your receipt\n/);
  assert.doesNotMatch(m.body, /Invoice to|VAT invoice/);
});

// Company customers' review 3: a line break typed into a company's details
// stays on its line in Invoice to.
test('a line break in a company’s address or VAT number doesn’t break Invoice to', async () => {
  const s = await companySale({ address: '[Unit 4]\n[Mill Lane]', postcode: '[postcode]', vatNumber: 'GB\n123' });
  assert.equal((await send(s.id, 'accounts@example.com')).status, 200);
  const [m] = await receiptsFor(s.id);
  assert.match(m.body, /\n\nInvoice to\n\[Company name\] · \[Unit 4\] \[Mill Lane\], \[postcode\]\nVAT number GB 123\n\nSale /);
});
