// Rename and delete with Undo on a saved report (openspec/changes/reports-your-own, design 9 to 11;
// rp-report-menu, rp-report-deleted). PATCH, DELETE and POST .../undo on /api/reports/saved/:id.
// A report that is not the person's own, or is in another shop, is not there (404) for each.
import '../server/load-env.js';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import '../server/load-env.js';
import { runWithShop, prepare, pool } from '../server/db.js';
import { createSaved, renameSaved, deleteSaved, undoSaved, listSaved, SavedNotFound } from '../server/lib/saved-reports.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, staffFreshCookie, firstShopIsBolton } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

const TAKEN = 'You already have a report with this name. Choose another name.';
let server;
let owner;
let other;
let jo;
let joLoginId;

const as = (who) => (path, options) => staffRequest(server.baseUrl, who.cookie, path, options);
const items = { name: 'x', base: 'sales', measure: 'items', split: 'product', only: [], supplier: '', period: 'this-week', shared: false };
const make = async (name) => (await as(owner)('/api/reports/saved', { method: 'POST', body: { ...items, name } })).body;
const names = async () => (await as(owner)('/api/reports/saved')).body.reports.map((r) => r.name);

before(async () => {
  server = await startLiveServer({ env: { WHEELHOUSE_TEST_CLOCK: '2026-09-17T11:00:00Z' } });
  owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  await firstShopIsBolton(owner);
  other = await staffSignup(server.baseUrl, { shopName: 'Other Cycles' });
  const made = await as(owner)('/api/team', { method: 'POST', body: { name: 'Jo Taylor', isCashier: true, email: `jo-${randomUUID().slice(0, 8)}@example.test`, password: 'password123' } });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  joLoginId = made.body.loginId;
  jo = { cookie: await staffFreshCookie(joLoginId) };
});
after(async () => {
  for (const s of [owner, other]) if (s) await deleteTestShop(s.shop.id);
  if (server) await server.stop();
  await pool.end();
});

test('Rename changes the name, keeping the choices, and refuses the two name messages', async () => {
  const a = await make('Alpha');
  const b = await make('Beta');
  const ok = await as(owner)(`/api/reports/saved/${a.id}`, { method: 'PATCH', body: { name: '  Alpha two  ' } });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(ok.body.name, 'Alpha two');
  assert.deepEqual((await names()).sort(), ['Alpha two', 'Beta']);
  const empty = await as(owner)(`/api/reports/saved/${a.id}`, { method: 'PATCH', body: { name: '  ' } });
  assert.deepEqual([empty.status, empty.body.error], [400, 'Type its name']);
  const taken = await as(owner)(`/api/reports/saved/${a.id}`, { method: 'PATCH', body: { name: 'BETA' } });
  assert.deepEqual([taken.status, taken.body.error], [400, TAKEN]);
  const same = await as(owner)(`/api/reports/saved/${b.id}`, { method: 'PATCH', body: { name: 'Beta' } });
  assert.equal(same.status, 200, 'keeping its own name is not "taken"');
  const long = await as(owner)(`/api/reports/saved/${a.id}`, { method: 'PATCH', body: { name: 'x'.repeat(81) } });
  assert.equal(long.status, 400);
});

test('Delete takes the report from the list and Undo puts it back as it was', async () => {
  const c = await make('Gamma');
  const gone = await as(owner)(`/api/reports/saved/${c.id}`, { method: 'DELETE' });
  assert.equal(gone.status, 200, JSON.stringify(gone.body));
  assert.equal(gone.body.name, 'Gamma');
  assert.ok(!(await names()).includes('Gamma'));
  const row = await runWithShop(owner.shop.id, () => prepare('SELECT deleted_at FROM saved_reports WHERE id = ?').get(c.id));
  assert.ok(row.deleted_at, 'the row is kept, with when it was deleted');
  const back = await as(owner)(`/api/reports/saved/${c.id}/undo`, { method: 'POST' });
  assert.equal(back.status, 200, JSON.stringify(back.body));
  const list = (await as(owner)('/api/reports/saved')).body.reports.find((r) => r.name === 'Gamma');
  assert.deepEqual([list.measure, list.split, list.period], ['items', 'product', 'this-week']);
});

test('Undo after the name has been used again is refused with the name message', async () => {
  const d = await make('Delta');
  await as(owner)(`/api/reports/saved/${d.id}`, { method: 'DELETE' });
  await make('delta');
  const back = await as(owner)(`/api/reports/saved/${d.id}/undo`, { method: 'POST' });
  assert.deepEqual([back.status, back.body.error], [400, TAKEN]);
  assert.equal((await names()).filter((n) => n.toLowerCase() === 'delta').length, 1);
  // Renamed while it is deleted is not possible; after Undo is refused it stays deleted.
  const stillGone = await as(owner)(`/api/reports/saved/${d.id}`, { method: 'PATCH', body: { name: 'Delta back' } });
  assert.equal(stillGone.status, 404, 'a deleted report can\'t be renamed');
});

test('a report that was never deleted can\'t be "undone", and a deleted one can\'t be deleted again', async () => {
  const e = await make('Epsilon');
  assert.equal((await as(owner)(`/api/reports/saved/${e.id}/undo`, { method: 'POST' })).status, 404);
  await as(owner)(`/api/reports/saved/${e.id}`, { method: 'DELETE' });
  assert.equal((await as(owner)(`/api/reports/saved/${e.id}`, { method: 'DELETE' })).status, 404);
});

test('another person\'s report is not there for each of them, and nor is another shop\'s', async () => {
  const f = await make('Foxtrot');
  await runWithShop(owner.shop.id, async () => {
    for (const fn of [() => renameSaved(joLoginId, f.id, 'Mine now'), () => deleteSaved(joLoginId, f.id), () => undoSaved(joLoginId, f.id)]) {
      await assert.rejects(fn, SavedNotFound);
    }
    assert.deepEqual(await listSaved(joLoginId), []);
    assert.ok(await createSaved(joLoginId, { ...items, name: 'Foxtrot' }), 'the same name is fine for another person');
  });
  for (const [method, suffix, body] of [['PATCH', '', { name: 'Stolen' }], ['DELETE', ''], ['POST', '/undo']]) {
    const res = await as(other)(`/api/reports/saved/${f.id}${suffix}`, { method, body });
    assert.equal(res.status, 404, `${method}${suffix}`);
  }
  assert.ok((await names()).includes('Foxtrot'), 'it is as it was');
});

test('only the shop\'s owner can rename, delete or undo, and an address that is not a number is not found', async () => {
  const g = await make('Golf');
  for (const [method, suffix, body] of [['PATCH', '', { name: 'Jo' }], ['DELETE', ''], ['POST', '/undo']]) {
    const res = await as(jo)(`/api/reports/saved/${g.id}${suffix}`, { method, body });
    assert.equal(res.status, 403, `${method}${suffix}`);
    assert.equal(res.body.error, "Only the shop's owner can see reports");
  }
  assert.equal((await as(owner)('/api/reports/saved/abc', { method: 'DELETE' })).status, 404);
  assert.equal((await as(owner)('/api/reports/saved/99999999', { method: 'PATCH', body: { name: 'Nope' } })).status, 404);
});

test('sharing is still refused when renaming', async () => {
  const h = await make('Hotel');
  const res = await as(owner)(`/api/reports/saved/${h.id}`, { method: 'PATCH', body: { name: 'Hotel', shared: true } });
  assert.deepEqual([res.status, res.body.error], [400, 'there are no managers until staff roles are set up']);
});

test('Undo can bring a report back under a new name when its old name has been used again', async () => {
  const i = await make('India');
  await as(owner)(`/api/reports/saved/${i.id}`, { method: 'DELETE' });
  await make('India');
  const refused = await as(owner)(`/api/reports/saved/${i.id}/undo`, { method: 'POST', body: {} });
  assert.deepEqual([refused.status, refused.body.error], [400, TAKEN]);
  const taken = await as(owner)(`/api/reports/saved/${i.id}/undo`, { method: 'POST', body: { name: 'india' } });
  assert.deepEqual([taken.status, taken.body.error], [400, TAKEN]);
  const empty = await as(owner)(`/api/reports/saved/${i.id}/undo`, { method: 'POST', body: { name: ' ' } });
  assert.deepEqual([empty.status, empty.body.error], [400, 'Type its name']);
  const back = await as(owner)(`/api/reports/saved/${i.id}/undo`, { method: 'POST', body: { name: 'India again' } });
  assert.equal(back.status, 200, JSON.stringify(back.body));
  assert.ok((await names()).includes('India again'));
});
