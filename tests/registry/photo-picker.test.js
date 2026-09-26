import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from '../helpers/dom.js';

const ITEM = new URL('../../.test-build/registry/patterns/photo-picker.js', import.meta.url).href;

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

const MB = 1024 * 1024;
const photo = (name, size = 1000, type = 'image/jpeg') => new File([new Uint8Array(size)], name, { type });

// A stateful wrapper so the picker sees its own onChange results, as a screen would.
async function renderPicker(initial = []) {
  const { render, fireEvent, h, mod } = await setup();
  const { useState } = await import('react');
  const changes = [];
  function Host() {
    const [files, setFiles] = useState(initial);
    return h(mod.PhotoPicker, { value: files, onChange: (f) => { changes.push(f.map((x) => x.name)); setFiles(f); } });
  }
  const ui = render(h(Host));
  const input = ui.container.querySelector('input[type="file"]');
  return { ui, fireEvent, input, changes };
}

test('the chooser asks the phone for photos only, several at once', async () => {
  const { input } = await renderPicker();
  assert.equal(input.getAttribute('accept'), 'image/jpeg,image/png,image/webp');
  assert.equal(input.multiple, true);
});

test('a JPEG is added and shown with a remove button and the count', async () => {
  const { ui, fireEvent, input, changes } = await renderPicker();
  fireEvent.change(input, { target: { files: [photo('wheel.jpg')] } });
  assert.deepEqual(changes, [['wheel.jpg']]);
  const btn = ui.getByRole('button', { name: 'Remove wheel.jpg' });
  assert.ok(btn);
  assert.match(btn.className, /\bsize-11\b/);
  assert.ok(ui.getByText(/1 of 5 added/));
});

test('a PDF, an 11 MB photo and a sixth photo are refused with a message each', async () => {
  const four = ['a', 'b', 'c', 'd'].map((n) => photo(`${n}.jpg`));
  const { ui, fireEvent, input, changes } = await renderPicker(four);
  fireEvent.change(input, { target: { files: [photo('notes.pdf', 1000, 'application/pdf'), photo('huge.jpg', 11 * MB), photo('e.jpg'), photo('f.jpg')] } });
  assert.deepEqual(changes, [['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg', 'e.jpg']]);
  const alert = ui.getByRole('alert').textContent;
  assert.match(alert, /notes\.pdf/);
  assert.match(alert, /huge\.jpg/);
  assert.match(alert, /f\.jpg/);
});

test('remove drops only that photo', async () => {
  const { ui, fireEvent, changes } = await renderPicker([photo('a.jpg'), photo('b.jpg')]);
  fireEvent.click(ui.getByRole('button', { name: 'Remove a.jpg' }));
  assert.deepEqual(changes, [['b.jpg']]);
});
