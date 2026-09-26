import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

let uninstall;
afterEach(async () => {
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  uninstall?.();
  uninstall = undefined; // Task 3's tests reuse one DOM within a test via `uninstall ??=`
});

const DRAFT = new URL('../../.test-build/screens/book/draft.js', import.meta.url).href;

// Renders a provider with a probe that exposes the context to the test.
async function mount(shopSlug, { storage } = {}) {
  uninstall ??= installDom('http://localhost/book/' + shopSlug);
  if (storage) Object.defineProperty(window, 'sessionStorage', { value: storage, configurable: true });
  const { render, act } = await import('@testing-library/react');
  const { createElement: h } = await import('react');
  const mod = await importFresh(DRAFT);
  let api;
  function Probe() { api = mod.useDraft(); return null; }
  const ui = render(h(mod.DraftProvider, { shopSlug }, h(Probe)));
  return { ui, act, mod, get api() { return api; } };
}

test('an update is saved for this shop and read back by a new provider', async () => {
  const first = await mount('north');
  await first.act(() => first.api.update({ serviceId: 7, description: 'Squeaky brakes' }));
  assert.deepEqual(JSON.parse(window.sessionStorage.getItem('wh-book-draft:north')), { serviceId: 7, description: 'Squeaky brakes' });
  first.ui.unmount();
  const second = await mount('north');
  assert.deepEqual(second.api.draft, { serviceId: 7, description: 'Squeaky brakes' });
});

test('photos are kept in memory and never written to storage', async () => {
  const m = await mount('north');
  const photo = new File([new Uint8Array(10)], 'wheel.jpg', { type: 'image/jpeg' });
  await m.act(() => { m.api.setPhotos([photo]); m.api.update({ description: 'x' }); });
  assert.equal(m.api.photos.length, 1);
  assert.doesNotMatch(window.sessionStorage.getItem('wh-book-draft:north'), /wheel\.jpg|photo/i);
});

test('clear empties the draft and removes the stored copy', async () => {
  const m = await mount('north');
  await m.act(() => m.api.update({ serviceId: 7 }));
  await m.act(() => m.api.clear());
  assert.deepEqual(m.api.draft, {});
  assert.equal(window.sessionStorage.getItem('wh-book-draft:north'), null);
});

test('two shops keep separate drafts', async () => {
  const a = await mount('north');
  await a.act(() => a.api.update({ serviceId: 1 }));
  a.ui.unmount();
  const b = await mount('south');
  assert.deepEqual(b.api.draft, {});
});

test('a storage that throws still lets the draft work in memory', async () => {
  const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() { throw new Error('denied'); } };
  const m = await mount('north', { storage: broken });
  await m.act(() => m.api.update({ serviceId: 3 }));
  assert.deepEqual(m.api.draft, { serviceId: 3 });
});

test('useDraft outside a provider says so', async () => {
  uninstall ??= installDom('http://localhost/book/north');
  const { render } = await import('@testing-library/react');
  const { createElement: h } = await import('react');
  const mod = await importFresh(DRAFT);
  function Probe() { mod.useDraft(); return null; }
  assert.throws(() => render(h(Probe)), /DraftProvider/);
});
