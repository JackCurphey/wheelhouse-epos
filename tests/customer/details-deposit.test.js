// Paying the deposit on step 4 (bk-details-deposit, bk-card-failed,
// bk-checking-payment; Jack, 24 Oct answers 1–5; openspec/changes/deposit-pay-screen).
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { renderBookScreen, PRIVATE_LINK } from '../helpers/book-screen.js';

let current;
afterEach(async () => {
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  current?.client.clear();
  current?.uninstall();
  current = undefined;
});

const SERVICES = {
  shopName: 'North Street Cycles', showPrices: true, takesDeposit: true, full: [], categories: [],
  uncategorised: [{ id: 11, name: 'Standard service', price: 65, minutes: 60, questions: [] }],
};
const MECHANICS = { mechanics: [{ id: 1, name: 'Alex', workingDays: [1, 2, 3, 4, 5] }], openingTime: '09:00', closingTime: '17:00', openingDays: [1, 2, 3, 4, 5] };
const READY = {
  serviceIds: [11], answers: [], date: '2026-10-05', mechanicId: 1, startTime: '11:30',
  name: 'Maya Patel', phone: '07700 900142', termsAccepted: true,
};
const HOLD = { paymentId: 7, depositPence: 1300, depositCancelHours: 24, provider: 'pretend', ref: 'pretend_abc' };
const BOOKED = { status: 201, body: { id: 1, reference: 'WH-1042', privateLink: PRIVATE_LINK, services: [], totalPrice: 65 } };
const ACCEPTED = '4242 4242 4242 4242';

const open = async ({ services = SERVICES, draft = READY, ...rest } = {}) => {
  current = await renderBookScreen({
    file: 'screens/book/details.js', exportName: 'DetailsScreen', at: 'details', url: '/book/north/details',
    services, mechanics: MECHANICS, draft, depositHold: HOLD, card: { status: 'held' }, booking: () => BOOKED, ...rest,
  });
  await current.ui.findByRole('heading', { level: 1, name: 'How can we reach you?' });
  return current;
};
const rtl = () => import('@testing-library/react');
const click = async (el) => (await rtl()).fireEvent.click(el);
const type = async (el, value) => (await rtl()).fireEvent.change(el, { target: { value } });
const sent = (requests, end) => requests.filter((r) => r.method === 'POST' && new URL(r.url, 'http://x').pathname.includes(end));

test('the drawn deposit part: the amount, the refund and cancel lines, and the card box', async () => {
  const { ui } = await open();
  const part = (await rtl()).within(await ui.findByRole('group', { name: 'Deposit · £13.00' }));
  assert.ok(part.getByText(/We take the deposit now, and it comes off the bill when you collect\./));
  assert.ok(part.getByText('If the shop can’t fit you in, it comes back in full'));
  assert.ok(part.getByText(/within 5 to 10 working days\./));
  assert.ok(part.getByText('Free to cancel until Sunday 4 October, 11:30. After that, or if you don’t come, the shop keeps it.'));
  assert.ok(part.getByLabelText('Card number'));
  assert.ok(part.getByText(/Pretend payments while Wheelhouse is being built: nothing is taken\./));
  assert.ok(ui.getByText('Deposit to pay now £13.00'), 'in the summary');
  assert.ok(ui.getByRole('button', { name: 'Pay £13.00 and send request' }));
});

test('a shop that confirms automatically: Pay £13.00 and book', async () => {
  const { ui } = await open({ services: { ...SERVICES, confirmsAutomatically: true } });
  assert.ok(await ui.findByRole('button', { name: 'Pay £13.00 and book' }));
});

test('the hold is asked for with the booking’s services and its request key, which the booking then sends', async () => {
  const { ui, requests } = await open();
  await ui.findByRole('group', { name: 'Deposit · £13.00' });
  const [hold] = sent(requests, '/deposit-holds');
  assert.deepEqual(hold.body.serviceIds, [11]);
  assert.match(hold.body.requestKey, /^[A-Za-z0-9_-]{43}$/);
  await type(ui.getByLabelText('Card number'), ACCEPTED);
  await click(ui.getByRole('button', { name: 'Pay £13.00 and send request' }));
  assert.ok(await ui.findByText(`At ${PRIVATE_LINK}`));
  const [card] = sent(requests, '/pretend-payments/pretend_abc/card');
  assert.equal(card.body.cardNumber, ACCEPTED);
  const [booking] = sent(requests, '/bookings');
  assert.equal(booking.body.paymentId, 7);
  assert.equal(booking.body.requestKey, hold.body.requestKey);
});

test('no card number: it asks for one and pays nothing', async () => {
  const { ui, requests } = await open();
  await click(await ui.findByRole('button', { name: 'Pay £13.00 and send request' }));
  assert.ok(await ui.findByText('Enter the card number'));
  assert.equal(sent(requests, '/pretend-payments').length + sent(requests, '/bookings').length, 0);
});

test('a declined card: the drawn words, Try again, and nothing sent', async () => {
  const { ui, requests } = await open({ card: () => ({ status: 402, body: { error: 'The card didn’t go through.', code: 'card_declined' } }) });
  await type(await ui.findByLabelText('Card number'), '4000 0000 0000 0002');
  await click(ui.getByRole('button', { name: 'Pay £13.00 and send request' }));
  const alert = await ui.findByText('The card didn’t go through.');
  assert.ok(alert.closest('[role="alert"]').textContent.includes('Nothing was taken and nothing is booked yet. Try again, or use another card.'));
  assert.ok(ui.getByRole('button', { name: 'Try again' }));
  assert.equal(sent(requests, '/bookings').length, 0);
});

test('the connection drops after paying: checking, then Check again sends the same booking without paying again', async () => {
  let tries = 0;
  const booking = () => {
    tries += 1;
    if (tries === 1) throw new TypeError('Failed to fetch');
    return BOOKED;
  };
  const { ui, requests, readDraft } = await open({ booking });
  await type(await ui.findByLabelText('Card number'), ACCEPTED);
  await click(ui.getByRole('button', { name: 'Pay £13.00 and send request' }));
  const alert = await ui.findByText('We’re checking whether your payment went through — please don’t pay again.');
  assert.ok(alert.closest('[role="alert"]').textContent.includes('Your connection dropped while sending. Nothing will be taken twice.'));
  assert.ok(ui.queryByLabelText('Card number') === null, 'no card box while checking');
  assert.equal(readDraft().depositHeld, 7, 'kept through a refresh');
  await click(ui.getByRole('button', { name: 'Check again' }));
  assert.ok(await ui.findByText(`At ${PRIVATE_LINK}`));
  assert.equal(sent(requests, '/pretend-payments').length, 1, 'paid once');
  const [first, second] = sent(requests, '/bookings');
  assert.deepEqual(second.body, first.body);
});

test('after a refresh with the deposit already paid, the button sends without the card', async () => {
  const { ui, requests } = await open({ draft: { ...READY, requestKey: 'k'.repeat(43), depositHeld: 7 } });
  await ui.findByRole('group', { name: 'Deposit · £13.00' });
  assert.ok(ui.queryByLabelText('Card number') === null);
  assert.ok(ui.getByText('Paid. It’s held until your booking is sent.'));
  await click(ui.getByRole('button', { name: 'Send request' }));
  assert.ok(await ui.findByText(`At ${PRIVATE_LINK}`));
  assert.equal(sent(requests, '/pretend-payments').length, 0);
});

test('the deposit changed meanwhile: it says so, asks for the hold again, and the card again', async () => {
  let tries = 0;
  const booking = () => {
    tries += 1;
    return tries === 1 ? { status: 409, body: { error: 'The deposit has changed — please pay it again.', code: 'deposit_changed' } } : BOOKED;
  };
  const { ui, requests, readDraft } = await open({ booking });
  await type(await ui.findByLabelText('Card number'), ACCEPTED);
  await click(ui.getByRole('button', { name: 'Pay £13.00 and send request' }));
  assert.ok(await ui.findByText('The deposit has changed — please pay it again.'));
  assert.equal(readDraft().depositHeld, undefined);
  const { waitFor } = await rtl();
  await waitFor(() => assert.equal(sent(requests, '/deposit-holds').length, 2));
  assert.ok(await ui.findByLabelText('Card number'));
});

test('no deposit taken: no hold asked for, and the button is as before', async () => {
  const { ui, requests } = await open({ services: { ...SERVICES, takesDeposit: false } });
  assert.ok(ui.getByRole('button', { name: 'Request booking' }));
  assert.ok(ui.queryByRole('group', { name: /^Deposit/ }) === null);
  assert.equal(sent(requests, '/deposit-holds').length, 0);
});

test('a hold that answers no deposit (no amount set): as before', async () => {
  const { ui } = await open({ depositHold: { depositPence: null } });
  const { waitFor } = await rtl();
  await waitFor(() => assert.ok(ui.getByRole('button', { name: 'Request booking' })));
  assert.ok(ui.queryByRole('group', { name: /^Deposit/ }) === null);
});
