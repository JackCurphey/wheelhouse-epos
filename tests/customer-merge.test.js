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
  n += 1;
  return { c, bike, job, sale, msg };
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
  for (const [table, id] of [['customer_bikes', gone.bike], ['workshop_jobs', gone.job.id], ['sales', gone.sale.id], ['customer_messages', gone.msg]]) {
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
  for (const [table, id] of [['customer_bikes', gone.bike], ['workshop_jobs', gone.job.id], ['sales', gone.sale.id], ['customer_messages', gone.msg]]) {
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
