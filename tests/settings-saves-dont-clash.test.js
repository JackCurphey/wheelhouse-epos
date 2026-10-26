// Two saves of different settings at the same moment both stay saved
// (openspec/changes/settings-saves-dont-clash). Each route used to read the
// whole row, change one field and write the whole row back, so the later
// write put back the old value of the field the other save had just changed.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

const ROUNDS = 30;

let server;
let owner;
let otherShop;

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl);
  otherShop = await staffSignup(server.baseUrl);
});
after(async () => {
  for (const s of [owner, otherShop]) if (s) await deleteTestShop(s.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const call = (path, body, who = owner) =>
  staffRequest(server.baseUrl, who.cookie, path, body === undefined ? undefined : { method: 'PUT', body });

// Each round sets a known starting point, then sends the two saves at once and
// reads back. Returns the rounds where one of the two changes was lost.
async function lostRounds(path, reset, first, second, kept) {
  const lost = [];
  for (let i = 0; i < ROUNDS; i += 1) {
    assert.equal((await call(path, reset(i))).status, 200, 'the reset saves');
    const [a, b] = await Promise.all([call(path, first(i)), call(path, second(i))]);
    assert.equal(a.status, 200, JSON.stringify(a.body));
    assert.equal(b.status, 200, JSON.stringify(b.body));
    const stored = (await call(path)).body;
    if (!kept(stored, i)) lost.push(i);
  }
  return lost;
}

test('workshop settings: switching deposits on while How much saves keeps both', async () => {
  const theirsBefore = (await call('/api/workshop-settings', undefined, otherShop)).body;
  const lost = await lostRounds(
    '/api/workshop-settings',
    () => ({ depositOn: false, depositPercent: 10 }),
    () => ({ depositOn: true }),
    (i) => ({ depositPercent: 20 + i }),
    (s, i) => s.depositOn === true && s.depositPercent === 20 + i,
  );
  assert.deepEqual(lost, [], `a change was lost in ${lost.length} of ${ROUNDS} rounds`);
  // The other shop's settings were never touched.
  assert.deepEqual((await call('/api/workshop-settings', undefined, otherShop)).body, theirsBefore);
});

// Refusals are unchanged by the lock: a refused save writes nothing, and the
// next save goes straight through.
test('workshop settings: a refused save changes nothing, and the next save goes through', async () => {
  assert.equal((await call('/api/workshop-settings', { depositPercent: 30 })).status, 200);
  const refused = await call('/api/workshop-settings', { depositPercent: 45, blockFirst: 'nonsense' });
  assert.equal(refused.status, 400);
  assert.equal((await call('/api/workshop-settings')).body.depositPercent, 30);
  const next = await call('/api/workshop-settings', { depositPercent: 31 });
  assert.equal(next.status, 200);
  assert.equal(next.body.depositPercent, 31);
});

test('sticker labels: width and height saved at once both stay', async () => {
  const theirsBefore = (await call('/api/label-settings', undefined, otherShop)).body;
  const lost = await lostRounds(
    '/api/label-settings',
    () => ({ widthMm: 50, heightMm: 30 }),
    (i) => ({ widthMm: 60 + i }),
    (i) => ({ heightMm: 40 + i }),
    (s, i) => s.widthMm === 60 + i && s.heightMm === 40 + i,
  );
  assert.deepEqual(lost, [], `a change was lost in ${lost.length} of ${ROUNDS} rounds`);
  assert.deepEqual((await call('/api/label-settings', undefined, otherShop)).body, theirsBefore);
});

test('website settings: the tagline and the description saved at once both stay', async () => {
  const theirsBefore = (await call('/api/storefront-settings', undefined, otherShop)).body;
  const lost = await lostRounds(
    '/api/storefront-settings',
    () => ({ tagline: '[tagline]', description: '[description]' }),
    (i) => ({ tagline: `[tagline ${i}]` }),
    (i) => ({ description: `[description ${i}]` }),
    (s, i) => s.tagline === `[tagline ${i}]` && s.description === `[description ${i}]`,
  );
  assert.deepEqual(lost, [], `a change was lost in ${lost.length} of ${ROUNDS} rounds`);
  assert.deepEqual((await call('/api/storefront-settings', undefined, otherShop)).body, theirsBefore);
});
