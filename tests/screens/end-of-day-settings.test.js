// Settings › Front desk › End of day: the Close the day fold (set-eod-close)
// and the Counting the cash fold (settings-frame.mjs eodFolds), each saved
// when chosen with "Saved" and Undo, and a failed save kept with Try again
// (set-save-failed; owner setup decision 17). Owner-setup-till-payments-eod
// design 3 and section 5 point 1.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const JACK = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street', employee: null };
const FAILED = 'Not saved — no internet connection. Your change is kept here.';

let current;
afterEach(async () => {
  if (!current) return;
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  current.shell.queryClient.clear();
  current.uninstall();
  globalThis.fetch = current.realFetch;
  current = undefined;
});

async function open(fold) {
  const calls = [];
  // `hold`: a promise the next save waits on; `refuse`: the server's words for a 400; `down`: a 500.
  const state = { floatPence: 15000, closeEntryMinutes: 30, countFirst: true, offline: false, hold: null, refuse: null, down: false };
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url, method, body });
    const reply = (status, b) => ({ status, ok: status < 300, json: async () => b });
    const u = new URL(url, 'http://localhost');
    if (u.pathname === '/api/auth/me') return reply(200, JACK);
    if (u.pathname === '/api/end-of-day-settings' && method === 'PUT') {
      if (state.hold) await state.hold;
      if (state.offline) throw new TypeError('Failed to fetch');
      if (state.refuse) return reply(400, { error: state.refuse });
      if (state.down) return reply(500, { error: 'Internal error' });
      Object.assign(state, body);
    }
    if (u.pathname === '/api/end-of-day-settings') return reply(200, { floatPence: state.floatPence, closeEntryMinutes: state.closeEntryMinutes, countFirst: state.countFirst });
    if (u.pathname === '/api/till-checkin') return reply(200, { serving: { id: 11, name: 'Jack Lewis' }, checkedInToday: [] });
    if (u.pathname === '/api/your-settings') return reply(200, { accessibility: {} });
    if (u.pathname === '/api/workshop-services') return reply(200, []);
    if (u.pathname === '/api/workshop-settings') return reply(200, { openingHours: [] });
    if (u.pathname === '/api/shop-details') return reply(200, { name: 'North Street Cycles' });
    if (u.pathname === '/api/workshop-jobs') return reply(200, []);
    return reply(404, { error: 'Not found' });
  };
  const uninstall = installDom(`http://localhost/workshop/settings?room=front-desk${fold ? `&fold=${fold}` : ''}`);
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  const shell = await importFresh(SHELL);
  current = { shell, uninstall, realFetch };
  const ui = rtl.render(createElement(shell.AppShell));
  return { ...rtl, ui, calls, state };
}
const puts = (t) => t.calls.filter((c) => c.method === 'PUT' && c.url === '/api/end-of-day-settings').map((c) => c.body);
// Settings' one "Saved" note (settings-frame.mjs toastHtml), shared by every fold.
const noteArea = (t) => t.ui.container.querySelector('[data-saved-note]');
const chosen = (group) => [...group.querySelectorAll('[role="radio"]')].map((r) => `${r.textContent}${r.getAttribute('aria-checked') === 'true' ? ' (chosen)' : ''}`);

test('Close the day: the three choices, the note, Change opening hours, and 30 minutes before to start', async () => {
  const t = await open('close-the-day');
  const fold = await t.ui.findByRole('button', { name: /^Close the day/ });
  await t.waitFor(() => assert.match(fold.textContent, /30 minutes before closing/));
  assert.equal(fold.getAttribute('aria-expanded'), 'true');
  const group = await t.ui.findByRole('radiogroup', { name: 'Show “Close the day” in the till bar' });
  assert.deepEqual(chosen(group), ['At closing time', '30 minutes before (chosen)', '1 hour before']);
  assert.ok(t.ui.getByText('Owners and managers see it on every till from then on. Closing time comes from the opening hours.'));
  const hours = t.ui.getByRole('link', { name: 'Change opening hours' });
  assert.match(hours.getAttribute('href'), /room=office&fold=opening-hours$/);
});

test('Close the day: choosing saves at once, with Saved and Undo, and the summary names it', async () => {
  const t = await open('close-the-day');
  const fold = await t.ui.findByRole('button', { name: /^Close the day/ });
  const group = await t.ui.findByRole('radiogroup', { name: 'Show “Close the day” in the till bar' });
  await t.waitFor(() => assert.match(fold.textContent, /30 minutes before closing/));
  // The page's one note area is there before anything is saved, empty, so a
  // screen reader announces the words swapped into it; it isn't in a fold.
  const area = noteArea(t);
  assert.ok(area !== null, 'the note area is always on the page');
  assert.equal(area.getAttribute('role'), 'status');
  assert.equal(area.textContent, '');
  assert.ok(area.closest('section') === null, 'the note floats over the page, not inside the fold');
  const space = () => t.ui.container.querySelector('[data-saved-note-space]');
  assert.ok(space() === null, 'no space under the page without a note');
  t.fireEvent.click(t.within(group).getByRole('radio', { name: '1 hour before' }));
  await t.waitFor(() => assert.match(fold.textContent, /1 hour before closing/));
  await t.waitFor(() => assert.match(area.textContent, /^Saved/));
  assert.ok(noteArea(t) === area, 'the same area, its words swapped in');
  assert.ok(area.querySelector('svg') !== null, 'a tick before the words');
  // While the note shows, space under the page lets the last fold scroll clear of it.
  assert.ok(space() !== null, 'space under the page while the note shows');
  assert.equal(space().getAttribute('aria-hidden'), 'true');
  assert.ok(!area.contains(space()), 'the space isn’t read out with the note');
  const undo = t.within(area).getByRole('button', { name: 'Undo' });
  assert.deepEqual(puts(t), [{ closeEntryMinutes: 60 }]);
  t.fireEvent.click(undo);
  await t.waitFor(() => assert.match(fold.textContent, /30 minutes before closing/));
  assert.deepEqual(puts(t), [{ closeEntryMinutes: 60 }, { closeEntryMinutes: 30 }]);
  // The Undo, once saved, is confirmed: "Saved", with nothing more to undo.
  await t.waitFor(() => assert.ok(t.within(area).queryByRole('button', { name: 'Undo' }) === null));
  assert.equal(area.textContent, 'Saved');
  t.fireEvent.click(t.within(group).getByRole('radio', { name: 'At closing time' }));
  await t.waitFor(() => assert.match(fold.textContent, /At closing time/));
});

test('Close the day: a save that fails says so, keeps the choice, and Try again saves it', async () => {
  const t = await open('close-the-day');
  const fold = await t.ui.findByRole('button', { name: /^Close the day/ });
  const group = await t.ui.findByRole('radiogroup', { name: 'Show “Close the day” in the till bar' });
  await t.waitFor(() => assert.match(fold.textContent, /30 minutes before closing/));
  const area = noteArea(t);
  t.state.offline = true;
  t.fireEvent.click(t.within(group).getByRole('radio', { name: 'At closing time' }));
  await t.waitFor(() => assert.match(area.textContent, new RegExp(`^${FAILED}`)));
  assert.ok(area.querySelector('svg.lucide-circle-alert') !== null, 'the circle with “!” before the words, as drawn (icon alert)');
  assert.deepEqual(chosen(group), ['At closing time (chosen)', '30 minutes before', '1 hour before'], 'the change is kept here');
  assert.ok(t.within(area).queryByRole('button', { name: 'Undo' }) === null);
  t.state.offline = false;
  t.fireEvent.click(t.within(area).getByRole('button', { name: 'Try again' }));
  await t.waitFor(() => assert.match(fold.textContent, /At closing time/));
  await t.waitFor(() => assert.match(area.textContent, /^Saved/));
  assert.ok(noteArea(t) === area);
  assert.equal(t.state.closeEntryMinutes, 0);
});

test('Counting the cash: Count first on to start; off saves, with Saved and Undo, and the summary says so', async () => {
  const t = await open('counting-the-cash');
  const fold = await t.ui.findByRole('button', { name: /^Counting the cash/ });
  await t.waitFor(() => assert.match(fold.textContent, /Count first/));
  const sw = await t.ui.findByRole('switch', { name: 'Count first' });
  assert.equal(sw.getAttribute('aria-checked'), 'true');
  assert.ok(t.ui.getByText('Count the cash before seeing what the till expects.'));
  t.fireEvent.click(sw);
  await t.waitFor(() => assert.match(fold.textContent, /Show the expected amount/));
  assert.equal(t.ui.getByRole('switch', { name: 'Count first' }).getAttribute('aria-checked'), 'false');
  assert.deepEqual(puts(t), [{ countFirst: false }]);
  const area = noteArea(t);
  await t.waitFor(() => assert.match(area.textContent, /^Saved/));
  t.fireEvent.click(t.within(area).getByRole('button', { name: 'Undo' }));
  await t.waitFor(() => assert.equal(t.ui.getByRole('switch', { name: 'Count first' }).getAttribute('aria-checked'), 'true'));
  await t.waitFor(() => assert.match(fold.textContent, /Count first/));
  assert.deepEqual(puts(t), [{ countFirst: false }, { countFirst: true }]);
  await t.waitFor(() => assert.equal(area.textContent, 'Saved'));
});

const pill = (t, name) => t.within(t.ui.getByRole('radiogroup', { name: 'Show “Close the day” in the till bar' })).getByRole('radio', { name });
async function openBoth(t) {
  const count = await t.ui.findByRole('button', { name: /^Counting the cash/ });
  if (count.getAttribute('aria-expanded') !== 'true') t.fireEvent.click(count);
  return t.ui.findByRole('switch', { name: 'Count first' });
}

test('a failed choice isn’t left stuck: a newer note shows what the server holds, and tapping the kept choice saves it again', async () => {
  const t = await open('close-the-day');
  const fold = await t.ui.findByRole('button', { name: /^Close the day/ });
  await t.waitFor(() => assert.match(fold.textContent, /30 minutes before closing/));
  const sw = await openBoth(t);
  const area = noteArea(t);
  // Close the day fails, then Count first saves: the fold goes back to what the server holds.
  t.state.offline = true;
  t.fireEvent.click(pill(t, 'At closing time'));
  await t.waitFor(() => assert.match(area.textContent, new RegExp(`^${FAILED}`)));
  assert.equal(pill(t, 'At closing time').getAttribute('aria-checked'), 'true', 'kept while its failed note shows');
  t.state.offline = false;
  t.fireEvent.click(sw);
  await t.waitFor(() => assert.match(area.textContent, /^Saved/));
  assert.equal(pill(t, '30 minutes before').getAttribute('aria-checked'), 'true', 'the server’s choice once the failed note is gone');
  assert.equal(pill(t, 'At closing time').getAttribute('aria-checked'), 'false');
  // Fails again; tapping the same, kept choice saves it again.
  t.state.offline = true;
  t.fireEvent.click(pill(t, 'At closing time'));
  await t.waitFor(() => assert.match(area.textContent, new RegExp(`^${FAILED}`)));
  t.state.offline = false;
  t.fireEvent.click(pill(t, 'At closing time'));
  await t.waitFor(() => assert.equal(t.state.closeEntryMinutes, 0));
  await t.waitFor(() => assert.match(fold.textContent, /At closing time/));
  assert.deepEqual(puts(t).filter((b) => 'closeEntryMinutes' in b), [{ closeEntryMinutes: 0 }, { closeEntryMinutes: 0 }, { closeEntryMinutes: 0 }]);
});

test('a save in progress leaves the note in place with its button off, and focus goes back to the setting', async () => {
  const t = await open('close-the-day');
  const fold = await t.ui.findByRole('button', { name: /^Close the day/ });
  await t.waitFor(() => assert.match(fold.textContent, /30 minutes before closing/));
  const area = noteArea(t);
  t.fireEvent.click(pill(t, '1 hour before'));
  await t.waitFor(() => assert.match(area.textContent, /^Saved/));
  let release;
  t.state.hold = new Promise((r) => { release = r; });
  const undo = t.within(area).getByRole('button', { name: 'Undo' });
  undo.focus();
  t.fireEvent.click(undo);
  await t.waitFor(() => assert.equal(t.within(area).getByRole('button', { name: 'Undo' }).disabled, true));
  assert.match(area.textContent, /^Saved/, 'the note stays while saving');
  assert.ok(document.activeElement === pill(t, '30 minutes before'), `focus back on the setting, not ${document.activeElement?.outerHTML.slice(0, 80)}`);
  t.state.hold = null;
  release();
  await t.waitFor(() => assert.ok(t.within(area).queryByRole('button', { name: 'Undo' }) === null));
  assert.ok(document.activeElement === pill(t, '30 minutes before'));
});

test('the note doesn’t follow you to another room', async () => {
  const t = await open('close-the-day');
  const fold = await t.ui.findByRole('button', { name: /^Close the day/ });
  await t.waitFor(() => assert.match(fold.textContent, /30 minutes before closing/));
  const area = noteArea(t);
  t.fireEvent.click(pill(t, '1 hour before'));
  await t.waitFor(() => assert.match(area.textContent, /^Saved/));
  t.fireEvent.click(t.ui.getByRole('link', { name: 'Change opening hours' }));
  await t.ui.findByRole('heading', { level: 2, name: 'Office' });
  await t.waitFor(() => assert.equal(noteArea(t).textContent, ''));
  assert.ok(t.ui.queryByRole('button', { name: 'Undo' }) === null);
});

test('after a refusal the server explains, its words show with no Try again; a server fault offers Try again', async () => {
  const t = await open('close-the-day');
  const fold = await t.ui.findByRole('button', { name: /^Close the day/ });
  await t.waitFor(() => assert.match(fold.textContent, /30 minutes before closing/));
  const area = noteArea(t);
  t.state.refuse = 'Choose at closing time, 30 minutes before or 1 hour before';
  t.fireEvent.click(pill(t, '1 hour before'));
  await t.waitFor(() => assert.match(area.textContent, /^Choose at closing time/));
  assert.ok(t.within(area).queryByRole('button') === null, 'no Try again after a 400');
  t.state.refuse = null;
  t.state.down = true;
  t.fireEvent.click(pill(t, 'At closing time'));
  await t.waitFor(() => assert.match(area.textContent, /^Wheelhouse couldn’t save that/));
  assert.ok(t.within(area).getByRole('button', { name: 'Try again' }));
});

test('Float: Saved with Undo, a failed save kept with Try again, and no inline note', async () => {
  const t = await open('float');
  const fold = await t.ui.findByRole('button', { name: /^Float/ });
  await t.waitFor(() => assert.match(fold.textContent, /£150\.00/));
  const box = await t.ui.findByLabelText('Leave this much in the drawer each night');
  const area = noteArea(t);
  t.fireEvent.change(box, { target: { value: '200.00' } });
  t.fireEvent.blur(box);
  await t.waitFor(() => assert.match(area.textContent, /^Saved/));
  assert.ok(t.ui.queryByText('Saved.') === null, 'no inline Saved line');
  await t.waitFor(() => assert.match(fold.textContent, /£200\.00/));
  t.fireEvent.click(t.within(area).getByRole('button', { name: 'Undo' }));
  await t.waitFor(() => assert.match(fold.textContent, /£150\.00/));
  assert.deepEqual(puts(t), [{ floatPence: 20000 }, { floatPence: 15000 }]);
  t.state.offline = true;
  t.fireEvent.change(box, { target: { value: '175.00' } });
  t.fireEvent.blur(box);
  await t.waitFor(() => assert.match(area.textContent, new RegExp(`^${FAILED}`)));
  assert.ok(t.ui.queryByRole('alert') === null, 'no inline red alert');
  assert.equal(box.value, '175.00', 'the change is kept here');
  t.state.offline = false;
  t.fireEvent.click(t.within(area).getByRole('button', { name: 'Try again' }));
  await t.waitFor(() => assert.match(fold.textContent, /£175\.00/));
  assert.equal(t.state.floatPence, 17500);
});
