// The frame around every book screen: shop name, step/progress, title, pinned action.
// Spec: docs/superpowers/specs/2026-09-26-book-d1-groundwork-design.md
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

let uninstall;
// The query client each renderFrame() call builds - tracked here so afterEach
// (and the multi-render test below) can clear it before tearing down the DOM.
// React Query schedules cache removal with a real setTimeout (gcTime,
// default 5 minutes) that is not unref'd; left to fire on its own it would
// either hold the test process open long after the assertions finish, or
// - if it fires after uninstall() has removed `window` - throw
// "ReferenceError: window is not defined" as an uncaught async exception.
// client.clear() runs that cleanup synchronously, so nothing is left
// pending once the DOM comes down.
let client;
afterEach(async () => {
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  client?.clear();
  client = undefined;
  uninstall?.();
  uninstall = undefined;
});

const FRAME = new URL('../../.test-build/screens/book/frame.js', import.meta.url).href;

const SERVICES = { shopName: 'North Street Cycles', showPrices: false, full: [], categories: [], uncategorised: [] };

async function renderFrame(props, path = '/book/north/problem') {
  uninstall = installDom(`http://localhost${path}`);
  globalThis.fetch = async () => new Response(JSON.stringify(SERVICES), { status: 200, headers: { 'content-type': 'application/json' } });
  const { render } = await import('@testing-library/react');
  const { createElement: h } = await import('react');
  const { createMemoryRouter, RouterProvider } = await import('react-router');
  const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
  const { BookFrame } = await importFresh(FRAME);
  const router = createMemoryRouter([
    { path: '/book/:shopSlug/problem', Component: () => h(BookFrame, props, h('p', null, 'Screen body')) },
    { path: '/book/:shopSlug', Component: () => h('p', null, 'First screen') },
  ], { initialEntries: [path] });
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(h(QueryClientProvider, { client }, h(RouterProvider, { router })));
}

test('shows the shop name, step, title and body', async () => {
  const ui = await renderFrame({ step: 2, title: 'Tell us about your bike' });
  assert.ok(await ui.findByText('North Street Cycles'));
  assert.ok(ui.getByText('Step 2 of 4'));
  assert.equal(ui.getByRole('progressbar').getAttribute('aria-valuenow'), '2');
  assert.ok(ui.getByRole('heading', { level: 1, name: 'Tell us about your bike' }));
  assert.ok(ui.getByText('Screen body'));
});

test('without a step there is no step count', async () => {
  const ui = await renderFrame({ title: 'Your request is with us' });
  await ui.findByText('North Street Cycles');
  assert.equal(ui.queryByText(/Step \d of 4/), null);
  assert.equal(ui.queryByRole('progressbar'), null);
});

test('the back link goes where it is told', async () => {
  const { fireEvent } = await import('@testing-library/react');
  const ui = await renderFrame({ step: 2, title: 'T', back: '/book/north' });
  fireEvent.click(ui.getByRole('link', { name: /Back/ }));
  assert.ok(await ui.findByText('First screen'));
});

test('the action button calls its handler, and can be disabled', async () => {
  const { fireEvent } = await import('@testing-library/react');
  let taps = 0;
  const ui = await renderFrame({ step: 2, title: 'T', action: { label: 'Choose a day', onClick: () => taps++ } });
  // Let the shop-name fetch settle before tearing this render down: the
  // frame renders and the button is clickable immediately, but unmounting
  // and swapping the DOM out from under a still-in-flight query is what
  // produced the leak below - not the behaviour this test is proving - so
  // each render is drained before it is replaced.
  await ui.findByText('North Street Cycles');
  fireEvent.click(ui.getByRole('button', { name: 'Choose a day' }));
  assert.equal(taps, 1);
  ui.unmount();
  client.clear();
  uninstall();
  const off = await renderFrame({ step: 2, title: 'T', action: { label: 'Choose a day', onClick: () => taps++, disabled: true } });
  await off.findByText('North Street Cycles');
  assert.equal(off.getByRole('button', { name: 'Choose a day' }).disabled, true);
});
