// A jsdom window installed as Node globals, for component tests.
//
// Components come from .test-build/, the SSR build `npm test` runs first
// (vite.test.config.ts). Install the DOM BEFORE importing a component module:
// the app shell creates its router at import time and reads window.location
// then, so the URL given here is the URL it starts on.
import { JSDOM } from 'jsdom';

const KEYS = ['window', 'document', 'navigator', 'location', 'history', 'HTMLElement', 'Node', 'Event', 'MutationObserver', 'getComputedStyle'];

export function installDom(url = 'http://localhost/workshop') {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url, pretendToBeVisual: true });
  const saved = {};
  for (const key of KEYS) {
    saved[key] = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true, writable: true });
  }
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  return function uninstall() {
    for (const key of KEYS) {
      if (saved[key]) Object.defineProperty(globalThis, key, saved[key]);
      else delete globalThis[key];
    }
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
    dom.window.close();
  };
}

// A fresh instance of a built module, so module-level state (the app shell's
// router) is created again under the current DOM.
let generation = 0;
export function importFresh(path) {
  return import(`${path}?fresh=${++generation}`);
}
