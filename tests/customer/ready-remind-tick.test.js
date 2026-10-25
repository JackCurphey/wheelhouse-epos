// The reminder tick on the in-shop ready page (openspec/changes/ready-remind-tick;
// drawn as ac-collect-remind and cp-summary-said-yes; Jack's answer 8 of 25
// Oct): in the "To pay when you collect" card while the bike is ready, saved at
// once; a customer who said yes sees so, with Change.
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
const READY = {
  reference: 'WH-1042', shopName: 'North Street Cycles', jobDate: '2026-09-17', startTime: '11:30', description: null, bikeNote: null, answers: [],
  bike: { make: 'Trek', model: 'Domane AL 3' }, stage: 'ready_to_collect', photoCount: 0, services: [{ name: 'Standard service', price: 65 }], totalPrice: 65,
  dropOff: null, confirmationNote: null, canCancel: false, canChange: false, checkedBy: null,
  workState: 'complete', bookedInAt: '2026-09-17T08:42:00Z', collectedAt: null, expectedReady: null,
  shop: { address: '[Shop address]', phone: '[shop phone]', openingHours: '[opening hours]' },
  work: [{ name: 'Standard service', price: 65 }], workTotal: 65, declined: [], toPay: 65, paid: null, remindersYes: false,
};
const TICK = 'Remind me when my bike is due its next service';
const open = async (over = {}) => {
  let yes = over.remindersYes ?? false;
  current = await renderBookScreen({
    file: 'screens/book/pending.js', exportName: 'PendingScreen', at: 'booking/:code',
    url: `/book/north/booking/${CODE}`, services: SERVICES,
    bookingLink: (url, init) => {
      if (url.endsWith('/reminders')) { yes = JSON.parse(init.body).yes; return { status: 200, body: { remindersYes: yes } }; }
      return { status: 200, body: { ...READY, ...over, remindersYes: yes } };
    },
  });
  return { ...current, within: (await import('@testing-library/react')).within };
};
const posts = (requests) => requests.filter((r) => r.method === 'POST').map((r) => `${r.url.split('/').pop()} ${JSON.stringify(r.body)}`);

test('ready, not said yes: the drawn tick ends the To pay card, unticked', async () => {
  const { ui, within } = await open();
  const card = within(await ui.findByRole('region', { name: 'To pay when you collect' }));
  const tick = card.getByRole('checkbox', { name: new RegExp(TICK) });
  assert.equal(tick.checked, false);
  assert.ok(card.getByText('And ask me for a review after I collect. One message each, the way you chose when you booked. Stop any time.'));
});

test('ticking it saves a yes at once; unticking it says no', async () => {
  const { ui, requests } = await open();
  const { fireEvent, waitFor } = await import('@testing-library/react');
  fireEvent.click(await ui.findByRole('checkbox', { name: new RegExp(TICK) }));
  await waitFor(() => assert.deepEqual(posts(requests), ['reminders {"yes":true}']));
  fireEvent.click(ui.getByRole('checkbox', { name: new RegExp(TICK) }));
  await waitFor(() => assert.deepEqual(posts(requests), ['reminders {"yes":true}', 'reminders {"yes":false}']));
});

test('said yes already: the drawn line with Change; Change shows the tick, ticked', async () => {
  const { ui, requests, within } = await open({ remindersYes: true });
  const card = within(await ui.findByRole('region', { name: 'To pay when you collect' }));
  assert.ok(card.getByText('You’ll get a reminder when the next service is due.'));
  assert.ok(card.queryByRole('checkbox') === null);
  const { fireEvent, waitFor } = await import('@testing-library/react');
  fireEvent.click(card.getByRole('button', { name: 'Change' }));
  const tick = card.getByRole('checkbox', { name: new RegExp(TICK) });
  assert.equal(tick.checked, true);
  fireEvent.click(tick);
  await waitFor(() => assert.deepEqual(posts(requests), ['reminders {"yes":false}']));
});

test('no tick while the bike is still in the workshop, or once it’s paid', async () => {
  const inWorkshop = await open({ stage: 'in_workshop', workState: 'in_progress' });
  await inWorkshop.ui.findByText('Your repair · WH-1042');
  assert.ok(inWorkshop.ui.queryByRole('checkbox', { name: new RegExp(TICK) }) === null);
  const { cleanup } = await import('@testing-library/react');
  cleanup(); current.client.clear(); current.uninstall();
  const paid = await open({ paid: { at: '2026-09-17T15:00:00Z', amount: 65 }, toPay: null });
  await paid.ui.findByRole('region', { name: 'Paid' });
  assert.ok(paid.ui.queryByRole('checkbox', { name: new RegExp(TICK) }) === null);
});

// Review: a save that fails says so, and the box goes back, so the customer
// never thinks they said yes when they didn't.
test('a tick that doesn’t save goes back, and says so', async () => {
  current = await renderBookScreen({
    file: 'screens/book/pending.js', exportName: 'PendingScreen', at: 'booking/:code',
    url: `/book/north/booking/${CODE}`, services: SERVICES,
    bookingLink: (url) => (url.endsWith('/reminders') ? { status: 500, body: { error: 'Internal error' } } : { status: 200, body: READY }),
  });
  const { fireEvent, waitFor } = await import('@testing-library/react');
  const tick = await current.ui.findByRole('checkbox', { name: new RegExp(TICK) });
  fireEvent.click(tick);
  await waitFor(() => assert.ok(current.ui.queryByText('That didn’t save. Check your connection and try again.') !== null));
  assert.equal(current.ui.getByRole('checkbox', { name: new RegExp(TICK) }).checked, false);
});
