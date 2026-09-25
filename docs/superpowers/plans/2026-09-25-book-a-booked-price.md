# Book piece (a): booked price after booking — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The booking POST's 201 reply and the private-link read-back each carry `bookedPrice`, shown only when the shop shows prices online.

**Architecture:** One small server helper reads `show_prices_online` and returns the job's stored `booked_price` or `null`. The booking POST adds the field next to `privateLink` (not in `serializePortalBooking`, so the bookings list is unchanged); the link route selects `booked_price` and adds the field.

**Tech Stack:** Node (plain `http` router in `server/server.js`), Postgres 16 (compose, port 5433), `node:test`.

**Spec:** `docs/superpowers/specs/2026-09-25-book-a-booked-price-design.md`

## Global Constraints

- Field name exactly `bookedPrice`; value is `booked_price` as the db layer returns it (NUMERIC parsed to a number, `server/db.js:37`) or `null`.
- `null` when `show_prices_online` is not 1, when the booking is "not sure", or when `booked_price` is null.
- No arithmetic on the amount. No change to `serializePortalBooking`, staff routes, `/services`, or the bookings list.
- Tests need the compose Postgres up (`docker compose ps` shows `postgres` healthy); `npm test` hangs silently without it.
- Keep `tests/portal-booking-link.test.js` under 30 link lookups; new tests go in `tests/portal-booked-price.test.js`.
- Signed-in bookings in new tests (guest bookings are limited to 5 per hour per IP per server).
- Every new test is watched failing before the code, and has a named break step.
- Commit on `feat/book-a-booked-price`, never main. Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

### Task 1: `bookedPrice` on the booking POST reply

**Files:**
- Create: `tests/portal-booked-price.test.js`
- Modify: `server/server.js` (helper above the booking POST route at ~:4597; the 201 return at ~:4819)

**Interfaces:**
- Produces: `async function customerBookedPrice(bookedPrice)` in `server/server.js` — returns `bookedPrice ?? null` when the shop's `show_prices_online === 1`, else `null`. Must run inside the request's shop context (it reads `workshop_settings` under row-level security). Task 2 reuses it.
- Produces: test file helpers `book(body)`, `setShowPrices(on)`, `codeOf(link)`, `read(code)` used by Task 2.

- [ ] **Step 1: Write the failing test file**

```js
// The booked price reaches the customer after booking, only when the shop
// shows prices online.
// Spec: docs/superpowers/specs/2026-09-25-book-a-booked-price-design.md
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import '../server/load-env.js';
import { runWithShop, prepare } from '../server/db.js';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest, seedMechanic } from './helpers/staff.js';
import { portalSignup, portalRequest } from './helpers/portal.js';
import { jsonRequest } from './helpers/http.js';
import { deleteTestShop } from './helpers/testShop.js';
import { futureDate } from './helpers/workshopFixtures.js';
import { BOOKING_CONTACT } from './helpers/bookable.js';

let server;
let owner;
let sam;
let customer;
let serviceId;

before(async () => {
  server = await startLiveServer();
  owner = await staffSignup(server.baseUrl);
  sam = await seedMechanic(owner.shop.id, { name: 'Sam' });
  customer = await portalSignup(server.baseUrl, owner.shop.slug, {});
  serviceId = await runWithShop(owner.shop.id, async () => (await prepare(
    "INSERT INTO workshop_services (name, price, minutes, bookable_online, active, updated_at) VALUES ('Priced service', 65.50, 60, 1, 1, now())"
  ).run()).lastInsertRowid);
});

after(async () => {
  if (owner) await deleteTestShop(owner.shop.id);
  if (server) await server.stop();
});

let day = 0;
const nextDate = () => {
  const n = day++;
  const d = new Date(`${futureDate(1 + (n % 5))}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 7 * Math.floor(n / 5));
  return d.toISOString().slice(0, 10);
};

const setShowPrices = async (on) => {
  const res = await staffRequest(server.baseUrl, owner.cookie, '/api/workshop-settings', {
    method: 'PUT', body: { showPricesOnline: on },
  });
  assert.equal(res.body.showPricesOnline, on, JSON.stringify(res.body));
};

// Signed in as customer, so the guest limit is never reached.
const book = async (body = {}) => {
  const res = await portalRequest(server.baseUrl, customer.cookie, `/api/portal/${owner.shop.slug}/bookings`, {
    method: 'POST',
    body: {
      mechanicId: sam, jobDate: nextDate(), startTime: '10:00', description: 'Squeaky brakes',
      newBike: { make: 'Dawes', model: 'Galaxy' }, serviceId, ...BOOKING_CONTACT, ...body,
    },
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body;
};
const codeOf = (privateLink) => privateLink.split('/').pop();
const read = (code) => jsonRequest(server.baseUrl, null, `/api/portal/${owner.shop.slug}/booking-links/${code}`);

test('prices shown: the booking reply carries the booked price', async () => {
  await setShowPrices(true);
  const booked = await book();
  assert.equal(booked.bookedPrice, 65.5);
});

test('prices hidden: the booking reply carries no price', async () => {
  await setShowPrices(false);
  const booked = await book();
  assert.ok('bookedPrice' in booked, 'field present, empty');
  assert.equal(booked.bookedPrice, null);
});

test('not sure: the booking reply carries no price even when prices are shown', async () => {
  await setShowPrices(true);
  const booked = await book({ serviceId: undefined, notSure: true });
  assert.ok('bookedPrice' in booked, 'field present, empty');
  assert.equal(booked.bookedPrice, null);
});
```

If `staffRequest` returns a different shape than `{ status, body }`, check `tests/helpers/staff.js` and `tests/workshop-settings.test.js:84-93` and match them. If the "not sure" booking is refused with 400, read `server/booking-request.js` for the exact not-sure body and adjust only the test's body.

- [ ] **Step 2: Run it and watch it fail for the right reason**

Run: `node --test tests/portal-booked-price.test.js`
Expected: test 1 fails with `undefined !== 65.5`; tests 2 and 3 fail on `field present, empty`. Any other failure (400, 500, setup crash) means the test is wrong; fix the test first.

- [ ] **Step 3: Implement**

In `server/server.js`, directly above `route('POST', '/api/portal/:shopSlug/bookings', ...)`:

```js
// The booked price as a customer may see it after booking: only when the shop
// shows prices online, the same rule /services follows. Passed through as
// stored, never totalled. Runs inside the request's shop context.
// Spec: docs/superpowers/specs/2026-09-25-book-a-booked-price-design.md
async function customerBookedPrice(bookedPrice) {
  const settings = await db.prepare('SELECT show_prices_online FROM workshop_settings LIMIT 1').get();
  return settings?.show_prices_online === 1 ? (bookedPrice ?? null) : null;
}
```

Change the 201 return (row comes from `WORKSHOP_JOB_SELECT`, which selects `w.*`, so `row.booked_price` is there):

```js
    return {
      status: 201,
      body: {
        ...serializePortalBooking(row),
        bookedPrice: await customerBookedPrice(row.booked_price),
        privateLink: linkPath(params.shopSlug, linkCode),
      },
    };
```

Keep the existing comment `// The only time the code leaves the server: the database keeps its hash.` above it.

- [ ] **Step 4: Run and see it pass**

Run: `node --test tests/portal-booked-price.test.js`
Expected: 3 pass, 0 fail.

- [ ] **Step 5: Break step (record the output)**

Change the helper's return to `return bookedPrice ?? null;` (ignoring the setting). Run the file. Confirm with `grep -n "return bookedPrice ?? null;" server/server.js` that the edit landed. Expected: `prices hidden` fails with `65.5 !== null`. Restore the original line and re-run: 3 pass.

- [ ] **Step 6: Commit**

```bash
git add tests/portal-booked-price.test.js server/server.js
git commit -m "feat: booking reply carries bookedPrice when the shop shows prices

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `bookedPrice` on the private-link read-back

**Files:**
- Modify: `server/server.js` (link route ~:4824-4862: comment, SELECT, reply)
- Modify: `tests/portal-booked-price.test.js` (append)
- Modify: `tests/portal-booking-link.test.js:68-105` (exact shape; forbidden-key check)

**Interfaces:**
- Consumes: `customerBookedPrice(bookedPrice)` from Task 1; test helpers `book`, `setShowPrices`, `codeOf`, `read` from Task 1.

- [ ] **Step 1: Append failing tests to `tests/portal-booked-price.test.js`**

```js
test('prices shown: the private link carries the booked price', async () => {
  await setShowPrices(true);
  const res = await read(codeOf((await book()).privateLink));
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.bookedPrice, 65.5);
});

test('prices hidden: the private link carries no price', async () => {
  await setShowPrices(false);
  const res = await read(codeOf((await book()).privateLink));
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.ok('bookedPrice' in res.body, 'field present, empty');
  assert.equal(res.body.bookedPrice, null);
});

test('not sure: the private link carries no price even when prices are shown', async () => {
  await setShowPrices(true);
  const res = await read(codeOf((await book({ serviceId: undefined, notSure: true })).privateLink));
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.ok('bookedPrice' in res.body, 'field present, empty');
  assert.equal(res.body.bookedPrice, null);
});

test('the setting is read when the link is opened, not when it was booked', async () => {
  await setShowPrices(false);
  const code = codeOf((await book()).privateLink);
  await setShowPrices(true);
  assert.equal((await read(code)).body.bookedPrice, 65.5);
});
```

- [ ] **Step 2: Update `tests/portal-booking-link.test.js`**

In the exact-shape test (`a booking returns a private link...`), add `bookedPrice: null,` after `photoCount: 0,` (this shop never turns prices on, so `null` is correct).

Rename the test `the read-back carries no name, phone, email, price or notes` to `the read-back carries no name, phone, email or notes, and price only as bookedPrice`, and change the filter to:

```js
  const leakyKeys = Object.keys(res.body).filter(
    (k) => /price|name|phone|email|notes/i.test(k) && !['shopName', 'serviceName', 'bookedPrice'].includes(k)
  );
```

- [ ] **Step 3: Run both files and watch them fail for the right reason**

Run: `node --test tests/portal-booked-price.test.js tests/portal-booking-link.test.js`
Expected: the four new link tests fail (`undefined !== 65.5`, `field present, empty`); the exact-shape test fails because `bookedPrice` is missing. Nothing else fails.

- [ ] **Step 4: Implement**

Replace the route comment's last line `// identifies the customer, no price, no staff notes.` with:

```js
// identifies the customer, no staff notes. The booked price only when the
// shop shows prices online (customerBookedPrice).
```

In the SELECT, change `w.booking_state, w.custody_state, w.work_state,` to `w.booking_state, w.custody_state, w.work_state, w.booked_price,`.

In the reply, after `photoCount: row.photo_count,` add:

```js
    bookedPrice: await customerBookedPrice(row.booked_price),
```

- [ ] **Step 5: Run and see them pass**

Run: `node --test tests/portal-booked-price.test.js tests/portal-booking-link.test.js`
Expected: all pass.

- [ ] **Step 6: Break step (record the output)**

Remove `w.booked_price,` from the SELECT; confirm with `grep -c "w.work_state, w.booked_price" server/server.js` printing `0`. Run `tests/portal-booked-price.test.js`. Expected: `prices shown: the private link...` fails with `null !== 65.5`. Restore and re-run: all pass.

- [ ] **Step 7: Full suite**

Run: `npm test` (runs `pretest` build first).
Expected: 0 failures. Report the pass/fail counts from the output.

- [ ] **Step 8: Commit**

```bash
git add server/server.js tests/portal-booked-price.test.js tests/portal-booking-link.test.js
git commit -m "feat: private link carries bookedPrice when the shop shows prices

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
