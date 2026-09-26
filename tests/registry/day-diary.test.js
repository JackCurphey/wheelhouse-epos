import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from '../helpers/dom.js';

const ITEM = new URL('../../.test-build/registry/patterns/day-diary.js', import.meta.url).href;

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

const COLUMNS = [
  { id: '1', name: 'Sam', busy: [{ start: '09:00', end: '10:00' }], startTimes: ['10:00', '10:30', '11:00'] },
  { id: '2', name: 'Alex', busy: [{ start: '09:30', end: '11:00' }], startTimes: ['11:00'] },
];

async function renderDiary(value = null) {
  const { render, fireEvent, h, mod } = await setup();
  const picked = [];
  const ui = render(h(mod.DayDiary, { open: '09:00', close: '12:00', columns: COLUMNS, value, onChange: (v) => picked.push(v) }));
  return { ui, fireEvent, picked, mod };
}

test('one labelled column per mechanic', async () => {
  const { ui } = await renderDiary();
  assert.ok(ui.getByRole('group', { name: 'Sam' }));
  assert.ok(ui.getByRole('group', { name: 'Alex' }));
});

test('booked time says Unavailable and nothing else', async () => {
  const { ui } = await renderDiary();
  const blocks = [...ui.container.querySelectorAll('[data-busy]')];
  assert.equal(blocks.length, 2);
  assert.deepEqual(blocks.map((b) => b.textContent), ['Unavailable', 'Unavailable']);
});

test('each allowed start time is a button, and pressing one reports it', async () => {
  const { ui, fireEvent, picked } = await renderDiary();
  fireEvent.click(ui.getByRole('button', { name: 'Sam, 10:30' }));
  assert.deepEqual(picked, [{ columnId: '1', time: '10:30' }]);
});

test('a time the server did not offer has no button', async () => {
  const { ui } = await renderDiary();
  assert.equal(ui.queryByRole('button', { name: 'Alex, 10:00' }), null);
  assert.equal(ui.queryByRole('button', { name: 'Sam, 09:30' }), null);
});

test('the picked time is marked', async () => {
  const { ui } = await renderDiary({ columnId: '2', time: '11:00' });
  assert.equal(ui.getByRole('button', { name: 'Alex, 11:00' }).getAttribute('aria-pressed'), 'true');
  assert.equal(ui.getByRole('button', { name: 'Sam, 11:00' }).getAttribute('aria-pressed'), 'false');
});

test('start times 30 minutes apart get at least 44px each', async () => {
  const { mod } = await renderDiary();
  assert.ok(mod.pxPerMinute(COLUMNS) * 30 >= 44);
  const fifteen = [{ id: '1', name: 'Sam', busy: [], startTimes: ['09:00', '09:15'] }];
  assert.ok(mod.pxPerMinute(fifteen) * 15 >= 44);
});
