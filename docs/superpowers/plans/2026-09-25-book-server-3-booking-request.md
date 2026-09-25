# Book server piece 3: the booking request - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The customer booking POST names what the customer chose by shop service id (or "not sure"), takes the contact and consent details the `details` screen collects, and returns the booking reference the `pending` screen shows.

**Architecture:** A new pure module `server/booking-request.js` validates the new body fields and is unit-tested alone. `POST /api/portal/:shopSlug/bookings` in `server/server.js` calls it before any customer row is created, resolves the service inside the request's shop context, and saves preferences and the terms timestamp next to the existing job insert. Migration 025 adds three columns. The hardcoded `PORTAL_JOB_TYPES` goes.

**Tech Stack:** Node 22 ESM, the plain `http` server in `server/server.js`, PostgreSQL 16 via `pg`, `node:test`.

**Spec:** `docs/superpowers/specs/2026-09-25-book-server-3-booking-request-design.md`. Read it first. 2b's plan (`docs/superpowers/plans/2026-09-24-book-server-2b-booking-modes.md`) describes the lock, hold and mode handling this leaves alone.

**Branch:** `feat/book-server-3-booking-request`, cut from `main` at `5dd2086`. It already carries the STATUS commit and the spec commit.

## Global Constraints

- No new dependencies.
- **The migration is approved** (spec, Jack, 25 Sep): `customers` gains `update_channel` and `marketing_permission`; `workshop_jobs` gains `terms_accepted_at`. Nothing else in the schema changes.
- Customers never see a block's reason, other customers' jobs, or minute totals (unchanged from 2a/2b).
- A shop-rule failure is 400; capacity is 409 with `code: 'capacity'` (2b). Piece 3 adds only 400s.
- Money is a float, totalled in SQL, never in JavaScript. This piece stores no money.
- Test first. Each new test is watched failing for the right reason before its code is written.
- Every test file that boots the server imports `../server/load-env.js` first and needs the compose Postgres up (`npm run docker:up`); otherwise the suite hangs silently.
- Copy shown to customers is plain English, no jargon.

## Decision log (choices the spec leaves open, and why)

1. **A guest booking still needs a phone number, whatever the channel.** `resolveGuestCustomer` (`server/customer-auth.js:87`) already requires name and phone, and piece 3 does not touch it. Decision 2 in the spec then reads: the email channel *also* needs an email; SMS and WhatsApp need the phone. For a signed-in customer the phone is not required unless the channel needs it.
2. **"A returning customer's newer preferences overwrite" applies to signed-in customers only.** A guest gets a fresh `customers` row on every booking (`resolveGuestCustomer` never matches on phone, deliberately), so there is nothing to overwrite.
3. **The service's price is not stored on the job.** The spec says "price come from the service row", but `workshop_jobs` has no price column and the spec adds none; the linked order is created with a zero total. Title and planned minutes are taken from the service. **Flag to Jack:** the spec line is unmet as written; a price on the job is a separate decision.
4. **Job title:** `Online booking: <service name> - <description>`, cut to 200 characters; for "not sure", `Online booking: Not sure - <description>`. The old title was `Online booking: <description>`.
5. **`updateChannel` is required on every booking**, and `termsAccepted` must be the boolean `true`. `marketingPermission` defaults to false; anything other than `true` is false.
6. **Email check is deliberately light:** one `@` with text either side, no spaces. Real verification is a message being delivered, which is not built.
7. **Preferences are saved inside the booking lock, just before the job insert,** so a refused booking (400 or 409) changes nothing on the customer. An email is only written when one was sent.
8. **Validation runs before the guest customer row is created,** so a bad request no longer leaves a stray customer. The existing checks (date, description, mechanic) keep their order after it.
9. **`serializePortalBooking` gains `reference`.** It also feeds `GET /api/portal/:shopSlug/bookings` (a signed-in customer's own bookings), where the reference is the customer's own and safe to show.
10. **The `jobTypes` key leaves `GET /api/portal/:shopSlug/mechanics`.** The old `public-portal/portal.js` reads it and breaks; that is decision 3 in the spec.

## Files

- Create `server/migrations/025_booking_request_fields.sql`
- Create `server/booking-request.js` - `parseBookingRequest(body)`, pure
- Create `tests/booking-request.test.js` - unit tests for the parser
- Create `tests/helpers/bookable.js` - `seedJobTypes`, `BOOKING_CONTACT`
- Create `tests/migration-025.test.js`
- Create `tests/portal-booking-request.test.js` - the integration tests
- Modify `server/server.js` - the POST, `createWorkshopJob`, `serializePortalBooking`, remove `PORTAL_JOB_TYPES`
- Modify the six test files that send `jobType` (Task 3)
- Modify `.agents/STATUS.md`

---

### Task 1: Migration 025

**Files:**
- Create: `server/migrations/025_booking_request_fields.sql`
- Test: `tests/migration-025.test.js`

**Interfaces:**
- Produces: `customers.update_channel TEXT NULL` (`email|sms|whatsapp`), `customers.marketing_permission BOOLEAN NOT NULL DEFAULT false`, `workshop_jobs.terms_accepted_at TIMESTAMPTZ NULL`.

- [ ] **Step 1: Write the failing test**

Look at how an existing migration test reads the schema first: `ls tests | grep -i migrat` and open the newest one to copy its pool and setup lines. Then create `tests/migration-025.test.js`:

```js
// Migration 025: the contact and consent columns the booking request needs.
// Spec: docs/superpowers/specs/2026-09-25-book-server-3-booking-request-design.md
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { pool } from '../server/db.js';

after(async () => { await pool.end(); });

const column = async (table, name) => (await pool.query(
  'SELECT data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = $1 AND column_name = $2',
  [table, name]
)).rows[0];

test('customers.update_channel is a nullable text column', async () => {
  const c = await column('customers', 'update_channel');
  assert.ok(c, 'column missing');
  assert.equal(c.data_type, 'text');
  assert.equal(c.is_nullable, 'YES');
});

test('customers.marketing_permission is a boolean that defaults to false', async () => {
  const c = await column('customers', 'marketing_permission');
  assert.ok(c, 'column missing');
  assert.equal(c.data_type, 'boolean');
  assert.equal(c.is_nullable, 'NO');
  assert.match(c.column_default, /false/);
});

test('workshop_jobs.terms_accepted_at is a nullable timestamp', async () => {
  const c = await column('workshop_jobs', 'terms_accepted_at');
  assert.ok(c, 'column missing');
  assert.equal(c.data_type, 'timestamp with time zone');
  assert.equal(c.is_nullable, 'YES');
});

test('update_channel refuses a channel we do not send on', async () => {
  const { rows: [shop] } = await pool.query('SELECT id FROM shops LIMIT 1');
  assert.ok(shop, 'needs at least one shop in the test database');
  await assert.rejects(
    pool.query(
      "INSERT INTO customers (shop_id, name, update_channel) VALUES ($1, 'x', 'fax')", [shop.id]
    ),
    /check constraint/i
  );
});
```

If `pool` is not exported from `server/db.js`, use the import the newest migration test uses.

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/migration-025.test.js`
Expected: FAIL, "column missing" (the migration does not exist yet). The fourth test may instead pass or fail on the missing column; it must not error on a connection problem. If it hangs, the compose Postgres is down: `npm run docker:up`.

- [ ] **Step 3: Write the migration**

```sql
-- The booking request (piece 3): what the customer chose to be told and
-- agreed to. Update channel and marketing permission belong to the person and
-- carry to their next booking, so they sit on customers. Terms consent belongs
-- to the one booking it was given for, so it sits on the job, as a timestamp.
-- The terms wording is not stored; see the spec.
-- Spec: docs/superpowers/specs/2026-09-25-book-server-3-booking-request-design.md
ALTER TABLE customers
  ADD COLUMN update_channel TEXT CHECK (update_channel IN ('email', 'sms', 'whatsapp')),
  ADD COLUMN marketing_permission BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE workshop_jobs
  ADD COLUMN terms_accepted_at TIMESTAMPTZ;
```

- [ ] **Step 4: Run and see it pass**

Run: `node --test tests/migration-025.test.js`
Expected: 4 pass. (Migrations run at server start or via `server/migrations/run-migrations.js`; if the columns are still missing, run the migration runner the way the newest migration's plan did, `grep -n migrat package.json`.)

- [ ] **Step 5: Prove the migration works from an empty database**

STATUS says `docker:down` keeps the volume, so use a scratch database, not the dev one: create it with `psql` against port 5433, point `DATABASE_URL` at it, run the migration runner, and confirm 025 applies after 001-024 with no error. Drop the scratch database afterwards.

- [ ] **Step 6: Commit**

```bash
git add server/migrations/025_booking_request_fields.sql tests/migration-025.test.js
git commit -m "feat: migration 025, contact and consent columns for the booking request"
```

---

### Task 2: The request parser

**Files:**
- Create: `server/booking-request.js`
- Test: `tests/booking-request.test.js`

**Interfaces:**
- Produces: `parseBookingRequest(body) -> { error: string } | { value: { serviceId: number | null, notSure: boolean, email: string, updateChannel: 'email'|'sms'|'whatsapp', termsAccepted: true, marketingPermission: boolean } }`. `body` is the parsed JSON; the caller also passes `guestPhone`-style phone through the second argument `phone` (string, may be empty): `parseBookingRequest(body, phone)`.
- Consumes: nothing; pure.

- [ ] **Step 1: Write the failing tests**

```js
// The booking request's new fields, checked without a server.
// Spec: docs/superpowers/specs/2026-09-25-book-server-3-booking-request-design.md
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBookingRequest } from '../server/booking-request.js';

const ok = { serviceId: 7, email: 'a@example.com', updateChannel: 'email', termsAccepted: true };
const parse = (over = {}, phone = '') => parseBookingRequest({ ...ok, ...over }, phone);

test('a service id, an email and consent parse', () => {
  assert.deepEqual(parse(), {
    value: {
      serviceId: 7, notSure: false, email: 'a@example.com',
      updateChannel: 'email', termsAccepted: true, marketingPermission: false,
    },
  });
});

test('not sure parses with no service id', () => {
  const r = parseBookingRequest({ notSure: true, email: 'a@example.com', updateChannel: 'email', termsAccepted: true }, '');
  assert.equal(r.value.notSure, true);
  assert.equal(r.value.serviceId, null);
});

test('both a service and not sure is refused', () => {
  assert.match(parse({ notSure: true }).error, /one/i);
});

test('neither a service nor not sure is refused', () => {
  assert.match(parseBookingRequest({ email: 'a@example.com', updateChannel: 'email', termsAccepted: true }, '').error, /service/i);
});

test('a service id that is not a whole number is refused', () => {
  for (const bad of ['7', 1.5, 0, -1, null]) {
    assert.ok(parse({ serviceId: bad }).error, `accepted serviceId ${JSON.stringify(bad)}`);
  }
});

test('an unknown update channel is refused', () => {
  assert.match(parse({ updateChannel: 'fax' }).error, /how you.d like/i);
  assert.match(parse({ updateChannel: undefined }).error, /how you.d like/i);
});

test('the email channel needs an email address', () => {
  assert.match(parse({ email: '' }).error, /email address/i);
  assert.match(parse({ email: 'not-an-email' }).error, /email address/i);
});

test('sms and whatsapp need a phone number, not an email', () => {
  for (const updateChannel of ['sms', 'whatsapp']) {
    assert.match(parse({ updateChannel, email: '' }, '').error, /phone number/i);
    assert.equal(parse({ updateChannel, email: '' }, '07700 900123').value.updateChannel, updateChannel);
  }
});

test('an email that is sent on another channel must still be a real-looking address', () => {
  assert.match(parse({ updateChannel: 'sms', email: 'nope' }, '07700 900123').error, /email address/i);
});

test('terms must be accepted, as exactly true', () => {
  for (const bad of [false, 'true', 1, undefined]) {
    assert.match(parse({ termsAccepted: bad }).error, /terms/i, `accepted ${JSON.stringify(bad)}`);
  }
});

test('marketing permission is true only when sent as true', () => {
  assert.equal(parse({ marketingPermission: true }).value.marketingPermission, true);
  for (const v of [false, 'true', 1, undefined]) {
    assert.equal(parse({ marketingPermission: v }).value.marketingPermission, false);
  }
});
```

- [ ] **Step 2: Run and see it fail**

Run: `node --test tests/booking-request.test.js`
Expected: FAIL, `Cannot find module '../server/booking-request.js'`.

- [ ] **Step 3: Write the minimal implementation**

```js
// The booking request's own fields (book screen 05, `details`), checked before
// anything is written. Pure: no database, no request object. The route calls it
// before it creates a guest customer, so a bad request leaves nothing behind.
// Spec: docs/superpowers/specs/2026-09-25-book-server-3-booking-request-design.md

export const UPDATE_CHANNELS = ['email', 'sms', 'whatsapp'];

const looksLikeEmail = (s) => /^[^\s@]+@[^\s@]+$/.test(s);

// `phone` is the guest phone or the signed-in customer's phone as sent; the
// channel rule needs to know whether there is one.
export function parseBookingRequest(body, phone = '') {
  const notSure = body.notSure === true;
  const hasService = body.serviceId !== undefined && body.serviceId !== null;
  if (notSure && hasService) return { error: 'Choose one service, or "not sure" - not both' };
  if (!notSure && !hasService) return { error: 'Please choose a service, or "not sure"' };
  if (hasService && !(Number.isInteger(body.serviceId) && body.serviceId > 0)) {
    return { error: 'That service is not available to book' };
  }

  if (!UPDATE_CHANNELS.includes(body.updateChannel)) {
    return { error: "Please choose how you'd like to hear from us" };
  }
  const email = (typeof body.email === 'string' ? body.email : '').trim();
  if (email && !looksLikeEmail(email)) return { error: 'Please enter a valid email address' };
  if (body.updateChannel === 'email' && !email) {
    return { error: 'Please enter your email address so we can email you updates' };
  }
  if (body.updateChannel !== 'email' && !String(phone || '').trim()) {
    return { error: 'Please enter your phone number so we can message you updates' };
  }

  if (body.termsAccepted !== true) return { error: 'Please accept the terms to book' };

  return {
    value: {
      serviceId: hasService ? body.serviceId : null,
      notSure,
      email,
      updateChannel: body.updateChannel,
      termsAccepted: true,
      marketingPermission: body.marketingPermission === true,
    },
  };
}
```

- [ ] **Step 4: Run and see it pass**

Run: `node --test tests/booking-request.test.js`
Expected: 11 pass.

- [ ] **Step 5: Break it on purpose**

Change `body.termsAccepted !== true` to `!body.termsAccepted`, confirm the "exactly true" test fails (on `'true'`), and restore. Confirm your edit landed with `git diff` before restoring, so a no-op edit does not pass for evidence.

- [ ] **Step 6: Commit**

```bash
git add server/booking-request.js tests/booking-request.test.js
git commit -m "feat: parseBookingRequest, the booking request's own field checks"
```

---

### Task 3: The POST names a service

Replaces `jobType` with `serviceId` / `notSure` and makes every existing booking test send the new required fields. Contact and consent storage comes in Task 4; this task only makes the request valid.

**Files:**
- Create: `tests/helpers/bookable.js`
- Modify: `server/server.js` (`PORTAL_JOB_TYPES` :4386, mechanics route :4405, POST :4549-4680)
- Modify: `tests/portal-capacity-reserve.test.js`, `tests/booking-lock.test.js`, `tests/portal-dropoff-booking.test.js`, `tests/portal-capacity-holds.test.js`, `tests/workshop-portal.test.js`, `tests/portal-booking-blocks.test.js`
- Test: `tests/portal-booking-request.test.js` (new)

**Interfaces:**
- Consumes: `parseBookingRequest(body, phone)` from Task 2.
- Produces (test helper): `seedJobTypes(shopId) -> Promise<{ quick: number, repair: number, service: number }>` (workshop_services ids of 30, 60 and 120 minutes, active, bookable online); `BOOKING_CONTACT = { email: 'booker@example.com', updateChannel: 'email', termsAccepted: true }`.

- [ ] **Step 1: Write the helper**

`tests/helpers/bookable.js`:

```js
// Bookable services for the booking-route tests. The old route took a job type
// ('quick', 'repair', 'service'); it now takes a workshop_services id, so a
// test seeds three services with those lengths and looks the id up by name.
import { runWithShop, prepare } from '../../server/db.js';

const TYPES = { quick: 30, repair: 60, service: 120 };

export async function seedJobTypes(shopId) {
  return runWithShop(shopId, async () => {
    const ids = {};
    for (const [name, minutes] of Object.entries(TYPES)) {
      const { lastInsertRowid } = await prepare(
        "INSERT INTO workshop_services (name, price, minutes, bookable_online, active, updated_at) VALUES (?, 10, ?, 1, 1, now())"
      ).run(`Test ${name}`, minutes);
      ids[name] = lastInsertRowid;
    }
    return ids;
  });
}

// The fields the details screen now makes required on every booking.
export const BOOKING_CONTACT = { email: 'booker@example.com', updateChannel: 'email', termsAccepted: true };
```

Before relying on it, check `workshop_services` for required columns without defaults: `sed -n 1,14p server/migrations/014_workshop_services.sql` and the later migrations that add `kind`, `category_id`, `position` (022). Adjust the INSERT until it runs.

- [ ] **Step 2: Write the failing integration tests**

Create `tests/portal-booking-request.test.js`:

```js
// The booking request: the service it names, the contact and consent it takes,
// the reference it returns.
// Spec: docs/superpowers/specs/2026-09-25-book-server-3-booking-request-design.md
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, seedMechanic } from './helpers/staff.js';
import { portalSignup, portalRequest } from './helpers/portal.js';
import { jsonRequest } from './helpers/http.js';
import { deleteTestShop } from './helpers/testShop.js';
import { futureDate } from './helpers/workshopFixtures.js';
import { seedJobTypes, BOOKING_CONTACT } from './helpers/bookable.js';

let server;
let owner;
let other;
let sam;
let types;
let customer;

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl);
  other = await staffSignup(server.baseUrl);
  sam = await seedMechanic(owner.shop.id, { name: 'Sam' });
  types = await seedJobTypes(owner.shop.id);
  customer = await portalSignup(server.baseUrl, owner.shop.slug, {});
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (other) await deleteTestShop(other.shop.id);
  if (server) await server.stop();
});

let day = 0;
// A different Monday-to-Friday date per call, so no two tests share a day's capacity.
const nextDate = () => futureDate(1 + (day++ % 5));
const book = (body, who = customer) => portalRequest(server.baseUrl, who.cookie, `/api/portal/${owner.shop.slug}/bookings`, {
  method: 'POST',
  body: {
    mechanicId: sam, jobDate: nextDate(), startTime: '10:00', description: 'Test booking',
    newBike: { make: 'Test', model: 'Bike' }, serviceId: types.repair, ...BOOKING_CONTACT, ...body,
  },
});
const job = (id) => runWithShop(owner.shop.id, () => prepare(
  'SELECT title, planned_minutes, start_time, end_time, terms_accepted_at, reference FROM workshop_jobs WHERE id = ?'
).get(id));

test('a service of this shop books, taking its length and name', async () => {
  const res = await book({ serviceId: types.service });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const j = await job(res.body.id);
  assert.equal(j.planned_minutes, 120);
  assert.equal(j.end_time, '12:00');
  assert.match(j.title, /^Online booking: Test service - Test booking$/);
});

test('not sure books one hour under a generic title', async () => {
  const res = await book({ serviceId: undefined, notSure: true });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const j = await job(res.body.id);
  assert.equal(j.planned_minutes, 60);
  assert.match(j.title, /^Online booking: Not sure - Test booking$/);
});

test('a service from another shop is refused', async () => {
  const foreign = (await seedJobTypes(other.shop.id)).repair;
  const res = await book({ serviceId: foreign });
  assert.equal(res.status, 400, JSON.stringify(res.body));
});

test('a service the shop has not ticked bookable online is refused', async () => {
  const id = await runWithShop(owner.shop.id, async () => (await prepare(
    "INSERT INTO workshop_services (name, price, minutes, bookable_online, active, updated_at) VALUES ('Staff only', 10, 30, 0, 1, now())"
  ).run()).lastInsertRowid);
  const res = await book({ serviceId: id });
  assert.equal(res.status, 400, JSON.stringify(res.body));
});

test('a retired service is refused', async () => {
  const id = await runWithShop(owner.shop.id, async () => (await prepare(
    "INSERT INTO workshop_services (name, price, minutes, bookable_online, active, updated_at) VALUES ('Retired', 10, 30, 1, 0, now())"
  ).run()).lastInsertRowid);
  const res = await book({ serviceId: id });
  assert.equal(res.status, 400, JSON.stringify(res.body));
});

test('the old jobType input no longer books', async () => {
  const res = await book({ serviceId: undefined, jobType: 'repair' });
  assert.equal(res.status, 400, JSON.stringify(res.body));
});
```

- [ ] **Step 3: Run and see it fail**

Run: `node --test tests/portal-booking-request.test.js`
Expected: FAIL. The first test gets 400 "Please choose the kind of job this is" because the route still wants `jobType`. If it fails with an import or seeding error instead, fix the helper before going on: that is not the right failure.

- [ ] **Step 4: Change the route**

In `server/server.js`:

1. Import at the top with the other server imports: `import { parseBookingRequest } from './booking-request.js';`
2. Delete `PORTAL_JOB_TYPES` (:4386-4390) and its comment block (:4380-4385), and delete the `jobTypes:` line from the `mechanics` route response (:4405).
3. In the POST, directly after `const body = await readJsonBody(req);` and **before** the guest branch, add:

```js
  // The request's own fields are checked before any customer row is created, so
  // a bad request leaves nothing behind. The phone the channel rule needs is the
  // guest's, or the signed-in customer's own.
  const phoneForChannel = signedIn
    ? ((await db.prepare('SELECT phone FROM customers WHERE id = ?').get(ctx.login.customer_id))?.phone || '') || (body.guestPhone || '')
    : body.guestPhone;
  const parsed = parseBookingRequest(body, phoneForChannel);
  if (parsed.error) return badRequest(res, parsed.error);
  const request = parsed.value;
```

4. Replace the `jobType` lines (:4582-4583) with the service lookup, still before the lock (a read of this shop's own rows, through the same RLS-scoped `db` shim):

```js
  // What the customer chose: a service this shop ticked bookable online, or the
  // "not sure" hour. Read through the shop's row-level security, so another
  // shop's service id finds nothing.
  let chosen;
  if (request.notSure) {
    chosen = { name: 'Not sure', minutes: 60 };
  } else {
    chosen = await db
      .prepare('SELECT id, name, minutes FROM workshop_services WHERE id = ? AND active = 1 AND bookable_online = 1')
      .get(request.serviceId);
    if (!chosen) return badRequest(res, 'That service is not available to book');
  }
```

5. Replace every remaining `jobType.minutes` in the handler with `chosen.minutes` (there are four: the end time, the reserve check, and `plannedMinutes`; grep `jobType` in the handler to be sure none remain).
6. Change the title: `title: \`Online booking: ${chosen.name} - ${description}\`.slice(0, 200),`

- [ ] **Step 5: Run the new file and see it pass**

Run: `node --test tests/portal-booking-request.test.js`
Expected: 6 pass.

- [ ] **Step 6: Move the six existing test files to `serviceId`**

In each of `tests/portal-capacity-reserve.test.js`, `tests/booking-lock.test.js`, `tests/portal-dropoff-booking.test.js`, `tests/portal-capacity-holds.test.js`, `tests/workshop-portal.test.js`, `tests/portal-booking-blocks.test.js`:
- import `{ seedJobTypes, BOOKING_CONTACT }` from `./helpers/bookable.js`;
- after the shop is created, `types = await seedJobTypes(shop.id)` (in files that make a shop per test, do it there);
- replace `jobType: 'quick' | 'repair' | 'service'` with `serviceId: types.quick | types.repair | types.service`;
- spread `...BOOKING_CONTACT` into each booking body.
`portal-capacity-reserve.test.js` passes `jobType` as a helper parameter (`book(baseUrl, cookie, slug, { mechanicId, startTime, jobType ...})`): rename the parameter to `serviceId` and pass the id. `workshop-portal.test.js` may assert on the old `jobTypes` list or title; read its booking tests and update assertions that mention the old title `Online booking: <description>` to the new format.

Then prove none are left: `grep -rn "jobType" tests server` must print nothing except `tests/portal-booking-request.test.js` (the "no longer books" test).

- [ ] **Step 7: Run the whole suite**

Run: `npm test`
Expected: all pass, none skipped. Fix any failure in the tests you just edited; a failure in a test you did not touch means the route change broke something, so stop and diagnose.

- [ ] **Step 8: Commit**

```bash
git add server/server.js tests
git commit -m "feat: the booking POST names a shop service, or not sure; jobType goes"
```

---

### Task 4: Contact, consent and the reference

**Files:**
- Modify: `server/server.js` (`createWorkshopJob` :2627, `serializePortalBooking` :2401, the POST)
- Test: `tests/portal-booking-request.test.js` (append)

**Interfaces:**
- Consumes: `request` (Task 2/3) in the POST; `createWorkshopJob` gains an optional `termsAcceptedAt` (ISO string or null).
- Produces: the POST 201 body is `serializePortalBooking(row)` plus `reference`.

- [ ] **Step 1: Append the failing tests**

```js
const customerRow = (id) => runWithShop(owner.shop.id, () => prepare(
  'SELECT email, update_channel, marketing_permission FROM customers WHERE id = ?'
).get(id));
const customerIdOf = (jobId) => runWithShop(owner.shop.id, async () =>
  (await prepare('SELECT customer_id FROM workshop_jobs WHERE id = ?').get(jobId)).customer_id);

test('the response carries the booking reference, and it is the one stored on the job', async () => {
  const res = await book({});
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.ok(res.body.reference, 'no reference in the response');
  assert.equal((await job(res.body.id)).reference, res.body.reference);
});

test('terms consent is stored as a timestamp on the job', async () => {
  const before = Date.now();
  const res = await book({});
  const stamp = new Date((await job(res.body.id)).terms_accepted_at).getTime();
  assert.ok(stamp >= before - 5000 && stamp <= Date.now() + 5000, 'timestamp is not "now"');
});

test('a booking without accepted terms is refused and creates no job', async () => {
  const res = await book({ termsAccepted: false });
  assert.equal(res.status, 400, JSON.stringify(res.body));
  assert.match(res.body.error, /terms/i);
});

test('preferences are saved on the customer', async () => {
  const c = await portalSignup(server.baseUrl, owner.shop.slug, {});
  const res = await book({ email: 'saved@example.com', updateChannel: 'email', marketingPermission: true }, c);
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.deepEqual({ ...(await customerRow(await customerIdOf(res.body.id))) },
    { email: 'saved@example.com', update_channel: 'email', marketing_permission: true });
});

test('marketing permission defaults to false when it is not sent', async () => {
  const c = await portalSignup(server.baseUrl, owner.shop.slug, {});
  const res = await book({}, c);
  assert.equal((await customerRow(await customerIdOf(res.body.id))).marketing_permission, false);
});

test('a returning customer\'s newer preferences overwrite the old ones', async () => {
  const c = await portalSignup(server.baseUrl, owner.shop.slug, {});
  await book({ email: 'first@example.com', updateChannel: 'email', marketingPermission: true }, c);
  const res = await book({ email: 'second@example.com', updateChannel: 'email', marketingPermission: false }, c);
  assert.deepEqual({ ...(await customerRow(await customerIdOf(res.body.id))) },
    { email: 'second@example.com', update_channel: 'email', marketing_permission: false });
});

test('sms needs a phone number; a signed-in customer with none on file is refused', async () => {
  const c = await portalSignup(server.baseUrl, owner.shop.slug, {});
  const res = await book({ updateChannel: 'sms', email: '' }, c);
  assert.equal(res.status, 400, JSON.stringify(res.body));
  assert.match(res.body.error, /phone number/i);
});

test('a guest books with a phone and the sms channel, and gets a reference', async () => {
  const res = await jsonRequest(server.baseUrl, null, `/api/portal/${owner.shop.slug}/bookings`, {
    method: 'POST',
    body: {
      mechanicId: sam, jobDate: nextDate(), startTime: '10:00', description: 'Guest booking',
      newBike: { make: 'Test', model: 'Bike' }, serviceId: types.quick,
      guestName: 'Gail Guest', guestPhone: '07700 900123',
      updateChannel: 'sms', termsAccepted: true,
    },
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.ok(res.body.reference);
  const row = await customerRow(await customerIdOf(res.body.id));
  assert.equal(row.update_channel, 'sms');
});

test('a refused booking changes nothing on the customer', async () => {
  const c = await portalSignup(server.baseUrl, owner.shop.slug, {});
  const okRes = await book({ email: 'keep@example.com', updateChannel: 'email' }, c);
  const customerId = await customerIdOf(okRes.body.id);
  // Fill Sam's whole day is heavy; a shop-rule refusal is enough: a Sunday is closed.
  const closed = futureDate(0);
  const res = await book({ jobDate: closed, email: 'lost@example.com' }, c);
  assert.equal(res.status, 400, JSON.stringify(res.body));
  assert.equal((await customerRow(customerId)).email, 'keep@example.com');
});
```

Check before trusting the last test: confirm a default test shop is closed on Sundays (`opening_days` default), and that this refusal happens inside the lock after the preferences would be written if the code were wrong (it must, or the test proves nothing). If Sunday is open, use `setOpeningDays` from `tests/helpers/staff.js` to close it.

- [ ] **Step 2: Run and see the failures**

Run: `node --test tests/portal-booking-request.test.js`
Expected: the new tests fail: no `reference` in the body, `terms_accepted_at` null, preferences null/false. The terms-refused test may already pass (Task 2's parser). That is expected; note which pass.

- [ ] **Step 3: Implement**

1. `serializePortalBooking`: add `reference: row.reference,` after `id`.
2. `createWorkshopJob`: add `termsAcceptedAt` to the destructured parameters, add `terms_accepted_at` to the column list and a `?` to the values, and pass `termsAcceptedAt ?? null`. The INSERT is column-and-placeholder-counted by hand: count both lists after editing.
3. In the POST, just before `createWorkshopJob({...})` inside the lock, save the preferences:

```js
    // Saved only now, inside the lock and past every refusal, so a booking that
    // is turned away changes nothing about the customer. Email is written only
    // when one was sent. For a guest this row is brand new each time (see
    // resolveGuestCustomer); for a signed-in customer it overwrites.
    await db
      .prepare(
        `UPDATE customers SET update_channel = ?, marketing_permission = ?, email = COALESCE(NULLIF(?, ''), email), updated_at = ? WHERE id = ?`
      )
      .run(request.updateChannel, request.marketingPermission, request.email, nowIso(), customerId);
```

   Postgres boolean binding: if the shim rejects a JS boolean for a boolean column, pass `request.marketingPermission ? true : false` as-is; do not convert to 1/0 (the column is BOOLEAN, unlike the older integer flags).
4. Pass `termsAcceptedAt: nowIso(),` in the `createWorkshopJob` call.

- [ ] **Step 4: Run and see it pass**

Run: `node --test tests/portal-booking-request.test.js`
Expected: all pass.

- [ ] **Step 5: Break it on purpose (twice)**

(a) Move the preferences `UPDATE` to before the slot checks, run "a refused booking changes nothing on the customer", confirm it fails, restore. (b) Delete `termsAcceptedAt: nowIso(),` from the call, confirm "terms consent is stored" fails, restore. Check `git diff` shows each mutation landed before restoring.

- [ ] **Step 6: Run the whole suite, then commit**

Run: `npm test`
Expected: all pass.

```bash
git add server/server.js tests/portal-booking-request.test.js
git commit -m "feat: the booking request stores contact and consent and returns its reference"
```

---

### Task 5: Every gate, docs, and the spec walk

**Files:**
- Modify: `.agents/STATUS.md`
- Modify: this plan (fill in the results)

- [ ] **Step 1: Run every gate**

```sh
npm run docker:up
npm test && npm run typecheck && npm run lint && npm run build
node scripts/ci/assert-rls-coverage.mjs
node scripts/ci/assert-screen-trace.mjs
npm run registry:validate && node scripts/ci/check-registry-drift.mjs
python3 docs/design/release-1-journey/package.py && node docs/design/release-1-journey/check-static.mjs && node docs/design/release-1-journey/check-notes.mjs
npm run test:browser
```

Expected: every command exits 0. Report the test count. If `check-screen-trace` wants a `screens:` comment on the POST route, add `// screens: details, pending` above it.

- [ ] **Step 2: Update STATUS**

Under Immediate next actions item 1, replace "Next: piece 3" with piece 3 built on `feat/book-server-3-booking-request` (state the test count from Step 1), name the plan and spec, point at this plan's decision log, and set the next piece to 4 (guest private link). Keep the file under 8,000 bytes (`wc -c`); if over, move text to `ARCHIVE.md`, never delete. Record decisions 1 and 3 there as open questions for Jack.

- [ ] **Step 3: Walk the build against the spec**

For each spec section, write in this plan's "Spec walk" below one line: met / dropped / changed, with the test that proves it. Expected outcomes to confirm, not assume: schema (Task 1 tests), `serviceId`/`notSure` (Task 3), channel rule (Tasks 2 and 4), terms (Tasks 2 and 4), customer record (Task 4), unchanged 2b behaviour (existing suite), reference (Task 4), "price comes from the service row" (**dropped**, decision 3), "the 409 code" (already shipped in 2b).

### Spec walk

- Schema (migration 025): **met** - `tests/migration-025.test.js`.
- `serviceId` / `notSure` (exactly one; other shop, not bookable, retired refused): **met** - `tests/portal-booking-request.test.js` (service, not sure, other shop, not bookable, retired, old `jobType`), `tests/booking-request.test.js`.
- Title, planned minutes from the service: **met**. Price from the service row: **dropped** (decision 3; `workshop_jobs` has no price column). Open question for Jack.
- Channel rule (email needs email; sms/whatsapp need phone): **changed** - guest phone is required for every channel (decision 1). Proved by `tests/booking-request.test.js` and the sms tests in `tests/portal-booking-request.test.js`.
- Terms (must be `true`, stored as `terms_accepted_at`): **met** - the two terms tests in `tests/portal-booking-request.test.js`, plus parser tests.
- Customer record (channel, email, marketing permission; newer overwrite): **changed** - overwrite applies to signed-in customers only, a guest gets a fresh row (decision 2). Tests: preferences saved, marketing default false, overwrite on repeat.
- Refused booking changes nothing: **met by construction, untested on the 23505 path**; the 400 case is tested ("a refused booking changes nothing on the customer").
- Unchanged 2b behaviour: **met** - existing suite, 595 pass, 0 fail.
- Reference in the response: **met** - "the response carries the booking reference".
- The 409 `capacity` code: **already shipped in 2b**, no change here.
- Migration applies from empty: covered by the CI gate run and `migration-025.test.js`; no separate scratch-database run recorded.

- [ ] **Step 4: Commit, push, open the PR**

```bash
git add .agents/STATUS.md docs/superpowers/plans/2026-09-25-book-server-3-booking-request.md
git commit -m "docs: STATUS and plan results for book server piece 3"
git push -u origin feat/book-server-3-booking-request
gh pr create --base main --title "Book server piece 3: the booking request"
```

Then check CI against the run's own head SHA (`gh run list --branch feat/book-server-3-booking-request --json headSha,conclusion,status`), not the PR pane. Do not merge; Jack decides.
