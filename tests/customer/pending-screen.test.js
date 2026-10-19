// The pending screen: the booking link read back - the status, the summary,
// Copy link, the contact line, and 404 / 410 / other failures.
// Spec: docs/superpowers/specs/2026-09-26-book-d5-details-send-pending-design.md
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
const LINK = {
  reference: 'WH-1042', shopName: 'North Street Cycles', jobDate: '2026-10-05', startTime: '09:30',
  description: 'Squeals when braking', bikeNote: 'Blue Trek road bike',
  answers: [
    { wording: "What's wrong with the brakes?", answer: 'Squeaking', text: 'Front only' },
    { wording: 'Tubeless?', answer: null },
  ],
  bike: null, stage: 'awaiting_confirmation', photoCount: 1,
  services: [{ name: 'Brake service', price: 20 }, { name: 'Gear service', price: 25 }], totalPrice: 45,
};

const open = async (bookingLink = LINK) => {
  current = await renderBookScreen({
    file: 'screens/book/pending.js', exportName: 'PendingScreen', at: 'booking/:code',
    url: `/book/north/booking/${CODE}`, services: SERVICES, bookingLink,
  });
  return current;
};
const rtl = () => import('@testing-library/react');
// Copy link's onClick starts an async copy() (await clipboard.writeText, then
// setCopied) - a bare fireEvent.click returns before that state update lands,
// so it would print an act() warning even though every assertion still
// passes. act(async () => ...) keeps flushing microtasks until the click
// handler's returned promise (and the state update after it) has settled.
const click = async (el) => {
  const { act, fireEvent } = await rtl();
  await act(async () => {
    fireEvent.click(el);
    await Promise.resolve();
  });
};
const heading = (ui, name) => ui.findByRole('heading', { level: 1, name });

test('it reads the booking link and shows where the booking is up to as its heading; no step, back link or action', async () => {
  const { ui, requests } = await open();
  assert.ok(await heading(ui, 'Awaiting shop confirmation'));
  assert.ok(requests.some((r) => r.url === `/api/portal/north/booking-links/${CODE}`), JSON.stringify(requests));
  assert.ok(ui.queryByText(/^Step /) === null);
  assert.ok(ui.queryByRole('link', { name: /Back/ }) === null);
  assert.ok(document.querySelector('[data-book-pinned]') === null);
});

for (const [stage, words] of [
  ['confirmed', 'Your bike · Brake service and 1 more'],
  ['in_workshop', 'In the workshop'],
  ['ready_to_collect', 'Ready to collect'],
  ['collected', 'Collected'],
  ['change_requested', 'Change requested'],
  ['declined', 'Declined'],
  ['cancelled', 'Cancelled'],
  ['request_expired', 'Request expired'],
]) {
  test(`stage ${stage} reads "${words}"`, async () => {
    const { ui } = await open({ ...LINK, stage });
    assert.ok(await heading(ui, words));
  });
}

test('an unknown stage leaves the heading empty but still renders the summary', async () => {
  const { ui } = await open({ ...LINK, stage: 'some_future_stage' });
  await ui.findByText('Reference');
  const h1 = ui.getByRole('heading', { level: 1 });
  assert.equal(h1.textContent, '');
  assert.ok(ui.getByText('WH-1042'));
});

test('the summary: reference, services with prices, the total, day and time, bike note, description and answers', async () => {
  const { ui } = await open();
  await heading(ui, 'Awaiting shop confirmation');
  for (const text of [
    'Reference', 'WH-1042', 'Brake service', '£20', 'Gear service', '£25', 'From £45', 'Monday 5 October, 09:30',
    'Blue Trek road bike', 'Squeals when braking', "What's wrong with the brakes?", 'Squeaking - Front only',
  ]) assert.ok(ui.getByText(text), text);
  assert.ok(ui.queryByText('Tubeless?') === null, 'an unanswered question is left out');
});

test('with prices hidden only the names show; a drop-off booking shows the day alone', async () => {
  const { ui } = await open({ ...LINK, startTime: '', services: [{ name: 'Brake service', price: null }], totalPrice: null });
  await heading(ui, 'Awaiting shop confirmation');
  assert.ok(ui.getByText('Brake service'));
  assert.ok(ui.queryByText(/£/) === null);
  assert.ok(ui.getByText('Monday 5 October'));
});

test('with a single service there is no "From £" total line, only the service\'s own price', async () => {
  const { ui } = await open({ ...LINK, services: [{ name: 'Brake service', price: 20 }], totalPrice: 20 });
  await heading(ui, 'Awaiting shop confirmation');
  assert.ok(ui.getByText('Brake service'));
  assert.ok(ui.getByText('£20'));
  assert.ok(ui.queryByText(/^From £/) === null);
});

test('Copy link copies this page\'s address and says "Copied" briefly', async () => {
  const { ui } = await open();
  await heading(ui, 'Awaiting shop confirmation');
  const copied = [];
  Object.defineProperty(window.navigator, 'clipboard', {
    value: { writeText: async (text) => { copied.push(text); } }, configurable: true,
  });
  assert.ok(ui.getByText('Keep this link to check your booking'));
  await click(ui.getByRole('button', { name: 'Copy link' }));
  assert.ok(await ui.findByRole('button', { name: 'Copied' }));
  assert.deepEqual(copied, [`http://localhost/book/north/booking/${CODE}`]);
  const { waitFor } = await rtl();
  await waitFor(() => assert.ok(ui.getByRole('button', { name: 'Copy link' })), { timeout: 3000 });
});

test('Copy link also announces "Copied" to a screen reader, via a live region, not only the button text', async () => {
  const { ui } = await open();
  await heading(ui, 'Awaiting shop confirmation');
  Object.defineProperty(window.navigator, 'clipboard', {
    value: { writeText: async () => {} }, configurable: true,
  });
  const status = ui.getByRole('status');
  assert.equal(status.textContent, '', 'silent until copied');
  await click(ui.getByRole('button', { name: 'Copy link' }));
  await ui.findByRole('button', { name: 'Copied' });
  assert.equal(status.textContent, 'Copied');
});

test('Copy link with no clipboard does not throw, and the button stays "Copy link"', async () => {
  const { ui } = await open();
  await heading(ui, 'Awaiting shop confirmation');
  Object.defineProperty(window.navigator, 'clipboard', { value: undefined, configurable: true });
  await click(ui.getByRole('button', { name: 'Copy link' }));
  assert.ok(ui.getByRole('button', { name: 'Copy link' }));
});

test('it says to contact the shop to change or cancel', async () => {
  const { ui } = await open();
  await heading(ui, 'Awaiting shop confirmation');
  assert.ok(ui.getByText('Need to change or cancel? Contact North Street Cycles'));
});

test('a link that finds nothing says so', async () => {
  const { ui } = await open(() => ({ status: 404, body: { error: "We can't find that booking" } }));
  assert.ok(await heading(ui, "We can't find that booking"));
  assert.ok(ui.queryByRole('button', { name: 'Try again' }) === null);
});

test('an expired link says so', async () => {
  const { ui } = await open(() => ({ status: 410, body: { error: 'This link has expired' } }));
  assert.ok(await heading(ui, 'This link has expired'));
  assert.ok(ui.queryByRole('button', { name: 'Try again' }) === null);
});

test('any other failure offers Try again, which asks again', async () => {
  // Only the booking itself is counted: once it loads, the page also asks for
  // any quote (journey 4), which this booking hasn't got.
  let calls = 0;
  let quoteAsked = false;
  const { ui } = await open((url) => {
    if (url.endsWith('/quote')) { quoteAsked = true; return { status: 404, body: { error: 'There is no quote for this booking' } }; }
    return ++calls === 1 ? { status: 500, body: { error: 'Something went wrong' } } : { status: 200, body: LINK };
  });
  assert.ok(await heading(ui, "We couldn't load this booking"));
  await click(ui.getByRole('button', { name: 'Try again' }));
  assert.ok(await heading(ui, 'Awaiting shop confirmation'));
  assert.equal(calls, 2);
  const { waitFor } = await rtl();
  await waitFor(() => assert.ok(quoteAsked));
  await new Promise((r) => setTimeout(r, 20));
});

// The mechanic sign-off, piece 3 (Jack, 18 Oct; drawn as cp-summary-checked's
// line): with the shop's setting on, a ready bike's link says who checked it.
test('a ready bike’s link says who checked it, when the shop shows it', async () => {
  const { ui } = await open({ ...LINK, stage: 'ready_to_collect', checkedBy: 'Alex Morgan' });
  assert.ok(await heading(ui, 'Ready to collect'));
  const line = ui.getByText((_, el) => el?.getAttribute('data-checked-by') === 'true');
  assert.equal(line.textContent, 'Checked by Alex Morgan');
});

test('with no one to name, the link names nobody', async () => {
  const { ui } = await open({ ...LINK, stage: 'ready_to_collect', checkedBy: null });
  assert.ok(await heading(ui, 'Ready to collect'));
  assert.ok(ui.queryByText(/Checked by/) === null);
});

// Telling the customer when to drop the bike off (Jack, 19 Oct; drawn in bk-confirmed).
test('a confirmed booking says when to drop the bike off, under the heading', async () => {
  const { ui } = await open({ ...LINK, stage: 'confirmed', bike: { make: 'Trek', model: 'Domane AL 3' }, dropOff: { by: '11:00', booked: '11:30', leadMinutes: 30 } });
  assert.ok(await heading(ui, 'Trek Domane AL 3 · Brake service and 1 more'));
  assert.ok(ui.queryByText('Drop your Trek Domane AL 3 off by 11:00, half an hour before your booking at 11:30.') !== null);
});

// The shop's additional note follows the drop-off sentence, in the same
// paragraph, as drawn in bk-confirmed (Jack, 19 Oct, docs/decisions/2026-10-19-confirmation-note.md).
const NOTE = 'Please bring the lock key, and tell us about any accessories.';
test('the shop’s note follows when to drop the bike off', async () => {
  const { ui } = await open({ ...LINK, stage: 'confirmed', bike: { make: 'Trek', model: 'Domane AL 3' }, dropOff: { by: '11:00', booked: '11:30', leadMinutes: 30 }, confirmationNote: NOTE });
  assert.ok(await heading(ui, /Brake service and 1 more$/));
  assert.ok(ui.queryByText(`Drop your Trek Domane AL 3 off by 11:00, half an hour before your booking at 11:30. ${NOTE}`) !== null);
});

test('with no drop-off line, the note shows alone', async () => {
  const { ui } = await open({ ...LINK, stage: 'confirmed', dropOff: null, confirmationNote: NOTE });
  assert.ok(await heading(ui, /Brake service and 1 more$/));
  assert.ok(ui.queryByText(NOTE) !== null);
});

test('with no note, nothing follows the drop-off line', async () => {
  const { ui } = await open({ ...LINK, stage: 'confirmed', bike: { make: 'Trek', model: 'Domane AL 3' }, dropOff: { by: '11:00', booked: '11:30', leadMinutes: 30 }, confirmationNote: null });
  assert.ok(await heading(ui, /Brake service and 1 more$/));
  assert.ok(ui.queryByText('Drop your Trek Domane AL 3 off by 11:00, half an hour before your booking at 11:30.') !== null);
});

// The confirmed page, to its drawing (Jack, 19 Oct; drawn as bk-page):
// "Your repair · [reference]" above a heading naming the bike and the work,
// then a card with the badge, the drop-off sentence and note, the rows and
// the shop's name. Other stages are unchanged.
const MAYA_LINK = {
  ...LINK, reference: 'WH-1042', stage: 'confirmed', jobDate: '2026-09-17', startTime: '11:30', bikeNote: null, description: null, answers: [],
  bike: { make: 'Trek', model: 'Domane AL 3' }, services: [{ name: 'Standard service', price: 65 }], totalPrice: 65,
  dropOff: { by: '11:00', booked: '11:30', leadMinutes: 30 }, confirmationNote: 'Please bring the lock key, and tell us about any accessories.',
};
const rowValue = (ui, label) => {
  const el = ui.queryAllByText(label).find((x) => x.dataset.row === 'label');
  return el ? el.nextElementSibling?.textContent ?? null : null;
};

test('a confirmed booking: Your repair above the bike and the work, the badge, the drop-off and note, the rows, the shop', async () => {
  const { ui } = await open(MAYA_LINK);
  assert.ok(await heading(ui, 'Trek Domane AL 3 · Standard service'));
  assert.ok(ui.queryByText('Your repair · WH-1042') !== null);
  const badge = ui.getByText('Booking confirmed');
  assert.ok(badge.closest('[role="status"]') !== null);
  assert.ok(ui.queryByText('Drop your Trek Domane AL 3 off by 11:00, half an hour before your booking at 11:30. Please bring the lock key, and tell us about any accessories.') !== null);
  assert.equal(rowValue(ui, 'Service'), 'Standard service · £65');
  assert.equal(rowValue(ui, 'Bike'), 'Trek Domane AL 3');
  assert.equal(rowValue(ui, 'When'), 'Thursday 17 September, 11:30');
  assert.equal(rowValue(ui, 'Your repair'), 'WH-1042');
  assert.ok(ui.queryByText('North Street Cycles', { selector: '[data-shop-line] *, [data-shop-line]' }) !== null);
  assert.ok(ui.queryByText('Reference') === null);
});

test('a confirmed booking with prices hidden, several services and only the customer’s words about the bike', async () => {
  const { ui } = await open({ ...MAYA_LINK, bike: null, bikeNote: 'Blue Trek road bike', services: [{ name: 'Brake service', price: null }, { name: 'Gear service', price: null }], totalPrice: null });
  assert.ok(await heading(ui, 'Your bike · Brake service and 1 more'));
  assert.equal(rowValue(ui, 'Service'), 'Brake serviceGear service');
  assert.equal(rowValue(ui, 'Bike'), 'Blue Trek road bike');
});

test('a booking still waiting for the shop keeps its heading and summary', async () => {
  const { ui } = await open({ ...MAYA_LINK, stage: 'awaiting_confirmation' });
  assert.ok(await heading(ui, 'Awaiting shop confirmation'));
  assert.ok(ui.queryByText('Reference') !== null);
  assert.ok(ui.queryByText('Booking confirmed') === null);
});
