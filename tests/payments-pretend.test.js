// The online payments adapter and its pretend provider (WP-1.11; Jack, 23 Oct
// answer 2; openspec/changes/deposit-payments design 1–2): hold, take, let go,
// refund, as Stripe's held card payments; the pretend card form's test cards.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import '../server/load-env.js';
import { pool, runWithShop } from '../server/db.js';
import { payments, PaymentError } from '../server/payments/index.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let owner;
let other;
const was = process.env.PAYMENTS_PROVIDER;

before(async () => {
  process.env.PAYMENTS_PROVIDER = 'pretend';
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'Pretend Pay Cycles' });
  other = await staffSignup(server.baseUrl, { shopName: 'Other Pay Cycles' });
});
after(async () => {
  if (was === undefined) delete process.env.PAYMENTS_PROVIDER; else process.env.PAYMENTS_PROVIDER = was;
  for (const s of [owner, other]) if (s) await deleteTestShop(s.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const inShop = (fn, shop = owner) => runWithShop(shop.shop.id, fn);
const card = (ref, cardNumber, shop = owner) => fetch(`${server.baseUrl}/api/portal/${shop.shop.slug}/pretend-payments/${ref}/card`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cardNumber }),
}).then(async (r) => ({ status: r.status, body: await r.json() }));

test('a hold waits for a card; the accepted test card holds it; taking it takes it', async () => {
  const p = payments();
  const { ref } = await inShop(() => p.hold({ amountPence: 1300, key: randomUUID() }));
  assert.deepEqual(await inShop(() => p.status(ref)), { status: 'waiting', amountPence: 1300 });
  const res = await card(ref, '4242 4242 4242 4242');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.status, 'held');
  assert.equal((await inShop(() => p.status(ref))).status, 'held');
  await inShop(() => p.take(ref));
  assert.equal((await inShop(() => p.status(ref))).status, 'taken');
});

test('the declined test card is declined, and nothing is held', async () => {
  const p = payments();
  const { ref } = await inShop(() => p.hold({ amountPence: 1300, key: randomUUID() }));
  const res = await card(ref, '4000000000000002');
  assert.equal(res.status, 402);
  assert.equal(res.body.code, 'card_declined');
  assert.equal((await inShop(() => p.status(ref))).status, 'declined');
  await assert.rejects(inShop(() => p.take(ref)), PaymentError);
  // As Stripe: another card can be tried on the same payment.
  assert.equal((await card(ref, '4242424242424242')).status, 200);
  assert.equal((await inShop(() => p.status(ref))).status, 'held');
});

test('any other number asks to check it, and nothing changes', async () => {
  const p = payments();
  const { ref } = await inShop(() => p.hold({ amountPence: 500, key: randomUUID() }));
  for (const n of ['1234', '', 42]) {
    const res = await card(ref, n);
    assert.equal(res.status, 400, `${n} → ${res.status}`);
  }
  assert.equal((await inShop(() => p.status(ref))).status, 'waiting');
});

test('the same key answers the same hold', async () => {
  const p = payments();
  const key = randomUUID();
  const a = await inShop(() => p.hold({ amountPence: 900, key }));
  const b = await inShop(() => p.hold({ amountPence: 900, key }));
  assert.equal(a.ref, b.ref);
});

test('a hold let go can’t be taken; a taken one can be refunded, up to what was taken', async () => {
  const p = payments();
  const { ref } = await inShop(() => p.hold({ amountPence: 1000, key: randomUUID() }));
  await card(ref, '4242424242424242');
  await assert.rejects(inShop(() => p.refund(ref, 1000)), PaymentError, 'a hold not taken can’t be refunded');
  await inShop(() => p.release(ref));
  assert.equal((await inShop(() => p.status(ref))).status, 'released');
  await assert.rejects(inShop(() => p.take(ref)), PaymentError);

  const second = await inShop(() => p.hold({ amountPence: 1000, key: randomUUID() }));
  await card(second.ref, '4242424242424242');
  await inShop(() => p.take(second.ref));
  await assert.rejects(inShop(() => p.refund(second.ref, 1001)), PaymentError, 'not more than was taken');
  await inShop(() => p.refund(second.ref, 1000));
  assert.equal((await inShop(() => p.status(second.ref))).status, 'refunded');
  await assert.rejects(inShop(() => p.refund(second.ref, 1000)), PaymentError, 'not twice');
});

test('another shop’s hold is never found, by the adapter or the card form', async () => {
  const p = payments();
  const { ref } = await inShop(() => p.hold({ amountPence: 700, key: randomUUID() }));
  await assert.rejects(inShop(() => p.status(ref), other), PaymentError);
  assert.equal((await card(ref, '4242424242424242', other)).status, 404);
});

test('with no provider connected, there are no payments, and no card form', async () => {
  process.env.PAYMENTS_PROVIDER = 'none';
  try {
    assert.equal(payments(), null);
  } finally {
    process.env.PAYMENTS_PROVIDER = 'pretend';
  }
  const unconnected = await startLiveServer({ env: { PAYMENTS_PROVIDER: 'none' } });
  try {
    const res = await fetch(`${unconnected.baseUrl}/api/portal/${owner.shop.slug}/pretend-payments/x/card`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"cardNumber":"4242424242424242"}' });
    assert.equal(res.status, 404);
  } finally {
    await unconnected.stop();
  }
});
