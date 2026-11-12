// Settings › Front desk › Online orders, the screen (openspec/changes/
// website-management, task 5.6; the drawings ws-pay-none, ws-pay-connected,
// ws-pay-tested, ws-pay-failed and ws-pay-more in
// docs/design/user-journeys/generator/website.mjs, lines 437-470). Buying
// online and Paying online; then the rest of the folds (openspec/changes/
// website-buy-online tasks 2.1–2.5; on-settings, on-settings-show,
// on-settings-pay and on-settings-keep in generator/online.mjs).
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { openWebsite as openScreen, closeWebsite, calls } from '../helpers/website-screen.js';

afterEach(closeWebsite);
const WEEK = [1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, open: '09:00', close: '17:00' }));
const PAGE = '/workshop/settings?room=front-desk&fold=paying-online';

// Showing products, as server/online-orders/showing.js sends it (the drawn categories).
const SHOWING = {
  categories: [{ id: 1, path: 'Bearings', showOnline: true }, { id: 2, path: 'Drivetrain › Derailleurs', showOnline: true }, { id: 3, path: '[Category]', showOnline: false }],
  setDifferently: 2,
};
// GET /api/online-orders-settings, as server/routes/online-payments.js sends it.
const account = (state, over = {}) => ({
  buyingOnline: state === 'connected' || state === 'tested' || state === 'more',
  sells: 'shelf', walletsOn: true, storeCreditOn: true, remindDays: 3, keepDays: 7, shelfName: null,
  showing: SHOWING,
  payments: {
    state, connected: state === 'connected' || state === 'tested' || state === 'more', providerName: null,
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
        if (method === 'PUT' && sent.keepDays !== undefined && sent.keepDays <= (sent.remindDays ?? body.remindDays)) return [400, { error: 'Keep orders for more days than the reminder.' }];
        if (method === 'PUT') body = { ...body, ...sent };
        return [200, body];
      },
      '/api/online-orders-settings/categories/1': (_q, method, sent) => {
        body = { ...body, showing: { categories: body.showing.categories.map((c) => (c.id === 1 ? { ...c, showOnline: sent.showOnline } : c)), setDifferently: 1 } };
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

test('ws-pay-none: Online orders comes after End of day and before Cycle to Work, Buying online is off until connected, and Connect goes to the provider', async () => {
  const t = await openOnline(account('none'));
  const jump = t.within(t.ui.getByRole('navigation', { name: 'Jump to' }));
  assert.deepEqual(jump.getAllByRole('link').map((a) => a.textContent).slice(-3), ['End of day', 'Online orders', 'Cycle to Work']);
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
  const connect = box.getByRole('button', { name: 'Connect [payment provider]' });
  assert.ok(connect.className.includes('bg-[var(--accent)]'), 'drawn filled in the accent colour (ui.mjs button)');
  t.fireEvent.click(connect);
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
  assert.ok(box.getByRole('button', { name: 'Try again' }).className.includes('bg-[var(--accent)]'), 'drawn filled in the accent colour');
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

test('once the date for more details has passed, Buying online is off and has no switch', async () => {
  const stopped = account('more');
  const t = await openOnline({ ...stopped, buyingOnline: false, payments: { ...stopped.payments, connected: false } });
  const box = await area(t);
  assert.ok(await box.findByText('Off until you connect [payment provider]'));
  assert.ok(box.queryByRole('switch', { name: 'Buying online' }) === null);
  assert.ok(box.getByRole('button', { name: 'Add the details at [payment provider]' }));
});

test('back from adding details, it doesn’t say connected just now, and announces nothing new', async () => {
  const t = await openOnline(account('tested'), `${PAGE}&payments=details`);
  const box = await area(t);
  assert.ok(await box.findByText('Connected to [payment provider] by Jack Lewis on Thu 10 Sep'));
  assert.ok(box.queryByText(/just now/) === null);
  await t.waitFor(() => assert.equal(window.location.search, '?room=front-desk&fold=paying-online'));
});

// ---------- website-buy-online, pull request 2: the rest of the folds (tasks 2.1–2.5) ----------
const put = () => calls.filter((c) => c.path === '/api/online-orders-settings' && c.method === 'PUT').map((c) => c.body);
const fold = (ui, name) => ui.getByRole('button', { name: new RegExp(`^${name}`) });
const SETTINGS = '/workshop/settings?room=front-desk';

test('the folds in the drawn order: What the website sells, Showing products, Paying online, Not collected, Where ready orders wait', async () => {
  const t = await openOnline(account('tested'), `${SETTINGS}&fold=website-sells`);
  const box = await area(t);
  await box.findByRole('button', { name: /^What the website sells/ });
  const names = box.getAllByRole('button').filter((b) => b.hasAttribute('aria-expanded')).map((b) => b.textContent);
  ['What the website sells', 'Showing products', 'Paying online', 'Not collected', 'Where ready orders wait']
    .forEach((start, i) => assert.ok(names[i]?.startsWith(start), names.join(' | ')));
  assert.equal(names.length, 5);
});

test('on-settings: What the website sells offers only what’s on the shelf, with its hint and the held line', async () => {
  const t = await openOnline(account('tested'), `${SETTINGS}&fold=website-sells`);
  const box = await area(t);
  await t.waitFor(() => assert.ok(fold(t.ui, 'What the website sells').textContent.endsWith('Only what’s on the shelf')));
  assert.equal(fold(t.ui, 'What the website sells').getAttribute('aria-expanded'), 'true');
  const group = box.getByRole('group', { name: 'Customers can buy' });
  const choices = t.within(group).getAllByRole('radio');
  assert.equal(choices.length, 1, 'no other choice (question 10)');
  assert.ok(t.within(group).getByRole('radio', { name: 'Only what’s on the shelf' }).checked);
  assert.ok(t.within(group).getByText('At the shop they collect from. Ready the same day.'));
  assert.ok(box.getByText('Stock is held for the customer as soon as they’ve paid, and checked again just before they pay.'));
  assert.ok(box.queryByText(/Anything in stock at any of our shops|Also things we can order in/) === null);
});

test('on-settings-pay: the connected line, the wallet and store credit switches, no Gift cards, and the summary', async () => {
  const t = await openOnline(account('tested'), `${SETTINGS}&fold=paying-online`);
  const box = await area(t);
  assert.ok(await box.findByText('Connected to [payment provider] by Jack Lewis on Thu 10 Sep'));
  assert.equal(box.getByRole('switch', { name: 'Apple Pay and Google Pay' }).getAttribute('aria-checked'), 'true');
  assert.equal(box.getByRole('switch', { name: 'Store credit (for signed-in customers)' }).getAttribute('aria-checked'), 'true');
  assert.ok(box.queryByRole('switch', { name: /Gift cards/ }) === null, 'no Gift cards switch (question 8)');
  await t.waitFor(() => assert.ok(fold(t.ui, 'Paying online').textContent.endsWith('[Payment provider] · store credit')));
  t.fireEvent.click(box.getByRole('switch', { name: 'Store credit (for signed-in customers)' }));
  await t.waitFor(() => assert.deepEqual(put(), [{ storeCreditOn: false }]));
  await t.waitFor(() => assert.ok(fold(t.ui, 'Paying online').textContent.endsWith('[Payment provider]')));
  t.fireEvent.click(box.getByRole('switch', { name: 'Apple Pay and Google Pay' }));
  await t.waitFor(() => assert.deepEqual(put().at(-1), { walletsOn: false }));
  await t.waitFor(() => assert.equal(box.getByRole('switch', { name: 'Apple Pay and Google Pay' }).getAttribute('aria-checked'), 'false'));
});

test('not connected, Paying online has no wallet or store credit switches', async () => {
  const t = await openOnline(account('none'), `${SETTINGS}&fold=paying-online`);
  const box = await area(t);
  await box.findByRole('button', { name: 'Connect [payment provider]' });
  assert.ok(box.queryByRole('switch', { name: 'Apple Pay and Google Pay' }) === null);
  assert.ok(box.queryByRole('switch', { name: 'Store credit (for signed-in customers)' }) === null);
});

test('on-settings-pay: Not collected starts at 3 and 7 days, with the drawn explanation, and refuses keeping shorter than the reminder', async () => {
  const t = await openOnline(account('tested'), `${SETTINGS}&fold=not-collected`);
  const box = await area(t);
  await t.waitFor(() => assert.ok(fold(t.ui, 'Not collected').textContent.endsWith('Reminder after 3 days · kept for 7 days')));
  const remind = box.getByRole('textbox', { name: 'Remind the customer after' });
  const keep = box.getByRole('textbox', { name: 'Keep orders for' });
  assert.equal(remind.value, '3');
  assert.equal(keep.value, '7');
  assert.ok(box.getByText('The “ready” email tells the customer we’ll keep it until that date. If it isn’t collected by then, it shows on Today. Staff then contact the customer, or cancel it — a refund the way it was paid, and the items back on sale.'));
  t.fireEvent.change(keep, { target: { value: '2' } });
  t.fireEvent.blur(keep);
  const said = await box.findByText('Keep orders for more days than the reminder.');
  assert.ok(said.closest('[role="alert"]'));
  assert.ok(fold(t.ui, 'Not collected').textContent.endsWith('kept for 7 days'), 'nothing saved');
  t.fireEvent.change(keep, { target: { value: '10' } });
  t.fireEvent.blur(keep);
  await t.waitFor(() => assert.ok(fold(t.ui, 'Not collected').textContent.endsWith('Reminder after 3 days · kept for 10 days')));
  assert.deepEqual(put().at(-1), { remindDays: 3, keepDays: 10 });
});

test('on-settings-keep: Where ready orders wait shows the drawn placeholder until the shelf is named, with its hint', async () => {
  const t = await openOnline(account('tested'), `${SETTINGS}&fold=ready-orders-wait`);
  const box = await area(t);
  await t.waitFor(() => assert.ok(fold(t.ui, 'Where ready orders wait').textContent.endsWith('[Shelf name]')));
  const shelf = box.getByRole('textbox', { name: 'Shelf or spot' });
  assert.equal(shelf.value, '');
  assert.equal(shelf.getAttribute('placeholder'), '[Shelf name]');
  assert.ok(box.getByText('Set once. Ready orders show “Waiting at [Shelf name]” on Online orders, and the till’s hand-over says where to fetch them from.'));
  t.fireEvent.change(shelf, { target: { value: '[Shelf]' } });
  t.fireEvent.blur(shelf);
  await t.waitFor(() => assert.deepEqual(put().at(-1), { shelfName: '[Shelf]' }));
  await t.waitFor(() => assert.ok(fold(t.ui, 'Where ready orders wait').textContent.endsWith('[Shelf]')));
});

test('on-settings-show: a switch per category, the products set differently with See them, and new products follow their category', async () => {
  const t = await openOnline(account('tested'), `${SETTINGS}&fold=showing-products`);
  const box = await area(t);
  await t.waitFor(() => assert.ok(fold(t.ui, 'Showing products').textContent.endsWith('Set on each category and product')));
  assert.equal(box.getByRole('switch', { name: 'Bearings' }).getAttribute('aria-checked'), 'true');
  assert.equal(box.getByRole('switch', { name: 'Drivetrain › Derailleurs' }).getAttribute('aria-checked'), 'true');
  assert.equal(box.getByRole('switch', { name: '[Category]' }).getAttribute('aria-checked'), 'false');
  const line = box.getByText('2 products are set differently from their category.');
  const see = t.within(line.closest('p')).getByRole('link', { name: 'See the products set differently from their category, in Stock' });
  assert.equal(see.textContent, 'See them');
  assert.equal(see.getAttribute('href'), '/workshop/stock?show=set-differently');
  assert.ok(box.getByText('New products follow their category. Each product’s page in Stock has its own “Show on website” switch.'));
  t.fireEvent.click(box.getByRole('switch', { name: 'Bearings' }));
  await t.waitFor(() => assert.deepEqual(calls.filter((c) => c.path === '/api/online-orders-settings/categories/1').map((c) => [c.method, c.body]), [['PUT', { showOnline: false }]]));
  await t.waitFor(() => assert.equal(box.getByRole('switch', { name: 'Bearings' }).getAttribute('aria-checked'), 'false'));
  assert.ok(box.getByText('1 product is set differently from their category.'));
});

test('on-settings-show: with none set differently, no See them', async () => {
  const t = await openOnline(account('tested', { showing: { ...SHOWING, setDifferently: 0 } }), `${SETTINGS}&fold=showing-products`);
  const box = await area(t);
  assert.ok(await box.findByText('0 products are set differently from their category.'));
  assert.ok(box.queryByRole('link', { name: /See the products set differently/ }) === null);
});
