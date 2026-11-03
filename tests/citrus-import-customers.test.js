// Customers and bikes from Citrus Lime (openspec/changes/citrus-import-customers;
// Moving from Citrus Lime decisions 2 and 3; mv-summary; mv-fix's reasons; Jack's
// 30 Oct answer 3). Every file is made up. Maya is the drawings'; the rest is placeholder.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { bringAcrossRound } from '../server/move/bring-across.js';
import { consentDay } from '../server/move/bring-customers.js';
import { deleteCustomerDetails } from '../server/privacy-requests.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';
import { xlsxOf } from './helpers/xlsx.js';

let server;
let owner;
before(async () => {
  server = await startLiveServer({ env: { WH_MOVE_TICK_MS: '3600000' } });
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
});
after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const staff = (path, options) => staffRequest(server.baseUrl, owner.cookie, path, options);
const key = () => randomBytes(24).toString('hex');
const send = (file) => staff('/api/move/files', { method: 'POST', body: { fileName: 'export.xlsx', dataBase64: file.toString('base64'), requestKey: key() } });
const inShop = (fn) => runWithShop(owner.shop.id, fn);
const finish = async () => { for (let i = 0; i < 5; i += 1) await bringAcrossRound(); };
const fileIn = async (id) => (await staff('/api/move')).body.files.find((f) => f.id === id);
const whyOf = (fileId) => inShop(() => prepare("SELECT why FROM move_rows WHERE file_id = ? AND state = 'look' ORDER BY id").all(fileId));
const byAccount = (account) => inShop(() => prepare('SELECT * FROM customers WHERE citrus_account = ?').get(account));
const bikesOf = (id) => inShop(() => prepare('SELECT model, serial_number FROM customer_bikes WHERE customer_id = ? ORDER BY id').all(id));

const HEAD = ['Account Number', 'Total Sales', 'First Name', 'Last Name', 'Address', 'Address 2', 'City', 'County', 'Postcode', 'Country', 'Email', 'Phone', 'GDPR Consent', 'GDPR Consent Date'];
let n = 0;
// Numbers and addresses unique to each made-up person, none of them real.
const person = (over = {}) => {
  n += 1;
  const v = { 'Account Number': `A${n}-${key().slice(0, 6)}`, 'Total Sales': 99, 'First Name': 'Maya', 'Last Name': `Person${n}`, Address: '[Address]', City: '[City]', Postcode: '[Postcode]', Email: `maya${n}.${key().slice(0, 6)}@example.test`, Phone: `07700 9${String(n).padStart(5, '0')}`, 'GDPR Consent': 'No', ...over };
  return { v, row: HEAD.map((h) => v[h] ?? null) };
};
const customers = (...people) => xlsxOf([['Top Customers'], HEAD, ...people.map((p) => p.row)]);
const BIKE_HEAD = ['Description', 'Serial Number', 'Date Created', 'Customer Name', 'Email Address', 'Mobile Number', 'Phone Number'];
const bikes = (...rows) => xlsxOf([BIKE_HEAD, ...rows.map((r) => BIKE_HEAD.map((h) => r[h] ?? null))]);

test('Top Customers comes across: details joined, offers and their date, and only the columns used', async () => {
  const p = person({ 'GDPR Consent': 'Yes', 'GDPR Consent Date': '05/10/2026', 'Address 2': '[Address 2]' });
  const res = await send(customers(p));
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.report, 'customers');
  const kept = await inShop(() => prepare('SELECT data FROM move_rows WHERE file_id = ?').get(res.body.id));
  assert.equal(kept.data['Total Sales'], undefined);
  await finish();
  const c = await byAccount(p.v['Account Number']);
  assert.deepEqual(
    { name: c.name, email: c.email, phone: c.phone, address: c.address, postcode: c.postcode, offers: c.marketing_permission, joinable: c.email_from_customer },
    { name: p.row[2] + ' ' + p.row[3], email: p.v.Email, phone: p.v.Phone, address: '[Address], [Address 2], [City]', postcode: '[Postcode]', offers: true, joinable: false }
  );
  const on = await inShop(() => prepare("SELECT to_char(marketing_consent_on, 'YYYY-MM-DD') AS d FROM customers WHERE id = ?").get(c.id));
  assert.equal(on.d, '2026-10-05');
  const f = await fileIn(res.body.id);
  assert.deepEqual({ state: f.state, rowsIn: f.rowsIn, rowsLook: f.rowsLook }, { state: 'done', rowsIn: 1, rowsLook: 0 });
});

test('a no to offers keeps no date, and consent dates are read or left empty, never guessed', async () => {
  const p = person({ 'GDPR Consent': 'No', 'GDPR Consent Date': '05/10/2026' });
  await send(customers(p));
  await finish();
  const c = await byAccount(p.v['Account Number']);
  assert.deepEqual({ offers: c.marketing_permission, on: c.marketing_consent_on }, { offers: false, on: null });
  assert.equal(consentDay('46000'), '2025-12-09');
  assert.equal(consentDay('2026-10-05 09:30'), '2026-10-05');
  assert.equal(consentDay('5/10/2026 09:30'), '2026-10-05');
  for (const odd of ['31/02/2026', 'soon', '', '12', '13/13/2026']) assert.equal(consentDay(odd), null, odd);
});

test('no name, or the same email or phone as someone here, waits for a look and makes nobody', async () => {
  const here = person();
  await send(customers(here));
  await finish();
  const name = `${here.row[2]} ${here.row[3]}`;
  const digits = here.v.Phone.replace(/\D/g, '').slice(1);
  const noName = person({ 'First Name': null, 'Last Name': null });
  const sameEmail = person({ Email: here.v.Email.toUpperCase() });
  const samePhone = person({ Phone: `+44 ${digits}` });
  const res = await send(customers(noName, sameEmail, samePhone));
  await finish();
  assert.deepEqual((await whyOf(res.body.id)).map((r) => r.why), ['No name', `Looks like the same person as ${name}`, `Looks like the same person as ${name}`]);
  for (const p of [noName, sameEmail, samePhone]) assert.equal(await byAccount(p.v['Account Number']), undefined);
});

test('sent again, nobody is doubled and a change made in Wheelhouse stays', async () => {
  const p = person();
  const file = customers(p);
  await send(file);
  await finish();
  const c = await byAccount(p.v['Account Number']);
  assert.equal((await staff(`/api/customers/${c.id}`, { method: 'PUT', body: { name: c.name, email: c.email, phone: '07700 900000' } })).status, 200);
  const res = await send(file);
  await finish();
  assert.equal((await byAccount(p.v['Account Number'])).phone, '07700 900000');
  assert.deepEqual({ rowsIn: (await fileIn(res.body.id)).rowsIn, rowsLook: (await fileIn(res.body.id)).rowsLook }, { rowsIn: 1, rowsLook: 0 });
});

test('a bike joins its customer by email, mobile, phone or name; its description and serial kept, once', async () => {
  const [a, b, c, d] = [person(), person(), person(), person()];
  await send(customers(a, b, c, d));
  await finish();
  const row = { Description: '[Bike]', 'Serial Number': '[Frame number]', 'Customer Name': 'someone else' };
  const file = bikes(
    { ...row, 'Email Address': a.v.Email.toUpperCase() },
    { ...row, 'Mobile Number': b.v.Phone },
    { ...row, 'Phone Number': c.v.Phone },
    { ...row, 'Customer Name': `${d.row[2]} ${d.row[3]}` },
  );
  const res = await send(file);
  assert.equal(res.body.report, 'bikes');
  await finish();
  for (const p of [a, b, c, d]) {
    assert.deepEqual(await bikesOf((await byAccount(p.v['Account Number'])).id), [{ model: '[Bike]', serial_number: '[Frame number]' }]);
  }
  assert.equal((await fileIn(res.body.id)).rowsIn, 4);
  await send(file);
  await finish();
  assert.equal((await bikesOf((await byAccount(a.v['Account Number'])).id)).length, 1, 'sent twice, one bike');
});

test('bikes first: once customers are in they join, and no longer need a look', async () => {
  const p = person();
  const list = await send(bikes({ Description: '[Bike]', 'Email Address': p.v.Email, 'Customer Name': 'x' }));
  await finish();
  assert.deepEqual((await whyOf(list.body.id)).map((r) => r.why), ['The customer on this bike isn’t in the customers file']);
  await send(customers(p));
  await finish();
  assert.equal((await bikesOf((await byAccount(p.v['Account Number'])).id)).length, 1);
  const f = await fileIn(list.body.id);
  assert.deepEqual({ state: f.state, rowsIn: f.rowsIn, rowsLook: f.rowsLook }, { state: 'done', rowsIn: 1, rowsLook: 0 });
});

test('a name two customers share can\'t tell whose bike it is, and no description waits too', async () => {
  const shared = `Shared${key().slice(0, 6)}`;
  const a = person({ 'Last Name': shared });
  const b = person({ 'Last Name': shared });
  await send(customers(a, b));
  await finish();
  const res = await send(bikes({ Description: '[Bike]', 'Customer Name': `Maya ${shared}` }, { 'Customer Name': `Maya ${shared}` }));
  await finish();
  assert.deepEqual((await whyOf(res.body.id)).map((r) => r.why), ['More than one customer has this name', 'No description']);
  for (const p of [a, b]) assert.equal((await bikesOf((await byAccount(p.v['Account Number'])).id)).length, 0);
});

// Asks for deletion as the customer's request is recorded, then deletes.
async function deleted(customerId) {
  return inShop(async () => {
    const req = await prepare("INSERT INTO privacy_requests (customer_id, kind, source) VALUES (?, 'delete', 'shop') RETURNING id").get(customerId);
    const done = await deleteCustomerDetails(req.id);
    assert.ok(!done?.refusal, JSON.stringify(done));
  });
}

test('a deleted customer stays deleted when the file comes again, and gets no bike', async () => {
  const p = person();
  await send(customers(p));
  await finish();
  const c = await byAccount(p.v['Account Number']);
  await deleted(c.id);
  await send(customers(p));
  await send(bikes({ Description: '[Bike]', 'Email Address': p.v.Email, 'Customer Name': `${p.row[2]} ${p.row[3]}` }));
  await finish();
  const after2 = await inShop(() => prepare('SELECT * FROM customers WHERE id = ?').get(c.id));
  assert.ok(after2.deleted_at !== null);
  assert.ok(after2.email === '' || after2.email === null, 'still blank');
  assert.equal((await inShop(() => prepare('SELECT count(*)::int AS n FROM customers WHERE citrus_account = ?').get(p.v['Account Number']))).n, 1);
  assert.equal((await bikesOf(c.id)).length, 0);
  assert.equal((await inShop(() => prepare('SELECT count(*)::int AS n FROM customers WHERE email = ?').get(p.v.Email))).n, 0);
});

test('a customer marked deleted gets no bike, even with their details still readable', async () => {
  const p = person();
  await send(customers(p));
  await finish();
  const c = await byAccount(p.v['Account Number']);
  await inShop(() => prepare('UPDATE customers SET deleted_at = now() WHERE id = ?').run(c.id));
  const res = await send(bikes({ Description: '[Bike]', 'Email Address': p.v.Email, 'Customer Name': `${p.row[2]} ${p.row[3]}` }));
  await finish();
  assert.equal((await bikesOf(c.id)).length, 0);
  assert.deepEqual((await whyOf(res.body.id)).map((r) => r.why), ['The customer on this bike isn’t in the customers file']);
});

test('deleting someone removes rows about them still waiting in a file, and the counts follow', async () => {
  const p = person();
  await send(customers(p));
  await finish();
  const c = await byAccount(p.v['Account Number']);
  const about = await send(customers(person({ Email: p.v.Email }), person({ Phone: p.v.Phone }), person({ 'First Name': null, 'Last Name': null })));
  const bike = await send(bikes({ 'Mobile Number': p.v.Phone, 'Customer Name': 'x' }));
  await finish();
  assert.equal((await fileIn(about.body.id)).rowsLook, 3);
  await deleted(c.id);
  const left = await inShop(() => prepare("SELECT count(*)::int AS n FROM move_rows WHERE file_id = ? AND state = 'look'").get(about.body.id));
  assert.equal(left.n, 1, 'only the row with no name, which says nothing about them');
  const f = await fileIn(about.body.id);
  assert.deepEqual({ rowsTotal: f.rowsTotal, rowsLook: f.rowsLook }, { rowsTotal: 1, rowsLook: 1 });
  assert.equal((await fileIn(bike.body.id)).rowsLook, 0);
  const text = JSON.stringify(await inShop(() => prepare('SELECT data FROM move_rows WHERE file_id = ANY(?::int[])').all([about.body.id, bike.body.id])));
  assert.ok(!text.includes(p.v.Email) && !text.includes(p.v.Phone));
});
