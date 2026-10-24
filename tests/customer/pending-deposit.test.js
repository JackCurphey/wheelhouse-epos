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

// Refunds on the customer's pages (bk-cancel, bk-cancel-late, bk-cancelled,
// bk-cancelled-late, bk-declined, the expired request; openspec/changes/deposit-refund-pages).
const DEP = { pence: 1300, state: 'paid', refundable: true, cancelUntil: { date: '2026-10-04', time: '11:30' } };
const withLink = async (link, cancel) => {
  current = await renderBookScreen({
    file: 'screens/book/pending.js', exportName: 'PendingScreen', at: 'booking/:code',
    url: `/book/north/booking/${CODE}`, services: SERVICES,
    bookingLink: (url, init) => (init?.method === 'POST' ? cancel(init) : { status: 200, body: link }),
  });
  return current;
};
const openCancel = async (ui) => {
  const { fireEvent } = await import('@testing-library/react');
  fireEvent.click(await ui.findByRole('button', { name: 'Cancel booking' }));
  return (await import('@testing-library/react')).within(await ui.findByRole('dialog', { name: 'Cancel this booking?' }));
};

test('cancelling in time: the pop-up says the deposit will be refunded, and Cancel booking sends no choice to lose it', async () => {
  let sent;
  const { ui, requests } = await withLink({ ...MAYA, deposit: DEP, shop: { phone: '01204 555 123' } }, (init) => { sent = JSON.parse(init.body); return { status: 200, body: { ...MAYA, stage: 'cancelled', deposit: { ...DEP, state: 'refunded' } } }; });
  const dialog = await openCancel(ui);
  assert.ok(dialog.getByText('Your £13.00 deposit will be refunded').closest('p').textContent.includes('to the card you paid with, within 5 to 10 working days.'));
  const { fireEvent } = await import('@testing-library/react');
  fireEvent.click(dialog.getByRole('button', { name: 'Cancel booking' }));
  assert.ok(await ui.findByText(/Your £13\.00 deposit comes back to your card within 5 to 10 working days\./));
  assert.deepEqual(sent, {});
  assert.ok(requests.length > 0);
});

test('cancelling late: the pop-up says it isn’t refundable, with the shop’s number, and Cancel and lose the deposit says so', async () => {
  let sent;
  const { ui } = await withLink({ ...MAYA, deposit: { ...DEP, refundable: false }, shop: { phone: '01204 555 123' } }, (init) => { sent = JSON.parse(init.body); return { status: 200, body: { ...MAYA, stage: 'cancelled', deposit: { ...DEP, state: 'kept', refundable: false } } }; });
  const dialog = await openCancel(ui);
  const note = dialog.getByText('your £13.00 deposit isn’t refundable').closest('p').textContent;
  assert.ok(note.includes('It’s past Sunday 4 October, 11:30, so'), note);
  assert.ok(note.includes('If something’s gone wrong, call the shop on 01204 555 123 — they can still refund it.'), note);
  const { fireEvent } = await import('@testing-library/react');
  fireEvent.click(dialog.getByRole('button', { name: 'Cancel and lose the deposit' }));
  assert.ok(await ui.findByText(/Your £13\.00 deposit was kept, because it was after Sunday 4 October, 11:30\./));
  assert.deepEqual(sent, { losesDeposit: true });
});

test('past the cut-off, Free to cancel until isn’t shown', async () => {
  const { ui } = await open({ ...MAYA, deposit: { ...DEP, refundable: false } });
  assert.ok(!labels(ui).includes('Free to cancel until'));
  assert.equal(rowValue(ui, 'Deposit paid'), '£13.00');
});

test('declined, or a request that expired: the deposit comes back', async () => {
  for (const stage of ['declined', 'request_expired']) {
    const { ui } = await withLink({ ...MAYA, stage, deposit: { ...DEP, state: 'refunded' } }, () => ({ status: 500, body: {} }));
    assert.ok(await ui.findByText('Nothing is booked. Your £13.00 deposit comes back to your card within 5 to 10 working days.'), stage);
    const { cleanup } = await import('@testing-library/react');
    cleanup(); current.client.clear(); current.uninstall(); current = undefined;
  }
});

test('no deposit: the pop-up and the cancelled page are as before', async () => {
  const { ui } = await withLink({ ...MAYA, deposit: null }, () => ({ status: 200, body: { ...MAYA, stage: 'cancelled', deposit: null } }));
  const dialog = await openCancel(ui);
  assert.ok(dialog.getByText('There’s nothing to pay or refund.'));
});
