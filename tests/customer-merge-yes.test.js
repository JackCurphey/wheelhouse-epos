// Merging two customers keeps a yes to reminders (openspec/changes/merge-keeps-yes;
// Jack's answer 9 of 25 Oct): if either said yes, the kept record says yes,
// with when and where it was given; Undo puts the kept record's answers back.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let owner;
before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles' });
});
after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const staff = (path, options) => staffRequest(server.baseUrl, owner.cookie, path, options);
const inShop = (fn) => runWithShop(owner.shop.id, fn);
const maya = async (yes) => {
  const c = (await staff('/api/customers', { method: 'POST', body: { name: 'Maya Patel', phone: '07700 900142' } })).body;
  if (yes) {
    await inShop(() => prepare(`UPDATE customers SET service_reminders = ?, review_requests = ?, reminders_said_yes_at = ?::timestamptz, reminders_said_yes_via = ? WHERE id = ?`)
      .run(yes.service ?? true, yes.review ?? true, yes.at, yes.via, c.id));
  }
  return c;
};
const answers = (id) => inShop(() => prepare('SELECT service_reminders, review_requests, reminders_said_yes_at, reminders_said_yes_via FROM customers WHERE id = ?').get(id));
const merge = async (keptId, otherId) => {
  const res = await staff(`/api/customers/${keptId}/merge`, { method: 'POST', body: { otherId, keep: {} } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res.body.id;
};

test('a guest’s yes carries over to the kept record, with when and where it was given', async () => {
  const kept = await maya(null);
  const guest = await maya({ at: '2026-09-01T10:00:00Z', via: 'booking' });
  await merge(kept.id, guest.id);
  const a = await answers(kept.id);
  assert.equal(a.service_reminders, true);
  assert.equal(a.review_requests, true);
  assert.equal(a.reminders_said_yes_via, 'booking');
  assert.equal(a.reminders_said_yes_at.toISOString(), '2026-09-01T10:00:00.000Z');
});

test('the kept record’s own yes keeps its date and place; two noes stay no', async () => {
  const kept = await maya({ at: '2026-09-02T10:00:00Z', via: 'collection' });
  const guest = await maya({ at: '2026-09-01T10:00:00Z', via: 'booking' });
  await merge(kept.id, guest.id);
  const a = await answers(kept.id);
  assert.equal(a.reminders_said_yes_via, 'collection');
  assert.equal(a.reminders_said_yes_at.toISOString(), '2026-09-02T10:00:00.000Z');
  const k2 = await maya(null);
  const g2 = await maya(null);
  await merge(k2.id, g2.id);
  assert.deepEqual({ ...(await answers(k2.id)) }, { service_reminders: false, review_requests: false, reminders_said_yes_at: null, reminders_said_yes_via: null });
});

test('a yes to review requests alone carries over too', async () => {
  const kept = await maya(null);
  const guest = await maya({ service: false, review: true, at: '2026-09-01T10:00:00Z', via: 'booking' });
  await merge(kept.id, guest.id);
  const a = await answers(kept.id);
  assert.equal(a.service_reminders, false);
  assert.equal(a.review_requests, true);
  assert.equal(a.reminders_said_yes_via, 'booking');
});

test('Undo puts the kept record’s answers back', async () => {
  const kept = await maya(null);
  const guest = await maya({ at: '2026-09-01T10:00:00Z', via: 'booking' });
  const id = await merge(kept.id, guest.id);
  const undone = await staff(`/api/customer-merges/${id}/undo`, { method: 'POST', body: {} });
  assert.equal(undone.status, 200, JSON.stringify(undone.body));
  assert.deepEqual({ ...(await answers(kept.id)) }, { service_reminders: false, review_requests: false, reminders_said_yes_at: null, reminders_said_yes_via: null });
  assert.equal((await answers(guest.id)).service_reminders, true, 'the guest record keeps its own');
});

// The four answers go back together or not at all, so a yes never loses its
// date: once the customer has changed any of them since, Undo leaves them be.
test('Undo leaves the answers alone once the customer has changed them since', async () => {
  const kept = await maya(null);
  const guest = await maya({ at: '2026-09-01T10:00:00Z', via: 'booking' });
  const id = await merge(kept.id, guest.id);
  // Since the merge, Maya stopped service reminders; review requests still yes.
  await inShop(() => prepare('UPDATE customers SET service_reminders = false WHERE id = ?').run(kept.id));
  const undone = await staff(`/api/customer-merges/${id}/undo`, { method: 'POST', body: {} });
  assert.equal(undone.status, 200, JSON.stringify(undone.body));
  const a = await answers(kept.id);
  assert.equal(a.service_reminders, false);
  assert.equal(a.review_requests, true);
  assert.equal(a.reminders_said_yes_via, 'booking');
});

// Review: the service-reminder yes keeps the date and place it was given, even
// when the kept record said yes only to review requests.
test('a yes to service reminders keeps its own date, though the kept record said yes to reviews', async () => {
  const kept = await maya({ service: false, review: true, at: '2026-10-03T10:00:00Z', via: 'collection' });
  const guest = await maya({ at: '2026-09-01T10:00:00Z', via: 'booking' });
  await merge(kept.id, guest.id);
  const a = await answers(kept.id);
  assert.equal(a.service_reminders, true);
  assert.equal(a.reminders_said_yes_via, 'booking');
  assert.equal(a.reminders_said_yes_at.toISOString(), '2026-09-01T10:00:00.000Z');
});

// Review: a merge recorded before the answers were kept still undoes.
test('a merge recorded before the answers were kept undoes, leaving the answers be', async () => {
  const kept = await maya(null);
  const guest = await maya({ at: '2026-09-01T10:00:00Z', via: 'booking' });
  const id = await merge(kept.id, guest.id);
  await inShop(() => prepare(`UPDATE customer_merges SET moved = jsonb_set(jsonb_set(moved, '{before}', (moved->'before') - 'service_reminders' - 'review_requests' - 'reminders_said_yes_at' - 'reminders_said_yes_via'), '{after}', (moved->'after') - 'service_reminders' - 'review_requests' - 'reminders_said_yes_at' - 'reminders_said_yes_via') WHERE id = ?`).run(id));
  const undone = await staff(`/api/customer-merges/${id}/undo`, { method: 'POST', body: {} });
  assert.equal(undone.status, 200, JSON.stringify(undone.body));
  assert.equal((await answers(kept.id)).service_reminders, true, 'nothing recorded, so nothing put back');
});
