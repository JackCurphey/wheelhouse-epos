// Ways to pay's Cash card and the Other ways to pay fold, the staff screens
// (openspec/changes/owner-setup-till-payments-eod, design 4, task 5.3; set-pay-ways and
// set-pay-other in setup.mjs; Jack's answer 3 of 11 Nov,
// docs/decisions/2026-11-11-settings-rest-answers.md). Example data from the drawings:
// Jack Lewis, Finance, Cycle to Work, Payment link and their lines; the spec's "Bank transfer".
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const OWNER = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const DRAWN = [
  { id: 11, name: 'Finance', note: 'Recorded at the till; the finance company pays the shop', position: 0 },
  { id: 12, name: 'Cycle to Work', note: 'Recorded at the till against a Cycle to Work order', position: 1 },
  { id: 13, name: 'Payment link', note: 'Needs setting up with [payment provider] first', position: 2 },
];

const realFetch = globalThis.fetch;
let uninstall;
let shell;
let calls;
afterEach(async () => {
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  shell?.queryClient.clear();
  uninstall?.();
  globalThis.fetch = realFetch;
});

// A pretend server holding the list, as the routes answer (whole list on each change).
async function render(start = DRAWN, refuse = null) {
  calls = [];
  let ways = start.map((w) => ({ ...w }));
  let nextId = 20;
  globalThis.fetch = async (u0, init = {}) => {
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url: String(u0), method, body });
    const reply = (status, b) => ({ status, ok: status < 300, json: async () => b });
    const u = new URL(u0, 'http://localhost');
    if (u.pathname === '/api/auth/me') return reply(200, OWNER);
    if (u.pathname === '/api/payment-ways-other' && method === 'POST') {
      if (refuse) return reply(refuse[0], refuse[1]);
      const id = nextId++;
      const at = body.position ?? ways.length;
      ways.splice(at, 0, { id, name: body.name, note: body.note ?? null, position: 0 });
      ways = ways.map((w, i) => ({ ...w, position: i }));
      return reply(201, { id, ways });
    }
    if (u.pathname.startsWith('/api/payment-ways-other/') && method === 'DELETE') {
      const id = Number(u.pathname.split('/').pop());
      ways = ways.filter((w) => w.id !== id).map((w, i) => ({ ...w, position: i }));
      return reply(200, { ways });
    }
    if (u.pathname === '/api/payment-ways-other') return reply(200, { ways });
    if (u.pathname === '/api/payment-settings') return reply(200, { storeCreditOn: false, accountsOn: false, accountLimitPence: null });
    if (u.pathname === '/api/shop-details') return reply(200, { name: 'North Street Cycles' });
    if (u.pathname === '/api/workshop-settings') return reply(200, { openingHours: [] });
    if (u.pathname.startsWith('/api/')) return reply(200, []);
    return reply(404, { error: 'Not found' });
  };
  uninstall = installDom('http://localhost/workshop/settings?room=front-desk');
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { if (this.open) { this.open = false; this.dispatchEvent(new window.Event('close')); } };
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  shell = await importFresh(SHELL);
  const ui = rtl.render(createElement(shell.AppShell));
  return { ...rtl, ui };
}
const writes = () => calls.filter((c) => c.method !== 'GET').map((c) => `${c.method} ${new URL(c.url, 'http://localhost').pathname} ${JSON.stringify(c.body ?? null)}`);
async function openFold(r, name) {
  const fold = await r.ui.findByRole('button', { name: new RegExp(`^${name}`) });
  if (fold.getAttribute('aria-expanded') !== 'true') r.fireEvent.click(fold);
  return fold;
}

test('Ways to pay shows Cash first, Always on, with no switch, and no Card, Gift cards or Deposits switches', async () => {
  const r = await render();
  await openFold(r, 'Ways to pay');
  const cash = await r.ui.findByText('Cash', { selector: 'span' });
  const card = cash.closest('div');
  assert.ok(card.textContent.includes('Always on'));
  assert.ok(card.querySelector('[role="switch"]') === null, 'nothing to switch');
  // First: before Store credit's card.
  const storeCredit = r.ui.getByRole('switch', { name: 'Store credit' });
  assert.ok(cash.compareDocumentPosition(storeCredit) & 4, 'Cash comes before Store credit');
  for (const name of ['Cash', 'Card', 'Gift cards', 'Deposits']) assert.ok(r.ui.queryByRole('switch', { name }) === null, `no ${name} switch`);
});

test('the Other ways to pay fold shows the rows with their lines, Remove, the Add box, the note and the summary', async () => {
  const r = await render();
  const fold = await openFold(r, 'Other ways to pay');
  await r.waitFor(() => assert.match(fold.textContent, /Finance, Cycle to Work, Payment link/));
  for (const w of DRAWN) {
    const row = (await r.ui.findByRole('button', { name: `Remove ${w.name}` })).parentElement;
    assert.equal(row.textContent, `${w.name}${w.note}`, 'the name, its line, and Remove');
  }
  const box = r.ui.getByRole('textbox', { name: 'New way to pay' });
  assert.equal(box.getAttribute('placeholder'), 'Add another way to pay');
  assert.ok(r.ui.getByRole('button', { name: 'Add' }));
  assert.ok(r.ui.getByText('These sit under “Other” at the bottom of Take payment, one tap away.'));
  // The fold sits after Ways to pay and before Customer groups (settings-frame.mjs payFolds).
  const titles = r.ui.getAllByRole('button', { name: /^(Ways to pay|Other ways to pay|Customer groups)/ }).map((b) => b.textContent);
  assert.deepEqual(titles.map((t) => t.match(/^(Ways to pay|Other ways to pay|Customer groups)/)[1]), ['Ways to pay', 'Other ways to pay', 'Customer groups']);
});

test('Jack adds Bank transfer: it goes at the end, Saved shows with Undo, and Undo takes it off', async () => {
  const r = await render();
  await openFold(r, 'Other ways to pay');
  const box = await r.ui.findByRole('textbox', { name: 'New way to pay' });
  r.fireEvent.change(box, { target: { value: 'Bank transfer' } });
  r.fireEvent.click(r.ui.getByRole('button', { name: 'Add' }));
  assert.ok(await r.ui.findByRole('button', { name: 'Remove Bank transfer' }));
  assert.ok(r.ui.getAllByRole('status').some((el) => /^Saved\.\s*Undo$/.test(el.textContent)), 'Saved · Undo');
  assert.equal(box.value, '', 'the box empties for the next one');
  r.fireEvent.click(r.ui.getByRole('button', { name: 'Undo' }));
  await r.waitFor(() => assert.ok(r.ui.queryByRole('button', { name: 'Remove Bank transfer' }) === null));
  assert.deepEqual(writes(), ['POST /api/payment-ways-other {"name":"Bank transfer"}', 'DELETE /api/payment-ways-other/20 {}']);
});

test('Jack removes Payment link: it goes, Saved shows with Undo, and Undo puts it back where it was with its line', async () => {
  const r = await render();
  await openFold(r, 'Other ways to pay');
  r.fireEvent.click(await r.ui.findByRole('button', { name: 'Remove Payment link' }));
  await r.waitFor(() => assert.ok(r.ui.queryByRole('button', { name: 'Remove Payment link' }) === null));
  assert.ok(r.ui.getAllByRole('status').some((el) => /^Saved\.\s*Undo$/.test(el.textContent)), 'Saved · Undo');
  r.fireEvent.click(r.ui.getByRole('button', { name: 'Undo' }));
  assert.ok(await r.ui.findByRole('button', { name: 'Remove Payment link' }));
  assert.deepEqual(writes(), [
    'DELETE /api/payment-ways-other/13 {}',
    'POST /api/payment-ways-other {"name":"Payment link","note":"Needs setting up with [payment provider] first","position":2}',
  ]);
});

test('a name already on the list shows the server’s words and keeps what was typed; an empty list reads None', async () => {
  const r = await render([], [409, { error: 'That way to pay is already on the list', code: 'name_taken' }]);
  const fold = await openFold(r, 'Other ways to pay');
  await r.waitFor(() => assert.match(fold.textContent, /None/));
  const box = await r.ui.findByRole('textbox', { name: 'New way to pay' });
  r.fireEvent.change(box, { target: { value: 'Finance' } });
  r.fireEvent.click(r.ui.getByRole('button', { name: 'Add' }));
  assert.ok(await r.ui.findByText('That way to pay is already on the list'));
  assert.equal(box.value, 'Finance');
});
