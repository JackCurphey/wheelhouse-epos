// The customer's Cycle to Work orders on her account (ac-account-c2w,
// ac-account-c2w-collected; account.mjs:105-117; openspec/changes/cycle-to-work
// tasks 9.4, cycle-to-work PR 9d): an open order under Now with what she pays
// at collection, opening the order's page by her sign-in; a collected one
// under Earlier with its receipt.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { renderBookScreen } from '../helpers/book-screen.js';
import { C2W_ACCOUNT_ROUTE } from '../../src/customer/routes.ts';

let current;
afterEach(async () => {
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  current?.client.clear();
  current?.uninstall();
  current = undefined;
});

const SERVICES = { shopName: 'North Street Cycles', showPrices: true, full: [], categories: [], uncategorised: [] };
const ME = { id: 1, email: 'maya@example.test', name: 'Maya Patel', phone: null, shopName: 'North Street Cycles', shopSlug: 'north', updateChannel: 'email', serviceReminders: true, reviewRequests: false, marketingPermission: false };
const STAGES = ['Quote given', 'Waiting for the certificate', 'Certificate received', 'Ready to collect', 'Collected'];
// The drawing's placeholders, as the server's allowed fields carry them (server/c2w/customer-view.js).
const ORDER = {
  quoteRef: '[quote number]', shopName: 'North Street Cycles', place: null, providerName: '[Provider]',
  stages: STAGES, bike: '[Bike] · [Size]', accessories: [], totalPence: 100000, howToApply: null,
};
const OPEN = { ...ORDER, id: 5, stage: 'waiting', stageIndex: 1, state: 'held', holdUntil: '2026-09-08', customerPaysPence: 12000, collectedAt: null, saleId: null };
const COLLECTED = { ...ORDER, id: 6, stage: 'collected', stageIndex: 4, state: null, holdUntil: null, customerPaysPence: 12000, collectedAt: '2026-09-03T15:00:00.000Z', saleId: 77 };
const CANCELLED = { ...ORDER, id: 7, stage: 'cancelled', stageIndex: null, state: 'cancelled', holdUntil: null, customerPaysPence: null, collectedAt: null, saleId: null };
// Her till sale at collection, which the history also lists as a purchase.
const SALE = { kind: 'purchase', source: 'till', id: 77, receiptNumber: 3, number: 'B1-0003', what: '[Bike]', totalPence: 12000, at: '2026-09-03T15:00:00.000Z', receipt: { source: 'till', id: 77 } };
// A repair in the workshop now, which also sits under Now.
const REPAIR = { kind: 'repair', jobId: 42, reference: 'WH-1042', title: 'Standard service', bikeLabel: 'Trek Domane AL 3', bikeId: 7, stage: 'in_workshop', workStarted: false, jobDate: '2026-09-17', totalPence: null, at: '2026-09-17T09:00:00.000Z' };
const PUMP = { kind: 'purchase', source: 'till', id: 9, receiptNumber: 12, what: 'Pump', totalPence: 2500, at: '2026-08-21T10:00:00.000Z' };

const accountServer = ({ me = ME, history = [PUMP], orders = [OPEN], ordersFail = false } = {}) => (url) => {
  const { pathname } = new URL(url, 'http://localhost');
  if (!me) return { status: 401, body: { error: 'Not signed in' } };
  if (pathname.endsWith('/me')) return { status: 200, body: me };
  if (pathname.endsWith('/bikes')) return { status: 200, body: [] };
  if (pathname.endsWith('/c2w-orders')) return ordersFail ? { status: 500, body: { error: 'Something went wrong' } } : { status: 200, body: orders };
  const one = /\/c2w-orders\/(\d+)$/.exec(pathname);
  if (one) {
    const found = orders.find((o) => o.id === Number(one[1]));
    return found ? { status: 200, body: found } : { status: 404, body: { error: 'There is no such Cycle to Work order' } };
  }
  return { status: 200, body: history };
};
const openAccount = async (opts) => {
  current = await renderBookScreen({ file: 'screens/book/account.js', exportName: 'AccountScreen', at: 'account', url: '/book/north/account', services: SERVICES, account: accountServer(opts) });
  return current;
};
const openOrder = async (id, opts) => {
  current = await renderBookScreen({ file: 'screens/book/c2w.js', exportName: 'C2wAccountScreen', at: 'account/cycle-to-work/:id', url: `/book/north/account/cycle-to-work/${id}`, services: SERVICES, account: accountServer(opts) });
  return current;
};
// Each piece of text in a row, spaced apart (textContent runs spans together).
const text = (el) => {
  const walk = el.ownerDocument.createTreeWalker(el, 4);
  const parts = [];
  for (let t = walk.nextNode(); t; t = walk.nextNode()) parts.push(t.textContent.replace(/\s+/g, ' ').trim());
  return parts.filter(Boolean).join(' ');
};
const history = async (ui) => {
  const { within } = await import('@testing-library/react');
  return within(await ui.findByRole('region', { name: 'History' }));
};
// The history's rows under a sub-heading, as their text, in order.
const under = (h, heading) => {
  const rows = [];
  for (let el = h.getByRole('heading', { level: 3, name: heading }).nextElementSibling; el && el.tagName !== 'H3'; el = el.nextElementSibling) rows.push(text(el));
  return rows;
};

test('the order page by her sign-in lives under her account', () => {
  assert.equal(C2W_ACCOUNT_ROUTE, '/book/:shopSlug/account/cycle-to-work/:id');
});

test('an open order is first under Now: the bike and stage, the quote and hold, what she pays at collection, Put aside', async () => {
  const { ui } = await openAccount();
  const h = await history(ui);
  await h.findByText('[Bike] · [Size] · Waiting for the certificate');
  const [first] = under(h, 'Now');
  assert.equal(first, 'Cycle to Work [Bike] · [Size] · Waiting for the certificate Cycle to Work · Quote [quote number] · put aside until Tue 8 Sep What you pay at collection: £120.00 Put aside ›');
});

test('the open order comes before a repair in the workshop', async () => {
  const { ui } = await openAccount({ history: [REPAIR, PUMP] });
  const h = await history(ui);
  await h.findByText('[Bike] · [Size] · Waiting for the certificate');
  const now = under(h, 'Now');
  assert.equal(now.length, 2);
  assert.match(now[0], /^Cycle to Work /);
  assert.match(now[1], /Standard service/);
});

test('if her Cycle to Work orders fail to load, the rest of the account still shows', async () => {
  const { ui } = await openAccount({ ordersFail: true });
  const h = await history(ui);
  assert.ok(await h.findByText(/Pump/));
  assert.ok(h.queryByText(/\[Bike\]/) === null);
});

test('a collected order with no collection time still shows, under Earlier', async () => {
  const { ui } = await openAccount({ orders: [{ ...COLLECTED, collectedAt: null }], history: [PUMP, SALE] });
  const h = await history(ui);
  await h.findByText('[Bike] · [Size] · Collected');
  assert.equal(under(h, 'Earlier, newest first')[1], 'Cycle to Work [Bike] · [Size] · Collected Cycle to Work · Quote [quote number] · receipt ›');
});

test('only a cancelled order: the history says nothing is here yet', async () => {
  const { ui } = await openAccount({ orders: [CANCELLED], history: [] });
  const h = await history(ui);
  assert.ok(await h.findByText('Nothing here yet. Your repairs and purchases with North Street Cycles show here.'));
});

test('the open order opens its page by her sign-in', async () => {
  const { ui } = await openAccount();
  const h = await history(ui);
  const { fireEvent } = await import('@testing-library/react');
  fireEvent.click(await h.findByText('[Bike] · [Size] · Waiting for the certificate'));
  assert.ok(await ui.findByText('At /book/north/account/cycle-to-work/5'));
});

test('no longer put aside, or before the certificate’s money is known: no hold, no chip, no amount', async () => {
  const { ui } = await openAccount({ orders: [{ ...OPEN, state: 'released', holdUntil: null, customerPaysPence: null }] });
  const h = await history(ui);
  await h.findByText('[Bike] · [Size] · Waiting for the certificate');
  assert.equal(under(h, 'Now')[0], 'Cycle to Work [Bike] · [Size] · Waiting for the certificate Cycle to Work · Quote [quote number] ›');
});

test('the open order shows under Everything only, as drawn', async () => {
  const { ui } = await openAccount();
  const h = await history(ui);
  await h.findByText('[Bike] · [Size] · Waiting for the certificate');
  const { fireEvent } = await import('@testing-library/react');
  for (const f of ['Purchases', 'Repairs']) {
    fireEvent.click(h.getByRole('button', { name: f }));
    assert.ok(h.queryByText('[Bike] · [Size] · Waiting for the certificate') === null, f);
  }
});

test('a collected order is under Earlier by its day, with its receipt, in place of its till sale', async () => {
  const { ui, router } = await openAccount({ orders: [COLLECTED], history: [PUMP, SALE] });
  const h = await history(ui);
  await h.findByText('[Bike] · [Size] · Collected');
  assert.ok(h.queryByRole('heading', { level: 3, name: 'Now' }) === null);
  assert.deepEqual(under(h, 'Earlier, newest first'), [
    'Cycle to Work [Bike] · [Size] · Collected Cycle to Work · Quote [quote number] · collected Thu 3 Sep · receipt ›',
    'Purchase 12 · Pump Purchase · Fri 21 Aug · in the shop £25.00',
  ]);
  const { fireEvent } = await import('@testing-library/react');
  fireEvent.click(h.getByText('[Bike] · [Size] · Collected'));
  assert.equal(router.state.location.search, '?receipt=till-77');
});

test('a collected order shows under Purchases too', async () => {
  const { ui } = await openAccount({ orders: [COLLECTED], history: [PUMP, SALE] });
  const h = await history(ui);
  await h.findByText('[Bike] · [Size] · Collected');
  const { fireEvent } = await import('@testing-library/react');
  fireEvent.click(h.getByRole('button', { name: 'Purchases' }));
  assert.ok(h.getByText('[Bike] · [Size] · Collected'));
  fireEvent.click(h.getByRole('button', { name: 'Repairs' }));
  assert.ok(h.queryByText('[Bike] · [Size] · Collected') === null);
});

test('a cancelled order is not drawn on the account, so it is left out', async () => {
  const { ui } = await openAccount({ orders: [CANCELLED] });
  const h = await history(ui);
  await h.findByText(/Pump/);
  assert.ok(h.queryByText(/\[Bike\]/) === null);
});

test('the order page by her sign-in shows the same order as the link', async () => {
  const { ui } = await openOrder(5);
  assert.ok(await ui.findByRole('heading', { level: 1, name: 'Your Cycle to Work bike' }));
  assert.ok(ui.getByText(/Quote \[quote number\] · North Street Cycles · \[Provider\]/));
  assert.ok(ui.getByText('Your bike is put aside until 8 September 2026.'));
});

test('signed out, the order page goes to sign in and back after', async () => {
  const { ui } = await openOrder(5, { me: null });
  assert.ok(await ui.findByText(`At /book/north/sign-in?from=${encodeURIComponent('/book/north/account/cycle-to-work/5')}`));
});

test('an order that isn’t hers says so', async () => {
  const { ui } = await openOrder(99);
  assert.ok(await ui.findByRole('heading', { level: 1, name: 'We couldn’t find this order' }));
  assert.ok(ui.getByRole('link', { name: 'Your account' }));
});
