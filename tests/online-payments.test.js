// Online payments set up per shop (openspec/changes/website-management,
// design 6, tasks 5.2-5.5): connecting through the adapter's pretend
// provider, the £1 test payment, the per-shop switch that turns booking
// deposits on, Buying online, and Today's "needs more details" line.
//
// Needs the compose Postgres up (npm run docker:up) or it hangs with no output.
import '../server/load-env.js';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
import { staffLogin } from './helpers/till.js';
import { deleteTestShop } from './helpers/testShop.js';
import { connectPayments } from './helpers/payments.js';

let server;
let unconnected;
before(async () => {
  server = await startLiveServer();
  unconnected = await startLiveServer({ env: { PAYMENTS_PROVIDER: 'none' } });
});
after(async () => {
  if (server) await server.stop();
  if (unconnected) await unconnected.stop();
  await pool.end();
});
const ok = (res, status = 200) => { assert.equal(res.status, status, JSON.stringify(res.body)); return res.body; };
const SETTINGS_PAGE = '/workshop/settings?room=front-desk&fold=online-orders';

async function freshShop(t, name, on = server) {
  const s = await staffSignup(on.baseUrl, { shopName: name });
  t.after(() => deleteTestShop(s.shop.id));
  const req = (p, options) => staffRequest(on.baseUrl, s.cookie, p, options);
  // A page the browser is sent to: its HTML, or where it's sent on to.
  const visit = async (address) => {
    const res = await fetch(new URL(address, on.baseUrl), { headers: { cookie: s.cookie }, redirect: 'manual' });
    return { status: res.status, location: res.headers.get('location'), html: await res.text() };
  };
  const linkTo = (html, words) => {
    const found = html.match(new RegExp(`<a href="([^"]+)"[^>]*>${words}</a>`));
    assert.ok(found, `a link “${words}” on ${html}`);
    return found[1].replaceAll('&amp;', '&');
  };
  return { ...s, req, visit, linkTo };
}
const payments = async (shop) => ok(await shop.req('/api/online-orders-settings')).payments;
const account = (shopId) => runWithShop(shopId, () => prepare('SELECT * FROM online_payment_account').get());

// Connect [payment provider] → the provider's page → Finish (or Cancel) → back to Settings.
async function connectThrough(shop, outcome = 'Finish') {
  const { address } = ok(await shop.req('/api/online-payments/connect', { method: 'POST' }));
  const page = await shop.visit(address);
  assert.equal(page.status, 200);
  return shop.visit(shop.linkTo(page.html, outcome));
}
// Make a test payment → the provider's card page → pay with a test card → back to Settings.
async function testPaymentThrough(shop, card = 'Pay with the test card that works') {
  const { address } = ok(await shop.req('/api/online-payments/test-payment', { method: 'POST' }));
  const page = await shop.visit(address);
  assert.equal(page.status, 200);
  let next = await shop.visit(shop.linkTo(page.html, card));
  while (next.status === 302 && next.location.startsWith('/api/')) next = await shop.visit(next.location);
  return next;
}

// ---------- 5.2 The adapter's pretend provider ----------

test('not connected to start: Paying online says so and Buying online is off', async (t) => {
  const shop = await freshShop(t, '[Not connected shop]');
  const body = ok(await shop.req('/api/online-orders-settings'));
  assert.equal(body.buyingOnline, false);
  assert.equal(body.payments.state, 'none');
  assert.equal(body.payments.providerName, null, 'the pretend provider has no name to show; the screen keeps [payment provider]');
});

test('Connect, then Finish on the provider’s page: connected by this Owner, back on Online orders, Buying online on', async (t) => {
  const shop = await freshShop(t, '[Finish shop]');
  const back = await connectThrough(shop, 'Finish');
  assert.equal(back.status, 302);
  assert.equal(back.location, `${SETTINGS_PAGE}&payments=connected`);
  const p = await payments(shop);
  assert.equal(p.state, 'connected');
  assert.equal(p.connectedByName, 'Test Owner');
  assert.ok(p.connectedAt);
  // Nothing invented: the pretend provider gives no payout account or timing.
  assert.equal(p.payoutLast4, null);
  assert.equal(p.payoutTiming, null);
  assert.equal(ok(await shop.req('/api/online-orders-settings')).buyingOnline, true);
});

test('Cancel on the provider’s page: didn’t finish connecting, so nothing has changed', async (t) => {
  const shop = await freshShop(t, '[Cancel shop]');
  const back = await connectThrough(shop, 'Cancel');
  assert.equal(back.location, `${SETTINGS_PAGE}&payments=failed`);
  assert.equal((await payments(shop)).state, 'failed');
  assert.equal(ok(await shop.req('/api/online-orders-settings')).buyingOnline, false);
  assert.equal(ok(await shop.req('/api/workshop-settings')).paymentsConnected, false);
  // Try again works.
  await connectThrough(shop, 'Finish');
  assert.equal((await payments(shop)).state, 'connected');
});

test('cancelling “Add the details” leaves a connected shop connected', async (t) => {
  const shop = await freshShop(t, '[Still connected shop]');
  await connectPayments(shop.shop.id, { status: 'needs_details', needsDetailsBy: '2026-09-30' });
  await connectThrough(shop, 'Cancel');
  assert.equal((await payments(shop)).state, 'more');
  assert.equal(ok(await shop.req('/api/workshop-settings')).paymentsConnected, true);
});

test('a return link works once, only for the shop that started it, and not made up', async (t) => {
  const a = await freshShop(t, '[Link shop A]');
  const b = await freshShop(t, '[Link shop B]');
  const { address } = ok(await a.req('/api/online-payments/connect', { method: 'POST' }));
  const finish = a.linkTo((await a.visit(address)).html, 'Finish');
  assert.equal((await b.visit(finish)).status, 400, 'another shop can’t use it');
  assert.equal((await account(b.shop.id)), undefined);
  assert.equal((await a.visit(finish)).status, 302);
  assert.equal((await a.visit(finish)).status, 400, 'used once');
  assert.equal((await a.visit('/api/online-payments/return?state=made-up&outcome=finished')).status, 400);
});

test('the provider’s state comes from the adapter; the pretend one keeps what is stored', async (t) => {
  const shop = await freshShop(t, '[Account state shop]');
  await connectPayments(shop.shop.id, { status: 'needs_details', needsDetailsBy: '2026-09-30', needsWhat: '[what they need]' });
  const p = await payments(shop);
  assert.equal(p.state, 'more');
  assert.equal(p.needsDetailsBy, '2026-09-30');
  assert.equal(p.needsWhat, '[what they need]');
});

test('the £1 test payment is one payment of 100p, taken and refunded, even if pressed twice', async (t) => {
  const shop = await freshShop(t, '[Test payment shop]');
  await connectThrough(shop, 'Finish');
  // Pressed twice before the first finished: both reach the provider's page.
  const first = ok(await shop.req('/api/online-payments/test-payment', { method: 'POST' }));
  const second = ok(await shop.req('/api/online-payments/test-payment', { method: 'POST' }));
  for (const { address } of [first, second]) {
    const page = await shop.visit(address);
    let next = await shop.visit(shop.linkTo(page.html, 'Pay with the test card that works'));
    while (next.status === 302 && next.location.startsWith('/api/')) next = await shop.visit(next.location);
    assert.equal(next.location, `${SETTINGS_PAGE}&payments=tested`);
  }
  const rows = await runWithShop(shop.shop.id, () => prepare('SELECT amount_pence, refunded_pence, status FROM pretend_payments').all());
  assert.deepEqual(rows, [{ amount_pence: 100, refunded_pence: 100, status: 'refunded' }]);
  const p = await payments(shop);
  assert.equal(p.state, 'tested');
  assert.ok(p.testPaidAt);
  const again = await shop.req('/api/online-payments/test-payment', { method: 'POST' });
  assert.equal(again.status, 409);
});

test('a declined test card takes nothing and changes nothing; another card can try', async (t) => {
  const shop = await freshShop(t, '[Declined shop]');
  await connectThrough(shop, 'Finish');
  const back = await testPaymentThrough(shop, 'Pay with the test card that’s declined');
  assert.equal(back.location, `${SETTINGS_PAGE}&payments=declined`);
  assert.equal((await payments(shop)).state, 'connected');
  const tried = await testPaymentThrough(shop);
  assert.equal(tried.location, `${SETTINGS_PAGE}&payments=tested`);
  const rows = await runWithShop(shop.shop.id, () => prepare('SELECT refunded_pence, status FROM pretend_payments').all());
  assert.deepEqual(rows, [{ refunded_pence: 100, status: 'refunded' }]);
});

test('a test payment needs a connection; connecting needs a provider on this server', async (t) => {
  const shop = await freshShop(t, '[No test shop]');
  const res = await shop.req('/api/online-payments/test-payment', { method: 'POST' });
  assert.equal(res.status, 409);
  assert.equal(res.body.code, 'payments_not_connected');
  const elsewhere = await freshShop(t, '[No provider shop]', unconnected);
  const connect = await elsewhere.req('/api/online-payments/connect', { method: 'POST' });
  assert.equal(connect.status, 409);
  assert.equal(connect.body.code, 'no_provider');
  assert.equal((await elsewhere.visit('/api/online-payments/pretend-connect?state=x')).status, 404);
});

test('only the Owner sees or changes online payments and Buying online', async (t) => {
  const shop = await freshShop(t, '[Owner only shop]');
  const staff = await staffLogin(shop.shop.id);
  for (const [path, method, body] of [
    ['/api/online-orders-settings', 'GET'], ['/api/online-orders-settings', 'PUT', { buyingOnline: false }],
    ['/api/online-payments/connect', 'POST'], ['/api/online-payments/test-payment', 'POST'],
  ]) {
    const res = await staffRequest(server.baseUrl, staff.cookie, path, { method, body });
    assert.equal(res.status, 403, `${method} ${path}`);
  }
});

// ---------- 5.3 paymentsConnected is per shop ----------

async function depositShop(t, name, { connected }) {
  const shop = await freshShop(t, name);
  if (connected) await connectPayments(shop.shop.id);
  await runWithShop(shop.shop.id, () => prepare('UPDATE workshop_settings SET deposit_on = 1, deposit_kind = ?, deposit_percent = 20').run('percent'));
  const service = await runWithShop(shop.shop.id, async () => (await prepare("INSERT INTO workshop_services (name, price, price_pence, minutes, bookable_online, active, updated_at) VALUES ('[Service]', 65, 6500, 60, 1, 1, now()) RETURNING id").get()).id);
  return { ...shop, service };
}
const holdFor = async (shop) => (await fetch(`${server.baseUrl}/api/portal/${shop.shop.slug}/deposit-holds`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ serviceIds: [shop.service], requestKey: randomBytes(16).toString('hex') }),
})).json();

test('booking deposits (deposit.js, booking-deposit.js): only the connected shop holds one, on the same server', async (t) => {
  const yes = await depositShop(t, '[Connected deposit shop]', { connected: true });
  const no = await depositShop(t, '[Unconnected deposit shop]', { connected: false });
  assert.equal((await holdFor(yes)).depositPence, 1300);
  assert.equal((await holdFor(no)).depositPence, null);
});

test('the booking page (portal.js) asks for a deposit only for a connected shop', async (t) => {
  const yes = await depositShop(t, '[Connected portal shop]', { connected: true });
  const no = await depositShop(t, '[Unconnected portal shop]', { connected: false });
  const takes = async (s) => (await (await fetch(`${server.baseUrl}/api/portal/${s.shop.slug}/services`)).json()).takesDeposit;
  assert.equal(await takes(yes), true);
  assert.equal(await takes(no), false);
});

test('a connection that needs details still takes deposits; a failed one, or another provider’s, doesn’t', async (t) => {
  const shop = await depositShop(t, '[States deposit shop]', { connected: false });
  for (const [status, provider, takes] of [['needs_details', 'pretend', 1300], ['failed', 'pretend', null], ['connected', 'stripe', null], ['connected', 'pretend', 1300]]) {
    await connectPayments(shop.shop.id, { status, provider });
    assert.equal((await holdFor(shop)).depositPence, takes, `${status} ${provider}`);
  }
});

test('workshop settings (workshop-settings.js): per shop, and deposits can’t be switched on without it', async (t) => {
  const yes = await freshShop(t, '[Connected settings shop]');
  const no = await freshShop(t, '[Unconnected settings shop]');
  await connectPayments(yes.shop.id);
  assert.equal(ok(await yes.req('/api/workshop-settings')).paymentsConnected, true);
  assert.equal(ok(await no.req('/api/workshop-settings')).paymentsConnected, false);
  ok(await yes.req('/api/workshop-settings', { method: 'PUT', body: { depositOn: true, depositPercent: 20 } }));
  const refused = await no.req('/api/workshop-settings', { method: 'PUT', body: { depositOn: true, depositPercent: 20 } });
  assert.equal(refused.status, 409);
  assert.equal(refused.body.code, 'payments_not_connected');
});

test('on a server with no provider, a stored connection doesn’t count', async (t) => {
  const shop = await freshShop(t, '[No provider settings shop]', unconnected);
  await connectPayments(shop.shop.id);
  assert.equal(ok(await shop.req('/api/workshop-settings')).paymentsConnected, false);
  assert.equal((await payments(shop)).state, 'none');
});

// ---------- 5.4 Buying online ----------

test('Buying online can’t be switched on while not connected', async (t) => {
  const shop = await freshShop(t, '[Buying refused shop]');
  const res = await shop.req('/api/online-orders-settings', { method: 'PUT', body: { buyingOnline: true } });
  assert.equal(res.status, 409);
  assert.equal(res.body.code, 'payments_not_connected');
  assert.equal(ok(await shop.req('/api/online-orders-settings')).buyingOnline, false);
  assert.equal((await shop.req('/api/online-orders-settings', { method: 'PUT', body: { buyingOnline: 'yes' } })).status, 400);
});

test('connected, Buying online switches off and on; it reads off again if the connection goes', async (t) => {
  const shop = await freshShop(t, '[Buying shop]');
  await connectThrough(shop, 'Finish');
  assert.equal(ok(await shop.req('/api/online-orders-settings', { method: 'PUT', body: { buyingOnline: false } })).buyingOnline, false);
  assert.equal(ok(await shop.req('/api/online-orders-settings', { method: 'PUT', body: { buyingOnline: true } })).buyingOnline, true);
  await connectPayments(shop.shop.id, { status: 'failed' });
  assert.equal(ok(await shop.req('/api/online-orders-settings')).buyingOnline, false);
});

test('the Website page’s Taking payments row reads the same state', async (t) => {
  const shop = await freshShop(t, '[Website row shop]');
  ok(await shop.req('/api/website/set-up', { method: 'POST', body: { kind: 'wheelhouse', startWith: 'nothing', mainColour: '#1A3F66' } }));
  assert.deepEqual(ok(await shop.req('/api/website')).payments, { state: 'none', providerName: null });
  await connectPayments(shop.shop.id, { testPaid: true });
  assert.deepEqual(ok(await shop.req('/api/website')).payments, { state: 'tested', providerName: null });
});

// ---------- 5.5 Today ----------

const needsAttention = async (shop) => ok(await shop.req('/api/needs-attention')).items.filter((i) => i.kind === 'payments_need_details');

test('Today shows the Owner “needs more details by [date]”, and drops it once the details are added', async (t) => {
  const shop = await freshShop(t, '[Today payments shop]');
  await connectThrough(shop, 'Finish');
  assert.deepEqual(await needsAttention(shop), []);
  await connectPayments(shop.shop.id, { status: 'needs_details', needsDetailsBy: '2026-09-30', needsWhat: '[what they need]' });
  assert.deepEqual(await needsAttention(shop), [{ kind: 'payments_need_details', providerName: null, needsDetailsBy: '2026-09-30', needsWhat: '[what they need]' }]);
  // Add the details: the provider's page again, finished.
  await connectThrough(shop, 'Finish');
  assert.deepEqual(await needsAttention(shop), []);
  assert.equal((await payments(shop)).state, 'connected');
});

test('Today’s line is one shop’s own, and not shown on a server with no provider', async (t) => {
  const a = await freshShop(t, '[Today A]');
  const b = await freshShop(t, '[Today B]');
  await connectPayments(a.shop.id, { status: 'needs_details', needsDetailsBy: '2026-09-30' });
  assert.equal((await needsAttention(a)).length, 1);
  assert.deepEqual(await needsAttention(b), []);
  const elsewhere = await freshShop(t, '[Today no provider]', unconnected);
  await connectPayments(elsewhere.shop.id, { status: 'needs_details', needsDetailsBy: '2026-09-30' });
  assert.deepEqual(await needsAttention(elsewhere), []);
});
