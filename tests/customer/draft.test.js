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
  await first.act(() => first.api.update({ serviceIds: [7], description: 'Squeaky brakes' }));
  assert.deepEqual(JSON.parse(window.sessionStorage.getItem('wh-book-draft:north')), { serviceIds: [7], description: 'Squeaky brakes' });
  first.ui.unmount();
  const second = await mount('north');
  assert.deepEqual(second.api.draft, { serviceIds: [7], description: 'Squeaky brakes' });
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
  await m.act(() => m.api.update({ serviceIds: [7] }));
  await m.act(() => m.api.clear());
  assert.deepEqual(m.api.draft, {});
  assert.equal(window.sessionStorage.getItem('wh-book-draft:north'), null);
});

test('two shops keep separate drafts', async () => {
  const a = await mount('north');
  await a.act(() => a.api.update({ serviceIds: [1] }));
  a.ui.unmount();
  const b = await mount('south');
  assert.deepEqual(b.api.draft, {});
});

test('a storage that throws still lets the draft work in memory', async () => {
  const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() { throw new Error('denied'); } };
  const m = await mount('north', { storage: broken });
  await m.act(() => m.api.update({ serviceIds: [3] }));
  assert.deepEqual(m.api.draft, { serviceIds: [3] });
});

test('a getItem that throws once on mount does not wipe a stored draft', async () => {
  let getItemCalls = 0;
  const store = new Map([['wh-book-draft:north', JSON.stringify({ serviceIds: [9] })]]);
  const flaky = {
    getItem(key) {
      getItemCalls += 1;
      if (getItemCalls === 1) throw new Error('denied once');
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) { store.set(key, value); },
    removeItem(key) { store.delete(key); },
  };
  await mount('north', { storage: flaky });
  assert.equal(store.get('wh-book-draft:north'), JSON.stringify({ serviceIds: [9] }));
});

test('a corrupt stored value is left untouched until an update is made', async () => {
  uninstall ??= installDom('http://localhost/book/north');
  window.sessionStorage.setItem('wh-book-draft:north', '{not json');
  const { render, act } = await import('@testing-library/react');
  const { createElement: h } = await import('react');
  const mod = await importFresh(DRAFT);
  let api;
  function Probe() { api = mod.useDraft(); return null; }
  render(h(mod.DraftProvider, { shopSlug: 'north' }, h(Probe)));
  assert.equal(window.sessionStorage.getItem('wh-book-draft:north'), '{not json');
  await act(() => api.update({ serviceIds: [5] }));
  assert.equal(window.sessionStorage.getItem('wh-book-draft:north'), JSON.stringify({ serviceIds: [5] }));
});

test('a stored value that is not a plain object is left untouched until an update is made', async () => {
  uninstall ??= installDom('http://localhost/book/north');
  window.sessionStorage.setItem('wh-book-draft:north', 'null');
  const { render, act } = await import('@testing-library/react');
  const { createElement: h } = await import('react');
  const mod = await importFresh(DRAFT);
  let api;
  function Probe() { api = mod.useDraft(); return null; }
  render(h(mod.DraftProvider, { shopSlug: 'north' }, h(Probe)));
  assert.deepEqual(api.draft, {});
  assert.equal(window.sessionStorage.getItem('wh-book-draft:north'), 'null');
  await act(() => api.update({ serviceIds: [5] }));
  assert.equal(window.sessionStorage.getItem('wh-book-draft:north'), JSON.stringify({ serviceIds: [5] }));
});

test('useDraft outside a provider says so', async () => {
  uninstall ??= installDom('http://localhost/book/north');
  const { render } = await import('@testing-library/react');
  const { createElement: h } = await import('react');
  const mod = await importFresh(DRAFT);
  function Probe() { mod.useDraft(); return null; }
  assert.throws(() => render(h(Probe)), /DraftProvider/);
});
