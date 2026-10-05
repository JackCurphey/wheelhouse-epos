// The test page is taken down after work React has already queued, never
// before it (#169). React schedules its follow-up work for after a screen
// update (react-dom reads `window.event` when it runs); on a busy machine
// that ran after uninstall() had removed `window`, and the test failed with
// "window is not defined" after it had ended. Taking the page down also
// never touches the next test's page.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from '../helpers/dom.js';

test('work queued before the page is taken down still finds the page', async () => {
  const uninstall = installDom();
  let seen = 'not run';
  setImmediate(() => {
    try { seen = typeof window.event; } catch (err) { seen = String(err); }
  });
  uninstall();
  await new Promise((resolve) => { setImmediate(resolve); });
  assert.equal(seen, 'undefined');
});

test('the page is gone once that work has run', async () => {
  const uninstall = installDom();
  uninstall();
  await new Promise((resolve) => { setImmediate(resolve); });
  await new Promise((resolve) => { setImmediate(resolve); });
  assert.equal(typeof globalThis.window, 'undefined');
});

test('taking one page down never removes the next test\'s page', async () => {
  const first = installDom('http://localhost/one');
  first();
  const second = installDom('http://localhost/two');
  await new Promise((resolve) => { setImmediate(resolve); });
  await new Promise((resolve) => { setImmediate(resolve); });
  assert.equal(window.location.pathname, '/two');
  second();
});

test('taking the same page down twice is harmless', async () => {
  const uninstall = installDom();
  uninstall();
  await new Promise((resolve) => { setImmediate(resolve); });
  uninstall();
  await new Promise((resolve) => { setImmediate(resolve); });
  assert.equal(typeof globalThis.window, 'undefined');
});
