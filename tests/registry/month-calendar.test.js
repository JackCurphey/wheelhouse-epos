import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from '../helpers/dom.js';

const ITEM = new URL('../../.test-build/registry/patterns/month-calendar.js', import.meta.url).href;

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

async function renderCal({ month = '2026-10', available = ['2026-10-08', '2026-10-09'], value = null } = {}) {
  const { render, fireEvent, h, mod } = await setup();
  const picked = [];
  const months = [];
  const ui = render(h(mod.MonthCalendar, {
    month, available: new Set(available), value,
    onChange: (d) => picked.push(d), onMonthChange: (m) => months.push(m),
  }));
  const day = (d) => ui.container.querySelector(`[data-date="${d}"]`);
  return { ui, fireEvent, picked, months, day, mod };
}

test('the date helpers work in UTC and weeks start on Monday', async () => {
  const { mod } = await renderCal();
  assert.equal(mod.monthDays('2026-02').length, 28);
  assert.equal(mod.leadingBlanks('2026-10'), 3); // 1 Oct 2026 is a Thursday
  assert.equal(mod.leadingBlanks('2026-11'), 6); // 1 Nov 2026 is a Sunday
  assert.equal(mod.addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(mod.addMonths('2026-12', 1), '2027-01');
});

test('a month starting on Sunday lays out six blanks before day 1', async () => {
  const { ui } = await renderCal({ month: '2026-11', available: [] });
  const cells = [...ui.container.querySelectorAll('[data-cell]')];
  assert.equal(cells.slice(0, 6).every((c) => c.getAttribute('data-cell') === 'blank'), true);
  assert.equal(cells[6].getAttribute('data-date'), '2026-11-01');
});

test('an available day reports its date; an unavailable one does nothing', async () => {
  const { fireEvent, picked, day } = await renderCal();
  assert.match(day('2026-10-08').getAttribute('aria-label'), /8 October 2026/);
  fireEvent.click(day('2026-10-08'));
  assert.equal(day('2026-10-07').getAttribute('aria-disabled'), 'true');
  fireEvent.click(day('2026-10-07'));
  assert.deepEqual(picked, ['2026-10-08']);
});

test('the picked day is marked', async () => {
  const { day } = await renderCal({ value: '2026-10-09' });
  assert.equal(day('2026-10-09').getAttribute('aria-pressed'), 'true');
  assert.equal(day('2026-10-08').getAttribute('aria-pressed'), 'false');
});

test('arrow keys move between days, and past the month end ask for the next month', async () => {
  const { fireEvent, months, day } = await renderCal({ value: '2026-10-08' });
  const start = day('2026-10-08');
  assert.equal(start.tabIndex, 0);
  assert.equal(day('2026-10-09').tabIndex, -1);
  fireEvent.keyDown(start, { key: 'ArrowRight' });
  assert.equal(document.activeElement.getAttribute('data-date'), '2026-10-09');
  fireEvent.keyDown(day('2026-10-09'), { key: 'ArrowDown' });
  fireEvent.keyDown(day('2026-10-16'), { key: 'ArrowDown' });
  fireEvent.keyDown(day('2026-10-23'), { key: 'ArrowDown' });
  fireEvent.keyDown(day('2026-10-30'), { key: 'ArrowDown' });
  assert.deepEqual(months, ['2026-11']);
});

test('a value that is not available renders as plain unavailable, not picked', async () => {
  const { day } = await renderCal({ value: '2026-10-07' });
  assert.equal(day('2026-10-07').getAttribute('aria-pressed'), 'false');
  assert.equal(day('2026-10-07').getAttribute('aria-disabled'), 'true');
});

test('clicking a day moves the roving tabindex to it', async () => {
  const { fireEvent, day } = await renderCal({ value: '2026-10-08' });
  fireEvent.click(day('2026-10-09'));
  assert.equal(day('2026-10-09').tabIndex, 0);
  assert.equal(day('2026-10-08').tabIndex, -1);
});

test('the month buttons ask for the previous and next month', async () => {
  const { ui, fireEvent, months } = await renderCal();
  fireEvent.click(ui.getByRole('button', { name: 'Previous month' }));
  fireEvent.click(ui.getByRole('button', { name: 'Next month' }));
  assert.deepEqual(months, ['2026-09', '2026-11']);
  assert.ok(ui.getByText('October 2026'));
});

test('a refused month-leaving arrow key does not later steal focus from the Next-month button', async () => {
  const { render, fireEvent, h, mod } = await setup();
  const { useState } = await import('react');
  function Host() {
    const [month, setMonth] = useState('2026-10');
    return h(mod.MonthCalendar, {
      month,
      available: new Set(['2026-10-01']),
      value: '2026-10-01',
      onChange: () => {},
      // Refuses any month before October - the parent's own call, not the component's.
      onMonthChange: (m) => { if (m >= '2026-10') setMonth(m); },
    });
  }
  const ui = render(h(Host));
  const day1 = ui.container.querySelector('[data-date="2026-10-01"]');
  // ArrowUp goes back 7 days, into September - refused by the host above, so
  // the calendar keeps showing October and day1 keeps focus.
  fireEvent.keyDown(day1, { key: 'ArrowUp' });
  const nextButton = ui.getByRole('button', { name: 'Next month' });
  nextButton.focus(); // as it would be after a real click, or after tabbing to it
  fireEvent.click(nextButton);
  assert.ok(document.activeElement === nextButton, `focus should stay on the Next-month button, not move to a day cell (was ${document.activeElement?.tagName}[data-date="${document.activeElement?.getAttribute?.('data-date')}"])`);
});
