// To return to [Supplier], with Returned (openspec/changes/to-return; rs-hub,
// rs-hub-staff in receiving.mjs; receiving decisions 4, 9 and 10). Example
// data from the drawing: Shimano brake pads; everything else stays a
// bracketed placeholder.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const OWNER = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const JO = { ...OWNER, id: 2, name: 'Jo Taylor', email: 'jo@example.com', isOwner: false };
const AT = '2026-09-01T10:00:00.000Z';
const LIST = {
  suppliers: [
    { supplierId: 1, supplierName: '[Supplier]', items: [
      { id: 31, productName: 'Shimano brake pads', kind: 'damaged', qty: 1, deliveredAt: AT },
      { id: 32, productName: '[Product]', kind: 'wrong_item', qty: 2, deliveredAt: AT },
    ] },
    { supplierId: null, supplierName: null, items: [{ id: 33, productName: '[Product 2]', kind: 'damaged', qty: 1, deliveredAt: AT }] },
  ],
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

async function open({ me = OWNER, list = LIST, refuse = null } = {}) {
  calls = [];
  let state = structuredClone(list);
  globalThis.fetch = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    calls.push({ url: String(url), method });
    const reply = (status, b) => ({ status, ok: status < 300, json: async () => b });
    const u = new URL(url, 'http://localhost');
    if (u.pathname === '/api/auth/me') return reply(200, me);
    if (u.pathname === '/api/deliveries/to-return') return me.isOwner ? reply(200, state) : reply(403, { error: "Only the shop's owner can order stock", code: 'owner_only' });
    const m = u.pathname.match(/^\/api\/deliveries\/to-return\/(\d+)\/returned$/);
    if (m && method === 'POST') {
      if (refuse) return reply(refuse.status, refuse.body);
      const id = Number(m[1]);
      state = { suppliers: state.suppliers.map((s) => ({ ...s, items: s.items.filter((i) => i.id !== id) })).filter((s) => s.items.length) };
      return reply(200, { id, returnedAt: AT });
    }
    if (u.pathname === '/api/purchase-orders') return reply(200, []);
    if (u.pathname.startsWith('/api/')) return reply(200, []);
    return reply(404, { error: 'Not found' });
  };
  uninstall = installDom('http://localhost/workshop/deliveries');
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  shell = await importFresh(SHELL);
  rendered = true;
  const ui = rtl.render(createElement(shell.AppShell));
  return { ...rtl, ui };
}
const returnedPosts = () => calls.filter((c) => c.method === 'POST' && /\/api\/deliveries\/to-return\/\d+\/returned$/.test(c.url)).map((c) => c.url);

test('a section per supplier, second on the page, each item with its kind, how many, the delivery\'s day and Returned', async () => {
  const { ui, within } = await open();
  const section = await ui.findByRole('region', { name: 'To return to [Supplier]' });
  const rows = within(section).getAllByRole('listitem').map((r) => r.textContent);
  assert.deepEqual(rows, [
    'Shimano brake padsDamaged · 1 · from the delivery on Tue 1 SepReturned',
    '[Product]Wrong item · 2 · from the delivery on Tue 1 SepReturned',
  ]);
  assert.ok(within(section).getByRole('button', { name: 'Returned: Shimano brake pads, damaged' }));
  assert.ok(within(section).getByRole('button', { name: 'Returned: [Product], wrong item' }));
  // Items with no supplier picked have their own section.
  const none = ui.getByRole('region', { name: 'To return' });
  assert.equal(within(none).getAllByRole('listitem').length, 1);
  // Second, after "A delivery arrived?", before Orders (decision 10).
  const order = ui.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
  assert.deepEqual(order.slice(0, 3), ['A delivery arrived?', 'To return to [Supplier]', 'To return']);
});

test('Returned takes the item off; the section goes when it is empty', async () => {
  const { ui, within, fireEvent, waitFor } = await open();
  const none = await ui.findByRole('region', { name: 'To return' });
  fireEvent.click(within(none).getByRole('button', { name: 'Returned: [Product 2], damaged' }));
  await waitFor(() => assert.ok(ui.queryByRole('region', { name: 'To return' }) === null));
  assert.deepEqual(returnedPosts(), ['/api/deliveries/to-return/33/returned']);
  assert.ok(ui.getByRole('region', { name: 'To return to [Supplier]' }));
});

test('a refusal shows in the section and the item stays', async () => {
  const { ui, within, fireEvent } = await open({ refuse: { status: 404, body: { error: 'Nothing to return with that id' } } });
  const section = await ui.findByRole('region', { name: 'To return to [Supplier]' });
  fireEvent.click(within(section).getByRole('button', { name: 'Returned: Shimano brake pads, damaged' }));
  assert.equal((await within(section).findByRole('alert')).textContent, 'Nothing to return with that id');
  assert.ok(within(section).getByRole('button', { name: 'Returned: Shimano brake pads, damaged' }));
});

test('nothing to return: no section; Staff never see it', async () => {
  const empty = await open({ list: { suppliers: [] } });
  await empty.ui.findByRole('heading', { name: 'Orders' });
  assert.ok(empty.ui.queryByRole('region', { name: /^To return/ }) === null);
  empty.cleanup(); shell.queryClient.clear(); uninstall(); rendered = false;
  const staff = await open({ me: JO });
  await staff.ui.findByRole('heading', { name: 'A delivery arrived?' });
  assert.ok(staff.ui.queryByRole('region', { name: /^To return/ }) === null);
  assert.ok(!calls.some((c) => c.url.includes('/to-return')), 'Staff don\'t ask for it');
});
