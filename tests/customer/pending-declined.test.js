// A declined booking's page (Book a repair 12; Jack, 20 Oct; drawn as
// bk-declined; openspec/changes/decline-message): it says so, with the
// shop's message, and offers another date.
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
  bike: { make: 'Trek', model: 'Domane AL 3' }, stage: 'declined', photoCount: 0, services: [{ name: 'Standard service', price: 65 }], totalPrice: 65,
  dropOff: null, confirmationNote: null, canCancel: false, declineMessage: 'Fully booked that week, sorry. Please try another day.',
};

const open = async (link = MAYA) => {
  current = await renderBookScreen({
    file: 'screens/book/pending.js', exportName: 'PendingScreen', at: 'booking/:code',
    url: `/book/north/booking/${CODE}`, services: SERVICES, bookingLink: link,
  });
  return current;
};

test('a declined booking: Not booked, the heading, the shop’s message, nothing booked, another date', async () => {
  const { ui } = await open();
  assert.ok(await ui.findByRole('heading', { level: 1, name: 'Sorry, we can’t fit this booking in' }));
  assert.ok(ui.queryByText('Not booked') !== null);
  assert.ok(ui.queryByText('A message from North Street Cycles:') !== null);
  assert.ok(ui.queryByText('“Fully booked that week, sorry. Please try another day.”') !== null);
  assert.ok(ui.queryByText('Nothing is booked.') !== null);
  assert.equal(ui.getByRole('link', { name: 'Choose another date' }).getAttribute('href'), '/book/north');
});

test('with no message, no quote and no “A message from”', async () => {
  const { ui } = await open({ ...MAYA, declineMessage: null });
  await ui.findByRole('heading', { level: 1, name: 'Sorry, we can’t fit this booking in' });
  assert.ok(ui.queryByText(/A message from/) === null);
  assert.ok(ui.queryByText('Nothing is booked.') !== null);
});
