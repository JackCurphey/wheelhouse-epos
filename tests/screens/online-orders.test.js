// Front desk › Online orders, the staff's side (openspec/changes/website-buy-online
// tasks 8.1–8.4; online.mjs on-orders, on-orders-ready, on-orders-sold-at-till,
// on-order-staff, on-order-staff-ready, on-not-ready). Can't supply and Cancel
// and refund wait for refunds (group 7), so they aren't here. Example data from
// the drawing: North Street Cycles, Bolton, Jo Taylor, Maya Patel, the brake
// pads; order numbers, shelf names and other customers stay bracketed, and the
// times are visibly test values.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const JO = { id: 2, name: 'Jo Taylor', email: 'jo@example.com', isOwner: false, shopName: 'North Street Cycles', shopSlug: 'north-street' };
// Mon 14 Sep 2026, 10:15 in Bolton; Tue 8 Sep for an older one.
const PAID = '2026-09-14T09:15:00.000Z';
const OLD = '2026-09-08T08:30:00.000Z';
const PADS = { productId: 31, name: 'Shimano brake pads B05S-RX', qty: 1, where: 'On the shelf', notOnShelf: false };
const row = (over = {}) => ({
  id: 7, number: 1, reference: '[order number]', stage: 'to_get_ready', customer: 'Maya Patel', phone: '07700 900 142', siteId: 1, how: 'Collect · Bolton',
  paidAt: PAID, readyAt: null, keepUntil: null, notCollectedDays: null, collectedAt: null, collectedBy: null, emailProblem: null, markReadyOff: null,
  items: [PADS], ...over,
});
const full = (over = {}) => ({ ...row(over), email: 'maya@example.test', paid: { creditPence: 1000, cardPence: 1800, totalPence: 2800 }, shelfName: '[Shelf name]', ...over });
const waiting = { productId: 33, name: '[Product]', qty: 1, where: 'Waiting at [Shelf name]', notOnShelf: false };
const OTHER = row({ id: 8, reference: '[second order number]', customer: '[Customer]', phone: '[phone]', items: [{ productId: 32, name: '[Product]', qty: 2, where: 'On the shelf', notOnShelf: false }] });
const READY = row({ id: 9, reference: '[third order number]', stage: 'ready', customer: '[Second customer]', phone: '[phone]', readyAt: PAID, items: [waiting], emailProblem: { failed: 'online_order_ready', phone: '[phone]' } });
const LATE = row({ id: 10, reference: '[fourth order number]', stage: 'ready', customer: '[Third customer]', readyAt: OLD, items: [waiting], notCollectedDays: 4 });
const DONE = row({ id: 11, reference: '[fifth order number]', stage: 'collected', customer: '[Fourth customer]', readyAt: OLD, collectedAt: PAID, collectedBy: 'Jo Taylor', items: [{ ...waiting, where: null }] });
const HINTS = {
  to_get_ready: 'Mark ready when everything’s on the shelf for collection — the customer is told straight away.',
  ready: 'Hand over opens the till’s hand-over for that order — it’s already paid.',
  collected: 'The last 7 days. Older orders are on each customer’s page.',
};
const groupsOf = (orders) => [['to_get_ready', 'To get ready'], ['ready', 'Ready to collect'], ['collected', 'Collected']]
  .map(([key, title]) => ({ key, title, hint: HINTS[key], orders: orders.filter((o) => o.stage === key) }));

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

/** `on` answers a POST to /api/online-orders/<id><end> with [status, body]; it may change `state.orders`, which the page reloads. */
async function open({ orders = [row(), OTHER, READY, LATE, DONE], on = {} } = {}) {
  calls = [];
  state = { orders };
  globalThis.fetch = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url: String(url), method, body });
    const reply = (status, b) => ({ status, ok: status < 300, json: async () => b });
    const p = new URL(url, 'http://localhost').pathname;
    if (p === '/api/auth/me') return reply(200, JO);
    if (p === '/api/online-order-count') return reply(200, { count: state.orders.filter((o) => o.stage === 'to_get_ready').length });
    if (p === '/api/online-orders') return reply(200, { groups: groupsOf(state.orders) });
    const m = p.match(/^\/api\/online-orders\/(\d+)(\/.*)?$/);
    if (m && method === 'POST') {
      const end = m[2] ?? '';
      if (on[end]) { const [status, b] = await on[end](Number(m[1]), body); return reply(status, b); }
      return reply(404, { error: 'Not found' });
    }
    if (m) {
      const o = state.orders.find((x) => x.id === Number(m[1]));
      return o ? reply(200, { order: full(o) }) : reply(404, { error: 'Not found' });
    }
    if (p.startsWith('/api/')) return reply(200, []);
    return reply(404, { error: 'Not found' });
  };
  uninstall = installDom('http://localhost/workshop/orders');
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { if (this.open) { this.open = false; this.dispatchEvent(new window.Event('close')); } };
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  shell = await importFresh(SHELL);
  rendered = true;
  const ui = rtl.render(createElement(shell.AppShell));
  return { ...rtl, ui };
}
const posts = (id, end) => calls.filter((c) => c.method === 'POST' && c.url.endsWith(`/api/online-orders/${id}${end}`));
const move = (id, stage, over = {}) => { state.orders = state.orders.map((o) => (o.id === id ? { ...o, stage, ...over } : o)); };
const groupOf = async (ui, within, name) => within(await ui.findByRole('list', { name }));
const rowOf = (list, name) => list.getAllByRole('listitem').find((li) => li.textContent.includes(name));
const noteText = () => document.querySelector('[data-saved-note]')?.textContent ?? '';

test('on-orders: three groups with their counts and hints, each row’s words, and the sidebar count', async () => {
  const { ui, within } = await open();
  await ui.findByRole('heading', { name: 'To get ready · 2' });
  assert.ok(ui.getByRole('heading', { name: 'Ready to collect · 2' }));
  assert.ok(ui.getByRole('heading', { name: 'Collected · 1' }));
  for (const hint of Object.values(HINTS)) assert.ok(ui.getByText(hint));
  assert.ok(ui.getByText((_, el) => el?.tagName === 'P' && /^\w+ \d+ \w+ · North Street Cycles$/.test(el.textContent)), 'the day and the shop');

  const toGet = await groupOf(ui, within, 'To get ready · 2');
  const maya = within(rowOf(toGet, 'Maya Patel'));
  assert.ok(maya.getByRole('button', { name: 'Open Maya Patel’s order' }));
  assert.ok(maya.getByText('Order [order number] · paid Mon 14 Sep, 10:15'));
  assert.ok(maya.getByText('Shimano brake pads B05S-RX'));
  assert.ok(maya.getByText('On the shelf'));
  assert.ok(maya.getByText('Collect · Bolton'));
  assert.ok(maya.getByRole('button', { name: 'Mark Maya Patel’s order ready' }));
  assert.ok(within(rowOf(toGet, '[Customer]')).getByText('[Product] × 2'));

  const ready = await groupOf(ui, within, 'Ready to collect · 2');
  const second = within(rowOf(ready, '[Second customer]'));
  assert.ok(second.getByText('Order [third order number] · ready since Mon 14 Sep, 10:15'));
  assert.ok(second.getByText('Waiting at [Shelf name]'));
  assert.ok(second.getByText('Email didn’t arrive · [phone]'));
  assert.ok(second.getByRole('button', { name: 'Hand over [Second customer]’s order' }));
  const third = within(rowOf(ready, '[Third customer]'));
  assert.ok(third.getByText('Order [fourth order number] · ready since Tue 8 Sep, 09:30'));
  assert.ok(third.getByText('Not collected · 4 days'));
  assert.ok(third.queryByText(/Email didn’t arrive/) === null);

  const done = within(rowOf(await groupOf(ui, within, 'Collected · 1'), '[Fourth customer]'));
  assert.ok(done.getByText('Order [fifth order number] · collected Mon 14 Sep, 10:15'));
  assert.ok(done.getByText('by Jo Taylor'));
  assert.ok(done.queryByRole('button', { name: /Hand over|ready/ }) === null);

  const [side] = await ui.findAllByRole('link', { name: 'Online orders, 2 to get ready' });
  assert.match(side.textContent, /2$/);
});

test('on-orders: nothing to get ready says so; no count shows in the sidebar', async () => {
  const { ui } = await open({ orders: [READY] });
  await ui.findByRole('heading', { name: 'To get ready · 0' });
  assert.ok(ui.getByText('Nothing to get ready here.'));
  assert.ok(ui.queryByText(HINTS.to_get_ready) === null);
  const [side] = await ui.findAllByRole('link', { name: 'Online orders' });
  assert.equal(side.textContent, 'Online orders');
});

test('on-orders-sold-at-till: a line sold at the till says so and Mark ready is off with the reason', async () => {
  const sold = row({ items: [{ ...PADS, where: 'Not on the shelf any more', notOnShelf: true }], markReadyOff: 'Sold at the till. Open the order to sort it.' });
  const { ui, within } = await open({ orders: [sold] });
  const maya = within(rowOf(await groupOf(ui, within, 'To get ready · 1'), 'Maya Patel'));
  assert.ok(maya.getByText('Not on the shelf any more'));
  const mark = maya.getByRole('button', { name: 'Mark Maya Patel’s order ready' });
  assert.equal(mark.disabled, true);
  assert.ok(maya.getByText('Sold at the till. Open the order to sort it.'));
  assert.equal(mark.getAttribute('aria-describedby'), maya.getByText('Sold at the till. Open the order to sort it.').id);
});

test('on-orders-ready: Mark ready moves the row to Ready and says when the email goes, with Undo', async () => {
  const { ui, within, fireEvent, waitFor } = await open({
    on: {
      '/ready': (id) => { move(id, 'ready', { readyAt: PAID, items: [{ ...PADS, where: 'Waiting at [Shelf name]' }] }); return [200, { order: row(), waitSeconds: 10 }]; },
      '/ready/undo': (id) => { move(id, 'to_get_ready'); return [200, { order: row() }]; },
    },
  });
  fireEvent.click(within(rowOf(await groupOf(ui, within, 'To get ready · 2'), 'Maya Patel')).getByRole('button', { name: 'Mark Maya Patel’s order ready' }));
  await ui.findByRole('heading', { name: 'Ready to collect · 3' });
  assert.equal(posts(7, '/ready').length, 1);
  await waitFor(() => assert.match(noteText(), /^Ready\. The email goes to Maya Patel in 10 seconds/));
  assert.ok(ui.getByRole('heading', { name: 'To get ready · 1' }));
  assert.ok((await ui.findAllByRole('link', { name: 'Online orders, 1 to get ready' })).length);

  fireEvent.click(within(document.querySelector('[data-saved-note]')).getByRole('button', { name: 'Undo' }));
  await ui.findByRole('heading', { name: 'To get ready · 2' });
  assert.equal(posts(7, '/ready/undo').length, 1);
  await waitFor(() => assert.equal(noteText(), 'Undone'));
});

test('on-orders-ready: Undo after the email has gone shows the server’s words', async () => {
  const gone = 'The ready email has gone. Use “Not ready after all” instead.';
  const { ui, within, fireEvent, waitFor } = await open({
    on: {
      '/ready': (id) => { move(id, 'ready', { readyAt: PAID }); return [200, { order: row(), waitSeconds: 10 }]; },
      '/ready/undo': () => [409, { error: gone, code: 'too_late' }],
    },
  });
  fireEvent.click(within(rowOf(await groupOf(ui, within, 'To get ready · 2'), 'Maya Patel')).getByRole('button', { name: 'Mark Maya Patel’s order ready' }));
  await waitFor(() => assert.match(noteText(), /^Ready\./));
  fireEvent.click(within(document.querySelector('[data-saved-note]')).getByRole('button', { name: 'Undo' }));
  await waitFor(() => assert.equal(noteText(), gone));
});

test('a step refused for want of a check-in says so', async () => {
  const { ui, within, fireEvent, waitFor } = await open({ on: { '/ready': () => [409, { error: 'Check in with your PIN first', code: 'check_in_first' }] } });
  fireEvent.click(within(rowOf(await groupOf(ui, within, 'To get ready · 2'), 'Maya Patel')).getByRole('button', { name: 'Mark Maya Patel’s order ready' }));
  await waitFor(() => assert.equal(noteText(), 'Check in with your PIN first'));
  assert.ok(ui.getByRole('heading', { name: 'To get ready · 2' }));
});

test('on-order-staff: the order opens with its items, how, how it was paid and the customer; Mark ready from there', async () => {
  const { ui, within, fireEvent, waitFor } = await open({
    on: { '/ready': (id) => { move(id, 'ready', { readyAt: PAID }); return [200, { order: row(), waitSeconds: 10 }]; } },
  });
  fireEvent.click(await ui.findByRole('button', { name: 'Open Maya Patel’s order' }));
  const box = within(await ui.findByRole('dialog', { name: 'Order [order number] · Maya Patel' }));
  await box.findByText('Shimano brake pads B05S-RX');
  assert.ok(box.getByText('On the shelf'));
  assert.ok(box.getByText('Collect from Bolton'));
  assert.ok(box.getByText('Paid Mon 14 Sep, 10:15'));
  const paidLine = (t) => (_, el) => el?.tagName === 'SPAN' && el.textContent === t;
  assert.ok(box.getByText(paidLine('Store credit £10.00')));
  assert.ok(box.getByText(paidLine('Card £18.00')));
  assert.ok(box.getByText('maya@example.test'));
  assert.equal(box.getByRole('link', { name: '07700 900 142' }).getAttribute('href'), 'tel:07700900142');
  assert.ok(box.queryByRole('button', { name: /Can’t supply|Cancel and refund/ }) === null, 'refunds come with group 7');
  assert.ok(box.getByRole('button', { name: 'Close' }));
  fireEvent.click(box.getByRole('button', { name: 'Mark ready' }));
  await waitFor(() => assert.ok(ui.queryByRole('dialog') === null));
  assert.equal(posts(7, '/ready').length, 1);
  await waitFor(() => assert.match(noteText(), /^Ready\. The email goes to Maya Patel in 10 seconds/));
});

test('on-order-staff: a line sold at the till keeps Mark ready off on the order too', async () => {
  const sold = row({ items: [{ ...PADS, where: 'Not on the shelf any more', notOnShelf: true }], markReadyOff: 'Sold at the till. Open the order to sort it.' });
  const { ui, within, fireEvent } = await open({ orders: [sold] });
  fireEvent.click(await ui.findByRole('button', { name: 'Open Maya Patel’s order' }));
  const box = within(await ui.findByRole('dialog', { name: 'Order [order number] · Maya Patel' }));
  await box.findByText('Not on the shelf any more');
  assert.equal(box.getByRole('button', { name: 'Mark ready' }).disabled, true);
  // The drawn order page's "Mark ready isn’t available yet: …" line, with the till sale as its reason.
  const why = box.getByText('Mark ready isn’t available yet: an item was sold at the till.');
  assert.equal(box.getByRole('button', { name: 'Mark ready' }).getAttribute('aria-describedby'), why.id);
});

test('on-order-staff-ready: a ready order says where it waits, with Not ready after all and Hand over; Hand over on the list opens it', async () => {
  const mayaReady = row({ stage: 'ready', readyAt: PAID, items: [{ ...PADS, where: 'Waiting at [Shelf name]' }] });
  const { ui, within, fireEvent, waitFor } = await open({
    orders: [mayaReady],
    on: { '/hand-over': (id) => { move(id, 'collected', { collectedAt: PAID, collectedBy: 'Jo Taylor' }); return [200, { order: row() }]; } },
  });
  fireEvent.click(await ui.findByRole('button', { name: 'Hand over Maya Patel’s order' }));
  const box = within(await ui.findByRole('dialog', { name: 'Order [order number] · Maya Patel' }));
  assert.ok(await box.findByText('Ready since Mon 14 Sep, 10:15 · emailed · waiting at [Shelf name]'));
  assert.ok(box.getByRole('button', { name: 'Not ready after all' }));
  assert.ok(box.queryByRole('button', { name: 'Mark ready' }) === null);
  assert.equal(posts(7, '/hand-over').length, 0, 'the list’s Hand over only opens the order');
  fireEvent.click(box.getByRole('button', { name: 'Hand over' }));
  await waitFor(() => assert.ok(ui.queryByRole('dialog') === null));
  assert.equal(posts(7, '/hand-over').length, 1);
  await ui.findByRole('heading', { name: 'Collected · 1' });
  await waitFor(() => assert.equal(noteText(), 'Handed over Maya Patel’s order'));
});

test('on-order-staff-ready: an email that didn’t arrive is said instead of “emailed”', async () => {
  const { ui, within, fireEvent } = await open({ orders: [READY] });
  fireEvent.click(await ui.findByRole('button', { name: 'Open [Second customer]’s order' }));
  const box = within(await ui.findByRole('dialog', { name: 'Order [third order number] · [Second customer]' }));
  assert.ok(await box.findByText('Ready since Mon 14 Sep, 10:15 · email didn’t arrive · waiting at [Shelf name]'));
});

test('on-order-staff: a collected order says who collected it, with no empty place under its items', async () => {
  const { ui, within, fireEvent } = await open({ orders: [DONE] });
  fireEvent.click(await ui.findByRole('button', { name: 'Open [Fourth customer]’s order' }));
  const box = within(await ui.findByRole('dialog', { name: 'Order [fifth order number] · [Fourth customer]' }));
  assert.ok(await box.findByText('Collected Mon 14 Sep, 10:15 by Jo Taylor'));
  const line = within(box.getByRole('list', { name: 'Items' })).getAllByRole('listitem')[0];
  assert.equal(line.children.length, 1, 'the server sends no place for a collected item, so no badge shows');
});

test('on-order-staff-ready: a refused Hand over says why inside the order', async () => {
  const mayaReady = row({ stage: 'ready', readyAt: PAID, items: [{ ...PADS, where: 'Waiting at [Shelf name]' }] });
  const { ui, within, fireEvent } = await open({
    orders: [mayaReady],
    on: { '/hand-over': () => [409, { error: 'Check in with your PIN first', code: 'check_in_first' }] },
  });
  fireEvent.click(await ui.findByRole('button', { name: 'Open Maya Patel’s order' }));
  const box = within(await ui.findByRole('dialog', { name: 'Order [order number] · Maya Patel' }));
  fireEvent.click(await box.findByRole('button', { name: 'Hand over' }));
  assert.equal((await box.findByRole('alert')).textContent, 'Check in with your PIN first');
  assert.equal(box.getByRole('button', { name: 'Hand over' }).disabled, false);
});

test('on-not-ready: Not ready after all asks first, ticked to send the sorry email; Move it back sends the tick', async () => {
  const mayaReady = row({ stage: 'ready', readyAt: PAID, items: [{ ...PADS, where: 'Waiting at [Shelf name]' }] });
  const { ui, within, fireEvent, waitFor } = await open({
    orders: [mayaReady],
    on: { '/not-ready': (id) => { move(id, 'to_get_ready', { readyAt: null }); return [200, { order: row() }]; } },
  });
  fireEvent.click(await ui.findByRole('button', { name: 'Open Maya Patel’s order' }));
  fireEvent.click(await within(await ui.findByRole('dialog', { name: 'Order [order number] · Maya Patel' })).findByRole('button', { name: 'Not ready after all' }));
  const ask = within(await ui.findByRole('dialog', { name: 'Not ready after all?' }));
  assert.ok(ask.getByText('Order [order number] · Maya Patel was told it’s ready at Mon 14 Sep, 10:15'));
  assert.ok(ask.getByText('It goes back to “To get ready”.'));
  const tick = ask.getByRole('checkbox', { name: /Send Maya “Sorry, not ready yet”/ });
  assert.equal(tick.checked, true);
  assert.ok(ask.getByText('The wording is in Settings › Messages › Order not ready after all'));

  fireEvent.click(ask.getByRole('button', { name: 'Keep it ready' }));
  await waitFor(() => assert.ok(ui.queryByRole('dialog', { name: 'Not ready after all?' }) === null));
  assert.equal(posts(7, '/not-ready').length, 0, 'Keep it ready changes nothing');

  fireEvent.click(await ui.findByRole('button', { name: 'Not ready after all' }));
  const again = within(await ui.findByRole('dialog', { name: 'Not ready after all?' }));
  fireEvent.click(again.getByRole('checkbox', { name: /Send Maya/ }));
  fireEvent.click(again.getByRole('button', { name: 'Move it back' }));
  await waitFor(() => assert.equal(posts(7, '/not-ready').length, 1));
  assert.deepEqual(posts(7, '/not-ready')[0].body, { tell: false });
  await ui.findByRole('heading', { name: 'To get ready · 1' });
  await waitFor(() => assert.ok(ui.queryByRole('dialog') === null));
});

test('on-not-ready: left ticked, Move it back asks for the sorry email', async () => {
  const mayaReady = row({ stage: 'ready', readyAt: PAID, items: [{ ...PADS, where: 'Waiting at [Shelf name]' }] });
  const { ui, within, fireEvent, waitFor } = await open({
    orders: [mayaReady],
    on: { '/not-ready': (id) => { move(id, 'to_get_ready', { readyAt: null }); return [200, { order: row() }]; } },
  });
  fireEvent.click(await ui.findByRole('button', { name: 'Open Maya Patel’s order' }));
  fireEvent.click(await within(await ui.findByRole('dialog', { name: 'Order [order number] · Maya Patel' })).findByRole('button', { name: 'Not ready after all' }));
  fireEvent.click(within(await ui.findByRole('dialog', { name: 'Not ready after all?' })).getByRole('button', { name: 'Move it back' }));
  await waitFor(() => assert.equal(posts(7, '/not-ready').length, 1));
  assert.deepEqual(posts(7, '/not-ready')[0].body, { tell: true });
});
