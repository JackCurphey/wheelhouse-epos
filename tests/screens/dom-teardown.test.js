// Taking the test page down never pulls `window` out from under work React
// has queued (#169). React finishes a screen update in steps on later turns
// of the event loop, each reading `window.event`; on a busy machine a step
// ran after uninstall() had removed `window`, and the test failed with
// "window is not defined" after it had ended. A taken-down page is closed
// and stays installed until the next one replaces it.
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

test('work React queues in two steps, the second after the page is taken down, still finds it', async () => {
  const uninstall = installDom();
  let seen = 'not run';
  // Render on one turn; the render queues its effects for the next turn.
  setImmediate(() => {
    setImmediate(() => {
      try { seen = typeof window.event; } catch (err) { seen = String(err); }
    });
  });
  uninstall();
  for (let i = 0; i < 4; i += 1) await new Promise((resolve) => { setImmediate(resolve); });
  assert.equal(seen, 'undefined');
});

test('a taken-down page is closed: its document is gone', async () => {
  const uninstall = installDom();
  uninstall();
  assert.equal(window.document, undefined);
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

test('taking the same page down twice is harmless', () => {
  const uninstall = installDom();
  uninstall();
  assert.doesNotThrow(() => uninstall());
});
