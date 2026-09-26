// The /book/:shopSlug layout route: it must provide one DraftProvider per
// shop, keyed by shopSlug, so moving to another shop's address starts that
// shop's own draft instead of carrying the old one over.
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

const SHELL = new URL('../../.test-build/customer/app-shell.js', import.meta.url).href;
const DRAFT = new URL('../../.test-build/screens/book/draft.js', import.meta.url).href;

async function renderAt(path) {
  uninstall = installDom(`http://localhost${path}`);
  const { render, act } = await import('@testing-library/react');
  const { createElement: h } = await import('react');
  const { createMemoryRouter, RouterProvider, Link } = await import('react-router');
  const { BookLayout } = await importFresh(SHELL);
  const { useDraft } = await import(DRAFT);

  function ProblemProbe() {
    const { draft, update } = useDraft();
    return h(
      'div',
      null,
      h('p', null, `serviceIds:${(draft.serviceIds ?? []).join(',')}`),
      h('button', { onClick: () => update({ serviceIds: [7] }) }, 'Choose service'),
      h(Link, { to: '../date' }, 'Go to date'),
    );
  }

  function DateProbe() {
    const { draft } = useDraft();
    return h('p', null, `date-screen serviceIds:${(draft.serviceIds ?? []).join(',')}`);
  }

  const router = createMemoryRouter(
    [
      {
        path: '/book/:shopSlug',
        Component: BookLayout,
        children: [
          { path: 'problem', Component: ProblemProbe },
          { path: 'date', Component: DateProbe },
        ],
      },
    ],
    { initialEntries: [path] },
  );
  const ui = render(h(RouterProvider, { router }));
  return { ui, router, navigate: (to) => act(() => router.navigate(to)) };
}

test('an update on one screen is visible on another screen for the same shop', async () => {
  const { ui, navigate } = await renderAt('/book/north/problem');
  const { fireEvent } = await import('@testing-library/react');
  await ui.findByText('serviceIds:');
  fireEvent.click(ui.getByRole('button', { name: 'Choose service' }));
  await ui.findByText('serviceIds:7');

  await navigate('/book/north/date');
  assert.ok(await ui.findByText('date-screen serviceIds:7'));
});

test('moving to another shop starts that shop\'s own draft, not the old one', async () => {
  const { ui, navigate } = await renderAt('/book/north/problem');
  const { fireEvent } = await import('@testing-library/react');
  await ui.findByText('serviceIds:');
  fireEvent.click(ui.getByRole('button', { name: 'Choose service' }));
  await ui.findByText('serviceIds:7');

  await navigate('/book/south/problem');
  assert.ok(await ui.findByText('serviceIds:'));
  assert.equal(window.sessionStorage.getItem('wh-book-draft:south'), null);
});
