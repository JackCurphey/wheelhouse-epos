// "You didn't finish booking" (Jack, 1 Oct, book a repair decision 9; drawn
// as bk-resume; openspec/changes/booking-draft-resume): a booking kept on the
// device comes back on a later visit, on the step it was left at, with the
// drawn banner, Carry on and Start again.
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

const svc = (id, name) => ({ id, name, price: 65, minutes: 60, questions: [] });
const DATA = { shopName: 'North Street Cycles', showPrices: true, full: [svc(11, 'Standard service')], categories: [], uncategorised: [] };
const KEPT = { draft: { serviceIds: [11], bikeNote: 'Trek Domane AL 3' }, savedAt: new Date(Date.now() - 86_400_000).toISOString(), step: 'problem' };
const BANNER = /You didn’t finish booking\./;

const problem = async (opts) => {
  current = await renderBookScreen({ file: 'screens/book/problem.js', exportName: 'ProblemScreen', at: 'problem', url: '/book/north/problem', services: DATA, ...opts });
  await current.ui.findByRole('heading', { level: 1, name: 'Tell us about your bike' });
  return current;
};

test('coming back: the banner as drawn, and everything typed still there', async () => {
  const { ui } = await problem({ later: KEPT });
  const text = await ui.findByText(BANNER);
  const banner = text.closest('[role="status"]');
  assert.ok(banner !== null, 'the banner isn’t a status');
  assert.match(banner.textContent, /You didn’t finish booking\. Carry on where you left off — everything you typed is still here\./);
  assert.ok(ui.getByRole('button', { name: 'Carry on' }));
  assert.ok(ui.getByRole('button', { name: 'Start again' }));
  assert.equal(ui.getByLabelText('Your bike (optional)').value, 'Trek Domane AL 3');
});

test('Carry on closes the banner', async () => {
  const { ui, fireEvent } = await problem({ later: KEPT }).then(async (c) => ({ ...c, fireEvent: (await import('@testing-library/react')).fireEvent }));
  fireEvent.click(ui.getByRole('button', { name: 'Carry on' }));
  assert.ok(ui.queryByText(BANNER) === null);
});

test('Start again clears it everywhere and goes to the first step', async () => {
  const c = await problem({ later: KEPT });
  const { fireEvent } = await import('@testing-library/react');
  fireEvent.click(c.ui.getByRole('button', { name: 'Start again' }));
  assert.ok(await c.ui.findByText('At /book/north'));
  assert.equal(window.localStorage.getItem('wh-book-draft-later:north'), null);
  assert.equal(window.sessionStorage.getItem('wh-book-draft:north'), null);
});

test('a refresh in the same tab shows no banner', async () => {
  const { ui } = await problem({ draft: { serviceIds: [11] }, later: KEPT });
  assert.ok(ui.queryByText(BANNER) === null);
});

test('opening the booking page goes to the step that was left', async () => {
  current = await renderBookScreen({ file: 'screens/book/service.js', exportName: 'ServiceScreen', at: '', url: '/book/north', services: DATA, later: KEPT });
  assert.ok(await current.ui.findByText('At /book/north/problem'));
});
