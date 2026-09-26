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
// window.scrollTo calls made during the most recent renderFrame(), reset on
// every call since each installs a fresh jsdom window.
let scrollCalls;
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

async function renderFrame(
  props,
  path = '/book/north/problem',
  reply = () => new Response(JSON.stringify(SERVICES), { status: 200, headers: { 'content-type': 'application/json' } }),
) {
  uninstall = installDom(`http://localhost${path}`);
  scrollCalls = [];
  window.scrollTo = (...args) => scrollCalls.push(args);
  globalThis.fetch = async () => reply();
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
  fireEvent.click(await ui.findByRole('link', { name: /Back/ }));
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

// A field focused via Tab mid-page can end up hidden behind the pinned
// action bar (WCAG 2.4.11 Focus Not Obscured). scroll-padding-bottom on the
// document keeps a scroll-into-view landing above the bar.
test('with a pinned action, scroll-padding-bottom is set on the document and restored after unmount', async () => {
  const ui = await renderFrame({ step: 2, title: 'T', action: { label: 'Choose a day', onClick: () => {} } });
  await ui.findByText('North Street Cycles');
  assert.notEqual(document.documentElement.style.scrollPaddingBottom, '');
  ui.unmount();
  assert.equal(document.documentElement.style.scrollPaddingBottom, '');
});

test('without a pinned action, scroll-padding-bottom is left alone', async () => {
  const ui = await renderFrame({ step: 2, title: 'T' });
  await ui.findByText('North Street Cycles');
  assert.equal(document.documentElement.style.scrollPaddingBottom, '');
});

test('while the shop loads, only "Loading…" shows - no title, body or action', async () => {
  // The fetch is held open (never resolved) so the frame's pending state can
  // be inspected. Left unsettled, the query stays "fetching" past the end of
  // the test: unmounting drops React Query's observer but not the in-flight
  // retryer, which keeps a real gcTime timer (5 minutes) alive and stalls
  // the whole test file's exit. Resolving it here, and unmounting before the
  // test returns, lets afterEach's client.clear() tear the query down with
  // nothing left pending.
  let resolveFetch;
  const ui = await renderFrame(
    { step: 1, title: 'T', action: { label: 'Continue', onClick: () => {} } },
    undefined,
    () => new Promise((resolve) => { resolveFetch = resolve; }),
  );
  assert.ok(await ui.findByText('Loading…'));
  assert.equal(ui.queryByText('Screen body'), null);
  assert.equal(ui.queryByRole('button', { name: 'Continue' }), null);
  resolveFetch(new Response(JSON.stringify(SERVICES), { status: 200, headers: { 'content-type': 'application/json' } }));
  await ui.findByText('North Street Cycles');
  ui.unmount();
});

test('an unknown shop says so, with no shop name', async () => {
  const ui = await renderFrame({ step: 1, title: 'T' }, undefined,
    () => new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'content-type': 'application/json' } }));
  assert.ok(await ui.findByRole('heading', { level: 1, name: "We can't find this shop" }));
  assert.equal(ui.queryByText('Screen body'), null);
});

test('a failed load offers Try again, which recovers', async () => {
  const { fireEvent } = await import('@testing-library/react');
  let fail = true;
  const ui = await renderFrame({ step: 1, title: 'Tell us about your bike' }, undefined, () => (fail
    ? new Response(JSON.stringify({ error: 'boom' }), { status: 500, headers: { 'content-type': 'application/json' } })
    : new Response(JSON.stringify(SERVICES), { status: 200, headers: { 'content-type': 'application/json' } })));
  assert.ok(await ui.findByRole('heading', { level: 1, name: "We couldn't load this shop's services" }));
  fail = false;
  fireEvent.click(ui.getByRole('button', { name: 'Try again' }));
  assert.ok(await ui.findByRole('heading', { level: 1, name: 'Tell us about your bike' }));
});

test('focus lands on the title once the screen is ready', async () => {
  const ui = await renderFrame({ step: 1, title: 'Tell us about your bike' });
  const h1 = await ui.findByRole('heading', { level: 1, name: 'Tell us about your bike' });
  const { waitFor } = await import('@testing-library/react');
  await waitFor(() => assert.ok(document.activeElement === h1, 'focus is not on the h1'));
});

test('the action note sits in the pinned area above the button', async () => {
  const ui = await renderFrame({ step: 1, title: 'T', actionNote: 'Two services', action: { label: 'Continue', onClick: () => {} } });
  await ui.findByText('North Street Cycles');
  const pinned = document.querySelector('[data-book-pinned]');
  assert.ok(pinned, 'no pinned area');
  assert.ok(pinned.contains(ui.getByText('Two services')));
  assert.ok(pinned.contains(ui.getByRole('button', { name: 'Continue' })));
});

// A screen change mounts a fresh BookFrame, which otherwise keeps the
// window's previous scroll offset - the new heading can land off-screen even
// though it is focused (focus alone doesn't scroll, since it's focused with
// preventScroll). The frame scrolls the window to the top itself.
test('scrolls the window to the top once the screen is ready', async () => {
  const ui = await renderFrame({ step: 1, title: 'T' });
  await ui.findByText('North Street Cycles');
  assert.deepEqual(scrollCalls, [[0, 0]]);
});
