import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from '../helpers/dom.js';

const ITEM = new URL('../../.test-build/registry/primitives/checkbox.js', import.meta.url).href;

let uninstall;
afterEach(async () => {
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  uninstall?.();
});

async function setup() {
  uninstall = installDom('http://localhost/');
  const rtl = await import('@testing-library/react');
  const { createElement: h } = await import('react');
  const mod = await import(ITEM);
  return { ...rtl, h, mod };
}

test('the label names the tick box and a click reports the change', async () => {
  const { render, fireEvent, h, mod } = await setup();
  const seen = [];
  const ui = render(h(mod.Checkbox, { label: 'I accept the terms', onChange: (e) => seen.push(e.target.checked) }));
  const box = ui.getByRole('checkbox', { name: 'I accept the terms' });
  fireEvent.click(box);
  assert.deepEqual(seen, [true]);
});
