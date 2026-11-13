// Front desk › Cycle to Work › the order: More… and Cancel the order
// (openspec/changes/cycle-to-work task 8.5's screen, PR 8c; c2w.mjs cw-more,
// cw-cancel, cw-cancel-ordered). Deposits aren't built yet (pull request 11), so
// no deposit line shows. Example data from the drawing: North Street Cycles,
// Bolton, Jo Taylor, Maya Patel. Providers, bikes, suppliers and certificate
// numbers stay bracketed; dates are visibly test values.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const JO = { id: 2, name: 'Jo Taylor', email: 'jo@example.com', isOwner: false, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const BIKE = { id: 21, name: '[Bike] · [Size]', sku: null, pricePence: 100000, price: 1000, supplier: '[Supplier]' };
const PROVIDER = { id: 3, name: '[Provider]', paysInDays: 30, accessoriesInside: true, handoverNote: '', handoverChecks: [], retiredAt: null };
const SETTINGS = { holdDays: 7, remindDays: 2, quoteValidDays: 30, orderRule: 'certificate', depositKind: 'percent', depositValue: null, depositOnCertificate: 'refund', depositOnPullOut: 'refund', howToApply: '[The shop’s own words]', todayLines: false, noCertificateDays: null, paymentLateDays: null };

const TODAY = '2026-09-14';
const day = (n) => { const d = new Date(`${TODAY}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const long = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const order = (over = {}) => ({
  supplier: '[Supplier]',
  id: 9, stage: 'quote', quoteNumber: 1, quoteRef: 'CW-1', customerId: 5, customerName: 'Maya Patel', customerPhone: '07700 900 142', customerEmail: 'maya@example.test',
  providerId: 3, providerName: '[Provider]', productId: 21, bike: '[Bike] · [Size]', siteId: 1, siteName: 'Bolton', frameId: 40, onOrder: false,
  quoteGivenAt: `${day(0)}T10:00:00.000Z`, quoteRevisedAt: null, validUntil: day(30), holdUntil: day(1), holdWanted: true,
  accessories: [], totalPence: 100000, appliedAt: null, applicationReference: null,
  certificateNumber: null, certificatePence: null, certificateReceivedOn: null, differenceChoice: null, providerPaysPence: 100000, customerPaysPence: null, certificateLate: false,
  saleId: null, collectedAt: null, paidOn: null, closeReason: null, inStock: true, held: true, purchaseOrderId: null, orderedFrom: null, releasedAt: null,
  expectedPence: null, expectedBy: null, paidPence: null, providerReference: null, next: 'certificate', ...over,
});
// Ordered from [Supplier] on day 2, then the certificate came (cw-cancel-ordered).
const ORDERED = { stage: 'certificate', inStock: false, held: false, holdUntil: null, frameId: null, onOrder: true, orderedFrom: '[Supplier]', purchaseOrderId: 77, certificateNumber: '[certificate number]', certificatePence: 100000, certificateReceivedOn: day(3), next: null };
const QUOTE_EV = { kind: 'quote_given', by: 'Jo Taylor', at: `${day(0)}T10:00:00.000Z`, reason: null, detail: { quoteRef: 'CW-1', closing: '' } };
const ORDERED_EV = { kind: 'ordered', by: 'Jo Taylor', at: `${day(2)}T11:00:00.000Z`, reason: null, detail: { supplier: '[Supplier]', purchaseOrderId: '77' } };

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

/** `on` answers a POST to /api/c2w/orders/9<end> with [status, body]; it may change `state`, which the page then reloads. */
async function open({ theOrder = order(), events = [QUOTE_EV], on = {} } = {}) {
  calls = [];
  state = { order: theOrder, events };
  globalThis.fetch = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url: String(url), method, body });
    const reply = (status, b) => ({ status, ok: status < 300, json: async () => b });
    const p = new URL(url, 'http://localhost').pathname;
    if (p === '/api/auth/me') return reply(200, JO);
    if (p === '/api/c2w/count') return reply(200, { count: 1 });
    if (p === '/api/c2w/settings') return reply(200, { settings: SETTINGS });
    if (p === '/api/c2w/providers') return reply(200, { providers: [PROVIDER] });
    if (p === '/api/products/21') return reply(200, BIKE);
    if (method === 'POST' && p.startsWith('/api/c2w/orders/9/')) {
      const end = p.slice('/api/c2w/orders/9'.length);
      if (on[end]) { const [status, b] = on[end](body); return reply(status, b); }
      return reply(404, { error: 'Not found' });
    }
    if (p === '/api/c2w/orders/9') return reply(200, { order: { ...state.order, events: state.events }, today: TODAY });
    if (p.startsWith('/api/')) return reply(200, []);
    return reply(404, { error: 'Not found' });
  };
  uninstall = installDom('http://localhost/workshop/c2w/9');
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { if (this.open) { this.open = false; this.dispatchEvent(new window.Event('close')); } };
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  shell = await importFresh(SHELL);
  rendered = true;
  const ui = rtl.render(createElement(shell.AppShell));
  return { ...rtl, ui };
}
const posts = (end) => calls.filter((c) => c.method === 'POST' && c.url.endsWith(`/api/c2w/orders/9${end}`));
const para = (text) => (_, el) => el?.tagName === 'P' && el.textContent === text;
const openCancel = async (ui, fireEvent) => {
  fireEvent.click(await ui.findByRole('button', { name: 'More for Maya Patel’s order' }));
  fireEvent.click(await ui.findByRole('menuitem', { name: 'Cancel the order…' }));
  return ui.findByRole('dialog', { name: 'Maya isn’t going ahead?' });
};
const cancelled = (body) => {
  state.order = { ...state.order, stage: 'cancelled', held: false, holdUntil: null, frameId: null, onOrder: false };
  state.events = [...state.events, { kind: 'cancelled', by: 'Jo Taylor', at: `${TODAY}T15:00:00.000Z`, reason: body.reason ?? null, detail: body.bike ? { bike: body.bike } : {} }];
  return [200, { order: state.order }];
};

test('cw-more: More… opens a menu with Cancel the order…, and only the steps that are built', async () => {
  const { ui, fireEvent } = await open();
  const more = await ui.findByRole('button', { name: 'More for Maya Patel’s order' });
  assert.equal(more.getAttribute('aria-haspopup'), 'menu');
  assert.equal(more.textContent, 'More…');
  fireEvent.click(more);
  const menu = await ui.findByRole('menu', { name: 'More for Maya Patel’s order' });
  const items = [...menu.querySelectorAll('[role="menuitem"]')].map((m) => m.textContent);
  assert.deepEqual(items, ['Cancel the order…']);
});

test('cw-cancel: the popup for a held bike, Keep the order closes it, and nothing is sent', async () => {
  const { ui, within, fireEvent } = await open();
  const box = within(await openCancel(ui, fireEvent));
  assert.ok(box.getByText('Quote CW-1 · [Bike] · [Size]'));
  assert.ok(box.getByText(para('[Bike] · [Size] goes back on sale at Bolton.')));
  const tell = box.getByRole('checkbox', { name: /Tell Maya the order is cancelled/ });
  assert.equal(tell.checked, true);
  assert.ok(box.getByText('“Your order is cancelled”, sent the way she chose. It says what happens to any deposit.'));
  assert.ok(box.getByRole('textbox', { name: 'Why?' }));
  assert.ok(box.getByText('This goes in the order’s history and the activity log.'));
  assert.ok(box.queryByRole('radio') === null, 'no bike choice for a bike that wasn’t ordered');
  fireEvent.click(box.getByRole('button', { name: 'Keep the order' }));
  assert.ok(ui.queryByRole('dialog', { name: 'Maya isn’t going ahead?' }) === null);
  assert.equal(posts('/cancel').length, 0);
});

test('cw-cancel: Cancel the order sends the tick and the reason; the order then says it’s cancelled, with no next step or More…', async () => {
  const { ui, within, fireEvent } = await open({ on: { '/cancel': cancelled } });
  const box = within(await openCancel(ui, fireEvent));
  fireEvent.change(box.getByRole('textbox', { name: 'Why?' }), { target: { value: '[reason]' } });
  fireEvent.click(box.getByRole('button', { name: 'Cancel the order' }));
  assert.ok(await ui.findByText(para('This order is cancelled.')));
  assert.deepEqual(posts('/cancel').map((c) => c.body), [{ tell: true, reason: '[reason]' }]);
  assert.ok(ui.queryByRole('dialog', { name: 'Maya isn’t going ahead?' }) === null);
  assert.ok(ui.queryByRole('button', { name: 'More for Maya Patel’s order' }) === null);
  assert.ok(ui.queryByRole('button', { name: 'Add the certificate' }) === null);
  assert.ok(await ui.findByText('cancelled the order · [reason]'));
});

test('cw-cancel: unticking Tell Maya sends tell false', async () => {
  const { ui, within, fireEvent } = await open({ on: { '/cancel': cancelled } });
  const box = within(await openCancel(ui, fireEvent));
  fireEvent.click(box.getByRole('checkbox', { name: /Tell Maya the order is cancelled/ }));
  fireEvent.click(box.getByRole('button', { name: 'Cancel the order' }));
  await ui.findByText(para('This order is cancelled.'));
  assert.deepEqual(posts('/cancel').map((c) => c.body), [{ tell: false }]);
});

test('cw-cancel-ordered: the bike ordered from [Supplier] offers Keep it as shop stock (chosen) and Send it back; Keep sends bike keep', async () => {
  const { ui, within, fireEvent } = await open({ theOrder: order(ORDERED), events: [QUOTE_EV, ORDERED_EV], on: { '/cancel': cancelled } });
  const box = within(await openCancel(ui, fireEvent));
  assert.ok(box.getByText(para(`The bike was ordered from [Supplier] on ${long(day(2))}, and certificate [certificate number] was added.`)));
  const keep = box.getByRole('radio', { name: 'Keep it as shop stock' });
  assert.equal(keep.checked, true);
  assert.ok(box.getByText('It goes on sale at Bolton when it arrives.'));
  assert.equal(box.getByRole('radio', { name: 'Send it back to [Supplier]' }).checked, false);
  assert.ok(box.getByText('Starts a return in Deliveries and orders.'));
  assert.ok(box.getByText(para('Tell [Provider] the order is cancelled — the way your note for them says.')));
  fireEvent.click(box.getByRole('button', { name: 'Cancel the order' }));
  await ui.findByText(para('This order is cancelled.'));
  assert.deepEqual(posts('/cancel').map((c) => c.body), [{ tell: true, bike: 'keep' }]);
  assert.ok(await ui.findByText('cancelled the order · kept the bike as shop stock'));
});

test('cw-cancel-ordered: Send it back isn’t built yet; the server says so and the popup stays open', async () => {
  const said = 'Sending a bike back to the supplier isn’t built yet. Keep it as shop stock, or leave the order open for now.';
  const { ui, within, fireEvent } = await open({ theOrder: order(ORDERED), events: [QUOTE_EV, ORDERED_EV], on: { '/cancel': () => [400, { error: said, code: 'return_not_built' }] } });
  const box = within(await openCancel(ui, fireEvent));
  fireEvent.click(box.getByRole('radio', { name: 'Send it back to [Supplier]' }));
  fireEvent.click(box.getByRole('button', { name: 'Cancel the order' }));
  assert.equal((await box.findByRole('alert')).textContent, said);
  assert.deepEqual(posts('/cancel').map((c) => c.body), [{ tell: true, bike: 'return' }]);
  assert.ok(ui.getByRole('dialog', { name: 'Maya isn’t going ahead?' }));
});
