// Your settings › Accessibility, the screens (openspec/changes/your-settings-accessibility;
// drawn as your-settings in app-map.mjs; workshop day 57): the pop-up from your
// name, Reduce motion saved at once to your login, and the page following it.
// Larger text waits for Jack (it put the diary's drops off their marks).
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const JO = { id: 2, name: 'Jo Taylor', email: 'jo@example.com', isOwner: false, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const OFF = { statusSymbols: false, reduceMotion: false, noAutoClose: false, largerText: false, foldedSidebar: false };

const realFetch = globalThis.fetch;
let uninstall;
let shell;
let calls;
let saved;
let failPut;
afterEach(async () => {
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  shell?.queryClient.clear();
  uninstall?.();
  globalThis.fetch = realFetch;
});

async function open(path, { accessibility = OFF, phone = false } = {}) {
  calls = [];
  saved = { ...accessibility };
  failPut = false;
  globalThis.fetch = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url, method, body });
    const reply = (status, b) => ({ status, ok: status < 300, json: async () => b });
    const u = new URL(url, 'http://localhost');
    if (u.pathname === '/api/auth/me') return reply(200, JO);
    if (u.pathname === '/api/your-settings' && method === 'PUT') {
      if (failPut) return reply(500, { error: 'Internal error' });
      saved = { ...saved, ...body.accessibility };
      return reply(200, { accessibility: saved });
    }
    if (u.pathname === '/api/your-settings') return reply(200, { accessibility: saved });
    if (u.pathname.startsWith('/api/')) return reply(200, []);
    return reply(404, { error: 'Not found' });
  };
  uninstall = installDom(`http://localhost${path}`);
  if (phone) window.matchMedia = (q) => ({ matches: q.includes('max-width'), media: q, addEventListener() {}, removeEventListener() {} });
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { if (this.open) { this.open = false; this.dispatchEvent(new window.Event('close')); } };
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  shell = await importFresh(SHELL);
  const ui = rtl.render(createElement(shell.AppShell));
  return { ...rtl, ui };
}
const html = () => document.documentElement.classList;

test('Your settings, as drawn: whose they are, the switch built, off, and changes apply straight away', async () => {
  const { ui, within } = await open('/workshop/your-settings');
  const dialog = within(await ui.findByRole('dialog', { name: 'Your settings' }));
  assert.ok(dialog.queryByText('Jo Taylor · Staff · just for you, they don’t change what others see') !== null);
  assert.ok(dialog.queryByText('Accessibility') !== null);
  assert.equal((await dialog.findByRole('switch', { name: 'Reduce motion' })).getAttribute('aria-checked'), 'false');
  assert.ok(dialog.queryByText('Turns off animations, such as the arrow that shows where a customer wants to move a job. Also switches on automatically when your computer is set to reduce motion.') !== null);
  for (const name of ['Show status symbols', 'Larger text']) assert.ok(dialog.queryByRole('switch', { name }) === null, `${name} isn’t built yet`);
  assert.ok(dialog.queryByText('Changes apply straight away.') !== null);
});

test('Reduce motion saves at once and the page follows; off again, it goes', async () => {
  const { ui, fireEvent, waitFor } = await open('/workshop/your-settings');
  const motion = await ui.findByRole('switch', { name: 'Reduce motion' });
  await waitFor(() => assert.equal(motion.disabled, false));
  fireEvent.click(motion);
  await waitFor(() => assert.equal(motion.getAttribute('aria-checked'), 'true'));
  assert.deepEqual(calls.filter((c) => c.method === 'PUT').map((c) => c.body), [{ accessibility: { reduceMotion: true } }]);
  assert.ok(html().contains('wh-reduce-motion'));
  fireEvent.click(motion);
  await waitFor(() => assert.ok(!html().contains('wh-reduce-motion')));
});

test('saved switches follow you to every page', async () => {
  const { ui, waitFor } = await open('/workshop/today', { accessibility: { ...OFF, reduceMotion: true } });
  await ui.findByRole('heading', { level: 1, name: 'Today' });
  await waitFor(() => assert.ok(html().contains('wh-reduce-motion')));
});

test('a switch that can’t be saved says so and stays as it was', async () => {
  const { ui, fireEvent, waitFor } = await open('/workshop/your-settings');
  failPut = true;
  const motion = await ui.findByRole('switch', { name: 'Reduce motion' });
  await waitFor(() => assert.equal(motion.disabled, false));
  fireEvent.click(motion);
  assert.ok((await ui.findByText('Wheelhouse couldn’t save that. Try again in a moment.')) !== null);
  assert.equal(motion.getAttribute('aria-checked'), 'false');
  assert.ok(!html().contains('wh-reduce-motion'));
});

test('your name opens it, and Close goes back to the page you were on', async () => {
  const { ui, fireEvent, waitFor } = await open('/workshop/today');
  await ui.findByRole('heading', { level: 1, name: 'Today' });
  fireEvent.click(ui.getAllByRole('link', { name: 'Your settings — Jo Taylor, Staff' })[0]);
  await ui.findByRole('dialog', { name: 'Your settings' });
  fireEvent.click(ui.getByRole('button', { name: 'Close' }));
  await waitFor(() => assert.equal(window.location.pathname, '/workshop/today'));
});

test('on a phone it says “just for you”', async () => {
  const { ui } = await open('/workshop/your-settings', { phone: true });
  assert.ok((await ui.findByText('Jo Taylor · Staff · just for you')) !== null);
});
