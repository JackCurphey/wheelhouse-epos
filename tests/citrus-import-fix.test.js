// Fix and Leave it out on the Citrus Lime import, the server (openspec/changes/
// citrus-import-fix; mv-fix). The rules about deleted customers and the same person
// are in citrus-import-fix-rules.test.js.
import test from 'node:test';
import { createHmac } from 'node:crypto';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { SAME_PERSON, SHARED_CONTACT } from '../server/move/bring-customers.js';
import { aDeletedCustomer, aSharedRow, aSite, barcodes, bikes, body, bring, bringBatch, browser, byAccount, bySku, code, countsRight, customers, deleteTestShop, deleted, finish, fix, historyOf, inShop, key, leaveOut, lookIn, newPhone, oneLook, owner, pads, person, prepare, priceList, readNextFile, rowsOf, send, server, staff, staffFreshCookie, staffRequest, staffSignup } from './helpers/move-fix-kit.js';

// ---- The list ----

test('the list gives each row needing a look its reason, its details and a seen code', async () => {
  const here = person();
  await bring(customers(here));
  const copy = person({ Email: here.v.Email });
  const fileId = await bring(customers(copy));
  const row = await oneLook(fileId);
  assert.equal(row.report, 'customers');
  assert.equal(row.why, `${SAME_PERSON} ${here.name}`);
  assert.equal(row.fields['First Name'], 'Maya');
  assert.equal(row.fields.Email, here.v.Email);
  assert.equal(typeof row.seen, 'string');
  assert.equal(row.sameAs.name, here.name);
  assert.equal(row.fields.Address, undefined, 'only what Fix asks for');
  assert.ok(!JSON.stringify(row).includes('customer_id'), 'no raw row');
});

test('the list stops at 200 and says how many there are', async () => {
  const fileId = await bring(priceList(...Array.from({ length: 205 }, () => pads({ Price: null, 'Qty On Hand': 0 }))));
  const { body } = await staff('/api/move/look');
  assert.equal(body.rows.length, 200);
  assert.ok(body.total >= 205, String(body.total));
  // Tidied, so the rest of this file's lists stay short.
  for (const row of await lookIn(fileId)) assert.equal((await leaveOut(row)).status, 200);
  for (const row of await lookIn(fileId)) assert.equal((await leaveOut(row)).status, 200);
  await countsRight(fileId);
});

// ---- Fix ----

test('a product with no price, fixed: it comes across with its stock and one history line, and the counts follow', async () => {
  const row = pads({ Price: null });
  const fileId = await bring(priceList(row));
  const before = await countsRight(fileId);
  assert.deepEqual([before.rowsLook, before.stockLook, before.stockIn], [1, 1, 0]);
  const look = await oneLook(fileId);
  assert.equal(look.why, 'No price');
  const res = await fix(look, { Price: '28.00' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.state, 'in');
  const made = await bySku(row['Item Lookup Code']);
  assert.deepEqual([Number(made.price), made.stock_qty, made.active], [28, 6, 1]);
  const history = await historyOf(made.id);
  assert.deepEqual(history.map((h) => [h.change_qty, h.note]), [[6, 'Brought across from Citrus Lime']]);
  assert.equal(history[0].login_id, owner.loginId, 'whoever fixed it');
  const after = await countsRight(fileId);
  assert.deepEqual([after.rowsIn, after.rowsLook, after.stockLook, after.stockIn, after.rowsFixed], [1, 0, 0, 1, 1]);
  const [stored] = await rowsOf(fileId);
  assert.deepEqual([stored.state, stored.why, stored.data], ['in', null, {}]);
  assert.equal(stored.sorted_by_login_id, owner.loginId);
  assert.ok(stored.sorted_at);
});

test('a fix that still doesn\'t fit says why, changes nothing and stores nothing it was sent', async () => {
  const row = pads({ Price: null });
  const fileId = await bring(priceList(row));
  const look = await oneLook(fileId);
  for (const odd of ['£12.50', '12,50', '0x10', '1e3']) {
    const res = await fix(look, { Price: odd });
    assert.deepEqual([res.status, res.body.code], [422, 'still_needs_a_look'], odd);
    assert.equal(res.body.why, 'The price isn’t a number Wheelhouse can use');
  }
  assert.equal(await bySku(row['Item Lookup Code']), undefined);
  const still = await oneLook(fileId);
  assert.equal(still.seen, look.seen, 'the row is as it was');
  assert.equal(still.fields.Price, undefined);
  const f = await countsRight(fileId);
  assert.deepEqual([f.rowsLook, f.stockLook, f.rowsFixed], [1, 1, 0]);
});

test('the same save twice, at once or later, makes one product and one stock line, and both are told so', async () => {
  const row = pads({ Price: null });
  const fileId = await bring(priceList(row));
  const look = await oneLook(fileId);
  const requestKey = key();
  const [a, b] = await Promise.all([fix(look, { Price: '28' }, { requestKey }), fix(look, { Price: '28' }, { requestKey })]);
  assert.deepEqual([a.status, b.status], [200, 200], JSON.stringify([a.body, b.body]));
  assert.deepEqual([a.body.state, b.body.state], ['in', 'in']);
  const later = await fix(look, { Price: '28' }, { requestKey });
  assert.deepEqual([later.status, later.body.state], [200, 'in']);
  const made = await bySku(row['Item Lookup Code']);
  assert.equal(made.stock_qty, 6);
  assert.equal((await historyOf(made.id)).length, 1);
  const f = await countsRight(fileId);
  assert.deepEqual([f.rowsIn, f.stockIn, f.rowsFixed], [1, 1, 1]);
  // That key with something else is refused, and a new key finds the row dealt with.
  assert.deepEqual([(await fix(look, { Price: '30' }, { requestKey })).body.code], ['reused_key']);
  assert.equal((await fix(look, { Price: '28' })).body.code, 'row_changed');
});

test('a request key is needed, and only the fields Fix asks for can change', async () => {
  const fileId = await bring(priceList(pads({ Price: null })));
  const look = await oneLook(fileId);
  const path = `/api/move/rows/${look.id}/fix`;
  assert.equal((await staff(path, { method: 'POST', body: { seen: look.seen, fields: { Price: '28' } } })).status, 400);
  assert.equal((await staff(`/api/move/rows/${look.id}/leave-out`, { method: 'POST', body: { seen: look.seen } })).status, 400);
  assert.equal((await fix(look, { Store: '[Another shop]', Price: '28' })).status, 400, 'not a field of Fix');
  assert.equal((await fix(look, { Price: 28 })).status, 400, 'text only');
  assert.equal((await fix(look, { Price: 'x'.repeat(501) })).status, 400);
  assert.equal((await staff('/api/move/rows/abc/fix', { method: 'POST', body: {} })).status, 404);
  assert.equal((await oneLook(fileId)).seen, look.seen);
  assert.equal((await leaveOut(look)).status, 200);
});

test('a code already here, fixed to: nothing is overwritten and no stock is added', async () => {
  const here = pads();
  await bring(priceList(here));
  const fileId = await bring(priceList(pads({ Price: null, Description: '[Product]' })));
  const res = await fix(await oneLook(fileId), { Price: '1', 'Item Lookup Code': here['Item Lookup Code'] });
  assert.deepEqual([res.status, res.body.state], [200, 'same']);
  const made = await bySku(here['Item Lookup Code']);
  assert.deepEqual([made.name, made.stock_qty], ['Shimano brake pads', 6]);
  assert.equal((await historyOf(made.id)).length, 1);
  const f = await countsRight(fileId);
  assert.deepEqual([f.rowsSame, f.rowsLook, f.stockLook], [1, 0, 0]);
});

test('another store\'s row can\'t be fixed into this shop\'s stock: it says why, and leaving it out sorts it', async () => {
  await bring(priceList(pads()));
  const fileId = await bring(priceList(pads({ Store: '[Another shop]' })));
  const look = await oneLook(fileId);
  const res = await fix(look, { Price: '28' });
  assert.equal(res.status, 422);
  assert.match(res.body.why, /one shop’s stock comes across/);
  assert.equal((await leaveOut(look)).status, 200);
  const f = await countsRight(fileId);
  assert.deepEqual([f.rowsLeftOut, f.stockLook], [1, 0]);
});

test('a barcode row is fixed by its product code or barcode', async () => {
  const here = pads();
  await bring(priceList(here));
  const fileId = await bring(barcodes({ ILC: `[No such ${key().slice(0, 6)}]`, Alias: `50${key().slice(0, 10)}` }));
  const look = await oneLook(fileId);
  const res = await fix(look, { ILC: here['Item Lookup Code'] });
  assert.deepEqual([res.status, res.body.state], [200, 'in'], JSON.stringify(res.body));
  assert.equal((await bySku(here['Item Lookup Code'])).barcode, look.fields.Alias);
  await countsRight(fileId);
});

test('a customer with no name, fixed, comes across, with the rest of their row', async () => {
  const p = person({ 'First Name': null, 'Last Name': null });
  const fileId = await bring(customers(p));
  const look = await oneLook(fileId);
  assert.equal(look.why, 'No name');
  const res = await fix(look, { 'First Name': 'Maya', 'Last Name': 'Person' });
  assert.deepEqual([res.status, res.body.state], [200, 'in'], JSON.stringify(res.body));
  const c = await byAccount(p.v['Account Number']);
  assert.deepEqual([c.name, c.email, c.address, c.email_from_customer], ['Maya Person', p.v.Email, '[Address], [City]', false]);
  assert.deepEqual((await rowsOf(fileId))[0].data, {}, 'emptied');
  await countsRight(fileId);
});

test('a fixed customer brings their waiting bike along, and only the bikes that fit them', async () => {
  const p = person({ 'First Name': null, 'Last Name': null });
  const other = person();
  const lastName = `Person${key().slice(0, 6)}`;
  const bikeFile = await bring(bikes(
    { Description: '[Bike]', 'Serial Number': `[Frame ${key().slice(0, 6)}]`, 'Customer Name': `Maya ${lastName}`, 'Email Address': p.v.Email },
    { Description: '[Bike]', 'Serial Number': `[Frame ${key().slice(0, 6)}]`, 'Customer Name': other.name, 'Email Address': other.v.Email },
  ));
  const fileId = await bring(customers(p));
  // The customers file finishing tried them once: still nobody for either.
  await finish();
  const look = await oneLook(fileId);
  const res = await fix(look, { 'First Name': 'Maya', 'Last Name': lastName });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const during = await rowsOf(bikeFile);
  assert.deepEqual(during.map((r) => r.state), ['waiting', 'look'], 'only the bike that fits');
  await finish();
  const c = await byAccount(p.v['Account Number']);
  const theirs = await inShop(() => prepare('SELECT * FROM customer_bikes WHERE customer_id = ?').all(c.id));
  assert.equal(theirs.length, 1);
  const f = await countsRight(bikeFile);
  assert.deepEqual([f.rowsIn, f.rowsLook, f.state], [1, 1, 'done']);
});

test('a fixed product brings its waiting barcode along', async () => {
  const row = pads({ Price: null });
  const alias = `50${key().slice(0, 10)}`;
  const barcodeFile = await bring(barcodes({ ILC: row['Item Lookup Code'], Alias: alias }, { ILC: `[No such ${key().slice(0, 6)}]`, Alias: `51${key().slice(0, 10)}` }));
  const fileId = await bring(priceList(row));
  assert.equal((await fix(await oneLook(fileId), { Price: '28' })).status, 200);
  await finish();
  assert.equal((await bySku(row['Item Lookup Code'])).barcode, alias);
  const f = await countsRight(barcodeFile);
  assert.deepEqual([f.rowsIn, f.rowsLook], [1, 1]);
});

test('a bike is fixed by its customer\'s details', async () => {
  const p = person();
  await bring(customers(p));
  const fileId = await bring(bikes({ Description: '[Bike]', 'Serial Number': `[Frame ${key().slice(0, 6)}]`, 'Customer Name': '[Nobody here]', 'Email Address': `nobody.${key().slice(0, 6)}@example.test` }));
  const look = await oneLook(fileId);
  const res = await fix(look, { 'Customer Name': p.name, 'Email Address': p.v.Email });
  assert.deepEqual([res.status, res.body.state], [200, 'in'], JSON.stringify(res.body));
  const c = await byAccount(p.v['Account Number']);
  assert.equal((await inShop(() => prepare('SELECT * FROM customer_bikes WHERE customer_id = ?').all(c.id))).length, 1);
  await countsRight(fileId);
});

// ---- Leave it out ----

test('leaving a row out keeps it, makes nothing, and the counts and stock look follow; twice counts once', async () => {
  const row = pads({ Price: null });
  const fileId = await bring(priceList(row));
  const look = await oneLook(fileId);
  const requestKey = key();
  const [a, b] = await Promise.all([leaveOut(look, { requestKey }), leaveOut(look, { requestKey })]);
  assert.deepEqual([a.status, b.status, a.body.state, b.body.state], [200, 200, 'left_out', 'left_out'], JSON.stringify([a.body, b.body]));
  assert.equal(await bySku(row['Item Lookup Code']), undefined);
  const f = await countsRight(fileId);
  assert.deepEqual([f.rowsLeftOut, f.rowsLook, f.stockLook, f.rowsFixed], [1, 0, 0, 0]);
  const [stored] = await rowsOf(fileId);
  assert.equal(stored.state, 'left_out');
  assert.equal(stored.data['Item Lookup Code'], row['Item Lookup Code'], 'kept, to add by hand');
  assert.equal(stored.sorted_by_login_id, owner.loginId);
  assert.deepEqual(await lookIn(fileId), []);
  assert.equal((await fix(look, { Price: '28' })).body.code, 'row_changed', 'it can\'t then be fixed');
});

test('a row left out keeps its link, so it goes if they\'re deleted even after changing their email and phone', async () => {
  const maya = person();
  await bring(customers(maya));
  const c = await byAccount(maya.v['Account Number']);
  const copy = person({ 'First Name': maya.v['First Name'], 'Last Name': maya.v['Last Name'], Email: maya.v.Email });
  const fileId = await bring(customers(copy));
  assert.equal((await rowsOf(fileId))[0].customer_id, c.id);
  assert.equal((await leaveOut(await oneLook(fileId))).status, 200);
  assert.equal((await rowsOf(fileId))[0].customer_id, c.id, 'kept');
  const moved = await staff(`/api/customers/${c.id}`, { method: 'PUT', body: { name: c.name, email: `moved.${key().slice(0, 6)}@example.test`, phone: newPhone() } });
  assert.equal(moved.status, 200, JSON.stringify(moved.body));
  await deleted(c.id);
  assert.deepEqual(await rowsOf(fileId), [], 'as a row needing a look would');
  const f = await countsRight(fileId);
  assert.deepEqual([f.rowsTotal, f.rowsLeftOut], [0, 0]);
});

test('a row left out with another name, linked to someone deleted, stays with no link', async () => {
  const maya = person();
  await bring(customers(maya));
  const c = await byAccount(maya.v['Account Number']);
  const fileId = await bring(customers(person({ Email: maya.v.Email })));
  assert.equal((await leaveOut(await oneLook(fileId))).status, 200);
  await deleted(c.id);
  const [row] = await rowsOf(fileId);
  assert.deepEqual([row.state, row.customer_id, row.why], ['left_out', null, SHARED_CONTACT]);
  await countsRight(fileId);
});

test('a row left out with stock is counted as stock left out', async () => {
  const fileId = await bring(priceList(pads({ Price: null })));
  assert.equal((await leaveOut(await oneLook(fileId))).status, 200);
  const f = await countsRight(fileId);
  assert.deepEqual([f.stockLook, f.stockLeftOut], [0, 1]);
  const none = await bring(priceList(pads({ Price: null, 'Qty On Hand': 0 })));
  assert.equal((await leaveOut(await oneLook(none))).status, 200);
  assert.equal((await countsRight(none)).stockLeftOut, 0);
});

// ---- A row that changed, or a wait that's too long ----
test('a row changed by a batch going round is refused too', async () => {
  const p = person();
  const bikeFile = await bring(bikes({ Description: '[Bike]', 'Serial Number': `[Frame ${key().slice(0, 6)}]`, 'Customer Name': p.name, 'Email Address': p.v.Email }));
  const open = await oneLook(bikeFile);
  await send(customers(p));
  while (await readNextFile(owner.shop.id));
  while (await inShop(() => bringBatch()));
  const res = await fix(open, { 'Customer Name': '[Someone else]' });
  assert.equal(res.body.code, 'row_changed', JSON.stringify(res.body));
  const c = await byAccount(p.v['Account Number']);
  assert.equal((await inShop(() => prepare('SELECT count(*)::int AS n FROM customer_bikes WHERE customer_id = ?').get(c.id))).n, 1, 'not twice');
  await countsRight(bikeFile);
});

test('told to wait too long for the move files, a save says try again and changes nothing', async () => {
  const fileId = await bring(priceList(pads({ Price: null })));
  const look = await oneLook(fileId);
  let release;
  const held = new Promise((r) => { release = r; });
  // A batch or deletion holding the files, longer than a save waits.
  const holding = inShop(async () => {
    await prepare('BEGIN').run();
    await prepare('SELECT id FROM move_files ORDER BY id FOR UPDATE').all();
    await held;
    await prepare('ROLLBACK').run();
  });
  try {
    await new Promise((r) => { setTimeout(r, 100); });
    // With a limit, so a save that waits for ever fails here instead of hanging.
    const res = await Promise.race([
      fix(look, { Price: '28' }),
      new Promise((_, no) => { setTimeout(() => no(new Error('the save kept waiting for the lock')), 6000); }),
    ]);
    assert.deepEqual([res.status, res.body.code], [503, 'busy']);
  } finally {
    release();
    await holding;
  }
  assert.equal((await oneLook(fileId)).seen, look.seen);
  assert.equal((await fix(look, { Price: '28' })).status, 200);
});

// ---- Who ----


test('a till with nobody checked in sorts nothing; checked in, the Owner is recorded by their check-in', async () => {
  const b = browser();
  assert.equal((await b.post('/api/till-setup', { siteId: (await aSite()).id, number: 1 })).status, 201);
  const row = pads({ Price: null });
  const fileId = await bring(priceList(row));
  const look = await oneLook(fileId);
  for (const [path, payload] of [[`/api/move/rows/${look.id}/fix`, body(look, { fields: { ...look.fields, Price: '28' } })], [`/api/move/rows/${look.id}/leave-out`, { seen: look.seen, requestKey: key() }]]) {
    const res = await b.post(path, payload);
    assert.deepEqual([res.status, res.body.code], [409, 'check_in_first'], path);
  }
  assert.equal(await bySku(row['Item Lookup Code']), undefined);
  assert.equal((await oneLook(fileId)).seen, look.seen);

  const offer = await b.post('/api/your-settings/till-pin/offer');
  assert.equal((await b.post('/api/your-settings/till-pin', { pin: offer.body.pin })).status, 200);
  assert.equal((await b.post('/api/till-checkin', { pin: offer.body.pin })).status, 201);
  const res = await b.post(`/api/move/rows/${look.id}/fix`, body(look, { fields: { ...look.fields, Price: '28' } }));
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const [stored] = await rowsOf(fileId);
  const { employee_id: ownerEmployee } = await inShop(() => prepare('SELECT employee_id FROM logins WHERE id = ?').get(owner.loginId));
  assert.ok(ownerEmployee, 'the Owner has a team member');
  assert.equal(stored.sorted_by_employee_id, ownerEmployee);
});

test('a workshop computer with nobody checked in sorts nothing', async () => {
  const b = browser();
  assert.equal((await b.post('/api/till-setup/workshop', { siteId: (await aSite()).id, name: '' })).status, 201);
  const fileId = await bring(priceList(pads({ Price: null })));
  const look = await oneLook(fileId);
  const res = await b.post(`/api/move/rows/${look.id}/leave-out`, { seen: look.seen, requestKey: key() });
  assert.ok([403, 409].includes(res.status), String(res.status));
  assert.equal((await oneLook(fileId)).seen, look.seen);
  assert.equal((await leaveOut(look)).status, 200);
});

test('only the Owner sees or sorts rows, and another shop\'s row isn\'t there', async () => {
  const fileId = await bring(priceList(pads({ Price: null })));
  const look = await oneLook(fileId);
  const made = await staff('/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `${key().slice(0, 8)}@example.test`, password: 'password123' } });
  const jo = await staffFreshCookie(made.body.loginId);
  const asJo = (path, options) => staffRequest(server.baseUrl, jo, path, options);
  assert.equal((await asJo('/api/move/look')).status, 403);
  assert.equal((await asJo(`/api/move/rows/${look.id}/fix`, { method: 'POST', body: body(look) })).status, 403);
  assert.equal((await asJo(`/api/move/rows/${look.id}/leave-out`, { method: 'POST', body: body(look) })).status, 403);

  const otherShop = await staffSignup(server.baseUrl, { shopName: '[Another shop]' });
  try {
    const theirs = await staffRequest(server.baseUrl, otherShop.cookie, `/api/move/rows/${look.id}/leave-out`, { method: 'POST', body: { seen: look.seen, requestKey: key() } });
    assert.deepEqual([theirs.status, theirs.body.code], [409, 'row_gone']);
    assert.deepEqual((await staffRequest(server.baseUrl, otherShop.cookie, '/api/move/look')).body.rows, []);
  } finally {
    await deleteTestShop(otherShop.shop.id);
  }
  assert.equal((await oneLook(fileId)).seen, look.seen);
  assert.equal((await leaveOut(look)).status, 200);
});

// ---- The review, 4 Nov ----

test('a fixed row\'s stock history names who fixed it, not who sent the file', async () => {
  const row = pads({ Price: null });
  const fileId = await bring(priceList(row));
  const made = await staff('/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `${key().slice(0, 8)}@example.test`, password: 'password123' } });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  await inShop(() => prepare('UPDATE move_files SET sent_by_login_id = ? WHERE id = ?').run(made.body.loginId, fileId));
  assert.equal((await fix(await oneLook(fileId), { Price: '28' })).status, 200);
  const product = await bySku(row['Item Lookup Code']);
  assert.equal((await historyOf(product.id))[0].login_id, owner.loginId);
});

test('a bike with the shared reason needs the tick even when the fix takes the email away', async () => {
  const gone = await aDeletedCustomer();
  const live = person();
  await bring(customers(live));
  const fileId = await bring(bikes({ Description: '[Bike]', 'Serial Number': `[Frame ${key().slice(0, 6)}]`, 'Customer Name': live.name, 'Email Address': gone.p.v.Email }));
  const look = await oneLook(fileId);
  assert.equal(look.why, SHARED_CONTACT);
  const res = await fix(look, { 'Email Address': live.v.Email });
  assert.deepEqual([res.status, res.body.decide], [422, 'shared']);
  const c = await byAccount(live.v['Account Number']);
  assert.equal((await inShop(() => prepare('SELECT count(*)::int AS n FROM customer_bikes WHERE customer_id = ?').get(c.id))).n, 0);
});

test('only true is a tick, and only a list of whole numbers says who it isn\'t', async () => {
  const { son, row } = await aSharedRow();
  for (const shared of ['yes', 1, 'true', [true]]) {
    const res = await fix(row, {}, { decided: { shared } });
    assert.deepEqual([res.status, res.body.decide], [422, 'shared'], JSON.stringify(shared));
  }
  assert.equal(await byAccount(son.v['Account Number']), undefined);
  const here = person();
  await bring(customers(here));
  const c = await byAccount(here.v['Account Number']);
  const fileId = await bring(customers(person({ Email: here.v.Email })));
  const look = await oneLook(fileId);
  for (const notSameAs of [c.id, String(c.id), [String(c.id)], true]) {
    const res = await fix(look, {}, { decided: { notSameAs } });
    assert.deepEqual([res.status, res.body.decide], [422, 'same_person'], JSON.stringify(notSameAs));
  }
});

for (const [how, bikeHas] of [
  ['email', (p) => ({ 'Email Address': p.v.Email.toUpperCase() })],
  ['mobile', (p) => ({ 'Mobile Number': `+44 ${p.v.Phone.replace(/\D/g, '').slice(1)}` })],
  ['phone', (p) => ({ 'Phone Number': p.v.Phone.replace(/\D/g, '') })],
  ['name', () => ({ 'Customer Name': null })],
]) {
  test(`a fixed customer brings along a bike that fits them by ${how} alone`, async () => {
    const p = person({ 'First Name': null, 'Last Name': null });
    const lastName = `Person${key().slice(0, 6)}`;
    const named = how === 'name' ? { 'Customer Name': `Maya ${lastName}` } : {};
    const bikeFile = await bring(bikes({ Description: '[Bike]', 'Serial Number': `[Frame ${key().slice(0, 6)}]`, ...bikeHas(p), ...named }));
    const fileId = await bring(customers(p));
    assert.equal((await fix(await oneLook(fileId), { 'First Name': 'Maya', 'Last Name': lastName })).status, 200);
    assert.deepEqual((await rowsOf(bikeFile)).map((r) => r.state), ['waiting']);
    await finish();
    const c = await byAccount(p.v['Account Number']);
    assert.equal((await inShop(() => prepare('SELECT count(*)::int AS n FROM customer_bikes WHERE customer_id = ?').get(c.id))).n, 1);
  });
}

test('a row like two people asks about each in turn, makes nobody until both are ticked, and merges nobody', async () => {
  const mum = person();
  const dad = person();
  await bring(customers(mum, dad));
  const mumId = (await byAccount(mum.v['Account Number'])).id;
  const dadId = (await byAccount(dad.v['Account Number'])).id;
  const son = person({ Email: mum.v.Email, Phone: dad.v.Phone });
  const fileId = await bring(customers(son));
  const look = await oneLook(fileId);
  const first = await fix(look);
  assert.deepEqual([first.status, first.body.decide, first.body.sameAs.id], [422, 'same_person', mumId]);
  const second = await fix(look, {}, { decided: { notSameAs: [mumId] } });
  assert.deepEqual([second.status, second.body.decide, second.body.sameAs.id, second.body.sameAs.name], [422, 'same_person', dadId, dad.name]);
  assert.equal(await byAccount(son.v['Account Number']), undefined, 'one tick isn\'t enough');
  assert.equal((await fix(look, {}, { decided: { notSameAs: [dadId] } })).body.sameAs.id, mumId, 'nor the other one alone');
  const both = await fix(look, {}, { decided: { notSameAs: [mumId, dadId] } });
  assert.deepEqual([both.status, both.body.state], [200, 'in'], JSON.stringify(both.body));
  assert.notEqual((await byAccount(son.v['Account Number'])).id, mumId);
  await countsRight(fileId);
});

test('a deleted account number is known in any case, with spaces around it, typed or in a file', async () => {
  const gone = await aDeletedCustomer({ 'Account Number': `Ab-${key().slice(0, 6)}` });
  const number = gone.p.v['Account Number'];
  const typed = person({ 'First Name': null, 'Last Name': null });
  const typedFile = await bring(customers(typed));
  const res = await fix(await oneLook(typedFile), { 'First Name': 'Maya', 'Last Name': 'Person', 'Account Number': `  ${number.toUpperCase()} ` });
  assert.deepEqual([res.status, res.body.state], [200, 'skipped'], JSON.stringify(res.body));
  const inFile = person({ 'Account Number': number.toLowerCase() });
  const fileId = await bring(customers(inFile));
  assert.deepEqual((await rowsOf(fileId)).map((r) => [r.state, r.data]), [['skipped', {}]]);
  assert.equal(await byAccount(number.toLowerCase()), undefined);
});

test('a customer whose account number was held with spaces around it is known by it once deleted', async () => {
  const p = person({ 'Account Number': `Sp-${key().slice(0, 6)}` });
  await bring(customers(p));
  const c = await byAccount(p.v['Account Number']);
  await inShop(() => prepare('UPDATE customers SET citrus_account = ? WHERE id = ?').run(`  ${p.v['Account Number']} `, c.id));
  await deleted(c.id);
  const fileId = await bring(customers(person({ 'Account Number': p.v['Account Number'].toLowerCase() })));
  assert.deepEqual((await rowsOf(fileId)).map((r) => r.state), ['skipped']);
});

test('a code left by a deletion before this change still spots its own account number', async () => {
  const number = `Old-${key().slice(0, 6)}`;
  await aDeletedCustomer();
  await inShop(async () => {
    const { salt } = await prepare('SELECT salt FROM move_deleted_salt').get();
    await prepare('INSERT INTO move_deleted_codes (kind, code) VALUES (?, ?) RETURNING id').get('account', createHmac('sha256', salt).update(`account:${number}`).digest('hex'));
  });
  const fileId = await bring(customers(person({ 'Account Number': number })));
  assert.deepEqual((await rowsOf(fileId)).map((r) => r.state), ['skipped']);
});

test('a waiting row with their account number in another case goes when they\'re deleted', async () => {
  const maya = person({ 'Account Number': `Ab-${key().slice(0, 6)}` });
  await bring(customers(maya));
  const c = await byAccount(maya.v['Account Number']);
  const rowWith = person({ 'First Name': null, 'Last Name': null, 'Account Number': ` ${maya.v['Account Number'].toUpperCase()}` });
  const fileId = await bring(customers(rowWith));
  // In another case it's the same account, so it has already come across as her.
  assert.deepEqual((await rowsOf(fileId)).map((r) => r.state), ['same'], 'A1 and a1 are one account');
  const other = await bring(customers(person({ 'First Name': null, 'Last Name': null })));
  await inShop(() => prepare(`UPDATE move_rows SET data = jsonb_set(data, '{Account Number}', to_jsonb(?::text)) WHERE file_id = ?`).run(` ${maya.v['Account Number'].toUpperCase()}`, other));
  await deleted(c.id);
  assert.deepEqual(await rowsOf(other), []);
  const f = await countsRight(other);
  assert.deepEqual([f.rowsTotal, f.rowsLook], [0, 0]);
});

test('removing a staff record who sorted a row works, and the row stays with nobody named', async () => {
  const fileId = await bring(priceList(pads({ Price: null })));
  assert.equal((await leaveOut(await oneLook(fileId))).status, 200);
  const made = await staff('/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `${key().slice(0, 8)}@example.test`, password: 'password123' } });
  const { employee_id: employeeId } = await inShop(() => prepare('SELECT employee_id FROM logins WHERE id = ?').get(made.body.loginId));
  await inShop(() => prepare('UPDATE move_rows SET sorted_by_employee_id = ? WHERE file_id = ?').run(employeeId, fileId));
  const res = await staff(`/api/employees/${employeeId}/permanent`, { method: 'DELETE' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const [row] = await rowsOf(fileId);
  assert.deepEqual([row.state, row.sorted_by_employee_id], ['left_out', null]);
});
