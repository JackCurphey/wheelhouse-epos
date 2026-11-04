// Customers and bikes from Citrus Lime (openspec/changes/citrus-import-customers;
// Moving from Citrus Lime decisions 2 and 3; mv-summary; mv-fix's reasons; Jack's
// 30 Oct answer 3 and 3 Nov answers). Every file is made up. Maya is the drawings';
// the rest is placeholder.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { bringBatch, readNextFile } from '../server/move/bring-across.js';
import { consentDay, lookRows } from '../server/move/bring-customers.js';
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
  try {
    if (owner) await deleteTestShop(owner.shop.id);
  } finally {
    if (server) await server.stop();
    await pool.end();
  }
});

const staff = (path, options) => staffRequest(server.baseUrl, owner.cookie, path, options);
const key = () => randomBytes(24).toString('hex');
const send = (file) => staff('/api/move/files', { method: 'POST', body: { fileName: 'export.xlsx', dataBase64: file.toString('base64'), requestKey: key() } });
const inShop = (fn) => runWithShop(owner.shop.id, fn);
// This shop only: going round every shop in the shared test database takes minutes.
// With a limit, so a fault that keeps rows going round fails here instead of hanging.
const finish = async () => {
  const stopAt = Date.now() + 20_000;
  const inTime = () => assert.ok(Date.now() < stopAt, 'it never finished: rows are going round');
  while (await readNextFile(owner.shop.id)) inTime();
  while (await inShop(() => bringBatch())) inTime();
};
const fileIn = async (id) => (await staff('/api/move')).body.files.find((f) => f.id === id);
const counts = (f) => ({ rowsIn: f.rowsIn, rowsSame: f.rowsSame, rowsSkipped: f.rowsSkipped, rowsLook: f.rowsLook });
const whyOf = async (fileId) => (await inShop(() => lookRows(fileId))).map((r) => r.why);
const byAccount = (account) => inShop(() => prepare('SELECT * FROM customers WHERE citrus_account = ?').get(account));
const bikesOf = (id) => inShop(() => prepare('SELECT model, serial_number FROM customer_bikes WHERE customer_id = ? ORDER BY id').all(id));
const customersWith = (email) => inShop(() => prepare('SELECT * FROM customers WHERE email = ?').all(email));

const HEAD = ['Account Number', 'Total Sales', 'First Name', 'Last Name', 'Address', 'Address 2', 'City', 'County', 'Postcode', 'Country', 'Email', 'Phone', 'GDPR Consent', 'GDPR Consent Date'];
let n = 0;
// Numbers and addresses unique to each made-up person, none of them real.
// One per made-up person: a shared number would make them look like the same person.
const newPhone = () => { n += 1; return `07700 9${String(n).padStart(5, '0')}`; };
const person = (over = {}) => {
  n += 1;
  const v = { 'Account Number': `A${n}-${key().slice(0, 6)}`, 'Total Sales': 99, 'First Name': 'Maya', 'Last Name': `Person${n}x${key().slice(0, 4)}`, Address: '[Address]', City: '[City]', Postcode: '[Postcode]', Email: `maya${n}.${key().slice(0, 6)}@example.test`, Phone: newPhone(), 'GDPR Consent': 'No', ...over };
  return { v, row: HEAD.map((h) => v[h] ?? null), name: `${v['First Name']} ${v['Last Name']}` };
};
const customers = (...people) => xlsxOf([['Top Customers'], HEAD, ...people.map((p) => p.row)]);
const BIKE_HEAD = ['Description', 'Serial Number', 'Date Created', 'Customer Name', 'Email Address', 'Mobile Number', 'Phone Number'];
const bikes = (...rows) => xlsxOf([BIKE_HEAD, ...rows.map((r) => BIKE_HEAD.map((h) => r[h] ?? null))]);

test('Top Customers comes across: details joined, offers and their date, and only the columns used', async () => {
  const p = person({ 'GDPR Consent': 'Yes', 'GDPR Consent Date': '05/10/2026', 'Address 2': '[Address 2]' });
  const res = await send(customers(p));
  assert.equal(res.status, 202, JSON.stringify(res.body));
  await finish();
  const f = await fileIn(res.body.id);
  assert.equal(f.report, 'customers');
  const c = await byAccount(p.v['Account Number']);
  assert.deepEqual(
    { name: c.name, email: c.email, phone: c.phone, address: c.address, postcode: c.postcode, offers: c.marketing_permission, joinable: c.email_from_customer },
    { name: p.name, email: p.v.Email, phone: p.v.Phone, address: '[Address], [Address 2], [City]', postcode: '[Postcode]', offers: true, joinable: false }
  );
  const on = await inShop(() => prepare("SELECT to_char(marketing_consent_on, 'YYYY-MM-DD') AS d FROM customers WHERE id = ?").get(c.id));
  assert.equal(on.d, '2026-10-05');
  assert.deepEqual(counts(f), { rowsIn: 1, rowsSame: 0, rowsSkipped: 0, rowsLook: 0 });
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

test('the date of a yes goes when the yes or no changes, by any route', async () => {
  const p = person({ 'GDPR Consent': 'Yes', 'GDPR Consent Date': '05/10/2026' });
  await send(customers(p));
  await finish();
  const c = await byAccount(p.v['Account Number']);
  const on = async () => (await inShop(() => prepare('SELECT marketing_consent_on AS d FROM customers WHERE id = ?').get(c.id))).d;
  assert.ok((await on()) !== null);
  // Another change leaves it.
  assert.equal((await staff(`/api/customers/${c.id}`, { method: 'PUT', body: { name: c.name, email: c.email, phone: '07700 900000' } })).status, 200);
  assert.ok((await on()) !== null);
  assert.equal((await staff(`/api/customers/${c.id}`, { method: 'PUT', body: { name: c.name, email: c.email, phone: '07700 900000', marketingPermission: false } })).status, 200);
  assert.equal((await inShop(() => prepare('SELECT marketing_permission AS m FROM customers WHERE id = ?').get(c.id))).m, false);
  assert.equal(await on(), null);
  // The customer's own account and a booking write the same column.
  await inShop(() => prepare("UPDATE customers SET marketing_permission = true, marketing_consent_on = '2026-10-05' WHERE id = ?").run(c.id));
  assert.ok((await on()) !== null);
  await inShop(() => prepare('UPDATE customers SET marketing_permission = false WHERE id = ?').run(c.id));
  assert.equal(await on(), null);
});

test('no name, no account number, or the same email or phone as someone here, waits for a look and makes nobody', async () => {
  const here = person();
  await send(customers(here));
  await finish();
  const digits = here.v.Phone.replace(/\D/g, '').slice(1);
  const noName = person({ 'First Name': null, 'Last Name': null });
  const noAccount = person({ 'Account Number': null });
  const sameEmail = person({ Email: here.v.Email.toUpperCase() });
  const samePhone = person({ Phone: `+44 ${digits}` });
  const sameBracket = person({ Phone: `+44 (0)${digits}` });
  const res = await send(customers(noName, noAccount, sameEmail, samePhone, sameBracket));
  await finish();
  const same = `Looks like the same person as ${here.name}`;
  assert.deepEqual(await whyOf(res.body.id), ['No name', 'No account number', same, same, same]);
  for (const p of [noName, sameEmail, samePhone, sameBracket]) assert.equal(await byAccount(p.v['Account Number']), undefined);
  assert.equal((await customersWith(noAccount.v.Email)).length, 0);
});

test('a waiting row holds the matched customer\'s id, not their name, and shows the name as it is now', async () => {
  const here = person();
  await send(customers(here));
  await finish();
  const c = await byAccount(here.v['Account Number']);
  const res = await send(customers(person({ Email: here.v.Email })));
  await finish();
  const row = await inShop(() => prepare('SELECT why, customer_id FROM move_rows WHERE file_id = ?').get(res.body.id));
  assert.equal(row.customer_id, c.id);
  assert.ok(!row.why.includes(here.name));
  assert.equal((await staff(`/api/customers/${c.id}`, { method: 'PUT', body: { name: 'Maya Renamed', email: c.email, phone: c.phone } })).status, 200);
  assert.deepEqual(await whyOf(res.body.id), ['Looks like the same person as Maya Renamed']);
});

test('sent again, nobody is doubled, it isn\'t counted as brought across, and a change made in Wheelhouse stays', async () => {
  const p = person();
  const file = customers(p);
  await send(file);
  await finish();
  const c = await byAccount(p.v['Account Number']);
  assert.equal((await staff(`/api/customers/${c.id}`, { method: 'PUT', body: { name: c.name, email: c.email, phone: '07700 900000' } })).status, 200);
  const res = await send(file);
  await finish();
  assert.equal((await byAccount(p.v['Account Number'])).phone, '07700 900000');
  assert.deepEqual(counts(await fileIn(res.body.id)), { rowsIn: 0, rowsSame: 1, rowsSkipped: 0, rowsLook: 0 });
});

test('a bike joins its customer by email, mobile, phone or name, when the name agrees; description and serial kept, once', async () => {
  const [a, b, c, d] = [person(), person(), person(), person()];
  await send(customers(a, b, c, d));
  await finish();
  const row = { Description: '[Bike]', 'Serial Number': `[Frame ${key().slice(0, 6)}]` };
  const file = bikes(
    { ...row, 'Customer Name': a.name, 'Email Address': a.v.Email.toUpperCase() },
    { ...row, 'Customer Name': b.name, 'Mobile Number': b.v.Phone },
    { ...row, 'Customer Name': c.name.toUpperCase(), 'Phone Number': c.v.Phone },
    { ...row, 'Customer Name': d.name },
  );
  const res = await send(file);
  await finish();
  assert.equal((await fileIn(res.body.id)).report, 'bikes');
  for (const p of [a, b, c, d]) {
    assert.deepEqual(await bikesOf((await byAccount(p.v['Account Number'])).id), [{ model: '[Bike]', serial_number: row['Serial Number'] }]);
  }
  assert.equal((await fileIn(res.body.id)).rowsIn, 4);
  const again = await send(file);
  await finish();
  assert.equal((await bikesOf((await byAccount(a.v['Account Number'])).id)).length, 1, 'sent twice, one bike');
  assert.deepEqual(counts(await fileIn(again.body.id)), { rowsIn: 0, rowsSame: 4, rowsSkipped: 0, rowsLook: 0 });
});

test('a bike whose name disagrees with its contact\'s owner, or whose contacts fit two people, waits and goes to nobody', async () => {
  const [a, b] = [person(), person()];
  await send(customers(a, b));
  await finish();
  const res = await send(bikes(
    { Description: '[Bike 1]', 'Customer Name': 'Someone Else', 'Email Address': a.v.Email },
    { Description: '[Bike 2]', 'Customer Name': a.name, 'Email Address': a.v.Email, 'Mobile Number': b.v.Phone },
  ));
  await finish();
  assert.deepEqual(await whyOf(res.body.id), ['The name on this bike isn’t the name of the customer with this email or phone', 'More than one customer has this email or phone']);
  for (const p of [a, b]) assert.equal((await bikesOf((await byAccount(p.v['Account Number'])).id)).length, 0);
});

test('a resent file doesn\'t duplicate a bike corrected in Wheelhouse, by its Citrus row or its frame number', async () => {
  const p = person();
  await send(customers(p));
  await finish();
  const c = await byAccount(p.v['Account Number']);
  const frame = `[Frame ${key().slice(0, 6)}]`;
  const row = { Description: '[Bike]', 'Serial Number': frame, 'Customer Name': p.name, 'Email Address': p.v.Email };
  await send(bikes(row, { ...row, Description: '[Bike 2]', 'Serial Number': `[Frame 2 ${key().slice(0, 6)}]` }));
  await finish();
  await inShop(() => prepare("UPDATE customer_bikes SET model = '[Corrected]', serial_number = '[Corrected frame]' WHERE customer_id = ? AND serial_number = ?").run(c.id, frame));
  const again = await send(bikes(row));
  await finish();
  assert.equal((await bikesOf(c.id)).length, 2, 'matched by its Citrus row');
  assert.equal((await fileIn(again.body.id)).rowsSame, 1);
  // The same frame number with another description is the same bike.
  const other = await send(bikes({ ...row, Description: '[Described differently]', 'Serial Number': '[Corrected frame]' }));
  await finish();
  assert.equal((await bikesOf(c.id)).length, 2, 'matched by its frame number');
  assert.equal((await fileIn(other.body.id)).rowsSame, 1);
});

test('bikes first: once customers are in they join, and no longer need a look', async () => {
  const p = person();
  const list = await send(bikes({ Description: '[Bike]', 'Email Address': p.v.Email, 'Customer Name': p.name }));
  await finish();
  assert.deepEqual(await whyOf(list.body.id), ['The customer on this bike isn’t in the customers file']);
  await send(customers(p));
  await finish();
  assert.equal((await bikesOf((await byAccount(p.v['Account Number'])).id)).length, 1);
  const f = await fileIn(list.body.id);
  assert.deepEqual({ state: f.state, ...counts(f) }, { state: 'done', rowsIn: 1, rowsSame: 0, rowsSkipped: 0, rowsLook: 0 });
});

test('a name two customers share can\'t tell whose bike it is, and no description waits too', async () => {
  const shared = `Shared${key().slice(0, 6)}`;
  const a = person({ 'Last Name': shared });
  const b = person({ 'Last Name': shared });
  await send(customers(a, b));
  await finish();
  const res = await send(bikes({ Description: '[Bike]', 'Customer Name': `Maya ${shared}` }, { 'Customer Name': `Maya ${shared}` }));
  await finish();
  assert.deepEqual(await whyOf(res.body.id), ['More than one customer has this name', 'No description']);
  for (const p of [a, b]) assert.equal((await bikesOf((await byAccount(p.v['Account Number'])).id)).length, 0);
});

// Asks for deletion as the customer's request is recorded, then deletes.
async function deleted(customerId) {
  return inShop(async () => {
    // One open request a customer: a deletion told to try again keeps its own.
    const req = (await prepare("SELECT id FROM privacy_requests WHERE customer_id = ? AND kind = 'delete' AND done_at IS NULL").get(customerId))
      ?? (await prepare("INSERT INTO privacy_requests (customer_id, kind, source) VALUES (?, 'delete', 'shop') RETURNING id").get(customerId));
    return deleteCustomerDetails(req.id);
  });
}

test('a deleted customer stays deleted when the file comes again, gets no bike, and the record holds nothing readable', async () => {
  const p = person({ 'GDPR Consent': 'Yes', 'GDPR Consent Date': '05/10/2026' });
  await send(customers(p));
  await finish();
  const c = await byAccount(p.v['Account Number']);
  // A date with no yes beside it: deleting clears it itself, not by the yes changing.
  await inShop(() => prepare('UPDATE customers SET marketing_permission = false WHERE id = ?').run(c.id));
  await inShop(() => prepare("UPDATE customers SET marketing_consent_on = '2026-10-05' WHERE id = ?").run(c.id));
  await deleted(c.id);
  const blank = await inShop(() => prepare('SELECT * FROM customers WHERE id = ?').get(c.id));
  assert.ok(blank.deleted_at !== null);
  assert.deepEqual({ account: blank.citrus_account, on: blank.marketing_consent_on, email: blank.email, phone: blank.phone }, { account: null, on: null, email: '', phone: '' });
  const again = await send(customers(p));
  const bike = await send(bikes({ Description: '[Bike]', 'Email Address': p.v.Email, 'Customer Name': p.name }));
  await finish();
  assert.equal(await byAccount(p.v['Account Number']), undefined, 'not brought back');
  assert.equal((await customersWith(p.v.Email)).length, 0);
  assert.equal((await bikesOf(c.id)).length, 0);
  assert.deepEqual(counts(await fileIn(again.body.id)), { rowsIn: 0, rowsSame: 0, rowsSkipped: 1, rowsLook: 0 });
  assert.deepEqual(counts(await fileIn(bike.body.id)), { rowsIn: 0, rowsSame: 0, rowsSkipped: 0, rowsLook: 1 });
  assert.deepEqual(await whyOf(bike.body.id), ['Shares contact details with a customer who was deleted']);
  const row = await inShop(() => prepare('SELECT state, data, why FROM move_rows WHERE file_id = ?').get(again.body.id));
  assert.deepEqual({ state: row.state, data: row.data, why: row.why }, { state: 'skipped', data: {}, why: null }, 'an account-number match is emptied');
});

test('only one-way codes are left, unique to the shop, with nothing readable and no link to the record', async () => {
  const p = person();
  await send(customers(p));
  await finish();
  const c = await byAccount(p.v['Account Number']);
  const before2 = (await inShop(() => prepare('SELECT count(*)::int AS n FROM move_deleted_codes').get())).n;
  await deleted(c.id);
  const codes = await inShop(() => prepare('SELECT * FROM move_deleted_codes ORDER BY id').all());
  assert.equal(codes.length, before2 + 3, 'account, email and phone');
  const text = JSON.stringify(codes);
  for (const v of [p.v['Account Number'], p.v.Email, p.v.Phone, p.v.Phone.replace(/\D/g, ''), p.name]) assert.ok(!text.includes(v), v);
  assert.deepEqual(Object.keys(codes[0]).sort(), ['code', 'id', 'kind', 'shop_id']);
  // The same details in another shop give other codes, as each shop has its own salt.
  const other = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
  try {
    const made = await staffRequest(server.baseUrl, other.cookie, '/api/customers', { method: 'POST', body: { name: p.name, email: p.v.Email, phone: p.v.Phone } });
    assert.equal(made.status, 201, JSON.stringify(made.body));
    await runWithShop(other.shop.id, async () => {
      const req = await prepare("INSERT INTO privacy_requests (customer_id, kind, source) VALUES (?, 'delete', 'shop') RETURNING id").get(made.body.id);
      await deleteCustomerDetails(req.id);
      const theirs = await prepare('SELECT code FROM move_deleted_codes').all();
      assert.equal(theirs.length, 2);
      for (const { code } of theirs) assert.ok(!text.includes(code), 'a different code in another shop');
    });
  } finally {
    await deleteTestShop(other.shop.id);
  }
});

test('a row waiting as "the same person as Pat", then Pat is deleted, then the same file again: nobody comes back', async () => {
  const pat = person({ 'First Name': 'Pat', 'GDPR Consent': 'Yes' });
  const lookalike = person({ Email: pat.v.Email, 'GDPR Consent': 'Yes' });
  const first = await send(customers(pat, lookalike));
  await finish();
  assert.equal((await fileIn(first.body.id)).rowsLook, 1);
  const c = await byAccount(pat.v['Account Number']);
  await deleted(c.id);
  assert.deepEqual(await whyOf(first.body.id), ['Shares contact details with a customer who was deleted'], 'the waiting row stays, with no link to Pat');
  const again = await send(customers(pat, lookalike));
  await finish();
  assert.equal((await customersWith(pat.v.Email)).length, 0);
  assert.equal(await byAccount(lookalike.v['Account Number']), undefined);
  assert.deepEqual(counts(await fileIn(again.body.id)), { rowsIn: 0, rowsSame: 0, rowsSkipped: 1, rowsLook: 1 });
  assert.deepEqual(await whyOf(again.body.id), ['Shares contact details with a customer who was deleted']);
});

test('someone added by hand and deleted before the first import doesn\'t come in: with no account number to go on, they wait for a look', async () => {
  const p = person({ 'GDPR Consent': 'Yes' });
  const made = await staff('/api/customers', { method: 'POST', body: { name: p.name, email: p.v.Email, phone: p.v.Phone } });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  await deleted(made.body.id);
  const national = p.v.Phone.replace(/\D/g, '').slice(1);
  const byPhone = person({ Phone: `+44 (0)${national}` });
  const byIntl = person({ Phone: `0044 ${national}` });
  const res = await send(customers(p, byPhone, byIntl));
  await finish();
  assert.equal((await customersWith(p.v.Email)).length, 0);
  assert.equal(await byAccount(p.v['Account Number']), undefined);
  assert.equal(await byAccount(byPhone.v['Account Number']), undefined, 'matched by the phone alone, however written');
  assert.equal(await byAccount(byIntl.v['Account Number']), undefined);
  assert.deepEqual(counts(await fileIn(res.body.id)), { rowsIn: 0, rowsSame: 0, rowsSkipped: 0, rowsLook: 3 });
  assert.deepEqual(await whyOf(res.body.id), ['Shares contact details with a customer who was deleted', 'Shares contact details with a customer who was deleted', 'Shares contact details with a customer who was deleted']);
});

const lookRowOf = (fileId) => inShop(() => prepare('SELECT state, why, customer_id, data FROM move_rows WHERE file_id = ?').get(fileId));

test('a mum deleted, her son with the same email and his own account number: he waits for a look, with no name and no customer', async () => {
  const mum = person({ 'First Name': 'Mum' });
  await send(customers(mum));
  await finish();
  await deleted((await byAccount(mum.v['Account Number'])).id);
  const son = person({ 'First Name': 'Son', Email: mum.v.Email, 'GDPR Consent': 'Yes' });
  const res = await send(customers(son));
  await finish();
  assert.equal(await byAccount(son.v['Account Number']), undefined);
  assert.equal((await customersWith(son.v.Email)).length, 0);
  assert.deepEqual(counts(await fileIn(res.body.id)), { rowsIn: 0, rowsSame: 0, rowsSkipped: 0, rowsLook: 1 });
  const row = await lookRowOf(res.body.id);
  assert.deepEqual({ state: row.state, why: row.why, customer: row.customer_id }, { state: 'look', why: 'Shares contact details with a customer who was deleted', customer: null });
  assert.ok(!row.why.includes('Mum'));
  assert.equal(row.data['Account Number'], son.v['Account Number'], 'kept, for when it can be fixed');
  // Nothing brings him in by himself: not the next round, not another customers
  // file finishing, not the same file again.
  await send(customers(person()));
  await finish();
  assert.equal((await lookRowOf(res.body.id)).state, 'look');
  const again = await send(customers(son));
  await finish();
  assert.equal(await byAccount(son.v['Account Number']), undefined);
  assert.equal((await fileIn(again.body.id)).rowsLook, 1);
});

test('two people sharing one placeholder email: one deleted, the other waits; by phone too', async () => {
  const placeholder = `none.${key().slice(0, 6)}@example.test`;
  const first = person({ Email: placeholder });
  await send(customers(first));
  await finish();
  await deleted((await byAccount(first.v['Account Number'])).id);
  const second = person({ Email: placeholder });
  const byPhone = person({ Phone: first.v.Phone });
  const res = await send(customers(second, byPhone));
  await finish();
  assert.deepEqual(await whyOf(res.body.id), ['Shares contact details with a customer who was deleted', 'Shares contact details with a customer who was deleted']);
  assert.equal(await byAccount(second.v['Account Number']), undefined);
  assert.equal(await byAccount(byPhone.v['Account Number']), undefined);
  assert.deepEqual(counts(await fileIn(res.body.id)), { rowsIn: 0, rowsSame: 0, rowsSkipped: 0, rowsLook: 2 });
});

test('someone already here stays counted as here, even if a deleted customer shared their email; nobody brought back', async () => {
  const mum = person();
  const son = person();
  await send(customers(mum, son));
  await finish();
  const mumId = (await byAccount(mum.v['Account Number'])).id;
  // They came to share an email later, and she was then deleted.
  await inShop(() => prepare('UPDATE customers SET email = ? WHERE id = ?').run(son.v.Email, mumId));
  await deleted(mumId);
  const res = await send(customers(son));
  await finish();
  assert.deepEqual(counts(await fileIn(res.body.id)), { rowsIn: 0, rowsSame: 1, rowsSkipped: 0, rowsLook: 0 });
});

test('a row with no account number and a deleted customer\'s email gives that reason, and no customer', async () => {
  const mum = person();
  await send(customers(mum));
  await finish();
  await deleted((await byAccount(mum.v['Account Number'])).id);
  const res = await send(customers(person({ 'Account Number': null, Email: mum.v.Email })));
  await finish();
  assert.deepEqual(await whyOf(res.body.id), ['Shares contact details with a customer who was deleted']);
  assert.equal((await customersWith(mum.v.Email)).length, 0);
});

test('an account-number-only match is skipped too, and its row emptied', async () => {
  const p = person();
  await send(customers(p));
  await finish();
  await deleted((await byAccount(p.v['Account Number'])).id);
  const changed = person({ 'Account Number': p.v['Account Number'] });
  const res = await send(customers(changed));
  await finish();
  assert.equal((await customersWith(changed.v.Email)).length, 0);
  assert.equal((await fileIn(res.body.id)).rowsSkipped, 1);
  assert.deepEqual((await lookRowOf(res.body.id)).data, {});
});

test('a very large file being stored doesn\'t get a deletion refused', async () => {
  const p = person();
  await send(customers(p));
  await finish();
  const c = await byAccount(p.v['Account Number']);
  const rows = [HEAD.join(',')];
  for (let i = 0; i < 100_000; i += 1) rows.push(`[A${i}-${key().slice(0, 4)}],,,,,,,,,,,,,`);
  const res = await staff('/api/move/files', { method: 'POST', body: { fileName: 'big.csv', dataBase64: Buffer.from(rows.join('\n')).toString('base64'), requestKey: key() } });
  assert.equal(res.status, 202, JSON.stringify(res.body));
  let stored = false;
  const storing = readNextFile(owner.shop.id).then(() => { stored = true; });
  // Once the read has finished and the store has begun.
  for (let i = 0; i < 2000; i += 1) {
    const { n } = await inShop(() => prepare('SELECT count(*)::int AS n FROM move_rows WHERE file_id = ?').get(res.body.id));
    if (n > 0 || stored) break;
    await new Promise((r) => { setTimeout(r, 25); });
  }
  assert.ok(!stored, 'the deletion comes while it stores');
  const done = await deleted(c.id);
  assert.notEqual(done?.status, 503, JSON.stringify(done));
  await storing;
  assert.ok((await inShop(() => prepare('SELECT deleted_at FROM customers WHERE id = ?').get(c.id))).deleted_at !== null);
  await inShop(() => prepare('DELETE FROM move_rows WHERE file_id = ?').run(res.body.id));
  await inShop(() => prepare("UPDATE move_files SET state = 'done' WHERE id = ?").run(res.body.id));
});

test('a customer marked deleted gets no bike, even with their details still readable', async () => {
  const p = person();
  await send(customers(p));
  await finish();
  const c = await byAccount(p.v['Account Number']);
  await inShop(() => prepare('UPDATE customers SET deleted_at = now() WHERE id = ?').run(c.id));
  const res = await send(bikes({ Description: '[Bike]', 'Email Address': p.v.Email, 'Customer Name': p.name }));
  await finish();
  assert.equal((await bikesOf(c.id)).length, 0);
  assert.deepEqual(await whyOf(res.body.id), ['The customer on this bike isn’t in the customers file']);
});

const rowsOf = (fileId) => inShop(() => prepare('SELECT state, why, customer_id, data FROM move_rows WHERE file_id = ? ORDER BY id').all(fileId));

test('deleting a mum: her son\'s waiting row stays as needs a look, with no link to her, and his own details', async () => {
  const mum = person({ 'First Name': 'Mum' });
  await send(customers(mum));
  await finish();
  const c = await byAccount(mum.v['Account Number']);
  const son = person({ 'First Name': 'Son', Email: mum.v.Email });
  const res = await send(customers(son));
  await finish();
  assert.deepEqual(await whyOf(res.body.id), [`Looks like the same person as ${mum.name}`]);
  await deleted(c.id);
  const [row] = await rowsOf(res.body.id);
  assert.deepEqual({ state: row.state, why: row.why, customer: row.customer_id }, { state: 'look', why: 'Shares contact details with a customer who was deleted', customer: null });
  assert.deepEqual(await whyOf(res.body.id), ['Shares contact details with a customer who was deleted']);
  assert.equal(row.data.Email, mum.v.Email, 'the shared email stays, as the row\'s own');
  assert.equal(row.data['First Name'], 'Son');
  assert.equal(row.data['Account Number'], son.v['Account Number']);
  assert.ok(!JSON.stringify(row).includes(mum.name), 'nothing of her name');
  const f = await fileIn(res.body.id);
  assert.deepEqual({ rowsTotal: f.rowsTotal, ...counts(f) }, { rowsTotal: 1, rowsIn: 0, rowsSame: 0, rowsSkipped: 0, rowsLook: 1 });
  // Nothing brings him in by himself, and nothing goes round.
  await send(customers(person()));
  await finish();
  assert.equal((await rowsOf(res.body.id))[0].state, 'look');
  assert.equal(await byAccount(son.v['Account Number']), undefined);
});

test('a row needing a look with her exact name and her email is her own: it goes, however the name is written, and the counts follow', async () => {
  const mum = person();
  await send(customers(mum));
  await finish();
  const c = await byAccount(mum.v['Account Number']);
  const again = person({ 'First Name': mum.v['First Name'], 'Last Name': mum.v['Last Name'].toUpperCase(), Email: mum.v.Email });
  const other = person({ Email: mum.v.Email });
  const list = await send(customers(again, other));
  const bike = await send(bikes({ 'Customer Name': `  ${mum.name} `, 'Email Address': mum.v.Email }, { 'Customer Name': 'Someone Else', 'Email Address': mum.v.Email }));
  await finish();
  assert.equal((await fileIn(list.body.id)).rowsLook, 2);
  assert.equal((await fileIn(bike.body.id)).rowsLook, 2);
  await deleted(c.id);
  const kept = await rowsOf(list.body.id);
  assert.equal(kept.length, 1);
  assert.equal(kept[0].data['Account Number'], other.v['Account Number'], 'the other person stays');
  assert.equal(kept[0].why, 'Shares contact details with a customer who was deleted');
  const f = await fileIn(list.body.id);
  assert.deepEqual({ rowsTotal: f.rowsTotal, rowsLook: f.rowsLook }, { rowsTotal: 1, rowsLook: 1 });
  const keptBike = await rowsOf(bike.body.id);
  assert.equal(keptBike.length, 1);
  assert.equal(keptBike[0].data['Customer Name'], 'Someone Else');
  const b = await fileIn(bike.body.id);
  assert.deepEqual({ rowsTotal: b.rowsTotal, rowsLook: b.rowsLook }, { rowsTotal: 1, rowsLook: 1 });
  assert.ok(!JSON.stringify([kept, keptBike]).toLowerCase().includes(mum.v['Last Name'].toLowerCase()), 'her name is nowhere');
});

test('a son with the same name and email as his mum goes with her, and is back as needs a look only if the file is sent again', async () => {
  const mum = person();
  await send(customers(mum));
  await finish();
  const son = person({ 'First Name': mum.v['First Name'], 'Last Name': mum.v['Last Name'], Email: mum.v.Email });
  const res = await send(customers(son));
  await finish();
  await deleted((await byAccount(mum.v['Account Number'])).id);
  assert.deepEqual(await rowsOf(res.body.id), []);
  const again = await send(customers(son));
  await finish();
  assert.deepEqual(await whyOf(again.body.id), ['Shares contact details with a customer who was deleted']);
  assert.equal(await byAccount(son.v['Account Number']), undefined);
});

test('a row pointing at her with her exact name goes, even after her email changed', async () => {
  const mum = person();
  await send(customers(mum));
  await finish();
  const c = await byAccount(mum.v['Account Number']);
  const res = await send(customers(person({ 'First Name': mum.v['First Name'], 'Last Name': mum.v['Last Name'], Email: mum.v.Email })));
  await finish();
  assert.equal((await staff(`/api/customers/${c.id}`, { method: 'PUT', body: { name: c.name, email: `${key().slice(0, 8)}@example.test`, phone: newPhone() } })).status, 200);
  await deleted(c.id);
  assert.deepEqual(await rowsOf(res.body.id), []);
});

test('at the deletion, a row still waiting with her name and email goes; with another name and the shared email it stays, then needs a look', async () => {
  const mum = person();
  await send(customers(mum));
  await finish();
  const hers = person({ 'First Name': mum.v['First Name'], 'Last Name': mum.v['Last Name'], Email: mum.v.Email });
  const son = person({ 'First Name': 'Son', Email: mum.v.Email });
  const res = await send(customers(hers, son));
  const bike = await send(bikes({ Description: '[Bike]', 'Customer Name': mum.name, 'Mobile Number': mum.v.Phone }, { Description: '[Bike 2]', 'Customer Name': 'Son', 'Mobile Number': mum.v.Phone }));
  await readNextFile(owner.shop.id);
  await readNextFile(owner.shop.id);
  assert.deepEqual((await rowsOf(res.body.id)).map((r) => r.state), ['waiting', 'waiting']);
  await deleted((await byAccount(mum.v['Account Number'])).id);
  const left = await rowsOf(res.body.id);
  assert.deepEqual(left.map((r) => r.data['Account Number']), [son.v['Account Number']], 'gone at the deletion, not later');
  assert.deepEqual({ state: left[0].state, why: left[0].why }, { state: 'waiting', why: null }, 'untouched until it\'s looked at');
  assert.equal((await fileIn(res.body.id)).rowsTotal, 1);
  assert.equal((await rowsOf(bike.body.id)).length, 1);
  assert.equal((await fileIn(bike.body.id)).rowsTotal, 1);
  await finish();
  assert.deepEqual(await whyOf(res.body.id), ['Shares contact details with a customer who was deleted']);
  assert.deepEqual(await whyOf(bike.body.id), ['Shares contact details with a customer who was deleted']);
  const f = await fileIn(res.body.id);
  assert.deepEqual({ state: f.state, rowsTotal: f.rowsTotal, ...counts(f) }, { state: 'done', rowsTotal: 1, rowsIn: 0, rowsSame: 0, rowsSkipped: 0, rowsLook: 1 });
  assert.equal(await byAccount(hers.v['Account Number']), undefined);
  assert.equal(await byAccount(son.v['Account Number']), undefined);
});

test('stopped part-way through storing, then the file can\'t be read again: no row of it is left', async () => {
  const p = person();
  const res = await send(customers(p));
  await assert.rejects(readNextFile(owner.shop.id, { afterChunk: () => { throw new Error('stopped here'); } }), /stopped here/);
  assert.equal((await rowsOf(res.body.id)).length, 1, 'part stored, with her details in it');
  await inShop(() => prepare('UPDATE move_file_bytes SET bytes = ? WHERE file_id = ?').run(Buffer.from('not a spreadsheet'), res.body.id));
  await finish();
  const f = await fileIn(res.body.id);
  assert.equal(f.state, 'cant_read');
  assert.deepEqual(await rowsOf(res.body.id), []);
  assert.equal((await staff(`/api/move/files/${f.id}`, { method: 'DELETE' })).status, 200);
});

test('choosing another file clears whatever a file that can\'t be read still holds, rather than failing', async () => {
  const res = await send(Buffer.from('not a spreadsheet'));
  await finish();
  const id = res.body.id;
  assert.equal((await fileIn(id)).state, 'cant_read');
  // As a file left by an earlier crash may be.
  await inShop(() => prepare("INSERT INTO move_rows (file_id, data) VALUES (?, '{\"Email\":\"[left behind]\"}') RETURNING id").get(id));
  await inShop(() => prepare('INSERT INTO move_file_bytes (file_id, bytes) VALUES (?, ?) RETURNING file_id').get(id, Buffer.from('x')));
  const gone = await staff(`/api/move/files/${id}`, { method: 'DELETE' });
  assert.equal(gone.status, 200, JSON.stringify(gone.body));
  assert.equal(await fileIn(id), undefined);
  assert.deepEqual(await rowsOf(id), []);
  assert.equal((await staff(`/api/move/files/${id}`, { method: 'DELETE' })).status, 404);
});

test('a row with their account number is their own: it goes, needing a look or waiting, and the counts follow', async () => {
  const [p, q] = [person(), person()];
  await send(customers(p, q));
  await finish();
  // Needing a look under an account number this customer then turns out to hold.
  const lookAccount = `L${key().slice(0, 8)}`;
  const looking = await send(customers(person({ 'Account Number': lookAccount, 'First Name': null, 'Last Name': null }), person()));
  await finish();
  assert.deepEqual(counts(await fileIn(looking.body.id)), { rowsIn: 1, rowsSame: 0, rowsSkipped: 0, rowsLook: 1 });
  const c = await byAccount(p.v['Account Number']);
  await inShop(() => prepare('UPDATE customers SET citrus_account = ? WHERE id = ?').run(lookAccount, c.id));
  await deleted(c.id);
  const f = await fileIn(looking.body.id);
  assert.deepEqual({ rowsTotal: f.rowsTotal, ...counts(f) }, { rowsTotal: 1, rowsIn: 1, rowsSame: 0, rowsSkipped: 0, rowsLook: 0 });
  assert.equal((await rowsOf(looking.body.id)).filter((r) => r.state === 'look').length, 0);
  // Stored, not yet looked at.
  const waiting = await send(customers(person({ 'Account Number': q.v['Account Number'] }), person()));
  await readNextFile(owner.shop.id);
  await deleted((await byAccount(q.v['Account Number'])).id);
  await finish();
  const w = await fileIn(waiting.body.id);
  assert.deepEqual({ state: w.state, rowsTotal: w.rowsTotal, ...counts(w) }, { state: 'done', rowsTotal: 1, rowsIn: 1, rowsSame: 0, rowsSkipped: 0, rowsLook: 0 });
});

test('a waiting row with only their email or phone, not yet looked at, needs a look once it is', async () => {
  const p = person();
  await send(customers(p));
  await finish();
  const res = await send(customers(person({ Email: p.v.Email }), person({ Phone: p.v.Phone })));
  await readNextFile(owner.shop.id);
  await deleted((await byAccount(p.v['Account Number'])).id);
  await finish();
  assert.deepEqual(await whyOf(res.body.id), ['Shares contact details with a customer who was deleted', 'Shares contact details with a customer who was deleted']);
  const f = await fileIn(res.body.id);
  assert.deepEqual({ rowsTotal: f.rowsTotal, ...counts(f) }, { rowsTotal: 2, rowsIn: 0, rowsSame: 0, rowsSkipped: 0, rowsLook: 2 });
});

test('deleting someone keeps rows that only share their details, however the phone was written; a row with neither is left as it was', async () => {
  const p = person();
  await send(customers(p));
  await finish();
  const c = await byAccount(p.v['Account Number']);
  const about = await send(customers(person({ Email: p.v.Email }), person({ Phone: p.v.Phone }), person({ 'First Name': null, 'Last Name': null })));
  const national = p.v.Phone.replace(/\D/g, '').slice(1);
  // Rows with no description point at nobody: only their phone can match.
  const bike = await send(bikes({ 'Mobile Number': `+44 (0)${national}`, 'Customer Name': 'x' }, { 'Phone Number': `0044 ${national}`, 'Customer Name': 'x' }));
  await finish();
  assert.equal((await fileIn(about.body.id)).rowsLook, 3);
  assert.deepEqual(await whyOf(bike.body.id), ['No description', 'No description']);
  await deleted(c.id);
  assert.deepEqual(await whyOf(about.body.id), ['Shares contact details with a customer who was deleted', 'Shares contact details with a customer who was deleted', 'No name']);
  assert.deepEqual(await whyOf(bike.body.id), ['Shares contact details with a customer who was deleted', 'Shares contact details with a customer who was deleted']);
  const f = await fileIn(about.body.id);
  assert.deepEqual({ rowsTotal: f.rowsTotal, rowsLook: f.rowsLook }, { rowsTotal: 3, rowsLook: 3 });
  assert.equal((await fileIn(bike.body.id)).rowsLook, 2);
});

test('a row pointing at them stays, with the link gone, even after their email and phone changed', async () => {
  const p = person();
  await send(customers(p));
  await finish();
  const c = await byAccount(p.v['Account Number']);
  const res = await send(customers(person({ Email: p.v.Email })));
  await finish();
  assert.equal((await fileIn(res.body.id)).rowsLook, 1);
  assert.equal((await staff(`/api/customers/${c.id}`, { method: 'PUT', body: { name: c.name, email: `${key().slice(0, 8)}@example.test`, phone: newPhone() } })).status, 200);
  await deleted(c.id);
  const [row] = await rowsOf(res.body.id);
  assert.deepEqual({ why: row.why, customer: row.customer_id }, { why: 'Shares contact details with a customer who was deleted', customer: null });
  assert.equal((await fileIn(res.body.id)).rowsLook, 1);
});

test('a bikes batch and a deletion at the same moment don\'t deadlock, and no bike row is failed by it', async () => {
  const people = Array.from({ length: 30 }, () => person());
  await send(customers(...people));
  await finish();
  const ids = await Promise.all(people.map(async (p) => (await byAccount(p.v['Account Number'])).id));
  const res = await send(bikes(...people.map((p) => ({ Description: '[Bike]', 'Serial Number': `[Frame ${key().slice(0, 6)}]`, 'Customer Name': p.name, 'Email Address': p.v.Email }))));
  await readNextFile(owner.shop.id);
  const logged = [];
  const realWarn = console.warn;
  console.warn = (...args) => { logged.push(args.join(' ')); };
  try {
    const running = (async () => { for (let i = 0; i < 40; i += 1) if (!(await inShop(() => bringBatch()))) break; })();
    const deleting = [];
    for (const id of [ids[29], ids[20], ids[10], ids[0]]) {
      deleting.push(await deleted(id));
    }
    await running;
  } finally {
    console.warn = realWarn;
  }
  await finish();
  assert.ok(!logged.some((l) => l.includes('40P01')), `no deadlock: ${logged.join('; ')}`);
  const rows = await inShop(() => prepare('SELECT state, why FROM move_rows WHERE file_id = ?').all(res.body.id));
  assert.ok(rows.every((r) => r.state !== 'waiting'), 'all dealt with');
  assert.ok(!rows.some((r) => r.why === 'Wheelhouse couldn’t bring this row across'), 'none failed');
});

test('a deletion waits for the move files first: it locks them before any customer', async () => {
  const p = person();
  await send(customers(p));
  await finish();
  const c = await byAccount(p.v['Account Number']);
  // A batch holding the move files: the deletion can't start, and says busy, rather than deadlocking.
  const held = pool.connect();
  const client = await held;
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.current_shop_id', $1, true)", [String(owner.shop.id)]);
    await client.query('SELECT id FROM move_files ORDER BY id FOR UPDATE');
    const done = await deleted(c.id);
    assert.equal(done?.status ?? done?.refusal?.status, 503, JSON.stringify(done));
    const still = await inShop(() => prepare('SELECT deleted_at FROM customers WHERE id = ?').get(c.id));
    assert.equal(still.deleted_at, null);
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
  await deleted(c.id);
  assert.ok((await inShop(() => prepare('SELECT deleted_at FROM customers WHERE id = ?').get(c.id))).deleted_at !== null);
});
