// Front desk › Cycle to Work › Owed by providers, one provider's bikes owed, and
// Record a payment (openspec/changes/cycle-to-work task 8's owed screens, PR 8e;
// c2w.mjs owedPage, owedProvider, recordPayment: cw-owed, cw-owed-reports,
// cw-owed-provider, cw-record-payment, cw-record-payment-more, cw-list-owner).
// Example data from the drawing: North Street Cycles, Jack Lewis, Jo Taylor,
// Maya Patel. Providers, customers and certificate numbers stay bracketed; dates
// and amounts are visibly test values.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const OWNER = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const JO = { id: 2, name: 'Jo Taylor', email: 'jo@example.com', isOwner: false, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const PROVIDER = { id: 3, name: '[Provider]', paysInDays: 30, accessoriesInside: true, commissionKind: 'percent', commissionValue: 500, handoverNote: '', handoverChecks: [], retiredAt: null };
const SETTINGS = { holdDays: 7, remindDays: 2, quoteValidDays: 30, orderRule: 'certificate', howToApply: '[The shop’s own words]', paymentLateDays: 7 };

const TODAY = '2026-09-14';
const day = (n) => { const d = new Date(`${TODAY}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const long = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

// Two bikes owed by [Provider], oldest expected first, as server/c2w/money.js owedOrders sends them:
// [Customer]'s is 3 days late (£400.00 certificate, £380.00 expected); Maya's is due in 10 days (£800.00, £760.00).
const bike = (over) => ({ providerId: 3, providerName: '[Provider]', certificateNumber: '[certificate number]', paidPence: null, ...over });
const LATE = bike({ id: 10, customerName: '[Customer]', collectedOn: day(-33), certificatePence: 40000, expectedPence: 38000, owedPence: 38000, expectedBy: day(-3), lateDays: 3 });
const MAYA = bike({ id: 9, customerName: 'Maya Patel', collectedOn: day(-20), certificatePence: 80000, expectedPence: 76000, owedPence: 76000, expectedBy: day(10), lateDays: null });
const OWED = {
  providers: [
    { id: 3, name: '[Provider]', bikes: 2, owedPence: 114000, latePence: 38000, lateDays: 3 },
    { id: 4, name: '[Other provider]', bikes: 1, owedPence: 20000, latePence: 0, lateDays: null },
  ],
  total: { bikes: 3, owedPence: 134000, latePence: 38000 },
  today: TODAY,
};
// A whole order as the list sends it, for the list's own rows.
const listOrder = (b) => ({
  id: b.id, stage: 'collected', quoteRef: `CW-${b.id}`, customerId: b.id + 100, customerName: b.customerName, customerPhone: null, customerEmail: null,
  providerId: 3, providerName: '[Provider]', productId: 21, bike: '[Bike] · [Size]', siteName: 'Bolton', onOrder: false,
  quoteGivenAt: `${day(-40)}T10:00:00.000Z`, quoteRevisedAt: null, validUntil: day(-10), holdUntil: null, holdWanted: true,
  accessories: [], totalPence: b.certificatePence, appliedAt: null, applicationReference: null, certificateNumber: b.certificateNumber, certificatePence: b.certificatePence,
  certificateReceivedOn: day(-35), collectedAt: `${b.collectedOn}T09:00:00.000Z`, paidOn: null, inStock: true,
  expectedPence: b.expectedPence, expectedBy: b.expectedBy, paidPence: b.paidPence, next: 'paid',
});
const LIST = (counts = {}) => ({
  groups: { waiting: [], certificate: [], ready: [], collected: [listOrder(LATE), listOrder(MAYA)], paid: [] },
  counts: { holdEndingSoon: 0, holdEnded: 0, readyToOrder: 0, noCertificate: 0, paymentLate: 1, owedPence: 134000, ...counts },
  count: 2, providers: 1, today: TODAY,
});

const realFetch = globalThis.fetch;
let uninstall;
let shell;
let calls;
let state;
let rendered = false;
afterEach(async () => {
  if (!rendered) return;
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  shell?.queryClient.clear();
  uninstall?.();
  globalThis.fetch = realFetch;
  rendered = false;
});

/**
 * `pay` answers POST /api/c2w/providers/3/payments, `paid` POST /api/c2w/orders/:id/paid,
 * each with [status, body]; either may change `state.orders`, which the pages then reload.
 */
async function open(url, { user = OWNER, orders = [LATE, MAYA], owed = OWED, list = LIST(), pay, paid } = {}) {
  calls = [];
  state = { orders, owed };
  globalThis.fetch = async (u, init = {}) => {
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url: String(u), method, body });
    const reply = (status, b) => ({ status, ok: status < 300, json: async () => b });
    const p = new URL(u, 'http://localhost').pathname;
    const costs = user.isOwner;
    const noCosts = { error: 'Only someone who can see costs can see what Cycle to Work providers owe', code: 'costs_only' };
    if (p === '/api/auth/me') return reply(200, user);
    if (p === '/api/c2w/count') return reply(200, { count: 2 });
    if (p === '/api/c2w/settings') return reply(200, { settings: SETTINGS });
    if (p === '/api/c2w/providers') return reply(200, { providers: [PROVIDER] });
    if (method === 'POST' && p === '/api/c2w/providers/3/payments' && pay) { const [s, b] = await pay(body); return reply(s, b); }
    if (method === 'POST' && /^\/api\/c2w\/orders\/\d+\/paid$/.test(p) && paid) { const [s, b] = await paid(body, Number(p.split('/')[4])); return reply(s, b); }
    if (method === 'POST') return reply(404, { error: 'Not found' });
    if (p === '/api/c2w/orders') return reply(200, list);
    if (p === '/api/c2w/owed') return costs ? reply(200, state.owed) : reply(403, noCosts);
    if (p === '/api/c2w/providers/3/owed') {
      return costs ? reply(200, { provider: { id: 3, name: '[Provider]', commissionKind: 'percent', commissionValue: 500, paysInDays: 30 }, orders: state.orders, today: TODAY }) : reply(403, noCosts);
    }
    const one = p.match(/^\/api\/c2w\/orders\/(\d+)$/);
    if (one) {
      const b = state.orders.find((o) => o.id === Number(one[1]));
      return b ? reply(200, { order: { ...listOrder(b), events: [] }, today: TODAY }) : reply(200, { order: { ...listOrder(MAYA), id: Number(one[1]), stage: 'paid', next: null, events: [] }, today: TODAY });
    }
    if (p.startsWith('/api/')) return reply(200, []);
    return reply(404, { error: 'Not found' });
  };
  uninstall = installDom(`http://localhost${url}`);
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { if (this.open) { this.open = false; this.dispatchEvent(new window.Event('close')); } };
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  shell = await importFresh(SHELL);
  rendered = true;
  const ui = rtl.render(createElement(shell.AppShell));
  return { ...rtl, ui };
}
const posts = (end) => calls.filter((c) => c.method === 'POST' && c.url.endsWith(end));
const para = (text) => (_, el) => el?.tagName === 'P' && el.textContent === text;
// The page's own way back, not the sidebar's link of the same name.
const back = (ui, name) => ui.queryAllByRole('link', { name }).find((a) => a.textContent.startsWith('‹'));
const rowText = (row) => [...row.querySelectorAll('th, td')].map((c) => c.textContent.trim());
const openRecord = async (ui, fireEvent) => {
  fireEvent.click(await ui.findByRole('button', { name: 'Record a payment' }));
  return ui.findByRole('dialog', { name: 'Record a payment' });
};
const typeAmount = (box, fireEvent, value) => fireEvent.change(box.getByRole('textbox', { name: 'Amount received' }), { target: { value } });

test('cw-list-owner: the owner’s list links what’s owed to the Owed page, and each collected row has Mark paid', async () => {
  const { ui, fireEvent } = await open('/workshop/c2w');
  const link = await ui.findByRole('link', { name: 'Owed by providers £1,340.00 · 1 late' });
  assert.equal(link.getAttribute('href'), '/workshop/c2w/owed');
  assert.ok(ui.getByRole('button', { name: 'Mark paid: Maya Patel · [Provider]' }));
  assert.ok(ui.getByRole('button', { name: 'Mark paid: [Customer] · [Provider]' }));
  // The name still opens the order; the row's own Open link gives way to Mark paid.
  assert.equal(ui.getAllByRole('link', { name: 'Open Maya Patel’s order' }).length, 1);
  assert.ok(ui.queryByRole('link', { name: 'Open [Customer]’s late order' }) === null);
  fireEvent.click(ui.getByRole('button', { name: 'Mark paid: Maya Patel · [Provider]' }));
  const box = await ui.findByRole('dialog', { name: 'Mark paid' });
  assert.equal(box.querySelector('#mp-amount').value, '760.00');
});

test('cw-list: someone who can’t see costs gets no owed link and Open on collected rows, as before', async () => {
  const list = LIST();
  delete list.counts.owedPence;
  const { ui } = await open('/workshop/c2w', { user: JO, list });
  assert.equal((await ui.findAllByRole('link', { name: 'Open Maya Patel’s order' })).length, 2, 'the name and the row’s Open link');
  assert.ok(ui.getByRole('link', { name: 'Open [Customer]’s late order' }));
  assert.ok(ui.queryByRole('button', { name: /^Mark paid/ }) === null);
  assert.ok(ui.queryByRole('link', { name: /^Owed by providers/ }) === null);
});

test('cw-owed: each provider’s bikes, owed and late, with the total; Download as spreadsheet; back to Cycle to Work', async () => {
  const { ui, within } = await open('/workshop/c2w/owed');
  assert.ok(await ui.findByRole('heading', { name: 'Owed by Cycle to Work providers' }));
  assert.ok(ui.getByText('Bikes collected, not yet paid for · North Street Cycles'));
  assert.equal(back(ui, 'Cycle to Work').getAttribute('href'), '/workshop/c2w');
  assert.equal((await ui.findByRole('link', { name: 'Download as spreadsheet' })).getAttribute('href'), '/api/c2w/owed.csv');
  const rows = within(ui.getByRole('table')).getAllByRole('row');
  assert.deepEqual(rows.map(rowText), [
    ['Provider', 'Bikes', 'Owed', 'Late'],
    ['[Provider]', '2', '£1,140.00', '£380.00 · 3 days'],
    ['[Other provider]', '1', '£200.00', '—'],
    ['Total', '', '£1,340.00', ''],
  ]);
  const open3 = ui.getByRole('link', { name: '[Provider]: bikes owed and Record a payment' });
  assert.equal(open3.getAttribute('href'), '/workshop/c2w/owed/3');
  assert.ok(ui.getByText('Open a provider to record a payment that covers several bikes.'));
});

test('cw-owed-reports: opened from Reports, the way back is Reports', async () => {
  const { ui } = await open('/workshop/reports/c2w-owed');
  assert.ok(await ui.findByRole('heading', { name: 'Owed by Cycle to Work providers' }));
  assert.equal(back(ui, 'Reports').getAttribute('href'), '/workshop/reports');
  assert.equal(back(ui, 'Cycle to Work'), undefined);
});

test('cw-owed: with nothing owed it says so', async () => {
  const { ui } = await open('/workshop/c2w/owed', { owed: { providers: [], total: { bikes: 0, owedPence: 0, latePence: 0 }, today: TODAY } });
  assert.ok(await ui.findByText('Nothing is owed by Cycle to Work providers just now.'));
  assert.ok(ui.queryByRole('table') === null);
});

test('cw-owed: someone who can’t see costs is told why, and sees no amounts', async () => {
  const { ui } = await open('/workshop/c2w/owed', { user: JO });
  assert.ok(await ui.findByText('Only someone who can see costs can see what Cycle to Work providers owe'));
  assert.ok(ui.queryByRole('table') === null);
});

test('cw-owed-provider: the provider’s bikes owed, oldest expected first, with Mark paid on each and Record a payment', async () => {
  const { ui, within } = await open('/workshop/c2w/owed/3');
  assert.ok(await ui.findByRole('heading', { name: '[Provider] · 2 bikes owed' }));
  assert.ok(ui.getByText('Commission 5% · pays in about 30 days · North Street Cycles'));
  assert.equal(back(ui, 'Owed by Cycle to Work providers').getAttribute('href'), '/workshop/c2w/owed');
  assert.ok(ui.getByRole('button', { name: 'Record a payment' }));
  const rows = within(ui.getByRole('table')).getAllByRole('row');
  assert.deepEqual(rows.map(rowText), [
    ['Customer', 'Collected', 'Certificate', 'Expected', 'Late', 'Action'],
    ['[Customer]', long(day(-33)), '[certificate number]', `£380.00 by ${long(day(-3))}`, '3 days late', 'Mark paid'],
    ['Maya Patel', long(day(-20)), '[certificate number]', `£760.00 by ${long(day(10))}`, '', 'Mark paid'],
    ['Total', '', '', '£1,140.00', '', ''],
  ]);
  assert.equal(ui.getByRole('link', { name: 'Maya Patel' }).getAttribute('href'), '/workshop/c2w/9');
  assert.ok(ui.getByRole('button', { name: 'Mark paid: Maya Patel · [Provider]' }));
  assert.ok(ui.getByText('“Record a payment” is for one payment that covers several bikes. “Mark paid” on a row is still there for one bike.'));
});

test('cw-owed-provider: Mark paid on a row pays that one bike, and the row goes', async () => {
  const { ui, within, fireEvent, waitFor } = await open('/workshop/c2w/owed/3', {
    paid: (body, id) => { state.orders = state.orders.filter((o) => o.id !== id); return [200, { order: {} }]; },
  });
  fireEvent.click(await ui.findByRole('button', { name: 'Mark paid: Maya Patel · [Provider]' }));
  const box = within(await ui.findByRole('dialog', { name: 'Mark paid' }));
  assert.equal(box.getByRole('textbox', { name: 'Amount received' }).value, '760.00');
  fireEvent.click(box.getByRole('button', { name: 'Mark paid' }));
  await waitFor(() => assert.ok(ui.queryByRole('dialog', { name: 'Mark paid' }) === null));
  await waitFor(() => assert.equal(document.activeElement?.id, 'cw-owed-h', 'focus goes to the page’s heading'));
  assert.equal(posts('/api/c2w/orders/9/paid').length, 1);
  assert.equal(posts('/api/c2w/orders/9/paid')[0].body.owedPence, 76000);
  assert.ok(await ui.findByRole('heading', { name: '[Provider] · 1 bike owed' }));
  assert.ok(ui.queryByRole('button', { name: 'Mark paid: Maya Patel · [Provider]' }) === null);
  assert.ok(await ui.findByText('Marked paid.'));
});

test('cw-record-payment: every bike ticked at its total; it matches, says where it goes, and Save pays them', async () => {
  const { ui, within, fireEvent, waitFor } = await open('/workshop/c2w/owed/3', {
    pay: () => { state.orders = []; return [200, { expectedPence: 114000, receivedPence: 114000, differencePence: 0, orders: [] }]; },
  });
  const dlg = await openRecord(ui, fireEvent);
  const box = within(dlg);
  assert.ok(box.getByText('[Provider] · 2 bikes owed'));
  assert.equal(box.getByRole('textbox', { name: 'Amount received' }).value, '1140.00');
  assert.equal(box.getByLabelText('Received on').value, TODAY);
  assert.equal(box.getByRole('textbox', { name: 'Provider’s reference' }).value, '');
  const group = within(box.getByRole('group', { name: 'Which bikes it covers' }));
  const maya = group.getByRole('checkbox', { name: 'Maya Patel' });
  assert.ok(maya.checked && group.getByRole('checkbox', { name: '[Customer]' }).checked);
  assert.ok(group.getByText(`Certificate [certificate number] · expected £760.00 by ${long(day(10))}`));
  assert.ok(box.getByText('Expected for the ticked bikes').parentElement.textContent.includes('£1,140.00'));
  assert.ok(box.getByText('Difference').parentElement.textContent.includes('£0.00'));
  assert.ok(box.getByText(para('Matches the 2 ticked bikes. Saving marks each one paid. If a payment is less, the bikes it doesn’t fully cover are saved as part paid.')));
  assert.ok(box.getByText('This goes in each ticked order’s history and the activity log.'));
  assert.ok(box.getByText('It goes to your accounts software with that day’s figures, as “[Provider] paid £1,140.00 · commission £60.00”.'));
  fireEvent.change(box.getByRole('textbox', { name: 'Provider’s reference' }), { target: { value: '[reference]' } });
  fireEvent.click(box.getByRole('button', { name: 'Save' }));
  await waitFor(() => assert.ok(ui.queryByRole('dialog', { name: 'Record a payment' }) === null));
  const sent = posts('/api/c2w/providers/3/payments');
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].body, { amountPence: 114000, receivedOn: TODAY, reference: '[reference]', orderIds: [10, 9], expectedPence: 114000 });
  assert.ok(await ui.findByText('Recorded £1,140.00 from [Provider] for 2 bikes.'));
});

test('cw-record-payment-more: one bike unticked and more received than expected; Save as paid, the extra noted', async () => {
  const { ui, within, fireEvent, waitFor } = await open('/workshop/c2w/owed/3', {
    pay: () => { state.orders = [MAYA]; return [200, { expectedPence: 38000, receivedPence: 40000, differencePence: 2000, orders: [] }]; },
  });
  const box = within(await openRecord(ui, fireEvent));
  fireEvent.click(box.getByRole('checkbox', { name: 'Maya Patel' }));
  assert.equal(box.getByRole('textbox', { name: 'Amount received' }).value, '1140.00', 'the typed amount is the remittance’s, so unticking leaves it');
  typeAmount(box, fireEvent, '400');
  assert.ok(box.getByText('Expected for the ticked bikes').parentElement.textContent.includes('£380.00'));
  assert.ok(box.getByText('Difference').parentElement.textContent.includes('+£20.00'));
  assert.ok(box.getByText(para('£20.00 more than expected — check with [Provider]. Saving marks each ticked bike paid, and the extra £20.00 is noted on the payment.')));
  assert.ok(box.getByText('It goes to your accounts software with that day’s figures, as “[Provider] paid £400.00 · commission £20.00”.'));
  assert.ok(box.queryByRole('button', { name: 'Save' }) === null);
  fireEvent.click(box.getByRole('button', { name: 'Save as paid' }));
  await waitFor(() => assert.ok(ui.queryByRole('dialog', { name: 'Record a payment' }) === null));
  assert.deepEqual(posts('/api/c2w/providers/3/payments')[0].body, { amountPence: 40000, receivedOn: TODAY, orderIds: [10], expectedPence: 38000 });
  assert.ok(await ui.findByRole('heading', { name: '[Provider] · 1 bike owed' }));
});

test('cw-record-payment: less than expected says it goes on the oldest bike first, the rest part paid', async () => {
  const { ui, within, fireEvent } = await open('/workshop/c2w/owed/3');
  const box = within(await openRecord(ui, fireEvent));
  typeAmount(box, fireEvent, '1000');
  assert.ok(box.getByText('Difference').parentElement.textContent.includes('-£140.00'));
  assert.ok(box.getByText(para('£140.00 less than expected. It goes on the oldest bike first; the bikes it doesn’t fully cover are saved as part paid.')));
  assert.ok(box.getByRole('button', { name: 'Save' }));
});

test('cw-record-payment: with no bikes ticked, Save says to tick them and nothing is sent; a bad amount is refused too', async () => {
  const { ui, within, fireEvent } = await open('/workshop/c2w/owed/3');
  const box = within(await openRecord(ui, fireEvent));
  fireEvent.click(box.getByRole('checkbox', { name: 'Maya Patel' }));
  fireEvent.click(box.getByRole('checkbox', { name: '[Customer]' }));
  fireEvent.click(box.getByRole('button', { name: 'Save' }));
  assert.ok(await box.findByText('Tick the bikes this payment is for'));
  fireEvent.click(box.getByRole('checkbox', { name: 'Maya Patel' }));
  typeAmount(box, fireEvent, 'lots');
  fireEvent.click(box.getByRole('button', { name: 'Save' }));
  assert.ok(await box.findByText('Pounds and pence, like 5.00'));
  assert.equal(posts('/api/c2w/providers/3/payments').length, 0);
  fireEvent.click(box.getByRole('button', { name: 'Cancel' }));
  assert.ok(ui.queryByRole('dialog', { name: 'Record a payment' }) === null);
});

test('cw-record-payment: if what’s owed changed meanwhile, it says so, catches up, and keeps the amount typed', async () => {
  let first = true;
  const { ui, within, fireEvent, waitFor } = await open('/workshop/c2w/owed/3', {
    pay: () => {
      if (first) {
        first = false;
        // Someone saved £500.00 of Maya's as part paid meanwhile: still owed, for less.
        // (A bike paid in full elsewhere is not_owed, tested below.)
        state.orders = [LATE, { ...MAYA, paidPence: 50000, owedPence: 26000 }];
        return [409, { error: 'What’s owed has changed since you opened this. Refresh to see what’s owed now.', code: 'owed_changed' }];
      }
      state.orders = [];
      return [200, { expectedPence: 64000, receivedPence: 64000, differencePence: 0, orders: [] }];
    },
  });
  const box = within(await openRecord(ui, fireEvent));
  typeAmount(box, fireEvent, '640');
  fireEvent.click(box.getByRole('button', { name: 'Save' }));
  assert.ok(await box.findByText('What’s owed has changed since you opened this. Refresh to see what’s owed now.'));
  await waitFor(() => assert.ok(box.getByText('Expected for the ticked bikes').parentElement.textContent.includes('£640.00')));
  assert.equal(box.getByRole('textbox', { name: 'Amount received' }).value, '640');
  assert.ok(box.getByRole('checkbox', { name: 'Maya Patel' }).checked);
  assert.ok(box.getByText('[Provider] · 2 bikes owed'));
  assert.ok(box.getByText(para('Matches the 2 ticked bikes. Saving marks each one paid. If a payment is less, the bikes it doesn’t fully cover are saved as part paid.')));
  fireEvent.click(box.getByRole('button', { name: 'Save' }));
  await waitFor(() => assert.ok(ui.queryByRole('dialog', { name: 'Record a payment' }) === null));
  assert.deepEqual(posts('/api/c2w/providers/3/payments').map((c) => [c.body.orderIds, c.body.expectedPence]), [[[10, 9], 114000], [[10, 9], 64000]]);
});

test('cw-record-payment: if a ticked bike stopped being owed meanwhile, it catches up the same way', async () => {
  let first = true;
  const NOT_OWED = 'Some of the ticked bikes aren’t owed by this provider any more. Refresh to see what’s owed now.';
  const { ui, within, fireEvent, waitFor } = await open('/workshop/c2w/owed/3', {
    pay: () => {
      if (first) {
        first = false;
        // Someone marked Maya's bike paid from her order meanwhile.
        state.orders = [LATE];
        return [409, { error: NOT_OWED, code: 'not_owed' }];
      }
      state.orders = [];
      return [200, { expectedPence: 38000, receivedPence: 38000, differencePence: 0, orders: [] }];
    },
  });
  const box = within(await openRecord(ui, fireEvent));
  typeAmount(box, fireEvent, '380');
  fireEvent.click(box.getByRole('button', { name: 'Save' }));
  assert.ok(await box.findByText(NOT_OWED));
  await waitFor(() => assert.ok(box.queryByRole('checkbox', { name: 'Maya Patel' }) === null));
  assert.equal(box.getByRole('textbox', { name: 'Amount received' }).value, '380');
  fireEvent.click(box.getByRole('button', { name: 'Save' }));
  await waitFor(() => assert.ok(ui.queryByRole('dialog', { name: 'Record a payment' }) === null));
  assert.deepEqual(posts('/api/c2w/providers/3/payments').map((c) => c.body.orderIds), [[10, 9], [10]]);
});

test('cw-record-payment: with no certificate amount on a ticked bike, there is no commission to show, so no accounts line', async () => {
  const { ui, within, fireEvent } = await open('/workshop/c2w/owed/3', { orders: [LATE, { ...MAYA, certificatePence: null }] });
  const box = within(await openRecord(ui, fireEvent));
  assert.ok(box.getByText('This goes in each ticked order’s history and the activity log.'));
  assert.ok(box.queryByText(/accounts software/) === null);
  fireEvent.click(box.getByRole('checkbox', { name: 'Maya Patel' }));
  assert.ok(box.getByText('It goes to your accounts software with that day’s figures, as “[Provider] paid £1,140.00 · commission £20.00”.'));
});

test('cw-record-payment: a bike with nothing expected yet shows a dash, can’t be ticked, and says why', async () => {
  // The server refuses a payment for it (no_expected), so it starts unticked and stays out.
  const NONE = { ...MAYA, expectedPence: null, owedPence: 0 };
  const { ui, within, fireEvent, waitFor } = await open('/workshop/c2w/owed/3', {
    orders: [LATE, NONE],
    pay: () => { state.orders = [NONE]; return [200, { expectedPence: 38000, receivedPence: 38000, differencePence: 0, orders: [] }]; },
  });
  assert.ok(await ui.findByRole('heading', { name: '[Provider] · 2 bikes owed' }));
  const rows = within(ui.getByRole('table')).getAllByRole('row');
  assert.equal(rowText(rows[2])[3], '—');
  // Mark paid waits for an expected amount, as on the order page.
  assert.ok(ui.queryByRole('button', { name: 'Mark paid: Maya Patel · [Provider]' }) === null);
  assert.ok(ui.getByRole('button', { name: 'Mark paid: [Customer] · [Provider]' }));
  const box = within(await openRecord(ui, fireEvent));
  const maya = box.getByRole('checkbox', { name: 'Maya Patel' });
  assert.ok(!maya.checked);
  assert.ok(maya.disabled);
  assert.ok(box.getByText('Nothing is expected from [Provider] for this bike yet. Add what they will pay to the order first.'));
  assert.ok(box.getByText('Expected for the ticked bikes').parentElement.textContent.includes('£380.00'));
  assert.equal(box.getByRole('textbox', { name: 'Amount received' }).value, '380.00');
  assert.ok(box.getByText('It goes to your accounts software with that day’s figures, as “[Provider] paid £380.00 · commission £20.00”.'));
  fireEvent.click(box.getByRole('button', { name: 'Save' }));
  await waitFor(() => assert.ok(ui.queryByRole('dialog', { name: 'Record a payment' }) === null));
  assert.deepEqual(posts('/api/c2w/providers/3/payments').map((c) => c.body.orderIds), [[10]]);
});

test('cw-owed-provider: with nothing expected on any bike yet, there is no Record a payment', async () => {
  const { ui } = await open('/workshop/c2w/owed/3', { orders: [{ ...MAYA, expectedPence: null, owedPence: 0 }] });
  assert.ok(await ui.findByRole('heading', { name: '[Provider] · 1 bike owed' }));
  assert.ok(ui.queryByRole('button', { name: 'Record a payment' }) === null);
});

test('cw-list-owner: a collected order with nothing expected yet keeps Open instead of Mark paid', async () => {
  const list = LIST();
  list.groups.collected = [listOrder(LATE), { ...listOrder(MAYA), expectedPence: null }];
  const { ui } = await open('/workshop/c2w', { list });
  assert.ok(await ui.findByRole('button', { name: 'Mark paid: [Customer] · [Provider]' }));
  assert.ok(ui.queryByRole('button', { name: 'Mark paid: Maya Patel · [Provider]' }) === null);
  assert.equal(ui.getAllByRole('link', { name: 'Open Maya Patel’s order' }).length, 2, 'the name and the row’s Open link');
});
