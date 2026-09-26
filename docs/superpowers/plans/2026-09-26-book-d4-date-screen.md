# Book (d4): the date screen - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the third customer booking screen, `date` (`/book/:shopSlug/date`). The customer picks a day on a month calendar (this month and next). On a timed day they pick a mechanic and start time on the one-day diary; on a drop-off day they see the drop-off window and pick a mechanic (default "Any mechanic"). Continue checks the choice and goes to `/book/:shopSlug/details`.

**Architecture:**
- Two new data hooks in `src/screens/book/date-query.ts`, beside `services-query.ts`: `useMechanics` (`GET /api/portal/:shopSlug/mechanics`) and `useAvailability` (`GET /api/portal/:shopSlug/availability?start&end&minutes`), with their response types.
- The rules are pure functions in `src/screens/book/date-rules.ts`: the range asked for, the job length, which days are free, the diary's columns, whether a saved choice is still free, "Any mechanic", the summary, and the Continue message. No React.
- The screen, `src/screens/book/date.tsx`, only calls those rules. It renders in d2's `BookFrame`. Once `/services` has loaded it is guarded by `RequireDraft` with `hasProblem` and a new redirect target, `problem`. It reads and writes the booking through `useDraft()`.
- `RequireDraft` gains an optional `to` (default: the first screen, as today). `hasDate(draft)` is added to `require-draft.tsx` and tested here. d5 applies it.
- d4 is client-only. It never POSTs. The tests answer `/services`, `/mechanics` and `/availability` with mocks.

**Tech Stack:**
- React 19, TypeScript, react-router 8, @tanstack/react-query 5
- Registry controls already installed in `src/components/ui/`: `MonthCalendar`, `DayDiary`, `PillGroup`, `Button`
- Tailwind classes using only existing `--wh-*` / `--accent*` variables
- Tests: `node:test` + jsdom + @testing-library/react against `.test-build/` (built by `npm run pretest`), and Playwright (`npm run test:browser`)

**Spec:** `docs/superpowers/specs/2026-09-26-book-d4-date-screen-design.md`. It relies on **server piece 10** (PR #83, branch `feat/book-server-10-notice-timezone`; spec `docs/superpowers/specs/2026-09-26-book-server-10-notice-timezone-design.md` on that branch), which "must merge first". The availability contract used here is read from that branch's `server/server.js` (`GET /api/portal/:shopSlug/availability`, ~:4663) and `server/capacity.js`. Piece (c)'s spec (`docs/superpowers/specs/2026-09-26-book-c-form-controls-design.md`, decisions 4, 5 and 7 and the `pill-group` / `month-calendar` / `day-diary` rows) describes the controls.

## Global Constraints

- Branch `feat/book-d4-date-screen`, at `e7451d4` (origin/main `8e8db72` with the d4 spec commit). Never commit to `main`.
- **Server piece 10 (PR #83) must merge before the d4 PR is merged** (spec: "which must merge first"). Tasks 1-5 don't depend on it at runtime: every test mocks the server. Task 6 checks the PR, merges `origin/main` into this branch if #83 has merged, and reports it.
- Customer component tests run against the build. After changing anything in `src/`, run `npm run pretest` before `node --test tests/customer/<file>.test.js`. `npm test` does both.
- Postgres (compose, port 5433) must be running for `npm test` and Playwright.
- Create no files in the repo other than those this plan names. Don't commit `.claude/launch.json` (untracked; always `git add` named paths). No scratch, debug or screenshot files in the repo; use `/tmp`.
- Every new test is watched failing for the right reason before the code that passes it. Each task has a mutation step that proves a test bites: make the mutation, show it in `git diff`, run, confirm the named test fails, restore it, confirm `git diff` no longer shows it, and re-run to PASS.
- jsdom tests:
  - Compare DOM nodes with `assert.ok(a === b)`, never `assert.equal`.
  - Clear the React Query client in `afterEach`.
  - A test that renders twice must call `ui.unmount()` before `client.clear()` and `uninstall()`.
  - Every test file must exit within seconds. Never leave a fetch pending: `tests/helpers/book-screen.js` answers `/services`, `/mechanics` and `/availability` at once (Task 3 extends it). A test that holds a response back must release it before the test ends. Time each new file: `time node --test <file>` should report under 10 s.
  - BookFrame calls `window.scrollTo`, which jsdom lacks. The helper stubs it.
  - The date screen reads "today" from the device clock. The screen tests pin **only `Date`** with `mock.timers.enable({ apis: ['Date'], now: ... })` from `node:test` and call `mock.timers.reset()` in `afterEach`. Timers stay real.
- Never hand-edit `src/components/ui/`. No control changes are needed. The controls' real props:
  - `MonthCalendar`: `{ month: 'YYYY-MM', onMonthChange(month), available: ReadonlySet<'YYYY-MM-DD'>, value?: string | null, onChange(date), className? }`. Its day buttons are named like "Monday 5 October 2026" (`aria-disabled="true"` when not available, `aria-pressed`); its grid is a `group` named like "October 2026"; it has "Previous month" / "Next month" buttons and an `h2`.
  - `DayDiary`: `{ open: 'HH:MM', close: 'HH:MM', columns: { id: string; name: string; busy: { start; end }[]; startTimes: string[] }[], value?: { columnId; time } | null, onChange({ columnId, time }), className? }`. Each column is a `group` named by the mechanic; each start time is a button named "<name>, <HH:MM>" with `aria-pressed`; busy time is a grey block reading "Unavailable". `DiaryColumn` is an exported type.
  - `PillGroup`: single `{ legend, options: { value, label, disabled? }[], value: string | null, onChange(value: string) }` (radios) or `{ multiple: true, value: string[], onChange(values: string[]) }` (checkboxes). A `fieldset` named by its legend. `PillOption` is an exported type.
  - `Button`: `variant="accent"`, any `<button>` props.
- Colours: only existing variables from `src/styles/theme.css`: `--wh-danger`, `--wh-muted`, `--wh-warn-bg`, `--wh-warn-ink`. Lint bans hex colours, including hex fallbacks inside `var()`.
- Copy is verbatim from the spec:
  - "When can you drop in?" (h1), "Continue" (action), step 3, Back to `/book/:shopSlug/problem`
  - "Mechanic" (the drop-off pill legend; also used for the timed pills, decision 5)
  - "Any mechanic"
  - "Drop off between <start> and <end>"
  - "We'll confirm once the shop has looked at your request"
  - Summary, timed: "<Weekday> <d> <Month>, <HH:MM> with <mechanic>", e.g. "Monday 5 October, 09:30 with Alex"
  - Summary, drop-off: "<Weekday> <d> <Month>, drop off <start>–<end>" (an en dash, U+2013), e.g. "Tuesday 6 October, drop off 08:30–10:00"
  - "Choose a day", "Choose a time"
  - "That time has just been taken - please choose another" (a hyphen)
  - "There are no free days in the next two months - please contact the shop" (a hyphen)
  - "Loading…" and "Try again" (BookFrame's states). The line above "Try again", "We couldn't load the free days", is **not** in the spec (decision 11): Jack approves it on the PR.
- Data:
  - Job length: the ticked services' summed `minutes` (`totalMinutes` in `service-selection.ts`), or **60** for "Not sure" (the server's "not sure hour", `server/server.js` booking route: `request.notSure ? 60 : ...`).
  - Range: the device's local today to the last day of next month. Never more than **62** days (the server's `MAX_RANGE_DAYS`).
  - `mechanicId` in the draft is always a real mechanic. "Any mechanic" is resolved on Continue and never stored. A drop-off day stores no `startTime`.
- Navigation: Continue goes to `/book/:shopSlug/details` (still a placeholder). Back goes to `/book/:shopSlug/problem`. The guard sends a customer who fails `hasProblem` to `/book/:shopSlug/problem`.
- `RequireDraft`'s existing callers (`service-list`, `problem`) keep their behaviour: with no `to`, it still redirects to `/book/:shopSlug`. The existing `tests/customer/require-draft.test.js` cases prove it.
- `hasProblem(draft, services)` needs `/services` data, so the date screen applies it only after `/services` has loaded; before that only the frame shows.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- No dependency, CI or server changes. Don't edit the atlas mock-up (`docs/design/release-1-journey/screens.js`); the spec's "Changes" list records where d4 departs from it.

## Files

- Create `src/screens/book/date-query.ts`: response types, address builders, `useMechanics`, `useAvailability`.
- Create `src/screens/book/date-rules.ts`: the rules.
- Create `tests/customer/date-rules.test.js`.
- Modify `src/screens/book/require-draft.tsx`: `RequireDraft`'s `to`, and `hasDate`.
- Modify `src/screens/book/draft.tsx`: comments on `date` / `mechanicId` / `startTime` only.
- Modify `tests/customer/require-draft.test.js`.
- Modify `tests/helpers/book-screen.js`: answer `/mechanics` and `/availability`, add a `details` route.
- Create `src/screens/book/date.tsx` and `tests/customer/date-screen.test.js`.
- Modify `src/customer/app-shell.tsx`: `SCREENS`.
- Create `tests/browser/book-date.spec.ts`.
- Modify `.agents/STATUS.md`.
- Modify this plan: the decision log and the spec walk at the end.

---

### Task 1: The data hooks and the date rules

**Files:**
- Create: `src/screens/book/date-query.ts`
- Create: `src/screens/book/date-rules.ts`
- Test: `tests/customer/date-rules.test.js`

**Interfaces:**
- Consumes:
  - `ServicesResponse` from `./services-query.ts`
  - `totalMinutes(data, ticked): number` from `./service-selection.ts`
  - `BookingDraft` from `./draft.tsx` (`date?: string; mechanicId?: number; startTime?: string; serviceIds?: number[]; notSure?: boolean`)
  - `apiGet<T>(path)` from `@/lib/api/client.ts`
  - types `DiaryColumn` from `@/components/ui/day-diary` and `PillOption` from `@/components/ui/pill-group`
- Produces, from `date-query.ts` (all exported):
  - `type PortalMechanic = { id: number; name: string; workingDays: number[] }`
  - `type MechanicsResponse = { mechanics: PortalMechanic[]; openingTime: string; closingTime: string; openingDays: number[] }`
  - `type BusyBlock = { mechanicId: number; jobDate: string; startTime: string; endTime: string }`
  - `type TimedDay = { date: string; mode: 'timed'; mechanics: { mechanicId: number; startTimes: string[] }[] }`
  - `type DropoffDay = { date: string; mode: 'dropoff'; dropoffWindow: { start: string; end: string }; mechanics: { mechanicId: number; bookable: boolean }[] }`
  - `type AvailabilityDay = TimedDay | DropoffDay`
  - `type AvailabilityResponse = { busy: BusyBlock[]; fullDays: { mechanicId: number; jobDate: string }[]; days: AvailabilityDay[] }`
  - `type AvailabilityQuery = { start: string; end: string; minutes: number }`
  - `mechanicsPath(shopSlug): string`, `availabilityPath(shopSlug, q: AvailabilityQuery): string`
  - `useMechanics(shopSlug)` (query key `['portal', shopSlug, 'mechanics']`), `useAvailability(shopSlug, q)` (query key `['portal', shopSlug, 'availability', q.start, q.end, q.minutes]`)
- Produces, from `date-rules.ts` (all exported):
  - `NOT_SURE_MINUTES = 60`, `ANY_MECHANIC = 'any'`
  - `type BookingRange = { start: string; end: string; months: [string, string] }`
  - `jobMinutes(services: ServicesResponse, draft: BookingDraft): number`
  - `localToday(now: Date): string`
  - `bookingRange(today: string): BookingRange`
  - `availableDays(availability: AvailabilityResponse): Set<string>`
  - `pickedDay(availability, date: string | undefined): AvailabilityDay | undefined` (only a free day)
  - `initialMonth(range: BookingRange, draft: BookingDraft, available: ReadonlySet<string>): string`
  - `diaryColumns(availability, day: TimedDay, mechanics: PortalMechanic[], shown: number[], hours: { open: string; close: string }): DiaryColumn[]`
  - `dropoffOptions(day: DropoffDay, mechanics: PortalMechanic[]): PillOption[]`
  - `resolveMechanic(day: DropoffDay, mechanics: PortalMechanic[]): number | null`
  - `choiceStillFree(availability, draft: BookingDraft): boolean`
  - `dayLabel(date: string): string` ("Monday 5 October")
  - `summaryText(availability, draft, mechanics: PortalMechanic[]): string`
  - `continueMessage(availability, draft): string | null`

- [ ] **Step 1: Write the failing rules test** `tests/customer/date-rules.test.js`

```js
// The date screen's rules: the range asked for, the job length, which days
// are free, the diary's columns, whether a saved choice is still free,
// "Any mechanic", the summary and the Continue message.
// Spec: docs/superpowers/specs/2026-09-26-book-d4-date-screen-design.md
import test from 'node:test';
import assert from 'node:assert/strict';

const BUILD = new URL('../../.test-build/screens/book/', import.meta.url);
const r = await import(new URL('date-rules.js', BUILD).href);
const q = await import(new URL('date-query.js', BUILD).href);

// The shop's mechanics in its order (the server orders them by name).
const MECHANICS = [
  { id: 1, name: 'Alex', workingDays: [1, 2, 3, 4, 5] },
  { id: 2, name: 'Jo', workingDays: [1, 2, 3, 4, 5] },
  { id: 3, name: 'Sam', workingDays: [1, 2, 3, 4, 5] },
];
const HOURS = { open: '09:00', close: '17:00' };
const TIMED = {
  date: '2026-10-05', mode: 'timed', mechanics: [
    { mechanicId: 1, startTimes: ['09:00', '09:30', '14:00'] },
    { mechanicId: 2, startTimes: [] },
    { mechanicId: 3, startTimes: ['10:00'] },
  ],
};
const DROPOFF = {
  date: '2026-10-06', mode: 'dropoff', dropoffWindow: { start: '08:30', end: '10:00' }, mechanics: [
    { mechanicId: 1, bookable: false }, { mechanicId: 2, bookable: true }, { mechanicId: 3, bookable: true },
  ],
};
const FULL_TIMED = { date: '2026-10-07', mode: 'timed', mechanics: MECHANICS.map((m) => ({ mechanicId: m.id, startTimes: [] })) };
const FULL_DROPOFF = {
  date: '2026-10-08', mode: 'dropoff', dropoffWindow: { start: '08:30', end: '10:00' },
  mechanics: MECHANICS.map((m) => ({ mechanicId: m.id, bookable: false })),
};
const AV = {
  busy: [
    { mechanicId: 1, jobDate: '2026-10-05', startTime: '10:00', endTime: '12:00' },
    { mechanicId: 3, jobDate: '2026-10-05', startTime: '09:00', endTime: '10:00' },
    { mechanicId: 1, jobDate: '2026-10-06', startTime: '09:00', endTime: '11:00' },
  ],
  fullDays: [],
  days: [TIMED, DROPOFF, FULL_TIMED, FULL_DROPOFF],
};

test("today is the device's own date", () => {
  assert.equal(r.localToday(new Date(2026, 9, 5, 23, 30)), '2026-10-05');
  assert.equal(r.localToday(new Date(2027, 0, 1, 0, 5)), '2027-01-01');
});

test('the range is today to the last day of next month', () => {
  assert.deepEqual(r.bookingRange('2026-10-05'), { start: '2026-10-05', end: '2026-11-30', months: ['2026-10', '2026-11'] });
  assert.deepEqual(r.bookingRange('2026-12-31'), { start: '2026-12-31', end: '2027-01-31', months: ['2026-12', '2027-01'] });
  assert.deepEqual(r.bookingRange('2027-01-30'), { start: '2027-01-30', end: '2027-02-28', months: ['2027-01', '2027-02'] });
});

test('the range never asks for more than the server allows (62 days)', () => {
  const days = ({ start, end }) => (Date.parse(end) - Date.parse(start)) / 86400000 + 1;
  assert.equal(days(r.bookingRange('2026-07-01')), 62);
  assert.equal(days(r.bookingRange('2026-12-01')), 62);
});

test("the job length is the ticked services' minutes, or an hour for Not sure", () => {
  const services = {
    shopName: 'North Street Cycles', showPrices: false, full: [], categories: [],
    uncategorised: [
      { id: 11, name: 'Brake service', price: null, minutes: 30, questions: [] },
      { id: 12, name: 'Gear service', price: null, minutes: 45, questions: [] },
    ],
  };
  assert.equal(r.jobMinutes(services, { serviceIds: [11, 12] }), 75);
  assert.equal(r.jobMinutes(services, { notSure: true }), 60);
  assert.equal(r.NOT_SURE_MINUTES, 60);
});

test('a day is free when a mechanic has a start time (timed) or is bookable (drop-off)', () => {
  assert.deepEqual([...r.availableDays(AV)].sort(), ['2026-10-05', '2026-10-06']);
  assert.equal(r.availableDays({ busy: [], fullDays: [], days: [FULL_TIMED, FULL_DROPOFF] }).size, 0);
});

test('the picked day is the saved date only while it is free', () => {
  assert.ok(r.pickedDay(AV, '2026-10-05') === TIMED);
  assert.ok(r.pickedDay(AV, '2026-10-06') === DROPOFF);
  assert.equal(r.pickedDay(AV, '2026-10-07'), undefined);
  assert.equal(r.pickedDay(AV, '2026-09-30'), undefined);
  assert.equal(r.pickedDay(AV, undefined), undefined);
});

test("the calendar opens on the saved day's month, else the first free day's, else this month", () => {
  const range = r.bookingRange('2026-10-05');
  assert.equal(r.initialMonth(range, { date: '2026-11-02' }, new Set(['2026-10-06', '2026-11-02'])), '2026-11');
  assert.equal(r.initialMonth(range, {}, new Set(['2026-11-02'])), '2026-11');
  assert.equal(r.initialMonth(range, { date: '2026-11-03' }, new Set(['2026-10-06'])), '2026-10');
  assert.equal(r.initialMonth(range, {}, new Set()), '2026-10');
});

test("the diary has a column per shown mechanic, in the shop's order, with that day's busy time and start times", () => {
  assert.deepEqual(r.diaryColumns(AV, TIMED, MECHANICS, [3, 1], HOURS), [
    { id: '1', name: 'Alex', busy: [{ start: '10:00', end: '12:00' }], startTimes: ['09:00', '09:30', '14:00'] },
    { id: '3', name: 'Sam', busy: [{ start: '09:00', end: '10:00' }], startTimes: ['10:00'] },
  ]);
});

test('a mechanic with no start time that day is unavailable all day, not blank', () => {
  assert.deepEqual(r.diaryColumns(AV, TIMED, MECHANICS, [2], HOURS),
    [{ id: '2', name: 'Jo', busy: [{ start: '09:00', end: '17:00' }], startTimes: [] }]);
  const samMissing = { ...TIMED, mechanics: TIMED.mechanics.filter((m) => m.mechanicId !== 3) };
  assert.deepEqual(r.diaryColumns(AV, samMissing, MECHANICS, [3], HOURS)[0].busy, [{ start: '09:00', end: '17:00' }]);
});

test("the drop-off choice is \"Any mechanic\", then each mechanic, those who can't take the job disabled", () => {
  assert.deepEqual(r.dropoffOptions(DROPOFF, MECHANICS), [
    { value: 'any', label: 'Any mechanic' },
    { value: '1', label: 'Alex', disabled: true },
    { value: '2', label: 'Jo', disabled: false },
    { value: '3', label: 'Sam', disabled: false },
  ]);
  assert.equal(r.ANY_MECHANIC, 'any');
});

test("\"Any mechanic\" becomes the first bookable mechanic in the shop's order", () => {
  assert.equal(r.resolveMechanic(DROPOFF, MECHANICS), 2);
  assert.equal(r.resolveMechanic(FULL_DROPOFF, MECHANICS), null);
});

test('a saved choice is still free only while the same day, mechanic and time are offered', () => {
  const free = (draft) => r.choiceStillFree(AV, draft);
  assert.equal(free({}), true, 'nothing saved');
  assert.equal(free({ date: '2026-10-05' }), true, 'a timed day with no time yet');
  assert.equal(free({ date: '2026-10-05', mechanicId: 1, startTime: '09:30' }), true);
  assert.equal(free({ date: '2026-10-05', mechanicId: 1, startTime: '11:00' }), false, 'that time has gone');
  assert.equal(free({ date: '2026-10-05', mechanicId: 2, startTime: '09:00' }), false, "not that mechanic's time");
  assert.equal(free({ date: '2026-10-05', mechanicId: 1 }), false, 'a mechanic with no time on a timed day');
  assert.equal(free({ date: '2026-10-07', mechanicId: 1, startTime: '09:00' }), false, 'the day is now full');
  assert.equal(free({ date: '2026-10-01' }), false, 'a day no longer offered (past)');
  assert.equal(free({ date: '2026-10-06' }), true, 'drop-off, Any mechanic');
  assert.equal(free({ date: '2026-10-06', mechanicId: 3 }), true);
  assert.equal(free({ date: '2026-10-06', mechanicId: 1 }), false, 'that mechanic can no longer take it');
  assert.equal(free({ date: '2026-10-06', mechanicId: 3, startTime: '09:00' }), false, 'the day changed to drop-off');
});

test('the summary: the day, then the time and mechanic (timed) or the drop-off window', () => {
  const s = (draft) => r.summaryText(AV, draft, MECHANICS);
  assert.equal(s({}), '');
  assert.equal(s({ date: '2026-10-07' }), '', 'a day that is not free shows nothing');
  assert.equal(s({ date: '2026-10-05' }), 'Monday 5 October');
  assert.equal(s({ date: '2026-10-05', mechanicId: 1, startTime: '09:30' }), 'Monday 5 October, 09:30 with Alex');
  assert.equal(s({ date: '2026-10-06' }), 'Tuesday 6 October, drop off 08:30–10:00');
  assert.equal(s({ date: '2026-10-06', mechanicId: 3 }), 'Tuesday 6 October, drop off 08:30–10:00');
  assert.equal(r.dayLabel('2026-11-02'), 'Monday 2 November');
});

test('the Continue message: a day first, then a time on a timed day', () => {
  const m = (draft) => r.continueMessage(AV, draft);
  assert.equal(m({}), 'Choose a day');
  assert.equal(m({ date: '2026-10-07' }), 'Choose a day');
  assert.equal(m({ date: '2026-10-05' }), 'Choose a time');
  assert.equal(m({ date: '2026-10-05', mechanicId: 1, startTime: '09:30' }), null);
  assert.equal(m({ date: '2026-10-06' }), null, 'drop-off: Any mechanic is fine');
});

test('the addresses carry the shop, the range and the job length', () => {
  assert.equal(
    q.availabilityPath('north shop', { start: '2026-10-05', end: '2026-11-30', minutes: 75 }),
    '/api/portal/north%20shop/availability?start=2026-10-05&end=2026-11-30&minutes=75',
  );
  assert.equal(q.mechanicsPath('north'), '/api/portal/north/mechanics');
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm run pretest && node --test tests/customer/date-rules.test.js`
Expected: FAIL. The top-level import rejects with `ERR_MODULE_NOT_FOUND` for `date-rules.js`.

- [ ] **Step 3: Write** `src/screens/book/date-query.ts`

```ts
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client.ts';

/**
 * The date screen's data (d4), shared through React Query like /services.
 * Shapes match server/server.js on server piece 10
 * (GET /api/portal/:shopSlug/mechanics and /availability) and
 * server/capacity.js. With `minutes`, /availability returns `days`: per date
 * the shop's mode, and per mechanic the start times (timed) or whether the job
 * fits (drop-off). Nothing earlier than the shop's minimum notice is offered
 * (piece 10). `busy` is the old page's view: booked time, closures and a
 * shorter day, with no reason attached.
 * Spec: docs/superpowers/specs/2026-09-26-book-d4-date-screen-design.md
 */
export type PortalMechanic = { id: number; name: string; workingDays: number[] };

export type MechanicsResponse = {
  mechanics: PortalMechanic[];
  // The shop's widest hours; a shorter day comes back from /availability as busy time.
  openingTime: string;
  closingTime: string;
  openingDays: number[];
};

export type BusyBlock = { mechanicId: number; jobDate: string; startTime: string; endTime: string };

export type TimedDay = { date: string; mode: 'timed'; mechanics: { mechanicId: number; startTimes: string[] }[] };

export type DropoffDay = {
  date: string;
  mode: 'dropoff';
  dropoffWindow: { start: string; end: string };
  mechanics: { mechanicId: number; bookable: boolean }[];
};

export type AvailabilityDay = TimedDay | DropoffDay;

export type AvailabilityResponse = {
  busy: BusyBlock[];
  fullDays: { mechanicId: number; jobDate: string }[];
  days: AvailabilityDay[];
};

export type AvailabilityQuery = { start: string; end: string; minutes: number };

export const mechanicsPath = (shopSlug: string) => `/api/portal/${encodeURIComponent(shopSlug)}/mechanics`;

export const availabilityPath = (shopSlug: string, q: AvailabilityQuery) =>
  `/api/portal/${encodeURIComponent(shopSlug)}/availability?${new URLSearchParams({
    start: q.start,
    end: q.end,
    minutes: String(q.minutes),
  })}`;

export function useMechanics(shopSlug: string) {
  return useQuery({
    queryKey: ['portal', shopSlug, 'mechanics'],
    queryFn: () => apiGet<MechanicsResponse>(mechanicsPath(shopSlug)),
  });
}

export function useAvailability(shopSlug: string, q: AvailabilityQuery) {
  return useQuery({
    queryKey: ['portal', shopSlug, 'availability', q.start, q.end, q.minutes],
    queryFn: () => apiGet<AvailabilityResponse>(availabilityPath(shopSlug, q)),
  });
}
```

- [ ] **Step 4: Write** `src/screens/book/date-rules.ts`

```ts
import type { DiaryColumn } from '@/components/ui/day-diary';
import type { PillOption } from '@/components/ui/pill-group';
import type { BookingDraft } from './draft.tsx';
import type { ServicesResponse } from './services-query.ts';
import type { AvailabilityDay, AvailabilityResponse, DropoffDay, PortalMechanic, TimedDay } from './date-query.ts';
import { totalMinutes } from './service-selection.ts';

/**
 * The date screen's rules, kept apart from the screen so they can be tested
 * directly: the range asked for, the job length, which days are free, the
 * diary's columns, whether a saved choice is still free, "Any mechanic", the
 * summary and the Continue message. The screen only calls these.
 * Spec: docs/superpowers/specs/2026-09-26-book-d4-date-screen-design.md
 */

// The server's "not sure hour" (server/server.js, the booking route).
export const NOT_SURE_MINUTES = 60;
// The drop-off pill for "Any mechanic". Never stored: resolved on Continue.
export const ANY_MECHANIC = 'any';

export type BookingRange = { start: string; end: string; months: [string, string] };
type Hours = { open: string; close: string };

export function jobMinutes(services: ServicesResponse, draft: BookingDraft): number {
  return draft.notSure ? NOT_SURE_MINUTES : totalMinutes(services, draft.serviceIds ?? []);
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * The device's own date. The client can't know the shop's time zone; the
 * server (piece 10) offers nothing before the shop's earliest bookable moment,
 * so a device a day ahead or behind only widens or narrows the request.
 */
export function localToday(now: Date): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Today to the last day of next month ("about two months ahead"): at most 62 days, the server's limit. */
export function bookingRange(today: string): BookingRange {
  const [y, m] = today.split('-').map(Number);
  // Day 0 of the month after next is the last day of next month.
  const end = new Date(Date.UTC(y, m + 1, 0)).toISOString().slice(0, 10);
  return { start: today, end, months: [today.slice(0, 7), end.slice(0, 7)] };
}

function hasRoom(day: AvailabilityDay): boolean {
  return day.mode === 'timed'
    ? day.mechanics.some((m) => m.startTimes.length > 0)
    : day.mechanics.some((m) => m.bookable);
}

/** Days with at least one mechanic who has a start time (timed) or is bookable (drop-off). */
export function availableDays(availability: AvailabilityResponse): Set<string> {
  return new Set(availability.days.filter(hasRoom).map((d) => d.date));
}

/** The saved day, only while it is free. */
export function pickedDay(availability: AvailabilityResponse, date: string | undefined): AvailabilityDay | undefined {
  if (!date) return undefined;
  const day = availability.days.find((d) => d.date === date);
  return day && hasRoom(day) ? day : undefined;
}

/** The saved day's month, else the first free day's, else this month. */
export function initialMonth(range: BookingRange, draft: BookingDraft, available: ReadonlySet<string>): string {
  const inRange = (date: string) => range.months.includes(date.slice(0, 7));
  if (draft.date && available.has(draft.date) && inRange(draft.date)) return draft.date.slice(0, 7);
  const first = [...available].filter(inRange).sort()[0];
  return first ? first.slice(0, 7) : range.months[0];
}

/**
 * One diary column per shown mechanic, in the shop's order. A mechanic with no
 * start time that day (not working, fully booked, or no gap long enough) is
 * one busy block from open to close: a blank column would read as free time.
 */
export function diaryColumns(
  availability: AvailabilityResponse,
  day: TimedDay,
  mechanics: PortalMechanic[],
  shown: number[],
  hours: Hours,
): DiaryColumn[] {
  return mechanics
    .filter((m) => shown.includes(m.id))
    .map((m) => {
      const startTimes = day.mechanics.find((x) => x.mechanicId === m.id)?.startTimes ?? [];
      const busy = startTimes.length === 0
        ? [{ start: hours.open, end: hours.close }]
        : availability.busy
          .filter((b) => b.mechanicId === m.id && b.jobDate === day.date)
          .map((b) => ({ start: b.startTime, end: b.endTime }));
      return { id: String(m.id), name: m.name, busy, startTimes };
    });
}

const bookableOn = (day: DropoffDay, mechanicId: number) =>
  day.mechanics.some((m) => m.mechanicId === mechanicId && m.bookable);

/** "Any mechanic", then each mechanic in the shop's order; those who can't take the job that day disabled. */
export function dropoffOptions(day: DropoffDay, mechanics: PortalMechanic[]): PillOption[] {
  return [
    { value: ANY_MECHANIC, label: 'Any mechanic' },
    ...mechanics.map((m) => ({ value: String(m.id), label: m.name, disabled: !bookableOn(day, m.id) })),
  ];
}

/** "Any mechanic" on Continue: the first bookable mechanic in the shop's order. */
export function resolveMechanic(day: DropoffDay, mechanics: PortalMechanic[]): number | null {
  return mechanics.find((m) => bookableOn(day, m.id))?.id ?? null;
}

/**
 * Whether the saved day, mechanic and time are still offered. Nothing saved
 * counts as free (nothing to clear). A timed day with only a day saved is
 * free while the day is; a mechanic and time must still be that mechanic's
 * start time. A drop-off day holds no time, and a chosen mechanic must still
 * be bookable. A day whose mode changed counts as taken.
 */
export function choiceStillFree(availability: AvailabilityResponse, draft: BookingDraft): boolean {
  if (draft.date === undefined) return true;
  const day = pickedDay(availability, draft.date);
  if (!day) return false;
  if (day.mode === 'timed') {
    if (draft.mechanicId === undefined && draft.startTime === undefined) return true;
    const time = draft.startTime;
    return time !== undefined && day.mechanics.some((m) => m.mechanicId === draft.mechanicId && m.startTimes.includes(time));
  }
  if (draft.startTime !== undefined) return false;
  return draft.mechanicId === undefined || bookableOn(day, draft.mechanicId);
}

const DAY_LABEL = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

/** "Monday 5 October". Worked in UTC, like the calendar, so no time zone can shift the day. */
export function dayLabel(date: string): string {
  return DAY_LABEL.format(new Date(`${date}T00:00:00Z`));
}

/** The pinned summary; empty until a free day is picked. */
export function summaryText(availability: AvailabilityResponse, draft: BookingDraft, mechanics: PortalMechanic[]): string {
  const day = pickedDay(availability, draft.date);
  if (!day) return '';
  const when = dayLabel(day.date);
  if (day.mode === 'dropoff') return `${when}, drop off ${day.dropoffWindow.start}–${day.dropoffWindow.end}`;
  const name = mechanics.find((m) => m.id === draft.mechanicId)?.name;
  return draft.startTime && name ? `${when}, ${draft.startTime} with ${name}` : when;
}

/** Why Continue can't go on yet; null when it can. */
export function continueMessage(availability: AvailabilityResponse, draft: BookingDraft): string | null {
  const day = pickedDay(availability, draft.date);
  if (!day) return 'Choose a day';
  if (day.mode === 'timed' && (draft.mechanicId === undefined || draft.startTime === undefined)) return 'Choose a time';
  return null;
}
```

- [ ] **Step 5: Run and watch it pass**

Run: `npm run pretest && time node --test tests/customer/date-rules.test.js && npm run typecheck && npm run lint`
Expected: all 15 tests PASS, the file exits in seconds, typecheck and lint are clean.

- [ ] **Step 6: Prove the tests bite.** Each time: make the mutation, confirm it in `git diff`, run `npm run pretest && node --test tests/customer/date-rules.test.js`, confirm the named test fails, restore, confirm `git diff` no longer shows it.
  1. In `bookingRange`, change `Date.UTC(y, m + 1, 0)` to `Date.UTC(y, m, 0)`. "the range is today to the last day of next month" must FAIL (end `2026-10-31`).
  2. In `diaryColumns`, change `const busy = startTimes.length === 0` to `const busy = false`. "a mechanic with no start time that day is unavailable all day, not blank" must FAIL.
  3. In `choiceStillFree`, delete the line `if (draft.startTime !== undefined) return false;`. "a saved choice is still free only while ..." must FAIL with the message "the day changed to drop-off".

  Re-run Step 5 to PASS.

- [ ] **Step 7: Commit**

```bash
git add src/screens/book/date-query.ts src/screens/book/date-rules.ts tests/customer/date-rules.test.js
git commit -m "feat: the date screen's rules and its mechanics/availability hooks

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `RequireDraft`'s redirect target, and the `hasDate` guard (added here, applied by d5)

**Files:**
- Modify: `src/screens/book/require-draft.tsx`
- Modify: `src/screens/book/draft.tsx` (comments only)
- Test: `tests/customer/require-draft.test.js`

**Interfaces:**
- Consumes: `BookingDraft`, `useDraft` from `./draft.tsx`.
- Produces:
  - `RequireDraft({ has, to?, children })`. `to` is the part of the address after `/book/<shopSlug>` to send the customer to (e.g. `'problem'`). Omitted or `''`: `/book/<shopSlug>`, as before. Task 3 uses `to="problem"`.
  - `hasDate(draft: BookingDraft): boolean`: `date` is `YYYY-MM-DD`, `mechanicId` is an integer, and `startTime` is either absent or `HH:MM`. d5 wraps `details` in `RequireDraft` with it.

- [ ] **Step 1: Write the failing tests.** In `tests/customer/require-draft.test.js`:
  - Replace the whole `async function renderAt(stored) { ... }` with:

```js
async function renderAt(stored, to) {
  uninstall = installDom('http://localhost/book/north/date');
  if (stored) window.sessionStorage.setItem('wh-book-draft:north', JSON.stringify(stored));
  const { render } = await import('@testing-library/react');
  const { createElement: h } = await import('react');
  const { createMemoryRouter, RouterProvider } = await import('react-router');
  const { RequireDraft, hasService } = await importFresh(GUARD);
  const { DraftProvider } = await import(DRAFT);
  const router = createMemoryRouter([
    { path: '/book/:shopSlug/date', Component: () => h(RequireDraft, { has: hasService, to }, h('p', null, 'Date screen')) },
    { path: '/book/:shopSlug/problem', Component: () => h('p', null, 'Problem screen') },
    { path: '/book/:shopSlug', Component: () => h('p', null, 'First screen') },
  ], { initialEntries: ['/book/north/date'] });
  const ui = render(h(DraftProvider, { shopSlug: 'north' }, h(RouterProvider, { router })));
  return { ui, router };
}
```

  - Append to the end of the file:

```js
// d4: RequireDraft's redirect target (the date screen sends the customer back
// to problem), and hasDate (d4 adds it; d5 applies it).
// Spec: docs/superpowers/specs/2026-09-26-book-d4-date-screen-design.md
test('with a redirect target, a screen opened without its answers goes there instead', async () => {
  const { ui, router } = await renderAt(null, 'problem');
  assert.ok(await ui.findByText('Problem screen'));
  assert.equal(ui.queryByText('First screen'), null);
  assert.equal(router.state.historyAction, 'REPLACE');
});

test('with a redirect target and the answers present, the screen shows', async () => {
  const { ui } = await renderAt({ serviceIds: [7] }, 'problem');
  assert.ok(await ui.findByText('Date screen'));
});

test('hasDate needs a day and a real mechanic, and a start time only when one was chosen', async () => {
  const { hasDate } = await import(GUARD);
  assert.equal(hasDate({ date: '2026-10-05', mechanicId: 1, startTime: '09:30' }), true, 'timed');
  assert.equal(hasDate({ date: '2026-10-06', mechanicId: 2 }), true, 'drop-off: no start time');
  assert.equal(hasDate({}), false);
  assert.equal(hasDate({ date: '2026-10-05' }), false, 'no mechanic ("Any mechanic" is resolved before it is saved)');
  assert.equal(hasDate({ mechanicId: 1, startTime: '09:30' }), false, 'no day');
  assert.equal(hasDate({ date: '5 October', mechanicId: 1 }), false);
  assert.equal(hasDate({ date: '2026-10-05', mechanicId: '1' }), false);
  assert.equal(hasDate({ date: '2026-10-05', mechanicId: 1, startTime: '9.30' }), false);
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npm run pretest && node --test tests/customer/require-draft.test.js`
Expected:
- "with a redirect target, a screen opened without its answers goes there instead" FAILS: `findByText('Problem screen')` times out, because the guard still goes to the first screen.
- "hasDate needs ..." FAILS with `TypeError: hasDate is not a function`.
- Every existing test PASSES, including "a screen that needs a service, opened with none, goes back to the first screen" (the default is unchanged) and "with a redirect target and the answers present" (nothing redirects).

- [ ] **Step 3: Implement.** In `src/screens/book/require-draft.tsx`:
  - Replace the doc comment above `hasService` with:

```tsx
/**
 * A screen that needs earlier answers, opened without them (an old link, a
 * cleared tab), goes back to an earlier book screen instead of breaking: the
 * first screen by default, or `to` (the part of the address after
 * /book/<shopSlug>; d4's date screen uses `problem`).
 * Spec: docs/superpowers/specs/2026-09-26-book-d1-groundwork-design.md
 * d4 (`to`, hasDate): docs/superpowers/specs/2026-09-26-book-d4-date-screen-design.md
 */
```

  - After `hasProblem`, add:

```tsx
const DAY_FORMAT = /^\d{4}-\d{2}-\d{2}$/;
const TIME_FORMAT = /^\d{2}:\d{2}$/;

/**
 * The details screen's guard (d4 adds it; d5 applies it): a day and a real
 * mechanic, plus a start time when one was chosen. A drop-off day holds no
 * start time, and "Any mechanic" is resolved before it is saved.
 */
export const hasDate = (draft: BookingDraft) =>
  typeof draft.date === 'string' &&
  DAY_FORMAT.test(draft.date) &&
  Number.isInteger(draft.mechanicId) &&
  (draft.startTime === undefined || TIME_FORMAT.test(draft.startTime));
```

  - Replace the `RequireDraft` function with:

```tsx
export function RequireDraft({
  has,
  to = '',
  children,
}: {
  has: (draft: BookingDraft) => boolean;
  to?: string;
  children: React.ReactNode;
}) {
  const { draft } = useDraft();
  const { shopSlug = '' } = useParams();
  if (!has(draft)) return <Navigate to={to ? `/book/${shopSlug}/${to}` : `/book/${shopSlug}`} replace />;
  return <>{children}</>;
}
```

- [ ] **Step 4: Comment the draft's date fields.** In `src/screens/book/draft.tsx`, replace the three lines

```ts
  date?: string;
  mechanicId?: number;
  startTime?: string;
```

with:

```ts
  // The date screen (d4): the day, and always a real mechanic ("Any
  // mechanic" is resolved on Continue and never stored). A drop-off day
  // stores no startTime.
  date?: string;
  mechanicId?: number;
  startTime?: string;
```

- [ ] **Step 5: Run and watch them pass**

Run: `npm run pretest && time node --test tests/customer/require-draft.test.js tests/customer/service-list-screen.test.js tests/customer/problem-screen.test.js && npm run typecheck && npm run lint`
Expected: all PASS (the two screen files prove the existing callers still redirect to the first screen), each file exits in seconds, typecheck and lint clean.

- [ ] **Step 6: Prove the tests bite.** Each time: mutate, confirm in `git diff`, run `npm run pretest && node --test tests/customer/require-draft.test.js`, confirm the named failure, restore, confirm `git diff` shows only the intended change.
  1. In `RequireDraft`, change `` to={to ? `/book/${shopSlug}/${to}` : `/book/${shopSlug}`} `` to `` to={`/book/${shopSlug}`} ``. "with a redirect target, a screen opened without its answers goes there instead" must FAIL.
  2. In `hasDate`, delete the last line `&& (draft.startTime === undefined || TIME_FORMAT.test(draft.startTime))` (keep the semicolon on the line before) and the now-unused `TIME_FORMAT` constant. "hasDate needs ..." must FAIL on the `'9.30'` case.

  Re-run Step 5 to PASS.

- [ ] **Step 7: Commit**

```bash
git add src/screens/book/require-draft.tsx src/screens/book/draft.tsx tests/customer/require-draft.test.js
git commit -m "feat: RequireDraft can send the customer to a named screen; hasDate guard for details

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The screen, `date`: calendar, timed and drop-off days, summary, and Continue

**Files:**
- Modify: `tests/helpers/book-screen.js` (answer `/mechanics` and `/availability`; add a `details` route)
- Create: `src/screens/book/date.tsx`
- Modify: `src/customer/app-shell.tsx` (`SCREENS`)
- Test: `tests/customer/date-screen.test.js`

**Interfaces:**
- Consumes:
  - everything Task 1 produces
  - `RequireDraft` (with `to`) and `hasProblem(draft, services)` from `./require-draft.tsx` (Task 2)
  - `BookFrame` with `step`, `title`, `back`, `action`, `actionNote`. Its pinned area carries `data-book-pinned`. It focuses its `h1` and calls `window.scrollTo`.
  - `useDraft()` (`{ draft, update }`) and `useServices(shopSlug)`
- Produces:
  - `export function DateScreen()`. Task 4 replaces its inner `DatePicker`; Task 5's browser test uses the screen.
  - `renderBookScreen` gains `mechanics` and `availability` options. Each of `services`, `mechanics`, `availability` is either a body (answered with 200) or a function `(url: string) => ({ status, body })` (may be `async`). Defaults: no mechanics (`openingTime` `09:00`, `closingTime` `17:00`) and no days. Routes: `''`, `services`, `problem`, `date`, `details`.

- [ ] **Step 1: Update the helper.** Replace `tests/helpers/book-screen.js` with:

```js
// Renders one book screen in jsdom, the way the customer app mounts it: inside
// /book/:shopSlug with the booking-in-progress provider and a query client.
// Every other book address renders "At <path><search>", so a test can see
// where a screen navigated to. Shop slug is always "north".
//
// Every fetch is answered at once and recorded in `requests` ({url, method}),
// so a test can prove a screen sent nothing (d3). /mechanics and
// /availability are answered from `mechanics` and `availability` (d4), and
// everything else from `services`. Each is either a body (sent with 200) or a
// function (url) => ({ status, body }), which may be async - a test that
// holds an answer back must release it before it ends.
// scrollIntoView (missing in jsdom) is recorded in `scrolled`.
import { installDom, importFresh } from './dom.js';

const BUILD = new URL('../../.test-build/', import.meta.url);
const NO_MECHANICS = { mechanics: [], openingTime: '09:00', closingTime: '17:00', openingDays: [] };
const NO_AVAILABILITY = { busy: [], fullDays: [], days: [] };

export async function renderBookScreen({
  file, exportName, at, url, services, draft, mechanics = NO_MECHANICS, availability = NO_AVAILABILITY,
}) {
  const uninstall = installDom(`http://localhost${url}`);
  if (draft) window.sessionStorage.setItem('wh-book-draft:north', JSON.stringify(draft));
  const scrolled = [];
  // Both the frame's scroll-to-top and a screen's own ?start scrollIntoView
  // land here in call order, so a test can prove the frame's runs first (and
  // the screen's own scroll still wins the final position).
  const scrollCalls = [];
  window.scrollTo = (...args) => scrollCalls.push({ type: 'top', args });
  window.HTMLElement.prototype.scrollIntoView = function scrollIntoView() {
    scrollCalls.push({ type: 'start', el: this });
    scrolled.push(this);
  };
  const requests = [];
  globalThis.fetch = async (input, init) => {
    const address = String(input);
    requests.push({ url: address, method: init?.method ?? 'GET' });
    const { pathname } = new URL(address, 'http://localhost');
    const source = pathname.endsWith('/mechanics') ? mechanics
      : pathname.endsWith('/availability') ? availability
        : services;
    const { status, body } = typeof source === 'function' ? await source(address) : { status: 200, body: source };
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  };

  const { render } = await import('@testing-library/react');
  const { createElement: h } = await import('react');
  const { createMemoryRouter, RouterProvider, Outlet, useLocation, useParams } = await import('react-router');
  const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
  const Screen = (await importFresh(new URL(file, BUILD).href))[exportName];
  const { DraftProvider } = await import(new URL('screens/book/draft.js', BUILD).href);

  function Layout() {
    const { shopSlug = '' } = useParams();
    return h(DraftProvider, { shopSlug }, h(Outlet));
  }
  function Where() {
    const l = useLocation();
    return h('p', null, `At ${l.pathname}${l.search}`);
  }
  const child = (path) => (path === '' ? { index: true } : { path });
  const routes = ['', 'services', 'problem', 'date', 'details'].map((p) => ({ ...child(p), Component: p === at ? Screen : Where }));
  const router = createMemoryRouter([{ path: '/book/:shopSlug', Component: Layout, children: routes }], { initialEntries: [url] });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const ui = render(h(QueryClientProvider, { client }, h(RouterProvider, { router })));
  const readDraft = () => JSON.parse(window.sessionStorage.getItem('wh-book-draft:north') ?? '{}');
  return { ui, client, uninstall, scrolled, scrollCalls, requests, readDraft };
}
```

Then run `npm run pretest && node --test tests/customer/service-screen.test.js tests/customer/service-list-screen.test.js tests/customer/problem-screen.test.js` and confirm all PASS: the helper change broke nothing.

- [ ] **Step 2: Write the failing test** `tests/customer/date-screen.test.js`

```js
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
const MON_5 = 'Monday 5 October 2026';
const TUE_6 = 'Tuesday 6 October 2026';

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
  assert.equal(day(ui, 'Wednesday 7 October 2026').getAttribute('aria-disabled'), 'true');
  assert.equal(day(ui, 'Thursday 1 October 2026').getAttribute('aria-disabled'), 'true');
  assert.equal(pinnedSummary().textContent, '');
});

test('only this month and next can be shown', async () => {
  const { ui } = await open();
  await ready(ui);
  await click(ui.getByRole('button', { name: 'Previous month' }));
  assert.ok(ui.getByRole('group', { name: 'October 2026' }));
  await click(ui.getByRole('button', { name: 'Next month' }));
  assert.ok(ui.getByRole('group', { name: 'November 2026' }));
  assert.equal(day(ui, 'Monday 2 November 2026').getAttribute('aria-disabled'), null);
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
  assert.equal(day(ui, 'Monday 2 November 2026').getAttribute('aria-pressed'), 'true');
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
```

- [ ] **Step 3: Run it and watch it fail**

Run: `npm run pretest && node --test tests/customer/date-screen.test.js`
Expected: every test FAILS, because `.test-build/screens/book/date.js` doesn't exist (`ERR_MODULE_NOT_FOUND` from `importFresh`).

- [ ] **Step 4: Implement** `src/screens/book/date.tsx`

```tsx
import * as React from 'react';
import { useNavigate, useParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { DayDiary } from '@/components/ui/day-diary';
import { MonthCalendar } from '@/components/ui/month-calendar';
import { PillGroup } from '@/components/ui/pill-group';
import { BookFrame } from './frame.tsx';
import { useDraft, type BookingDraft } from './draft.tsx';
import { RequireDraft, hasProblem } from './require-draft.tsx';
import { useServices, type ServicesResponse } from './services-query.ts';
import {
  useAvailability, useMechanics, type AvailabilityResponse, type DropoffDay, type MechanicsResponse, type TimedDay,
} from './date-query.ts';
import {
  ANY_MECHANIC, availableDays, bookingRange, continueMessage, diaryColumns, dropoffOptions, initialMonth, jobMinutes,
  localToday, pickedDay, resolveMechanic, summaryText, type BookingRange,
} from './date-rules.ts';

/**
 * The date screen (atlas `date`, step 3): a month calendar for this month and
 * next; on a timed day, mechanic pills and the one-day diary (every mechanic
 * shown, one column each; tapping a free time picks that mechanic and time);
 * on a drop-off day, the drop-off window and a mechanic choice starting on
 * "Any mechanic". A summary is pinned above Continue. Nothing is sent until
 * d5.
 * Spec: docs/superpowers/specs/2026-09-26-book-d4-date-screen-design.md
 */
const TITLE = 'When can you drop in?';

export function DateScreen() {
  const { shopSlug = '' } = useParams();
  const { data } = useServices(shopSlug);
  const back = `/book/${shopSlug}/problem`;
  // hasProblem reads the services' questions, so the guard waits for
  // /services; until then only the frame shows (its own loading and failed
  // states).
  if (!data) return <BookFrame step={3} title={TITLE} back={back}>{null}</BookFrame>;
  return (
    <RequireDraft has={(d) => hasProblem(d, data)} to="problem">
      <DateLoader services={data} back={back} />
    </RequireDraft>
  );
}

function DateLoader({ services, back }: { services: ServicesResponse; back: string }) {
  const { shopSlug = '' } = useParams();
  const { draft } = useDraft();
  // Fixed when the screen opens: the device's date (see localToday).
  const [range] = React.useState(() => bookingRange(localToday(new Date())));
  const mechanics = useMechanics(shopSlug);
  const availability = useAvailability(shopSlug, { start: range.start, end: range.end, minutes: jobMinutes(services, draft) });

  if (mechanics.isError || availability.isError) {
    const retry = () => {
      if (mechanics.isError) void mechanics.refetch();
      if (availability.isError) void availability.refetch();
    };
    return (
      <BookFrame step={3} title={TITLE} back={back}>
        <p role="alert" className="m-0 mb-3">We couldn&apos;t load the free days</p>
        <Button variant="accent" onClick={retry}>Try again</Button>
      </BookFrame>
    );
  }
  if (!mechanics.data || !availability.data) {
    return (
      <BookFrame step={3} title={TITLE} back={back}>
        <p role="status">Loading…</p>
      </BookFrame>
    );
  }
  return <DatePicker range={range} mechanics={mechanics.data} availability={availability.data} back={back} />;
}

type PickerProps = { range: BookingRange; mechanics: MechanicsResponse; availability: AvailabilityResponse; back: string };

function DatePicker({ range, mechanics, availability, back }: PickerProps) {
  const { shopSlug = '' } = useParams();
  const navigate = useNavigate();
  const { draft, update } = useDraft();
  const available = React.useMemo(() => availableDays(availability), [availability]);
  const [month, setMonth] = React.useState(() => initialMonth(range, draft, available));
  // The mechanics whose diary columns show; null means all of them (every
  // mechanic is on when a day is picked).
  const [shown, setShown] = React.useState<number[] | null>(null);
  // The Continue message shows only after a press, then follows the draft.
  const [checked, setChecked] = React.useState(false);
  // Bumped on each failed Continue so the alert is a new node and is
  // announced again (as on the service list).
  const [attempt, setAttempt] = React.useState(0);

  const day = pickedDay(availability, draft.date);
  const message = checked ? continueMessage(availability, draft) : null;

  const pickDay = (date: string) => {
    setChecked(false);
    setShown(null);
    if (date !== draft.date) update({ date, mechanicId: undefined, startTime: undefined });
  };
  const pickTime = (date: string, mechanicId: number, startTime: string) => update({ date, mechanicId, startTime });
  const pickMechanic = (value: string) =>
    update({ mechanicId: value === ANY_MECHANIC ? undefined : Number(value), startTime: undefined });

  const onContinue = () => {
    if (continueMessage(availability, draft) !== null) {
      setChecked(true);
      setAttempt((a) => a + 1);
      return;
    }
    // "Any mechanic" is never stored: it becomes the first bookable mechanic
    // in the shop's order now.
    if (day?.mode === 'dropoff' && draft.mechanicId === undefined) {
      update({ mechanicId: resolveMechanic(day, mechanics.mechanics) ?? undefined });
    }
    navigate(`/book/${shopSlug}/details`);
  };

  return (
    <BookFrame
      step={3}
      title={TITLE}
      back={back}
      action={{ label: 'Continue', onClick: onContinue }}
      actionNote={
        <>
          <p className="m-0 min-h-5" aria-live="polite">{summaryText(availability, draft, mechanics.mechanics)}</p>
          {message && <p key={attempt} role="alert" className="m-0 mt-1 text-[var(--wh-danger)]">{message}</p>}
        </>
      }
    >
      <MonthCalendar
        month={month}
        onMonthChange={(m) => {
          if (range.months.includes(m)) setMonth(m);
        }}
        available={available}
        value={day ? day.date : null}
        onChange={pickDay}
        className="mb-4"
      />
      {day?.mode === 'timed' && (
        <TimedDayPicker
          day={day}
          availability={availability}
          mechanics={mechanics}
          shown={shown ?? mechanics.mechanics.map((m) => m.id)}
          onShow={setShown}
          draft={draft}
          onPick={(mechanicId, startTime) => pickTime(day.date, mechanicId, startTime)}
        />
      )}
      {day?.mode === 'dropoff' && <DropoffDayPicker day={day} mechanics={mechanics} draft={draft} onPick={pickMechanic} />}
    </BookFrame>
  );
}

type TimedProps = {
  day: TimedDay;
  availability: AvailabilityResponse;
  mechanics: MechanicsResponse;
  shown: number[];
  onShow: (ids: number[]) => void;
  draft: BookingDraft;
  onPick: (mechanicId: number, startTime: string) => void;
};

function TimedDayPicker({ day, availability, mechanics, shown, onShow, draft, onPick }: TimedProps) {
  const hours = { open: mechanics.openingTime, close: mechanics.closingTime };
  const picked = draft.mechanicId !== undefined && draft.startTime
    ? { columnId: String(draft.mechanicId), time: draft.startTime }
    : null;
  // The last mechanic on can't be turned off: an empty choice is ignored.
  const onPills = (ids: string[]) => {
    if (ids.length > 0) onShow(ids.map(Number));
  };
  return (
    <>
      <PillGroup
        multiple
        legend="Mechanic"
        options={mechanics.mechanics.map((m) => ({ value: String(m.id), label: m.name }))}
        value={shown.map(String)}
        onChange={onPills}
        className="mb-3"
      />
      <DayDiary
        open={hours.open}
        close={hours.close}
        columns={diaryColumns(availability, day, mechanics.mechanics, shown, hours)}
        value={picked}
        onChange={(v) => onPick(Number(v.columnId), v.time)}
      />
    </>
  );
}

type DropoffProps = { day: DropoffDay; mechanics: MechanicsResponse; draft: BookingDraft; onPick: (value: string) => void };

function DropoffDayPicker({ day, mechanics, draft, onPick }: DropoffProps) {
  return (
    <>
      <p className="m-0">{`Drop off between ${day.dropoffWindow.start} and ${day.dropoffWindow.end}`}</p>
      <p className="m-0 mb-3 text-sm text-[var(--wh-muted)]">{"We'll confirm once the shop has looked at your request"}</p>
      <PillGroup
        legend="Mechanic"
        options={dropoffOptions(day, mechanics.mechanics)}
        value={draft.mechanicId !== undefined ? String(draft.mechanicId) : ANY_MECHANIC}
        onChange={onPick}
      />
    </>
  );
}
```

Notes for the implementer:
- `DateLoader` and `DatePicker` each render their own `BookFrame`, so the frame remounts once the data arrives. That is intended: focus lands on the `h1` when the calendar appears.
- The pinned summary line is always present (empty until a day is picked) so screen readers announce its changes; `min-h-5` stops the pinned area jumping when it fills.
- In `src/customer/app-shell.tsx`, add `import { DateScreen } from '@/screens/book/date.tsx';` after the `ProblemScreen` import, and `date: DateScreen,` to `SCREENS` after `problem: ProblemScreen,`. `grep -n "Not built yet" tests/screens/customer-app-shell.test.js` finds only the `pending` placeholder, so no shell test asserts the date placeholder; Step 5 runs the shell test to confirm.

- [ ] **Step 5: Run and watch it pass**

Run: `npm run pretest && time node --test tests/customer/date-screen.test.js tests/customer/problem-screen.test.js tests/customer/service-screen.test.js tests/customer/service-list-screen.test.js tests/screens/customer-app-shell.test.js && npm run typecheck && npm run lint`

Expected: all PASS, `date-screen.test.js` exits in seconds, typecheck and lint clean. If `customer-app-shell.test.js` fails on a `date` placeholder, change that assertion to the real screen (at `/book/demo/date` with an empty draft the screen redirects to `problem`, which redirects to `/book/demo` and shows "What do you need?") and report the change.

- [ ] **Step 6: Prove three tests bite.** Each time: mutate, confirm in `git diff`, run `npm run pretest && node --test tests/customer/date-screen.test.js`, confirm the named failure, restore, confirm `git diff` no longer shows it.
  1. In `TimedDayPicker`'s `onPills`, change `if (ids.length > 0) onShow(ids.map(Number));` to `onShow(ids.map(Number));`. "the mechanic pills hide columns, but the last one on stays on" must FAIL (Sam's box unchecked).
  2. In `onContinue`, delete the three-line `if (day?.mode === 'dropoff' && draft.mechanicId === undefined) { ... }` block. "Continue on a drop-off day with "Any mechanic" saves the first bookable mechanic ..." must FAIL (`mechanicId` undefined).
  3. In `DateScreen`, delete ` to="problem"`. "with the problem screen unfinished it goes back to problem ..." must FAIL (it lands on `At /book/north`).

  Re-run Step 5 to PASS.

- [ ] **Step 7: Commit**

```bash
git add tests/helpers/book-screen.js src/screens/book/date.tsx src/customer/app-shell.tsx tests/customer/date-screen.test.js
git commit -m "feat: the date screen - calendar, mechanic diary, drop-off choice, summary, Continue

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: A saved choice no longer free, and no free days at all

**Files:**
- Modify: `src/screens/book/date.tsx` (`DatePicker` and the `./date-rules.ts` import)
- Test: `tests/customer/date-screen.test.js`

**Interfaces:**
- Consumes: `choiceStillFree(availability, draft)` (Task 1); `DatePicker` and its props from Task 3.
- Produces: `DatePicker` clears a saved `date`/`mechanicId`/`startTime` that is no longer offered and shows "That time has just been taken - please choose another" above the calendar until the next pick. With no free day in the range it shows "There are no free days in the next two months - please contact the shop" in place of the calendar, and no pinned Continue.

- [ ] **Step 1: Write the failing tests.** Append to `tests/customer/date-screen.test.js`:

```js
const TAKEN = 'That time has just been taken - please choose another';

test('a saved time no longer free is cleared, with a message above the calendar until the next pick', async () => {
  const { ui, readDraft } = await open({ draft: { serviceIds: [11, 12], date: '2026-10-05', mechanicId: 1, startTime: '11:00' } });
  await ready(ui);
  const message = await ui.findByText(TAKEN);
  assert.ok(message.compareDocumentPosition(ui.getByRole('group', { name: 'October 2026' })) & Node.DOCUMENT_POSITION_FOLLOWING,
    'the message is not above the calendar');
  const { waitFor } = await rtl();
  await waitFor(() => {
    const saved = readDraft();
    assert.deepEqual([saved.date, saved.mechanicId, saved.startTime], [undefined, undefined, undefined]);
  });
  assert.equal(pinnedSummary().textContent, '');
  await click(day(ui, TUE_6));
  assert.equal(ui.queryByText(TAKEN), null);
});

test('a picked time taken while the screen is open is cleared when availability is fetched again', async () => {
  let answer = AVAILABILITY;
  const { ui, client, readDraft } = await open({ availability: () => ({ status: 200, body: answer }) });
  await ready(ui);
  await click(day(ui, MON_5));
  await click(ui.getByRole('button', { name: 'Alex, 09:30' }));
  assert.equal(ui.queryByText(TAKEN), null);
  answer = { ...AVAILABILITY, days: [timed('2026-10-05', { 1: ['09:00', '14:00'], 3: ['10:00'] }), ...AVAILABILITY.days.slice(1)] };
  const { act, waitFor } = await rtl();
  await act(() => client.invalidateQueries({ queryKey: ['portal', 'north', 'availability'] }));
  assert.ok(await ui.findByText(TAKEN));
  await waitFor(() => assert.equal(readDraft().startTime, undefined));
});

test('no free day in the two months: a message in place of the calendar, and no Continue', async () => {
  const noDays = { busy: [], fullDays: [], days: [timed('2026-10-05', {}), timed('2026-10-06', {})] };
  const { ui } = await open({ availability: noDays });
  assert.ok(await ui.findByText('There are no free days in the next two months - please contact the shop'));
  assert.equal(ui.queryByRole('group', { name: 'October 2026' }), null);
  assert.equal(ui.queryByRole('button', { name: 'Continue' }), null);
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npm run pretest && node --test tests/customer/date-screen.test.js`
Expected: the three new tests FAIL. The first two time out on `findByText(TAKEN)` (no message is shown); the third times out on the "no free days" text (a calendar shows instead). The earlier tests PASS.

- [ ] **Step 3: Implement** in `src/screens/book/date.tsx`.
  - Replace the `./date-rules.ts` import block with:

```tsx
import {
  ANY_MECHANIC, availableDays, bookingRange, choiceStillFree, continueMessage, diaryColumns, dropoffOptions, initialMonth,
  jobMinutes, localToday, pickedDay, resolveMechanic, summaryText, type BookingRange,
} from './date-rules.ts';
```

  - Replace the whole `function DatePicker(...) { ... }` (from `function DatePicker({ range, mechanics, availability, back }: PickerProps) {` down to its closing `}` just before `type TimedProps`) with:

```tsx
function DatePicker({ range, mechanics, availability, back }: PickerProps) {
  const { shopSlug = '' } = useParams();
  const navigate = useNavigate();
  const { draft, update } = useDraft();
  const available = React.useMemo(() => availableDays(availability), [availability]);
  const [month, setMonth] = React.useState(() => initialMonth(range, draft, available));
  // The mechanics whose diary columns show; null means all of them (every
  // mechanic is on when a day is picked).
  const [shown, setShown] = React.useState<number[] | null>(null);
  // The Continue message shows only after a press, then follows the draft.
  const [checked, setChecked] = React.useState(false);
  // Bumped on each failed Continue so the alert is a new node and is
  // announced again (as on the service list).
  const [attempt, setAttempt] = React.useState(0);

  // A saved choice no longer offered (after a refresh, or availability
  // fetched again) is cleared, with a message until the next pick. Each new
  // availability answer is checked once, while rendering (React's "adjust
  // state when a prop changes"; lint forbids setting state inside an effect).
  // The effect then clears the stored choice, one render later.
  const [checkedAvailability, setCheckedAvailability] = React.useState<AvailabilityResponse | null>(null);
  const [taken, setTaken] = React.useState(false);
  const stale = !choiceStillFree(availability, draft);
  if (checkedAvailability !== availability) {
    setCheckedAvailability(availability);
    if (stale) setTaken(true);
  }
  React.useEffect(() => {
    if (stale) update({ date: undefined, mechanicId: undefined, startTime: undefined });
  }, [stale, update]);

  const day = pickedDay(availability, draft.date);
  const message = checked ? continueMessage(availability, draft) : null;
  const noDays = available.size === 0;

  const pickDay = (date: string) => {
    setTaken(false);
    setChecked(false);
    setShown(null);
    if (date !== draft.date) update({ date, mechanicId: undefined, startTime: undefined });
  };
  const pickTime = (date: string, mechanicId: number, startTime: string) => {
    setTaken(false);
    update({ date, mechanicId, startTime });
  };
  const pickMechanic = (value: string) => {
    setTaken(false);
    update({ mechanicId: value === ANY_MECHANIC ? undefined : Number(value), startTime: undefined });
  };

  const onContinue = () => {
    if (continueMessage(availability, draft) !== null) {
      setChecked(true);
      setAttempt((a) => a + 1);
      return;
    }
    // "Any mechanic" is never stored: it becomes the first bookable mechanic
    // in the shop's order now.
    if (day?.mode === 'dropoff' && draft.mechanicId === undefined) {
      update({ mechanicId: resolveMechanic(day, mechanics.mechanics) ?? undefined });
    }
    navigate(`/book/${shopSlug}/details`);
  };

  return (
    <BookFrame
      step={3}
      title={TITLE}
      back={back}
      action={noDays ? undefined : { label: 'Continue', onClick: onContinue }}
      actionNote={
        noDays ? undefined : (
          <>
            <p className="m-0 min-h-5" aria-live="polite">{summaryText(availability, draft, mechanics.mechanics)}</p>
            {message && <p key={attempt} role="alert" className="m-0 mt-1 text-[var(--wh-danger)]">{message}</p>}
          </>
        )
      }
    >
      {taken && (
        <p role="alert" className="m-0 mb-3 rounded-md bg-[var(--wh-warn-bg)] p-2.5 text-sm text-[var(--wh-warn-ink)]">
          That time has just been taken - please choose another
        </p>
      )}
      {noDays ? (
        <p className="m-0">There are no free days in the next two months - please contact the shop</p>
      ) : (
        <>
          <MonthCalendar
            month={month}
            onMonthChange={(m) => {
              if (range.months.includes(m)) setMonth(m);
            }}
            available={available}
            value={day ? day.date : null}
            onChange={pickDay}
            className="mb-4"
          />
          {day?.mode === 'timed' && (
            <TimedDayPicker
              day={day}
              availability={availability}
              mechanics={mechanics}
              shown={shown ?? mechanics.mechanics.map((m) => m.id)}
              onShow={setShown}
              draft={draft}
              onPick={(mechanicId, startTime) => pickTime(day.date, mechanicId, startTime)}
            />
          )}
          {day?.mode === 'dropoff' && <DropoffDayPicker day={day} mechanics={mechanics} draft={draft} onPick={pickMechanic} />}
        </>
      )}
    </BookFrame>
  );
}
```

- [ ] **Step 4: Run and watch them pass**

Run: `npm run pretest && time node --test tests/customer/date-screen.test.js && npm run typecheck && npm run lint`
Expected: all PASS, the file exits in seconds, typecheck and lint clean (in particular no `react-hooks/set-state-in-effect` error).

- [ ] **Step 5: Prove the tests bite.** Each time: mutate, confirm in `git diff`, run `npm run pretest && node --test tests/customer/date-screen.test.js`, confirm the named failure, restore, confirm `git diff` no longer shows it.
  1. In `pickDay`, delete `setTaken(false);`. "a saved time no longer free is cleared, with a message above the calendar until the next pick" must FAIL on its last assertion.
  2. In the effect, change `if (stale) update({ date: undefined, mechanicId: undefined, startTime: undefined });` to `if (stale) return;`. "a saved time no longer free is cleared ..." must FAIL in `waitFor` (the draft still holds `2026-10-05`).
  3. Change `const noDays = available.size === 0;` to `const noDays = false;`. "no free day in the two months ..." must FAIL.

  Re-run Step 4 to PASS.

- [ ] **Step 6: Commit**

```bash
git add src/screens/book/date.tsx tests/customer/date-screen.test.js
git commit -m "feat: the date screen clears a saved time that has been taken, and says when no day is free

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: At 320px, the diary's last row stays above the pinned Continue

**Files:**
- Create: `tests/browser/book-date.spec.ts`

**Interfaces:**
- Consumes:
  - the served app at `/book/:shopSlug/date` (Tasks 3-4)
  - `data-book-pinned` on BookFrame's pinned area, and BookFrame's bottom padding on `main` (`pb-36` when an `actionNote` is passed, which the date screen always does while it has a Continue)
  - the draft key `wh-book-draft:<shopSlug>` in sessionStorage
  - the diary's column `group`s, named by mechanic

- [ ] **Step 1: Write the check** `tests/browser/book-date.spec.ts`

```ts
import { test, expect } from '@playwright/test';

// d4: on a 320px-wide phone with three mechanics, the one-day diary is the
// longest thing on the date screen. Scrolled to the bottom, its last row must
// sit entirely above the pinned summary and Continue.
//
// /services, /mechanics and /availability are answered here and the draft
// seeded, so no seeded shop is needed. The page's clock is pinned to Monday
// 5 October 2026 so the calendar opens on a known month.
// Spec: docs/superpowers/specs/2026-09-26-book-d4-date-screen-design.md
const mechanics = [
  { id: 1, name: 'Alex', workingDays: [1, 2, 3, 4, 5] },
  { id: 2, name: 'Jo', workingDays: [1, 2, 3, 4, 5] },
  { id: 3, name: 'Sam', workingDays: [1, 2, 3, 4, 5] },
];
// Every half hour a 30-minute job can start between 08:00 and 18:00.
const allDay = Array.from({ length: 20 }, (_, i) => {
  const t = 8 * 60 + i * 30;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
});

test("at 320px with three mechanics, the diary's last row is fully above the pinned Continue", async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-05T10:00:00'));
  await page.setViewportSize({ width: 320, height: 568 });
  await page.route('**/api/portal/*/services', (route) =>
    route.fulfill({
      json: {
        shopName: 'Test shop', showPrices: true, full: [], categories: [],
        uncategorised: [{ id: 1, name: 'Brake service', price: 20, minutes: 30, questions: [] }],
      },
    }));
  await page.route('**/api/portal/*/mechanics', (route) =>
    route.fulfill({ json: { mechanics, openingTime: '08:00', closingTime: '18:00', openingDays: [1, 2, 3, 4, 5] } }));
  await page.route(/\/api\/portal\/[^/]+\/availability\?/, (route) =>
    route.fulfill({
      json: {
        busy: [], fullDays: [],
        days: [{ date: '2026-10-05', mode: 'timed', mechanics: mechanics.map((m) => ({ mechanicId: m.id, startTimes: allDay })) }],
      },
    }));
  // The date screen needs a finished problem screen (RequireDraft with
  // hasProblem); a service with no questions needs nothing more.
  await page.addInitScript(() => window.sessionStorage.setItem('wh-book-draft:any-shop', JSON.stringify({ serviceIds: [1] })));
  await page.goto('/book/any-shop/date');

  await page.getByRole('button', { name: 'Monday 5 October 2026' }).click();
  await page.getByRole('button', { name: 'Alex, 09:00' }).click();
  await expect(page.getByText('Monday 5 October, 09:00 with Alex')).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));

  const pinned = await page.locator('[data-book-pinned]').boundingBox();
  expect(pinned).not.toBeNull();
  for (const name of ['Alex', 'Jo', 'Sam']) {
    const column = await page.getByRole('group', { name, exact: true }).boundingBox();
    expect(column, name).not.toBeNull();
    expect(column!.y + column!.height, `${name}'s last row`).toBeLessThanOrEqual(pinned!.y);
  }
});
```

- [ ] **Step 2: Run it**

Run: `npx playwright test tests/browser/book-date.spec.ts`
Expected: PASS. (The web server runs `npm run build && npm start`, so the build includes Tasks 3-4.)

- [ ] **Step 3: Prove it bites.** In `src/screens/book/frame.tsx`, change `(actionNote ? 'pb-36' : 'pb-28')` to `(actionNote ? 'pb-3' : 'pb-28')`. Confirm it in `git diff`. Run `npx playwright test tests/browser/book-date.spec.ts`. It must FAIL on the "last row" assertion (the column's bottom is behind the pinned area). Restore `frame.tsx`, confirm `git diff` is clean for it, and re-run to PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/browser/book-date.spec.ts
git commit -m "test: at 320px the date screen's diary stays above the pinned Continue

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Piece 10, everything CI runs, the screenshot, STATUS, and the spec walk

**Files:**
- Modify: `.agents/STATUS.md`
- Modify: `docs/superpowers/plans/2026-09-26-book-d4-date-screen.md` (this plan: the decision log and spec walk)

- [ ] **Step 1: Check piece 10 and bring it in.** Run:

```bash
gh pr view 83 --json state,mergedAt,mergeCommit
git fetch origin
```

  - If the state is `MERGED`: run `git merge-base --is-ancestor <mergeCommit.oid> HEAD && echo "already in this branch"`. If it isn't already in, run

```bash
git merge origin/main -m "Merge origin/main (server piece 10, #83) into d4" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

    and report the merge commit. If the merge conflicts (most likely in `.agents/STATUS.md`), stop and report the conflicting files; don't resolve by discarding either side.
  - If it isn't `MERGED`: don't merge the piece-10 branch yourself. Report the state; the d4 PR must wait for it (spec). Carry on with the remaining steps.

- [ ] **Step 2: Run everything CI runs.** Run each command and read its exit code and output. Report the test counts.

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run registry:validate
node scripts/ci/check-registry-drift.mjs
node scripts/ci/assert-screen-trace.mjs
node scripts/ci/assert-rls-coverage.mjs
npm run build
npm run test:browser
```

Expected: every command exits 0. `npm test` includes `date-rules`, `date-screen` and `require-draft`; confirm each new test name appears in the output. `test:browser` runs `smoke`, `book-service-list`, `book-problem` and `book-date`; confirm `book-date` ran. A suite that didn't run isn't a pass. `npm run build` dirties `public/dist` locally (see STATUS); don't commit it.

- [ ] **Step 3: Screenshot for Jack's contrast check.** Jack judges on the built screen whether available days stand out on the page (spec, "Open items"). Temporarily add, in `tests/browser/book-date.spec.ts` directly after the `await expect(page.getByText('Monday 5 October, 09:00 with Alex')).toBeVisible();` line:

```ts
  await page.screenshot({ path: '/tmp/d4-date-timed-320.png', fullPage: true });
```

  Run `npx playwright test tests/browser/book-date.spec.ts` (PASS), then `git checkout -- tests/browser/book-date.spec.ts` and confirm `git status --short` doesn't list it. Open `/tmp/d4-date-timed-320.png` and check it shows the calendar (5 October picked), the mechanic pills and the diary with 09:00 picked. Report the path.

- [ ] **Step 4: STATUS.** Edit `.agents/STATUS.md`:
  1. Replace the whole paragraph that starts `**d4 next (date screen):**` and ends `those routes have no tests.` with the text below. (It arrives with piece 10's merge in Step 1. If Step 1 found #83 not merged and the paragraph isn't in this branch's STATUS, insert the text instead as a new paragraph directly after the `**(d3) merged: #82**` entry, and add "Server piece 10 (#83) not yet merged" to its first sentence.)

     > **(d4) built on `feat/book-d4-date-screen`** (26 Sep; spec `docs/superpowers/specs/2026-09-26-book-d4-date-screen-design.md`, plan `docs/superpowers/plans/2026-09-26-book-d4-date-screen.md`, which carries the decision log and the spec walk; server piece 10, PR #83, merged into this branch). Built: the `date` screen (a month calendar for this month and next; a timed day shows mechanic pills, all on, and the one-day diary, one column per mechanic, a mechanic with no free time shown as unavailable all day; a drop-off day shows the drop-off window and a mechanic choice starting on "Any mechanic", which Continue turns into the first bookable mechanic in the shop's order; a pinned summary; "Choose a day" / "Choose a time"; a saved time that has been taken is cleared with "That time has just been taken - please choose another"; "There are no free days in the next two months - please contact the shop"); the rules in `src/screens/book/date-rules.ts`; the `/mechanics` and `/availability` hooks in `src/screens/book/date-query.ts`; `RequireDraft` gained `to` (the screen to send the customer to; default the first screen); `hasDate(draft)` in `require-draft.tsx`, tested but not applied. The calendar's range uses the device's date (the client can't know the shop's time zone); the server (piece 10) offers nothing before the shop's earliest bookable moment. **For d5:** wrap `details` in `RequireDraft` with `hasDate` and `to="date"`; send `date`, `mechanicId` and, on a timed day only, `startTime` (a drop-off day stores none; `mechanicId` is always a real mechanic); build the "that day was just taken" refusal screen (`full`) for a capacity or "too soon" refusal when sending. **Jack to judge** from `/tmp/d4-date-timed-320.png`: whether available days stand out on the page, and the diary's height with real service lengths; and approve the line "We couldn't load the free days" (not in the spec) and the "just been taken" note's look (d3's `--wh-warn-bg` / `--wh-warn-ink`). Carried from piece 10: dashboard and sales "today" still query a UTC-midnight window (follow-up piece).

  2. In the `**Branch:**` line at the top, replace "d4 spec on `feat/book-d4-date-screen` (not pushed)" with "d4 built on `feat/book-d4-date-screen`". If that phrase isn't there, add "; d4 built on `feat/book-d4-date-screen`" at the end of the line's first sentence.

- [ ] **Step 5: Walk the build against the spec.** Go through the spec line by line: "Changes", Decisions 1-5, "The screen" (every bullet), "Draft changes", "Rules", "Data", "Open items settled here", "Tests", "Not in this piece". Under "Spec walk" at the end of this plan, record each requirement as **met** (name the test that proves it), **dropped**, or **changed**, with the reason. Add any decision taken during the build to the "Decision log", with what caused it. Put the same walk in the task report.

- [ ] **Step 6: Commit**

```bash
git add .agents/STATUS.md docs/superpowers/plans/2026-09-26-book-d4-date-screen.md
git commit -m "docs: STATUS - d4 built; plan decision log and spec walk

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Decision log

Decisions taken while writing this plan, where the spec left room. Each has the reason. Add any decision taken during the build below them.

1. **"Today" is the device's local date**, used for the request's `start` and the calendar's months. The spec says "the shop's today as piece 10 defines it", but the client can't know the shop's time zone (`/mechanics` and `/availability` don't return it). Piece 10 makes the server offer nothing before the shop's earliest bookable moment, so a device a day behind asks for one extra past day (returned with nothing bookable) and a device a day ahead misses at most the shop's today, which is already mostly past its notice. Recorded in `localToday`'s comment and STATUS.
2. **The range ends on the last day of next month**, fixed when the screen opens. Spec decision 4 ("this month and next, starting today"). This is at most 62 days (July-August, December-January), exactly the server's `MAX_RANGE_DAYS`; a rules test proves both 62-day cases.
3. **The calendar opens on the saved day's month, else the first free day's month, else this month**, and refuses any other month than the two. The spec says "this month and next only" but not which month shows first; opening on an empty month when the first free day is next month would look like "no free days".
4. **A mechanic with no start time that day is one "Unavailable" block from open to close.** `/availability`'s `busy` leaves out a mechanic's day off entirely (`legacyView` skips unscheduled mechanics), so their column would otherwise look free with no buttons. It covers "fully booked" and "no gap long enough for this job" the same way.
5. **The timed pills' legend is "Mechanic"**, the same as the drop-off choice. The spec gives no legend for the timed pills, and `PillGroup` requires one; "Mechanic" is the only legend in the spec.
6. **Turning a mechanic's pill off hides the column but keeps a time already picked in it.** The spec says tapping a time saves it; nothing says hiding a column unpicks it. The summary still names the pick.
7. **On a timed day with no time yet, the summary is the day alone** ("Monday 5 October"). The spec's two formats both assume a finished choice; "empty until a day is picked" implies a day alone shows something.
8. **Picking a day clears the mechanic and time, turns every mechanic back on, and clears the Continue message.** The spec says the pills are "all on when the day is picked". A time or drop-off mechanic belongs to its day.
9. **The Continue message shows after a press and then follows the draft** (so "Choose a time" goes as soon as a time is picked), and a fresh alert node is made on each press. Same pattern as d2 and d3.
10. **"Any mechanic" is resolved against `/mechanics`' order** (the server orders by name). Coming back to the screen after Continue shows the resolved mechanic, not "Any mechanic", because the spec says "Any mechanic" is not stored.
11. **Load failure shows "We couldn't load the free days" above "Try again".** The spec says failures "follow BookFrame's existing states (loading; failed with 'Try again')" but gives no line for these two requests, and a lone button explains nothing. This is the only copy not in the spec; Jack approves it on the PR. Try again refetches only the request(s) that failed.
12. **With no free day at all there is no pinned Continue.** The spec puts the message "in place of the calendar"; a Continue that can only say "Choose a day" would be a dead end.
13. **The "just been taken" note reuses d3's "photos were cleared" look** (`--wh-warn-bg` / `--wh-warn-ink`, `role="alert"`), which Jack approved for d3. Jack confirms it here too.
14. **The saved-choice check runs while rendering, and an effect clears the stored choice.** `eslint-plugin-react-hooks` 7 (`react-hooks/set-state-in-effect`) refuses setting state inside an effect; React's "adjust state when a prop changes" pattern is allowed. Checked with the linter on the draft code while writing the plan. Each new availability answer is checked once, so the message appears after a refresh and after a refetch.
15. **What "still free" means** (`choiceStillFree`): nothing saved, or a timed day with only the day saved, is free while the day is; a timed mechanic and time must still be that mechanic's start time; a drop-off day holds no time and a chosen mechanic must still be bookable; a day whose mode changed counts as taken.
16. **`hasDate`** checks the shapes: `date` is `YYYY-MM-DD`, `mechanicId` an integer, `startTime` absent or `HH:MM`. The spec's "a start time when one was chosen" can't be checked without availability, so it means "when present, well formed"; d5's send and the server check the rest.
17. **`RequireDraft`'s `to` is the part of the address after `/book/<shopSlug>`** (`'problem'`), so a caller can't point it at another shop. Default `''` keeps today's behaviour.
18. **The guard waits for `/services`, and `/mechanics` and `/availability` are fetched only after it passes.** The job length needs `/services`, and a customer being sent back shouldn't cost two requests. A test proves nothing but `/services` is asked for when the guard fails.
19. **The screen's own loading and failure states sit inside the frame** under the "When can you drop in?" heading; BookFrame's states cover `/services` only and are unchanged.
20. **The jsdom tests pin only `Date`** (`mock.timers`, `apis: ['Date']`), so "today" is 5 October 2026 while timers stay real. Checked on this machine's Node while writing the plan; CI's Node 22 has the same API.
21. **The Playwright mutation is in `frame.tsx`'s bottom padding**, the thing that keeps the last row clear. The date screen always passes an `actionNote` (the summary line), so the frame uses `pb-36`.
22. **The diary's hours come from `/mechanics`' `openingTime`/`closingTime`** (the shop's widest day); a shorter day already comes back from `/availability` as busy time. This settles piece (c)'s open item.
23. **`diaryColumns`' busy is now the complement of `startTimes` within `[hours.open, hours.close)`, on 30-minute steps, merged and clamped** — Jack, 26 Sep (`.superpowers/sdd/d4-gaps/brief.md`): `availability.busy` only covered gaps the server had already scheduled and missed every other "no start time" case (too soon, too short, not working), so a real gap could render blank instead of "Unavailable". `diaryColumns` no longer reads `availability.busy` at all; the `AvailabilityResponse` type is unchanged.

## Spec walk

**Changes**
- Atlas mock-up (`docs/design/release-1-journey/screens.js`, `date` entry): **dropped**. The plan's own constraints (line 63) chose not to hand-edit the mock-up and to record the departure in the spec's "Changes" list instead; `date.tsx`'s header comment carries the same summary. The mock-up still shows the old "Drop-off day / Exact appointment" toggle and the "No suitable day?" link.
- `RequireDraft` gains a redirect target: **met** — `to` prop, `require-draft.test.js` "with a redirect target, a screen opened without its answers goes there instead" and "...and the answers present, the screen shows".

**Decisions 1-5**
1. "Any mechanic" by default, with the option to choose: **met** — `date-rules.test.js` "the drop-off choice is..." tests; `date-screen.test.js` "a drop-off day: the window, the note, and 'Any mechanic' first with an unavailable mechanic greyed".
2. Timed days use the one-day mechanic diary, every mechanic shown one column each, tapping a free time picks mechanic and time: **met** — `date-screen.test.js` "a timed day: every mechanic on, one diary column each, busy time greyed" and "tapping a free time saves the day, mechanic and time...".
3. Drop-off days show the window and a mechanic choice starting on "Any mechanic", unavailable mechanics greyed: **met** — same drop-off test above.
4. About two months ahead, this month and next, starting today: **met** — `date-rules.test.js` "the range is today to the last day of next month" and "the range never asks for more than the server allows (62 days)"; decision log 1-2 record the local-date and 62-day choices made to implement it.
5. No past or too-soon times, enforced by the server (piece 10), not only hidden on screen: **met** — availability comes from piece 10's `/availability`, which already excludes those; no client-side re-check is added, matching the decision.

**The screen**
- `BookFrame` step 3, back to `problem`, heading "When can you drop in?", action "Continue": **met** — `date-screen.test.js` "step 3, the heading, and Back goes to the problem screen".
- Guard on `hasProblem` once `/services` has loaded, else redirect to `problem`: **met** — `date-screen.test.js` "with the problem screen unfinished it goes back to problem, and asks for no free days"; `date.tsx`'s `DateScreen` waits on `useServices` before mounting `RequireDraft`.
- Job length: ticked services' summed minutes, or 60 for "Not sure": **met** — `date-rules.test.js` "the job length is the ticked services' minutes, or an hour for Not sure"; `date-screen.test.js` "'Not sure' asks for an hour".
- Calendar: `MonthCalendar`, this month and next only, available when `/availability` returns a mechanic with a start time or bookable: **met** — `date-rules.test.js` "a day is free when a mechanic has a start time (timed) or is bookable (drop-off)"; `date-screen.test.js` "only this month and next can be shown" and "free days can be picked; a full day and a past day are greyed; the summary starts empty".
- Timed day pills all on when picked, last one can't be turned off, diary columns with hours/busy/start times, tapping a free time saves: **met** — `date-screen.test.js` "the mechanic pills hide columns, but the last one on stays on"; `date-rules.test.js` "the diary has a column per shown mechanic..." and "a mechanic with no start time that day is unavailable all day, not blank" (decision log 4).
- Drop-off day text, window, "We'll confirm...", single-choice mechanic pills with unbookable disabled: **met** — same drop-off test above.
- Pinned summary format for both modes, empty until a day is picked: **met** — `date-rules.test.js` "the summary: the day, then the time and mechanic (timed) or the drop-off window"; decision log 7 covers the day-alone case.
- Continue stays with a message ("Choose a day" / "Choose a time"), else saves and goes to `details`: **met** — `date-rules.test.js` "the Continue message: a day first, then a time on a timed day"; `date-screen.test.js` "Continue with no day says...", "...on a timed day with no time says...", "a good Continue on a timed day goes to details and sends nothing".
- Saved choice no longer free is cleared with the "just been taken" message: **met** — `date-rules.test.js` "a saved choice is still free only while the same day, mechanic and time are offered"; `date-screen.test.js` "a saved time no longer free is cleared..." and "a picked time taken while the screen is open is cleared...".
- No free day at all: message in place of the calendar: **met** — `date-screen.test.js` "no free day in the two months: a message in place of the calendar, and no Continue" (decision log 12 drops the pinned Continue too, changed from a literal read of "in place of the calendar" alone).
- Loading/error follow `BookFrame`'s states: **changed** — decision log 19: the screen's own loading/failure states sit inside the frame under its heading (BookFrame's own states cover only `/services`); the copy "We couldn't load the free days" above "Try again" is new, not in the spec (decision log 11), and awaits Jack's approval per STATUS.

**Draft changes**
- `date`/`mechanicId`/`startTime` used as-is, no `startTime` on drop-off, `mechanicId` always real: **met** — `date-rules.test.js` "the addresses carry the shop, the range and the job length" (query shape) and the "Any mechanic" resolution tests; `date.tsx`'s `onContinue` resolves before storing.
- `RequireDraft`'s redirect target, default first screen: **met** — see "Changes" above.
- `hasDate(draft)` guard, tested but not applied: **met** — `require-draft.test.js` "hasDate needs a day and a real mechanic, and a start time only when one was chosen"; not wired into any screen yet, matching "for d5 to apply".

**Rules**
- Pure functions in `date-rules.ts`, screen only calls these: **met** — `src/screens/book/date-rules.ts` holds `bookingRange`, `jobMinutes`, `availableDays`, `diaryColumns`, `choiceStillFree`, `resolveMechanic`, `summaryText`, `continueMessage`; `date.tsx` imports and calls them rather than reimplementing.

**Data**
- `/mechanics` and `/availability` hooks beside `services-query.ts`: **met** — `src/screens/book/date-query.ts`; `date-rules.test.js` "the addresses carry the shop, the range and the job length".

**Open items settled here**
- Diary stretching for very short services: **met** (left as is, per spec) — no change made; judged on the screenshot per STATUS.
- `MonthCalendar`'s `h2` under the screen's `h1`: **met** (no change needed) — `MonthCalendar` renders inside the frame's body, under the frame's `h1`.
- Whether available days stand out: **met** (deferred to Jack, screenshot supplied) — `/tmp/d4-date-timed-320.png`, STATUS "Jack to judge".
- A shop subdomain showing another shop's booking page: **dropped**, as specified ("not d4; waits for the hosting decision") — no code touches this.

**Tests**
- `date-rules.test.js` coverage (available days, columns/busy, saved-choice, "Any mechanic", summary, Continue message): **met** — test names listed above.
- `date-screen.test.js` coverage (both day kinds, pills, picking a time, drop-off choice, summary, Continue messages, good Continue, back link, guard redirect, "just been taken", "no free days"): **met** — 25 test cases in the file cover each bullet.
- `require-draft.test.js` (`hasDate`, redirect target): **met**.
- `book-date.spec.ts` (320×568, diary's last row above the pinned area): **met** — `book-date.spec.ts` "at 320px with three mechanics, the diary's last row is fully above the pinned Continue", proved again in this task's foreground `test:browser` run.

**Not in this piece**
- Sending the booking, the "that day was just taken" `full` screen, `details`, `pending`: **met** (correctly out of scope) — none implemented; STATUS records them as d5 work.
- A per-shop limit on how far ahead customers can book: **met** (correctly out of scope) — no such limit added; the range is fixed at "this month and next" only.
