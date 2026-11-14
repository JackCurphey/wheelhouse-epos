// Front desk › Cycle to Work › the order: More…, its changes and Cancel the order
// (openspec/changes/cycle-to-work tasks 8.5 and 4.8's screens; c2w.mjs cw-more,
// cw-quote-revised, cw-cancel, cw-cancel-ordered). Deposits aren't built yet (pull request 11), so
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
const OTHER_PROVIDER = { ...PROVIDER, id: 4, name: '[Second provider]' };
const OTHER_BIKE = { id: 23, name: '[Different bike] · [Size]', sku: null, pricePence: 125000 };
const LOCK = { id: 22, name: '[Accessory]', sku: null, pricePence: 4000 };
const LIGHTS = { id: 24, name: '[Second accessory]', sku: null, pricePence: 3000 };
const SHOP = { name: 'North Street Cycles', address: '[Shop address]', phone: '[shop phone]', email: null, vatNumber: '[VAT number]', logoUrl: null };
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
const quote = (revision) => ({
  shop: SHOP, quoteRef: 'CW-1', givenOn: day(0), revisedOn: revision ? revision.on : null, validUntil: day(30), customerName: 'Maya Patel', providerName: '[Provider]',
  items: [{ productId: 21, name: '[Bike] · [Size]', pricePence: 100000 }], totalPence: 100000, closing: '', howToApply: '[The shop’s own words]', revision,
});
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

/** `on` answers a POST to /api/c2w/orders/9<end> with [status, body] (or a promise of it); it may change `state`, which the page then reloads. */
async function open({ theOrder = order(), events = [QUOTE_EV], on = {}, providers = [PROVIDER], products = [] } = {}) {
  calls = [];
  state = { order: theOrder, events, revision: null };
  globalThis.fetch = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url: String(url), method, body });
    const reply = (status, b) => ({ status, ok: status < 300, json: async () => b });
    const p = new URL(url, 'http://localhost').pathname;
    if (p === '/api/auth/me') return reply(200, JO);
    if (p === '/api/c2w/count') return reply(200, { count: 1 });
    if (p === '/api/c2w/settings') return reply(200, { settings: SETTINGS });
    if (p === '/api/c2w/providers') return reply(200, { providers });
    if (p === '/api/products/21') return reply(200, BIKE);
    if (p === '/api/products') return reply(200, products);
    if (p === '/api/c2w/orders/9/quote') return reply(200, { quote: quote(state.revision) });
    if (method === 'POST' && p.startsWith('/api/c2w/orders/9/')) {
      const end = p.slice('/api/c2w/orders/9'.length);
      if (on[end]) { const [status, b] = await on[end](body); return reply(status, b); }
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

const menuOf = async (ui, fireEvent) => {
  fireEvent.click(await ui.findByRole('button', { name: 'More for Maya Patel’s order' }));
  return ui.findByRole('menu', { name: 'More for Maya Patel’s order' });
};
const itemsOf = (menu) => [...menu.querySelectorAll('[role="menuitem"]')].map((m) => m.textContent);
const NOTE = 'A change after the quote is sent makes a revised quote; nothing is sent until you press Email.';

test('cw-more: More… opens the drawn menu: the three changes, Release the bike, a line, Cancel the order…, and the note', async () => {
  const { ui, fireEvent } = await open();
  const more = await ui.findByRole('button', { name: 'More for Maya Patel’s order' });
  assert.equal(more.getAttribute('aria-haspopup'), 'menu');
  assert.equal(more.textContent, 'More…');
  const menu = await menuOf(ui, fireEvent);
  assert.deepEqual(itemsOf(menu), ['Change the bike or size', 'Change the accessories', 'Change the provider', 'Release the bike', 'Cancel the order…']);
  assert.ok(menu.querySelector('[role="separator"]'), 'a line before Cancel');
  assert.equal(menu.querySelector('p')?.textContent, NOTE);
});

test('cw-more › Release the bike opens the hold popup with Release picked (task 5.6)', async () => {
  const { ui, fireEvent, within } = await open();
  fireEvent.click(within(await menuOf(ui, fireEvent)).getByRole('menuitem', { name: 'Release the bike' }));
  const dialog = within(await ui.findByRole('dialog', { name: /^Maya Patel’s hold ends on / }));
  assert.equal(dialog.getByRole('radio', { name: 'Release the bike' }).checked, true);
});

test('cw-more: a bike not held has no Release the bike', async () => {
  const { ui, fireEvent } = await open({ theOrder: order({ held: false, holdUntil: null, frameId: null, inStock: false }) });
  assert.deepEqual(itemsOf(await menuOf(ui, fireEvent)), ['Change the bike or size', 'Change the accessories', 'Change the provider', 'Cancel the order…']);
});

test('cw-more: once the certificate is in, the hold is firm and there is no Release the bike', async () => {
  const { ui, fireEvent } = await open({ theOrder: order({ stage: 'certificate', certificateNumber: '[certificate number]', certificatePence: 100000, certificateReceivedOn: day(3), next: 'ready' }) });
  assert.ok(!itemsOf(await menuOf(ui, fireEvent)).includes('Release the bike'));
});

test('cw-more: once the certificate is in, the provider can’t change', async () => {
  const { ui, fireEvent } = await open({ theOrder: order({ stage: 'certificate', certificateNumber: '[certificate number]', certificatePence: 100000, certificateReceivedOn: day(3), next: 'ready' }) });
  assert.deepEqual(itemsOf(await menuOf(ui, fireEvent)), ['Change the bike or size', 'Change the accessories', 'Cancel the order…']);
});

test('cw-more: when the bike is ready to collect, only Cancel is left', async () => {
  const { ui, fireEvent } = await open({ theOrder: order({ stage: 'ready', certificateNumber: '[certificate number]', certificatePence: 100000, next: 'collect' }) });
  const menu = await menuOf(ui, fireEvent);
  assert.deepEqual(itemsOf(menu), ['Cancel the order…']);
  assert.ok(menu.querySelector('[role="separator"]') === null);
});

const changed = (detail, over = {}) => (body) => {
  state.order = { ...state.order, quoteRevisedAt: `${TODAY}T15:00:00.000Z`, ...over };
  state.events = [...state.events, { kind: 'changed', by: 'Jo Taylor', at: `${TODAY}T15:00:00.000Z`, reason: null, detail: { what: body.what, ...detail } }];
  state.revision = { what: body.what, on: TODAY, sent: false };
  return [200, { order: state.order }];
};
const openChange = async (ui, fireEvent, item, title) => {
  fireEvent.click((await menuOf(ui, fireEvent)).querySelectorAll('[role="menuitem"]')[item - 1]);
  return ui.findByRole('dialog', { name: title });
};

test('cw-more › Change the bike or size: pick the new bike and save; the revised quote opens, saying the bike changed and Maya hasn’t been sent it', async () => {
  const { ui, within, fireEvent } = await open({ products: [OTHER_BIKE], on: { '/change': changed({ from: BIKE.name, to: OTHER_BIKE.name, held: true }, { productId: 23, bike: OTHER_BIKE.name }) } });
  const box = within(await openChange(ui, fireEvent, 1, 'Change the bike or size'));
  assert.ok(box.getByText('Quote CW-1 · Maya Patel'));
  assert.ok(box.getByText('Now: [Bike] · [Size]'));
  fireEvent.change(box.getByRole('combobox', { name: 'Bike' }), { target: { value: 'Di' } });
  fireEvent.click(await box.findByRole('option', { name: OTHER_BIKE.name }));
  assert.ok(box.getByRole('group', { name: 'Bike' }).textContent.includes(OTHER_BIKE.name));
  fireEvent.click(box.getByRole('button', { name: 'Save the change' }));
  assert.ok(await ui.findByRole('heading', { level: 2, name: 'The revised quote' }));
  assert.deepEqual(posts('/change').map((c) => c.body), [{ what: 'bike', productId: 23 }]);
  assert.ok(ui.getByText(para(`Revised quote. The bike changed on ${long(TODAY)} — it’s in the order’s history. Maya hasn’t been sent it yet.`)));
  assert.ok(ui.queryByRole('dialog', { name: 'Change the bike or size' }) === null);
});

test('cw-more › Change the bike or size: Save waits for a new bike', async () => {
  const { ui, within, fireEvent } = await open({ on: { '/change': changed({}) } });
  const box = within(await openChange(ui, fireEvent, 1, 'Change the bike or size'));
  fireEvent.click(box.getByRole('button', { name: 'Save the change' }));
  assert.equal(posts('/change').length, 0);
  assert.equal(box.getByRole('button', { name: 'Save the change' }).disabled, true);
});

test('cw-more › Change the accessories: the order’s accessories are listed; take one off, add another, and save', async () => {
  const theOrder = order({ accessories: [{ productId: 22, name: '[Accessory]', pricePence: 4000 }], totalPence: 104000 });
  const { ui, within, fireEvent } = await open({ theOrder, products: [LIGHTS], on: { '/change': changed({ added: [LIGHTS.name], removed: [LOCK.name] }) } });
  const box = within(await openChange(ui, fireEvent, 2, 'Change the accessories'));
  const chosen = box.getByRole('list', { name: 'Accessories chosen' });
  assert.deepEqual(within(chosen).getAllByRole('listitem').map((l) => l.textContent.replace('✕', '')), ['[Accessory]']);
  fireEvent.click(box.getByRole('button', { name: 'Remove [Accessory]' }));
  fireEvent.change(box.getByRole('combobox', { name: 'Accessories' }), { target: { value: 'Se' } });
  fireEvent.click(await box.findByRole('option', { name: LIGHTS.name }));
  fireEvent.click(box.getByRole('button', { name: 'Save the change' }));
  assert.ok(await ui.findByText(para(`Revised quote. The accessories changed on ${long(TODAY)} — it’s in the order’s history. Maya hasn’t been sent it yet.`)));
  assert.deepEqual(posts('/change').map((c) => c.body), [{ what: 'accessories', accessoryIds: [24] }]);
});

test('cw-more › Change the accessories: picking one already on the list adds it once', async () => {
  const theOrder = order({ accessories: [{ productId: 22, name: '[Accessory]', pricePence: 4000 }], totalPence: 104000 });
  const { ui, within, fireEvent } = await open({ theOrder, products: [LIGHTS], on: { '/change': changed({ added: [LIGHTS.name] }) } });
  const box = within(await openChange(ui, fireEvent, 2, 'Change the accessories'));
  for (let i = 0; i < 2; i += 1) {
    fireEvent.change(box.getByRole('combobox', { name: 'Accessories' }), { target: { value: 'Se' } });
    fireEvent.click(await box.findByRole('option', { name: LIGHTS.name }));
  }
  const chosen = box.getByRole('list', { name: 'Accessories chosen' });
  assert.deepEqual(within(chosen).getAllByRole('listitem').map((l) => l.textContent.replace('✕', '')), ['[Accessory]', LIGHTS.name]);
  fireEvent.click(box.getByRole('button', { name: 'Save the change' }));
  await ui.findByRole('heading', { level: 2, name: 'The revised quote' });
  assert.deepEqual(posts('/change').map((c) => c.body), [{ what: 'accessories', accessoryIds: [22, 24] }]);
});

test('cw-more › Change the provider: choose another provider and save', async () => {
  const { ui, within, fireEvent } = await open({ providers: [PROVIDER, OTHER_PROVIDER], on: { '/change': changed({ from: '[Provider]', to: '[Second provider]' }, { providerId: 4, providerName: '[Second provider]' }) } });
  const box = within(await openChange(ui, fireEvent, 3, 'Change the provider'));
  const pick = box.getByRole('combobox', { name: 'Scheme provider' });
  await box.findByRole('option', { name: '[Second provider]' });
  assert.equal(pick.value, '3');
  fireEvent.change(pick, { target: { value: '4' } });
  fireEvent.click(box.getByRole('button', { name: 'Save the change' }));
  assert.ok(await ui.findByText(para(`Revised quote. The provider changed on ${long(TODAY)} — it’s in the order’s history. Maya hasn’t been sent it yet.`)));
  assert.deepEqual(posts('/change').map((c) => c.body), [{ what: 'provider', providerId: 4 }]);
});

test('cw-more › a change the server refuses says why, and the popup stays open', async () => {
  const said = 'This bike is on order from the supplier. Undo that order first, then change the bike.';
  const { ui, within, fireEvent } = await open({ products: [OTHER_BIKE], on: { '/change': () => [409, { error: said, code: 'on_order' }] } });
  const box = within(await openChange(ui, fireEvent, 1, 'Change the bike or size'));
  fireEvent.change(box.getByRole('combobox', { name: 'Bike' }), { target: { value: 'Di' } });
  fireEvent.click(await box.findByRole('option', { name: OTHER_BIKE.name }));
  fireEvent.click(box.getByRole('button', { name: 'Save the change' }));
  assert.equal((await box.findByRole('alert')).textContent, said);
  assert.ok(ui.getByRole('dialog', { name: 'Change the bike or size' }));
});

test('cw-more: What’s happened says what each change did', async () => {
  const at = `${day(1)}T09:00:00.000Z`;
  const ev = (detail) => ({ kind: 'changed', by: 'Jo Taylor', at, reason: null, detail });
  const { ui } = await open({ events: [QUOTE_EV,
    ev({ what: 'bike', from: '[Bike] · [Size]', to: '[Different bike] · [Size]', held: true }),
    ev({ what: 'bike', from: '[Different bike] · [Size]', to: '[Bike] · [Size]', held: false }),
    ev({ what: 'bike', from: '[Bike] · [Size]', to: '[Different bike] · [Size]' }),
    ev({ what: 'accessories', added: ['[Second accessory]'], removed: ['[Accessory]'] }),
    ev({ what: 'accessories', added: [], removed: ['[Second accessory]'] }),
    ev({ what: 'provider', from: '[Provider]', to: '[Second provider]' })] });
  assert.equal((await ui.findAllByText('changed the bike from [Bike] · [Size] to [Different bike] · [Size]')).length, 2, 'no hold note when it was held, or when the order wasn’t holding');
  assert.ok(ui.getByText('changed the bike from [Different bike] · [Size] to [Bike] · [Size] · none free to hold, so one needs ordering in'));
  assert.ok(ui.getByText('changed the accessories · added [Second accessory] · took off [Accessory]'));
  assert.ok(ui.getByText('changed the accessories · took off [Second accessory]'));
  assert.ok(ui.getByText('changed the provider from [Provider] to [Second provider]'));
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

test('cw-cancel: after cancelling, focus moves to “This order is cancelled.” (More… has gone)', async () => {
  const { ui, within, fireEvent } = await open({ on: { '/cancel': cancelled } });
  const box = within(await openCancel(ui, fireEvent));
  fireEvent.click(box.getByRole('button', { name: 'Cancel the order' }));
  const said = await ui.findByText('This order is cancelled.');
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(document.activeElement === said, `focus is on ${document.activeElement?.tagName}`);
});

test('cw-cancel: while the cancel is being sent, Escape and the backdrop don’t close the popup, and a second press sends nothing', async () => {
  let answer;
  const { ui, fireEvent, within } = await open({ on: { '/cancel': (b) => new Promise((r) => { answer = () => r(cancelled(b)); }) } });
  const dialog = await openCancel(ui, fireEvent);
  const go = within(dialog).getByRole('button', { name: 'Cancel the order' });
  fireEvent.click(go);
  fireEvent.click(go);
  // The browser fires "cancel" on Escape, and closes the dialog unless it's prevented.
  const esc = new window.Event('cancel', { cancelable: true });
  dialog.dispatchEvent(esc);
  if (!esc.defaultPrevented) dialog.close();
  fireEvent.mouseDown(dialog);
  assert.ok(ui.queryByRole('dialog', { name: 'Maya isn’t going ahead?' }) !== null, 'the popup stays while sending');
  answer();
  await ui.findByText(para('This order is cancelled.'));
  assert.equal(posts('/cancel').length, 1);
});

test('cw-cancel: when Maya couldn’t be told, the history line says so', async () => {
  const notTold = (why) => (b) => { const r = cancelled(b); state.events.at(-1).detail.notTold = why; return r; };
  const { ui, within, fireEvent } = await open({ on: { '/cancel': notTold('no_phone') } });
  const box = within(await openCancel(ui, fireEvent));
  fireEvent.click(box.getByRole('button', { name: 'Cancel the order' }));
  assert.ok(await ui.findByText('cancelled the order · Maya wasn’t told: the shop has no phone number in Settings'));
});

test('cw-cancel: More… isn’t there once the bike is collected', async () => {
  const { ui } = await open({ theOrder: order({ stage: 'collected', held: false, holdUntil: null, collectedAt: `${day(4)}T10:00:00.000Z`, next: null }) });
  await ui.findAllByText('Maya Patel', { exact: false });
  assert.ok(ui.queryByRole('button', { name: 'More for Maya Patel’s order' }) === null);
});
