// Settings › Front desk › Online orders, the screen (openspec/changes/
// website-management, task 5.6; the drawings ws-pay-none, ws-pay-connected,
// ws-pay-tested, ws-pay-failed and ws-pay-more in
// docs/design/user-journeys/generator/website.mjs, lines 437-470). Buying
// online and Paying online only (defaults taken 12 Nov, item 4).
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { openWebsite as openScreen, closeWebsite, calls } from '../helpers/website-screen.js';

afterEach(closeWebsite);
const WEEK = [1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, open: '09:00', close: '17:00' }));
const PAGE = '/workshop/settings?room=front-desk&fold=paying-online';

// GET /api/online-orders-settings, as server/routes/online-payments.js sends it.
const account = (state, over = {}) => ({
  buyingOnline: state === 'connected' || state === 'tested' || state === 'more',
  payments: {
    state, providerName: null,
    connectedByName: state === 'none' || state === 'failed' ? null : 'Jack Lewis',
    connectedAt: state === 'none' || state === 'failed' ? null : '2026-09-10T10:00:00Z',
    testPaidAt: state === 'tested' ? '2026-09-10T10:05:00Z' : null,
    payoutLast4: null, payoutTiming: null,
    needsDetailsBy: state === 'more' ? '2026-11-30' : null, needsWhat: null,
  },
  ...over,
});

async function openOnline(start, path = PAGE) {
  let body = start;
  const t = await openScreen(path, {
    answers: {
      '/api/workshop-settings': () => [200, { openingHours: WEEK }],
      '/api/shop-details': () => [200, { name: 'North Street Cycles', receiptFooter: null }],
      '/api/online-orders-settings': (_q, method, sent) => {
        if (method === 'PUT') body = { ...body, buyingOnline: sent.buyingOnline };
        return [200, body];
      },
      '/api/online-payments/connect': () => [200, { address: 'about:blank#connect' }],
      '/api/online-payments/test-payment': () => [200, { address: 'about:blank#test' }],
    },
  });
  await t.ui.findByRole('heading', { level: 3, name: 'Online orders' });
  return t;
}
const area = async (t) => t.within(t.ui.getByRole('region', { name: 'Online orders' }));
const posted = (path) => calls.filter((c) => c.path === path && c.method === 'POST').length;
const foldButton = (ui) => ui.getByRole('button', { name: /^Paying online/ });

test('ws-pay-none: Online orders comes after End of day, Buying online is off until connected, and Connect goes to the provider', async () => {
  const t = await openOnline(account('none'));
  const jump = t.within(t.ui.getByRole('navigation', { name: 'Jump to' }));
  assert.deepEqual(jump.getAllByRole('link').map((a) => a.textContent).slice(-2), ['End of day', 'Online orders']);
  const box = await area(t);
  assert.ok(box.getByText('What the website sells, paying online, and collecting orders.'));
  assert.ok(await box.findByText('Buying online'));
  assert.ok(box.getByText('Off until you connect [payment provider]'));
  assert.ok(box.getByText('Customers can look at products, but the website says “Not taking online orders right now”.'));
  assert.ok(box.queryByRole('switch', { name: 'Buying online' }) === null);
  await t.waitFor(() => assert.ok(foldButton(t.ui).textContent.includes('Not connected')));
  assert.equal(foldButton(t.ui).getAttribute('aria-expanded'), 'true', 'the fold the link names is open');
  assert.ok(box.getByText((_, el) => el?.tagName === 'SPAN' && el.textContent === 'Not connected. Customers can’t buy online, “Pay now” for repairs is hidden and booking deposits are off, until you connect [payment provider].'));
  assert.ok(box.getByText('Opens [payment provider]’s own page to sign up or sign in, then brings you back here. Your shop has its own account with them: card details, payouts and fees ([fees]) are between you and [payment provider].'));
  t.fireEvent.click(box.getByRole('button', { name: 'Connect [payment provider]' }));
  await t.waitFor(() => assert.equal(posted('/api/online-payments/connect'), 1));
});

test('ws-pay-connected: back from the provider, connected just now, the test payment box, and Buying online on', async () => {
  const t = await openOnline(account('connected'), `${PAGE}&payments=connected`);
  const box = await area(t);
  const line = await box.findByText('Connected to [payment provider] by Jack Lewis just now');
  assert.ok(line.closest('[role="status"]'));
  await t.waitFor(() => assert.equal(window.location.search, '?room=front-desk&fold=paying-online'), 'read once, then dropped from the address so a reload doesn’t say it again');
  assert.ok(box.getByText('Connected to [payment provider] by Jack Lewis just now'), 'still says it after the address changes');
  assert.ok(box.getByRole('heading', { name: 'Make a test payment before customers use it' }));
  assert.ok(box.getByText('Pay £1.00 with your own card to check everything works. It’s refunded; [what the provider charges on a refund].'));
  assert.equal(box.getByRole('switch', { name: 'Buying online' }).getAttribute('aria-checked'), 'true');
  assert.ok(box.getByText('Customers can buy from your website and collect from the shop.'));
  await t.waitFor(() => assert.ok(foldButton(t.ui).textContent.includes('[Payment provider]')));
  t.fireEvent.click(box.getByRole('button', { name: 'Make a test payment' }));
  await t.waitFor(() => assert.equal(posted('/api/online-payments/test-payment'), 1));
});

test('Buying online switched off says customers can look but not buy, and saves', async () => {
  const t = await openOnline(account('connected'));
  const box = await area(t);
  t.fireEvent.click(await box.findByRole('switch', { name: 'Buying online' }));
  await t.waitFor(() => assert.deepEqual(calls.filter((c) => c.path === '/api/online-orders-settings' && c.method === 'PUT').map((c) => c.body), [{ buyingOnline: false }]));
  await t.waitFor(() => assert.equal(box.getByRole('switch', { name: 'Buying online' }).getAttribute('aria-checked'), 'false'));
  assert.ok(box.getByText('Customers can look at products, but the website says “Not taking online orders right now”.'));
  // Opened without coming back from the provider: connected on its day, not "just now".
  assert.ok(box.getByText('Connected to [payment provider] by Jack Lewis on Thu 10 Sep'));
});

test('ws-pay-tested: connected on its day, and the test payment worked with the payout account', async () => {
  const t = await openOnline(account('tested'), `${PAGE}&payments=tested`);
  const box = await area(t);
  assert.ok(await box.findByText('Connected to [payment provider] by Jack Lewis on Thu 10 Sep'));
  const worked = box.getByText((_, el) => el?.tagName === 'SPAN' && el.textContent === 'Test payment worked. £1.00 taken and refunded. Payouts go to the account ending [last 4 digits], [payout timing].');
  assert.ok(worked.closest('[role="status"]'));
  assert.ok(box.queryByRole('button', { name: 'Make a test payment' }) === null);
});

test('a declined test card says nothing was taken, and the test payment can be made again', async () => {
  const t = await openOnline(account('connected'), `${PAGE}&payments=declined`);
  const box = await area(t);
  const said = await box.findByText('The test card was declined. Nothing was taken — try again.');
  assert.ok(said.closest('[role="alert"]'));
  assert.ok(box.getByRole('button', { name: 'Make a test payment' }));
});

test('ws-pay-failed: not connected, nothing has changed, and Try again goes back to the provider', async () => {
  const t = await openOnline(account('failed'), `${PAGE}&payments=failed`);
  const box = await area(t);
  const said = await box.findByText((_, el) => el?.tagName === 'SPAN' && el.textContent === 'Not connected. [payment provider] didn’t finish connecting, so nothing has changed. Try again — if it keeps happening, [payment provider]’s support can see why.');
  assert.ok(said.closest('[role="alert"]'));
  assert.ok(box.getByText('Off until you connect [payment provider]'));
  await t.waitFor(() => assert.ok(foldButton(t.ui).textContent.includes('Not connected')));
  t.fireEvent.click(box.getByRole('button', { name: 'Try again' }));
  await t.waitFor(() => assert.equal(posted('/api/online-payments/connect'), 1));
});

test('ws-pay-more: the provider needs more details by a date, Add the details, and the connected line in grey', async () => {
  const t = await openOnline(account('more'));
  const box = await area(t);
  assert.ok(await box.findByText((_, el) => el?.tagName === 'SPAN' && el.textContent === '[payment provider] needs more details from you by Mon 30 Nov, or online payments will stop. It’s usually [what they need]. This also shows on Today and the Website page.'));
  assert.ok(box.getByText('Connected to [payment provider] by Jack Lewis on Thu 10 Sep'));
  assert.equal(box.getByRole('switch', { name: 'Buying online' }).getAttribute('aria-checked'), 'true');
  t.fireEvent.click(box.getByRole('button', { name: 'Add the details at [payment provider]' }));
  await t.waitFor(() => assert.equal(posted('/api/online-payments/connect'), 1));
});

test('a failed connection opened later, not just back from the provider, is shown but not announced', async () => {
  const t = await openOnline(account('failed'));
  const box = await area(t);
  const said = await box.findByText((_, el) => el?.tagName === 'SPAN' && el.textContent.startsWith('Not connected. [payment provider] didn’t finish connecting'));
  assert.ok(said.closest('[role="alert"]') === null);
  assert.ok(box.getByRole('button', { name: 'Try again' }));
});
