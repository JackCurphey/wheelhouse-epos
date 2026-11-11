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
  const state = { floatPence: 15000, closeEntryMinutes: 30, countFirst: true, offline: false };
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url, method, body });
    const reply = (status, b) => ({ status, ok: status < 300, json: async () => b });
    const u = new URL(url, 'http://localhost');
    if (u.pathname === '/api/auth/me') return reply(200, JACK);
    if (u.pathname === '/api/end-of-day-settings' && method === 'PUT') {
      if (state.offline) throw new TypeError('Failed to fetch');
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
  const uninstall = installDom(`http://localhost/workshop/settings?room=front-desk&fold=${fold}`);
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  const shell = await importFresh(SHELL);
  current = { shell, uninstall, realFetch };
  const ui = rtl.render(createElement(shell.AppShell));
  return { ...rtl, ui, calls, state };
}
const puts = (t) => t.calls.filter((c) => c.method === 'PUT' && c.url === '/api/end-of-day-settings').map((c) => c.body);
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
  t.fireEvent.click(t.within(group).getByRole('radio', { name: '1 hour before' }));
  await t.waitFor(() => assert.match(fold.textContent, /1 hour before closing/));
  const note = await t.ui.findByText('Saved');
  const undo = t.within(note.closest('[role="status"]')).getByRole('button', { name: 'Undo' });
  assert.deepEqual(puts(t), [{ closeEntryMinutes: 60 }]);
  t.fireEvent.click(undo);
  await t.waitFor(() => assert.match(fold.textContent, /30 minutes before closing/));
  assert.deepEqual(puts(t), [{ closeEntryMinutes: 60 }, { closeEntryMinutes: 30 }]);
  t.fireEvent.click(t.within(group).getByRole('radio', { name: 'At closing time' }));
  await t.waitFor(() => assert.match(fold.textContent, /At closing time/));
});

test('Close the day: a save that fails says so, keeps the choice, and Try again saves it', async () => {
  const t = await open('close-the-day');
  const fold = await t.ui.findByRole('button', { name: /^Close the day/ });
  const group = await t.ui.findByRole('radiogroup', { name: 'Show “Close the day” in the till bar' });
  await t.waitFor(() => assert.match(fold.textContent, /30 minutes before closing/));
  t.state.offline = true;
  t.fireEvent.click(t.within(group).getByRole('radio', { name: 'At closing time' }));
  const failed = await t.ui.findByText(FAILED);
  assert.deepEqual(chosen(group), ['At closing time (chosen)', '30 minutes before', '1 hour before'], 'the change is kept here');
  assert.ok(t.ui.queryByText('Saved') === null);
  t.state.offline = false;
  t.fireEvent.click(t.within(failed.closest('[role="alert"]')).getByRole('button', { name: 'Try again' }));
  await t.waitFor(() => assert.match(fold.textContent, /At closing time/));
  assert.ok(await t.ui.findByText('Saved'));
  assert.ok(t.ui.queryByText(FAILED) === null);
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
  const note = await t.ui.findByText('Saved');
  t.fireEvent.click(t.within(note.closest('[role="status"]')).getByRole('button', { name: 'Undo' }));
  await t.waitFor(() => assert.equal(t.ui.getByRole('switch', { name: 'Count first' }).getAttribute('aria-checked'), 'true'));
  await t.waitFor(() => assert.match(fold.textContent, /Count first/));
  assert.deepEqual(puts(t), [{ countFirst: false }, { countFirst: true }]);
});
