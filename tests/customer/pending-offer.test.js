// The customer answers an offered time on the booking page (Jack, 1 Oct,
// decision 12; 20 Oct; drawn as bk-offered; openspec/changes/offer-another-time):
// what the shop can't do, the time it suggests and its message, then Accept
// this time or Cancel my request.
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
  reference: 'WH-1042', shopName: 'North Street Cycles', jobDate: '2026-09-19', startTime: '10:00', description: null, bikeNote: null, answers: [],
  bike: { make: 'Trek', model: 'Domane AL 3' }, stage: 'time_offered', photoCount: 0, services: [{ name: 'Standard service', price: 65 }], totalPrice: 65,
  dropOff: null, confirmationNote: null, canCancel: true, canChange: false, canAccept: true,
  offer: { fromDate: '2026-09-17', fromTime: '11:30', message: 'Would Saturday at 10:00 suit you?' },
};

const open = async (link = MAYA, onAccept = () => ({ status: 200, body: { ...link, stage: 'confirmed', offer: null, canAccept: false, canChange: true } })) => {
  current = await renderBookScreen({
    file: 'screens/book/pending.js', exportName: 'PendingScreen', at: 'booking/:code',
    url: `/book/north/booking/${CODE}`, services: SERVICES,
    bookingLink: (address, init) => {
      const post = (init?.method ?? 'GET') === 'POST';
      if (post && address.endsWith('/accept-offer')) return onAccept();
      if (post && address.endsWith('/cancel')) return { status: 200, body: { ...link, stage: 'cancelled', canCancel: false, canAccept: false, offer: null } };
      return { status: 200, body: link };
    },
  });
  return current;
};
const rtl = () => import('@testing-library/react');
const click = async (el) => { const { act, fireEvent } = await rtl(); await act(async () => { fireEvent.click(el); }); };
const posts = (end) => current.requests.filter((r) => r.method === 'POST' && r.url.endsWith(end));

test('an offered time: what the shop can’t do, the time it suggests, its message, and the two answers', async () => {
  const { ui } = await open();
  assert.ok(await ui.findByRole('heading', { level: 1, name: 'Your booking request' }));
  assert.ok(ui.queryByText('The shop has suggested another time') !== null);
  assert.ok(ui.queryByText('North Street Cycles can’t do Thursday 17 September at 11:30. They suggest:') !== null);
  assert.ok(ui.queryByText('Saturday 19 September, 10:00') !== null);
  assert.ok(ui.queryByText('Thursday 17 September, 11:30 — not available') !== null);
  assert.ok(ui.queryByText('“Would Saturday at 10:00 suit you?”') !== null);
  const accept = ui.getByRole('button', { name: 'Accept this time' });
  const cancel = ui.getByRole('button', { name: 'Cancel my request' });
  assert.ok(accept.compareDocumentPosition(cancel) & 4);
  assert.ok(ui.queryByRole('button', { name: 'Change the date' }) === null);
});

test('Accept this time confirms the booking at the suggested time', async () => {
  const { ui } = await open();
  await click(await ui.findByRole('button', { name: 'Accept this time' }));
  assert.ok(await ui.findByText('Booking confirmed'));
  assert.equal(posts('/accept-offer').length, 1);
  // It says which time the customer was shown (Jack, 22 Oct, Mark's audit P2 2).
  assert.deepEqual(posts('/accept-offer')[0].body, { jobDate: '2026-09-19', startTime: '10:00' });
  assert.ok(ui.queryByRole('button', { name: 'Accept this time' }) === null);
});

test('a refused accept shows the server’s words', async () => {
  const { ui } = await open(MAYA, () => ({ status: 409, body: { error: "There's no time offered to accept", code: 'illegal' } }));
  await click(await ui.findByRole('button', { name: 'Accept this time' }));
  assert.ok(await ui.findByText("There's no time offered to accept"));
});

test('Cancel my request asks first, then cancels', async () => {
  const { ui } = await open();
  await click(await ui.findByRole('button', { name: 'Cancel my request' }));
  const { within } = await rtl();
  const dialog = await ui.findByRole('dialog', { name: 'Cancel this request?' });
  await click(within(dialog).getByRole('button', { name: 'Cancel request' }));
  assert.ok(await ui.findByRole('heading', { level: 1, name: 'Your booking is cancelled' }));
});

test('with no message, no quote; too late to accept, no Accept', async () => {
  const { ui } = await open({ ...MAYA, offer: { ...MAYA.offer, message: null }, canAccept: false });
  await ui.findByText('The shop has suggested another time');
  assert.ok(ui.queryByText(/“/) === null);
  assert.ok(ui.queryByRole('button', { name: 'Accept this time' }) === null);
});

test('a drop-off day’s offer names the day alone', async () => {
  const { ui } = await open({ ...MAYA, startTime: '', offer: { fromDate: '2026-09-17', fromTime: '', message: null } });
  assert.ok(await ui.findByText('North Street Cycles can’t do Thursday 17 September. They suggest:'));
  assert.ok(ui.queryByText('Thursday 17 September — not available') !== null);
});

test('when the shop has changed the time, the page says so and shows the new one', async () => {
  let reads = 0;
  const moved = { ...MAYA, jobDate: '2026-09-21', startTime: '09:00' };
  current = await renderBookScreen({
    file: 'screens/book/pending.js', exportName: 'PendingScreen', at: 'booking/:code',
    url: `/book/north/booking/${CODE}`, services: SERVICES,
    bookingLink: (address, init) => {
      if ((init?.method ?? 'GET') === 'POST') return { status: 409, body: { error: 'The shop has changed the time it’s offering. Here’s the new one.', code: 'stale' } };
      reads += 1;
      return { status: 200, body: reads === 1 ? MAYA : moved };
    },
  });
  const { ui } = current;
  await click(await ui.findByRole('button', { name: 'Accept this time' }));
  assert.ok(await ui.findByText('The shop has changed the time it’s offering. Here’s the new one.'));
  assert.ok(await ui.findByText('Monday 21 September, 09:00'));
});
