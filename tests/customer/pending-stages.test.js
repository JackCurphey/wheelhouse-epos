// The booking page's later stages (Jack, 21 Oct,
// docs/decisions/2026-10-21-booking-page-stages.md; openspec/changes/booking-page-stages):
// in the workshop (dq-in-shop, a plain line for now: answer 1), ready
// (cp-summary-inshop, cp-summary-checked), collected (cp-summary-collected)
// and a request the shop never answered (bk-request-expired, answer 2).
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { renderBookScreen } from '../helpers/book-screen.js';

let current;
afterEach(async () => {
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  current?.client.clear();
  current?.uninstall();
  current = undefined;
});

const SERVICES = { shopName: 'North Street Cycles', showPrices: true, full: [], categories: [], uncategorised: [] };
const CODE = 'b'.repeat(64);
const MAYA = {
  reference: 'WH-1042', shopName: 'North Street Cycles', jobDate: '2026-09-17', startTime: '11:30', description: null, bikeNote: null, answers: [],
  bike: { make: 'Trek', model: 'Domane AL 3' }, stage: 'in_workshop', photoCount: 0, services: [{ name: 'Standard service', price: 65 }], totalPrice: 65,
  dropOff: null, confirmationNote: null, canCancel: false, canChange: false, checkedBy: null,
};

const open = async (link) => {
  current = await renderBookScreen({
    file: 'screens/book/pending.js', exportName: 'PendingScreen', at: 'booking/:code',
    url: `/book/north/booking/${CODE}`, services: SERVICES, bookingLink: { ...MAYA, ...link },
  });
  return current;
};
const h1 = (ui, name) => ui.findByRole('heading', { level: 1, name });
const tracker = (ui) => ui.queryByRole('list', { name: 'Where your bike is' });
// Nothing from the first release's page, whose drawings these stages replace.
const noOldPage = (ui) => {
  assert.ok(ui.queryByRole('button', { name: 'Copy link' }) === null, 'no Copy link');
  assert.ok(ui.queryByText(/Need to change|Contact North Street Cycles/) === null, 'no contact line');
};

test('in the workshop: the bike and work as the heading, the plain line, the quote, the rows and the shop; no tracker yet', async () => {
  const { ui, requests } = await open({});
  assert.ok(await h1(ui, 'Trek Domane AL 3 · Standard service'));
  assert.ok(ui.getByText('Your repair · WH-1042'));
  assert.ok(ui.getByText('Your bike is in the workshop'));
  assert.ok(tracker(ui) === null);
  assert.ok(ui.getByText('Standard service · £65'));
  assert.ok(document.querySelector('[data-shop-line]').textContent === 'North Street Cycles');
  const { waitFor } = await import('@testing-library/react');
  await waitFor(() => assert.ok(requests.some((r) => r.url.endsWith('/quote')), 'asks for any quote'));
  noOldPage(ui);
});

test('ready: the bike’s name, every step ticked with Ready current, pay at the counter, who checked it', async () => {
  const { ui } = await open({ stage: 'ready_to_collect', checkedBy: 'Alex Morgan' });
  const { within } = await import('@testing-library/react');
  assert.ok(await h1(ui, 'Your Trek Domane AL 3 is ready'));
  const steps = within(tracker(ui)).getAllByRole('listitem');
  assert.deepEqual(steps.map((s) => s.textContent), ['Booked', 'In the shop', 'Being worked on', 'Ready']);
  assert.deepEqual(steps.map((s) => s.getAttribute('aria-current')), [null, null, null, 'step']);
  assert.ok(ui.getByRole('heading', { level: 2, name: 'To pay when you collect' }));
  assert.ok(ui.getByText('Pay at the counter by card or cash. When you come in, just give your name.'));
  assert.equal(document.querySelector('[data-checked-by]').textContent, 'Checked by Alex Morgan');
  noOldPage(ui);
});

test('ready with no bike named says “Your bike”', async () => {
  const { ui } = await open({ stage: 'ready_to_collect', bike: null });
  assert.ok(await h1(ui, 'Your bike is ready'));
});

// Fresh review, 21 Oct: the answered quote is what the drawings' "What we
// did" shows, so it stays once the bike is ready and collected.
for (const stage of ['ready_to_collect', 'collected']) {
  test(`${stage} still asks for the quote`, async () => {
    const { ui, requests } = await open({ stage });
    await ui.findByRole('list', { name: 'Where your bike is' });
    const { waitFor } = await import('@testing-library/react');
    await waitFor(() => assert.ok(requests.some((r) => r.url.endsWith('/quote'))));
  });
}

test('collected: the heading, the tracker, and the Collected card', async () => {
  const { ui } = await open({ stage: 'collected' });
  assert.ok(await h1(ui, 'Your Trek Domane AL 3 has been collected'));
  assert.ok(tracker(ui) !== null);
  assert.ok(ui.getByRole('heading', { level: 2, name: 'Collected' }));
  assert.ok(ui.getByText('Thanks for coming in — this page keeps working for 30 days after collection.'));
  assert.ok(ui.queryByText(/To pay when you collect/) === null);
  noOldPage(ui);
});

test('collected names nobody as checking it: its drawing has no Checked by', async () => {
  const { ui } = await open({ stage: 'collected', checkedBy: 'Alex Morgan' });
  await h1(ui, 'Your Trek Domane AL 3 has been collected');
  assert.ok(ui.queryByText(/Checked by/) === null);
});

test('a request the shop didn’t answer in time: Not booked, why, nothing booked, another date', async () => {
  const { ui } = await open({ stage: 'request_expired' });
  assert.ok(await h1(ui, 'Sorry, we couldn’t get back to you in time'));
  assert.ok(ui.getByText('Not booked'));
  assert.ok(ui.getByText('North Street Cycles couldn’t answer your request for Thursday 17 September, 11:30 in time, so it has expired.'));
  assert.ok(ui.getByText('Nothing is booked.'));
  assert.equal(ui.getByRole('link', { name: 'Choose another date' }).getAttribute('href'), '/book/north');
  noOldPage(ui);
});

test('an expired request with no time names the day alone', async () => {
  const { ui } = await open({ stage: 'request_expired', startTime: '' });
  assert.ok(await ui.findByText('North Street Cycles couldn’t answer your request for Thursday 17 September in time, so it has expired.'));
});

test('the customer’s own words show on the later pages', async () => {
  const { ui } = await open({ stage: 'ready_to_collect', description: 'Rear brake squeals' });
  assert.ok(await ui.findByText('Rear brake squeals'));
});

// Fresh review, 21 Oct (second look): once the work is done, the answered
// quote reads as the drawings' "What we did", after the pay card.
const qline = (over) => ({ id: 1, kind: 'part', description: 'Shimano brake pads', productId: 40, quantity: 1, unitAmount: 28, decision: 'approved', lineTotal: 28, need: 'needed', reason: null, decidedVia: null, decidedAt: null, decidedByName: null, addedToOrderAt: null, ...over });
const ANSWERED = { id: 9, workshopJobId: 1, revision: 1, state: 'partly_approved', createdAt: '2026-09-17T09:00:00Z', sentAt: '2026-09-17T10:15:00Z',
  lines: [qline({}), qline({ id: 2, kind: 'labour', description: 'Fit and adjust brakes', productId: null, unitAmount: 18, lineTotal: 18 }), qline({ id: 3, description: 'Replace gear cable', productId: null, unitAmount: 12, lineTotal: 12, need: 'optional', decision: 'declined' })],
  totals: { all: 58, approved: 46, pending: 0, declined: 12 } };
const openWithQuote = async (stage) => {
  current = await renderBookScreen({
    file: 'screens/book/pending.js', exportName: 'PendingScreen', at: 'booking/:code',
    url: `/book/north/booking/${CODE}`, services: SERVICES,
    bookingLink: (url) => (url.endsWith('/quote') ? { status: 200, body: ANSWERED } : { status: 200, body: { ...MAYA, stage } }),
  });
  return current;
};

test('ready: the answered quote reads “What we did”, with the agreed lines, after the pay card', async () => {
  const { ui } = await openWithQuote('ready_to_collect');
  const did = await ui.findByRole('heading', { level: 2, name: 'What we did' });
  assert.ok(ui.getByText('Shimano brake pads'));
  assert.ok(ui.getByText('Fit and adjust brakes'));
  assert.ok(ui.queryByText(/going ahead/) === null);
  assert.ok(ui.queryByText('Answered') === null);
  const pay = ui.getByRole('heading', { level: 2, name: 'To pay when you collect' });
  assert.ok(pay.compareDocumentPosition(did) & 4, 'the pay card comes first');
});

test('collected: the Collected card, then “What we did”', async () => {
  const { ui } = await openWithQuote('collected');
  const did = await ui.findByRole('heading', { level: 2, name: 'What we did' });
  assert.ok(ui.getByRole('heading', { level: 2, name: 'Collected' }).compareDocumentPosition(did) & 4);
});
