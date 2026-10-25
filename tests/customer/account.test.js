// The customer's account (openspec/changes/customer-account-screens; drawn as
// ac-account, ac-account-new, ac-account-repairs in account.mjs; account
// decisions 1, 6, 8 and 9; Jack's answers in docs/decisions/2026-10-26-customer-account.md).
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { renderBookScreen } from '../helpers/book-screen.js';
import { ACCOUNT_ROUTE } from '../../src/customer/routes.ts';

let current;
afterEach(async () => {
  if (!current) return;
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  current?.client.clear();
  current?.uninstall();
  current = undefined;
});

const SERVICES = { shopName: 'North Street Cycles', showPrices: true, full: [], categories: [], uncategorised: [] };
const ME = { id: 5, email: 'maya@example.test', name: 'Maya Patel', phone: '07700 900142', shopName: 'North Street Cycles', shopSlug: 'north', updateChannel: 'sms', serviceReminders: true, reviewRequests: true, marketingPermission: false };
const BIKES = [{ id: 7, make: 'Trek', model: 'Domane AL 3', colour: 'Green' }];
const NOW = { kind: 'repair', jobId: 42, reference: 'WH-1042', title: 'Standard service', bikeLabel: 'Trek Domane AL 3', bikeId: 7, stage: 'in_workshop', workStarted: false, jobDate: '2026-09-17', totalPence: null, at: '2026-09-17T09:00:00.000Z' };
const PAST = { kind: 'repair', jobId: 30, reference: 'WH-1030', title: 'Gear tune', bikeLabel: 'Trek Domane AL 3', bikeId: 7, stage: 'collected', workStarted: true, jobDate: '2026-06-02', totalPence: 3500, at: '2026-06-02T10:00:00.000Z' };
const BUY = { kind: 'purchase', source: 'till', id: 9, receiptNumber: 12, what: 'Pump', totalPence: 2500, at: '2026-08-21T10:00:00.000Z' };
const OLD_BUY = { kind: 'purchase', source: 'old', id: 41, receiptNumber: null, what: 'Inner tube × 2', totalPence: 1000, at: '2026-08-20T14:00:00.000Z' };

const accountServer = ({ me = ME, bikes = BIKES, history = [NOW, BUY, OLD_BUY, PAST] } = {}) => (url, init) => {
  const { pathname } = new URL(url, 'http://localhost');
  if (pathname.endsWith('/logout')) return { status: 200, body: { ok: true } };
  if (!me) return { status: 401, body: { error: 'Not signed in' } };
  if (pathname.endsWith('/me')) return { status: 200, body: me };
  if (pathname.endsWith('/bikes')) return { status: 200, body: bikes };
  return { status: 200, body: history };
};
const open = async (opts, media) => {
  current = await renderBookScreen({ file: 'screens/book/account.js', exportName: 'AccountScreen', at: 'account', url: '/book/north/account', services: SERVICES, account: accountServer(opts), media });
  return current;
};

test('the page lives under the shop’s booking pages', () => {
  assert.equal(ACCOUNT_ROUTE, '/book/:shopSlug/account');
});

test('signed out, it goes to sign in, and back here after', async () => {
  const { ui } = await open({ me: null });
  assert.ok(await ui.findByText(`At /book/north/sign-in?from=${encodeURIComponent('/book/north/account')}`));
});

test('the head: Your account, her name and email with Sign out, and Book a repair', async () => {
  const { ui } = await open();
  assert.ok(await ui.findByRole('heading', { level: 1, name: 'Your account' }));
  assert.ok(await ui.findByText(/Maya Patel · maya@example\.test/));
  assert.ok(ui.getByRole('button', { name: 'Sign out' }));
  assert.ok(ui.getAllByRole('link', { name: 'Book a repair' }).length >= 1);
  assert.equal(ui.queryByRole('button', { name: 'Ask the shop a question' }) === null, true, 'not built yet');
});

test('her bike, with the repair in now; her details; how the shop contacts her', async () => {
  const { ui, within } = await open().then((c) => ({ ...c, within: null }));
  const { within: w } = await import('@testing-library/react');
  const bikes = w(await ui.findByRole('region', { name: 'Your bikes' }));
  assert.ok(await bikes.findByText('Trek Domane AL 3 · Green'));
  assert.ok(bikes.getByText(/In the shop now · WH-1042/));
  const details = w(ui.getByRole('region', { name: 'Your details' }));
  for (const [k, v] of [['Name', 'Maya Patel'], ['Mobile', '07700 900142'], ['Email', 'maya@example.test'], ['Job updates', 'By text'], ['Service reminders', 'On'], ['Review requests', 'On'], ['Offers and news', 'Off']]) {
    assert.ok(details.getByText(k), k);
    assert.ok(details.getAllByText(v).length >= 1, `${k}: ${v}`);
  }
  assert.ok(details.getByRole('heading', { name: 'How we contact you' }));
  assert.equal(ui.queryByText('Store credit') === null, true, 'not built yet');
});

test('the history: Now first, then Earlier, newest first; each row as drawn; a repair opens its page', async () => {
  const { ui } = await open();
  const { within: w, fireEvent } = await import('@testing-library/react');
  const history = w(await ui.findByRole('region', { name: 'History' }));
  assert.ok(await history.findByRole('heading', { name: 'Now' }));
  assert.ok(history.getByRole('heading', { name: 'Earlier, newest first' }));
  const now = history.getByRole('link', { name: /WH-1042 · Trek Domane AL 3 · Standard service/ });
  assert.equal(now.getAttribute('href'), '/book/north/booking/job-42');
  assert.match(now.textContent, /Booked in Thu 17 Sep/);
  assert.match(now.textContent, /In the shop/);
  const past = history.getByRole('link', { name: /WH-1030 · Trek Domane AL 3 · Gear tune/ });
  assert.match(past.textContent, /Tue 2 Jun · collected/);
  assert.match(past.textContent, /£35\.00/);
  assert.ok(history.getByText(/12 · Pump/));
  assert.ok(history.getByText(/No\. 41 · Inner tube × 2/));
  assert.ok(history.getByText('£25.00'));
  const earlier = history.getAllByText(/^(No\. 41|12|WH-1030)/).map((n) => n.textContent.slice(0, 6));
  assert.deepEqual(earlier, ['12 · P', 'No. 41', 'WH-103'], 'newest first');
  fireEvent.click(history.getByRole('button', { name: 'Purchases' }));
  assert.equal(history.queryByRole('link', { name: /WH-1042/ }) === null, true);
  assert.ok(history.getByText(/12 · Pump/));
  fireEvent.click(history.getByRole('button', { name: 'Repairs' }));
  assert.equal(history.queryByText(/12 · Pump/) === null, true);
  assert.ok(history.getByRole('link', { name: /WH-1042/ }));
});

test('more than eight earlier: Show more shows the rest', async () => {
  const many = Array.from({ length: 11 }, (_, i) => ({ ...OLD_BUY, id: 100 + i, what: `Item ${i}`, at: `2026-08-${String(10 + i).padStart(2, '0')}T10:00:00.000Z` }));
  const { ui } = await open({ history: many });
  const { within: w, fireEvent } = await import('@testing-library/react');
  const history = w(await ui.findByRole('region', { name: 'History' }));
  await history.findByText(/Item 10/);
  assert.equal(history.getAllByText(/^No\. 1\d\d/).length, 8);
  fireEvent.click(history.getByRole('button', { name: 'Show more' }));
  assert.equal(history.getAllByText(/^No\. 1\d\d/).length, 11);
});

test('someone new: the drawn empty bikes and history', async () => {
  const { ui } = await open({ bikes: [], history: [] });
  assert.ok(await ui.findByText('No bikes yet. Add one to book it in faster.'));
  assert.ok(ui.getByText('Nothing here yet. Your repairs and purchases with North Street Cycles show here.'));
});

test('Sign out signs her out and goes to the shop’s booking page', async () => {
  const { ui, requests } = await open();
  const { fireEvent } = await import('@testing-library/react');
  fireEvent.click(await ui.findByRole('button', { name: 'Sign out' }));
  assert.ok(await ui.findByText('At /book/north'));
  assert.ok(requests.some((r) => r.method === 'POST' && r.url.endsWith('/api/portal/north/logout')));
});
