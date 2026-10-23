// Folded sidebar (openspec/changes/folded-sidebar; app map review 4, 5, 7, 9;
// drawn as foldedRail and the your-settings row in app-map.mjs): the Till is
// always folded to the icon rail; with the person's switch on, every page is.
// The rail's Unfold opens the full sidebar over the page, Fold or Escape
// closes it. jsdom applies no Tailwind, so which layout shows at which width
// is checked in a browser (tests/browser/folded-sidebar.spec.ts).
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;
const OWNER = { id: 1, name: 'Jack Lewis', email: 'jack@example.com', isOwner: true, shopName: 'North Street Cycles', shopSlug: 'north-street' };
const OFF = { statusSymbols: false, reduceMotion: false, noAutoClose: false, largerText: false, foldedSidebar: false };

const realFetch = globalThis.fetch;
let uninstall;
let shell;
afterEach(async () => {
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  shell?.queryClient.clear();
  uninstall?.();
  globalThis.fetch = realFetch;
});

async function open(path, { foldedSidebar = false, media = null } = {}) {
  let saved = { ...OFF, foldedSidebar };
  globalThis.fetch = async (url, init = {}) => {
    const reply = (status, b) => ({ status, ok: status < 300, json: async () => b });
    const u = new URL(url, 'http://localhost');
    if (u.pathname === '/api/auth/me') return reply(200, OWNER);
    if (u.pathname === '/api/your-settings' && init.method === 'PUT') { saved = { ...saved, ...JSON.parse(init.body).accessibility }; return reply(200, { accessibility: saved }); }
    if (u.pathname === '/api/your-settings') return reply(200, { accessibility: saved });
    if (u.pathname.startsWith('/api/')) return reply(200, []);
    return reply(404, { error: 'Not found' });
  };
  uninstall = installDom(`http://localhost${path}`);
  if (media) window.matchMedia = (q) => ({ matches: media(q), media: q, addEventListener() {}, removeEventListener() {} });
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { if (this.open) { this.open = false; this.dispatchEvent(new window.Event('close')); } };
  const rtl = await import('@testing-library/react');
  const { createElement } = await import('react');
  shell = await importFresh(SHELL);
  const ui = rtl.render(createElement(shell.AppShell));
  return { ...rtl, ui };
}
// The full sidebar that sits over the page, as opposed to the one always shown.
const over = (ui) => ui.getAllByRole('navigation', { name: 'Main' }).filter((n) => n.hasAttribute('data-unfolded'));
const always = (ui) => ui.getAllByRole('navigation', { name: 'Main' }).filter((n) => !n.hasAttribute('data-unfolded'));

test('the Till is folded to the rail; Unfold opens the full sidebar over the page, Fold and Escape close it', async () => {
  const { ui, fireEvent, waitFor, within } = await open('/workshop/till');
  const rail = await ui.findByRole('navigation', { name: 'Main, folded' });
  assert.equal(always(ui).length, 0, 'no full sidebar beside the till');
  const [panel] = over(ui);
  assert.equal(panel.getAttribute('data-unfolded'), 'false');
  assert.ok(within(panel).getByRole('link', { name: 'Diary' }), 'the rooms are in it');
  const unfold = within(rail).getByRole('button', { name: 'Unfold the menu' });
  assert.equal(unfold.getAttribute('aria-expanded'), 'false');
  fireEvent.click(unfold);
  await waitFor(() => assert.equal(panel.getAttribute('data-unfolded'), 'true'));
  assert.equal(unfold.getAttribute('aria-expanded'), 'true');
  assert.ok(document.activeElement === within(panel).getByRole('button', { name: 'Fold the menu' }), 'focus goes into it');
  fireEvent.click(within(panel).getByRole('button', { name: 'Fold the menu' }));
  await waitFor(() => assert.equal(panel.getAttribute('data-unfolded'), 'false'));
  assert.ok(document.activeElement === unfold, 'and back to Unfold');
  fireEvent.click(unfold);
  fireEvent.keyDown(panel, { key: 'Escape' });
  await waitFor(() => assert.equal(panel.getAttribute('data-unfolded'), 'false'));
});

test('with Folded sidebar off, the diary keeps the full sidebar', async () => {
  const { ui, waitFor } = await open('/workshop/diary');
  await waitFor(() => assert.equal(always(ui).length, 1));
});

test('with Folded sidebar on, the diary folds to the rail too', async () => {
  const { ui, waitFor } = await open('/workshop/diary', { foldedSidebar: true });
  await waitFor(() => assert.equal(always(ui).length, 0));
  assert.ok(ui.getByRole('navigation', { name: 'Main, folded' }));
});

test('Your settings has Folded sidebar, as drawn for a computer, and it saves at once', async () => {
  const { ui, fireEvent, waitFor } = await open('/workshop/your-settings');
  const folded = await ui.findByRole('switch', { name: 'Folded sidebar' });
  assert.ok(ui.queryByText('Folds the sidebar down to icons on every page, for more room. Rest the pointer on it, or press Unfold, to open it. The Till always has it folded.') !== null);
  await waitFor(() => assert.equal(folded.disabled, false));
  fireEvent.click(folded);
  await waitFor(() => assert.equal(folded.getAttribute('aria-checked'), 'true'));
  await waitFor(() => assert.equal(always(ui).length, 0), 'the page folds straight away');
});

test('on a tablet its hint says the rail is always there; on a phone it isn’t offered', async () => {
  const tablet = await open('/workshop/your-settings', { media: (q) => q.includes('max-width: 1023px') });
  assert.ok((await tablet.ui.findByText('On a tablet the sidebar is always the icon rail; tap Unfold to open it.')) !== null);
  tablet.cleanup();
  uninstall();
  const phone = await open('/workshop/your-settings', { media: (q) => q.includes('max-width') });
  await phone.ui.findByRole('switch', { name: 'Reduce motion' });
  assert.ok(phone.ui.queryByRole('switch', { name: 'Folded sidebar' }) === null);
});
