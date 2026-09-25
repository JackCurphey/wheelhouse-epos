# Book server piece 4: the private booking link — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every online booking gets a private link that shows the booking read-only, without sign-in, until 30 days after the booked date; staff can replace a job's link.

**Architecture:** A random 64-hex code is issued at booking; only its SHA-256 hash is stored on `workshop_jobs`. A new public portal route looks the hash up under the shop's row-level security and returns a narrow view. Pure logic (code, hash, path, expiry, stage) lives in `server/booking-link.js`; routes stay in `server/server.js`, matching its existing pattern.

**Tech Stack:** Node (ESM, `node:test`), Postgres with row-level security, `node:crypto`.

**Spec:** `docs/superpowers/specs/2026-09-25-book-server-4-guest-link-design.md`

## Global Constraints

- Code: `randomBytes(32).toString('hex')` (64 lowercase hex). Stored only as `createHash('sha256').update(code).digest('hex')`.
- Link path: `/book/<shopSlug>/booking/<code>`, returned as `privateLink`.
- Link works until 30 days after `job_date` inclusive; day 31 is expired (410).
- 404 body for unknown/replaced/other-shop code: `{ error: "We can't find that booking" }`. 410 body: `{ error: 'This link has expired' }`.
- Rate limit: 30 lookups per 15 minutes per IP (`makeRateLimiter(30, 15 * 60 * 1000)`), keyed by `clientIp(req)`.
- Read-back never includes: customer name, phone, email, price, notes, customer id, job id.
- `customer_description` is written only by the portal booking route.
- `npm test` needs the compose Postgres (`npm run docker:up`, port 5433). Test files that boot the server import `../server/load-env.js` first.
- Each test file boots its own server (`startLiveServer`), so the rate limiter is per file. `tests/portal-booking-link.test.js` must make fewer than 30 lookups; the 429 check lives in its own file.
- No UI changes. No change to the portal dispatcher in `server/server.js` (~line 4968).

## Decision log

1. (Planning, Jack 25 Sep) Customer's words get their own column, `customer_description`, because `notes` is staff-editable. Spec decision 6.
2. (Planning) Unknown shop slug keeps the dispatcher's existing 404 "Shop not found"; the spec was reworded to match rather than change shared dispatch code. Told to Jack in session.
3. (Planning) The stage table is tested exhaustively as a pure function; the route test covers one stage, to stay under the per-file rate limit.
4. (Planning) The no-leak test does not look for the job id as a substring (it could appear inside the reference or date by chance); the first read-back test's exact `deepEqual` already proves there is no `id` key.

## Files

- Create `server/migrations/027_booking_link.sql` — the two columns and the index.
- Create `server/booking-link.js` — pure: `newLinkCode`, `hashLinkCode`, `linkPath`, `isLinkExpired`, `bookingStage`.
- Modify `server/server.js` — `createWorkshopJob` gains `linkTokenHash`, `customerDescription`; booking POST issues the link; new GET read-back route; new staff POST route; new limiter.
- Create `tests/migration-027.test.js`, `tests/booking-link.test.js`, `tests/portal-booking-link.test.js`, `tests/booking-link-rate-limit.test.js`.

---

### Task 1: Migration 027

**Files:**
- Create: `server/migrations/027_booking_link.sql`
- Test: `tests/migration-027.test.js`

**Interfaces:**
- Produces: columns `workshop_jobs.link_token_hash TEXT NULL` (unique where not null), `workshop_jobs.customer_description TEXT NULL`.

- [ ] **Step 1: Write the failing test**

```js
// Migration 027: the private link's hash and the customer's own description.
// Spec: docs/superpowers/specs/2026-09-25-book-server-4-guest-link-design.md
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool, runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let owner;

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl);
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
  await pool.end();
});

const column = async (name) => (await pool.query(
  "SELECT data_type, is_nullable FROM information_schema.columns WHERE table_name = 'workshop_jobs' AND column_name = $1",
  [name]
)).rows[0];

for (const name of ['link_token_hash', 'customer_description']) {
  test(`workshop_jobs.${name} is nullable text`, async () => {
    const c = await column(name);
    assert.ok(c, 'column missing');
    assert.equal(c.data_type, 'text');
    assert.equal(c.is_nullable, 'YES');
  });
}

test('two jobs cannot share a link hash', async () => {
  const insert = () => runWithShop(owner.shop.id, () => prepare(
    "INSERT INTO workshop_jobs (title, job_date, link_token_hash) VALUES ('x', '2030-01-01', 'same-hash')"
  ).run());
  await insert();
  await assert.rejects(insert(), /unique|duplicate/i);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/migration-027.test.js`
Expected: FAIL — "column missing", and the insert errors with `column "link_token_hash" ... does not exist`.

- [ ] **Step 3: Write the migration**

```sql
-- The private booking link (piece 4). Only a SHA-256 hash of the link's code is
-- kept, so the database alone cannot open a booking. A new link replaces the
-- hash, which switches the old link off. customer_description is what the
-- customer wrote when booking, kept apart from notes because staff edit notes
-- and the link must never show a staff comment.
-- Spec: docs/superpowers/specs/2026-09-25-book-server-4-guest-link-design.md
ALTER TABLE workshop_jobs
  ADD COLUMN link_token_hash TEXT,
  ADD COLUMN customer_description TEXT;

CREATE UNIQUE INDEX idx_workshop_jobs_link_token_hash
  ON workshop_jobs (link_token_hash) WHERE link_token_hash IS NOT NULL;
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test tests/migration-027.test.js`
Expected: 3 pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add server/migrations/027_booking_link.sql tests/migration-027.test.js
git commit -m "feat: migration 027 adds the booking link hash and the customer's own description"
```

---

### Task 2: The pure module

**Files:**
- Create: `server/booking-link.js`
- Test: `tests/booking-link.test.js`

**Interfaces:**
- Produces:
  - `newLinkCode(): string` — 64 lowercase hex.
  - `hashLinkCode(code: string): string` — 64 lowercase hex SHA-256.
  - `linkPath(shopSlug: string, code: string): string` — `/book/${shopSlug}/booking/${code}`.
  - `isLinkExpired(jobDate: 'YYYY-MM-DD', today: 'YYYY-MM-DD'): boolean` — true when `today` is more than 30 days after `jobDate`.
  - `bookingStage({ booking_state, custody_state, work_state }): string` — per the spec's table.

- [ ] **Step 1: Write the failing test**

```js
// The private link's pure parts: code, hash, path, expiry, stage.
// Spec: docs/superpowers/specs/2026-09-25-book-server-4-guest-link-design.md
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { newLinkCode, hashLinkCode, linkPath, isLinkExpired, bookingStage } from '../server/booking-link.js';

test('a code is 64 hex characters and never repeats', () => {
  const a = newLinkCode();
  const b = newLinkCode();
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.notEqual(a, b);
});

test('the hash is SHA-256 of the code, and is not the code', () => {
  const code = newLinkCode();
  assert.equal(hashLinkCode(code), createHash('sha256').update(code).digest('hex'));
  assert.notEqual(hashLinkCode(code), code);
});

test('the path is /book/<shop>/booking/<code>', () => {
  assert.equal(linkPath('acme', 'abc'), '/book/acme/booking/abc');
});

test('the link works up to and including day 30 after the booked date', () => {
  assert.equal(isLinkExpired('2030-01-01', '2030-01-01'), false);
  assert.equal(isLinkExpired('2030-01-01', '2029-12-01'), false);
  assert.equal(isLinkExpired('2030-01-01', '2030-01-31'), false);
  assert.equal(isLinkExpired('2030-01-01', '2030-02-01'), true);
});

test('expiry counts across a month and a year end', () => {
  assert.equal(isLinkExpired('2030-12-15', '2031-01-14'), false);
  assert.equal(isLinkExpired('2030-12-15', '2031-01-15'), true);
});

const stage = (booking_state, custody_state = 'expected', work_state = 'not_started') =>
  bookingStage({ booking_state, custody_state, work_state });

test('booking states other than scheduled decide the stage', () => {
  assert.equal(stage('pending'), 'awaiting_confirmation');
  assert.equal(stage('reschedule_requested'), 'change_requested');
  assert.equal(stage('declined'), 'declined');
  assert.equal(stage('expired'), 'request_expired');
  assert.equal(stage('cancelled'), 'cancelled');
  assert.equal(stage('pending', 'in_shop', 'complete'), 'awaiting_confirmation');
});

test('a scheduled booking follows custody and work', () => {
  assert.equal(stage('scheduled'), 'confirmed');
  assert.equal(stage('scheduled', 'in_shop', 'not_started'), 'in_workshop');
  assert.equal(stage('scheduled', 'in_shop', 'waiting_parts'), 'in_workshop');
  assert.equal(stage('scheduled', 'in_shop', 'complete'), 'ready_to_collect');
  assert.equal(stage('scheduled', 'collected', 'complete'), 'collected');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/booking-link.test.js`
Expected: FAIL — `Cannot find module '../server/booking-link.js'`.

- [ ] **Step 3: Write the module**

```js
// The private booking link's pure parts. The code is shown to the customer once;
// only its hash is stored. Spec:
// docs/superpowers/specs/2026-09-25-book-server-4-guest-link-design.md
import { randomBytes, createHash } from 'node:crypto';

const LINK_DAYS = 30;

export function newLinkCode() {
  return randomBytes(32).toString('hex');
}

// SHA-256 rather than a slow password hash: the code is 256 random bits, so
// there is nothing for a slow hash to protect against.
export function hashLinkCode(code) {
  return createHash('sha256').update(code).digest('hex');
}

export function linkPath(shopSlug, code) {
  return `/book/${shopSlug}/booking/${code}`;
}

// Both dates are YYYY-MM-DD. Worked out from job_date at read time, so moving a
// booking moves its link's expiry with it.
export function isLinkExpired(jobDate, today) {
  const last = new Date(`${jobDate}T00:00:00Z`);
  last.setUTCDate(last.getUTCDate() + LINK_DAYS);
  return today > last.toISOString().slice(0, 10);
}

const BOOKING_STAGES = {
  pending: 'awaiting_confirmation',
  reschedule_requested: 'change_requested',
  declined: 'declined',
  expired: 'request_expired',
  cancelled: 'cancelled',
};

// One key for where the booking is up to; the page chooses the words.
export function bookingStage({ booking_state, custody_state, work_state }) {
  if (booking_state !== 'scheduled') return BOOKING_STAGES[booking_state];
  if (custody_state === 'collected') return 'collected';
  if (custody_state === 'in_shop') return work_state === 'complete' ? 'ready_to_collect' : 'in_workshop';
  return 'confirmed';
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test tests/booking-link.test.js`
Expected: 7 pass, 0 fail.

- [ ] **Step 5: Mutate and restore**

Change `LINK_DAYS = 30` to `31`; confirm the day-31 assertions fail. Change `'ready_to_collect'` to `'in_workshop'` in `bookingStage`; confirm the scheduled-stage test fails. Restore both, and check with `git diff` that the file matches Step 3.

- [ ] **Step 6: Commit**

```bash
git add server/booking-link.js tests/booking-link.test.js
git commit -m "feat: the booking link's code, hash, path, expiry and stage"
```

---

### Task 3: Issue the link on booking, and the read-back route

**Files:**
- Modify: `server/server.js` — imports (~line 77); limiters (~line 402); `createWorkshopJob` (~line 2629); booking POST (~lines 4672-4712); new route after the booking POST.
- Test: `tests/portal-booking-link.test.js`

**Interfaces:**
- Consumes: Task 1 columns; Task 2 functions.
- Produces:
  - `createWorkshopJob({ ..., linkTokenHash, customerDescription })` — both optional, default null.
  - Booking POST 201 body gains `privateLink: string`.
  - `GET /api/portal/:shopSlug/booking-links/:code` → 200 `{ reference, shopName, jobDate, startTime, serviceName, description, bike, stage }` | 404 | 410 | 429.

- [ ] **Step 1: Write the failing test**

```js
// The private booking link: issued on booking, read back without sign-in.
// Spec: docs/superpowers/specs/2026-09-25-book-server-4-guest-link-design.md
// Keep this file under 30 lookups: the limiter is per server, one per file.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from './helpers/staff.js';
import { portalRequest } from './helpers/portal.js';
import { jsonRequest } from './helpers/http.js';
import { deleteTestShop } from './helpers/testShop.js';
import { futureDate } from './helpers/workshopFixtures.js';
import { seedJobTypes, BOOKING_CONTACT } from './helpers/bookable.js';
import { hashLinkCode } from '../server/booking-link.js';

let server;
let owner;
let other;
let sam;
let types;

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl);
  other = await staffSignup(server.baseUrl);
  sam = await seedMechanic(owner.shop.id, { name: 'Sam' });
  types = await seedJobTypes(owner.shop.id);
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (other) await deleteTestShop(other.shop.id);
  if (server) await server.stop();
});

let day = 0;
const nextDate = () => {
  const n = day++;
  const d = new Date(`${futureDate(1 + (n % 5))}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 7 * Math.floor(n / 5));
  return d.toISOString().slice(0, 10);
};

const GUEST = { guestName: 'Gina Guestname', guestPhone: '07700 900123', email: 'gina@example.com' };

// A guest booking; returns the 201 body.
const book = async (body = {}) => {
  const res = await portalRequest(server.baseUrl, null, `/api/portal/${owner.shop.slug}/bookings`, {
    method: 'POST',
    body: {
      mechanicId: sam, jobDate: nextDate(), startTime: '10:00', description: 'Squeaky brakes',
      newBike: { make: 'Dawes', model: 'Galaxy' }, serviceId: types.service,
      ...BOOKING_CONTACT, ...GUEST, ...body,
    },
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body;
};
const codeOf = (privateLink) => privateLink.split('/').pop();
const read = (code, slug = owner.shop.slug) =>
  jsonRequest(server.baseUrl, null, `/api/portal/${slug}/booking-links/${code}`);
const setJob = (id, sql, ...args) => runWithShop(owner.shop.id, () => prepare(`UPDATE workshop_jobs SET ${sql} WHERE id = ?`).run(...args, id));

test('a booking returns a private link, and the link reads the booking back', async () => {
  const booked = await book();
  assert.match(booked.privateLink, new RegExp(`^/book/${owner.shop.slug}/booking/[0-9a-f]{64}$`));
  const res = await read(codeOf(booked.privateLink));
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(res.body, {
    reference: booked.reference,
    shopName: owner.shop.name,
    jobDate: booked.jobDate,
    startTime: '10:00',
    serviceName: 'Test service',
    description: 'Squeaky brakes',
    bike: { make: 'Dawes', model: 'Galaxy' },
    stage: 'awaiting_confirmation',
  });
});

test('the database holds the hash, never the code', async () => {
  const booked = await book();
  const code = codeOf(booked.privateLink);
  const row = await runWithShop(owner.shop.id, () => prepare(
    'SELECT link_token_hash, (w::text LIKE ?) AS leaks FROM workshop_jobs w WHERE id = ?'
  ).get(`%${code}%`, booked.id));
  assert.equal(row.link_token_hash, hashLinkCode(code));
  assert.equal(row.leaks, false);
});

test('the read-back carries no name, phone, email, price or notes', async () => {
  const booked = await book();
  await setJob(booked.id, "notes = 'STAFF-ONLY-REMARK'");
  const res = await read(codeOf(booked.privateLink));
  const text = JSON.stringify(res.body);
  for (const secret of ['Gina', '07700', 'gina@example.com', '10.00', 'STAFF-ONLY-REMARK']) {
    assert.ok(!text.includes(secret), `leaks ${secret}: ${text}`);
  }
});

test('a staff edit of the notes does not change the description', async () => {
  const booked = await book();
  const edit = await staffRequest(server.baseUrl, owner.cookie, `/api/workshop-jobs/${booked.id}`, {
    method: 'PUT', body: { notes: 'Rewritten by staff' },
  });
  assert.equal(edit.status, 200, JSON.stringify(edit.body));
  assert.equal((await read(codeOf(booked.privateLink))).body.description, 'Squeaky brakes');
});

test('a not-sure booking has no service name', async () => {
  const booked = await book({ serviceId: undefined, notSure: true });
  assert.equal((await read(codeOf(booked.privateLink))).body.serviceName, null);
});

test('the stage follows the job', async () => {
  const booked = await book();
  await setJob(booked.id, "booking_state = 'scheduled', custody_state = 'in_shop', work_state = 'complete'");
  assert.equal((await read(codeOf(booked.privateLink))).body.stage, 'ready_to_collect');
});

test("a made-up code and another shop's code get the same 404", async () => {
  const booked = await book();
  const madeUp = await read('0'.repeat(64));
  const wrongShop = await read(codeOf(booked.privateLink), other.shop.slug);
  assert.equal(madeUp.status, 404);
  assert.equal(wrongShop.status, 404);
  assert.deepEqual(madeUp.body, { error: "We can't find that booking" });
  assert.deepEqual(wrongShop.body, madeUp.body);
});

const daysAgo = (n) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
};

test('31 days after the booked date the link has expired; moving the date revives it', async () => {
  const booked = await book();
  const code = codeOf(booked.privateLink);
  await setJob(booked.id, 'job_date = ?', daysAgo(31));
  const expired = await read(code);
  assert.equal(expired.status, 410);
  assert.deepEqual(expired.body, { error: 'This link has expired' });
  await setJob(booked.id, 'job_date = ?', daysAgo(30));
  assert.equal((await read(code)).status, 200);
});
```

(Lookups in this file: 10. Task 4 adds 4 more.)

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/portal-booking-link.test.js`
Expected: FAIL — `privateLink` undefined in the first test; the read route answers 404 "Unknown portal route".

- [ ] **Step 3: Implement**

Import, next to `parseBookingRequest` (~line 77):

```js
import { newLinkCode, hashLinkCode, linkPath, isLinkExpired, bookingStage } from './booking-link.js';
```

Limiter, after `portalGuestBookingLimiter` (~line 402):

```js
// Private booking links need no sign-in. The code is unguessable; this is the
// second line, so nobody can churn through codes.
const bookingLinkLimiter = makeRateLimiter(30, 15 * 60 * 1000);
```

`createWorkshopJob`: add `linkTokenHash, customerDescription` to the destructured parameters; add `link_token_hash, customer_description` to the column list before `updated_at`, two more `?` in `VALUES` before the final `?`, and pass `linkTokenHash ?? null, customerDescription ?? null,` before `nowIso()`.

Booking POST, before the `createWorkshopJob` call:

```js
    const linkCode = newLinkCode();
```

and in the call's argument object:

```js
        linkTokenHash: hashLinkCode(linkCode),
        customerDescription: description,
```

Replace the final `return { status: 201, body: serializePortalBooking(row) };` with:

```js
    // The only time the code leaves the server: the database keeps its hash.
    return { status: 201, body: { ...serializePortalBooking(row), privateLink: linkPath(params.shopSlug, linkCode) } };
```

New route, directly after the booking POST route:

```js
// The private booking link, read back without sign-in. The dispatcher has
// already bound the shop from :shopSlug, so row-level security keeps another
// shop's code from finding anything. Deliberately narrow: nothing that
// identifies the customer, no price, no staff notes.
// Spec: docs/superpowers/specs/2026-09-25-book-server-4-guest-link-design.md
route('GET', '/api/portal/:shopSlug/booking-links/:code', async (req, res, params, query, shop) => {
  if (!bookingLinkLimiter.check(clientIp(req))) {
    return sendJson(res, 429, { error: 'Too many attempts - please wait a few minutes and try again.' });
  }
  const row = /^[0-9a-f]{64}$/.test(params.code)
    ? await db.prepare(
      `SELECT w.reference, w.job_date, w.start_time, w.customer_description,
              w.booking_state, w.custody_state, w.work_state,
              s.name AS service_name, b.make AS bike_make, b.model AS bike_model
       FROM workshop_jobs w
       LEFT JOIN workshop_services s ON s.id = w.service_id
       LEFT JOIN customer_bikes b ON b.id = w.bike_id
       WHERE w.link_token_hash = ?`
    ).get(hashLinkCode(params.code))
    : null;
  if (!row) return sendJson(res, 404, { error: "We can't find that booking" });
  if (isLinkExpired(row.job_date, new Date().toISOString().slice(0, 10))) {
    return sendJson(res, 410, { error: 'This link has expired' });
  }
  sendJson(res, 200, {
    reference: row.reference,
    shopName: shop.name,
    jobDate: row.job_date,
    startTime: row.start_time || '',
    serviceName: row.service_name ?? null,
    description: row.customer_description ?? null,
    bike: row.bike_make !== null || row.bike_model !== null ? { make: row.bike_make, model: row.bike_model } : null,
    stage: bookingStage(row),
  });
});
```

Also correct the stale comment above the guest customer branch (~line 4577): replace "(matched/created by phone, see resolveGuestCustomer)" with "(a new row each time, see resolveGuestCustomer)".

- [ ] **Step 4: Run to verify it passes**

Run: `node --test tests/portal-booking-link.test.js tests/portal-booking-request.test.js`
Expected: all pass. If the first test's `deepEqual` fails only on `jobDate`, check what `serializePortalBooking` returns for `jobDate` and compare to that, not to a reformatted value.

- [ ] **Step 5: Mutate and restore**

1. Pass `linkCode` instead of `hashLinkCode(linkCode)` as `linkTokenHash`; confirm "the database holds the hash" fails.
2. Add `w.notes` to the SELECT and return `description: row.notes`; confirm the staff-edit test and the no-leak test fail.
3. Drop the `isLinkExpired` check; confirm the expiry test fails.

Restore each and confirm with `git diff` that only the intended changes remain.

- [ ] **Step 6: Commit**

```bash
git add server/server.js tests/portal-booking-link.test.js
git commit -m "feat: every online booking gets a private link that reads it back"
```

---

### Task 4: Staff make a new link; the attempt limit

**Files:**
- Modify: `server/server.js` — new route after `GET /api/workshop-jobs/:id` (~line 2530).
- Modify: `tests/portal-booking-link.test.js` — append tests.
- Create: `tests/booking-link-rate-limit.test.js`

**Interfaces:**
- Consumes: Task 2 `newLinkCode`, `hashLinkCode`, `linkPath`; Task 3 `bookingLinkLimiter`, read route.
- Produces: `POST /api/workshop-jobs/:id/private-link` → 201 `{ privateLink }` | 400 | 401 | 404.

- [ ] **Step 1: Write the failing tests**

Append to `tests/portal-booking-link.test.js`:

```js
import { seedWorkshopJob } from './helpers/workshopFixtures.js';

const newLink = (id, who = owner) =>
  staffRequest(server.baseUrl, who?.cookie ?? null, `/api/workshop-jobs/${id}/private-link`, { method: 'POST', body: {} });

test('staff make a new link; the old one stops working', async () => {
  const booked = await book();
  const res = await newLink(booked.id);
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.notEqual(res.body.privateLink, booked.privateLink);
  assert.equal((await read(codeOf(res.body.privateLink))).status, 200);
  assert.equal((await read(codeOf(booked.privateLink))).status, 404);
});

test("staff cannot make a link for another shop's job", async () => {
  const booked = await book();
  assert.equal((await newLink(booked.id, other)).status, 404);
});

test('a job with no customer gets no link', async () => {
  const id = await seedWorkshopJob({ shopId: owner.shop.id, customerId: null });
  const res = await newLink(id);
  assert.equal(res.status, 400, JSON.stringify(res.body));
});

test('making a link needs a staff sign-in', async () => {
  const booked = await book();
  assert.equal((await newLink(booked.id, null)).status, 401);
});
```

Move the new `import` line to the top of the file with the others.

Create `tests/booking-link-rate-limit.test.js`:

```js
// The private link's attempt limit: 30 lookups per 15 minutes per IP.
// Its own file, so its own server and its own limiter.
// Spec: docs/superpowers/specs/2026-09-25-book-server-4-guest-link-design.md
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup } from './helpers/staff.js';
import { jsonRequest } from './helpers/http.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let owner;

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl);
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
});

test('the 31st lookup inside the window is refused', async () => {
  const path = `/api/portal/${owner.shop.slug}/booking-links/${'0'.repeat(64)}`;
  for (let i = 0; i < 30; i++) {
    assert.equal((await jsonRequest(server.baseUrl, null, path)).status, 404, `lookup ${i + 1}`);
  }
  assert.equal((await jsonRequest(server.baseUrl, null, path)).status, 429);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test tests/portal-booking-link.test.js tests/booking-link-rate-limit.test.js`
Expected: the four staff tests fail (the route does not exist, so 404 where 201/400/401 is expected; the other-shop test may pass by accident, and that's fine). The rate-limit test passes already, because Task 3 added the limiter: prove it by setting the limiter's `30` to `31` and watching it fail, then restoring.

- [ ] **Step 3: Implement**

After the `GET /api/workshop-jobs/:id` route:

```js
// A new private link for a job: the old one stops working at once, because a
// job holds one hash. Returned once; staff text it or read it out.
// Spec: docs/superpowers/specs/2026-09-25-book-server-4-guest-link-design.md
// Staff handlers get (req, res, params, query, afterRelease, shopId); the slug
// for the path comes from shops, which is outside row-level security.
route('POST', '/api/workshop-jobs/:id/private-link', async (req, res, params, query, afterRelease, shopId) => {
  const job = await db.prepare('SELECT id, customer_id FROM workshop_jobs WHERE id = ?').get(Number(params.id));
  if (!job) return notFound(res, 'Job not found');
  if (!job.customer_id) return badRequest(res, 'This job has no customer to send a link to');
  const code = newLinkCode();
  await db.prepare('UPDATE workshop_jobs SET link_token_hash = ?, updated_at = ? WHERE id = ?')
    .run(hashLinkCode(code), nowIso(), job.id);
  const { rows: [shop] } = await pool.query('SELECT slug FROM shops WHERE id = $1', [shopId]);
  sendJson(res, 201, { privateLink: linkPath(shop.slug, code) });
});
```

The staff dispatcher (~line 5050) calls `r.handler(req, res, params, url.searchParams, afterRelease, ctx.shop.id)`, unlike the portal dispatcher, which passes the `shop` row. `pool` is already imported from `./db.js`.

- [ ] **Step 4: Run to verify they pass**

Run: `node --test tests/portal-booking-link.test.js tests/booking-link-rate-limit.test.js`
Expected: all pass.

- [ ] **Step 5: Mutate and restore**

Remove the `UPDATE` (return a code without storing it); confirm "the old one stops working" fails. Restore and check `git diff`.

- [ ] **Step 6: Full gates**

Run each and read its exit code:

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run test:browser
```

Expected: all exit 0; `npm test` reports 0 fail.

- [ ] **Step 7: Commit**

```bash
git add server/server.js tests/portal-booking-link.test.js tests/booking-link-rate-limit.test.js
git commit -m "feat: staff can replace a booking's private link; lookups are rate limited"
```

---

## Spec walk (fill in after building)

For each spec line: met / dropped / changed, with the reason.
