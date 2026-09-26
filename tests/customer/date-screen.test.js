// The date screen: the calendar (this month and next), a timed day's mechanic
// pills and diary, a drop-off day's window and mechanic choice, the pinned
// summary, and Continue.
// Spec: docs/superpowers/specs/2026-09-26-book-d4-date-screen-design.md
import test, { afterEach, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { renderBookScreen } from '../helpers/book-screen.js';

// "Today" is the device's date, so it is pinned: Monday 5 October 2026 at
// midday UTC, which is 5 October in every time zone from UTC-11 to UTC+11.
// Only Date is mocked; timers stay real so React and Testing Library work.
beforeEach(() => {
  mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-05T12:00:00Z') });
});

let current;
afterEach(async () => {
  const { cleanup } = await import('@testing-library/react');
  cleanup();
  current?.client.clear();
  current?.uninstall();
  current = undefined;
  mock.timers.reset();
});

const SERVICES = {
  shopName: 'North Street Cycles', showPrices: true, full: [], categories: [],
  uncategorised: [
    { id: 11, name: 'Brake service', price: 20, minutes: 30, questions: [] },
    { id: 12, name: 'Gear service', price: 25, minutes: 45, questions: [] },
    { id: 13, name: 'Wheel true', price: 15, minutes: 30, questions: [{ id: 'w1', wording: 'Which wheel needs truing?', kind: 'text', required: true }] },
  ],
};
const MECHANICS = {
  mechanics: [
    { id: 1, name: 'Alex', workingDays: [1, 2, 3, 4, 5] },
    { id: 2, name: 'Jo', workingDays: [1, 2, 3, 4, 5] },
    { id: 3, name: 'Sam', workingDays: [1, 2, 3, 4, 5] },
  ],
  openingTime: '09:00', closingTime: '17:00', openingDays: [1, 2, 3, 4, 5],
};
const timed = (date, times) => ({ date, mode: 'timed', mechanics: [1, 2, 3].map((id) => ({ mechanicId: id, startTimes: times[id] ?? [] })) });
const AVAILABILITY = {
  busy: [
    { mechanicId: 1, jobDate: '2026-10-05', startTime: '10:00', endTime: '12:00' },
    { mechanicId: 3, jobDate: '2026-10-05', startTime: '09:00', endTime: '10:00' },
  ],
  fullDays: [],
  days: [
    timed('2026-10-05', { 1: ['09:00', '09:30', '14:00'], 3: ['10:00'] }),
    {
      date: '2026-10-06', mode: 'dropoff', dropoffWindow: { start: '08:30', end: '10:00' }, mechanics: [
        { mechanicId: 1, bookable: false }, { mechanicId: 2, bookable: true }, { mechanicId: 3, bookable: true },
      ],
    },
    timed('2026-10-07', {}),
    timed('2026-11-02', { 3: ['09:00'] }),
  ],
};

// MonthCalendar (src/components/ui/month-calendar.tsx) names each day button
// with Intl.DateTimeFormat, which on this Node build (and in Chromium) puts a
// comma after the weekday: "Monday, 5 October 2026". Building names with the
// same formatter, rather than hard-coding a comma-free string, keeps this
// test independent of that ICU detail. The screen's own summary text is
// unaffected: it comes from dayLabel (date-rules.ts), which is deliberately
// comma-free.
const DAY_NAME = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const dayName = (date) => DAY_NAME.format(new Date(`${date}T00:00:00Z`));
const MON_5 = dayName('2026-10-05');
const TUE_6 = dayName('2026-10-06');

const open = async ({ draft = { serviceIds: [11, 12] }, availability = AVAILABILITY } = {}) => {
  current = await renderBookScreen({
    file: 'screens/book/date.js', exportName: 'DateScreen', at: 'date', url: '/book/north/date',
    services: SERVICES, mechanics: MECHANICS, availability, draft,
  });
  await current.ui.findByRole('heading', { level: 1, name: 'When can you drop in?' });
  return current;
};
// The calendar shows once /mechanics and /availability have answered.
const ready = (ui, month = 'October 2026') => ui.findByRole('group', { name: month });
const rtl = () => import('@testing-library/react');
const click = async (el) => (await rtl()).fireEvent.click(el);
const day = (ui, name) => ui.getByRole('button', { name });
const pinnedSummary = () => document.querySelector('[data-book-pinned] [aria-live="polite"]');

test('step 3, the heading, and Back goes to the problem screen', async () => {
  const { ui } = await open();
  await ready(ui);
  assert.ok(ui.getByText('Step 3 of 4'));
  await click(ui.getByRole('link', { name: /Back/ }));
  assert.ok(await ui.findByText('At /book/north/problem'));
});

test("it asks for today to the end of next month, for the ticked services' minutes", async () => {
  const { ui, requests } = await open();
  await ready(ui);
  const urls = requests.map((r) => r.url);
  assert.ok(urls.includes('/api/portal/north/mechanics'), JSON.stringify(urls));
  assert.ok(urls.includes('/api/portal/north/availability?start=2026-10-05&end=2026-11-30&minutes=75'), JSON.stringify(urls));
});

test('"Not sure" asks for an hour', async () => {
  const { ui, requests } = await open({ draft: { notSure: true, serviceIds: [], answers: [], description: 'Clicks when pedalling' } });
  await ready(ui);
  assert.ok(requests.some((r) => r.url === '/api/portal/north/availability?start=2026-10-05&end=2026-11-30&minutes=60'),
    JSON.stringify(requests));
});

test('while the free days load, it says so', async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const availability = async () => {
    await gate;
    return { status: 200, body: AVAILABILITY };
  };
  const { ui } = await open({ availability });
  assert.ok(await ui.findByText('Loading…'));
  release();
  await ready(ui);
});

test("a failed load says so and offers Try again, which asks again", async () => {
  let calls = 0;
  const availability = () => (++calls === 1
    ? { status: 500, body: { error: 'Something went wrong' } }
    : { status: 200, body: AVAILABILITY });
  const { ui } = await open({ availability });
  assert.ok(await ui.findByText("We couldn't load the free days"));
  await click(ui.getByRole('button', { name: 'Try again' }));
  await ready(ui);
  assert.equal(calls, 2);
});

test('free days can be picked; a full day and a past day are greyed; the summary starts empty', async () => {
  const { ui } = await open();
  await ready(ui);
  assert.equal(day(ui, MON_5).getAttribute('aria-disabled'), null);
  assert.equal(day(ui, TUE_6).getAttribute('aria-disabled'), null);
  assert.equal(day(ui, dayName('2026-10-07')).getAttribute('aria-disabled'), 'true');
  assert.equal(day(ui, dayName('2026-10-01')).getAttribute('aria-disabled'), 'true');
  assert.equal(pinnedSummary().textContent, '');
});

test('only this month and next can be shown', async () => {
  const { ui } = await open();
  await ready(ui);
  await click(ui.getByRole('button', { name: 'Previous month' }));
  assert.ok(ui.getByRole('group', { name: 'October 2026' }));
  await click(ui.getByRole('button', { name: 'Next month' }));
  assert.ok(ui.getByRole('group', { name: 'November 2026' }));
  assert.equal(day(ui, dayName('2026-11-02')).getAttribute('aria-disabled'), null);
  await click(ui.getByRole('button', { name: 'Next month' }));
  assert.ok(ui.getByRole('group', { name: 'November 2026' }));
  assert.equal(ui.queryByRole('group', { name: 'December 2026' }), null);
});

test('a timed day: every mechanic on, one diary column each, busy time greyed', async () => {
  const { ui } = await open();
  await ready(ui);
  await click(day(ui, MON_5));
  const { within } = await rtl();
  const pills = within(ui.getByRole('group', { name: 'Mechanic' })).getAllByRole('checkbox');
  assert.deepEqual(pills.map((p) => [p.closest('label').textContent, p.checked]), [['Alex', true], ['Jo', true], ['Sam', true]]);
  const alex = ui.getByRole('group', { name: 'Alex' });
  assert.deepEqual(within(alex).getAllByRole('button').map((b) => b.getAttribute('aria-label')), ['Alex, 09:00', 'Alex, 09:30', 'Alex, 14:00']);
  assert.equal(within(alex).getAllByText('Unavailable').length, 1);
  const jo = ui.getByRole('group', { name: 'Jo' });
  assert.equal(within(jo).queryAllByRole('button').length, 0);
  assert.equal(within(jo).getAllByText('Unavailable').length, 1, 'a mechanic with no free time shows as unavailable all day');
  assert.ok(ui.getByRole('button', { name: 'Sam, 10:00' }));
  assert.equal(pinnedSummary().textContent, 'Monday 5 October');
});

test('the mechanic pills hide columns, but the last one on stays on', async () => {
  const { ui } = await open();
  await ready(ui);
  await click(day(ui, MON_5));
  await click(ui.getByRole('checkbox', { name: 'Alex' }));
  await click(ui.getByRole('checkbox', { name: 'Jo' }));
  assert.equal(ui.queryByRole('group', { name: 'Alex' }), null);
  assert.equal(ui.queryByRole('group', { name: 'Jo' }), null);
  await click(ui.getByRole('checkbox', { name: 'Sam' }));
  assert.equal(ui.getByRole('checkbox', { name: 'Sam' }).checked, true);
  assert.ok(ui.getByRole('group', { name: 'Sam' }));
  await click(ui.getByRole('checkbox', { name: 'Alex' }));
  assert.ok(ui.getByRole('group', { name: 'Alex' }));
});

test('tapping a free time saves the day, mechanic and time, and the summary says so', async () => {
  const { ui, readDraft } = await open();
  await ready(ui);
  await click(day(ui, MON_5));
  await click(ui.getByRole('button', { name: 'Alex, 09:30' }));
  const saved = readDraft();
  assert.deepEqual([saved.date, saved.mechanicId, saved.startTime], ['2026-10-05', 1, '09:30']);
  assert.equal(ui.getByRole('button', { name: 'Alex, 09:30' }).getAttribute('aria-pressed'), 'true');
  assert.equal(pinnedSummary().textContent, 'Monday 5 October, 09:30 with Alex');
});

test('a drop-off day: the window, the note, and "Any mechanic" first with an unavailable mechanic greyed', async () => {
  const { ui, readDraft } = await open();
  await ready(ui);
  await click(day(ui, TUE_6));
  assert.ok(ui.getByText('Drop off between 08:30 and 10:00'));
  assert.ok(ui.getByText("We'll confirm once the shop has looked at your request"));
  assert.equal(ui.queryByRole('group', { name: 'Alex' }), null, 'no diary on a drop-off day');
  const { within } = await rtl();
  const radios = within(ui.getByRole('group', { name: 'Mechanic' })).getAllByRole('radio');
  assert.deepEqual(radios.map((r) => [r.closest('label').textContent, r.checked, r.disabled]), [
    ['Any mechanic', true, false], ['Alex', false, true], ['Jo', false, false], ['Sam', false, false],
  ]);
  assert.equal(pinnedSummary().textContent, 'Tuesday 6 October, drop off 08:30–10:00');
  await click(ui.getByRole('radio', { name: 'Sam' }));
  assert.equal(readDraft().mechanicId, 3);
  assert.equal(readDraft().startTime, undefined);
  await click(ui.getByRole('radio', { name: 'Alex' }));
  assert.equal(readDraft().mechanicId, 3, 'an unavailable mechanic cannot be picked');
});

test('picking another day clears the mechanic and time chosen before', async () => {
  const { ui, readDraft } = await open();
  await ready(ui);
  await click(day(ui, MON_5));
  await click(ui.getByRole('button', { name: 'Alex, 09:00' }));
  await click(day(ui, TUE_6));
  const saved = readDraft();
  assert.deepEqual([saved.date, saved.mechanicId, saved.startTime], ['2026-10-06', undefined, undefined]);
  assert.equal(ui.getByRole('radio', { name: 'Any mechanic' }).checked, true);
});

test('Continue with no day says "Choose a day" under the summary and stays', async () => {
  const { ui } = await open();
  await ready(ui);
  await click(ui.getByRole('button', { name: 'Continue' }));
  const alert = ui.getByRole('alert');
  assert.equal(alert.textContent, 'Choose a day');
  assert.ok(document.querySelector('[data-book-pinned]').contains(alert));
  assert.ok(pinnedSummary().compareDocumentPosition(alert) & Node.DOCUMENT_POSITION_FOLLOWING, 'the message is not under the summary');
  assert.equal(ui.queryByText(/^At /), null);
});

test('Continue on a timed day with no time says "Choose a time"; the message goes once a time is picked', async () => {
  const { ui } = await open();
  await ready(ui);
  await click(day(ui, MON_5));
  await click(ui.getByRole('button', { name: 'Continue' }));
  assert.equal(ui.getByRole('alert').textContent, 'Choose a time');
  assert.equal(ui.queryByText(/^At /), null);
  await click(ui.getByRole('button', { name: 'Sam, 10:00' }));
  assert.equal(ui.queryByRole('alert'), null);
});

test('pressing Continue twice with the same problem re-announces a fresh alert', async () => {
  const { ui } = await open();
  await ready(ui);
  await click(ui.getByRole('button', { name: 'Continue' }));
  const first = ui.getByRole('alert');
  await click(ui.getByRole('button', { name: 'Continue' }));
  assert.ok(ui.getByRole('alert') !== first, 'the alert node was not replaced on the second press');
});

test('a good Continue on a timed day goes to details and sends nothing', async () => {
  const { ui, requests, readDraft } = await open();
  await ready(ui);
  await click(day(ui, MON_5));
  await click(ui.getByRole('button', { name: 'Sam, 10:00' }));
  await click(ui.getByRole('button', { name: 'Continue' }));
  assert.ok(await ui.findByText('At /book/north/details'));
  const saved = readDraft();
  assert.deepEqual([saved.date, saved.mechanicId, saved.startTime], ['2026-10-05', 3, '10:00']);
  assert.ok(requests.every((r) => r.method === 'GET'), JSON.stringify(requests));
});

test('Continue on a drop-off day with "Any mechanic" saves the first bookable mechanic in the shop\'s order', async () => {
  const { ui, readDraft } = await open();
  await ready(ui);
  await click(day(ui, TUE_6));
  await click(ui.getByRole('button', { name: 'Continue' }));
  assert.ok(await ui.findByText('At /book/north/details'));
  const saved = readDraft();
  assert.deepEqual([saved.date, saved.mechanicId, saved.startTime], ['2026-10-06', 2, undefined]);
});

test('opens on the month of a saved day, with that day and time still picked', async () => {
  const { ui } = await open({ draft: { serviceIds: [11, 12], date: '2026-11-02', mechanicId: 3, startTime: '09:00' } });
  await ready(ui, 'November 2026');
  assert.equal(day(ui, dayName('2026-11-02')).getAttribute('aria-pressed'), 'true');
  assert.equal(ui.getByRole('button', { name: 'Sam, 09:00' }).getAttribute('aria-pressed'), 'true');
  assert.equal(pinnedSummary().textContent, 'Monday 2 November, 09:00 with Sam');
});

test('with the problem screen unfinished it goes back to problem, and asks for no free days', async () => {
  current = await renderBookScreen({
    file: 'screens/book/date.js', exportName: 'DateScreen', at: 'date', url: '/book/north/date',
    services: SERVICES, mechanics: MECHANICS, availability: AVAILABILITY, draft: { serviceIds: [13] },
  });
  assert.ok(await current.ui.findByText('At /book/north/problem'));
  assert.ok(current.requests.every((r) => r.url.endsWith('/api/portal/north/services')), JSON.stringify(current.requests));
});

// Controller ruling (26 Sep): if the ticked services' total minutes is 0
// because every one of them has since left /services (removed from the
// shop's list), the server refuses minutes=0, so the screen goes back to
// /services instead of asking for availability.
test('every ticked service has left /services: minutes is 0, so it redirects to services instead of asking for availability', async () => {
  current = await renderBookScreen({
    file: 'screens/book/date.js', exportName: 'DateScreen', at: 'date', url: '/book/north/date',
    services: SERVICES, mechanics: MECHANICS, availability: AVAILABILITY, draft: { serviceIds: [999] },
  });
  assert.ok(await current.ui.findByText('At /book/north/services'));
  assert.ok(current.requests.every((r) => !r.url.includes('/availability')), JSON.stringify(current.requests));
});
