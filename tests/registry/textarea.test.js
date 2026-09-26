import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from '../helpers/dom.js';

const ITEM = new URL('../../.test-build/registry/primitives/textarea.js', import.meta.url).href;

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

test('a labelled text box reports what is typed', async () => {
  const { render, fireEvent, h, mod } = await setup();
  const seen = [];
  const ui = render(h('label', null, 'Describe the problem',
    h(mod.Textarea, { onChange: (e) => seen.push(e.target.value) })));
  const field = ui.getByRole('textbox', { name: 'Describe the problem' });
  fireEvent.change(field, { target: { value: 'Squeaky brakes' } });
  assert.deepEqual(seen, ['Squeaky brakes']);
  assert.equal(field.tagName, 'TEXTAREA');
});
