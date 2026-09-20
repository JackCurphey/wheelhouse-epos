# Phase 3 Patch — Quote Read Endpoints Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the three missing `GET` endpoints that let a quote be read back, and extend the screen-trace check to cover read routes, so Phase 4's seven quote screens have something to render from.

**Architecture:** Phase 3 shipped four quote *write* paths and no read path at all
(`grep -n "api/quotes" server/server.js` returns only POSTs). This patch adds a
staff revision list, a staff single-quote read with its lines, and a customer
portal read of the quote behind an approval link. All three are read
projections over `workshop_quotes` / `workshop_quote_lines`, which already
exist (migration `017_workshop_quotes.sql`). No schema change, no new module —
the read helpers live beside the existing writes in `server/workshop/quotes.js`.

**Tech Stack:** plain-Node server (`server/server.js`), `pg` via
`server/db.js`'s `prepare()` wrapper (`?` placeholders, `.get/.all/.run`),
`node:test` for tests.

**Spec:** `docs/superpowers/specs/2026-09-20-release-1-screen-build-design.md`
(Phase 3, "API layer"), and `docs/superpowers/plans/2026-09-20-phase-3-api.md`
for the conventions this patch continues.

## Global Constraints

- **Money is a JS float and is totalled in SQL, never in JavaScript.** Decided
  20 Sep, recorded in `.agents/ARCHIVE.md`. Every line total and quote total in
  this patch is computed by Postgres in the query. A `reduce()` over amounts in
  a handler is a defect, not a style preference.
- **Every covered endpoint names a screen.** A `// screens: <id>, <id>` comment
  sits immediately above the route with no blank line between, and every id
  must exist in `docs/design/release-1-journey/screen-index.json`. Enforced by
  `scripts/ci/assert-screen-trace.mjs`.
- **Never hand-edit the atlas HTML or `screen-index.json`** — `package.py`
  regenerates them. This patch only reads them.
- **`npm test` hangs silently without the compose Postgres up.** Run
  `npm run docker:up` first.
- **The app is on `localhost:8080`, Postgres on `5433`.**
- Tenant scope comes from `app.current_shop_id`; row-level security does the
  filtering. Do not add `WHERE shop_id = ?` by hand — `assert-rls-coverage.mjs`
  is the check that the policy exists.

## Decisions taken in this plan

| # | Decision | Rationale |
|---|---|---|
| 1 | This ships as a **Phase 3 patch on its own branch**, merged before Phase 4 starts | Jack, 20 Sep. Keeps the "Phase 3 = API, Phase 4 = screens" boundary true, and puts the `COVERED` extension in the phase whose job that check is |
| 2 | `COVERED` is extended **before** any GET is added | The check is the guard; adding routes first means they escape it silently, which is the exact failure mode the trace rule exists to prevent |
| 3 | Totals are returned by the API, computed in SQL | The money rule binds Phase 4; if the API does not supply a total, every screen will compute one in JavaScript |
| 4 | The portal read requires a customer session and returns only that customer's quote | Matches `recordLineDecision` / `approve`, which already resolve the customer the same way |

## Test setup convention

Tests live flat in `tests/` as `<topic>.test.js` and run under `node --test`.
Server-touching tests boot the real server as a child process via
`startLiveServer()` from `tests/helpers/liveServer.js` and make raw HTTP
requests through `staffRequest()` / `jsonRequest()`. A shop with a real owner
session comes from `staffSignup()` in `tests/helpers/staff.js`; tear the shop
down with `deleteTestShop()` from `tests/helpers/testShop.js` in an `after()`
hook.

**Every new test in this plan is confirmed by breaking the code it covers,**
watching it fail for the right reason, and restoring. A step for this is
written into each task. Assert the mutation actually landed before believing
the failure — a no-op edit makes a test look sound while proving nothing.

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `scripts/ci/assert-screen-trace.mjs` | Enforces endpoint → screen tracing | Modify: extend `COVERED` to read routes |
| `tests/screen-trace.test.js` | Proves the trace checker works | Modify: add a case for an untraced GET |
| `server/workshop/quotes.js` | Quote domain logic, beside the existing writes | Modify: add `readQuote`, `listRevisions`, `serializeQuoteWithLines` |
| `server/server.js` | Route table | Modify: three new GET routes near the existing quote POSTs (~`:2875`) |
| `tests/workshop-quote-reads.test.js` | The three read endpoints | Create |

---

### Task 1: Extend the screen trace to read routes

**Files:**
- Modify: `scripts/ci/assert-screen-trace.mjs`
- Test: `tests/screen-trace.test.js`

**Interfaces:**
- Consumes: `screenIdsFromIndex()`, already exported from the checker.
- Produces: a `COVERED` list that matches `GET /api/quotes/:id`,
  `GET /api/workshop-jobs/:id/quotes` and `GET /api/portal/:shopSlug/quotes/:id`,
  so Tasks 2–4 cannot land an untraced route.

- [ ] **Step 1: Read the existing checker and test**

Run: `cat scripts/ci/assert-screen-trace.mjs tests/screen-trace.test.js`

The current allow-list is:

```js
const COVERED = [
  /^\/api\/workshop-jobs\/:id\/[a-z-]+$/,
  /^\/api\/quotes\/:id\/[a-z-]+$/,
  /^\/api\/portal\/:shopSlug\/quotes\//,
];
```

Note what it does **not** match: `/api/workshop-jobs/:id/quotes` *is* already
matched by the first pattern, but `/api/quotes/:id` (no trailing segment) is
not matched by the second, which requires `/:id/<something>`.

- [ ] **Step 2: Write the failing test**

Add to `tests/screen-trace.test.js`:

```js
test('a GET route with no screens comment is reported', () => {
  const source = [
    "route('GET', '/api/quotes/:id', async (req, res, params) => {",
    '});',
  ].join('\n');
  const problems = checkSource(source, new Set(['quote-editor']));
  assert.equal(problems.length, 1);
  assert.match(problems[0], /names no screen/);
});

test('a GET route naming a real screen passes', () => {
  const source = [
    '// screens: quote-editor',
    "route('GET', '/api/quotes/:id', async (req, res, params) => {",
    '});',
  ].join('\n');
  assert.deepEqual(checkSource(source, new Set(['quote-editor'])), []);
});
```

If `checkSource` is not the exported name in the current file, use whatever
the existing tests in `tests/screen-trace.test.js` already call — do not
rename the export.

- [ ] **Step 3: Run the test to verify it fails**

Run: `node --test tests/screen-trace.test.js`
Expected: FAIL — the first case reports 0 problems instead of 1, because
`/api/quotes/:id` matches no `COVERED` pattern and is therefore not checked at
all.

- [ ] **Step 4: Extend COVERED**

In `scripts/ci/assert-screen-trace.mjs`:

```js
// Phase 3 owned the workshop write paths. The quote read patch adds the first
// GETs under these prefixes, so the shapes below widen to cover a route with
// no trailing action segment. Phase 4 widens this again as screen read
// endpoints land; a route shape absent from this list is not checked at all,
// which is why it is extended before the routes are written, never after.
const COVERED = [
  /^\/api\/workshop-jobs\/:id(\/[a-z-]+)?$/,
  /^\/api\/quotes\/:id(\/[a-z-]+)?$/,
  /^\/api\/portal\/:shopSlug\/quotes\//,
];
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `node --test tests/screen-trace.test.js`
Expected: PASS.

- [ ] **Step 6: Run the real checker against the real source**

Run: `node scripts/ci/assert-screen-trace.mjs`
Expected: it now also checks `GET /api/workshop-jobs/:id` and
`GET /api/workshop-jobs` — which have **no** `// screens:` comment today, so
this will FAIL and name them.

This is the widened net catching pre-existing routes, not a regression. Add
the comments it asks for. `GET /api/workshop-jobs/:id` backs the job
workspace, and `GET /api/workshop-jobs` backs the diary and the desk:

```js
// screens: job, job-page
route('GET', '/api/workshop-jobs/:id', async (req, res, params) => {
```

```js
// screens: desk, diary, week, month
route('GET', '/api/workshop-jobs', async (req, res, params, query) => {
```

If the checker names any route beyond these two, stop and report it rather
than inventing screen ids — every id must already exist in
`screen-index.json`.

- [ ] **Step 7: Verify the checker passes**

Run: `node scripts/ci/assert-screen-trace.mjs`
Expected: exit 0, no output.

- [ ] **Step 8: Break it on purpose**

Delete the `// screens: job, job-page` line, re-run
`node scripts/ci/assert-screen-trace.mjs`, and confirm it fails naming that
route. Restore the line and confirm it passes again. A widened `COVERED` that
does not actually catch a missing comment has bought nothing.

- [ ] **Step 9: Commit**

```bash
git add scripts/ci/assert-screen-trace.mjs tests/screen-trace.test.js server/server.js
git commit -m "test: extend the screen trace to read routes"
```

---

### Task 2: Read one quote with its lines and a SQL-computed total

**Files:**
- Modify: `server/workshop/quotes.js`
- Modify: `server/server.js` (new route beside the quote POSTs, ~`:2875`)
- Test: `tests/workshop-quote-reads.test.js` (create)

**Interfaces:**
- Consumes: `prepare()` from `server/db.js`.
- Produces: `readQuote({ quoteId })` returning
  `{ ok: true, quote, lines, totals }` or `{ ok: false, reason: 'not_found' }`;
  and `serializeQuoteWithLines(quote, lines, totals)` returning
  `{ id, workshopJobId, revision, state, createdAt, lines: [...], totals: {...} }`
  where each line is
  `{ id, kind, description, productId, quantity, unitAmount, decision, lineTotal }`
  and `totals` is `{ all, approved, pending, declined }`. Task 3 and Task 4
  both reuse `serializeQuoteWithLines`.

- [ ] **Step 1: Write the failing test**

Create `tests/workshop-quote-reads.test.js`:

```js
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startLiveServer } from './helpers/liveServer.js';
import { staffSignup, staffRequest } from './helpers/staff.js';
import { deleteTestShop } from './helpers/testShop.js';

let server;
let session;

before(async () => {
  server = await startLiveServer();
  session = await staffSignup(server.baseUrl);
});

after(async () => {
  if (session) await deleteTestShop(session.shop.id);
  if (server) await server.stop();
});

async function jobWithQuote(lines) {
  const job = await staffRequest(server.baseUrl, session.cookie, '/api/workshop-jobs', {
    method: 'POST',
    body: { title: 'Quote read fixture', jobDate: '2026-10-01' },
  });
  assert.equal(job.status, 201, JSON.stringify(job.body));
  const quote = await staffRequest(
    server.baseUrl,
    session.cookie,
    `/api/workshop-jobs/${job.body.id}/quotes`,
    { method: 'POST', body: { lines } },
  );
  assert.equal(quote.status, 201, JSON.stringify(quote.body));
  return { jobId: job.body.id, quoteId: quote.body.id };
}

test('reads a quote back with its lines and a total', async () => {
  const { quoteId } = await jobWithQuote([
    { kind: 'labour', description: 'Full service', quantity: 1, unitAmount: 85 },
    { kind: 'part', description: 'Chain', quantity: 2, unitAmount: 24.5 },
  ]);

  const res = await staffRequest(server.baseUrl, session.cookie, `/api/quotes/${quoteId}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.id, quoteId);
  assert.equal(res.body.revision, 1);
  assert.equal(res.body.state, 'draft');
  assert.equal(res.body.lines.length, 2);
  assert.equal(res.body.lines[1].lineTotal, 49);
  assert.equal(res.body.totals.all, 134);
  assert.equal(res.body.totals.pending, 134);
  assert.equal(res.body.totals.approved, 0);
});

test('a quote that does not exist is 404, not an empty quote', async () => {
  const res = await staffRequest(server.baseUrl, session.cookie, '/api/quotes/999999');
  assert.equal(res.status, 404);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run docker:up && node --test tests/workshop-quote-reads.test.js`
Expected: FAIL — the read returns 404 for a quote that exists, because
`GET /api/quotes/:id` is not a route.

- [ ] **Step 3: Add the read helper**

In `server/workshop/quotes.js`, beside the existing writes:

```js
// Totals are summed by Postgres, never in JavaScript. Money is a JS float in
// this codebase (decided 20 Sep) and the mitigation that makes that safe is
// that JS never does the arithmetic - it carries a number the database
// computed. A reduce() over these lines would reintroduce exactly the drift
// the decision was taken to avoid.
const LINE_TOTALS = `
  SELECT
    id, kind, description, product_id, quantity, unit_amount, decision,
    (quantity * unit_amount) AS line_total
  FROM workshop_quote_lines
  WHERE workshop_quote_id = ?
  ORDER BY id
`;

const QUOTE_TOTALS = `
  SELECT
    COALESCE(SUM(quantity * unit_amount), 0) AS all_total,
    COALESCE(SUM(quantity * unit_amount) FILTER (WHERE decision = 'approved'), 0) AS approved_total,
    COALESCE(SUM(quantity * unit_amount) FILTER (WHERE decision = 'pending'), 0) AS pending_total,
    COALESCE(SUM(quantity * unit_amount) FILTER (WHERE decision = 'declined'), 0) AS declined_total
  FROM workshop_quote_lines
  WHERE workshop_quote_id = ?
`;

export async function readQuote({ quoteId }) {
  const quote = await prepare('SELECT * FROM workshop_quotes WHERE id = ?').get(quoteId);
  if (!quote) return { ok: false, reason: 'not_found' };
  const lines = await prepare(LINE_TOTALS).all(quoteId);
  const totals = await prepare(QUOTE_TOTALS).get(quoteId);
  return { ok: true, quote, lines, totals };
}

export function serializeQuoteWithLines(quote, lines, totals) {
  return {
    ...serializeQuote(quote),
    lines: lines.map((l) => ({
      id: l.id,
      kind: l.kind,
      description: l.description,
      productId: l.product_id,
      quantity: Number(l.quantity),
      unitAmount: Number(l.unit_amount),
      decision: l.decision,
      lineTotal: Number(l.line_total),
    })),
    totals: {
      all: Number(totals.all_total),
      approved: Number(totals.approved_total),
      pending: Number(totals.pending_total),
      declined: Number(totals.declined_total),
    },
  };
}
```

`Number()` here converts pg's `NUMERIC`-as-string to a float. That is a cast of
a value Postgres computed, not arithmetic — it is what the money rule permits.

- [ ] **Step 4: Add the route**

In `server/server.js`, immediately above the existing
`POST /api/workshop-jobs/:id/quotes` route (~`:2875`), with no blank line
between the comment and the route:

```js
// screens: quote-editor, quote-send, approved
route('GET', '/api/quotes/:id', async (req, res, params) => {
  const result = await readQuote({ quoteId: Number(params.id) });
  if (!result.ok) return notFound(res, 'Quote not found');
  sendJson(res, 200, serializeQuoteWithLines(result.quote, result.lines, result.totals));
});
```

Add `readQuote` and `serializeQuoteWithLines` to the existing import block from
`./workshop/quotes.js` at the top of `server/server.js` (~`:19`).

- [ ] **Step 5: Run the test to verify it passes**

Run: `node --test tests/workshop-quote-reads.test.js`
Expected: PASS, both cases.

- [ ] **Step 6: Break it on purpose**

Change `COALESCE(SUM(quantity * unit_amount), 0) AS all_total` to
`COALESCE(SUM(unit_amount), 0) AS all_total` — dropping the quantity.
Run: `node --test tests/workshop-quote-reads.test.js`
Expected: FAIL on `totals.all`, expected 134, got 109.5.

Confirm the edit actually landed (`grep -n "SUM(unit_amount)" server/workshop/quotes.js`
must print a line) before believing the failure. Then restore and re-run to
green.

- [ ] **Step 7: Verify the trace still passes**

Run: `node scripts/ci/assert-screen-trace.mjs`
Expected: exit 0.

- [ ] **Step 8: Commit**

```bash
git add server/workshop/quotes.js server/server.js tests/workshop-quote-reads.test.js
git commit -m "feat: read a quote back with its lines and SQL-computed totals"
```

---

### Task 3: List a job's quote revisions

**Files:**
- Modify: `server/workshop/quotes.js`
- Modify: `server/server.js`
- Test: `tests/workshop-quote-reads.test.js`

**Interfaces:**
- Consumes: `serializeQuote()` (already exported).
- Produces: `listRevisions({ jobId })` returning an array of quote rows,
  newest revision first.

- [ ] **Step 1: Write the failing test**

Append to `tests/workshop-quote-reads.test.js`:

```js
test('lists a job\'s quote revisions newest first, with the superseded one visible', async () => {
  const { jobId, quoteId } = await jobWithQuote([
    { kind: 'labour', description: 'Full service', quantity: 1, unitAmount: 85 },
  ]);

  const second = await staffRequest(
    server.baseUrl,
    session.cookie,
    `/api/workshop-jobs/${jobId}/quotes`,
    { method: 'POST', body: { lines: [
      { kind: 'labour', description: 'Full service', quantity: 1, unitAmount: 95 },
    ] } },
  );
  assert.equal(second.status, 201, JSON.stringify(second.body));

  const res = await staffRequest(server.baseUrl, session.cookie, `/api/workshop-jobs/${jobId}/quotes`);

  assert.equal(res.status, 200);
  assert.equal(res.body.length, 2);
  assert.equal(res.body[0].revision, 2);
  assert.equal(res.body[1].revision, 1);
  // Phase 3 supersedes rather than mutates: revision 1 must still be readable.
  assert.equal(res.body[1].id, quoteId);
  assert.equal(res.body[1].state, 'superseded');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/workshop-quote-reads.test.js`
Expected: FAIL — `GET /api/workshop-jobs/:id/quotes` is not a route, so the
server answers the request some other way and `res.body.length` is not 2.

- [ ] **Step 3: Add the helper**

In `server/workshop/quotes.js`:

```js
// Newest first. Every revision stays readable: Phase 3 supersedes rather than
// mutates, and screen 23 (approved) has to show what was agreed even after a
// later revision exists.
export async function listRevisions({ jobId }) {
  return prepare(
    'SELECT * FROM workshop_quotes WHERE workshop_job_id = ? ORDER BY revision DESC'
  ).all(jobId);
}
```

- [ ] **Step 4: Add the route**

In `server/server.js`, above the existing POST of the same path:

```js
// screens: quote-editor, approved, job
route('GET', '/api/workshop-jobs/:id/quotes', async (req, res, params) => {
  const rows = await listRevisions({ jobId: Number(params.id) });
  sendJson(res, 200, rows.map(serializeQuote));
});
```

Add `listRevisions` and `serializeQuote` to the import block if not already
present.

An empty array for a job with no quotes is correct and is **not** a 404 — the
job exists, it simply has no quotes yet, and screen 19 (`quote-editor`) opens
in exactly that state.

- [ ] **Step 5: Run the test to verify it passes**

Run: `node --test tests/workshop-quote-reads.test.js`
Expected: PASS, all four cases.

- [ ] **Step 6: Break it on purpose**

Change `ORDER BY revision DESC` to `ORDER BY revision ASC`.
Run the test. Expected: FAIL on `res.body[0].revision`, expected 2, got 1.
Confirm the edit landed, then restore and re-run to green.

- [ ] **Step 7: Commit**

```bash
git add server/workshop/quotes.js server/server.js tests/workshop-quote-reads.test.js
git commit -m "feat: list a job's quote revisions"
```

---

### Task 4: Customer portal read of a quote

**Files:**
- Modify: `server/server.js`
- Test: `tests/workshop-quote-reads.test.js`

**Interfaces:**
- Consumes: `currentCustomerSession(req)`, `readQuote`,
  `serializeQuoteWithLines`.
- Produces: `GET /api/portal/:shopSlug/quotes/:id` — the read behind screens
  `approval` (21), `approval-done` (22) and `stale` (51).

- [ ] **Step 1: Write the failing test**

The portal tests need a customer session. Follow the existing pattern in
`tests/helpers/portal.js` — read it first (`cat tests/helpers/portal.js`) and
use its signup/login helper rather than writing a new one. Then append:

```js
test('an unauthenticated portal read is refused', async () => {
  const { quoteId } = await jobWithQuote([
    { kind: 'labour', description: 'Full service', quantity: 1, unitAmount: 85 },
  ]);
  const res = await staffRequest(
    server.baseUrl,
    null,
    `/api/portal/${session.shop.slug}/quotes/${quoteId}`,
  );
  assert.equal(res.status, 401);
});
```

Add a signed-in case using the portal helper, asserting the customer sees the
same `totals.all` the staff read returns, and a wrong-shop case asserting 401
when the slug belongs to a different shop.

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/workshop-quote-reads.test.js`
Expected: FAIL — the route does not exist, so the status is not 401.

- [ ] **Step 3: Add the route**

In `server/server.js`, beside the other portal quote routes (~`:2890`):

```js
// screens: approval, approval-done, stale
// Customer-authenticated, resolved exactly the way every other portal route
// does it. The customer reads the quote their approval link points at; the
// revision they were shown travels in the link, and POST .../approve refuses
// a revision that has moved. This read deliberately returns the CURRENT
// revision so screen 51 (stale) can compare the two and say so.
route('GET', '/api/portal/:shopSlug/quotes/:id', async (req, res, params) => {
  const ctx = await currentCustomerSession(req);
  if (!ctx || ctx.shop.slug !== params.shopSlug) return sendJson(res, 401, { error: 'Not signed in' });
  const result = await readQuote({ quoteId: Number(params.id) });
  if (!result.ok) return notFound(res, 'Quote not found');
  sendJson(res, 200, serializeQuoteWithLines(result.quote, result.lines, result.totals));
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/workshop-quote-reads.test.js`
Expected: PASS.

- [ ] **Step 5: Break it on purpose**

Remove the `|| ctx.shop.slug !== params.shopSlug` clause. Run the test.
Expected: FAIL on the wrong-shop case — a customer of one shop reads another
shop's quote. Confirm the edit landed, restore, re-run to green.

This is the one break in this plan that matters most: it is a tenancy leak,
and a test that does not catch it is not protecting anything.

- [ ] **Step 6: Commit**

```bash
git add server/server.js tests/workshop-quote-reads.test.js
git commit -m "feat: customer portal read of a quote behind the approval link"
```

---

### Task 5: Close the patch

- [ ] **Step 1: Run every canonical command**

```bash
npm run docker:up
npm test && npm run typecheck && npm run lint && npm run build
node scripts/ci/assert-rls-coverage.mjs
node scripts/ci/assert-screen-trace.mjs
```

Expected: all green. Record the actual pass/fail counts — not "all good".

- [ ] **Step 2: Revert the build artefact**

`npm run build` dirties `public/dist`. Run `git status` and confirm nothing
unexpected is staged.

- [ ] **Step 3: Push and open the PR**

```bash
git push -u origin fix/phase-3-quote-reads
```

The PR body states: the three endpoints, the screens each serves, that totals
are computed in SQL, and the pass counts from Step 1.

- [ ] **Step 4: Confirm CI actually ran**

A green merge state is not a green check. Open the PR's checks and confirm the
`test` job executed against this branch's head commit. If no check ran, the
gate did not exist for this work — find out why before merging.

---

## What this plan does not cover

- Any screen. This patch is server-only; Phase 4 consumes it.
- Quote PDF or printable output — that is P08 and blocked on P00b.
- Expiring a sent quote on a timer. `expired` is a legal state in the
  migration's `CHECK` and nothing sets it; that is Phase 5's scheduling work
  and is out of scope here.
- Any change to the four existing quote write paths.
