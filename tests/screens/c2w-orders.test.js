// Front desk › Cycle to Work: the list, New order, the quote and the order
// (openspec/changes/cycle-to-work tasks 4.1–4.5; c2w.mjs cw-list,
// cw-list-owner, cw-first-use, cw-new, cw-new-not-in-stock, cw-quote,
// cw-quote-revised, cw-order-held, cw-more). Example data from the drawing:
// North Street Cycles, Bolton, Jo Taylor, Maya Patel (07700 900 142,
// maya@example.test). Providers, bikes and quote numbers stay bracketed;
// prices, days and dates are visibly test values.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const OWNER = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const JO = { ...OWNER, id: 2, name: 'Jo Taylor', email: 'jo@example.com', isOwner: false };
const MAYA = { id: 5, name: 'Maya Patel', phone: '07700 900 142', email: 'maya@example.test' };
const BIKE = { id: 21, name: '[Bike] · [Size]', sku: null, pricePence: 100000, price: 1000 };
const LOCK = { id: 22, name: '[Accessory]', sku: null, pricePence: 4000, price: 40 };
const PROVIDER = { id: 3, name: '[Provider]', paysInDays: 30, accessoriesInside: true, handoverNote: '', handoverChecks: [], retiredAt: null };
const SETTINGS = { holdDays: 7, remindDays: 2, quoteValidDays: 30, orderRule: 'applied', depositKind: 'percent', depositValue: null, depositOnCertificate: 'refund', depositOnPullOut: 'refund', howToApply: '[The shop’s own words]', todayLines: false, noCertificateDays: null, paymentLateDays: null };

// The shop's day comes from the server (`today`); a test value, never the computer's date.
const TODAY = '2026-09-14';
const day = (n) => { const d = new Date(`${TODAY}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const long = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const order = (over = {}) => ({
  id: 9, stage: 'quote', quoteNumber: 1, quoteRef: 'CW-1', customerId: 5, customerName: 'Maya Patel', customerPhone: '07700 900 142', customerEmail: 'maya@example.test',
  providerId: 3, providerName: '[Provider]', productId: 21, bike: '[Bike] · [Size]', siteId: 1, siteName: 'Bolton', frameId: null, onOrder: false,
  quoteGivenAt: `${day(0)}T10:00:00.000Z`, quoteRevisedAt: null, validUntil: day(30), holdUntil: day(1), holdWanted: true,
  accessories: [{ productId: 22, name: '[Accessory]', pricePence: 4000 }], totalPence: 104000, appliedAt: null, applicationReference: null,
  certificateNumber: null, certificatePence: null, certificateReceivedOn: null, saleId: null, collectedAt: null, paidOn: null, closeReason: null,
  inStock: true, expectedPence: null, expectedBy: null, paidPence: null, providerReference: null, next: 'certificate', ...over,
});
const NOT_IN_STOCK = order({ id: 10, quoteRef: 'CW-2', customerName: '[Customer]', stage: 'waiting', holdUntil: null, inStock: false, appliedAt: `${day(-1)}T12:00:00.000Z`, next: 'order' });
const LIST = {
  groups: { waiting: [order(), NOT_IN_STOCK], certificate: [], ready: [], collected: [order({ id: 11, quoteRef: 'CW-3', customerName: '[Customer]', stage: 'collected', holdUntil: null, expectedPence: 95000, expectedBy: day(-3), next: 'paid' })], paid: [] },
  counts: { holdEndingSoon: 1, holdEnded: 0, readyToOrder: 1, noCertificate: 0, paymentLate: 1 }, count: 3, providers: 1, today: TODAY,
};
const OWNER_LIST = { ...LIST, counts: { ...LIST.counts, owedPence: 95000, owedLate: 95000 } };
const EMPTY = { groups: { waiting: [], certificate: [], ready: [], collected: [], paid: [] }, counts: { holdEndingSoon: 0, holdEnded: 0, readyToOrder: 0, noCertificate: 0, paymentLate: 0 }, count: 0, providers: 0, today: TODAY };
const EVENTS = [
  { kind: 'quote_given', by: 'Jo Taylor', at: `${day(0)}T10:00:00.000Z`, reason: null, detail: { quoteRef: 'CW-1', closing: `We’re holding your bike until ${long(day(1))}. This quote is valid until ${long(day(30))}. Once your certificate reaches us, it’s yours to collect.` } },
  { kind: 'quote_emailed', by: 'Jo Taylor', at: `${day(0)}T10:00:01.000Z`, reason: null, detail: { to: 'maya@example.test' } },
];
const QUOTE = {
  shop: { name: 'North Street Cycles', address: '[Shop address]', phone: '[shop phone]', email: null, vatNumber: '[VAT number]', logoUrl: null },
  quoteRef: 'CW-1', givenOn: day(0), revisedOn: null, validUntil: day(30), customerName: 'Maya Patel', providerName: '[Provider]',
  items: [{ productId: 21, name: '[Bike] · [Size]', pricePence: 100000 }, { productId: 22, name: '[Accessory]', pricePence: 4000 }], totalPence: 104000,
  closing: EVENTS[0].detail.closing, howToApply: '[The shop’s own words]',
};

const realFetch = globalThis.fetch;
let uninstall;
let shell;
let calls;
let rendered = false;
afterEach(async () => {
  // Nothing drawn, nothing to clean: importing the testing library before a
  // render breaks fireEvent.change for the whole file (rtl-cleanup-before-dom).
  if (!rendered) return;
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  shell?.queryClient.clear();
  uninstall?.();
  globalThis.fetch = realFetch;
  rendered = false;
});

async function open(path, { me = JO, list = LIST, stock = 2, quote = QUOTE, theOrder = order(), emailFails = false, providers = [PROVIDER] } = {}) {
  let emails = 0;
  calls = [];
  globalThis.fetch = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url: String(url), method, body });
    const reply = (status, b) => ({ status, ok: status < 300, json: async () => b });
    const u = new URL(url, 'http://localhost');
    const p = u.pathname;
    if (p === '/api/auth/me') return reply(200, me);
    if (p === '/api/c2w/orders' && method === 'GET') return reply(200, list);
    if (p === '/api/c2w/count') return reply(200, { count: list.count });
    if (p === '/api/c2w/settings') return reply(200, { settings: SETTINGS });
    if (p === '/api/c2w/providers') return reply(200, { providers: me.isOwner ? providers.map((x) => ({ ...x, commissionKind: 'percent', commissionValue: 500 })) : providers });
    if (p === '/api/customers') return reply(200, (u.searchParams.get('search') ?? '').length ? [MAYA] : []);
    if (p === '/api/products') return reply(200, [BIKE, LOCK].filter((x) => x.name.toLowerCase().includes((u.searchParams.get('search') ?? '').toLowerCase())));
    if (p === '/api/products/21') return reply(200, { ...BIKE, stockAtShops: [{ id: 1, name: 'Bolton', qty: stock, here: true }, { id: 2, name: '[Second site]', qty: 0, here: false }] });
    if (p === '/api/c2w/orders' && method === 'POST') return reply(201, { order: order({ holdUntil: body.hold && stock > 0 ? day(7) : null, inStock: stock > 0 }) });
    if (p === '/api/c2w/orders/9/email-quote') {
      emails += 1;
      // 'fault' fails the first send with a server fault, then sends: Try again can work.
      if (emailFails === 'fault' && emails === 1) return reply(500, { error: 'Internal server error' });
      if (emailFails === true) return reply(429, { error: 'This customer has been sent five Cycle to Work quotes in the last hour. Try again later.', code: 'too_many' });
      return reply(200, { sent: true, to: 'maya@example.test' });
    }
    if (p === '/api/c2w/orders/9/quote') return reply(200, { quote });
    if (p === '/api/c2w/orders/9') return reply(200, { order: { ...theOrder, events: EVENTS }, today: TODAY });
    if (p.startsWith('/api/')) return reply(200, []);
    return reply(404, { error: 'Not found' });
  };
  uninstall = installDom(`http://localhost${path}`);
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { if (this.open) { this.open = false; this.dispatchEvent(new window.Event('close')); } };
  window.print = () => calls.push({ url: 'print', method: 'PRINT' });
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  shell = await importFresh(SHELL);
  rendered = true;
  const ui = rtl.render(createElement(shell.AppShell));
  return { ...rtl, ui };
}
const posts = (end) => calls.filter((c) => c.method === 'POST' && c.url.endsWith(end));

// ---- 4.1 The list ----

test('cw-list: the top line, + New Cycle to Work order, and each group with its count and drawn note', async () => {
  const { ui, within } = await open('/workshop/c2w');
  const main = within(await ui.findByRole('main'));
  assert.ok(await main.findByText('1 hold ending soon'));
  assert.ok(main.getByText('1 bike ready to order') && main.getByText('1 payment late'));
  assert.ok(main.queryByText(/Owed by providers/) === null, 'staff see no owed total (decision M6)');
  assert.ok(main.getByRole('button', { name: '+ New Cycle to Work order' }));
  assert.ok(main.getByText('Monday 14 September · North Street Cycles'), 'the shop’s day from the server, and the shop');
  assert.ok(main.getByRole('heading', { level: 2, name: 'Waiting for the certificate · 2' }));
  assert.ok(main.getByText('Bikes in stock are held for the customer. Ones to order follow your rule in Settings.'));
  assert.ok(main.getByRole('heading', { level: 2, name: 'Collected · waiting for payment · 1' }));
  assert.ok(main.queryByRole('heading', { name: /^Ready to collect/ }) === null, 'an empty group is left out');
});

test('cw-list: a held row and a not-in-stock row, as drawn; the name opens the order', async () => {
  const { ui, within } = await open('/workshop/c2w');
  const waiting = within(await ui.findByRole('list', { name: 'Waiting for the certificate · 2' }));
  const [held, away] = waiting.getAllByRole('listitem');
  assert.equal(within(held).getByRole('link', { name: 'Open Maya Patel’s order' }).getAttribute('href'), '/workshop/c2w/9');
  for (const t of ['Quote CW-1', '[Bike] · [Size]', '[Provider]', `Held until ${long(day(1))}`, 'Hold ends in 1 day']) assert.ok(held.textContent.includes(t), `${t} in ${held.textContent}`);
  for (const t of ['[Bike] · [Size] · not in stock', `Applied ${long(day(-1))}`, 'Ready to order']) assert.ok(away.textContent.includes(t), `${t} in ${away.textContent}`);
});

test('cw-list: a late payment says how late and when it was due, with Open', async () => {
  const { ui, within } = await open('/workshop/c2w');
  const group = (await ui.findByRole('heading', { name: 'Collected · waiting for payment · 1' })).closest('section');
  const row = within(group).getByRole('listitem');
  assert.ok(row.textContent.includes('3 days late') && row.textContent.includes(`£950.00 was due ${long(day(-3))}`), row.textContent);
  assert.equal(within(row).getByRole('link', { name: 'Open [Customer]’s late order' }).getAttribute('href'), '/workshop/c2w/11');
});

test('cw-list: a hold the server says has ended stays held and asks for a choice', async () => {
  const ended = order({ holdUntil: day(-2), next: 'choose' });
  const { ui } = await open('/workshop/c2w', { list: { ...LIST, groups: { ...LIST.groups, waiting: [ended] } } });
  const row = (await ui.findByRole('list', { name: 'Waiting for the certificate · 1' })).querySelector('li');
  assert.ok(row.textContent.includes(`Still held`) && row.textContent.includes(`Hold ended ${long(day(-2))} — choose`), row.textContent);
});

test('cw-list-owner: Owed by providers shows whenever the server sends it (whoever can see costs)', async () => {
  const { ui } = await open('/workshop/c2w', { me: JO, list: OWNER_LIST });
  assert.ok(await ui.findByText('Owed by providers £950.00 · 1 late'));
});

test('cw-first-use: no orders and no providers: the drawn box with its two buttons and note', async () => {
  const { ui, within } = await open('/workshop/c2w', { me: OWNER, list: EMPTY });
  const main = within(await ui.findByRole('main'));
  assert.ok(await main.findByRole('heading', { level: 3, name: 'No Cycle to Work orders yet' }));
  assert.ok(main.getByText('Each bike sold through a scheme gets an order here, from the quote to the provider’s payment.'));
  assert.ok(main.getByText('No scheme providers yet.') && main.getByText(/Add the providers your customers use, with their terms, before the first quote\./));
  assert.equal(main.getByRole('link', { name: 'Add providers' }).getAttribute('href'), '/workshop/settings?room=front-desk&fold=c2w-providers');
  assert.equal(main.getByRole('link', { name: 'Set how bikes are held and ordered' }).getAttribute('href'), '/workshop/settings?room=front-desk&fold=c2w-hold');
  assert.ok(main.getByText('Staff can start orders once there’s a provider to choose.'));
  assert.ok(main.queryByRole('button', { name: '+ New Cycle to Work order' }) === null);
});

test('the sidebar shows the count beside Cycle to Work, read as due or late', async () => {
  const { ui } = await open('/workshop/c2w');
  await ui.findByRole('heading', { name: 'Waiting for the certificate · 2' });
  const [link] = await ui.findAllByRole('link', { name: 'Cycle to Work, 3 due or late' });
  assert.equal(link.textContent, 'Cycle to Work3');
});

test('cw-list: a bike on order says so, ahead of not in stock', async () => {
  const onOrder = order({ id: 12, stage: 'certificate', holdUntil: null, inStock: false, onOrder: true, next: 'ready' });
  const { ui } = await open('/workshop/c2w', { list: { ...LIST, groups: { ...LIST.groups, waiting: [], certificate: [onOrder] } } });
  const row = (await ui.findByRole('list', { name: 'Certificate received · 1' })).querySelector('li');
  assert.ok(row.textContent.includes('[Bike] · [Size] · on order') && !row.textContent.includes('not in stock'), row.textContent);
});

// ---- 4.2 New order ----

async function newOrder(options) {
  const r = await open('/workshop/c2w', options);
  r.fireEvent.click(await r.ui.findByRole('button', { name: '+ New Cycle to Work order' }));
  await r.ui.findByRole('heading', { level: 2, name: 'New Cycle to Work order' });
  return r;
}
async function pick(r, label, term, option) {
  r.fireEvent.change(r.ui.getByRole('combobox', { name: label }), { target: { value: term } });
  r.fireEvent.click(await r.ui.findByRole('option', { name: option }));
}

test('cw-new: the fields, a bike in stock held, the quote’s words, the email tick, the total, Cancel and Make the quote', async () => {
  const r = await newOrder();
  const { ui, within } = r;
  const box = within(ui.getByRole('dialog'));
  assert.ok(box.getByText('North Street Cycles'));
  await pick(r, 'Customer', 'Maya', /^Maya Patel/);
  assert.ok(box.getByText('Maya Patel · 07700 900 142'));
  assert.equal(box.getByRole('combobox', { name: 'Scheme provider' }).value, '3');
  assert.ok(box.getByText('Pays in about 30 days'));
  await pick(r, 'Bike', 'Bike', /^\[Bike\] · \[Size\]/);
  await pick(r, 'Accessories', 'Acc', /^\[Accessory\]/);
  assert.ok(box.getByText('Optional'));
  const hold = await box.findByRole('checkbox', { name: new RegExp(`^Hold the bike until ${long(day(7))}`) });
  assert.equal(hold.checked, true);
  assert.ok(box.getByText('7 days, from Settings. Untick for an easy-to-replace bike.'));
  assert.ok(box.getByText('The quote will say'));
  assert.ok(box.getByText(`We’re holding your bike until ${long(day(7))}. This quote is valid until ${long(day(30))}. Once your certificate reaches us, it’s yours to collect.`));
  const email = box.getByRole('checkbox', { name: /^Email the quote to maya@example\.test now/ });
  assert.equal(email.checked, true);
  assert.ok(box.getByText('It says the bike is put aside, so no separate “put aside” message goes.'));
  assert.ok(box.getByText('Total (includes VAT)').parentElement.textContent.includes('£1,040.00'));
  assert.ok(box.getByRole('button', { name: 'Cancel' }));
  r.fireEvent.click(box.getByRole('button', { name: 'Make the quote' }));
  await ui.findByRole('heading', { level: 2, name: 'Maya Patel · Cycle to Work' });
  assert.deepEqual(posts('/api/c2w/orders')[0].body, { customerId: 5, providerId: 3, productId: 21, accessoryIds: [22], hold: true });
  assert.equal(posts('/email-quote').length, 1);
  assert.ok(await ui.findByText(`Quote emailed to maya@example.test. Bike held until ${long(day(7))}.`));
});

test('cw-new-not-in-stock: no hold tick, and the quote says the bike will be ordered', async () => {
  const r = await newOrder({ stock: 0 });
  const box = r.within(r.ui.getByRole('dialog'));
  await pick(r, 'Bike', 'Bike', /^\[Bike\] · \[Size\]/);
  assert.ok(await box.findByText(`[Bike] · [Size] isn’t in stock. We’ll order it once you’ve applied, and let you know when it arrives. This quote is valid until ${long(day(30))}.`));
  assert.ok(box.queryByRole('checkbox', { name: /^Hold the bike/ }) === null);
});

test('cw-new: Make the quote without the customer, provider and bike says what is missing and sends nothing', async () => {
  const r = await newOrder();
  await r.ui.findByText('Pays in about 30 days');
  r.fireEvent.click(r.ui.getByRole('button', { name: 'Make the quote' }));
  assert.ok(await r.ui.findByText('Choose the customer and the bike.'));
  assert.equal(posts('/api/c2w/orders').length, 0);
});

test('cw-new (edge 6c): + New customer opens Add a customer and puts her on the order', async () => {
  const r = await newOrder();
  calls.length = 0;
  r.fireEvent.click(r.ui.getByRole('button', { name: '+ New customer' }));
  await r.ui.findByRole('heading', { level: 2, name: 'Add a customer' });
  globalThis.fetch = ((inner) => async (url, init = {}) => (String(url).endsWith('/api/customers') && init.method === 'POST' ? { status: 201, ok: true, json: async () => ({ id: 5 }) } : inner(url, init)))(globalThis.fetch);
  r.fireEvent.change(r.ui.getByLabelText('Name'), { target: { value: 'Maya Patel' } });
  r.fireEvent.change(r.ui.getByLabelText('Phone'), { target: { value: '07700 900 142' } });
  r.fireEvent.click(r.ui.getByRole('button', { name: 'Add the customer' }));
  await r.ui.findByRole('heading', { level: 2, name: 'New Cycle to Work order' });
  assert.ok(await r.ui.findByText('Maya Patel · 07700 900 142'));
});

test('cw-new: the order is made but the email refused: the order opens and says it wasn’t sent', async () => {
  const r = await newOrder({ emailFails: true });
  await pick(r, 'Customer', 'Maya', /^Maya Patel/);
  await pick(r, 'Bike', 'Bike', /^\[Bike\] · \[Size\]/);
  await r.ui.findByRole('checkbox', { name: /^Hold the bike/ });
  r.fireEvent.click(r.ui.getByRole('button', { name: 'Make the quote' }));
  assert.ok(await r.ui.findByText('Quote CW-1 made, not emailed: This customer has been sent five Cycle to Work quotes in the last hour. Try again later.'));
});

test('cw-new: Escape closes the list, then empties the box; from an empty box it goes on to close New order', async () => {
  const r = await newOrder();
  const box = r.ui.getByRole('combobox', { name: 'Customer' });
  r.fireEvent.change(box, { target: { value: 'Maya' } });
  await r.ui.findByRole('option', { name: /^Maya Patel/ });
  // fireEvent says false when the page kept the key to itself (preventDefault).
  assert.equal(r.fireEvent.keyDown(box, { key: 'Escape' }), false, 'kept: it closes the list');
  assert.ok(r.ui.queryByRole('option', { name: /^Maya Patel/ }) === null, 'the list closed');
  assert.equal(r.fireEvent.keyDown(box, { key: 'Escape' }), false, 'kept: it empties the box');
  assert.equal(box.value, '');
  assert.equal(r.fireEvent.keyDown(box, { key: 'Escape' }), true, 'from the empty box Escape goes on to the dialog, which closes');
});

test('cw-new: the list closes when the focus leaves, Down opens it again, and nothing matching shows no list', async () => {
  const r = await newOrder();
  const box = r.ui.getByRole('combobox', { name: 'Customer' });
  r.fireEvent.change(box, { target: { value: 'Maya' } });
  await r.ui.findByRole('option', { name: /^Maya Patel/ });
  r.fireEvent.blur(box, { relatedTarget: r.ui.getByRole('button', { name: 'Cancel' }) });
  assert.ok(r.ui.queryByRole('listbox') === null);
  assert.equal(box.getAttribute('aria-expanded'), 'false');
  r.fireEvent.keyDown(box, { key: 'ArrowDown' });
  assert.ok(r.ui.getByRole('option', { name: /^Maya Patel/ }));
  const bike = r.ui.getByRole('combobox', { name: 'Bike' });
  r.fireEvent.change(bike, { target: { value: 'zz' } });
  assert.equal((await r.ui.findAllByText('Nothing matches “zz”.')).length, 2, 'said on screen and to screen readers');
  assert.ok(r.ui.queryByRole('listbox', { name: 'Matching: Bike' }) === null, 'no empty list');
  assert.equal(bike.getAttribute('aria-expanded'), 'false');
});

test('cw-new: the arrow keys and Enter pick; the focus goes to Change, back to the box after Change, and to the box after removing a chip', async () => {
  const r = await newOrder();
  const settle = () => new Promise((res) => setTimeout(res, 40));
  const box = r.ui.getByRole('combobox', { name: 'Customer' });
  r.fireEvent.change(box, { target: { value: 'Maya' } });
  await r.ui.findByRole('option', { name: /^Maya Patel/ });
  assert.equal(box.getAttribute('aria-expanded'), 'true');
  r.fireEvent.keyDown(box, { key: 'Enter' });
  await settle();
  assert.ok(document.activeElement === r.ui.getByRole('button', { name: 'Change the customer' }), 'focus');
  assert.ok(r.ui.getByRole('group', { name: 'Customer' }).textContent.includes('Maya Patel · 07700 900 142'), 'the picked customer is named by its label');
  r.fireEvent.click(r.ui.getByRole('button', { name: 'Change the customer' }));
  await settle();
  assert.ok(document.activeElement === r.ui.getByRole('combobox', { name: 'Customer' }), 'focus');
  await pick(r, 'Accessories', 'Acc', /^\[Accessory\]/);
  r.fireEvent.click(r.ui.getByRole('button', { name: 'Remove [Accessory]' }));
  await settle();
  assert.ok(document.activeElement === r.ui.getByRole('combobox', { name: 'Accessories' }), 'focus');
});

test('cw-new: an email that failed for want of a connection opens the order with Try again, which sends it', async () => {
  const r = await newOrder({ emailFails: 'fault' });
  await pick(r, 'Customer', 'Maya', /^Maya Patel/);
  await pick(r, 'Bike', 'Bike', /^\[Bike\] · \[Size\]/);
  await r.ui.findByRole('checkbox', { name: /^Hold the bike/ });
  r.fireEvent.click(r.ui.getByRole('button', { name: 'Make the quote' }));
  assert.ok(await r.ui.findByText('Quote CW-1 made, not emailed: Wheelhouse couldn’t send it.'));
  assert.ok(window.history.state?.usr == null, 'the note is cleared from the address, so a reload doesn’t show it again');
  r.fireEvent.click(r.ui.getByRole('button', { name: 'Try again' }));
  assert.ok(await r.ui.findByText('Quote emailed to maya@example.test.'));
  assert.equal(posts('/email-quote').length, 2);
});

// ---- 4.3 The quote ----

test('cw-quote: every drawn line, the LOGO placeholder, Print and Email to Maya', async () => {
  const { ui, within, fireEvent } = await open('/workshop/c2w/9/quote');
  const main = within(await ui.findByRole('main'));
  assert.ok(await main.findByRole('heading', { level: 2, name: 'The quote' }));
  assert.equal(main.getByRole('link', { name: 'Maya Patel · Cycle to Work' }).getAttribute('href'), '/workshop/c2w/9');
  const doc = within(main.getByRole('article', { name: 'Cycle to Work quote' }));
  const logo = doc.getByLabelText('Shop logo goes here');
  assert.equal(logo.textContent, 'LOGO');
  assert.equal(logo.getAttribute('title'), 'No official logo file exists yet');
  for (const t of ['North Street Cycles', '[Shop address] · [shop phone]', 'VAT [VAT number]', `Given ${long(day(0))}`, `Valid until ${long(day(30))}`, 'Item', 'Price', 'Total (includes VAT)', '£1,040.00', '£1,000.00', '£40.00', QUOTE.closing, 'How to apply: [The shop’s own words]']) {
    assert.ok(doc.getAllByText((_, el) => el?.textContent === t).length > 0, t);
  }
  assert.ok(doc.getByText((_, el) => el?.textContent === 'Quote number CW-1'));
  assert.ok(doc.getByText((_, el) => el?.tagName === 'DIV' && el.textContent === 'For Maya Patel · scheme provider [Provider]'));
  assert.ok(doc.getByText('How to apply:'));
  fireEvent.click(main.getByRole('button', { name: 'Print' }));
  assert.ok(calls.some((c) => c.method === 'PRINT'));
  // What goes to the printer is the quote itself (#wh-print, the only thing the print styles show).
  const paper = document.getElementById('wh-print');
  for (const t of ['LOGO', 'Cycle to Work quote', 'Quote number CW-1', 'For Maya Patel · scheme provider [Provider]', '£1,040.00', QUOTE.closing]) assert.ok(paper?.textContent.includes(t), t);
  fireEvent.click(main.getByRole('button', { name: 'Email to Maya' }));
  assert.ok(await ui.findByText('Quote emailed to maya@example.test.'));
  assert.equal(posts('/email-quote').length, 1);
});

test('cw-quote: with the shop’s own logo, Print waits for it to load; the paper is black on white, with no card', async () => {
  const { ui, within, fireEvent } = await open('/workshop/c2w/9/quote', { quote: { ...QUOTE, shop: { ...QUOTE.shop, logoUrl: 'http://localhost/logo.png' } } });
  const main = within(await ui.findByRole('main'));
  fireEvent.click(await main.findByRole('button', { name: 'Print' }));
  const paper = document.getElementById('wh-print');
  const logo = paper.querySelector('img');
  assert.ok(logo !== null && logo.getAttribute('src') === 'http://localhost/logo.png');
  await new Promise((res) => setTimeout(res, 30));
  assert.ok(!calls.some((c) => c.method === 'PRINT'), 'not printed before the logo has loaded');
  logo.dispatchEvent(new window.Event('load'));
  await new Promise((res) => setTimeout(res, 10));
  assert.equal(calls.filter((c) => c.method === 'PRINT').length, 1);
  const classes = [...paper.querySelectorAll('[class]')].map((el) => el.getAttribute('class')).join(' ');
  for (const look of ['shadow', 'bg-[', 'text-[var(--wh-muted)]', 'border-[var(']) assert.ok(!classes.includes(look), `${look} on paper`);
});

test('the order: Try again on a failed email locks while it sends, so a double tap sends once', async () => {
  const { ui, fireEvent } = await open('/workshop/c2w/9', { emailFails: 'fault' });
  fireEvent.click(await ui.findByRole('button', { name: 'Email the quote again' }));
  const again = await ui.findByRole('button', { name: 'Try again' });
  fireEvent.click(again);
  assert.equal(again.disabled, true, 'the note’s button is off while it sends');
  fireEvent.click(again);
  assert.ok(await ui.findByText('Quote emailed to maya@example.test.'));
  assert.equal(posts('/email-quote').length, 2, 'the first, failed, and one more');
});

test('cw-quote-revised: the revised heading, Revised [date] and Email the revised quote', async () => {
  const { ui, within } = await open('/workshop/c2w/9/quote', { quote: { ...QUOTE, revisedOn: day(0) } });
  const main = within(await ui.findByRole('main'));
  assert.ok(await main.findByRole('heading', { level: 2, name: 'The revised quote' }));
  assert.ok(main.getByText(`Revised ${long(day(0))}`));
  assert.ok(main.queryByText(/^Given /) === null);
  assert.ok(main.getByRole('button', { name: 'Email the revised quote to Maya' }));
});

// ---- 4.4 The order ----

test('cw-order-held: heading, stages, the hold, What’s happened, The order, Who pays what and Customer', async () => {
  const { ui, within } = await open('/workshop/c2w/9');
  const main = within(await ui.findByRole('main'));
  assert.ok(await main.findByRole('heading', { level: 2, name: 'Maya Patel · Cycle to Work' }));
  assert.equal(main.getByRole('link', { name: 'Cycle to Work' }).getAttribute('href'), '/workshop/c2w');
  assert.ok(main.getByText('Quote CW-1 · North Street Cycles, Bolton'));
  const stages = within(main.getByRole('list', { name: 'Stages' })).getAllByRole('listitem');
  assert.deepEqual(stages.map((s) => s.textContent.replace(/^\d/, '').replace(/(Now|\d+ \w+ \d{4})$/, '')), ['Quote given', 'Waiting for the certificate', 'Certificate received', 'Ready to collect', 'Collected', 'Paid by the provider']);
  assert.equal(stages[1].getAttribute('aria-current'), 'step');
  assert.ok(stages[1].textContent.endsWith('Now'));
  assert.ok(main.getByRole('heading', { level: 3, name: 'Next: the certificate' }));
  assert.ok(main.getByText((_, el) => el?.tagName === 'P' && el.textContent === `[Bike] · [Size] is held until ${long(day(1))}. Hold ends in 1 day — we’ll remind the shop 2 days before.`));
  const history = within(main.getByRole('heading', { level: 3, name: 'What’s happened' }).closest('section'));
  const lines = history.getAllByRole('listitem').map((l) => l.textContent);
  assert.equal(lines.length, 1);
  assert.ok(lines[0].endsWith(`Jo Taylor gave quote CW-1 and emailed it to maya@example.test · it says the bike is put aside until ${long(day(1))}`), lines[0]);
  const details = within(main.getByRole('heading', { level: 3, name: 'The order' }).closest('section'));
  for (const [k, v] of [['Bike', '[Bike] · [Size]'], ['Accessories', '[Accessory]'], ['Provider', '[Provider]'], ['Expected from the provider', 'After collection'], ['Order total', '£1,040.00'], ['[Provider] pays (the certificate)', '£1,040.00'], ['Maya pays at collection', '£0.00']]) {
    assert.equal(details.getByText(k).nextElementSibling.textContent, v, k);
  }
  assert.ok(details.getByRole('heading', { name: 'Who pays what' }));
  assert.ok(details.getByRole('button', { name: 'Email the quote again' }) && details.getByRole('button', { name: 'Print the quote' }));
  const customer = within(main.getByRole('heading', { level: 3, name: 'Customer' }).closest('section'));
  assert.equal(customer.getByRole('link', { name: 'Maya Patel' }).getAttribute('href'), '/workshop/customers/5');
  assert.ok(customer.getByText((_, el) => el?.tagName === 'SPAN' && el.textContent === '07700 900 142 · maya@example.test'));
  for (const k of ['Applied', 'Employer', 'Application reference']) assert.ok(customer.getByText(k));
});

test('cw-more: the owner sees the provider’s commission on the order', async () => {
  const { ui, within } = await open('/workshop/c2w/9', { me: OWNER });
  const details = within((await ui.findByRole('heading', { level: 3, name: 'The order' })).closest('section'));
  assert.equal(details.getByText('Provider').nextElementSibling.textContent, '[Provider] · commission 5%');
});

test('the order: Email the quote again sends it and says so; Print the quote prints the quote itself', async () => {
  const { ui, fireEvent } = await open('/workshop/c2w/9');
  fireEvent.click(await ui.findByRole('button', { name: 'Email the quote again' }));
  assert.ok(await ui.findByText('Quote emailed to maya@example.test.'));
  fireEvent.click(ui.getByRole('button', { name: 'Print the quote' }));
  await new Promise((r) => setTimeout(r, 30));
  assert.ok(calls.some((c) => c.method === 'PRINT'));
  const paper = document.getElementById('wh-print');
  for (const t of ['LOGO', 'Quote number CW-1', '£1,040.00', QUOTE.closing]) assert.ok(paper?.textContent.includes(t), t);
  assert.ok(ui.getByRole('heading', { level: 2, name: 'Maya Patel · Cycle to Work' }), 'the order stays on screen');
});

test('the order: a bike not in stock says the shop’s rule, and Who pays what follows a provider without accessories', async () => {
  const { ui, within } = await open('/workshop/c2w/9', { theOrder: order({ holdUntil: null, inStock: false }), providers: [{ ...PROVIDER, accessoriesInside: false }] });
  const main = within(await ui.findByRole('main'));
  assert.ok(await main.findByRole('heading', { level: 3, name: 'Next: Maya applies' }));
  assert.ok(main.getByText((_, el) => el?.tagName === 'P' && el.textContent === 'Not in stock. Your rule: order once the customer has applied.'));
  const details = within(main.getByRole('heading', { level: 3, name: 'The order' }).closest('section'));
  assert.equal(details.getByText('Bike').nextElementSibling.textContent, '[Bike] · [Size] · not in stock');
  assert.equal(details.getByText('[Provider] pays (the certificate)').nextElementSibling.textContent, '£1,000.00');
  assert.equal(details.getByText('Maya pays at collection').nextElementSibling.textContent, '£40.00');
});

test('no email address: no Email the quote again on the order, and no Email on the quote', async () => {
  const noEmail = order({ customerEmail: null });
  const first = await open('/workshop/c2w/9', { theOrder: noEmail });
  assert.ok(await first.ui.findByRole('button', { name: 'Print the quote' }));
  assert.ok(first.ui.queryByRole('button', { name: 'Email the quote again' }) === null);
  first.cleanup();
  shell.queryClient.clear();
  uninstall();
  rendered = false;
  const { ui } = await open('/workshop/c2w/9/quote', { theOrder: noEmail });
  assert.ok(await ui.findByRole('button', { name: 'Print' }));
  await new Promise((res) => setTimeout(res, 30));
  assert.ok(ui.queryByRole('button', { name: /^Email/ }) === null);
});
