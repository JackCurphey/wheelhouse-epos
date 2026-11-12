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

// A pretend server holding the list, as the routes answer (whole list on each change), with
// their refusals: a taken name is 409, a way already removed is 404. `state.fail` makes the next
// changes fail: 'offline' (no connection), 'lost' (saved, but the answer never arrives) or
// [status, body]; `state.hold` is a promise the next change waits on.
async function render(start = DRAWN, refuse = null, payment = { storeCreditOn: false, accountsOn: false, accountLimitPence: null }) {
  calls = [];
  let nextId = 20;
  const state = { fail: refuse, hold: null, ways: start.map((w) => ({ ...w })) };
  const renumber = () => { state.ways = state.ways.map((w, i) => ({ ...w, position: i })); };
  globalThis.fetch = async (u0, init = {}) => {
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url: String(u0), method, body });
    const reply = (status, b) => ({ status, ok: status < 300, json: async () => b });
    const u = new URL(u0, 'http://localhost');
    if (u.pathname === '/api/auth/me') return reply(200, OWNER);
    const change = u.pathname.startsWith('/api/payment-ways-other') && method !== 'GET';
    if (change && state.hold) await state.hold;
    if (change && state.fail === 'offline') throw new TypeError('Failed to fetch');
    if (change && Array.isArray(state.fail)) return reply(state.fail[0], state.fail[1]);
    let answer = null;
    if (u.pathname === '/api/payment-ways-other' && method === 'POST') {
      if (state.ways.some((w) => w.name.toLowerCase() === body.name.toLowerCase())) return reply(409, { error: 'That way to pay is already on the list', code: 'name_taken' });
      const id = nextId++;
      state.ways.splice(body.position ?? state.ways.length, 0, { id, name: body.name, note: body.note ?? null, position: 0 });
      renumber();
      answer = reply(201, { id, ways: state.ways });
    } else if (u.pathname.startsWith('/api/payment-ways-other/') && method === 'DELETE') {
      const id = Number(u.pathname.split('/').pop());
      if (!state.ways.some((w) => w.id === id)) return reply(404, { error: 'That way to pay has already been removed' });
      state.ways = state.ways.filter((w) => w.id !== id);
      renumber();
      answer = reply(200, { ways: state.ways });
    }
    if (answer && state.fail === 'lost') { state.fail = null; throw new TypeError('Failed to fetch'); }
    if (answer) return answer;
    if (u.pathname === '/api/payment-ways-other') return reply(200, { ways: state.ways });
    if (u.pathname === '/api/payment-settings') return reply(200, payment);
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
  return { ...rtl, ui, state };
}
// Settings' one note at the foot of the page (saved-note.tsx; settings-frame.mjs toastHtml).
const noteArea = (r) => r.ui.container.querySelector('[data-saved-note]');
const NO_INTERNET = 'Not saved — no internet connection. Your change is kept here.';
// The fold's own stand-in line is gone: nothing in the fold says Saved.
const noInFoldSaved = (r) => assert.ok(!r.ui.getAllByRole('status').some((el) => !el.hasAttribute('data-saved-note') && /Saved/.test(el.textContent)));
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

test('the Ways to pay summary starts with Cash and names what is on, in the drawing’s words', async () => {
  const r = await render(DRAWN, null, { storeCreditOn: true, accountsOn: true, accountLimitPence: null });
  const fold = await r.ui.findByRole('button', { name: /^Ways to pay/ });
  await r.waitFor(() => assert.match(fold.textContent, /Cash, store credit and customer accounts$/));
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

test('Jack adds Bank transfer: it goes at the end, the note says Saved · Bank transfer added with Undo, and Undo takes it off', async () => {
  const r = await render();
  await openFold(r, 'Other ways to pay');
  const box = await r.ui.findByRole('textbox', { name: 'New way to pay' });
  r.fireEvent.change(box, { target: { value: 'Bank transfer' } });
  r.fireEvent.click(r.ui.getByRole('button', { name: 'Add' }));
  assert.ok(await r.ui.findByRole('button', { name: 'Remove Bank transfer' }));
  const area = noteArea(r);
  // As drawn: "Saved · Shimano brake pads added to Workshop" (set-till-quick-saved).
  await r.waitFor(() => assert.equal(area.textContent, 'Saved · Bank transfer addedUndo'));
  noInFoldSaved(r);
  assert.equal(box.value, '', 'the box empties for the next one');
  r.fireEvent.click(r.within(area).getByRole('button', { name: 'Undo' }));
  await r.waitFor(() => assert.ok(r.ui.queryByRole('button', { name: 'Remove Bank transfer' }) === null));
  await r.waitFor(() => assert.equal(document.activeElement?.getAttribute('aria-label'), 'New way to pay'));
  // The Undo, once saved, is confirmed: "Saved", with nothing more to undo (as End of day).
  await r.waitFor(() => assert.equal(area.textContent, 'Saved'));
  assert.deepEqual(writes(), ['POST /api/payment-ways-other {"name":"Bank transfer"}', 'DELETE /api/payment-ways-other/20 {}']);
});

test('Jack removes Payment link: it goes, the note says Saved · Payment link removed with Undo, and Undo puts it back where it was with its line', async () => {
  const r = await render();
  await openFold(r, 'Other ways to pay');
  r.fireEvent.click(await r.ui.findByRole('button', { name: 'Remove Payment link' }));
  await r.waitFor(() => assert.ok(r.ui.queryByRole('button', { name: 'Remove Payment link' }) === null));
  // No row after it, so the focus goes to the Add box (as Storage slots' Remove).
  await r.waitFor(() => assert.equal(document.activeElement?.getAttribute('aria-label'), 'New way to pay'));
  const area = noteArea(r);
  await r.waitFor(() => assert.equal(area.textContent, 'Saved · Payment link removedUndo'));
  noInFoldSaved(r);
  r.fireEvent.click(r.within(area).getByRole('button', { name: 'Undo' }));
  assert.ok(await r.ui.findByRole('button', { name: 'Remove Payment link' }));
  await r.waitFor(() => assert.equal(area.textContent, 'Saved'));
  // Undo puts the focus on the restored row's Remove.
  await r.waitFor(() => assert.equal(document.activeElement?.getAttribute('aria-label'), 'Remove Payment link'));
  assert.deepEqual(writes(), [
    'DELETE /api/payment-ways-other/13 {}',
    'POST /api/payment-ways-other {"name":"Payment link","note":"Needs setting up with [payment provider] first","position":2}',
  ]);
});

test('after Remove, the focus goes to the next row’s Remove', async () => {
  const r = await render();
  await openFold(r, 'Other ways to pay');
  r.fireEvent.click(await r.ui.findByRole('button', { name: 'Remove Finance' }));
  await r.waitFor(() => assert.ok(r.ui.queryByRole('button', { name: 'Remove Finance' }) === null));
  await r.waitFor(() => assert.equal(document.activeElement?.getAttribute('aria-label'), 'Remove Cycle to Work'));
});

test('a name already on the list shows the server’s words and keeps what was typed; an empty list reads None', async () => {
  const r = await render([], [409, { error: 'That way to pay is already on the list', code: 'name_taken' }]);
  const fold = await openFold(r, 'Other ways to pay');
  await r.waitFor(() => assert.match(fold.textContent, /None/));
  const box = await r.ui.findByRole('textbox', { name: 'New way to pay' });
  r.fireEvent.change(box, { target: { value: 'Finance' } });
  r.fireEvent.click(r.ui.getByRole('button', { name: 'Add' }));
  const area = noteArea(r);
  await r.waitFor(() => assert.equal(area.textContent, 'That way to pay is already on the list'));
  assert.ok(area.querySelector('svg.lucide-circle-alert') !== null);
  assert.ok(r.within(area).queryByRole('button') === null, 'no Try again after a refusal');
  assert.ok(r.ui.queryByRole('alert') === null, 'no line in the fold');
  assert.equal(box.value, 'Finance');
});

test('with no connection the note says so with Try again and the name stays typed; Try again adds it; a server fault offers Try again too', async () => {
  const r = await render();
  await openFold(r, 'Other ways to pay');
  const box = await r.ui.findByRole('textbox', { name: 'New way to pay' });
  r.state.fail = 'offline';
  r.fireEvent.change(box, { target: { value: 'Bank transfer' } });
  r.fireEvent.click(r.ui.getByRole('button', { name: 'Add' }));
  const area = noteArea(r);
  await r.waitFor(() => assert.equal(area.textContent, `${NO_INTERNET}Try again`));
  assert.equal(box.value, 'Bank transfer', 'kept here');
  r.state.fail = null;
  r.fireEvent.click(r.within(area).getByRole('button', { name: 'Try again' }));
  assert.ok(await r.ui.findByRole('button', { name: 'Remove Bank transfer' }));
  await r.waitFor(() => assert.equal(area.textContent, 'Saved · Bank transfer addedUndo'));
  assert.equal(box.value, '');
  // A fault on the server: the general words, with Try again; the row stays.
  r.state.fail = [500, { error: 'Internal error' }];
  r.fireEvent.click(r.ui.getByRole('button', { name: 'Remove Finance' }));
  await r.waitFor(() => assert.equal(area.textContent, 'Wheelhouse couldn’t save that. Try again in a moment.Try again'));
  assert.ok(r.ui.getByRole('button', { name: 'Remove Finance' }));
});

test('after a refusal the list is read again: a lost-but-saved Add shows its row; a Remove of a way removed elsewhere says so and the row goes', async () => {
  const r = await render();
  await openFold(r, 'Other ways to pay');
  const box = await r.ui.findByRole('textbox', { name: 'New way to pay' });
  r.state.fail = 'lost';
  r.fireEvent.change(box, { target: { value: 'Bank transfer' } });
  r.fireEvent.click(r.ui.getByRole('button', { name: 'Add' }));
  const area = noteArea(r);
  await r.waitFor(() => assert.equal(area.textContent, `${NO_INTERNET}Try again`));
  r.fireEvent.click(r.within(area).getByRole('button', { name: 'Try again' }));
  await r.waitFor(() => assert.equal(area.textContent, 'That way to pay is already on the list'));
  assert.ok(await r.ui.findByRole('button', { name: 'Remove Bank transfer' }), 'the list is read again, so the saved row shows');
  // Removed on another computer: the server's words, and the row goes.
  r.state.ways = r.state.ways.filter((w) => w.name !== 'Finance');
  r.fireEvent.click(r.ui.getByRole('button', { name: 'Remove Finance' }));
  await r.waitFor(() => assert.equal(area.textContent, 'That way to pay has already been removed'));
  await r.waitFor(() => assert.ok(r.ui.queryByRole('button', { name: 'Remove Finance' }) === null));
});

test('a busy server says so in its own words, with Try again', async () => {
  const r = await render();
  await openFold(r, 'Other ways to pay');
  r.state.fail = [503, { error: 'Someone else is changing the other ways to pay just now. Try again in a moment.', code: 'busy' }];
  r.fireEvent.click(await r.ui.findByRole('button', { name: 'Remove Finance' }));
  const area = noteArea(r);
  await r.waitFor(() => assert.equal(area.textContent, 'Someone else is changing the other ways to pay just now. Try again in a moment.Try again'));
});

test('Add pressed from the keyboard leaves the focus in the Add box; a failed Remove puts the focus back on its Remove when it was lost', async () => {
  const r = await render();
  await openFold(r, 'Other ways to pay');
  const box = await r.ui.findByRole('textbox', { name: 'New way to pay' });
  r.fireEvent.change(box, { target: { value: 'Bank transfer' } });
  const addButton = r.ui.getByRole('button', { name: 'Add' });
  addButton.focus();
  r.fireEvent.click(addButton);
  assert.ok(await r.ui.findByRole('button', { name: 'Remove Bank transfer' }));
  await r.waitFor(() => assert.equal(document.activeElement?.getAttribute("aria-label"), "New way to pay"));
  // The Remove is switched off while it saves, and the browser drops the focus.
  let release;
  r.state.hold = new Promise((ok) => { release = ok; });
  r.state.fail = [500, { error: 'Internal error' }];
  const finance = r.ui.getByRole('button', { name: 'Remove Finance' });
  finance.focus();
  r.fireEvent.click(finance);
  // jsdom keeps the focus on a switched-off button, so the page is focused instead, as a browser does.
  document.body.tabIndex = -1;
  document.body.focus();
  assert.ok(document.activeElement === document.body, 'the focus left the fold');
  release();
  await r.waitFor(() => assert.match(noteArea(r).textContent, /^Wheelhouse couldn’t save that/));
  await r.waitFor(() => assert.equal(document.activeElement?.getAttribute('aria-label'), 'Remove Finance'));
});

test('Try again on a failed Add keeps a corrected name in the box', async () => {
  const r = await render();
  await openFold(r, 'Other ways to pay');
  const box = await r.ui.findByRole('textbox', { name: 'New way to pay' });
  r.state.fail = 'offline';
  r.fireEvent.change(box, { target: { value: 'Bank transfr' } });
  r.fireEvent.click(r.ui.getByRole('button', { name: 'Add' }));
  const area = noteArea(r);
  await r.waitFor(() => assert.equal(area.textContent, `${NO_INTERNET}Try again`));
  r.fireEvent.change(box, { target: { value: 'Bank transfer' } });
  r.state.fail = null;
  r.fireEvent.click(r.within(area).getByRole('button', { name: 'Try again' }));
  assert.ok(await r.ui.findByRole('button', { name: 'Remove Bank transfr' }));
  assert.equal(box.value, 'Bank transfer', 'what is in the box now is kept');
});
