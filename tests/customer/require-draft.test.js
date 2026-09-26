// The guard that sends a screen needing earlier answers back to the first
// book screen when they are missing.
// Spec: docs/superpowers/specs/2026-09-26-book-d1-groundwork-design.md
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

let uninstall;
afterEach(async () => {
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  uninstall?.();
  uninstall = undefined;
});

const GUARD = new URL('../../.test-build/screens/book/require-draft.js', import.meta.url).href;
const DRAFT = new URL('../../.test-build/screens/book/draft.js', import.meta.url).href;

async function renderAt(stored) {
  uninstall = installDom('http://localhost/book/north/date');
  if (stored) window.sessionStorage.setItem('wh-book-draft:north', JSON.stringify(stored));
  const { render } = await import('@testing-library/react');
  const { createElement: h } = await import('react');
  const { createMemoryRouter, RouterProvider } = await import('react-router');
  const { RequireDraft, hasService } = await importFresh(GUARD);
  const { DraftProvider } = await import(DRAFT);
  const router = createMemoryRouter([
    { path: '/book/:shopSlug/date', Component: () => h(RequireDraft, { has: hasService }, h('p', null, 'Date screen')) },
    { path: '/book/:shopSlug', Component: () => h('p', null, 'First screen') },
  ], { initialEntries: ['/book/north/date'] });
  const ui = render(h(DraftProvider, { shopSlug: 'north' }, h(RouterProvider, { router })));
  return { ui, router };
}

test('a screen that needs a service, opened with none, goes back to the first screen', async () => {
  const { ui, router } = await renderAt(null);
  assert.ok(await ui.findByText('First screen'));
  assert.equal(ui.queryByText('Date screen'), null);
  // The redirect replaces history: Back from the first screen must not land
  // the visitor on the guarded screen they were just bounced from.
  assert.equal(router.state.historyAction, 'REPLACE');
});

test('with a service chosen, the screen shows', async () => {
  const { ui } = await renderAt({ serviceId: 7 });
  assert.ok(await ui.findByText('Date screen'));
});

test('not sure counts as a chosen service', async () => {
  const { ui } = await renderAt({ notSure: true });
  assert.ok(await ui.findByText('Date screen'));
});
