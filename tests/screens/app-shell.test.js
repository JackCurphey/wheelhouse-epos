// The staff app shell, rendered in jsdom from the test build.
//
// Every URL in ROUTES must be routable before its screen exists - including
// the edge screens entered from an emailed link - so an unbuilt screen shows
// the placeholder, and an unknown /workshop address says so rather than
// crashing.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, importFresh } from '../helpers/dom.js';

const SHELL = new URL('../../.test-build/staff/app-shell.js', import.meta.url).href;

let uninstall;
afterEach(async () => {
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  uninstall?.();
});

async function renderAt(path) {
  uninstall = installDom(`http://localhost${path}`);
  const { render } = await import('@testing-library/react');
  const { createElement } = await import('react');
  const { AppShell } = await importFresh(SHELL);
  // render()'s own queries, not `screen`: screen binds to the document that
  // existed when Testing Library was first imported, and each test has a new one.
  return render(createElement(AppShell));
}

test('an unbuilt screen renders its placeholder at its own URL', async () => {
  const screen = await renderAt('/workshop');
  assert.ok(await screen.findByText('Not built yet: desk'));
});

test('an edge screen entered from outside the app is routable before it is built', async () => {
  const screen = await renderAt('/workshop/booking/42/reschedule');
  assert.ok(await screen.findByText('Not built yet: reschedule'));
});

test('an unknown /workshop address says there is no screen there', async () => {
  const screen = await renderAt('/workshop/no-such-thing');
  assert.ok(await screen.findByText('There is no screen at this address.'));
});
