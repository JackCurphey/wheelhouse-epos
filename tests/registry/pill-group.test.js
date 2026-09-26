import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from '../helpers/dom.js';

const ITEM = new URL('../../.test-build/registry/primitives/pill-group.js', import.meta.url).href;

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

const OPTIONS = [
  { value: 'email', label: 'Email' },
  { value: 'sms', label: 'Text' },
  { value: 'whatsapp', label: 'WhatsApp', disabled: true },
];

test('single choice is a labelled radio group that reports one value', async () => {
  const { render, fireEvent, h, mod } = await setup();
  const seen = [];
  const ui = render(h(mod.PillGroup, { legend: 'How should we update you?', options: OPTIONS, value: 'email', onChange: (v) => seen.push(v) }));
  assert.ok(ui.getByRole('group', { name: 'How should we update you?' }));
  assert.equal(ui.getByRole('radio', { name: 'Email' }).checked, true);
  fireEvent.click(ui.getByRole('radio', { name: 'Text' }));
  assert.deepEqual(seen, ['sms']);
});

test('a disabled option cannot be picked', async () => {
  const { render, fireEvent, h, mod } = await setup();
  const seen = [];
  const ui = render(h(mod.PillGroup, { legend: 'Channel', options: OPTIONS, value: 'email', onChange: (v) => seen.push(v) }));
  const off = ui.getByRole('radio', { name: 'WhatsApp' });
  assert.equal(off.disabled, true);
  fireEvent.click(off);
  assert.deepEqual(seen, []);
});

test('multiple choice reports the whole set, adding and removing', async () => {
  const { render, fireEvent, h, mod } = await setup();
  const seen = [];
  const mechs = [{ value: '1', label: 'Sam' }, { value: '2', label: 'Alex' }];
  const ui = render(h(mod.PillGroup, { legend: 'Mechanics', options: mechs, multiple: true, value: ['1'], onChange: (v) => seen.push(v) }));
  fireEvent.click(ui.getByRole('checkbox', { name: 'Alex' }));
  fireEvent.click(ui.getByRole('checkbox', { name: 'Sam' }));
  assert.deepEqual(seen, [['1', '2'], []]);
});
