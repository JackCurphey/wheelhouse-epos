import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from '../helpers/dom.js';

const ITEM = new URL('../../.test-build/registry/primitives/choice-card.js', import.meta.url).href;

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

test('a selected card says so, an unselected one does not, and a tap reports', async () => {
  const { render, fireEvent, h, mod } = await setup();
  let taps = 0;
  const ui = render(h('div', null,
    h(mod.ChoiceCard, { title: 'Full service', detail: 'Everything checked', price: '£65', selected: true }),
    h(mod.ChoiceCard, { title: 'Individual services', selected: false, onClick: () => taps++ })));
  assert.equal(ui.getByRole('button', { name: /Full service/ }).getAttribute('aria-pressed'), 'true');
  assert.ok(ui.getByText('£65'));
  const other = ui.getByRole('button', { name: /Individual services/ });
  assert.equal(other.getAttribute('aria-pressed'), 'false');
  fireEvent.click(other);
  assert.equal(taps, 1);
});

test('a card used to navigate, with no selected prop, is a plain button', async () => {
  const { render, h, mod } = await setup();
  const ui = render(h(mod.ChoiceCard, { title: 'Not sure' }));
  assert.equal(ui.getByRole('button', { name: /Not sure/ }).hasAttribute('aria-pressed'), false);
});

test('a screen reader hears the title, detail and price as separate words', async () => {
  const { render, h, mod } = await setup();
  const ui = render(h('div', null,
    h(mod.ChoiceCard, { title: 'Full service', detail: 'Everything checked', price: '£65' }),
    h(mod.ChoiceCard, { title: 'Service 1', price: 'From £20' })));
  assert.ok(ui.getByRole('button', { name: 'Full service Everything checked £65' }));
  assert.ok(ui.getByRole('button', { name: 'Service 1 From £20' }));
});
