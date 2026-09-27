# Staff diary "Waiting for you" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Staff see and answer customers' online bookings, change requests and cancellations from the legacy staff diary: a "Waiting for you" column, a review pop-up with Accept / Decline / Seen, grid markings, and version-checked diary saves.

**Architecture:** Server changes are small additions to `server/server.js` (two serializer fields, a `services` list on waiting items, a version check and bump on the legacy PUT, a looser "dropped on the requested start" rule). Decision logic lives in three new plain browser scripts under `public/` that set globals (`DiaryWaiting`, `DiaryMarks`, `DiaryReview`) and are unit-tested through `vm`, following `public-portal/copy.js`. `public/app.js` (no build step) wires them into the column, grid and a new `review-job` modal. Playwright tests drive the legacy diary for the first time.

**Tech Stack:** Node (plain `node:http` server, `node --test`), Postgres via compose on port 5433, vanilla JS in `public/`, Playwright 1.63.

**Spec:** `docs/superpowers/specs/2026-09-27-staff-diary-waiting-design.md`

## Global Constraints

- No database migrations. No new dependencies.
- Every new test is shown failing by a targeted break of the code it covers; record the break and the failure message in this plan's decision log per test.
- Server tests pin the clock to `2026-09-01T06:00:00Z` (`startLiveServer`); never use fixed test dates before it. Use `dayMaker()` from `tests/helpers/linkActions.js` for booking dates.
- The booking-link limiter allows 30 link calls per server per 15 minutes; keep each test file's `link.*`/`bookOnline` calls under 30.
- Compare DOM query results with `assert.ok(x === null)`, never `assert.equal` on a DOM node.
- `public/styles.css` may contain no raw hex colours and may reference only variables defined in `public/tokens.css` (`tests/design-tokens.test.js`). `public/app.js` may contain no raw hex outside `THEME_PRESETS`.
- Staff-facing wording, verbatim from the spec:
  - column title `Waiting for you (n)`; empty column `Nothing waiting`
  - labels `New booking`, `Change request`, `Cancelled by customer`
  - `Arrived <n> minutes ago` / `hours ago` / `days ago` (singular for 1), `Arrived just now` under a minute
  - pop-up heading `New online booking · <ref>`, `Change request · <ref>`, `Cancelled by customer · <ref>`
  - `Customer's notes`; `Open full job`; `Accept`; `Decline`; `Seen`
  - `Customer asked to move from <from> to <to>`
  - `Decline <customer>'s booking for <day date>? This can't be undone.` with buttons `Decline booking` and `Keep booking`
  - grid: `Move requested`, `Cancelled by customer`
  - refusals: `This job changed while you were looking at it.` / `The requested time is no longer free.` / the server's own message for `illegal` / `This job no longer exists.` / `Couldn't reach the server — try again.`
- Server stale wording (existing `staleRefusal`): `This job changed while you were looking at it. Reload and try again.`
- Run `npm test` only with compose Postgres up and a `.env` in the worktree.

---

## File map

| File | Change | Responsibility |
|---|---|---|
| `server/server.js` | modify | serializer fields; waiting item `services`; PUT version + drop rule |
| `public/diary-waiting.js` | create | `DiaryWaiting`: date/slot wording, card content, "arrived" wording |
| `public/diary-marks.js` | create | `DiaryMarks`: a job's grid marking; which change-request outlines belong in a column |
| `public/diary-review.js` | create | `DiaryReview`: pop-up headings, answer text/grouping, change line, decline confirmation, refusal → sentence |
| `public/index.html` | modify | load the three scripts before `app.js` |
| `public/app.js` | modify | `api()` errors carry status/code; saves send version; waiting column + timer; grid markings + outlines; review modal; click routing |
| `public/styles.css` | modify | column cards, markings, outline, review pop-up |
| `tests/workshop-waiting.test.js` | modify | `services` on items; notes fields on the job |
| `tests/workshop-change-requests.test.js` | modify | drop on requested start, different length |
| `tests/workshop-legacy-save-version.test.js` | create | PUT version check and bump |
| `tests/diary-rules.test.js` | create | unit tests for the three rule scripts |
| `tests/browser/diary-waiting.spec.ts` | create | the diary end to end |
| `.agents/STATUS.md` | modify | state after the piece |

---

### Task 1: Server — customer's notes on the job, services on waiting items

**Files:**
- Modify: `server/server.js` (`serializeWorkshopJob` ~2407; `GET /api/workshop-waiting` ~3440 and `waitingItem` ~3413)
- Test: `tests/workshop-waiting.test.js`

**Interfaces:**
- Produces: job JSON gains `customerDescription: string|null`, `customerBikeNote: string|null`. Waiting item gains `services: [{ id: number, name: string }]` in position order (keep `serviceNames`).

- [ ] **Step 1: Write the failing tests** (append to `tests/workshop-waiting.test.js`; it already has `book`, `read`, `itemFor`, `types`)

```js
test('a waiting item lists its services with ids, in order', async () => {
  const booked = await book([types.quick, types.repair]);
  const item = await itemFor(booked.id);
  assert.deepEqual(item.services.map((s) => s.id), [types.quick, types.repair]);
  assert.deepEqual(item.services.map((s) => s.name), item.serviceNames);
});

test("the job carries the customer's own description and bike note", async () => {
  const booked = await book();
  const job = await read(booked.id);
  assert.equal(job.customerDescription, 'Squeaky brakes');
  assert.equal(job.customerBikeNote, null);
});
```

`book()` goes through `bookOnline`, whose default body sends `description: 'Squeaky brakes'` and a `newBike` with no note (`tests/helpers/linkActions.js:27-31`). If `seedJobTypes` returns services whose `position` order differs from the `serviceIds` order sent, assert against the order the server stores (read `workshop_job_services` ordered by `position`) and note it in the decision log.

- [ ] **Step 2: Run to verify they fail**

Run: `node --test tests/workshop-waiting.test.js`
Expected: the two new tests FAIL (`item.services` undefined; `job.customerDescription` undefined).

- [ ] **Step 3: Implement**

In `serializeWorkshopJob`, after `questionAnswers`:

```js
    // The customer's own words from the booking (piece 3), apart from the
    // notes they were also copied into - the review pop-up shows them alone.
    customerDescription: row.customer_description ?? null,
    customerBikeNote: row.customer_bike_note ?? null,
```

In the `GET /api/workshop-waiting` SELECT, beside `service_names`:

```sql
            (SELECT coalesce(json_agg(json_build_object('id', s.id, 'name', s.name) ORDER BY js.position), '[]'::json)
               FROM workshop_job_services js JOIN workshop_services s ON s.id = js.service_id
              WHERE js.workshop_job_id = w.id) AS services,
```

In `waitingItem`, after `serviceNames: row.service_names,`:

```js
    services: row.services,
```

- [ ] **Step 4: Run to verify they pass**

Run: `node --test tests/workshop-waiting.test.js`
Expected: all PASS.

- [ ] **Step 5: Show each new test failing by a targeted break**
  - Remove `services: row.services,` → first test fails on `item.services` undefined. Restore.
  - Change `customerDescription: row.customer_description ?? null` to `?? null` of `row.notes` → second test fails with the notes text. Restore.
  Confirm each edit landed (`git diff --stat` shows the file changed) before running.

- [ ] **Step 6: Commit**

```bash
git add server/server.js tests/workshop-waiting.test.js
git commit -m "feat: customer's notes on the job and service ids on waiting items"
```

---

### Task 2: Server — legacy save checks and bumps the version; drop on requested start accepts

**Files:**
- Modify: `server/server.js` (PUT `/api/workshop-jobs/:id`, 3009-3152)
- Create: `tests/workshop-legacy-save-version.test.js`
- Modify: `tests/workshop-change-requests.test.js`

**Interfaces:**
- Produces: `PUT /api/workshop-jobs/:id` accepts optional integer `version`. Mismatch → 409 `{ error: 'This job changed while you were looking at it. Reload and try again.', code: 'stale' }`. A non-integer `version` → 400 with the existing `VERSION_REQUIRED` message. Every successful PUT increments `version`.

- [ ] **Step 1: Write the failing tests**

Create `tests/workshop-legacy-save-version.test.js`:

```js
// The old diary's save (PUT /api/workshop-jobs/:id) takes part in the version
// check the action routes use, and every save counts as a change.
// Spec: docs/superpowers/specs/2026-09-27-staff-diary-waiting-design.md
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from './helpers/staff.js';
import { portalSignup } from './helpers/portal.js';
import { deleteTestShop } from './helpers/testShop.js';
import { seedJobTypes } from './helpers/bookable.js';
import { bookOnline, dayMaker } from './helpers/linkActions.js';

let server;
let owner;
let sam;
let types;
let customer;
const nextDay = dayMaker();

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl);
  sam = await seedMechanic(owner.shop.id, { name: 'Sam' });
  types = await seedJobTypes(owner.shop.id);
  customer = await portalSignup(server.baseUrl, owner.shop.slug, {});
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const staff = (path, options) => staffRequest(server.baseUrl, owner.cookie, path, options);
const read = async (id) => (await staff(`/api/workshop-jobs/${id}`)).body;
const save = (id, body) => staff(`/api/workshop-jobs/${id}`, { method: 'PUT', body });
const book = () => bookOnline(server.baseUrl, customer.cookie, owner.shop.slug, {
  mechanicId: sam, jobDate: nextDay(), startTime: '10:00', serviceIds: [types.repair],
});

test('a save with the version last read goes ahead and bumps it', async () => {
  const booked = await book();
  const before = await read(booked.id);
  const res = await save(booked.id, { notes: 'Rang the customer', version: before.version });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.version, before.version + 1);
  assert.equal(res.body.notes, 'Rang the customer');
});

test('a save with an older version is refused and changes nothing', async () => {
  const booked = await book();
  const before = await read(booked.id);
  const res = await save(booked.id, { notes: 'Stale edit', version: before.version - 1 });
  assert.equal(res.status, 409);
  assert.deepEqual(res.body, { error: 'This job changed while you were looking at it. Reload and try again.', code: 'stale' });
  const after = await read(booked.id);
  assert.equal(after.notes, before.notes);
  assert.equal(after.version, before.version);
});

test('a save without a version still works, and still counts as a change', async () => {
  const booked = await book();
  const before = await read(booked.id);
  const res = await save(booked.id, { notes: 'No version sent' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.version, before.version + 1);
});

test('an accept on the copy read before a diary save is refused', async () => {
  const booked = await book();
  const seen = await read(booked.id);
  assert.equal((await save(booked.id, { startTime: '11:00', endTime: '12:00', version: seen.version })).status, 200);
  const res = await staff(`/api/workshop-jobs/${booked.id}/accept`, { method: 'POST', body: { version: seen.version } });
  assert.equal(res.status, 409);
  assert.equal(res.body.code, 'stale');
});

test('a version that is not a whole number is refused', async () => {
  const booked = await book();
  const res = await save(booked.id, { notes: 'x', version: 'one' });
  assert.equal(res.status, 400);
});
```

Append to `tests/workshop-change-requests.test.js` (it defines `requested()`, `legacySave`, `liveHolds`, `requestColumns`, `sam`, `shopId`):

```js
test('dropping a job onto its requested start with a different length accepts the change', async () => {
  const job = await requested();
  const res = await legacySave(job.id, { jobDate: job.to, startTime: '14:00', endTime: '15:30' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(
    { d: res.body.jobDate, s: res.body.startTime, e: res.body.endTime, b: res.body.bookingState, r: res.body.requested },
    { d: job.to, s: '14:00', e: '15:30', b: 'scheduled', r: null }
  );
  assert.deepEqual(await requestColumns(job.id), [null, null, null, null, null]);
  assert.deepEqual(await liveHolds(shopId(), job.id), [{ job_date: job.to, start_time: '14:00', mechanic_id: sam, purpose: 'booking' }]);
});
```

Before adding it, count the file's link calls (`requested()` makes one `bookOnline` and one `link.change`); the new test adds two. If the total passes 30, move the test into a new file with the same `before`/`after` and helpers, and record the move.

- [ ] **Step 2: Run to verify they fail**

Run: `node --test tests/workshop-legacy-save-version.test.js tests/workshop-change-requests.test.js`
Expected: FAIL — version not bumped (first, third), stale save accepted with 200 (second), accept after save succeeds (fourth), non-integer version accepted (fifth), and the drop test gets a refusal (400 or 409 `capacity`) because the requested hold sits on the same start.

- [ ] **Step 3: Implement**

In the PUT handler, after `const body = await readJsonBody(req);`:

```js
  // The old diary now sends the version it last read (staff diary piece).
  // Optional, so a caller that doesn't send one keeps the old behaviour.
  if (body.version !== undefined && !Number.isInteger(body.version)) return badRequest(res, VERSION_REQUIRED);
```

Inside `withBookingLock`, straight after `const current = await db.prepare('SELECT * FROM workshop_jobs WHERE id = ? FOR UPDATE').get(id);`, move that read above the `checkJobSlot` call so the version is checked first, and add:

```js
      if (body.version !== undefined && current && current.version !== body.version) return staleRefusal;
```

Change the "on requested" test so length no longer matters:

```js
        // Same day, start and mechanic answers the request whatever the
        // length (staff diary piece): the drop is the staff member's answer.
        const onRequested = jobDate === request.jobDate && times.startTime === request.startTime
          && mechResolved.mechanicId === request.mechanicId;
```

In the UPDATE, add the bump after `updated_at = ?,`:

```sql
           version = version + 1,
```

Update the comment block above the legacy states (lines 3042-3050) to say the old diary now sends a version, which is checked when present, and that every save bumps it. `staleRefusal` and `VERSION_REQUIRED` are module-level constants defined further down the file; they are read when a request runs, after the module has loaded, so the forward reference is safe.

- [ ] **Step 4: Run to verify they pass**

Run: `node --test tests/workshop-legacy-save-version.test.js tests/workshop-change-requests.test.js tests/workshop-waiting.test.js`
Expected: all PASS, including the existing "exactly its requested time" test.

- [ ] **Step 5: Show each new test failing by a targeted break**
  - Remove `version = version + 1,` → tests 1, 3, 4 fail. Restore.
  - Remove the `staleRefusal` line → test 2 fails with 200. Restore.
  - Remove the `Number.isInteger` guard → test 5 fails (200 or 500). Restore.
  - Put `&& times.endTime === request.endTime` back in `onRequested` → the drop test fails with a refusal. Restore.

- [ ] **Step 6: Run the whole server suite**

Run: `npm test`
Expected: PASS. Any other test that asserted an unchanged `version` after a PUT must be read and, if it encoded the old behaviour, updated with a decision-log entry.

- [ ] **Step 7: Commit**

```bash
git add server/server.js tests/workshop-legacy-save-version.test.js tests/workshop-change-requests.test.js
git commit -m "feat: diary saves check and bump the job version; drop on requested start accepts"
```

---

### Task 3: Rule scripts — waiting cards and grid markings

**Files:**
- Create: `public/diary-waiting.js`, `public/diary-marks.js`
- Create: `tests/diary-rules.test.js`

**Interfaces:**
- Produces (browser globals, also read by tests through `vm`):
  - `DiaryWaiting.dayDate(iso: 'YYYY-MM-DD') → 'Tue 6 Oct'`
  - `DiaryWaiting.slotText(slot: {jobDate,startTime,endTime,mechanicName}) → 'Tue 6 Oct, 09:00–11:00 · Dave'`
  - `DiaryWaiting.arrivedText(arrivedAt: string, now: Date) → 'Arrived 2 hours ago'`
  - `DiaryWaiting.cardFor(item, now: Date) → { tone: 'new'|'change'|'cancelled', label, customer, reference, services, when, arrived }`
  - `DiaryMarks.markOf(job) → 'normal'|'move-requested'|'cancelled-unseen'|'hidden'`
  - `DiaryMarks.outlinesOn(items, dateStr, mechanicOk: (mechanicId) => boolean) → item[]`

- [ ] **Step 1: Write the failing tests** — create `tests/diary-rules.test.js`

```js
// The staff diary's decision rules, run outside the browser.
// Spec: docs/superpowers/specs/2026-09-27-staff-diary-waiting-design.md
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// Loads the scripts in the order index.html loads them, into one context.
export function loadRules(files = ['public/diary-waiting.js', 'public/diary-marks.js', 'public/diary-review.js']) {
  const context = {};
  context.globalThis = context;
  vm.createContext(context);
  for (const f of files) vm.runInContext(readFileSync(path.join(root, f), 'utf8'), context);
  return context;
}

const { DiaryWaiting, DiaryMarks } = loadRules(['public/diary-waiting.js', 'public/diary-marks.js']);
const NOW = new Date('2026-10-05T12:00:00Z');

const newItem = {
  kind: 'new_booking', jobId: 1, reference: 'WH-1042', jobDate: '2026-10-06', startTime: '09:00', endTime: '11:00',
  mechanicId: 7, mechanicName: 'Dave', customerName: 'Sam Example', serviceNames: ['Full service', 'Brake bleed'],
  services: [{ id: 3, name: 'Full service' }, { id: 4, name: 'Brake bleed' }], arrivedAt: '2026-10-05T10:00:00Z',
};
const changeItem = {
  ...newItem, kind: 'change_request', jobId: 2, reference: 'WH-1038', customerName: 'Alex Example',
  arrivedAt: '2026-10-05T11:20:00Z',
  from: { jobDate: '2026-10-07', startTime: '10:00', endTime: '11:00', mechanicId: 7, mechanicName: 'Dave' },
  to: { jobDate: '2026-10-09', startTime: '14:00', endTime: '15:00', mechanicId: 7, mechanicName: 'Dave' },
};
const cancelledItem = { ...newItem, kind: 'customer_cancelled', jobId: 3, arrivedAt: '2026-10-05T11:55:00Z' };

test('dates read as short day and month, whatever the machine time zone', () => {
  assert.equal(DiaryWaiting.dayDate('2026-10-06'), 'Tue 6 Oct');
  assert.equal(DiaryWaiting.dayDate('2026-01-01'), 'Thu 1 Jan');
});

test('a slot reads day, time range and mechanic, leaving out what is missing', () => {
  assert.equal(DiaryWaiting.slotText(newItem), 'Tue 6 Oct, 09:00–11:00 · Dave');
  assert.equal(DiaryWaiting.slotText({ jobDate: '2026-10-06', startTime: '', endTime: '', mechanicName: null }), 'Tue 6 Oct');
});

test('"arrived" wording at each boundary', () => {
  const at = (ms) => new Date(NOW.getTime() - ms).toISOString();
  assert.equal(DiaryWaiting.arrivedText(at(30_000), NOW), 'Arrived just now');
  assert.equal(DiaryWaiting.arrivedText(at(60_000), NOW), 'Arrived 1 minute ago');
  assert.equal(DiaryWaiting.arrivedText(at(59 * 60_000), NOW), 'Arrived 59 minutes ago');
  assert.equal(DiaryWaiting.arrivedText(at(60 * 60_000), NOW), 'Arrived 1 hour ago');
  assert.equal(DiaryWaiting.arrivedText(at(23 * 3_600_000), NOW), 'Arrived 23 hours ago');
  assert.equal(DiaryWaiting.arrivedText(at(24 * 3_600_000), NOW), 'Arrived 1 day ago');
  assert.equal(DiaryWaiting.arrivedText(at(72 * 3_600_000), NOW), 'Arrived 3 days ago');
});

test('a new booking card', () => {
  assert.deepEqual({ ...DiaryWaiting.cardFor(newItem, NOW) }, {
    tone: 'new', label: 'New booking', customer: 'Sam Example', reference: 'WH-1042',
    services: 'Full service, Brake bleed', when: 'Tue 6 Oct, 09:00–11:00 · Dave', arrived: 'Arrived 2 hours ago',
  });
});

test('a change request card shows from and to', () => {
  const card = DiaryWaiting.cardFor(changeItem, NOW);
  assert.equal(card.tone, 'change');
  assert.equal(card.label, 'Change request');
  assert.equal(card.when, 'Wed 7 Oct 10:00 → Fri 9 Oct 14:00');
  assert.equal(card.arrived, 'Arrived 40 minutes ago');
});

test('a change to another mechanic names them', () => {
  const item = { ...changeItem, to: { ...changeItem.to, mechanicId: 8, mechanicName: 'Jo' } };
  assert.equal(DiaryWaiting.cardFor(item, NOW).when, 'Wed 7 Oct 10:00 → Fri 9 Oct 14:00 with Jo');
});

test('a cancellation card', () => {
  const card = DiaryWaiting.cardFor(cancelledItem, NOW);
  assert.equal(card.tone, 'cancelled');
  assert.equal(card.label, 'Cancelled by customer');
  assert.equal(card.when, 'Tue 6 Oct, 09:00–11:00 · Dave');
});

test('a card with no customer name says so plainly', () => {
  assert.equal(DiaryWaiting.cardFor({ ...newItem, customerName: null }, NOW).customer, 'Customer');
});

test('each job marking', () => {
  const job = (over) => ({ bookingState: 'scheduled', requested: null, cancelledBy: null, cancellationSeenAt: null, ...over });
  assert.equal(DiaryMarks.markOf(job({})), 'normal');
  assert.equal(DiaryMarks.markOf(job({ bookingState: 'pending' })), 'normal');
  assert.equal(DiaryMarks.markOf(job({ bookingState: 'reschedule_requested', requested: { jobDate: '2026-10-09' } })), 'move-requested');
  assert.equal(DiaryMarks.markOf(job({ bookingState: 'reschedule_requested', requested: null })), 'normal');
  assert.equal(DiaryMarks.markOf(job({ bookingState: 'cancelled', cancelledBy: 'customer' })), 'cancelled-unseen');
  assert.equal(DiaryMarks.markOf(job({ bookingState: 'cancelled', cancelledBy: 'customer', cancellationSeenAt: '2026-10-05T12:00:00Z' })), 'hidden');
  assert.equal(DiaryMarks.markOf(job({ bookingState: 'cancelled', cancelledBy: 'staff' })), 'hidden');
  assert.equal(DiaryMarks.markOf(job({ bookingState: 'declined' })), 'hidden');
  assert.equal(DiaryMarks.markOf(job({ bookingState: 'expired' })), 'hidden');
});

test('a change request outline belongs only on its day, for a shown mechanic', () => {
  const items = [newItem, changeItem];
  const all = () => true;
  assert.deepEqual(DiaryMarks.outlinesOn(items, '2026-10-09', all).map((i) => i.jobId), [2]);
  assert.deepEqual(DiaryMarks.outlinesOn(items, '2026-10-08', all), []);
  assert.deepEqual(DiaryMarks.outlinesOn(items, '2026-10-09', (m) => m === 8), []);
  const untimed = { ...changeItem, to: { ...changeItem.to, startTime: '' } };
  assert.deepEqual(DiaryMarks.outlinesOn([untimed], '2026-10-09', all), []);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test tests/diary-rules.test.js`
Expected: FAIL with ENOENT for `public/diary-waiting.js`.

- [ ] **Step 3: Implement** — create `public/diary-waiting.js`

```js
'use strict';
// "Waiting for you" card wording for the staff diary (public/app.js).
// A plain script: sets globalThis.DiaryWaiting, which app.js reads and
// tests/diary-rules.test.js loads through vm.
// Spec: docs/superpowers/specs/2026-09-27-staff-diary-waiting-design.md
(function () {
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Worked out in UTC from the date's own digits, so the machine's time zone
  // can't move it to the day before.
  function dayDate(iso) {
    const [y, m, d] = String(iso).split('-').map(Number);
    const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    return `${DAYS[weekday]} ${d} ${MONTHS[m - 1]}`;
  }

  function slotText(slot) {
    if (!slot || !slot.jobDate) return '';
    let text = dayDate(slot.jobDate);
    if (slot.startTime) text += `, ${slot.startTime}${slot.endTime ? `–${slot.endTime}` : ''}`;
    if (slot.mechanicName) text += ` · ${slot.mechanicName}`;
    return text;
  }

  function plural(n, word) {
    return `${n} ${word}${n === 1 ? '' : 's'}`;
  }

  function arrivedText(arrivedAt, now) {
    const minutes = Math.floor((now.getTime() - new Date(arrivedAt).getTime()) / 60000);
    if (minutes < 1) return 'Arrived just now';
    if (minutes < 60) return `Arrived ${plural(minutes, 'minute')} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Arrived ${plural(hours, 'hour')} ago`;
    return `Arrived ${plural(Math.floor(hours / 24), 'day')} ago`;
  }

  function moveText(from, to) {
    const end = (s) => `${dayDate(s.jobDate)}${s.startTime ? ` ${s.startTime}` : ''}`;
    const withWho = to.mechanicId !== from.mechanicId && to.mechanicName ? ` with ${to.mechanicName}` : '';
    return `${end(from)} → ${end(to)}${withWho}`;
  }

  const KINDS = {
    new_booking: { tone: 'new', label: 'New booking' },
    change_request: { tone: 'change', label: 'Change request' },
    customer_cancelled: { tone: 'cancelled', label: 'Cancelled by customer' },
  };

  function cardFor(item, now) {
    const kind = KINDS[item.kind];
    return {
      tone: kind.tone,
      label: kind.label,
      customer: item.customerName || 'Customer',
      reference: item.reference || '',
      services: (item.serviceNames || []).join(', '),
      when: item.kind === 'change_request' ? moveText(item.from, item.to) : slotText(item),
      arrived: arrivedText(item.arrivedAt, now),
    };
  }

  globalThis.DiaryWaiting = { dayDate, slotText, arrivedText, moveText, cardFor };
})();
```

Create `public/diary-marks.js`:

```js
'use strict';
// How the staff diary grid draws a job, and where a change request's dashed
// outline goes. Sets globalThis.DiaryMarks (see diary-waiting.js).
// Spec: docs/superpowers/specs/2026-09-27-staff-diary-waiting-design.md
(function () {
  const GONE = ['cancelled', 'declined', 'expired'];

  function markOf(job) {
    const state = job.bookingState;
    if (state === 'reschedule_requested' && job.requested) return 'move-requested';
    if (state === 'cancelled' && job.cancelledBy === 'customer' && !job.cancellationSeenAt) return 'cancelled-unseen';
    if (GONE.includes(state)) return 'hidden';
    return 'normal';
  }

  // Drawn from the waiting list, which is shop-wide: a job booked in another
  // week can still ask for a time in this one.
  function outlinesOn(items, dateStr, mechanicOk) {
    return items.filter((i) => i.kind === 'change_request' && i.to && i.to.jobDate === dateStr
      && i.to.startTime && mechanicOk(i.to.mechanicId));
  }

  globalThis.DiaryMarks = { markOf, outlinesOn };
})();
```

- [ ] **Step 4: Run to verify they pass**

Run: `node --test tests/diary-rules.test.js`
Expected: PASS. (`deepEqual` on `{ ...card }` because objects made inside a `vm` context have a different `Object.prototype`.)

- [ ] **Step 5: Show each test failing by a targeted break** — one break per test, restore after each:
  - `dayDate`: use `new Date(iso).getDay()` → fails under `TZ=America/New_York node --test tests/diary-rules.test.js` (run it that way for this break).
  - `slotText`: drop the `mechanicName` clause → slot test fails.
  - `arrivedText`: change `minutes < 60` to `minutes <= 60` → boundary test fails.
  - new booking card: change the label to `'New request'` → fails.
  - change card: swap `from`/`to` in `moveText` call → fails.
  - other mechanic: drop `withWho` → fails.
  - cancellation card: tone `'cancel'` → fails.
  - no name: remove `|| 'Customer'` → fails.
  - markings: remove the `cancellationSeenAt` condition → fails.
  - outlines: remove `mechanicOk(...)` → fails.

- [ ] **Step 6: Commit**

```bash
git add public/diary-waiting.js public/diary-marks.js tests/diary-rules.test.js
git commit -m "feat: diary rules for waiting cards and grid markings"
```

---

### Task 4: Rule script — review pop-up wording

**Files:**
- Create: `public/diary-review.js`
- Modify: `tests/diary-rules.test.js`

**Interfaces:**
- Consumes: `DiaryWaiting.dayDate`, `DiaryWaiting.slotText` (loaded first).
- Produces `DiaryReview`:
  - `headingFor(item) → 'New online booking · WH-1042'`
  - `answerText(entry) → string` for a frozen answer `{ serviceId, id, wording, kind, answer, text? }` where `answer` is a string, `null`, or `{ notSure: true }`
  - `groupAnswers(questionAnswers|null, services: [{id,name}]) → [{ name, answers: entry[] }]`
  - `changeLine(item) → 'Customer asked to move from Wed 7 Oct, 10:00–11:00 · Dave to Fri 9 Oct, 14:00–15:00 · Dave'`
  - `declineConfirmText(item) → "Decline Sam Example's booking for Tue 6 Oct? This can't be undone."`
  - `refusalText(err: { status?, code?, message }) → string`

- [ ] **Step 1: Write the failing tests** (append to `tests/diary-rules.test.js`)

```js
const { DiaryReview } = loadRules();

test('pop-up headings name the kind and reference', () => {
  assert.equal(DiaryReview.headingFor(newItem), 'New online booking · WH-1042');
  assert.equal(DiaryReview.headingFor(changeItem), 'Change request · WH-1038');
  assert.equal(DiaryReview.headingFor({ ...cancelledItem, reference: null }), 'Cancelled by customer');
});

test('each kind of answer reads plainly', () => {
  assert.equal(DiaryReview.answerText({ kind: 'text', answer: 'Gears slipping' }), 'Gears slipping');
  assert.equal(DiaryReview.answerText({ kind: 'text', answer: null }), 'No answer');
  assert.equal(DiaryReview.answerText({ kind: 'choice', answer: 'Yes', text: null }), 'Yes');
  assert.equal(DiaryReview.answerText({ kind: 'choice', answer: 'No', text: 'rear only' }), 'No — rear only');
  assert.equal(DiaryReview.answerText({ kind: 'choice', answer: { notSure: true }, text: null }), 'Not sure');
  assert.equal(DiaryReview.answerText({ kind: 'choice', answer: null, text: 'see photo' }), 'see photo');
});

test('answers group under their service, in service order', () => {
  const answers = [
    { serviceId: 4, id: 'b', wording: 'Which brakes?', kind: 'choice', answer: { notSure: true }, text: null },
    { serviceId: 3, id: 'a', wording: "What's wrong?", kind: 'text', answer: 'Gears slipping' },
    { serviceId: 99, id: 'c', wording: 'Old question', kind: 'text', answer: 'x' },
  ];
  const groups = DiaryReview.groupAnswers(answers, newItem.services);
  assert.deepEqual(groups.map((g) => [g.name, g.answers.map((a) => a.id)]), [
    ['Full service', ['a']], ['Brake bleed', ['b']], ['Other answers', ['c']],
  ]);
  assert.deepEqual([...DiaryReview.groupAnswers(null, newItem.services)], []);
});

test('the change line names both times', () => {
  assert.equal(DiaryReview.changeLine(changeItem),
    'Customer asked to move from Wed 7 Oct, 10:00–11:00 · Dave to Fri 9 Oct, 14:00–15:00 · Dave');
});

test('the decline confirmation names the customer and day', () => {
  assert.equal(DiaryReview.declineConfirmText(newItem), "Decline Sam Example's booking for Tue 6 Oct? This can't be undone.");
  assert.equal(DiaryReview.declineConfirmText({ ...newItem, customerName: null }), "Decline this booking for Tue 6 Oct? This can't be undone.");
});

test('each refusal becomes a plain sentence', () => {
  assert.equal(DiaryReview.refusalText({ status: 409, code: 'stale', message: 'x' }), 'This job changed while you were looking at it.');
  assert.equal(DiaryReview.refusalText({ status: 409, code: 'capacity', message: 'x' }), 'The requested time is no longer free.');
  assert.equal(DiaryReview.refusalText({ status: 409, code: 'illegal', message: "There's no change request to accept" }), "There's no change request to accept");
  assert.equal(DiaryReview.refusalText({ status: 404, message: 'Job not found' }), 'This job no longer exists.');
  assert.equal(DiaryReview.refusalText({ message: 'Failed to fetch' }), "Couldn't reach the server — try again.");
  assert.equal(DiaryReview.refusalText({ status: 400, message: 'A valid date is required' }), 'A valid date is required');
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test tests/diary-rules.test.js`
Expected: FAIL with ENOENT for `public/diary-review.js`.

- [ ] **Step 3: Implement** — create `public/diary-review.js`

```js
'use strict';
// Wording for the staff diary's review pop-up. Needs diary-waiting.js loaded
// first. Sets globalThis.DiaryReview (see diary-waiting.js).
// Spec: docs/superpowers/specs/2026-09-27-staff-diary-waiting-design.md
(function () {
  const { dayDate, slotText } = globalThis.DiaryWaiting;

  const HEADINGS = {
    new_booking: 'New online booking',
    change_request: 'Change request',
    customer_cancelled: 'Cancelled by customer',
  };

  function headingFor(item) {
    return HEADINGS[item.kind] + (item.reference ? ` · ${item.reference}` : '');
  }

  function answerText(entry) {
    let main;
    if (entry.answer && typeof entry.answer === 'object' && entry.answer.notSure) main = 'Not sure';
    else if (entry.answer === null || entry.answer === undefined || entry.answer === '') main = '';
    else main = String(entry.answer);
    const extra = entry.text || '';
    if (main && extra) return `${main} — ${extra}`;
    return main || extra || 'No answer';
  }

  // Answers whose service has since left the booking still show, last.
  function groupAnswers(answers, services) {
    const list = answers || [];
    const groups = services
      .map((s) => ({ name: s.name, answers: list.filter((a) => a.serviceId === s.id) }))
      .filter((g) => g.answers.length);
    const known = new Set(services.map((s) => s.id));
    const rest = list.filter((a) => !known.has(a.serviceId));
    if (rest.length) groups.push({ name: 'Other answers', answers: rest });
    return groups;
  }

  function changeLine(item) {
    return `Customer asked to move from ${slotText(item.from)} to ${slotText(item.to)}`;
  }

  function declineConfirmText(item) {
    const whose = item.customerName ? `${item.customerName}'s` : 'this';
    return `Decline ${whose} booking for ${dayDate(item.jobDate)}? This can't be undone.`;
  }

  // err comes from app.js api(): status and code are set for a server answer;
  // a request that never reached the server has neither.
  function refusalText(err) {
    if (err.code === 'stale') return 'This job changed while you were looking at it.';
    if (err.code === 'capacity') return 'The requested time is no longer free.';
    if (err.status === 404) return 'This job no longer exists.';
    if (err.status === undefined) return "Couldn't reach the server — try again.";
    return err.message;
  }

  globalThis.DiaryReview = { headingFor, answerText, groupAnswers, changeLine, declineConfirmText, refusalText };
})();
```

- [ ] **Step 4: Run to verify they pass**

Run: `node --test tests/diary-rules.test.js`
Expected: PASS.

- [ ] **Step 5: Show each new test failing by a targeted break** (restore after each): heading without reference guard; `answerText` returning `main` only (drops `— text`); `groupAnswers` without the `rest` group; `changeLine` with `from`/`to` swapped; `declineConfirmText` without the null-name branch; `refusalText` without the `status === undefined` branch.

- [ ] **Step 6: Commit**

```bash
git add public/diary-review.js tests/diary-rules.test.js
git commit -m "feat: diary rules for the review pop-up wording"
```

---

### Task 5: Diary saves send the version; api() errors carry status and code

**Files:**
- Modify: `public/app.js` (`api()` 110-127; drag `onUp` 1944-1968; resize `onUp` 2014-2025; `approveJob` 2248-2256; complete toggle 6404-6427; form submit 6429-6461)
- Test: `tests/browser/diary-waiting.spec.ts` (created here; later tasks add to it)

**Interfaces:**
- Produces: `api()` throws `Error` with `.status` (number) and `.code` (string|undefined) for a server answer; a network failure throws the original `TypeError` (no `.status`). Every legacy PUT from the diary sends `version`.
- Produces for later tasks: the Playwright fixture in `tests/browser/diary-waiting.spec.ts` — `server`, `owner`, `shop`, `sam`, `svc` (a service with questions), `customer`, helpers `signIn(context)`, `book(overrides)`, `staff(path, options)`, `openDiary(page)`.

- [ ] **Step 1: Write the fixture and the failing test** — create `tests/browser/diary-waiting.spec.ts`

Read `tests/browser/book-journey.spec.ts` lines 1-81 first and copy its imports, `test.describe.configure`, `beforeAll` shop setup (opening days, bookable settings) and `afterAll` teardown, then shape it like this:

```ts
// Loads .env before server/db.js builds its pool (CI sets DATABASE_URL itself).
import '../../server/load-env.js';
import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { pool } from '../../server/db.js';
import { startLiveServer, TEST_CLOCK_PIN } from '../helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from '../helpers/staff.js';
import { portalSignup } from '../helpers/portal.js';
import { deleteTestShop } from '../helpers/testShop.js';
import { bookOnline, dayMaker, linkActions } from '../helpers/linkActions.js';
import { purgeAttachmentFiles } from '../helpers/workshopFixtures.js';

// The legacy staff diary (public/app.js, #workshop): "Waiting for you", the
// review pop-up and the grid markings.
// Spec: docs/superpowers/specs/2026-09-27-staff-diary-waiting-design.md
let server: { baseUrl: string; stop: () => Promise<void> } | undefined;
let owner: { cookie: string; shop: { id: number; slug: string } };
let sam: number;
let svc: { id: number; questions: { id: string; wording: string }[] };
let customer: { cookie: string };
const nextDay = dayMaker();

test.describe.configure({ timeout: 90_000 });
test.use({ timezoneId: 'Europe/London', viewport: { width: 1400, height: 900 } });

test.beforeAll(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl, { shopName: 'Diary Cycles' });
  sam = await seedMechanic(owner.shop.id, { name: 'Sam' });
  // + whatever book-journey.spec.ts's beforeAll does to make the shop bookable
  svc = (await staff('/api/workshop-services', {
    method: 'POST',
    body: {
      name: 'Brake check', price: 20, minutes: 60, bookableOnline: true,
      questions: [{ wording: "What's wrong?", kind: 'text', required: true }],
    },
  })).body;
  customer = await portalSignup(server.baseUrl, owner.shop.slug, {});
});

test.afterAll(async () => {
  try {
    if (owner) { await purgeAttachmentFiles(owner.shop.id); await deleteTestShop(owner.shop.id); }
  } finally {
    try { if (server) await server.stop(); } finally { await pool.end(); }
  }
});

function staff(path: string, options?: object) {
  return staffRequest(server!.baseUrl, owner.cookie, path, options);
}

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

async function book(overrides: object = {}) {
  return bookOnline(server!.baseUrl, customer.cookie, owner.shop.slug, {
    mechanicId: sam, jobDate: nextDay(), startTime: '10:00', serviceIds: [svc.id],
    answers: [{ serviceId: svc.id, questionId: svc.questions[0].id, text: 'Gears slipping' }],
    ...overrides,
  });
}

async function signIn(context: BrowserContext) {
  const [name, value] = owner.cookie.split('=');
  await context.addCookies([{ name, value, url: server!.baseUrl }]);
}

async function openDiary(page: Page) {
  await page.clock.setFixedTime(new Date(TEST_CLOCK_PIN));
  await page.goto(`${server!.baseUrl}/#workshop`);
  await expect(page.locator('#workshop-feed')).toBeVisible();
}

test('a diary drag on a copy someone else has changed is refused and the diary reloads', async ({ page, context }) => {
  const booked = await book();
  await staff(`/api/workshop-jobs/${booked.id}/accept`, { method: 'POST', body: { version: 1 } });
  await signIn(context);
  await openDiary(page);
  const block = page.locator(`.wk-job-block[data-job="${booked.id}"]`);
  await goToWeekOf(page, block);
  // Someone else saves the job after the diary loaded it.
  await staff(`/api/workshop-jobs/${booked.id}`, { method: 'PUT', body: { notes: 'Changed elsewhere' } });
  // Drag the block down one hour.
  const box = (await block.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + 10);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + 10 + 48, { steps: 5 });
  await page.mouse.up();
  await expect(page.locator('#toast')).toContainText('This job changed while you were looking at it.');
  const after = (await staff(`/api/workshop-jobs/${booked.id}`)).body;
  expect(after.startTime).toBe('10:00');
});
```

Notes for this step:
- Check how `bookOnline` returns the booked date (`booked.jobDate` or the request's `jobDate`); if the response lacks it, keep the date from `nextDay()` in a local variable.
- Reaching the job's week: `dayMaker()` dates are ≥3 weeks after the pinned clock. Add this helper to the spec:

```ts
// Clicks "Next ›" until the job's block is drawn (at most 8 weeks on).
async function goToWeekOf(page: Page, block: ReturnType<Page['locator']>) {
  for (let i = 0; i < 8 && !(await block.isVisible()); i += 1) {
    await page.locator('#week-next').click();
    await page.waitForLoadState('networkidle');
  }
  await expect(block).toBeVisible();
}
```
- Drag geometry: `WORKSHOP_ROW_PX = 48` per hour, drag threshold 4px (`wireJobBlockMove`, app.js 1878).
- Check Playwright 1.63's `page.clock.setFixedTime` still lets `setTimeout`/`setInterval` fire (the docs for the installed version, `node_modules/playwright-core/types/types.d.ts` or the Playwright site); record what you found.

- [ ] **Step 2: Run to verify it fails**

Run: `npx playwright test tests/browser/diary-waiting.spec.ts`
Expected: FAIL — the drag goes through (no version sent), the toast shows "Job updated"-style silence or nothing, and `after.startTime` is `'11:00'`.

- [ ] **Step 3: Implement**

`api()`, replace line 125:

```js
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.code = data.code;
    throw err;
  }
```

A save refusal message helper, next to `approveJob`:

```js
// A refused diary save says why in plain words (DiaryReview.refusalText);
// a stale one means someone else changed the job, so the caller redraws.
function saveRefusalText(err) {
  return DiaryReview.refusalText(err);
}
```

Drag `onUp`: add `version: job.version` to `body` (`const body = { jobDate: pendingDate, startTime: newStart, endTime: newEnd, version: job.version };`) and `showToast(saveRefusalText(err))` in the catch.

Resize `onUp`: `body: { startTime: pendingStart, endTime: pendingEnd, version: job.version }`, and `showToast(saveRefusalText(err))`.

`approveJob`: `body: { status: 'scheduled', version: job.version }`, `showToast(saveRefusalText(err))` and, on a stale refusal, `await renderWorkshop()` as well.

Complete toggle: add `version: job.version` to both bodies; after a successful PUT set `job.version = saved.version` so a later Save in the same open form doesn't refuse itself.

Form submit: when `isEdit`, add `body.version = job.version`. In the catch, `showToast(saveRefusalText(err))`; if `err.code === 'stale'`, `closeModal()` and `await renderWorkshop()` when `#week-diaries` exists.

- [ ] **Step 4: Run to verify it passes**

Run: `npx playwright test tests/browser/diary-waiting.spec.ts`
Expected: PASS.

- [ ] **Step 5: Show it failing by a targeted break**: remove `version: job.version` from the drag body → the test fails (start becomes 11:00). Restore.

- [ ] **Step 6: Check nothing else broke**

Run: `npm test && npx playwright test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add public/app.js tests/browser/diary-waiting.spec.ts
git commit -m "feat: diary saves send the version and say plainly when refused"
```

---

### Task 6: The "Waiting for you" column

**Files:**
- Modify: `public/index.html`, `public/app.js` (state ~63; `loadPendingFeed` 256-258; `renderWorkshop` 1477 and 1535; `renderPendingFeed`/`jumpToPendingJob` 1627-1674; `hashchange` 320-323), `public/styles.css` (~751-797)
- Test: `tests/browser/diary-waiting.spec.ts`

**Interfaces:**
- Consumes: `DiaryWaiting.cardFor`, `GET /api/workshop-waiting` (`{count, items}`), Task 5's fixture.
- Produces: `let waitingFeed = { count: 0, items: [] }` and `let waitingIds = new Set()` in app.js (Task 7 and 8 read both); `async function loadWaitingFeed()`; `function renderWaitingFeed()`; `jumpToJob({ id, jobDate })` (renamed from `jumpToPendingJob`, same behaviour); each card is `<button class="waiting-card tone-<tone>" data-job="<id>">`.

- [ ] **Step 1: Write the failing tests** (add to the spec)

```ts
test('a new online booking is listed with its details, and clicking it jumps to the job', async ({ page, context }) => {
  const booked = await book();
  await signIn(context);
  await openDiary(page);
  const card = page.locator(`.waiting-card[data-job="${booked.id}"]`);
  await expect(page.locator('.workshop-feed-title')).toHaveText(/^Waiting for you \(\d+\)$/);
  await expect(card).toContainText('New booking');
  await expect(card).toContainText('Brake check');
  await expect(card).toContainText('Sam');
  await expect(card).toContainText(/Arrived (just now|\d+ minutes? ago)/);
  await card.click();
  const block = page.locator(`.wk-job-block[data-job="${booked.id}"]`);
  await expect(block).toBeInViewport();
  await expect(block).toHaveClass(/flash-highlight/);
});

test('a staff-made pending job is not listed', async ({ page, context }) => {
  const made = (await staff('/api/workshop-jobs', {
    method: 'POST', body: { title: 'Staff pending', jobDate: nextDay(), startTime: '12:00', endTime: '13:00', mechanicId: sam, status: 'pending' },
  })).body;
  await signIn(context);
  await openDiary(page);
  await expect(page.locator('.workshop-feed-title')).toBeVisible();
  await expect(page.locator(`.waiting-card[data-job="${made.id}"]`)).toHaveCount(0);
});

test('the column picks up a new booking within a minute without a click', async ({ page, context }) => {
  await signIn(context);
  await page.clock.install({ time: new Date(TEST_CLOCK_PIN) });
  await page.goto(`${server!.baseUrl}/#workshop`);
  await expect(page.locator('#workshop-feed')).toBeVisible();
  const booked = await book();
  await expect(page.locator(`.waiting-card[data-job="${booked.id}"]`)).toHaveCount(0);
  await page.clock.fastForward(61_000);
  await expect(page.locator(`.waiting-card[data-job="${booked.id}"]`)).toBeVisible();
});
```

The empty-column wording (`Nothing waiting`) is covered in Task 8's last test, once every item in the shop has been answered.

If `POST /api/workshop-jobs` refuses `status: 'pending'` or needs other fields, read the route (server.js ~2939) and adjust the body; record it.

- [ ] **Step 2: Run to verify they fail**

Run: `npx playwright test tests/browser/diary-waiting.spec.ts`
Expected: the three new tests FAIL (title reads "Pending requests", no `.waiting-card`).

- [ ] **Step 3: Implement**

`public/index.html`, before `<script src="/app.js"></script>`:

```html
  <script src="/diary-waiting.js"></script>
  <script src="/diary-marks.js"></script>
  <script src="/diary-review.js"></script>
```

`public/app.js`: replace `pendingFeedJobs` (line 63) with:

```js
let waitingFeed = { count: 0, items: [] }; // GET /api/workshop-waiting - shop-wide, oldest first; powers "Waiting for you"
let waitingIds = new Set(); // job ids in waitingFeed - a job in here opens the review pop-up
let waitingTimer = null; // the column's minute check while #workshop is showing
```

Replace `loadPendingFeed` with:

```js
// What customers are waiting on staff for (piece 12): new online bookings,
// change requests and unseen cancellations, whichever week they're in.
async function loadWaitingFeed() {
  waitingFeed = await api('/api/workshop-waiting');
  waitingIds = new Set(waitingFeed.items.map((i) => i.jobId));
}

// The column checks every minute while the Workshop tab shows; it redraws
// only itself, never the grid. A failed check keeps the last list.
function startWaitingTimer() {
  if (waitingTimer) return;
  waitingTimer = setInterval(async () => {
    if (topTab() !== 'workshop') return stopWaitingTimer();
    try {
      await loadWaitingFeed();
      renderWaitingFeed();
    } catch (_) { /* keep the last list; try again next minute */ }
  }, 60_000);
}

function stopWaitingTimer() {
  if (waitingTimer) clearInterval(waitingTimer);
  waitingTimer = null;
}
```

In `renderWorkshop`: `await loadPendingFeed();` → `await loadWaitingFeed();`; `renderPendingFeed();` → `renderWaitingFeed(); startWaitingTimer();`.

In the `hashchange` listener, before `renderRoute()`: `if (topTab() !== 'workshop') stopWaitingTimer();` (after `route` is updated).

Replace `renderPendingFeed` with:

```js
// "Waiting for you": one card per thing a customer is waiting on staff for,
// oldest first (the server's order). Clicking a card jumps to the job.
function renderWaitingFeed() {
  const wrap = document.getElementById('workshop-feed');
  if (!wrap) return;
  const now = new Date();
  const cards = waitingFeed.items.map((item) => {
    const c = DiaryWaiting.cardFor(item, now);
    return `
      <button class="waiting-card tone-${c.tone}" data-job="${item.jobId}">
        <span class="waiting-tag">${esc(c.label)}</span>
        <span class="waiting-who">${esc(c.customer)}${c.reference ? ` · ${esc(c.reference)}` : ''}</span>
        ${c.services ? `<span class="waiting-line">${esc(c.services)}</span>` : ''}
        <span class="waiting-line muted">${esc(c.when)}</span>
        <span class="waiting-line muted">${esc(c.arrived)}</span>
      </button>`;
  }).join('');
  wrap.innerHTML = `
    <h2 class="workshop-feed-title">Waiting for you (${waitingFeed.count})</h2>
    ${cards || '<div class="empty-state">Nothing waiting</div>'}
  `;
  wrap.querySelectorAll('.waiting-card').forEach((btn) => {
    btn.addEventListener('click', () => {
      const item = waitingFeed.items.find((i) => i.jobId === Number(btn.dataset.job));
      if (item) jumpToJob({ id: item.jobId, jobDate: item.jobDate });
    });
  });
}
```

Rename `jumpToPendingJob(job)` to `jumpToJob(job)` (body unchanged; update its comment to say it serves the waiting column) and extend the target lookup so an unscheduled job's card is found too:

```js
  const target = document.querySelector(`.wk-job-block[data-job="${job.id}"], .job-card[data-job="${job.id}"]`);
```

`grep -n "pendingFeedJobs\|loadPendingFeed\|renderPendingFeed\|jumpToPendingJob" public/app.js` must return nothing when done.

`public/styles.css`: replace the `.pending-feed-item` rules (770-786) with `.waiting-card` rules using existing tokens only — base card like the old item (full width, left-aligned, border `var(--border)`, radius as the old item); `.waiting-tag` a small pill; `.tone-new .waiting-tag` → `--status-pending-bg` / `--status-pending-ink`; `.tone-change .waiting-tag` → `--warn-bg` / `--warn-ink`; `.tone-cancelled .waiting-tag` → `--surface-sunken` / `--muted`; `.waiting-who` weight 600; `.waiting-line.muted` colour `var(--muted)`. Keep `.workshop-feed`, `.flash-highlight` and the 980px rule as they are.

- [ ] **Step 4: Run to verify they pass**

Run: `npx playwright test tests/browser/diary-waiting.spec.ts && node --test tests/design-tokens.test.js`
Expected: PASS.

- [ ] **Step 5: Show each new test failing by a targeted break** (restore after each):
  - first test: drop `jumpToJob(...)` from the card click → fails on `toBeInViewport`.
  - second test: point `loadWaitingFeed` at `/api/workshop-jobs?status=pending` mapped to items → staff job listed, fails. (Or: add the staff job id to `waitingIds` by hand.) Choose one and record it.
  - third test: make `startWaitingTimer` return immediately → fails.

- [ ] **Step 6: Commit**

```bash
git add public/index.html public/app.js public/styles.css tests/browser/diary-waiting.spec.ts
git commit -m "feat: Waiting for you column in the staff diary"
```

---

### Task 7: Grid markings — move requested, dashed outline, cancelled until seen

**Files:**
- Modify: `public/app.js` (`visibleWorkshopJobs` 1619; `renderJobCard` 1801; `renderTimedDayColumn` 1832-1867; `renderMonthJobChip` 2341; `wireGridInteractions` 2285-2334; the tooltip/context-menu wiring as needed), `public/styles.css`
- Test: `tests/browser/diary-waiting.spec.ts`

**Interfaces:**
- Consumes: `DiaryMarks.markOf`, `DiaryMarks.outlinesOn`, `waitingFeed` (Task 6).
- Produces: blocks/cards/chips carry `mark-move-requested` or `mark-cancelled-unseen` classes; outlines are `<div class="wk-request-outline" data-job="<id>">`; `mechanicShown(mechanicId)` applies the same mechanic rule as `visibleWorkshopJobs`. Clicking an outline or a greyed cancellation calls `openReview(jobId)`. Task 8 implements `openReview`; this task adds an empty stub for it so the wiring exists and is tested there.

- [ ] **Step 1: Write the failing tests**

```ts
test('a change request shows amber on the job and a dashed outline at the requested time', async ({ page, context }) => {
  const booked = await book();
  await staff(`/api/workshop-jobs/${booked.id}/accept`, { method: 'POST', body: { version: 1 } });
  // Same week as the booking: the next weekday in dayMaker's sequence may be in
  // another week, so ask for 14:00 on the booking's own day.
  const link = linkActions(server!.baseUrl, owner.shop.slug);
  const res = await link.change(booked.code, { jobDate: booked.jobDate, mechanicId: sam, startTime: '14:00' });
  expect(res.status).toBe(200);
  await signIn(context);
  await openDiary(page);
  await page.locator(`.waiting-card[data-job="${booked.id}"]`).click();
  const block = page.locator(`.wk-job-block[data-job="${booked.id}"]`);
  await expect(block).toHaveClass(/mark-move-requested/);
  await expect(block).toContainText('Move requested');
  const outline = page.locator(`.wk-request-outline[data-job="${booked.id}"]`);
  await expect(outline).toBeVisible();
  const [b, o] = [(await block.boundingBox())!, (await outline.boundingBox())!];
  expect(Math.round(o.y - b.y)).toBe(4 * 48); // 10:00 → 14:00 at 48px an hour
});

test("a customer's cancellation shows greyed until seen, and a declined booking is not drawn", async ({ page, context }) => {
  const cancelled = await book();
  const declined = await book();
  const link = linkActions(server!.baseUrl, owner.shop.slug);
  expect((await link.cancel(cancelled.code)).status).toBe(200);
  await staff(`/api/workshop-jobs/${declined.id}/decline`, { method: 'POST', body: { version: 1 } });
  await signIn(context);
  await openDiary(page);
  await page.locator(`.waiting-card[data-job="${cancelled.id}"]`).click();
  const block = page.locator(`.wk-job-block[data-job="${cancelled.id}"]`);
  await expect(block).toHaveClass(/mark-cancelled-unseen/);
  await expect(block).toContainText('Cancelled by customer');
  await expect(block.locator('.wk-resize-handle')).toHaveCount(0);
  await expect(page.locator(`[data-job="${declined.id}"]`)).toHaveCount(0);
});
```

If `bookOnline`'s response lacks `jobDate`, keep the date from the request (see Task 5 note). If the requested 14:00 falls outside opening hours in the seeded shop, pick a start inside them and adjust the pixel arithmetic.

- [ ] **Step 2: Run to verify they fail**

Run: `npx playwright test tests/browser/diary-waiting.spec.ts`
Expected: the two new tests FAIL (no mark classes; declined block present as "Complete").

- [ ] **Step 3: Implement**

`visibleWorkshopJobs`: drop hidden jobs first, and pull the mechanic rule out so outlines share it:

```js
function mechanicShown(mechanicId) {
  if (workshopMechanicFilter === 'all') return true;
  if (workshopMechanicFilter === 'unassigned') return !mechanicId;
  if (Array.isArray(workshopMechanicFilter)) return workshopMechanicFilter.includes(mechanicId);
  return mechanicId === workshopMechanicFilter;
}

// Cancelled, declined and expired bookings aren't drawn - except a
// customer's cancellation nobody has seen yet (staff diary piece).
function visibleWorkshopJobs() {
  return workshopJobs.filter((j) => DiaryMarks.markOf(j) !== 'hidden' && mechanicShown(j.mechanicId));
}
```

A shared helper for the class and label:

```js
const MARK_LABELS = { 'move-requested': 'Move requested', 'cancelled-unseen': 'Cancelled by customer' };
function markClass(j) {
  const mark = DiaryMarks.markOf(j);
  return mark === 'normal' ? '' : ` mark-${mark}`;
}
function statusLabel(j) {
  return MARK_LABELS[DiaryMarks.markOf(j)] || JOB_STATUS_LABELS[j.status] || JOB_STATUS_LABELS.scheduled;
}
```

In `renderJobCard`, the timed block template and `renderMonthJobChip`: append `${markClass(j)}` to the class list and use `statusLabel(j)` for `.job-status-badge` (the chip has no badge; the class is enough). In the timed block, leave out both `.wk-resize-handle` divs when `DiaryMarks.markOf(j) === 'cancelled-unseen'`.

Outlines in `renderTimedDayColumn`, before the `return`:

```js
  const mechanicOk = (id) => (mechanicId !== undefined ? id === mechanicId : mechanicShown(id));
  const outlinesHtml = DiaryMarks.outlinesOn(waitingFeed.items, dateStr, mechanicOk).map((item) => {
    const startMin = timeToMinutes(item.to.startTime);
    const endMin = timeToMinutes(item.to.endTime || minutesToTime(startMin + 60));
    const top = minutesToGridPx(Math.max(startMin, WORKSHOP_GRID_MIN));
    const height = Math.max(34, minutesToGridPx(Math.min(endMin, WORKSHOP_GRID_MAX)) - top);
    return `
      <div class="wk-request-outline" data-job="${item.jobId}" style="top:${top}px; height:${height}px;">
        <span>Requested</span><span>${esc(item.customerName || 'Customer')}</span>
      </div>`;
  }).join('');
```

and render `${blocksHtml}${outlinesHtml}` inside the column. Use the same top/height arithmetic as the job blocks (lines 1837-1846) — copy any clamping lines from there that this sketch leaves out.

In `wireGridInteractions`:
- skip `wireJobBlockMove`/`wireJobBlockResize` for a `cancelled-unseen` job; instead `blockEl.addEventListener('click', () => openReview(job.id))`;
- `wrap.querySelectorAll('.wk-request-outline').forEach((el) => el.addEventListener('click', (e) => { e.stopPropagation(); openReview(Number(el.dataset.job)); }));`

Add `function openReview(jobId) {} // Task 8 replaces this with the review pop-up` next to `approveJob`.

`public/styles.css` (existing tokens only):
- `.mark-move-requested` on `.wk-job-block`, `.job-card`, `.month-job-chip`: background `var(--status-on_hold-bg)`, border-colour `var(--status-on_hold-border)`, text `var(--status-on_hold-ink)`.
- `.mark-cancelled-unseen`: background `var(--surface-sunken)`, border-colour `var(--border)`, text `var(--muted)`, `text-decoration: line-through` on the title line only (not the badge), `cursor: pointer`.
- `.wk-request-outline`: `position: absolute; left: 4px; right: 4px; border: 2px dashed var(--status-on_hold-border); border-radius:` as the blocks; background transparent; text `var(--status-on_hold-ink)`; small font; `cursor: pointer`; `z-index` one below `.wk-job-block` so a real job on top stays clickable.

Check the existing `.wk-job-block` and month chip rules for `left/right`, radius and font sizes, and match them.

- [ ] **Step 4: Run to verify they pass**

Run: `npx playwright test tests/browser/diary-waiting.spec.ts && node --test tests/design-tokens.test.js tests/diary-rules.test.js`
Expected: PASS.

- [ ] **Step 5: Show each new test failing by a targeted break** (restore after each):
  - first test: render `${blocksHtml}` without `${outlinesHtml}` → outline not visible.
  - second test: remove the `markOf(j) !== 'hidden'` filter → the declined block is drawn.

- [ ] **Step 6: Commit**

```bash
git add public/app.js public/styles.css tests/browser/diary-waiting.spec.ts
git commit -m "feat: diary grid marks change requests and customer cancellations"
```

---

### Task 8: The review pop-up

**Files:**
- Modify: `public/app.js` (new `renderReviewJobModal`; `renderModal` dispatch ~4627; the four diary `openModal({ type: 'workshop-job-form', job })` sites at 1950, 2293, 2424, 5805; the context-menu Approve 2222-2227; `openReview` stub from Task 7), `public/styles.css`
- Test: `tests/browser/diary-waiting.spec.ts`

**Interfaces:**
- Consumes: `DiaryReview.*`, `DiaryWaiting.slotText`, `waitingFeed`/`waitingIds`/`loadWaitingFeed` (Task 6), `api()` errors with `.status`/`.code` (Task 5).
- Produces: `function openJob(job)` — review pop-up when `waitingIds.has(job.id)`, else the edit form; `function openReview(jobId)` — `openModal({ type: 'review-job', jobId })`. The modal root is `.modal.review-modal` with buttons whose text is exactly `Accept`, `Decline`, `Seen`, `Open full job`; the confirmation has `Decline booking` and `Keep booking`; the message line is `.review-message`.

- [ ] **Step 1: Write the failing tests**

```ts
async function openFromColumn(page: Page, id: number) {
  await page.locator(`.waiting-card[data-job="${id}"]`).click();
  await page.locator(`.wk-job-block[data-job="${id}"]`).click();
  await expect(page.locator('.review-modal')).toBeVisible();
}

test('the pop-up shows the answers, the photo and the notes, and Accept confirms the booking', async ({ page, context }) => {
  const booked = await book({ photos: [{ dataBase64: PNG.toString('base64'), contentType: 'image/png', filename: 'bike.png' }] });
  await signIn(context);
  await openDiary(page);
  await openFromColumn(page, booked.id);
  const modal = page.locator('.review-modal');
  await expect(modal).toContainText(`New online booking · ${booked.reference}`);
  await expect(modal).toContainText('Brake check');
  await expect(modal).toContainText("What's wrong?");
  await expect(modal).toContainText('Gears slipping');
  await expect(modal).toContainText("Customer's notes");
  await expect(modal).toContainText('Squeaky brakes');
  await expect(modal.locator('img.review-photo')).toHaveCount(1);
  expect(await modal.locator('img.review-photo').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  await modal.getByRole('button', { name: 'Accept', exact: true }).click();
  await expect(page.locator('.review-modal')).toHaveCount(0);
  await expect(page.locator(`.waiting-card[data-job="${booked.id}"]`)).toHaveCount(0);
  expect((await staff(`/api/workshop-jobs/${booked.id}`)).body.bookingState).toBe('scheduled');
});

test('Decline asks first; keeping the booking changes nothing, confirming declines it', async ({ page, context }) => {
  const booked = await book();
  await signIn(context);
  await openDiary(page);
  await openFromColumn(page, booked.id);
  const modal = page.locator('.review-modal');
  await modal.getByRole('button', { name: 'Decline', exact: true }).click();
  await expect(modal).toContainText("This can't be undone.");
  await modal.getByRole('button', { name: 'Keep booking' }).click();
  expect((await staff(`/api/workshop-jobs/${booked.id}`)).body.bookingState).toBe('pending');
  await modal.getByRole('button', { name: 'Decline', exact: true }).click();
  await modal.getByRole('button', { name: 'Decline booking' }).click();
  await expect(page.locator('.review-modal')).toHaveCount(0);
  expect((await staff(`/api/workshop-jobs/${booked.id}`)).body.bookingState).toBe('declined');
  await expect(page.locator(`[data-job="${booked.id}"]`)).toHaveCount(0);
});

test('a change request can be accepted from the pop-up or its outline, and declined', async ({ page, context }) => {
  const link = linkActions(server!.baseUrl, owner.shop.slug);
  const make = async () => {
    const b = await book();
    await staff(`/api/workshop-jobs/${b.id}/accept`, { method: 'POST', body: { version: 1 } });
    expect((await link.change(b.code, { jobDate: b.jobDate, mechanicId: sam, startTime: '14:00' })).status).toBe(200);
    return b;
  };
  const moved = await make();
  const kept = await make();
  await signIn(context);
  await openDiary(page);
  await page.locator(`.waiting-card[data-job="${moved.id}"]`).click();
  await page.locator(`.wk-request-outline[data-job="${moved.id}"]`).click();
  const modal = page.locator('.review-modal');
  await expect(modal).toContainText('Customer asked to move from');
  await modal.getByRole('button', { name: 'Accept', exact: true }).click();
  await expect(modal).toHaveCount(0);
  expect((await staff(`/api/workshop-jobs/${moved.id}`)).body.startTime).toBe('14:00');
  await openFromColumn(page, kept.id);
  await page.locator('.review-modal').getByRole('button', { name: 'Decline', exact: true }).click();
  await expect(page.locator('.review-modal')).toHaveCount(0); // no confirmation for a change
  const keptNow = (await staff(`/api/workshop-jobs/${kept.id}`)).body;
  expect([keptNow.startTime, keptNow.requested]).toEqual(['10:00', null]);
});

test("Seen takes a customer's cancellation off the list and the diary", async ({ page, context }) => {
  const booked = await book();
  expect((await linkActions(server!.baseUrl, owner.shop.slug).cancel(booked.code)).status).toBe(200);
  await signIn(context);
  await openDiary(page);
  await openFromColumn(page, booked.id);
  await page.locator('.review-modal').getByRole('button', { name: 'Seen' }).click();
  await expect(page.locator('.review-modal')).toHaveCount(0);
  await expect(page.locator(`[data-job="${booked.id}"]`)).toHaveCount(0);
});

test('answering something someone else already answered says so plainly', async ({ page, context }) => {
  const booked = await book();
  await signIn(context);
  await openDiary(page);
  await openFromColumn(page, booked.id);
  await staff(`/api/workshop-jobs/${booked.id}/accept`, { method: 'POST', body: { version: 1 } });
  await page.locator('.review-modal').getByRole('button', { name: 'Accept', exact: true }).click();
  await expect(page.locator('.review-message')).toHaveText('This job changed while you were looking at it.');
});

test('with everything answered the column reads "Nothing waiting"', async ({ page, context }) => {
  const { items } = (await staff('/api/workshop-waiting')).body;
  for (const item of items) {
    const job = (await staff(`/api/workshop-jobs/${item.jobId}`)).body;
    const action = { new_booking: 'decline', change_request: 'decline-change', customer_cancelled: 'cancellation-seen' }[item.kind as string];
    await staff(`/api/workshop-jobs/${item.jobId}/${action}`, { method: 'POST', body: { version: job.version } });
  }
  await signIn(context);
  await openDiary(page);
  await expect(page.locator('.workshop-feed-title')).toHaveText('Waiting for you (0)');
  await expect(page.locator('#workshop-feed')).toContainText('Nothing waiting');
});
```

Check `bookOnline`'s response for `reference` and `jobDate`; if absent, read the job (`staff('/api/workshop-jobs/:id')`) for them. Check the photo fields the booking route takes (`tests/portal-booking-photos.test.js:56-75`, `photoOf`) and match them. Count this file's link calls (every `book()`, `link.change`, `link.cancel`) against the 30-per-server limit; if over, start a second `startLiveServer()` in a second spec file for the change/cancel tests and record it.

- [ ] **Step 2: Run to verify they fail**

Run: `npx playwright test tests/browser/diary-waiting.spec.ts`
Expected: the six new tests FAIL (no `.review-modal`; the edit form opens instead). The last one fails only if Task 6's empty text is wrong — if it already passes, record that it was covered by Task 6 and break `Nothing waiting` to see it fail.

- [ ] **Step 3: Implement**

Routing. Add next to `approveJob`, replacing the Task 7 stub:

```js
// A job a customer is waiting on staff for opens the review pop-up; any other
// job opens the edit form as before (staff diary piece).
function openJob(job) {
  if (waitingIds.has(job.id)) openReview(job.id);
  else openModal({ type: 'workshop-job-form', job });
}

function openReview(jobId) {
  openModal({ type: 'review-job', jobId });
}
```

Replace `openModal({ type: 'workshop-job-form', job })` with `openJob(job)` at app.js 1950, 2293, 2424 and 5805 (read each site first; 5805 is inside the day-jobs modal — close that modal before opening, as the existing code does). Leave 6721 (Office documents) alone.

Context menu (2222-2227): `approveJob(job)` → `if (waitingIds.has(job.id)) openReview(job.id); else approveJob(job);`

`renderModal`: add `if (modal.type === 'review-job') return renderReviewJobModal(holder, modal.jobId);` beside the other workshop types.

The pop-up:

```js
// ================= WORKSHOP: REVIEW POP-UP =================
// What a customer sent, and the one answer staff owe them: Accept / Decline
// for a new booking or a change request, Seen for a cancellation.
// Spec: docs/superpowers/specs/2026-09-27-staff-diary-waiting-design.md
async function renderReviewJobModal(holder, jobId, message = '') {
  holder.innerHTML = `<div class="modal-backdrop" id="modal-backdrop"><div class="modal review-modal"><div class="empty-state">Loading…</div></div></div>`;
  let job;
  let photos;
  try {
    [job, photos] = await Promise.all([
      api(`/api/workshop-jobs/${jobId}`),
      api(`/api/workshop-jobs/${jobId}/attachments`),
      loadWaitingFeed(),
    ]);
  } catch (err) {
    return renderReviewShell(holder, { heading: 'Job', body: '', actions: '', message: DiaryReview.refusalText(err) });
  }
  if (!modal || modal.type !== 'review-job' || modal.jobId !== jobId) return; // closed while loading
  renderWaitingFeed();
  const item = waitingFeed.items.find((i) => i.jobId === jobId);
  if (!item) {
    return renderReviewShell(holder, {
      heading: 'Job', body: '<p>This is no longer waiting for an answer.</p>',
      actions: '<button class="btn" data-review="open">Open full job</button>', message, job,
    });
  }
  const answers = DiaryReview.groupAnswers(job.questionAnswers, item.services || []).map((g) => `
    <h3 class="review-service">${esc(g.name)}</h3>
    ${g.answers.map((a) => `<p class="review-answer"><span class="muted">${esc(a.wording)}</span> ${esc(DiaryReview.answerText(a))}</p>`).join('')}
  `).join('');
  const customerPhotos = (photos || []).filter((p) => p.fromCustomer && /^image\//.test(p.contentType));
  const photosHtml = customerPhotos.length ? `
    <h3 class="review-service">Photos</h3>
    <div class="review-photos">${customerPhotos.map((p) => `
      <img class="review-photo" src="/api/workshop-jobs/${jobId}/attachments/${p.id}" alt="${esc(p.originalName || 'Customer photo')}">`).join('')}
    </div>` : '';
  const notes = [job.customerBikeNote, job.customerDescription].filter(Boolean);
  const notesHtml = notes.length ? `<h3 class="review-service">Customer's notes</h3>${notes.map((n) => `<p>${esc(n)}</p>`).join('')}` : '';
  const whenHtml = item.kind === 'change_request'
    ? `<p class="review-change">${esc(DiaryReview.changeLine(item))}</p>`
    : `<p class="muted">${esc(item.customerName || 'Customer')} · ${esc(DiaryWaiting.slotText(item))}</p>`;
  const actions = item.kind === 'customer_cancelled'
    ? '<button class="btn" data-review="open">Open full job</button><button class="btn btn-primary" data-review="seen">Seen</button>'
    : '<button class="btn" data-review="open">Open full job</button><button class="btn" data-review="decline">Decline</button><button class="btn btn-primary" data-review="accept">Accept</button>';
  renderReviewShell(holder, {
    heading: DiaryReview.headingFor(item),
    body: `${item.kind === 'change_request' ? `<p class="muted">${esc(item.customerName || 'Customer')}</p>` : ''}${whenHtml}${answers}${photosHtml}${notesHtml}`,
    actions, message, job, item,
  });
}

function renderReviewShell(holder, { heading, body, actions, message, job, item }) {
  holder.innerHTML = `
    <div class="modal-backdrop" id="modal-backdrop">
      <div class="modal review-modal" role="dialog" aria-label="${esc(heading)}">
        <div class="modal-header"><h2>${esc(heading)}</h2><button class="btn btn-sm" id="modal-close" aria-label="Close">×</button></div>
        <div class="review-body">${body}</div>
        <p class="review-message" role="status">${esc(message || '')}</p>
        <div class="review-actions">${actions}</div>
      </div>
    </div>`;
  holder.querySelector('#modal-close').addEventListener('click', closeModal);
  holder.querySelectorAll('.review-photo').forEach((img) => img.addEventListener('click', () => img.classList.toggle('enlarged')));
  const on = (name, fn) => { const b = holder.querySelector(`[data-review="${name}"]`); if (b) b.addEventListener('click', fn); };
  on('open', () => openModal({ type: 'workshop-job-form', job }));
  on('seen', () => answerReview(holder, job, 'cancellation-seen'));
  on('accept', () => answerReview(holder, job, item.kind === 'change_request' ? 'accept-change' : 'accept'));
  on('decline', () => {
    if (item.kind === 'change_request') return answerReview(holder, job, 'decline-change');
    holder.querySelector('.review-actions').innerHTML = `
      <p class="review-confirm">${esc(DiaryReview.declineConfirmText(item))}</p>
      <button class="btn" data-review="keep">Keep booking</button>
      <button class="btn btn-danger" data-review="confirm-decline">Decline booking</button>`;
    on('keep', () => renderReviewJobModal(holder, job.id));
    on('confirm-decline', () => answerReview(holder, job, 'decline'));
  });
}

async function answerReview(holder, job, action) {
  holder.querySelectorAll('.review-actions button').forEach((b) => { b.disabled = true; });
  try {
    await api(`/api/workshop-jobs/${job.id}/${action}`, { method: 'POST', body: { version: job.version } });
  } catch (err) {
    const message = DiaryReview.refusalText(err);
    if (err.code === 'stale') return renderReviewJobModal(holder, job.id, message);
    if (err.status === 404) { await loadWaitingFeed().catch(() => {}); renderWaitingFeed(); }
    const line = holder.querySelector('.review-message');
    if (line) line.textContent = message;
    holder.querySelectorAll('.review-actions button').forEach((b) => { b.disabled = false; });
    return;
  }
  closeModal();
  if (document.getElementById('week-diaries')) await renderWorkshop();
}
```

Check the existing modal markup in `renderWorkshopJobFormModal` (5812 onward) for the class names it uses for the header, close button and backdrop click-to-close, and use the same ones (`modal-header` and `btn-danger` above are guesses — replace with what the file actually has, and record it). `renderReviewJobModal` with a `message` must show it after the reload, which is what the stale test checks.

Photos: `<img src>` sends the staff session cookie; the attachment route's `Content-Disposition: attachment` doesn't stop an `<img>` from drawing. Clicking toggles `.enlarged` (full width inside the pop-up) — the spec's "opening the full image".

`public/styles.css` (existing tokens only): `.review-modal` width like the job modal but narrower (max 560px); `.review-body` scrolls if tall; `.review-service` small heading; `.review-answer .muted` on its own line; `.review-photos` a flex row with gap; `.review-photo` 96×72, `object-fit: cover`, radius, `cursor: zoom-in`; `.review-photo.enlarged` `width: 100%; height: auto; cursor: zoom-out`; `.review-change` weight 600; `.review-message` colour `var(--danger)`, empty collapses; `.review-actions` right-aligned flex with gap, wraps; `.review-confirm` full-width line.

- [ ] **Step 4: Run to verify they pass**

Run: `npx playwright test tests/browser/diary-waiting.spec.ts && npm test`
Expected: PASS.

- [ ] **Step 5: Show each new test failing by a targeted break** (restore after each):
  - answers/photo/notes: drop `${photosHtml}` → photo count 0.
  - Decline asks first: make `decline` call `answerReview(... 'decline')` straight away → "can't be undone" missing.
  - change request: send `accept` instead of `accept-change` → server refuses (`illegal`), pop-up stays.
  - Seen: remove the `seen` handler → pop-up stays.
  - stale: in `answerReview` drop the `stale` branch and the message line → message text empty.
  - "Nothing waiting": change the empty text → fails.

- [ ] **Step 6: Commit**

```bash
git add public/app.js public/styles.css tests/browser/diary-waiting.spec.ts
git commit -m "feat: review pop-up answers waiting bookings from the diary"
```

---

### Task 9: Whole-piece check, screenshots, STATUS

**Files:**
- Modify: `.agents/STATUS.md`, this plan (decision log, spec walk)

- [ ] **Step 1: Run every check**

```bash
npm test
npm run test:browser
npm run lint
npm run typecheck
```

Expected: all PASS. Paste the summary lines into the decision log.

- [ ] **Step 2: Screenshots for Jack** — with the app running from this worktree (`.claude/launch.json` / preview tools, not Bash), seed a test shop the way the browser spec does, and capture: the column with all three kinds; the review pop-up for a new booking with a photo; a change request pop-up; the grid with an amber job, its outline and a greyed cancellation. Save them under the scratchpad or `/tmp`, never the repo.

- [ ] **Step 3: Spec walk** — go through the spec line by line and record in the decision log which requirements are met, dropped or changed.

- [ ] **Step 4: Update `.agents/STATUS.md`** — this piece built on `feat/staff-diary-waiting`; d6 is next; the parked items that remain; any new open items from the decision log. Keep under 8 KB.

- [ ] **Step 5: Commit**

```bash
git add .agents/STATUS.md docs/superpowers/plans/2026-09-27-staff-diary-waiting.md
git commit -m "docs: staff diary piece status, decision log and spec walk"
```

---

## Decision log

Record each decision taken during the build and what caused it, and each new test's break (the edit, and the failure message seen).

- 2026-09-27 (planning): waiting items gain `services: [{id, name}]` beside `serviceNames` — the review pop-up groups answers by service, and answers carry only `serviceId`. Additive; not in the spec's server list, told to Jack with the plan.
- 2026-09-27 (planning): the pop-up takes its item from `GET /api/workshop-waiting` (re-read on open) and the job from `GET /api/workshop-jobs/:id`; "is this job waiting" is `waitingIds.has(id)`, the server's own list, because the job JSON has no "online booking" flag.
- 2026-09-27 (planning): change-request outlines come from the waiting list, not the week's job list — a job booked in another week can ask for a time in this one.
- 2026-09-27 (planning): photos enlarge inside the pop-up on click instead of opening a new tab — the file route sends `Content-Disposition: attachment`, so a link would download rather than show.
- 2026-09-27 (planning): `api()` errors gain `.status` and `.code`; the diary had no other way to tell a stale refusal from any other.

- 2026-09-27 (build, Task 5): the three `<script>` tags moved from Task 6 into Task 5, because Task 5's app.js already calls DiaryReview.
- 2026-09-27 (build, Task 5): `book-journey.spec.ts` stopped ending the shared database pool. All browser specs run in one Playwright worker and share the pool, so the first file to end it broke every later file. The final fix wave replaced this with `tests/browser/fixtures.ts`: a worker-scoped fixture that ends the pool once, whatever the file order.
- 2026-09-27 (build, Task 8): a second answer to an item someone else already answered comes back `illegal`, not `stale`, because the server checks legality before version. Ruling: on `illegal` the pop-up re-reads the job. If the version has changed, it treats the refusal as stale ("This job changed while you were looking at it."). If not, it shows the server's own message. The server is unchanged.
- 2026-09-27 (build, Task 8 fix round): a pop-up closed while its answer is in flight never redraws, and never closes another screen, when the late reply arrives. The Loading shell can be closed.
- 2026-09-27 (final review fix wave): the minute timer stops at logout, on a 401, and whenever the column is gone. A stale refusal on the complete/reopen toggle now closes the form and redraws, as the form's Save already did. A capacity refusal on a drag shows the server's own words. Only a network TypeError reads "Couldn't reach the server". `tests/helpers/staff.js` gained `loginId` and `staffFreshCookie`, so the logout test doesn't end the session the rest of its file shares.
- Parked (rulings in the ledger, carried to STATUS): the right-click Approve race (milliseconds); "View job" from a sale document and the edit form's Delete both bypass the pop-up for a waiting job; after a stale or 404 answer only the column refreshes; the drag test waits 1.5s per week and reads its redraw position once; minor test gaps.
- Checks at the end (local, 27 Sep): `npm test` 1312/1312, `npx playwright test` 23/23, `npm run lint` clean, `npm run typecheck` clean. CI has not run yet (no pull request).

## Spec walk

Against `docs/superpowers/specs/2026-09-27-staff-diary-waiting-design.md`:

- **Column:** met. "Waiting for you (n)", detailed cards oldest first, "Nothing waiting", a minute refresh of the column only that stops when staff leave Workshop (and, added, at logout or session expiry), and jump-and-flash on click.
- **Review pop-up:** met. Kind heading with reference; customer, time and mechanic; answers grouped by service; photos; "Customer's notes"; "Open full job"; Accept / Decline / Seen; the decline confirmation only for a new booking; the change line. **Changed:** a photo enlarges inside the pop-up rather than opening, because the file route downloads (the spec was updated while planning). **Changed:** an `illegal` refusal on a job that changed meanwhile reads as "changed" (the Task 8 ruling).
- **Refusals table:** met. The 404 and no-connection rows are covered by unit tests only.
- **Right-click Approve on a waiting booking opens the pop-up:** met. There is no browser test.
- **Grid:** met: amber move-requested with a dashed outline at the requested time, greyed crossed-through customer cancellation until Seen, and cancelled, declined and expired jobs not drawn. **Partly met:** on a one-hour block the words "Move requested" and "Cancelled by customer" are cut off below the title, so only the colour and strike-through show (screenshot, 27 Sep). Raised with Jack.
- **Month view markings:** built; there is no browser test.
- **Diary saves send the version:** met for drag, resize, right-click Approve, the complete toggle and form Save; a stale refusal redraws.
- **Server changes 1–4:** met. No migrations, no new dependencies.
- **Testing section:** met, and every new test was shown failing by a targeted break (recorded per task in the build reports). The capacity wording on a drag has no test.
- **Done means:** local checks pass and screenshots were shown to Jack. **Not yet:** CI on the pull request's final commit.
