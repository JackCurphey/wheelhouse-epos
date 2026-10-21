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

test('in the workshop: Your repair, the plain line, the booking’s rows and the shop; no tracker yet', async () => {
  const { ui } = await open({});
  assert.ok(await h1(ui, 'Your bike is in the workshop'));
  assert.ok(ui.getByText('Your repair · WH-1042'));
  assert.ok(tracker(ui) === null);
  assert.ok(ui.getByText('Standard service · £65'));
  assert.ok(ui.getByText('Trek Domane AL 3'));
  assert.ok(document.querySelector('[data-shop-line]').textContent === 'North Street Cycles');
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

test('ready and collected show no quote: it was answered before', async () => {
  const { ui, requests } = await open({ stage: 'ready_to_collect' });
  await h1(ui, 'Your Trek Domane AL 3 is ready');
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(requests.some((r) => r.url.endsWith('/quote')), false);
});

test('collected: the heading, the tracker, and the Collected card', async () => {
  const { ui } = await open({ stage: 'collected' });
  assert.ok(await h1(ui, 'Your Trek Domane AL 3 has been collected'));
  assert.ok(tracker(ui) !== null);
  assert.ok(ui.getByRole('heading', { level: 2, name: 'Collected' }));
  assert.ok(ui.getByText('Thanks for coming in — this page keeps working for 30 days after collection.'));
  assert.ok(ui.queryByText(/To pay when you collect/) === null);
  noOldPage(ui);
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
