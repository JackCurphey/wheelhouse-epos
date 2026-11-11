// When "Close the day" shows (openspec/changes/owner-setup-till-payments-eod
// design 3; cash-up decision 5; owner setup decision 18; set-eod-close,
// eod-entry): at closing time, 30 minutes before or 1 hour before, as the shop
// chose; all day when the opening hours say the shop is shut today; never once
// the day is closed. The live server's clock is pinned to 07:00 on Tuesday
// 1 Sep 2026 in London.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { entryFor } from '../server/lib/close-entry.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

const HOURS = { open: '09:00', close: '17:30' };
const at = (h, m) => h * 60 + m;

test('1 hour before: from 16:30 for a 17:30 close', () => {
  assert.deepEqual(entryFor(HOURS, at(16, 29), false, 60), { show: false, closesAt: '17:30' });
  assert.deepEqual(entryFor(HOURS, at(16, 30), false, 60), { show: true, closesAt: '17:30' });
  assert.deepEqual(entryFor(HOURS, at(16, 45), false, 60), { show: true, closesAt: '17:30' });
});

test('30 minutes before: from 17:00, not at 16:45', () => {
  assert.deepEqual(entryFor(HOURS, at(16, 45), false, 30), { show: false, closesAt: '17:30' });
  assert.deepEqual(entryFor(HOURS, at(16, 59), false, 30), { show: false, closesAt: '17:30' });
  assert.deepEqual(entryFor(HOURS, at(17, 0), false, 30), { show: true, closesAt: '17:30' });
});

test('at closing time: from 17:30, not during the day', () => {
  assert.deepEqual(entryFor(HOURS, at(11, 0), false, 0), { show: false, closesAt: '17:30' });
  assert.deepEqual(entryFor(HOURS, at(17, 29), false, 0), { show: false, closesAt: '17:30' });
  assert.deepEqual(entryFor(HOURS, at(17, 30), false, 0), { show: true, closesAt: '17:30' });
});

test('the shop’s choice must be given: no caller gets the old fixed hour by accident', () => {
  for (const before of [undefined, null, 45, '30']) assert.throws(() => entryFor(HOURS, at(17, 0), false, before), /0, 30 or 60/, String(before));
});

test('shut today means all day, whatever the shop chose; closed means not shown', () => {
  for (const before of [0, 30, 60]) {
    assert.deepEqual(entryFor(null, at(7, 0), false, before), { show: true, closesAt: null });
    assert.deepEqual(entryFor(null, at(7, 0), true, before), { show: false, closesAt: null });
    assert.deepEqual(entryFor(HOURS, at(23, 0), true, before), { show: false, closesAt: '17:30' });
  }
});

// The till reads the shop's own choice, on the pinned Tuesday at 07:00.
let server;
const shops = [];
before(async () => {
  server = await startLiveServer();
});
after(async () => {
  for (const s of shops) await deleteTestShop(s.shop.id);
  if (server) await server.stop();
});

test('the till shows Close the day from the shop’s chosen time', async () => {
  const owner = await staffSignup(server.baseUrl, { shopName: 'North Street Cycles', ownerName: 'Jack Lewis' });
  shops.push(owner);
  const call = (path, options) => staffRequest(server.baseUrl, owner.cookie, path, options);
  const closing = async (close) => {
    const res = await call('/api/workshop-settings', { method: 'PUT', body: { openingHours: [{ weekday: 2, open: '06:00', close }] } });
    assert.equal(res.status, 200, JSON.stringify(res.body));
  };
  const choose = async (closeEntryMinutes) => assert.equal((await call('/api/end-of-day-settings', { method: 'PUT', body: { closeEntryMinutes } })).status, 200);
  const entry = async () => {
    const res = await call('/api/close-the-day');
    assert.equal(res.status, 200, JSON.stringify(res.body));
    return res.body.entry;
  };
  // Closing at 08:00 (opening hours are on the hour): a new shop starts on
  // 30 minutes before, so not yet; an hour before shows it; at closing time doesn't.
  await closing('08:00');
  assert.deepEqual(await entry(), { show: false, closesAt: '08:00' });
  await choose(60);
  assert.deepEqual(await entry(), { show: true, closesAt: '08:00' });
  await choose(0);
  assert.deepEqual(await entry(), { show: false, closesAt: '08:00' });
  // Closing at 07:00: at closing time shows it.
  await closing('07:00');
  assert.deepEqual(await entry(), { show: true, closesAt: '07:00' });
});
