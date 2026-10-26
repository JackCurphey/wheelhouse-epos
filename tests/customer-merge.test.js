// Possible duplicates and Merge, with a 30-day undo (openspec/changes/customer-merge;
// cs-page-dup, cs-merge; customer service review 5, 12; Jack, 24 Oct, answer 6).
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import '../server/load-env.js';
import { runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';
import { registerTill, tillRequest, seedProduct } from './helpers/till.js';

let server;
let owner;
let other;
let cashierId;

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'Merge Cycles' });
  other = await staffSignup(server.baseUrl, { shopName: 'Elsewhere Cycles' });
  cashierId = (await staff('/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `jo-${randomUUID().slice(0, 8)}@example.test`, password: 'password123' } })).body.employeeId;
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (other) await deleteTestShop(other.shop.id);
  if (server) await server.stop();
});

function staff(path, options, who = owner) {
  return staffRequest(server.baseUrl, who.cookie, path, options);
}
const inShop = (fn, shop = owner.shop.id) => runWithShop(shop, fn);
const add = async (body, who = owner) => (await staff('/api/customers', { method: 'POST', body }, who)).body;
const dups = async (id, who = owner) => (await staff(`/api/customers/${id}/possible-duplicates`, {}, who)).body;
let n = 0;
// A customer with a bike, a job, a sale and a message of their own.
async function withHistory(body) {
  const c = await add(body);
  const bike = await inShop(async () => (await prepare("INSERT INTO customer_bikes (customer_id, make, model) VALUES (?, 'Trek', 'FX 2') RETURNING id").get(c.id)).id);
  const job = (await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Gear tune', jobDate: '2026-09-20', customerId: c.id, bikeId: bike } })).body;
  const tube = (await staff('/api/products', { method: 'POST', body: { name: 'Inner tube', price: 5, sku: `T-${randomUUID().slice(0, 6)}`, stockQty: 10 } })).body;
  const sale = (await staff('/api/sales', { method: 'POST', body: { cashierId, customerId: c.id, items: [{ productId: tube.id, qty: 1 }], cashAmount: 5, cashTendered: 5 } })).body;
  const msg = await inShop(async () => (await prepare("INSERT INTO customer_messages (customer_id, body, status, intent_state, channel, to_address) VALUES (?, 'Hi', 'delivered', 'delivered', 'sms', ?) RETURNING id").get(c.id, body.phone ?? '')).id);
  // A general message in their conversation with the shop (ask-the-shop-server design 1).
  const note = await inShop(async () => (await prepare("INSERT INTO job_notes (customer_id, from_customer, body) VALUES (?, true, '[Maya’s message]') RETURNING id").get(c.id)).id);
  n += 1;
  return { c, bike, job, sale, msg, note };
}
const ownerOf = (table, id) => inShop(async () => (await prepare(`SELECT customer_id FROM ${table} WHERE id = ?`).get(id)).customer_id);

test('a possible duplicate by the same phone (however written) or email, with counts; never another shop’s', async () => {
  const maya = await add({ name: 'Maya Patel', phone: '07700 900142', email: 'maya@example.com' });
  const twin = await add({ name: 'Maya P.', phone: '+44 7700 900142' });
  const byEmail = await add({ name: 'M. Patel', phone: '07700 111111', email: 'MAYA@example.com' });
  await add({ name: 'Maya Patel', phone: '07700 900142' }, other);
  const found = await dups(maya.id);
  assert.deepEqual(found.map((d) => [d.id, d.reason]).sort(), [[twin.id, 'phone'], [byEmail.id, 'email']].sort());
  const t = found.find((d) => d.id === twin.id);
  assert.deepEqual([t.name, t.jobs, t.sales], ['Maya P.', 0, 0]);
  assert.ok(Date.parse(t.createdAt));
});

test('They’re different people: neither is flagged again', async () => {
  const a = await add({ name: 'Sam Reed', phone: '07700 900500' });
  const b = await add({ name: 'Sam Reed', phone: '07700 900500' });
  assert.ok((await dups(a.id)).some((d) => d.id === b.id));
  const res = await staff(`/api/customers/${a.id}/not-duplicate`, { method: 'POST', body: { otherId: b.id } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.ok(!(await dups(a.id)).some((d) => d.id === b.id));
  assert.ok(!(await dups(b.id)).some((d) => d.id === a.id), 'both ways');
});

test('merging moves every kind of row, keeps the chosen fields, and hides the other', async () => {
  const kept = await withHistory({ name: 'Aisha Khan', phone: '07700 900300', email: 'aisha@example.com', postcode: 'BL1 1AA' });
  const gone = await withHistory({ name: 'Aisha K.', phone: '07700 900300', address: '9 Mill Lane', postcode: 'BL2 2BB' });
  const res = await staff(`/api/customers/${kept.c.id}/merge`, { method: 'POST', body: { otherId: gone.c.id, keep: { name: 'this', email: 'this', address: 'other' } } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  for (const [table, id] of [['customer_bikes', gone.bike], ['workshop_jobs', gone.job.id], ['sales', gone.sale.id], ['customer_messages', gone.msg], ['job_notes', gone.note]]) {
    assert.equal(await ownerOf(table, id), kept.c.id, `${table} ${id}`);
  }
  const k = (await staff(`/api/customers/${kept.c.id}`)).body;
  assert.deepEqual([k.name, k.email, k.address, k.postcode], ['Aisha Khan', 'aisha@example.com', '9 Mill Lane', 'BL2 2BB'], 'address goes with its postcode');
  const g = await inShop(() => prepare('SELECT active, merged_into_id FROM customers WHERE id = ?').get(gone.c.id));
  assert.deepEqual([g.active, g.merged_into_id], [0, kept.c.id]);
  assert.ok(!(await staff('/api/search?q=aisha')).body.customers.some((c) => c.id === gone.c.id), 'not found any more');
  const merges = (await staff(`/api/customers/${kept.c.id}/merges`)).body;
  assert.equal(merges.length, 1);
  assert.equal(merges[0].otherName, 'Aisha K.');
  assert.ok(Date.parse(merges[0].undoUntil) > Date.now() + 29 * 86400_000);
});

test('Undo the merge puts everything back, and the fields as they were', async () => {
  const kept = await withHistory({ name: 'Oliver Chen', phone: '07700 900600', postcode: 'BL3 3CC' });
  const gone = await withHistory({ name: 'Ollie Chen', phone: '07700 900600', postcode: 'BL4 4DD' });
  const merged = (await staff(`/api/customers/${kept.c.id}/merge`, { method: 'POST', body: { otherId: gone.c.id, keep: { name: 'other', address: 'other' } } })).body;
  assert.equal((await staff(`/api/customers/${kept.c.id}`)).body.name, 'Ollie Chen');
  // A job made after the merge stays with the kept record.
  const after = (await staff('/api/workshop-jobs', { method: 'POST', body: { title: 'Safety check', jobDate: '2026-09-25', customerId: kept.c.id } })).body;
  const res = await staff(`/api/customer-merges/${merged.id}/undo`, { method: 'POST', body: {} });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  for (const [table, id] of [['customer_bikes', gone.bike], ['workshop_jobs', gone.job.id], ['sales', gone.sale.id], ['customer_messages', gone.msg], ['job_notes', gone.note]]) {
    assert.equal(await ownerOf(table, id), gone.c.id, `${table} ${id} went back`);
  }
  assert.equal(await ownerOf('workshop_jobs', kept.job.id), kept.c.id);
  assert.equal(await ownerOf('workshop_jobs', after.id), kept.c.id, 'made after the merge, so it stays');
  const k = (await staff(`/api/customers/${kept.c.id}`)).body;
  assert.deepEqual([k.name, k.postcode], ['Oliver Chen', 'BL3 3CC']);
  const g = (await staff(`/api/customers/${gone.c.id}`)).body;
  assert.equal(g.active, true);
  assert.equal((await staff(`/api/customer-merges/${merged.id}/undo`, { method: 'POST', body: {} })).status, 409, 'once only');
  assert.deepEqual((await staff(`/api/customers/${kept.c.id}/merges`)).body, []);
});

test('after 30 days the other is removed for good, and Undo is refused', async () => {
  const kept = await add({ name: 'Priya Shah', phone: '07700 900900' });
  const gone = await add({ name: 'Priya S.', phone: '07700 900900' });
  const merged = (await staff(`/api/customers/${kept.id}/merge`, { method: 'POST', body: { otherId: gone.id, keep: {} } })).body;
  await inShop(() => prepare("UPDATE customer_merges SET merged_at = now() - interval '31 days' WHERE id = ?").run(merged.id));
  assert.deepEqual((await staff(`/api/customers/${kept.id}/merges`)).body, [], 'no longer undoable');
  assert.equal(await inShop(() => prepare('SELECT 1 FROM customers WHERE id = ?').get(gone.id)), undefined, 'removed');
  assert.equal((await staff(`/api/customer-merges/${merged.id}/undo`, { method: 'POST', body: {} })).status, 409);
});

test('both with online accounts: refused, and nothing moves', async () => {
  const a = await withHistory({ name: 'Lena Fox', phone: '07700 900811' });
  const b = await withHistory({ name: 'Lena F.', phone: '07700 900811' });
  await inShop(async () => {
    for (const c of [a.c, b.c]) await prepare("INSERT INTO customer_logins (shop_id, customer_id, email, password_hash) VALUES (?, ?, ?, 'x')").run(owner.shop.id, c.id, `lena-${c.id}@example.com`);
  });
  const res = await staff(`/api/customers/${a.c.id}/merge`, { method: 'POST', body: { otherId: b.c.id, keep: {} } });
  assert.equal(res.status, 409, JSON.stringify(res.body));
  assert.equal(res.body.code, 'both_online');
  assert.equal(await ownerOf('workshop_jobs', b.job.id), b.c.id);
});

test('one with an online account: it moves to the kept record', async () => {
  const a = await add({ name: 'Jamie Brooks', phone: '07700 900321' });
  const b = await add({ name: 'J. Brooks', phone: '07700 900321' });
  const login = await inShop(async () => (await prepare("INSERT INTO customer_logins (shop_id, customer_id, email, password_hash) VALUES (?, ?, 'jamie@example.com', 'x') RETURNING id").get(owner.shop.id, b.id)).id);
  assert.equal((await staff(`/api/customers/${a.id}/merge`, { method: 'POST', body: { otherId: b.id, keep: {} } })).status, 200);
  assert.equal(await ownerOf('customer_logins', login), a.id);
});

test('a member of staff can merge; nobody can merge someone into themselves, or another shop’s', async () => {
  const made = await staff('/api/team', { method: 'POST', body: { name: 'Sam Day', isCashier: true, email: `sam-${randomUUID().slice(0, 8)}@example.test`, password: 'password123' } });
  const jo = { cookie: await staffFreshCookie(made.body.loginId) };
  const a = await add({ name: 'Tom Hale', phone: '07700 900444' });
  const b = await add({ name: 'Tom H.', phone: '07700 900444' });
  const theirs = await add({ name: 'Tom Hale', phone: '07700 900444' }, other);
  assert.equal((await staff(`/api/customers/${a.id}/merge`, { method: 'POST', body: { otherId: a.id, keep: {} } }, jo)).status, 400);
  assert.equal((await staff(`/api/customers/${a.id}/merge`, { method: 'POST', body: { otherId: theirs.id, keep: {} } }, jo)).status, 404);
  assert.equal((await staff(`/api/customers/${a.id}/merge`, { method: 'POST', body: { otherId: b.id, keep: {} } }, jo)).status, 200);
});

test('groups: the kept record joins the other’s, and Undo takes away only what it added', async () => {
  const club = (await staff('/api/customer-groups', { method: 'POST', body: { name: 'Club members', discountPercent: 10 } })).body;
  const staffGroup = (await staff('/api/customer-groups', { method: 'POST', body: { name: 'Staff', discountPercent: 20 } })).body;
  const kept = await add({ name: 'Ruth Bell', phone: '07700 900777', groupIds: [staffGroup.id] });
  const gone = await add({ name: 'Ruth B.', phone: '07700 900777', groupIds: [club.id, staffGroup.id] });
  const groupsOf = async (id) => (await staff(`/api/customers/${id}`)).body.groups.map((g) => g.name).sort();
  const merged = (await staff(`/api/customers/${kept.id}/merge`, { method: 'POST', body: { otherId: gone.id, keep: {} } })).body;
  assert.deepEqual(await groupsOf(kept.id), ['Club members', 'Staff']);
  assert.equal((await staff(`/api/customer-merges/${merged.id}/undo`, { method: 'POST', body: {} })).status, 200);
  assert.deepEqual(await groupsOf(kept.id), ['Staff'], 'her own group stays');
  assert.deepEqual(await groupsOf(gone.id), ['Club members', 'Staff']);
});

test('an order moves with a merge; one made for the hidden record later moves at its removal, and nothing breaks (review)', async () => {
  const kept = await add({ name: 'Ian Moss', phone: '07700 900611' });
  const gone = await add({ name: 'I. Moss', phone: '07700 900611' });
  const order = (who) => inShop(async () => (await prepare("INSERT INTO sale_documents (kind, status, customer_id, subtotal, total) VALUES ('order', 'open', ?, 0, 0) RETURNING id").get(who)).id);
  const before = { id: await order(gone.id) };
  const merged = (await staff(`/api/customers/${kept.id}/merge`, { method: 'POST', body: { otherId: gone.id, keep: {} } })).body;
  assert.equal(await ownerOf('sale_documents', before.id), kept.id, 'the order moved');
  // An offline till's sale, synced after the merge, still names the hidden record.
  const late = await order(gone.id);
  await inShop(() => prepare("UPDATE customer_merges SET merged_at = now() - interval '31 days' WHERE id = ?").run(merged.id));
  const res = await staff(`/api/customers/${kept.id}/merges`);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(await ownerOf('sale_documents', late), kept.id, 'the late one moved to the kept record');
  assert.equal(await inShop(() => prepare('SELECT 1 FROM customers WHERE id = ?').get(gone.id)), undefined, 'and the hidden record is gone');
});

test('Undo is refused once the kept record has itself been merged into another (review)', async () => {
  const a = await add({ name: 'Ann Lee', phone: '07700 900612' });
  const b = await add({ name: 'A. Lee', phone: '07700 900612' });
  const c = await add({ name: 'Annie Lee', phone: '07700 900612' });
  const first = (await staff(`/api/customers/${b.id}/merge`, { method: 'POST', body: { otherId: a.id, keep: {} } })).body;
  assert.equal((await staff(`/api/customers/${c.id}/merge`, { method: 'POST', body: { otherId: b.id, keep: {} } })).status, 200);
  const res = await staff(`/api/customer-merges/${first.id}/undo`, { method: 'POST', body: {} });
  assert.equal(res.status, 409, JSON.stringify(res.body));
  assert.equal(res.body.code, 'kept_merged');
});

// The fresh review's findings.
const merge = async (keptId, otherId, keep = {}) => (await staff(`/api/customers/${keptId}/merge`, { method: 'POST', body: { otherId, keep } })).body;
const undo = (mergeId, who = owner) => staff(`/api/customer-merges/${mergeId}/undo`, { method: 'POST', body: {} }, who);
const age = (mergeId) => inShop(() => prepare("UPDATE customer_merges SET merged_at = now() - interval '31 days' WHERE id = ?").run(mergeId));
const customer = (id) => inShop(() => prepare('SELECT * FROM customers WHERE id = ?').get(id));

test('an older merge can’t be undone while a later one into the same record stands (fresh review)', async () => {
  const k = await add({ name: 'Rory Hale', phone: '07700 900621' });
  const o1 = await add({ name: 'R. Hale', phone: '07700 900622' });
  const o2 = await add({ name: 'Rory H', phone: '07700 900621' });
  const first = await merge(k.id, o1.id, { phone: 'other' });
  const second = await merge(k.id, o2.id, { name: 'other' });
  const res = await undo(first.id);
  assert.equal(res.status, 409, JSON.stringify(res.body));
  assert.equal(res.body.code, 'later_merge');
  assert.equal((await undo(second.id)).status, 200);
  assert.equal((await undo(first.id)).status, 200);
  const back = await customer(k.id);
  assert.deepEqual([back.name, back.phone], ['Rory Hale', '07700 900621']);
});

test('Undo keeps a change made to the kept record after the merge (fresh review)', async () => {
  const k = await add({ name: 'Tess Bell', phone: '07700 900623', email: 'tess@example.com' });
  const o = await add({ name: 'T. Bell', phone: '07700 900623', email: 'tb@example.com', notes: 'Likes texts' });
  const m = await merge(k.id, o.id, { name: 'other', notes: 'other' });
  assert.equal((await staff(`/api/customers/${k.id}`, { method: 'PUT', body: { email: 'tess.bell@example.com', notes: 'Calls first' } })).status, 200);
  assert.equal((await undo(m.id)).status, 200);
  const back = await customer(k.id);
  assert.equal(back.email, 'tess.bell@example.com', 'the email corrected after the merge stays');
  assert.equal(back.notes, 'Calls first', 'a note changed after the merge stays');
  assert.equal(back.name, 'Tess Bell', 'the name the merge chose goes back');
});

test('two chained merges expiring together are both removed, and both merge records stay (fresh review)', async () => {
  const a = await add({ name: 'Ada Webb', phone: '07700 900624' });
  const b = await add({ name: 'A. Webb', phone: '07700 900624' });
  const c = await add({ name: 'Ada W', phone: '07700 900624' });
  const ab = await merge(b.id, a.id);
  const bc = await merge(c.id, b.id);
  // Newer first in id order would be the trouble case, so make the later merge the older-looking id.
  await age(bc.id); await age(ab.id);
  await inShop(() => prepare("UPDATE customer_merges SET merged_at = merged_at - interval '1 minute' WHERE id = ?").run(ab.id));
  assert.equal((await staff(`/api/customers/${c.id}/merges`)).status, 200);
  assert.equal(await customer(a.id), undefined, 'A removed');
  assert.equal(await customer(b.id), undefined, 'B removed');
  const kept = await inShop(() => prepare('SELECT count(*)::int AS n FROM customer_merges WHERE id IN (?, ?)').get(ab.id, bc.id));
  assert.equal(kept.n, 2, 'both merge records stay');
});

test('Undo is refused after 30 days even when the removal couldn’t run (fresh review)', async () => {
  const k = await add({ name: 'Ivo Grant', phone: '07700 900625' });
  const o = await add({ name: 'I. Grant', phone: '07700 900625' });
  const m = await merge(k.id, o.id);
  // Another shop's online account somehow naming the hidden record stops its removal.
  await inShop(() => prepare("INSERT INTO customer_logins (shop_id, customer_id, email, password_hash) VALUES (?, ?, ?, 'x')").run(other.shop.id, o.id, `ivo-${o.id}@example.com`), other.shop.id);
  try {
    await age(m.id);
    assert.deepEqual((await staff(`/api/customers/${k.id}/merges`)).body, [], 'no Undo line');
    const res = await undo(m.id);
    assert.equal(res.status, 409);
    assert.equal(res.body.code, 'not_undoable');
  } finally {
    await inShop(() => prepare('DELETE FROM customer_logins WHERE customer_id = ?').run(o.id), other.shop.id);
  }
});

test('a hidden record can’t be switched back on by hand (fresh review)', async () => {
  const k = await add({ name: 'Nell Ross', phone: '07700 900626' });
  const o = await add({ name: 'N. Ross', phone: '07700 900626' });
  await merge(k.id, o.id);
  const res = await staff(`/api/customers/${o.id}`, { method: 'PUT', body: { active: true } });
  assert.equal(res.status, 409, JSON.stringify(res.body));
  assert.equal((await customer(o.id)).active, 0);
});

test('a kept record switched off the ordinary way: Undo refused, saying so (fresh review)', async () => {
  const k = await add({ name: 'Cal Moore', phone: '07700 900627' });
  const o = await add({ name: 'C. Moore', phone: '07700 900627' });
  const m = await merge(k.id, o.id);
  assert.equal((await staff(`/api/customers/${k.id}`, { method: 'PUT', body: { active: false } })).status, 200);
  const res = await undo(m.id);
  assert.equal(res.status, 409);
  assert.equal(res.body.code, 'kept_removed');
});

test('another shop can’t undo a merge (fresh review)', async () => {
  const k = await add({ name: 'Bea Lane', phone: '07700 900628' });
  const o = await add({ name: 'B. Lane', phone: '07700 900628' });
  const m = await merge(k.id, o.id);
  assert.equal((await undo(m.id, other)).status, 404);
  assert.equal((await customer(o.id)).active, 0);
});

test('Undo moves an online account and an order back (fresh review)', async () => {
  const k = await add({ name: 'Joy Park', phone: '07700 900629' });
  const o = await add({ name: 'J. Park', phone: '07700 900629' });
  const login = await inShop(async () => (await prepare("INSERT INTO customer_logins (shop_id, customer_id, email, password_hash) VALUES (?, ?, ?, 'x') RETURNING id").get(owner.shop.id, o.id, `joy-${o.id}@example.com`)).id);
  const order = await inShop(async () => (await prepare("INSERT INTO sale_documents (kind, status, customer_id, subtotal, total) VALUES ('order', 'open', ?, 0, 0) RETURNING id").get(o.id)).id);
  const m = await merge(k.id, o.id);
  assert.equal((await undo(m.id)).status, 200);
  assert.equal(await ownerOf('customer_logins', login), o.id);
  assert.equal(await ownerOf('sale_documents', order), o.id);
});

test('a till: its sales and problems move with a merge and back with Undo; afterwards, before and after removal, it finds the kept record (fresh review)', async () => {
  const till = await registerTill(server.baseUrl, owner, { siteCode: 'M', number: 7 });
  const sync = async (items) => (await tillRequest(server.baseUrl, owner.shop.slug, till.token, '/sync', { method: 'POST', body: { pendingCount: 0, items } })).body.results;
  const tube = await seedProduct(owner.shop.id);
  let receipt = 7000;
  const sale = (extra) => ({
    kind: 'sale', clientId: randomUUID(), receiptNumber: ++receipt, tillClockAt: '2026-09-01T09:30:00.000Z', madeOffline: true, employeeId: cashierId,
    lines: [{ productId: tube, description: 'Inner tube', qty: 1, unitPricePence: 699, vatRateBp: 2000 }], payments: [{ method: 'cash', amountPence: 699 }], ...extra,
  });
  const saleOwner = async (clientId) => (await inShop(() => prepare('SELECT customer_id FROM till_sales WHERE client_id = ?').get(clientId))).customer_id;
  const k = await add({ name: 'Uma Shah', phone: '07700 900630' });
  const offline = { kind: 'customer', clientId: randomUUID(), name: 'Uma S', phone: '07700 900630' };
  const first = sale({ customerClientId: offline.clientId });
  await sync([offline, first]);
  const o = await inShop(() => prepare('SELECT id FROM customers WHERE client_id = ?').get(offline.clientId));
  const problem = await inShop(() => prepare('SELECT id FROM till_attention WHERE customer_id = ?').get(o.id));
  assert.ok(problem, 'the till flagged the possible duplicate');
  const m = await merge(k.id, o.id);
  assert.equal(await saleOwner(first.clientId), k.id, 'the till sale moved');
  assert.equal(await ownerOf('till_attention', problem.id), k.id, 'the till problem moved');
  assert.equal((await undo(m.id)).status, 200);
  assert.equal(await saleOwner(first.clientId), o.id, 'and back');
  assert.equal(await ownerOf('till_attention', problem.id), o.id);
  const again = await merge(k.id, o.id);
  const whileHidden = sale({ customerClientId: offline.clientId });
  const byId = sale({ customerId: o.id });
  await sync([whileHidden, byId]);
  assert.equal(await saleOwner(whileHidden.clientId), k.id, 'a sale for the hidden record, by the till’s id, goes to the kept one');
  assert.equal(await saleOwner(byId.clientId), k.id, 'and by its number');
  await age(again.id);
  await staff(`/api/customers/${k.id}/merges`);
  assert.equal(await customer(o.id), undefined, 'removed');
  const afterRemoval = sale({ customerClientId: offline.clientId });
  const afterById = sale({ customerId: o.id });
  const results = await sync([offline, afterRemoval, afterById]);
  assert.equal(results[0].status, 'duplicate', 'the customer sent again isn’t made again');
  assert.deepEqual(results[1].attention, [], 'no unknown customer');
  assert.equal(await saleOwner(afterRemoval.clientId), k.id);
  assert.equal(await saleOwner(afterById.clientId), k.id);
  const remade = await inShop(() => prepare('SELECT count(*)::int AS n FROM customers WHERE client_id = ?').get(offline.clientId));
  assert.equal(remade.n, 0);
});

test('a chain whose first removal is held up: the middle record goes, and the first still lands on the record kept (review 3)', async () => {
  const a = await add({ name: 'Eli Ward', phone: '07700 900631' });
  const b = await add({ name: 'E. Ward', phone: '07700 900631' });
  const c = await add({ name: 'Eli W', phone: '07700 900631' });
  const order = await inShop(async () => (await prepare("INSERT INTO sale_documents (kind, status, customer_id, subtotal, total) VALUES ('order', 'open', ?, 0, 0) RETURNING id").get(a.id)).id);
  const ab = await merge(b.id, a.id);
  const bc = await merge(c.id, b.id);
  await age(ab.id); await age(bc.id);
  await inShop(() => prepare("UPDATE customer_merges SET merged_at = merged_at - interval '1 minute' WHERE id = ?").run(ab.id));
  // Another shop's online account naming A holds up A's removal, but not B's.
  await inShop(() => prepare("INSERT INTO customer_logins (shop_id, customer_id, email, password_hash) VALUES (?, ?, ?, 'x')").run(other.shop.id, a.id, `eli-${a.id}@example.com`), other.shop.id);
  try {
    await staff(`/api/customers/${c.id}/merges`);
    assert.equal(await customer(b.id), undefined, 'B removed');
    assert.equal((await customer(a.id)).merged_into_id, c.id, 'A now points at C');
  } finally {
    await inShop(() => prepare('DELETE FROM customer_logins WHERE customer_id = ?').run(a.id), other.shop.id);
  }
  await staff(`/api/customers/${c.id}/merges`);
  assert.equal(await customer(a.id), undefined, 'A removed');
  assert.equal(await ownerOf('sale_documents', order), c.id, 'its order on the record kept');
  const rec = await inShop(() => prepare('SELECT kept_id FROM customer_merges WHERE id = ?').get(ab.id));
  assert.equal(rec.kept_id, c.id);
});

test('a till sale for a hidden record goes back with Undo, through each merge in turn (review 3)', async () => {
  const till = await registerTill(server.baseUrl, owner, { siteCode: 'M', number: 8 });
  const tube = await seedProduct(owner.shop.id);
  const sale = { kind: 'sale', clientId: randomUUID(), receiptNumber: 8001, tillClockAt: '2026-09-01T09:30:00.000Z', madeOffline: true, employeeId: cashierId,
    lines: [{ productId: tube, description: 'Inner tube', qty: 1, unitPricePence: 699, vatRateBp: 2000 }], payments: [{ method: 'cash', amountPence: 699 }] };
  const offline = { kind: 'customer', clientId: randomUUID(), name: 'Pia Cole', phone: '07700 900632' };
  await tillRequest(server.baseUrl, owner.shop.slug, till.token, '/sync', { method: 'POST', body: { pendingCount: 0, items: [offline] } });
  const a = await inShop(() => prepare('SELECT id FROM customers WHERE client_id = ?').get(offline.clientId));
  const b = await add({ name: 'P. Cole', phone: '07700 900632' });
  const c = await add({ name: 'Pia C', phone: '07700 900632' });
  const ab = await merge(b.id, a.id);
  const bc = await merge(c.id, b.id);
  await tillRequest(server.baseUrl, owner.shop.slug, till.token, '/sync', { method: 'POST', body: { pendingCount: 0, items: [{ ...sale, customerClientId: offline.clientId }] } });
  const ownerNow = async () => (await inShop(() => prepare('SELECT customer_id FROM till_sales WHERE client_id = ?').get(sale.clientId))).customer_id;
  assert.equal(await ownerNow(), c.id, 'on the record kept');
  assert.equal((await undo(bc.id)).status, 200);
  assert.equal(await ownerNow(), b.id, 'back a step');
  assert.equal((await undo(ab.id)).status, 200);
  assert.equal(await ownerNow(), a.id, 'back to the customer the till meant');
});

// Review of customer-sale-dialog: the other record's sales count reads both
// sales records, as her own history now does.
test('a possible duplicate’s sales count includes till sales', async () => {
  const me = await add({ name: 'Tom Hall', phone: '07700 900690' });
  const twin = await add({ name: 'T. Hall', phone: '07700 900690' });
  await inShop(async () => {
    const site = await prepare("INSERT INTO sites (name, code) VALUES ('Bolton', 'B') RETURNING id").get();
    const till = await prepare('INSERT INTO tills (site_id, code, name, token_hash) VALUES (?, ?, ?, ?) RETURNING id').get(site.id, 'B1', 'Till 1', randomUUID());
    await prepare(
      `INSERT INTO till_sales (client_id, till_id, site_id, receipt_number, made_offline, till_clock_at, received_at, total_pence, vat_pence, customer_id)
       VALUES (?, ?, ?, 3, false, now(), now(), 500, 83, ?)`
    ).run(randomUUID(), till.id, site.id, twin.id);
  });
  const found = (await dups(me.id)).find((d) => d.id === twin.id);
  assert.equal(found.sales, 1);
});

// The review of 26 Oct (customer-account-server, option 2): a merge that gives
// the kept record the other's email gives it an email staff may have typed,
// so the "customer's own email" mark goes; Undo puts it back.
const ownEmail = async (id) => (await inShop(() => prepare('SELECT email_from_customer AS f FROM customers WHERE id = ?').get(id))).f;
test('taking the other record’s email in a merge unmarks it as the customer’s own; keeping it, or Undo, leaves the mark', async () => {
  const kept = await add({ name: 'Priya Nair', phone: '07700 900650', email: 'priya@example.test' });
  const other = await add({ name: 'Priya Nair', phone: '07700 900650', email: 'someone.else@example.test' });
  await inShop(() => prepare('UPDATE customers SET email_from_customer = true WHERE id = ?').run(kept.id));
  const merged = (await staff(`/api/customers/${kept.id}/merge`, { method: 'POST', body: { otherId: other.id, keep: { email: 'other' } } })).body;
  assert.equal(await ownEmail(kept.id), false, 'the email staff may have typed isn’t joinable');
  assert.equal((await staff(`/api/customer-merges/${merged.id}/undo`, { method: 'POST', body: {} })).status, 200);
  assert.equal(await ownEmail(kept.id), true, 'Undo puts the mark back');

  const again = await add({ name: 'Priya Nair', phone: '07700 900650', email: 'third@example.test' });
  await staff(`/api/customers/${kept.id}/merge`, { method: 'POST', body: { otherId: again.id, keep: { email: 'this' } } });
  assert.equal(await ownEmail(kept.id), true, 'keeping her own email keeps the mark');
});

// Review of own-messages-server, finding 1: a customer who stopped one of the
// shop's own messages keeps that stop when merged; Undo takes back only what
// the merge added.
test('a stop on one of the shop’s own messages moves with a merge, and Undo takes it back', async () => {
  const kept = await add({ name: 'Ravi Shah', phone: '07700 900660' });
  const other = await add({ name: 'Ravi Shah', phone: '07700 900660' });
  const stops = (id) => inShop(async () => (await prepare('SELECT shop_message_id AS m FROM shop_message_stops WHERE customer_id = ? ORDER BY 1').all(id)).map((r) => r.m));
  const { id: msg } = await inShop(() => prepare("INSERT INTO shop_messages (name, send_when, amount, unit, by_text, by_email, wording) VALUES ('Spring check', 'after_collected', 6, 'months', true, false, 'Hi') RETURNING id").get());
  await inShop(() => prepare('INSERT INTO shop_message_stops (shop_message_id, customer_id) VALUES (?, ?) RETURNING customer_id').get(msg, other.id));
  const merged = await merge(kept.id, other.id);
  assert.deepEqual(await stops(kept.id), [msg], 'the stop went with her');
  assert.equal((await undo(merged.id)).status, 200);
  assert.deepEqual(await stops(kept.id), [], 'Undo takes back what the merge added');
});
