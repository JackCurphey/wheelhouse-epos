// The customer app shell, rendered in jsdom from the test build.
// Spec: docs/superpowers/specs/2026-09-25-book-b-customer-shell-design.md
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/customer/app-shell.js', import.meta.url).href;

let uninstall;
// The shell's query client is module-level (not per-render), so its cache
// must be cleared unconditionally after every render - otherwise a test that
// resolves a real query leaves the cache's own cleanup pending and keeps this
// file from exiting promptly (see tests/customer/frame.test.js). Captured
// here rather than per-test so a future test that adds a fetch can't forget it.
let currentClient;
afterEach(async () => {
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  currentClient?.clear();
  currentClient = undefined;
  uninstall?.();
});

async function renderAt(path) {
  uninstall = installDom(`http://localhost${path}`);
  const { render } = await import('@testing-library/react');
  const { createElement } = await import('react');
  const { CustomerAppShell, queryClient } = await importFresh(SHELL);
  currentClient = queryClient;
  return render(createElement(CustomerAppShell));
}

const SERVICES = {
  shopName: 'Demo Cycles', showPrices: false,
  full: [{ id: 1, name: 'General service', price: null, minutes: 30, questions: [], includes: [] }],
  categories: [], uncategorised: [],
};

test('the first book screen renders the service screen at /book/<shop>', async () => {
  globalThis.fetch = async () =>
    new Response(JSON.stringify(SERVICES), { status: 200, headers: { 'content-type': 'application/json' } });
  const screen = await renderAt('/book/demo');
  assert.ok(await screen.findByRole('heading', { level: 1, name: 'What do you need?' }));
  screen.unmount();
});

test('a private link opened cold reaches the pending screen', async () => {
  const screen = await renderAt(`/book/demo/booking/${'a'.repeat(64)}`);
  assert.ok(await screen.findByText('Not built yet: pending'));
});

test('an unknown /book address says there is no screen there', async () => {
  const screen = await renderAt('/book/demo/nope/nope');
  assert.ok(await screen.findByText('There is no screen at this address.'));
});

test('bare /book, which storefronts link to, says there is no screen there', async () => {
  const screen = await renderAt('/book');
  assert.ok(await screen.findByText('There is no screen at this address.'));
});
