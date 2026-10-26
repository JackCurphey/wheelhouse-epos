// Customers, the server side of the list and Add a customer
// (openspec/changes/customers-list; cs-list, cs-add, cs-add-match; customer
// service review 3, 5, 12).
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

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'Customer Cycles' });
  other = await staffSignup(server.baseUrl, { shopName: 'Elsewhere Cycles' });
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (other) await deleteTestShop(other.shop.id);
  if (server) await server.stop();
});

function staff(path, options, who = owner) {
  return staffRequest(server.baseUrl, who.cookie, path, options);
}
const add = async (body, who = owner) => (await staff('/api/customers', { method: 'POST', body }, who)).body;

test('adding keeps the address, postcode and offers, and reads them back', async () => {
  const maya = await add({ name: 'Maya Patel', phone: '07700 900142', address: '12 North Street, Bolton', postcode: 'BL1 2AB', marketingPermission: true });
  assert.equal(maya.address, '12 North Street, Bolton');
  assert.equal(maya.postcode, 'BL1 2AB');
  assert.equal(maya.marketingPermission, true);
  const read = (await staff(`/api/customers/${maya.id}`)).body;
  assert.deepEqual([read.address, read.postcode, read.marketingPermission], ['12 North Street, Bolton', 'BL1 2AB', true]);
  const plain = await add({ name: 'Sam Reed', phone: '07700 900500' });
  assert.equal(plain.marketingPermission, false, 'offers start off');
  assert.equal(plain.address, null);
});

test('recent customers: the newest job or change first', async () => {
  const older = await add({ name: 'Oliver Chen', phone: '07700 900600' });
  const newer = await add({ name: 'Aisha Khan', phone: '07700 900700' });
  // Oliver gets a job now, so he was seen most recently.
  await runWithShop(owner.shop.id, () => prepare("UPDATE customers SET updated_at = now() - interval '2 days' WHERE id IN (?, ?)").run(older.id, newer.id));
  await runWithShop(owner.shop.id, () => prepare("UPDATE customers SET updated_at = now() - interval '1 day' WHERE id = ?").run(newer.id));
  await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Gear tune', jobDate: '2026-09-20', customerId: older.id } });
  const ids = (await staff('/api/recent-customers')).body.map((c) => c.id);
  assert.ok(ids.indexOf(older.id) >= 0 && ids.indexOf(older.id) < ids.indexOf(newer.id), JSON.stringify(ids));
});

test('a recent customer carries their newest bike', async () => {
  const lena = await add({ name: 'Lena Fox', phone: '07700 900800' });
  await runWithShop(owner.shop.id, async () => {
    await prepare("INSERT INTO customer_bikes (customer_id, make, model, created_at) VALUES (?, 'Giant', 'Escape 2', now() - interval '1 year')").run(lena.id);
    await prepare("INSERT INTO customer_bikes (customer_id, make, model) VALUES (?, 'Cube', 'Attain')").run(lena.id);
  });
  const row = (await staff('/api/recent-customers')).body.find((c) => c.id === lena.id);
  assert.equal(row.bikeLabel, 'Cube Attain');
  assert.equal(row.phone, '07700 900800');
});

test('a match by phone however it’s spaced, or by email; not a removed one or another shop’s', async () => {
  const jamie = await add({ name: 'Jamie Brooks', phone: '07700 900300', email: 'jamie@example.com' });
  const match = async (q, who) => (await staff(`/api/customer-matches?${new URLSearchParams(q)}`, {}, who)).body;
  assert.deepEqual((await match({ phone: '07700900300' })).map((c) => c.id), [jamie.id]);
  assert.deepEqual((await match({ phone: '07700 900 300' })).map((c) => c.id), [jamie.id]);
  assert.deepEqual((await match({ email: 'JAMIE@example.com' })).map((c) => c.id), [jamie.id]);
  assert.deepEqual(await match({ phone: '0770' }), [], 'too short to be a number');
  assert.deepEqual(await match({ phone: '07700 900300' }, other), [], 'another shop’s');
  const m = (await match({ phone: '07700900300' }))[0];
  assert.deepEqual([m.name, m.phone], ['Jamie Brooks', '07700 900300']);
  assert.equal((await staff(`/api/customers/${jamie.id}`, { method: 'DELETE' })).status < 300, true);
  assert.deepEqual(await match({ phone: '07700900300' }), [], 'removed');
});

test('the header search finds a customer by postcode, however it’s typed', async () => {
  const priya = await add({ name: 'Priya Shah', phone: '07700 900900', postcode: 'BL3 5XY' });
  for (const q of ['BL3 5XY', 'bl35xy']) {
    assert.ok((await staff(`/api/search?q=${encodeURIComponent(q)}`)).body.customers.some((c) => c.id === priya.id), q);
  }
});

test('a number written +44 matches the same number written 07… (review)', async () => {
  const aisha = await add({ name: 'Aisha Khan', phone: '07700 900421' });
  const match = async (phone) => (await staff(`/api/customer-matches?${new URLSearchParams({ phone })}`)).body.map((c) => c.id);
  assert.deepEqual(await match('+44 7700 900421'), [aisha.id]);
  assert.deepEqual(await match('0044 7700 900421'), [aisha.id]);
  const abroad = await add({ name: 'Priya Shah', phone: '+44 7700 900422' });
  assert.deepEqual(await match('07700 900422'), [abroad.id], 'stored +44, typed 07');
});

test('saving without the new fields keeps them, as the old app saves (review)', async () => {
  const lena = await add({ name: 'Lena Fox', phone: '07700 900811', address: '1 High Street', postcode: 'BL2 3CD', marketingPermission: true });
  const res = await staff(`/api/customers/${lena.id}`, { method: 'PUT', body: { name: 'Lena Fox', phone: '07700 900811', email: '', notes: 'Rides a Cube' } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual([res.body.address, res.body.postcode, res.body.marketingPermission, res.body.notes], ['1 High Street', 'BL2 3CD', true, 'Rides a Cube']);
});

// Option 2 (Jack, 26 Oct, docs/decisions/2026-10-26-customer-account.md): only
// an email the customer gave themselves lets a code sign-in join them, so an
// email staff type in is marked as theirs, and staff changing one unmarks it.
const fromCustomer = async (id) => (await runWithShop(owner.shop.id, () => prepare('SELECT email_from_customer AS f FROM customers WHERE id = ?').get(id))).f;
test('an email staff type in isn’t the customer’s own; staff changing an email makes it theirs again', async () => {
  const ravi = await add({ name: 'Ravi Shah', phone: '07700 900812', email: 'ravi@example.test' });
  assert.equal(await fromCustomer(ravi.id), false);
  await runWithShop(owner.shop.id, () => prepare('UPDATE customers SET email_from_customer = true WHERE id = ?').run(ravi.id));
  // Saving with the same email (in other case) leaves it the customer's.
  await staff(`/api/customers/${ravi.id}`, { method: 'PUT', body: { name: 'Ravi Shah', phone: '07700 900812', email: 'Ravi@Example.test' } });
  assert.equal(await fromCustomer(ravi.id), true);
  await staff(`/api/customers/${ravi.id}`, { method: 'PUT', body: { name: 'Ravi Shah', phone: '07700 900812', email: 'ravi.s@example.test' } });
  assert.equal(await fromCustomer(ravi.id), false);
});

// A company or club (openspec/changes/company-customers; cs-add-company;
// customer service review 3; leftover screens H2). Example details are the
// drawing's placeholders.
const COMPANY = { isCompany: true, name: '[Company name]', contactName: '[Contact name]', phone: '07700 900777', address: '[Company address]', vatNumber: '[Company VAT number]', invoiceEmail: 'accounts@example.com' };

test('a company or club keeps its contact, VAT number and “Send invoices to”, and reads them back', async () => {
  const club = await add(COMPANY);
  assert.equal(club.name, '[Company name]');
  assert.deepEqual([club.isCompany, club.contactName, club.vatNumber, club.invoiceEmail], [true, '[Contact name]', '[Company VAT number]', 'accounts@example.com']);
  const read = (await staff(`/api/customers/${club.id}`)).body;
  assert.deepEqual([read.isCompany, read.contactName, read.vatNumber, read.invoiceEmail], [true, '[Contact name]', '[Company VAT number]', 'accounts@example.com']);
  const person = await add({ name: 'Maya Patel', phone: '07700 900142' });
  assert.deepEqual([person.isCompany, person.contactName, person.vatNumber, person.invoiceEmail], [false, null, null, null], 'a person unless chosen');
});

test('a company needs a contact name; VAT number and “Send invoices to” are optional', async () => {
  const res = await staff('/api/customers', { method: 'POST', body: { ...COMPANY, contactName: '  ' } });
  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'Add the contact’s name.');
  const bare = await add({ ...COMPANY, vatNumber: '', invoiceEmail: '' });
  assert.deepEqual([bare.isCompany, bare.vatNumber, bare.invoiceEmail], [true, null, null]);
});

test('“Send invoices to” must be an email address', async () => {
  for (const invoiceEmail of ['accounts@example', 'accounts example.com', 42]) {
    const res = await staff('/api/customers', { method: 'POST', body: { ...COMPANY, invoiceEmail } });
    assert.equal(res.status, 400, JSON.stringify(invoiceEmail));
    assert.equal(res.body.error, 'That doesn’t look like an email address — check it');
  }
  const club = await add(COMPANY);
  const put = await staff(`/api/customers/${club.id}`, { method: 'PUT', body: { invoiceEmail: 'nope' } });
  assert.equal(put.status, 400);
});

test('editing keeps the company details unless changed; a company made a person keeps none', async () => {
  const club = await add(COMPANY);
  const kept = (await staff(`/api/customers/${club.id}`, { method: 'PUT', body: { phone: '07700 900778' } })).body;
  assert.deepEqual([kept.isCompany, kept.contactName, kept.vatNumber, kept.invoiceEmail], [true, '[Contact name]', '[Company VAT number]', 'accounts@example.com']);
  const changed = (await staff(`/api/customers/${club.id}`, { method: 'PUT', body: { vatNumber: '[new VAT number]' } })).body;
  assert.equal(changed.vatNumber, '[new VAT number]');
  const person = (await staff(`/api/customers/${club.id}`, { method: 'PUT', body: { isCompany: false } })).body;
  assert.deepEqual([person.isCompany, person.contactName, person.vatNumber, person.invoiceEmail], [false, null, null, null]);
  const maya = await add({ name: 'Maya Patel', phone: '07700 900142' });
  const nowCompany = await staff(`/api/customers/${maya.id}`, { method: 'PUT', body: { isCompany: true } });
  assert.equal(nowCompany.status, 400, 'a company needs a contact name');
});
