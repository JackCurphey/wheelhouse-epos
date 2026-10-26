// The shop's deposit settings (bk-settings-deposits; Jack, 24 Oct answers
// 1–5; openspec/changes/deposit-settings design 1–3).
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let unconnected;
let owner;
let other;

before(async () => {
  server = await startLiveServer();
  unconnected = await startLiveServer({ env: { PAYMENTS_PROVIDER: 'none' } });
  owner = await staffSignup(server.baseUrl, { shopName: 'Deposit Cycles' });
  other = await staffSignup(unconnected.baseUrl, { shopName: 'No Provider Cycles' });
});
after(async () => {
  for (const s of [owner, other]) if (s) await deleteTestShop(s.shop.id);
  for (const s of [server, unconnected]) if (s) await s.stop();
  await pool.end();
});

const put = (body, who = owner, at = server) => staffRequest(at.baseUrl, who.cookie, '/api/workshop-settings', { method: 'PUT', body });
const get = async (who = owner, at = server) => (await staffRequest(at.baseUrl, who.cookie, '/api/workshop-settings')).body;

test('off to start, a percentage, free to cancel until 24 hours before, with the pretend provider connected', async () => {
  const s = await get();
  assert.deepEqual(
    [s.depositOn, s.depositKind, s.depositPercent, s.depositFixedPence, s.depositUnknownPence, s.depositCancelHours, s.paymentsConnected],
    [false, 'percent', null, null, null, 24, true],
  );
});

test('saved and read back', async () => {
  const res = await put({ depositOn: true, depositKind: 'percent', depositPercent: 20, depositUnknownPence: 1000, depositCancelHours: 48 });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const s = await get();
  assert.deepEqual([s.depositOn, s.depositPercent, s.depositUnknownPence, s.depositCancelHours], [true, 20, 1000, 48]);
  assert.equal((await put({ depositKind: 'fixed', depositFixedPence: 1500 })).status, 200);
  assert.deepEqual([(await get()).depositKind, (await get()).depositFixedPence], ['fixed', 1500]);
  assert.equal((await put({ depositUnknownPence: null })).status, 200, 'the amount for a price not known can be emptied');
  assert.equal((await get()).depositUnknownPence, null);
  await put({ depositOn: false, depositKind: 'percent' });
});

test('each value is checked', async () => {
  for (const body of [
    { depositOn: 'true' }, { depositKind: 'half' },
    { depositPercent: 0 }, { depositPercent: 101 }, { depositPercent: 12.5 }, { depositPercent: '20' },
    { depositFixedPence: 0 }, { depositFixedPence: 1_000_001 }, { depositFixedPence: 10.5 },
    { depositUnknownPence: -1 }, { depositCancelHours: -1 }, { depositCancelHours: 169 }, { depositCancelHours: null },
  ]) {
    const res = await put(body);
    assert.equal(res.status, 400, `${JSON.stringify(body)} → ${res.status}`);
  }
});

test('switched on before How much is filled in: on, and no deposit is taken until it is', async () => {
  await put({ depositOn: false, depositKind: 'percent', depositPercent: null, depositFixedPence: null });
  const res = await put({ depositOn: true });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal((await get()).depositOn, true);
  await put({ depositOn: false });
});

test('with no payment provider connected, deposits can’t be switched on', async () => {
  const s = await get(other, unconnected);
  assert.equal(s.paymentsConnected, false);
  const res = await put({ depositOn: true, depositPercent: 20 }, other, unconnected);
  assert.equal(res.status, 409, JSON.stringify(res.body));
  assert.equal(res.body.code, 'payments_not_connected');
  assert.equal((await get(other, unconnected)).depositOn, false);
});
