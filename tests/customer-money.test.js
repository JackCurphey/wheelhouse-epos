// Store credit, pay-later accounts and the Ways to pay switches, server (openspec/changes/
// finish-customers, design 1, 2 and 4; cs-credit, cs-account, set-pay-ways; customer service
// decisions 6 and 10; Jack's 9 Nov answers). Amounts in whole pence. Real example data from
// the drawings: Maya Patel, Jo Taylor, Jack Lewis; everything else a bracketed placeholder.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let owner;
let other;
let jo;
before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  other = await staffSignup(server.baseUrl, { shopName: '[Other shop]' });
  const made = await staffRequest(server.baseUrl, owner.cookie, '/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `jo-${randomUUID().slice(0, 8)}@example.test`, password: 'password123' } });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  jo = await staffFreshCookie(made.body.loginId);
});
after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (other) await deleteTestShop(other.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const asOwner = (path, options) => staffRequest(server.baseUrl, owner.cookie, path, options);
const asJo = (path, options) => staffRequest(server.baseUrl, jo, path, options);
const asOther = (path, options) => staffRequest(server.baseUrl, other.cookie, path, options);
const post = (as, path, body) => as(path, { method: 'POST', body });
const put = (as, path, body) => as(path, { method: 'PUT', body });

const maya = async (name = 'Maya Patel', as = asOwner) => {
  const res = await post(as, '/api/customers', { name, email: 'maya@example.test' });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body.id;
};
const switches = (body) => put(asOwner, '/api/payment-settings', body);
const credit = async (id) => (await asOwner(`/api/customers/${id}`)).body.money.credit;
const give = (id, pence, reason = '[reason]', as = asJo) => post(as, `/api/customers/${id}/store-credit`, { change: 'add', pence, reason });
const take = (id, pence, reason = '[reason]', as = asJo) => post(as, `/api/customers/${id}/store-credit`, { change: 'take', pence, reason });

test('payment settings are made the first time they are read, both off, and only the Owner changes them', async () => {
  const shop = await staffSignup(server.baseUrl, { shopName: '[Fresh shop]' });
  try {
    const first = await staffRequest(server.baseUrl, shop.cookie, '/api/payment-settings');
    assert.equal(first.status, 200);
    assert.deepEqual(first.body, { storeCreditOn: false, accountsOn: false, accountLimitPence: null });
  } finally {
    await deleteTestShop(shop.shop.id);
  }
  const refused = await put(asJo, '/api/payment-settings', { storeCreditOn: true });
  assert.equal(refused.status, 403);
  const saved = await switches({ storeCreditOn: true, accountsOn: true, accountLimitPence: 25000 });
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  assert.deepEqual(saved.body, { storeCreditOn: true, accountsOn: true, accountLimitPence: 25000 });
  // Each saves as he goes: one field changes only itself.
  assert.deepEqual((await switches({ accountsOn: false })).body, { storeCreditOn: true, accountsOn: false, accountLimitPence: 25000 });
  assert.equal((await switches({ accountLimitPence: -1 })).status, 400);
  assert.equal((await switches({ storeCreditOn: 'yes' })).status, 400);
  assert.deepEqual((await asJo('/api/payment-settings')).body, { storeCreditOn: true, accountsOn: false, accountLimitPence: 25000 });
});

test('the customer shows only the money switched on', async () => {
  const id = await maya();
  await switches({ storeCreditOn: false, accountsOn: false });
  assert.deepEqual((await asJo(`/api/customers/${id}`)).body.money, { storeCreditOn: false, accountsOn: false });
  await switches({ storeCreditOn: true });
  assert.deepEqual((await asJo(`/api/customers/${id}`)).body.money, { storeCreditOn: true, accountsOn: false, credit: 0 });
});

test('staff add and take store credit with a reason, in pence; the balance is the sum', async () => {
  await switches({ storeCreditOn: true });
  const id = await maya();
  const added = await give(id, 1500, '[reason 1]');
  assert.equal(added.status, 201, JSON.stringify(added.body));
  assert.equal(added.body.credit, 1500);
  assert.equal((await take(id, 400, '[reason 2]')).body.credit, 1100);
  assert.equal(await credit(id), 1100);
  const entries = (await asJo(`/api/customers/${id}/store-credit`)).body;
  assert.deepEqual(entries.entries.map((e) => [e.kind, e.changePence, e.reason, e.by]), [
    ['taken', -400, '[reason 2]', 'Jo Taylor'],
    ['added', 1500, '[reason 1]', 'Jo Taylor'],
  ]);
  assert.equal(entries.credit, 1100);
});

test('refused: no reason, not a sensible amount, more than she holds, or switched off', async () => {
  await switches({ storeCreditOn: true });
  const id = await maya();
  await give(id, 500);
  const noReason = await give(id, 500, '  ');
  assert.equal(noReason.status, 400);
  assert.match(noReason.body.error, /reason/i);
  for (const pence of [0, -5, 1.5, '500', null, 10_000_000_000]) {
    const bad = await give(id, pence);
    assert.equal(bad.status, 400, `refused ${pence}`);
    assert.equal(bad.body.error, 'Pounds and pence, like 5.00');
  }
  assert.equal((await post(asJo, `/api/customers/${id}/store-credit`, { change: 'gift', pence: 5, reason: 'x' })).status, 400);
  const tooMuch = await take(id, 501);
  assert.equal(tooMuch.status, 409);
  assert.equal(tooMuch.body.error, 'Maya Patel has only £5.00');
  assert.equal(await credit(id), 500);
  await switches({ storeCreditOn: false });
  const off = await give(id, 100);
  assert.equal(off.status, 409);
  await switches({ storeCreditOn: true });
  assert.equal(await credit(id), 500, 'kept while switched off');
});

test('two takes at once never take her below zero', async () => {
  await switches({ storeCreditOn: true });
  const id = await maya();
  await give(id, 1000);
  // Eight at once, so without the customer's lock some would read the same balance.
  const all = await Promise.all(Array.from({ length: 8 }, () => take(id, 300)));
  assert.deepEqual(all.map((r) => r.status).sort(), [201, 201, 201, 409, 409, 409, 409, 409]);
  assert.equal(await credit(id), 100);
});

test('the Owner undoes a change with a reason, kept as its own entry; staff can’t', async () => {
  await switches({ storeCreditOn: true });
  const id = await maya();
  await give(id, 800);
  const wrong = (await give(id, 2000)).body.entry;
  assert.equal((await post(asJo, `/api/store-credit-entries/${wrong.id}/undo`, { reason: '[reason]' })).status, 403);
  assert.equal((await post(asOwner, `/api/store-credit-entries/${wrong.id}/undo`, { reason: '' })).status, 400);
  const undone = await post(asOwner, `/api/store-credit-entries/${wrong.id}/undo`, { reason: '[reason]' });
  assert.equal(undone.status, 201, JSON.stringify(undone.body));
  assert.equal(undone.body.credit, 800);
  assert.equal((await post(asOwner, `/api/store-credit-entries/${wrong.id}/undo`, { reason: '[reason]' })).status, 409, 'once only');
  const entries = (await asOwner(`/api/customers/${id}/store-credit`)).body.entries;
  assert.deepEqual(entries.map((e) => [e.kind, e.changePence, e.undone]), [['undo', -2000, false], ['added', 2000, true], ['added', 800, false]]);
  // Undoing an addition she has since spent would take her below zero.
  const spentLater = (await give(id, 500)).body.entry;
  await take(id, 1300);
  const below = await post(asOwner, `/api/store-credit-entries/${spentLater.id}/undo`, { reason: '[reason]' });
  assert.equal(below.status, 409);
});

test('store credit rows in the customer’s history', async () => {
  await switches({ storeCreditOn: true });
  const id = await maya();
  await give(id, 1500, '[reason 1]');
  await take(id, 500, '[reason 2]');
  const items = (await asJo(`/api/customers/${id}/history`)).body.items.filter((i) => i.kind === 'store_credit');
  assert.deepEqual(items.map((i) => [i.change, i.changePence, i.reason, i.by]), [['taken', -500, '[reason 2]', 'Jo Taylor'], ['added', 1500, '[reason 1]', 'Jo Taylor']]);
  await switches({ storeCreditOn: false });
  assert.equal((await asJo(`/api/customers/${id}/history`)).body.items.filter((i) => i.kind === 'store_credit').length, 0, 'hidden while off');
  await switches({ storeCreditOn: true });
});

test('another business’s customer and entries are a 404', async () => {
  await switches({ storeCreditOn: true });
  const id = await maya();
  const entry = (await give(id, 500)).body.entry;
  await staffRequest(server.baseUrl, other.cookie, '/api/payment-settings', { method: 'PUT', body: { storeCreditOn: true } });
  assert.equal((await post(asOther, `/api/customers/${id}/store-credit`, { change: 'add', pence: 5, reason: 'x' })).status, 404);
  assert.equal((await asOther(`/api/customers/${id}/store-credit`)).status, 404);
  assert.equal((await post(asOther, `/api/store-credit-entries/${entry.id}/undo`, { reason: 'x' })).status, 404);
  assert.equal(await credit(id), 500);
});

test('merging moves store credit to the record kept, and undoing moves it back', async () => {
  await switches({ storeCreditOn: true });
  const kept = await maya('Maya Patel');
  const gone = await maya('Maya P.');
  await give(kept, 300);
  await give(gone, 1200);
  const merged = await post(asOwner, `/api/customers/${kept}/merge`, { otherId: gone, keep: {} });
  assert.equal(merged.status, 200, JSON.stringify(merged.body));
  assert.equal(await credit(kept), 1500);
  const undo = await post(asOwner, `/api/customer-merges/${merged.body.id}/undo`, {});
  assert.equal(undo.status, 200, JSON.stringify(undo.body));
  assert.equal(await credit(kept), 300);
  assert.equal(await credit(gone), 1200);
  // Nothing is left pointing at the wrong record.
  const owners = await runWithShop(owner.shop.id, () => prepare('SELECT customer_id, sum(change_pence)::int AS s FROM store_credit_entries WHERE customer_id = ANY(?::int[]) GROUP BY customer_id ORDER BY customer_id').all([kept, gone]));
  assert.deepEqual(owners.map((r) => [r.customer_id, r.s]), [[kept, 300], [gone, 1200]]);
});

test('a merge whose store credit has since been spent can’t be undone, so nobody goes below nothing', async () => {
  await switches({ storeCreditOn: true });
  const kept = await maya('Maya Patel');
  const gone = await maya('Maya P.');
  await give(gone, 1200);
  const merged = (await post(asOwner, `/api/customers/${kept}/merge`, { otherId: gone, keep: {} })).body;
  await take(kept, 1000);
  const undo = await post(asOwner, `/api/customer-merges/${merged.id}/undo`, {});
  assert.equal(undo.status, 409);
  assert.equal(undo.body.code, 'money_used');
  assert.equal(await credit(kept), 200, 'still merged, nothing moved');
});
