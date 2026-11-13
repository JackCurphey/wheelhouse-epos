// A receipt from the account's history (openspec/changes/finish-account design
// 3; ac-receipt, ac-receipt-sent; Jack's answers of 9 Nov 1 and 6, question 7):
// a till purchase's row opens "Your receipt", with one button, Email it to me.
// An older in-shop sale and a repair open no receipt. ?receipt=till-<id> opens
// it on arrival. Example data from the drawings; the rest bracketed.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { renderBookScreen } from '../helpers/book-screen.js';

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
const PAST = { kind: 'repair', jobId: 30, reference: 'WH-1042', title: 'Standard service', bikeLabel: 'Trek Domane AL 3', bikeId: 7, stage: 'collected', workStarted: true, jobDate: '2026-08-02', totalPence: 6500, at: '2026-08-02T10:00:00.000Z' };
const BUY = { kind: 'purchase', source: 'till', id: 41, receiptNumber: 42, number: 'B1-0042', what: 'Shimano brake pads', totalPence: 5600, at: '2026-08-25T09:05:00.000Z', receipt: { source: 'till', id: 41 } };
const OLD_BUY = { kind: 'purchase', source: 'old', id: 12, receiptNumber: null, number: null, what: 'Inner tube', totalPence: 1000, at: '2026-08-20T14:00:00.000Z', receipt: null };
const RECEIPT = {
  heading: 'Receipt', number: 'B1-0042', at: '2026-08-25T09:05:00.000Z',
  shop: { name: 'North Street Cycles', address: '[Shop address]', phone: '[shop phone]', vatNumber: '[VAT number]' },
  invoiceTo: null,
  lines: [{ name: 'Shimano brake pads', qty: 2, unitPence: 2800, totalPence: 5600 }],
  totalPence: 5600, vatLines: [{ ratePercent: 20, pence: 933 }],
  payments: [{ how: 'cash', pence: 2000 }, { how: 'card', pence: 3600 }],
};

const server = ({ me = ME, history = [BUY, OLD_BUY, PAST], email = () => ({ status: 200, body: { sentTo: 'maya@example.test' } }) } = {}) => (url, init) => {
  const { pathname } = new URL(url, 'http://localhost');
  if (!me) return { status: 401, body: { error: 'Not signed in' } };
  if (pathname.endsWith('/receipts/till/41/email')) return email();
  if (pathname.endsWith('/receipts/till/41')) return { status: 200, body: RECEIPT };
  if (pathname.includes('/receipts/')) return { status: 404, body: { error: 'We can’t find that receipt' } };
  if (pathname.endsWith('/me')) return { status: 200, body: me };
  if (pathname.endsWith('/bikes')) return { status: 200, body: [] };
  if (pathname.endsWith('/c2w-orders')) return { status: 200, body: [] };
  return { status: 200, body: history };
};
const open = async (opts, url = '/book/north/account') => {
  current = await renderBookScreen({ file: 'screens/book/account.js', exportName: 'AccountScreen', at: 'account', url, services: SERVICES, account: server(opts) });
  return current;
};
const rtl = () => import('@testing-library/react');

test('a till purchase’s row is a button reading “· receipt”; an older sale and a repair open no receipt (answer 1)', async () => {
  const { ui } = await open();
  const { within } = await rtl();
  const history = within(await ui.findByRole('region', { name: 'History' }));
  const row = await history.findByRole('button', { name: /B1-0042 · Shimano brake pads/ });
  assert.match(row.textContent, /Tue 25 Aug · in the shop · receipt/);
  assert.match(row.textContent, /£56\.00/);
  // The older sale: no button, no "receipt".
  const old = history.getByText(/Inner tube/).closest('div');
  assert.ok(within(old).queryByRole('button') === null);
  assert.doesNotMatch(old.textContent, /receipt/);
  // The repair still opens its own page.
  assert.equal(history.getByRole('link', { name: /WH-1042/ }).getAttribute('href'), '/book/north/booking/job-30');
});

test('choosing it opens Your receipt: number, date, shop; the body; the note and one button, no PDF', async () => {
  const { ui } = await open();
  const { within, fireEvent } = await rtl();
  fireEvent.click(await ui.findByRole('button', { name: /B1-0042 · Shimano brake pads/ }));
  const box = within(await ui.findByRole('dialog', { name: 'Your receipt' }));
  assert.ok(await box.findByText('B1-0042 · Tue 25 Aug 2026 · North Street Cycles'));
  assert.ok(box.getByText('[Shop address] · [shop phone]'));
  assert.ok(box.getByText('VAT number [VAT number]'));
  assert.ok(box.getByText('Receipt B1-0042'));
  assert.ok(box.getByText('25 Aug 2026 · 10:05'));
  const table = within(box.getByRole('table', { name: 'Items on this receipt' }));
  assert.ok(table.getByText('Shimano brake pads'));
  assert.ok(table.getByText('2 × £28.00'));
  for (const [k, v] of [['Total (includes VAT)', '£56.00'], ['VAT at 20%', '£9.33'], ['Paid by cash', '£20.00'], ['Paid by card', '£36.00']]) {
    assert.equal(table.getByText(k).closest('tr').textContent, `${k}${v}`, k);
  }
  assert.ok(box.getByText('“Email it to me” sends it to maya@example.test.'));
  assert.deepEqual(box.getAllByRole('button').filter((b) => b.getAttribute('aria-label') !== 'Close').map((b) => b.textContent), ['Email it to me']);
  assert.ok(box.queryByText(/PDF/) === null);
});

test('a company’s receipt reads Invoice, with Invoice to', async () => {
  const company = { ...RECEIPT, heading: 'Invoice', invoiceTo: { name: '[Company name]', address: '[Company address]', vatNumber: '[Company VAT number]' } };
  current = await renderBookScreen({
    file: 'screens/book/account.js', exportName: 'AccountScreen', at: 'account', url: '/book/north/account?receipt=till-41', services: SERVICES,
    account: (url, init) => (new URL(url, 'http://localhost').pathname.endsWith('/receipts/till/41') ? { status: 200, body: company } : server()(url, init)),
  });
  const { within } = await rtl();
  const box = within(await current.ui.findByRole('dialog', { name: 'Your receipt' }));
  assert.ok(await box.findByText('Invoice B1-0042'));
  assert.ok(box.getByText('Invoice to'));
  assert.ok(box.getByText('[Company name] · [Company address]'));
  assert.ok(box.getByText('VAT number [Company VAT number]'));
  assert.ok(box.getByRole('table', { name: 'Items on this invoice' }));
});

test('Email it to me: sent, the note becomes “Sent to maya@example.test”', async () => {
  const { ui, requests } = await open();
  const { within, fireEvent } = await rtl();
  fireEvent.click(await ui.findByRole('button', { name: /B1-0042 · Shimano brake pads/ }));
  const box = within(await ui.findByRole('dialog', { name: 'Your receipt' }));
  fireEvent.click(await box.findByRole('button', { name: 'Email it to me' }));
  assert.ok(await box.findByText('Sent to maya@example.test'));
  assert.ok(box.queryByText(/sends it to/) === null);
  const sent = requests.filter((r) => r.method === 'POST');
  assert.deepEqual(sent.map((r) => new URL(r.url, 'http://localhost').pathname), ['/api/portal/north/receipts/till/41/email']);
});

test('Email it to me failing says “That didn’t go through. Try again.”', async () => {
  const { ui } = await open({ email: () => ({ status: 500, body: { error: 'boom' } }) });
  const { within, fireEvent } = await rtl();
  fireEvent.click(await ui.findByRole('button', { name: /B1-0042 · Shimano brake pads/ }));
  const box = within(await ui.findByRole('dialog', { name: 'Your receipt' }));
  fireEvent.click(await box.findByRole('button', { name: 'Email it to me' }));
  assert.ok(await box.findByText('That didn’t go through. Try again.'));
  assert.ok(box.queryByText(/^Sent to/) === null);
});

test('?receipt=till-41 opens it on arrival; one that isn’t hers says “We can’t find that receipt”', async () => {
  const mine = await open(undefined, '/book/north/account?receipt=till-41');
  const { within } = await rtl();
  const box = within(await mine.ui.findByRole('dialog', { name: 'Your receipt' }));
  assert.ok(await box.findByText('Receipt B1-0042'));
  const { cleanup } = await rtl();
  cleanup();
  current.client.clear();
  current.uninstall();
  const notMine = await open(undefined, '/book/north/account?receipt=till-99');
  assert.ok(await notMine.ui.findByText('We can’t find that receipt'));
  assert.ok(notMine.ui.queryByRole('dialog') === null);
  assert.ok(notMine.ui.getByRole('heading', { level: 1, name: 'Your account' }));
});

test('signed out, the receipt’s address goes to sign in and back to the same address', async () => {
  const { ui } = await open({ me: null }, '/book/north/account?receipt=till-41');
  assert.ok(await ui.findByText(`At /book/north/sign-in?from=${encodeURIComponent('/book/north/account?receipt=till-41')}`));
});

// The walk against the specs (task 7.3): a receipt is kept with the rest of
// the account, so signing out forgets it, as it forgets her details, and the
// next person at a shared computer can't see it on the same address.
test('signing out forgets an opened receipt along with the rest of the account', async () => {
  const { ui, client } = await open({}, '/book/north/account?receipt=till-41');
  const { fireEvent, waitFor } = await rtl();
  await ui.findByRole('dialog', { name: 'Your receipt' });
  const receipts = () => client.getQueryCache().findAll().filter((q) => q.queryKey.includes('receipt'));
  assert.equal(receipts().length, 1);
  fireEvent.click(ui.getByRole('button', { name: 'Close' }));
  fireEvent.click(await ui.findByRole('button', { name: 'Sign out' }));
  await waitFor(() => assert.equal(receipts().length, 0));
});
