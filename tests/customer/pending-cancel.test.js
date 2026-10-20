// Cancel booking on the booking page (Jack, 1 Oct, decision 10; 19 Oct;
// drawn as bk-cancel, bk-cancel-ls and bk-cancelled;
// openspec/changes/booking-page-cancel): asked once, then cancelled.
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
  bike: { make: 'Trek', model: 'Domane AL 3' }, stage: 'confirmed', photoCount: 0, services: [{ name: 'Standard service', price: 65 }], totalPrice: 65,
  dropOff: null, confirmationNote: null, canCancel: true,
};

// The booking link answers GET with the link, and POST …/cancel with `onCancel`.
const open = async (link = MAYA, onCancel = () => ({ status: 200, body: { ...link, stage: 'cancelled', canCancel: false } })) => {
  current = await renderBookScreen({
    file: 'screens/book/pending.js', exportName: 'PendingScreen', at: 'booking/:code',
    url: `/book/north/booking/${CODE}`, services: SERVICES,
    bookingLink: (address, init) => ((init?.method ?? 'GET') === 'POST' && address.endsWith('/cancel') ? onCancel() : { status: 200, body: link }),
  });
  return current;
};
const rtl = () => import('@testing-library/react');
const click = async (el) => { const { act, fireEvent } = await rtl(); await act(async () => { fireEvent.click(el); }); };
const cancelPosts = () => current.requests.filter((r) => r.method === 'POST' && r.url.endsWith(`/booking-links/${CODE}/cancel`));

test('a confirmed booking that can still be cancelled offers Cancel booking, and the contact line is about the date', async () => {
  const { ui } = await open();
  assert.ok(await ui.findByRole('button', { name: 'Cancel booking' }));
  assert.ok(ui.queryByText('Need to change the date? Contact North Street Cycles') !== null);
});

test('one that can’t be cancelled online offers no Cancel booking', async () => {
  const { ui } = await open({ ...MAYA, canCancel: false });
  await ui.findByRole('heading', { level: 1, name: 'Trek Domane AL 3 · Standard service' });
  assert.ok(ui.queryByRole('button', { name: 'Cancel booking' }) === null);
  assert.ok(ui.queryByText('Need to change or cancel? Contact North Street Cycles') !== null);
});

test('Cancel booking asks once, with the day, time and bike; Keep my booking closes it and sends nothing', async () => {
  const { ui } = await open();
  await click(await ui.findByRole('button', { name: 'Cancel booking' }));
  const dialog = await ui.findByRole('dialog', { name: 'Cancel this booking?' });
  const { within } = await rtl();
  assert.ok(within(dialog).queryByText('Thursday 17 September, 11:30 · Trek Domane AL 3') !== null);
  assert.ok(within(dialog).queryByText('There’s nothing to pay or refund.') !== null);
  await click(within(dialog).getByRole('button', { name: 'Keep my booking' }));
  const { waitFor } = await rtl();
  await waitFor(() => assert.ok(ui.queryByRole('dialog', { name: 'Cancel this booking?' }) === null));
  assert.equal(cancelPosts().length, 0);
});

test('confirming cancels it, and the page says so, with Book another time', async () => {
  const { ui } = await open();
  await click(await ui.findByRole('button', { name: 'Cancel booking' }));
  const { within } = await rtl();
  const dialog = await ui.findByRole('dialog', { name: 'Cancel this booking?' });
  await click(within(dialog).getByRole('button', { name: 'Cancel booking' }));
  assert.ok(await ui.findByRole('heading', { level: 1, name: 'Your booking is cancelled' }));
  assert.equal(cancelPosts().length, 1);
  assert.ok(ui.queryByText('Thursday 17 September, Standard service for your Trek Domane AL 3. There’s nothing to pay or refund.') !== null);
  const again = ui.getByRole('link', { name: 'Book another time' });
  assert.equal(again.getAttribute('href'), '/book/north');
  assert.ok(ui.queryByRole('dialog', { name: 'Cancel this booking?' }) === null);
});

test('a refusal shows the server’s words in the pop-up and the booking stays', async () => {
  const { ui } = await open(MAYA, () => ({ status: 409, body: { error: 'Your bike is already with the shop - please contact them to cancel', code: 'in_shop' } }));
  await click(await ui.findByRole('button', { name: 'Cancel booking' }));
  const { within } = await rtl();
  const dialog = await ui.findByRole('dialog', { name: 'Cancel this booking?' });
  await click(within(dialog).getByRole('button', { name: 'Cancel booking' }));
  assert.ok(await within(dialog).findByText('Your bike is already with the shop - please contact them to cancel'));
  assert.ok(ui.queryByRole('heading', { level: 1, name: 'Your booking is cancelled' }) === null);
  // The page reads the booking again, so it stops offering what was refused.
  const { waitFor } = await rtl();
  await waitFor(() => assert.ok(current.requests.filter((r) => r.method === 'GET' && r.url.endsWith(`/booking-links/${CODE}`)).length >= 2));
});

test('a cancelled booking opened later shows the cancelled page, for a whole-day booking without a time', async () => {
  const { ui } = await open({ ...MAYA, stage: 'cancelled', canCancel: false, startTime: '', bike: null });
  assert.ok(await ui.findByRole('heading', { level: 1, name: 'Your booking is cancelled' }));
  assert.ok(ui.queryByText('Thursday 17 September, Standard service for your bike. There’s nothing to pay or refund.') !== null);
});
