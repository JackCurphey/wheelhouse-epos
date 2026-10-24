// The deposit on the booking page (bookingLines and bk-request-deposit in
// book.mjs; Jack, 24 Oct; openspec/changes/deposit-booking-page).
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
  reference: 'WH-1042', shopName: 'North Street Cycles', jobDate: '2026-10-05', startTime: '11:30', description: null, bikeNote: null, answers: [],
  bike: { make: 'Trek', model: 'Domane AL 3' }, stage: 'confirmed', photoCount: 0, services: [{ name: 'Standard service', price: 65 }], totalPrice: 65,
  dropOff: null, confirmationNote: null, canCancel: true, canChange: true, requested: null, changeDeclined: false,
  deposit: { pence: 1300, cancelUntil: { date: '2026-10-04', time: '11:30' } },
};
const open = async (link = MAYA) => {
  current = await renderBookScreen({
    file: 'screens/book/pending.js', exportName: 'PendingScreen', at: 'booking/:code',
    url: `/book/north/booking/${CODE}`, services: SERVICES, bookingLink: link,
  });
  await current.ui.findByText('WH-1042', { selector: 'span' });
  return current;
};
const rowValue = (ui, label) => ui.getByText(label, { selector: '[data-row="label"]' }).parentElement.lastElementChild.textContent;
const labels = (ui) => [...ui.container.querySelectorAll('[data-row="label"]')].map((el) => el.textContent);

test('a confirmed booking with a deposit: Deposit paid and Free to cancel until, before Your repair', async () => {
  const { ui } = await open();
  assert.equal(rowValue(ui, 'Deposit paid'), '£13.00');
  assert.equal(rowValue(ui, 'Free to cancel until'), 'Sunday 4 October, 11:30');
  const order = labels(ui);
  assert.ok(order.indexOf('Deposit paid') < order.indexOf('Free to cancel until') && order.indexOf('Free to cancel until') < order.indexOf('Your repair'), order.join(' / '));
});

test('a request with a deposit says it comes back in full if the shop can’t fit them in', async () => {
  const { ui } = await open({ ...MAYA, stage: 'awaiting_confirmation' });
  assert.ok(ui.getByText(/If we can’t fit you in, your deposit comes back in full\./));
  assert.equal(rowValue(ui, 'Deposit paid'), '£13.00');
});

test('no deposit: neither row, nor the sentence', async () => {
  const { ui } = await open({ ...MAYA, stage: 'awaiting_confirmation', deposit: null });
  assert.ok(!labels(ui).includes('Deposit paid'));
  assert.ok(!labels(ui).includes('Free to cancel until'));
  assert.ok(ui.queryByText(/your deposit comes back in full/) === null);
});
