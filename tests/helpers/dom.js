// A jsdom window installed as Node globals, for component tests.
//
// Components come from .test-build/, the SSR build `npm test` runs first
// (vite.test.config.ts). Install the DOM BEFORE importing a component module:
// the app shell creates its router at import time and reads window.location
// then, so the URL given here is the URL it starts on.
import { JSDOM } from 'jsdom';

const KEYS = ['window', 'document', 'navigator', 'location', 'history', 'HTMLElement', 'Node', 'Event', 'MutationObserver', 'getComputedStyle'];

// Pages taken down but not yet removed (see uninstall below).
const waiting = new Set();

export function installDom(url = 'http://localhost/workshop') {
  // A page still waiting to come down goes now, so this one never saves
  // and later restores it.
  for (const takeDown of [...waiting]) takeDown();
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url, pretendToBeVisual: true });
  const saved = {};
  const mine = {};
  for (const key of KEYS) {
    saved[key] = Object.getOwnPropertyDescriptor(globalThis, key);
    mine[key] = dom.window[key];
    Object.defineProperty(globalThis, key, { value: mine[key], configurable: true, writable: true });
  }
  let down = false;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  // The page comes down on the next turn of the event loop, after any work
  // React has already queued (its scheduler runs on setImmediate, and its
  // follow-up to a screen update reads `window.event`). Taking it down at
  // once made that work fail after the test had ended on a busy machine
  // (#169). Only globals still pointing at this page are removed, so a
  // following test's page is never touched. Taking it down twice does
  // nothing the second time.
  function takeDown() {
    if (!waiting.delete(takeDown)) return;
    for (const key of KEYS) {
      if (globalThis[key] !== mine[key]) continue;
      if (saved[key]) Object.defineProperty(globalThis, key, saved[key]);
      else delete globalThis[key];
    }
    if (globalThis.window === undefined) delete globalThis.IS_REACT_ACT_ENVIRONMENT;
    dom.window.close();
  }
  return function uninstall() {
    if (down) return;
    down = true;
    waiting.add(takeDown);
    setImmediate(takeDown);
  };
}

// A fresh instance of a built module, so module-level state (the app shell's
// router) is created again under the current DOM.
let generation = 0;
export function importFresh(path) {
  return import(`${path}?fresh=${++generation}`);
}
