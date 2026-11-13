// Settings › Front desk › Online orders: the folds buying online adds
// (openspec/changes/website-buy-online, tasks 2.1–2.3; the drawings on-settings,
// on-settings-pay and on-settings-keep in docs/design/user-journeys/generator/
// online.mjs, sellsOpen, payOpen, collectOpen and shelfOpen, and the folds'
// titles and summaries in settings-frame.mjs onlineFolds). Only what's on the
// shelf (question 10) and no Gift cards switch (question 8), defaults taken.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { openWebsite as openScreen, closeWebsite, calls } from '../helpers/website-screen.js';

afterEach(closeWebsite);
const WEEK = [1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, open: '09:00', close: '17:00' }));
const PAGE = '/workshop/settings?room=front-desk';

// GET /api/online-orders-settings, as server/routes/online-payments.js sends it, connected.
const settings = (over = {}) => ({
  buyingOnline: true, sells: 'shelf', walletsOn: true, storeCreditOn: true, remindDays: 3, keepDays: 7, shelfName: null,
  payments: {
    state: 'tested', connected: true, providerName: null, connectedByName: 'Jack Lewis', connectedAt: '2026-09-10T10:00:00Z',
    testPaidAt: '2026-09-10T10:05:00Z', payoutLast4: null, payoutTiming: null, needsDetailsBy: null, needsWhat: null,
  },
  ...over,
});

// A save answers as the server does: refused when keeping isn't longer than the reminder.
async function openOnline(start, fold, { site = {}, refuse = null } = {}) {
  let body = start;
  const t = await openScreen(`${PAGE}&fold=${fold}`, {
    answers: {
      '/api/workshop-settings': () => [200, { openingHours: WEEK }],
      '/api/shop-details': () => [200, { name: 'North Street Cycles', receiptFooter: null }],
      '/api/website': () => [200, { kind: null, ...site }],
      '/api/online-orders-settings': (_q, method, sent) => {
        if (method !== 'PUT') return [200, body];
        if (refuse) return refuse;
        const next = { ...body, ...sent };
        if (next.keepDays <= next.remindDays) return [400, { error: 'Keep orders for more days than the reminder.' }];
        body = next;
        return [200, body];
      },
    },
  });
  await t.ui.findByRole('heading', { level: 3, name: 'Online orders' });
  return t;
}
const area = (t) => t.within(t.ui.getByRole('region', { name: 'Online orders' }));
const fold = (t, name) => t.ui.getByRole('button', { name: new RegExp(`^${name}`) });
const puts = () => calls.filter((c) => c.path === '/api/online-orders-settings' && c.method === 'PUT').map((c) => c.body);

test('on-settings: What the website sells offers only what’s on the shelf, with its hint and the held line', async () => {
  const t = await openOnline(settings(), 'online-sells');
  const box = area(t);
  await t.waitFor(() => assert.ok(fold(t, 'What the website sells').textContent.includes('Only what’s on the shelf')));
  assert.equal(fold(t, 'What the website sells').getAttribute('aria-expanded'), 'true');
  const group = box.getByRole('group', { name: 'Customers can buy' });
  const radios = t.within(group).getAllByRole('radio');
  assert.equal(radios.length, 1, 'no other choice until stock transfers and supplier times exist (question 10)');
  assert.equal(radios[0].checked, true);
  assert.ok(t.within(group).getByText('Only what’s on the shelf'));
  assert.ok(t.within(group).getByText('At the shop they collect from. Ready the same day.'));
  assert.ok(box.queryByText(/Anything in stock at any of our shops|Also things we can order in/) === null);
  assert.ok(box.getByText('Stock is held for the customer as soon as they’ve paid, and checked again just before they pay.'));
  const titles = t.ui.getAllByRole('button', { name: /^(What the website sells|Paying online|Not collected|Where ready orders wait)/ }).map((b) => b.textContent);
  assert.deepEqual(titles.map((s) => s.match(/^(What the website sells|Paying online|Not collected|Where ready orders wait)/)[1]),
    ['What the website sells', 'Paying online', 'Not collected', 'Where ready orders wait'], 'in the drawn order');
});

test('on-settings-pay: the connected line, wallet and store credit switches, no Gift cards, and the summary', async () => {
  const t = await openOnline(settings(), 'paying-online');
  const box = area(t);
  assert.ok(await box.findByText('Connected to [payment provider] by Jack Lewis on Thu 10 Sep'));
  await t.waitFor(() => assert.ok(fold(t, 'Paying online').textContent.includes('[Payment provider] · store credit')));
  assert.equal(box.getByRole('switch', { name: 'Apple Pay and Google Pay' }).getAttribute('aria-checked'), 'true');
  const credit = box.getByRole('switch', { name: 'Store credit (for signed-in customers)' });
  assert.equal(credit.getAttribute('aria-checked'), 'true');
  assert.ok(box.queryByRole('switch', { name: /Gift cards/ }) === null, 'no gift cards until they are built (question 8)');
  t.fireEvent.click(credit);
  await t.waitFor(() => assert.deepEqual(puts(), [{ storeCreditOn: false }]));
  await t.waitFor(() => assert.equal(box.getByRole('switch', { name: 'Store credit (for signed-in customers)' }).getAttribute('aria-checked'), 'false'));
  await t.waitFor(() => assert.ok(!fold(t, 'Paying online').textContent.includes('store credit')), 'the summary drops store credit');
  t.fireEvent.click(box.getByRole('switch', { name: 'Apple Pay and Google Pay' }));
  await t.waitFor(() => assert.deepEqual(puts().at(-1), { walletsOn: false }));
});

test('Paying online not connected has no wallet or store credit switches', async () => {
  const none = settings();
  const t = await openOnline({ ...none, buyingOnline: false, payments: { ...none.payments, state: 'none', connected: false, connectedByName: null, connectedAt: null, testPaidAt: null } }, 'paying-online');
  const box = area(t);
  assert.ok(await box.findByRole('button', { name: 'Connect [payment provider]' }));
  assert.ok(box.queryByRole('switch', { name: 'Apple Pay and Google Pay' }) === null);
  assert.ok(box.queryByRole('switch', { name: 'Store credit (for signed-in customers)' }) === null);
});

test('a Shopify website needing more details has no wallet or store credit switches (Shopify takes the payment)', async () => {
  const s = settings();
  const t = await openOnline({ ...s, payments: { ...s.payments, state: 'more', needsDetailsBy: '2026-09-20', needsWhat: 'proof of address' } }, 'paying-online', { site: { kind: 'shopify' } });
  const box = area(t);
  assert.ok(await box.findByRole('button', { name: 'Add the details at [payment provider]' }));
  await t.waitFor(() => assert.ok(fold(t, 'Paying online').textContent.includes('Shopify for website orders')));
  assert.ok(box.queryByRole('switch', { name: 'Apple Pay and Google Pay' }) === null);
  assert.ok(box.queryByRole('switch', { name: 'Store credit (for signed-in customers)' }) === null);
});

test('a store credit switch the server refuses says so and stays as it was', async () => {
  const t = await openOnline(settings(), 'paying-online', { refuse: [500, { error: 'boom' }] });
  const box = area(t);
  const credit = await box.findByRole('switch', { name: 'Store credit (for signed-in customers)' });
  t.fireEvent.click(credit);
  const said = await box.findByRole('alert');
  assert.ok(said.textContent.length > 0);
  assert.equal(box.getByRole('switch', { name: 'Store credit (for signed-in customers)' }).getAttribute('aria-checked'), 'true');
  assert.ok(box.getByRole('switch', { name: 'Store credit (for signed-in customers)' }).disabled === false, 'stays focusable');
});

test('on-settings-pay: Not collected reads its starting days, the two boxes and the drawn explanation, and saves', async () => {
  const t = await openOnline(settings(), 'online-not-collected');
  const box = area(t);
  await t.waitFor(() => assert.ok(fold(t, 'Not collected').textContent.includes('Reminder after 3 days · kept for 7 days')));
  const remind = box.getByLabelText('Remind the customer after');
  const keep = box.getByLabelText('Keep orders for');
  assert.equal(remind.value, '3');
  assert.equal(keep.value, '7');
  assert.ok(box.getByText('The “ready” email tells the customer we’ll keep it until that date. If it isn’t collected by then, it shows on Today. Staff then contact the customer, or cancel it — a refund the way it was paid, and the items back on sale.'));
  t.fireEvent.change(keep, { target: { value: '10' } });
  t.fireEvent.blur(keep);
  await t.waitFor(() => assert.deepEqual(puts(), [{ keepDays: 10 }]));
  await t.waitFor(() => assert.ok(fold(t, 'Not collected').textContent.includes('Reminder after 3 days · kept for 10 days')));
});

test('Keep orders for fewer days than the reminder is refused with the server’s message', async () => {
  const t = await openOnline(settings(), 'online-not-collected');
  const box = area(t);
  const keep = await box.findByLabelText('Keep orders for');
  t.fireEvent.change(keep, { target: { value: '2' } });
  t.fireEvent.blur(keep);
  const said = await box.findByText('Keep orders for more days than the reminder.');
  assert.ok(said.closest('[role="alert"]'));
  assert.ok(fold(t, 'Not collected').textContent.includes('kept for 7 days'), 'nothing saved');
});

test('a reminder that isn’t a whole number of days from 1 to 60 is refused on the screen, and not sent', async () => {
  const t = await openOnline(settings(), 'online-not-collected');
  const box = area(t);
  const remind = await box.findByLabelText('Remind the customer after');
  t.fireEvent.change(remind, { target: { value: '0' } });
  t.fireEvent.blur(remind);
  assert.ok(await box.findByText('A whole number of days, 1 to 60'));
  t.fireEvent.change(remind, { target: { value: '1e1' } });
  assert.ok(box.queryByText('A whole number of days, 1 to 60') === null, 'typing again clears the message');
  t.fireEvent.blur(remind);
  assert.ok(await box.findByText('A whole number of days, 1 to 60'), '1e1 is not a whole number of days');
  assert.deepEqual(puts(), []);
});

test('on-settings-keep: Where ready orders wait names the shelf once, with its hint', async () => {
  const t = await openOnline(settings(), 'online-shelf');
  const box = area(t);
  await t.waitFor(() => assert.ok(fold(t, 'Where ready orders wait').textContent.includes('Not set yet')));
  const shelf = box.getByLabelText('Shelf or spot');
  assert.equal(shelf.value, '');
  assert.equal(shelf.getAttribute('placeholder'), '[Shelf name]');
  assert.ok(box.getByText('Set once. Ready orders show “Waiting at [Shelf name]” on Online orders, and the till’s hand-over says where to fetch them from.'));
  t.fireEvent.change(shelf, { target: { value: 'Shelf behind the till' } });
  t.fireEvent.blur(shelf);
  await t.waitFor(() => assert.deepEqual(puts(), [{ shelfName: 'Shelf behind the till' }]));
  await t.waitFor(() => assert.ok(fold(t, 'Where ready orders wait').textContent.includes('Shelf behind the till')));
});
