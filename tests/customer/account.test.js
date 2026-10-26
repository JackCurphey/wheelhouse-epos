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
  if (pathname.endsWith('/me/contact')) {
    const body = JSON.parse(init.body);
    if (body.updateChannel === 'whatsapp' && !me.phone) return { status: 400, body: { error: 'We don’t have a mobile number for you, so we can’t text you.' } };
    me = { ...me, ...body };
    return { status: 200, body: me };
  }
  if (pathname.endsWith('/me')) return { status: 200, body: me };
  if (pathname.endsWith('/bikes') && init?.method === 'POST') {
    const made = { id: 70, ...JSON.parse(init.body) };
    bikes = [...bikes, made];
    return { status: 201, body: made };
  }
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

test('signed out on any one of its three reads, it still goes to sign in', async () => {
  current = await renderBookScreen({
    file: 'screens/book/account.js', exportName: 'AccountScreen', at: 'account', url: '/book/north/account', services: SERVICES,
    account: (url, init) => (new URL(url, 'http://localhost').pathname.endsWith('/history') ? { status: 401, body: { error: 'Not signed in' } } : accountServer()(url, init)),
  });
  assert.ok(await current.ui.findByText(`At /book/north/sign-in?from=${encodeURIComponent('/book/north/account')}`));
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
  // Each value on its own row, beside its label.
  for (const [k, v] of [['Name', 'Maya Patel'], ['Mobile', '07700 900142'], ['Email', 'maya@example.test'], ['Job updates', 'By text'], ['Service reminders', 'On'], ['Review requests', 'On'], ['Offers and news', 'Off']]) {
    assert.equal(details.getByText(k).parentElement.textContent, `${k}${v}`, k);
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

test('when Sign out doesn’t go through, it says so and she can press it again', async () => {
  current = await renderBookScreen({
    file: 'screens/book/account.js', exportName: 'AccountScreen', at: 'account', url: '/book/north/account', services: SERVICES,
    account: (url, init) => (new URL(url, 'http://localhost').pathname.endsWith('/logout') ? { status: 500, body: { error: 'down' } } : accountServer()(url, init)),
  });
  const { fireEvent } = await import('@testing-library/react');
  fireEvent.click(await current.ui.findByRole('button', { name: 'Sign out' }));
  assert.equal((await current.ui.findByRole('alert')).textContent, 'That didn’t go through. Check your connection and try again.');
  assert.equal(current.ui.getByRole('button', { name: 'Sign out' }).disabled, false);
  assert.ok(current.ui.getByRole('heading', { level: 1, name: 'Your account' }), 'still on the account');
});

// Adding a bike (openspec/changes/add-a-bike; ac-account's "+ Add a bike";
// not-drawn pages 16: "A different bike" on the booking's bike step).
test('+ Add a bike opens Add a bike with the booking’s bike fields; the bike shows at once', async () => {
  const { ui, requests } = await open({ bikes: [] });
  const { within: w, fireEvent } = await import('@testing-library/react');
  const bikes = w(await ui.findByRole('region', { name: 'Your bikes' }));
  fireEvent.click(bikes.getByRole('button', { name: '+ Add a bike' }));
  const box = w(await ui.findByRole('dialog', { name: 'Add a bike' }));
  fireEvent.change(box.getByLabelText('Make and model'), { target: { value: 'Brompton C Line' } });
  fireEvent.change(box.getByLabelText('Colour, or anything that helps us spot it'), { target: { value: 'Black' } });
  fireEvent.click(box.getByRole('button', { name: 'Add bike' }));
  assert.ok(await bikes.findByText('Brompton C Line · Black'));
  const post = requests.find((r) => r.method === 'POST' && r.url.endsWith('/api/portal/north/bikes'));
  assert.deepEqual(post.body, { make: 'Brompton C Line', model: '', colour: 'Black' });
});

// Review of add-a-bike: the link-style "+ Add a bike" under existing bikes, and the box closes once added.
test('with bikes already, + Add a bike under them adds another and the box closes', async () => {
  const { ui } = await open();
  const { within: w, fireEvent } = await import('@testing-library/react');
  const bikes = w(await ui.findByRole('region', { name: 'Your bikes' }));
  await bikes.findByText('Trek Domane AL 3 · Green');
  fireEvent.click(bikes.getByRole('button', { name: '+ Add a bike' }));
  const box = w(await ui.findByRole('dialog', { name: 'Add a bike' }));
  fireEvent.change(box.getByLabelText('Make and model'), { target: { value: 'Brompton C Line' } });
  fireEvent.click(box.getByRole('button', { name: 'Add bike' }));
  assert.ok(await bikes.findByText('Brompton C Line'));
  assert.ok(ui.queryByRole('dialog') === null, 'the box closes');
});

// next-service-due design 3 (ac-account, audit L10): the reminder's day, only while reminders are on.
test('each bike says when its next service is due, joined to In the shop now; nothing with reminders off', async () => {
  const bikesDue = [{ ...BIKES[0], nextServiceDue: '2027-03-17' }, { id: 8, make: 'Brompton', model: 'C Line', colour: 'Black', nextServiceDue: '2027-05-04' }];
  let { ui } = await open({ bikes: bikesDue });
  const { within: w } = await import('@testing-library/react');
  let bikes = w(await ui.findByRole('region', { name: 'Your bikes' }));
  assert.ok(await bikes.findByText('In the shop now · WH-1042 · next service due Wed 17 Mar 2027'));
  assert.ok(bikes.getByText('Next service due Tue 4 May 2027'));
  const { cleanup } = await import('@testing-library/react');
  cleanup(); current.client.clear(); current.uninstall();
  ({ ui } = await open({ bikes: bikesDue, me: { ...ME, serviceReminders: false } }));
  bikes = w(await ui.findByRole('region', { name: 'Your bikes' }));
  await bikes.findByText('Brompton C Line · Black');
  assert.ok(bikes.queryByText(/next service due/i) === null);
});



// How we contact you (openspec/changes/how-we-contact-you; ac-contact, ac-contact-changed; decision 6).
test('Change opens the drawn box; a switch saves at once and says so; the way saves; the account follows', async () => {
  const { ui, requests } = await open();
  const { within: w, fireEvent } = await import('@testing-library/react');
  const details = w(await ui.findByRole('region', { name: 'Your details' }));
  fireEvent.click(details.getByRole('button', { name: 'Change how we contact you' }));
  const box = w(await ui.findByRole('dialog', { name: 'How we contact you' }));
  assert.ok(box.getByText('Changes save straight away'));
  assert.ok(box.getByText('Bookings, quotes, and when your bike is ready. You can change how — they can’t be switched off while a bike is with us.'));
  assert.equal(box.getByRole('radio', { name: 'Text' }).getAttribute('aria-checked'), 'true');
  assert.ok(box.getByRole('radio', { name: 'WhatsApp' }));
  const reminders = box.getByRole('switch', { name: 'Service reminders' });
  assert.equal(reminders.getAttribute('aria-checked'), 'true');
  assert.equal(box.getByRole('switch', { name: 'Offers and news' }).getAttribute('aria-checked'), 'false');
  assert.ok(box.getByText('Each of these ends with “Stop these”, which switches that one off without signing in.'));
  fireEvent.click(reminders);
  assert.equal((await box.findByRole('status')).textContent, 'Service reminders are off');
  assert.equal(reminders.getAttribute('aria-checked'), 'false');
  fireEvent.click(box.getByRole('radio', { name: 'Email' }));
  await box.findByText('Job updates will come by email');
  assert.equal(box.getByRole('radio', { name: 'Email' }).getAttribute('aria-checked'), 'true');
  const puts = requests.filter((r) => r.method === 'PUT').map((r) => r.body);
  assert.deepEqual(puts, [{ serviceReminders: false }, { updateChannel: 'email' }]);
  fireEvent.click(box.getByRole('button', { name: 'Done' }));
  assert.equal(details.getByText('Service reminders').parentElement.textContent, 'Service remindersOff');
  assert.equal(details.getByText('Job updates').parentElement.textContent, 'Job updatesBy email');
});

test('a choice the shop refuses says why, and nothing changes', async () => {
  const { ui } = await open({ me: { ...ME, phone: null } });
  const { within: w, fireEvent } = await import('@testing-library/react');
  const details = w(await ui.findByRole('region', { name: 'Your details' }));
  fireEvent.click(details.getByRole('button', { name: 'Change how we contact you' }));
  const box = w(await ui.findByRole('dialog', { name: 'How we contact you' }));
  fireEvent.click(box.getByRole('radio', { name: 'WhatsApp' }));
  assert.equal((await box.findByRole('alert')).textContent, 'We don’t have a mobile number for you, so we can’t text you.');
  assert.equal(box.getByRole('radio', { name: 'WhatsApp' }).getAttribute('aria-checked'), 'false');
});

// Review of how-we-contact-you, 1 and 4: WhatsApp keeps its capital; a sign-in that ran out says so.
test('WhatsApp is written WhatsApp; a sign-in that ran out says to sign in again', async () => {
  const { ui } = await open({ me: { ...ME, updateChannel: 'whatsapp' } });
  const { within: w, fireEvent } = await import('@testing-library/react');
  const details = w(await ui.findByRole('region', { name: 'Your details' }));
  assert.equal(details.getByText('Job updates').parentElement.textContent, 'Job updatesBy WhatsApp');
  fireEvent.click(details.getByRole('button', { name: 'Change how we contact you' }));
  const box = w(await ui.findByRole('dialog', { name: 'How we contact you' }));
  fireEvent.click(box.getByRole('radio', { name: 'Text' }));
  await box.findByText('Job updates will come by text');
  fireEvent.click(box.getByRole('radio', { name: 'WhatsApp' }));
  await box.findByText('Job updates will come by WhatsApp');
});

test('a change after the sign-in ran out says to sign in again', async () => {
  current = await renderBookScreen({
    file: 'screens/book/account.js', exportName: 'AccountScreen', at: 'account', url: '/book/north/account', services: SERVICES,
    account: (url, init) => (new URL(url, 'http://localhost').pathname.endsWith('/me/contact') ? { status: 401, body: { error: 'Not signed in' } } : accountServer()(url, init)),
  });
  const { within: w, fireEvent } = await import('@testing-library/react');
  const details = w(await current.ui.findByRole('region', { name: 'Your details' }));
  fireEvent.click(details.getByRole('button', { name: 'Change how we contact you' }));
  const box = w(await current.ui.findByRole('dialog', { name: 'How we contact you' }));
  fireEvent.click(box.getByRole('switch', { name: 'Offers and news' }));
  assert.equal((await box.findByRole('alert')).textContent, 'Please sign in again to change this.');
});
