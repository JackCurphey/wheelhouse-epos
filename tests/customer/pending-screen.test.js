// The pending screen: the private link read back - the status, the summary,
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

test('it reads the private link and shows where the booking is up to as its heading; no step, back link or action', async () => {
  const { ui, requests } = await open();
  assert.ok(await heading(ui, 'Awaiting shop confirmation'));
  assert.ok(requests.some((r) => r.url === `/api/portal/north/booking-links/${CODE}`), JSON.stringify(requests));
  assert.equal(ui.queryByText(/^Step /), null);
  assert.equal(ui.queryByRole('link', { name: /Back/ }), null);
  assert.equal(document.querySelector('[data-book-pinned]'), null);
});

for (const [stage, words] of [
  ['confirmed', 'Confirmed'],
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
  assert.equal(ui.queryByText('Tubeless?'), null, 'an unanswered question is left out');
});

test('with prices hidden only the names show; a drop-off booking shows the day alone', async () => {
  const { ui } = await open({ ...LINK, startTime: '', services: [{ name: 'Brake service', price: null }], totalPrice: null });
  await heading(ui, 'Awaiting shop confirmation');
  assert.ok(ui.getByText('Brake service'));
  assert.equal(ui.queryByText(/£/), null);
  assert.ok(ui.getByText('Monday 5 October'));
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

test('it says to contact the shop to change or cancel', async () => {
  const { ui } = await open();
  await heading(ui, 'Awaiting shop confirmation');
  assert.ok(ui.getByText('Need to change or cancel? Contact North Street Cycles'));
});

test('a link that finds nothing says so', async () => {
  const { ui } = await open(() => ({ status: 404, body: { error: "We can't find that booking" } }));
  assert.ok(await heading(ui, "We can't find that booking"));
  assert.equal(ui.queryByRole('button', { name: 'Try again' }), null);
});

test('an expired link says so', async () => {
  const { ui } = await open(() => ({ status: 410, body: { error: 'This link has expired' } }));
  assert.ok(await heading(ui, 'This link has expired'));
  assert.equal(ui.queryByRole('button', { name: 'Try again' }), null);
});

test('any other failure offers Try again, which asks again', async () => {
  let calls = 0;
  const { ui } = await open(() => (++calls === 1 ? { status: 500, body: { error: 'Something went wrong' } } : { status: 200, body: LINK }));
  assert.ok(await heading(ui, "We couldn't load this booking"));
  await click(ui.getByRole('button', { name: 'Try again' }));
  assert.ok(await heading(ui, 'Awaiting shop confirmation'));
  assert.equal(calls, 2);
});
