import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from '../helpers/dom.js';
import { readFile, findDeclarations } from '../helpers/css.js';

const ITEM = new URL('../../.test-build/registry/primitives/button.js', import.meta.url).href;

let uninstall;
afterEach(async () => {
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  uninstall?.();
});

// Soft sand outlines its delete buttons (decision 53 in
// docs/decisions/2026-09-27-workshop-day-review.md): the danger colour is the
// border and the text, never a solid red fill.
test('a danger button is outlined in the danger colour, not filled', async () => {
  uninstall = installDom('http://localhost/');
  const { render } = await import('@testing-library/react');
  const { createElement: h } = await import('react');
  const { Button } = await import(ITEM);
  const ui = render(h(Button, { variant: 'danger' }, 'Delete job'));
  const cls = ui.getByRole('button', { name: 'Delete job' }).className.split(/\s+/);
  assert.ok(cls.includes('border-[var(--wh-danger)]'), cls.join(' '));
  assert.ok(cls.includes('bg-transparent'), cls.join(' '));
  assert.ok(cls.includes('text-[var(--wh-danger)]'), cls.join(' '));
  assert.ok(!cls.includes('bg-[var(--wh-danger)]'), 'danger must not be a solid fill');
});

test('the vanilla staff app outlines its danger button the same way', () => {
  const decls = findDeclarations(readFile('public/styles.css'), 'background')
    .filter((d) => d.selector === '.btn-danger');
  assert.deepEqual(decls.map((d) => d.value), ['transparent']);
  const colour = findDeclarations(readFile('public/styles.css'), 'color')
    .filter((d) => d.selector === '.btn-danger');
  assert.deepEqual(colour.map((d) => d.value), ['var(--danger)']);
});
