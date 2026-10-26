// Adjust stock on a product's page (openspec/changes/adjust-stock; drawn as
// st-adjust and st-adjust-faulty in stock.mjs; stock control decisions 6 and
// 11): the button for the Owner only; the change and the count after it
// joined; no reason until one is picked, and the reasons follow the sign;
// Adjust greyed with why; and the history says the reason and who.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const OWNER = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const JO = { ...OWNER, id: 2, name: 'Jo Taylor', email: 'jo@example.com', isOwner: false };
// Shimano brake pads B05S-RX £28.00 as drawn; the rest bracketed, or a number only the test needs.
const PADS = { id: 1, sku: 'B05S-RX', barcode: '[barcode]', name: 'Shimano brake pads', category: '[Category]', price: 28, cost: 14, stockQty: 6, lowStockThreshold: 3, supplier: '[Supplier]', active: true, showOnline: false, description: '', photoUrl: null, vatRateBp: 2000 };
const HISTORY = [
  { id: 12, type: 'adjustment', change: -1, reason: 'damaged', note: '[note]', who: 'Jo Taylor', at: '2026-09-01T12:00:00.000Z' },
  { id: 11, type: 'po_receipt', change: 7, reason: null, note: '', who: null, at: '2026-09-01T09:00:00.000Z' },
];
const realFetch = globalThis.fetch;
let uninstall;
let shell;
let rendered = false;
let posts;
afterEach(async () => {
  // Nothing rendered: importing RTL now would load react-dom with no DOM.
  if (!rendered) return;
  rendered = false;
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  shell?.queryClient.clear();
  uninstall?.();
  globalThis.fetch = realFetch;
});

async function open({ me = OWNER, reply = null } = {}) {
  posts = [];
  let page = { ...PADS, history: HISTORY };
  globalThis.fetch = async (url, init = {}) => {
    const answer = (status, b) => ({ status, ok: status < 300, json: async () => b });
    const u = new URL(url, 'http://localhost');
    if (u.pathname === '/api/auth/me') return answer(200, me);
    if (u.pathname === '/api/products/1/stock' && init.method === 'POST') {
      const body = JSON.parse(init.body);
      posts.push(body);
      if (reply) return answer(reply.status, reply.body);
      page = { ...page, stockQty: page.stockQty + body.change, history: [{ id: 13, type: 'adjustment', change: body.change, reason: body.reason, note: body.note, who: me.name, at: '2026-09-01T15:00:00.000Z' }, ...page.history] };
      return answer(200, page);
    }
    if (u.pathname === '/api/products/1') return answer(200, page);
    if (u.pathname.startsWith('/api/')) return answer(200, []);
    return answer(404, { error: 'Not found' });
  };
  uninstall = installDom('http://localhost/workshop/stock/1');
  rendered = true;
  // jsdom has no modal dialogs: open and close as the browser would.
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { if (this.open) { this.open = false; this.dispatchEvent(new window.Event('close')); } };
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  shell = await importFresh(SHELL);
  const ui = rtl.render(createElement(shell.AppShell));
  await ui.findByRole('heading', { level: 2, name: 'Shimano brake pads' });
  return { ...rtl, ui };
}

async function openBox(o) {
  const t = await open(o);
  t.fireEvent.click(t.within(t.ui.getByRole('region', { name: 'In stock' })).getByRole('button', { name: 'Adjust stock' }));
  const box = t.within(await t.ui.findByRole('dialog', { name: 'Adjust stock' }));
  return { ...t, box };
}
const reasons = (box) => box.getAllByRole('radio').map((r) => r.textContent);
const why = (box) => {
  const adjust = box.getByRole('button', { name: 'Adjust' });
  return adjust.getAttribute('aria-disabled') === 'true' ? document.getElementById(adjust.getAttribute('aria-describedby'))?.textContent : null;
};

test('Staff see no Adjust stock (Owner only, until roles)', async () => {
  const { ui } = await open({ me: JO });
  assert.ok(ui.queryByRole('button', { name: 'Adjust stock' }) === null);
});

test('the Owner sees Adjust stock in the In stock box', async () => {
  const { ui, within } = await open();
  assert.ok(within(ui.getByRole('region', { name: 'In stock' })).getByRole('button', { name: 'Adjust stock' }));
});

test('the box as drawn: −1, the count after it, no reason picked, Adjust greyed with why', async () => {
  const { box } = await openBox();
  assert.ok(box.getByText((_, el) => el?.tagName === 'P' && el.textContent === 'Shimano brake pads · B05S-RX · at North Street Cycles · 6 in stock now'));
  const change = box.getByRole('group', { name: 'Change in stock' });
  assert.equal(change.querySelector('input').value, '−1');
  assert.equal(box.getByRole('textbox', { name: 'In stock after' }).value, '5');
  assert.deepEqual(reasons(box), ['Damaged', 'Lost or stolen', 'Used in the workshop', 'Faulty — to return to supplier', 'Other']);
  assert.ok(box.getAllByRole('radio').every((r) => r.getAttribute('aria-checked') === 'false'), 'no reason picked until one is');
  assert.ok(box.getByRole('textbox', { name: 'Note (needed for Other)' }));
  assert.equal(why(box), 'Pick a reason to adjust');
  assert.ok(box.getByRole('button', { name: 'Cancel' }));
});

test('the change and the count after it are joined; going up, the reasons are Found and Other', async () => {
  const { box, fireEvent } = await openBox();
  fireEvent.change(box.getByRole('textbox', { name: 'In stock after' }), { target: { value: '3' } });
  assert.equal(box.getByRole('group', { name: 'Change in stock' }).querySelector('input').value, '−3');
  fireEvent.click(box.getByRole('radio', { name: 'Damaged' }));
  fireEvent.change(box.getByRole('textbox', { name: 'How many' }), { target: { value: '2' } });
  assert.equal(box.getByRole('textbox', { name: 'In stock after' }).value, '8');
  assert.deepEqual(reasons(box), ['Found', 'Other']);
  assert.equal(why(box), 'Pick a reason to adjust', 'Damaged doesn’t carry over going up');
  fireEvent.click(box.getByRole('button', { name: 'One fewer' }));
  assert.equal(box.getByRole('textbox', { name: 'How many' }).value, '1');
  assert.equal(box.getByRole('textbox', { name: 'In stock after' }).value, '7');
});

test('Other needs a note; nothing below zero; a greyed Adjust sends nothing', async () => {
  const { box, fireEvent } = await openBox();
  fireEvent.click(box.getByRole('radio', { name: 'Other' }));
  assert.equal(why(box), 'Write a note for Other');
  fireEvent.click(box.getByRole('button', { name: 'Adjust' }));
  assert.equal(posts.length, 0);
  fireEvent.change(box.getByRole('textbox', { name: 'In stock after' }), { target: { value: '-1' } });
  fireEvent.change(box.getByRole('textbox', { name: 'Note (needed for Other)' }), { target: { value: '[note]' } });
  assert.equal(why(box), 'Stock can’t go below zero');
  fireEvent.change(box.getByRole('textbox', { name: 'In stock after' }), { target: { value: '6' } });
  assert.equal(why(box), 'Type the change');
});

test('Adjust sends the change, the reason and the note; the history says the reason and who', async () => {
  const { ui, box, fireEvent, within, waitFor } = await openBox();
  fireEvent.click(box.getByRole('radio', { name: 'Damaged' }));
  fireEvent.change(box.getByRole('textbox', { name: 'Note (needed for Other)' }), { target: { value: '[note]' } });
  assert.equal(why(box), null);
  fireEvent.click(box.getByRole('button', { name: 'Adjust' }));
  await waitFor(() => assert.ok(ui.queryByRole('dialog', { name: 'Adjust stock' }) === null));
  assert.deepEqual(posts, [{ change: -1, type: 'adjustment', reason: 'damaged', note: '[note]' }]);
  await waitFor(() => assert.ok(within(ui.getByRole('region', { name: 'In stock' })).getByText('5')));
  const lines = within(ui.getByRole('region', { name: 'Stock history' })).getAllByRole('listitem').map((li) => li.textContent);
  assert.match(lines[0], /^Adjusted · Damaged.*Note: \[note\] · Jack Lewis · .*−1$/);
  assert.match(lines[1], /^Adjusted · Damaged.*Jo Taylor/);
});

test('a refusal from the server shows in the box, which stays open', async () => {
  const { box, fireEvent } = await openBox({ reply: { status: 400, body: { error: 'Stock cannot go below zero' } } });
  fireEvent.click(box.getByRole('radio', { name: 'Lost or stolen' }));
  fireEvent.click(box.getByRole('button', { name: 'Adjust' }));
  assert.equal((await box.findByRole('alert')).textContent, 'Stock cannot go below zero');
});
