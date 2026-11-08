// Cost went up? Change it on a booked-in delivery (openspec/changes/product-page-sizes, design 5;
// receiving's 3 Oct later change, walk-through 3 M3; the box follows rs-invoice-cost): the Owner
// changes a line's cost; staff, sent no costs, see no Change cost. Shimano brake pads B05S-RX,
// Jack Lewis and Jo Taylor as drawn; the rest bracketed, or a number only the test needs.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const OWNER = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const JO = { ...OWNER, id: 2, name: 'Jo Taylor', email: 'jo@example.com', isOwner: false };
const LINE = { id: 5, productId: 11, name: 'Shimano brake pads', sku: 'B05S-RX', barcode: null, pricePence: 2800, qty: 2 };
const DELIVERY = { id: 77, supplierId: 1, supplierName: '[Supplier]', items: 2, bookedInAt: '2026-09-01T10:00:00.000Z', bookedBy: 'Jack Lewis', setAside: [], stillToCome: [] };
const realFetch = globalThis.fetch;
let uninstall;
let shell;
let rendered = false;
let sent;
afterEach(async () => {
  if (!rendered) return;
  rendered = false;
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  shell?.queryClient.clear();
  uninstall?.();
  globalThis.fetch = realFetch;
});

async function open({ me = OWNER, refuse = null } = {}) {
  sent = [];
  let unit = 14;
  const costs = me === OWNER;
  globalThis.fetch = async (url, init = {}) => {
    const answer = (status, b) => ({ status, ok: status < 300, json: async () => b });
    const u = new URL(url, 'http://localhost');
    if (u.pathname === '/api/auth/me') return answer(200, me);
    if (u.pathname === '/api/deliveries/booked-in/77/lines/5/cost' && init.method === 'PUT') {
      sent.push(JSON.parse(init.body));
      if (refuse) return answer(refuse.status, refuse.body);
      unit = sent.at(-1).costPence / 100;
      return answer(200, { lineId: 5, unitCost: unit });
    }
    if (u.pathname === '/api/deliveries/booked-in/77') {
      return answer(200, { ...DELIVERY, lines: [costs ? { ...LINE, unitCost: unit, lineCost: unit * 2 } : LINE], ...(costs ? { bookedCost: unit * 2 } : {}) });
    }
    if (u.pathname.startsWith('/api/')) return answer(200, []);
    return answer(404, { error: 'Not found' });
  };
  uninstall = installDom('http://localhost/workshop/deliveries/delivery/77');
  rendered = true;
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { if (this.open) { this.open = false; this.dispatchEvent(new window.Event('close')); } };
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  shell = await importFresh(SHELL);
  const ui = rtl.render(createElement(shell.AppShell));
  await ui.findByRole('list', { name: 'Items in this delivery' });
  return { ...rtl, ui };
}

test('the Owner changes a line’s cost: sent in whole pence, the line shows it', async () => {
  const t = await open();
  t.fireEvent.click(t.ui.getByRole('button', { name: 'Change the cost of Shimano brake pads' }));
  const box = t.within(await t.ui.findByRole('dialog', { name: 'Cost went up? Change it' }));
  assert.ok(box.getByText((_, el) => el?.tagName === 'P' && el.textContent.startsWith('Was £14.00. It changes from now on')));
  t.fireEvent.change(box.getByLabelText('New cost'), { target: { value: '15.50' } });
  t.fireEvent.click(box.getByRole('button', { name: 'Change cost' }));
  await t.waitFor(() => assert.equal(sent.length, 1));
  assert.deepEqual(sent[0], { costPence: 1550 });
  await t.waitFor(() => assert.ok(t.ui.queryByRole('dialog') === null));
  await t.ui.findByText('B05S-RX · 2 × £15.50');
});

test('the server’s words stay in the box', async () => {
  const t = await open({ refuse: { status: 403, body: { error: 'Only the shop’s owner can add or change products', code: 'owner_only' } } });
  t.fireEvent.click(t.ui.getByRole('button', { name: 'Change the cost of Shimano brake pads' }));
  const box = t.within(await t.ui.findByRole('dialog', { name: 'Cost went up? Change it' }));
  t.fireEvent.change(box.getByLabelText('New cost'), { target: { value: '15.50' } });
  t.fireEvent.click(box.getByRole('button', { name: 'Change cost' }));
  assert.equal((await box.findByRole('alert')).textContent, 'Only the shop’s owner can add or change products');
});

test('staff, sent no costs, see no Change cost', async () => {
  const { ui } = await open({ me: JO });
  assert.ok(ui.queryByRole('button', { name: /Change the cost/ }) === null);
});
