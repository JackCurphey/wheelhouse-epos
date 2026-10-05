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
  for (const key of KEYS) {
    Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true, writable: true });
  }
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  // Taking the page down closes it but leaves it installed until the next
  // installDom replaces it (#169). React finishes a screen update in steps
  // it queues for later turns of the event loop, each reading
  // `window.event`; removing `window` at once, or even one turn later, let
  // a late step fail after its test had ended on a busy machine. A closed
  // page answers those reads harmlessly. Each test file runs in its own
  // process, so nothing carries over to another file.
  return function uninstall() {
    dom.window.close();
  };
}

// A fresh instance of a built module, so module-level state (the app shell's
// router) is created again under the current DOM.
let generation = 0;
export function importFresh(path) {
  return import(`${path}?fresh=${++generation}`);
}
