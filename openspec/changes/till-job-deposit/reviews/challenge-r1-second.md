# Challenge r1 (second, independent): till-job-deposit

- Verdict: **partial**
- Confidence: high (every finding below was verified against the code, not
  the change's own account of it)
- `openspec validate till-job-deposit --strict`: `Change 'till-job-deposit'
  is valid` (exit 0)
- Reviewed on `mark/till-job-deposit` at `45c68fa8` (main after #492).
- `reviews/challenge-r1.md` exists; no disposition yet, so this challenges
  the same revision. Where I re-derived a finding of theirs from the code I
  say so; the new findings are 6–10.

## Phase 1: what the repo says a correct change must do

From the Why section alone, before reading the rest:

1. Money taken at the till against a job's order without a second revenue
   record: today only convert writes `paid_pence` (to the sale's total,
   `server/routes/sales.js:666-668`), so any "paid so far" on an open order
   is new state. Its readers are exactly two: the delete guard
   (`server/routes/workshop.js:1625`) and `checkOrders` in
   `scripts/ci/check-money-totals.mjs` — both must be reworked, not just
   noted.
2. One balance calculation. Today "what's left" is worked out in four
   places: `/due` and convert (`sales.js`), the customer's page
   (`server/routes/portal.js` `jobMoney`, 527-560) and the Bike ready/Bike
   still waiting messages (`server/workshop/job-messages.js`
   `whatsLeftToPay`/`jobMessageVars`, 33-85). The last two don't even
   subtract the online deposit today.
3. What a deposit means on a freshly booked job, whose order is inserted at
   £0 (`server/workshop/jobs.js:463-465`); booked services live in
   `workshop_job_services` and reach the order only via quote approval or
   Work and parts (`wholeBill` exists for exactly this gap, `jobs.js:652-686`).
4. Locking: convert locks the order `FOR UPDATE`; the online deposit-refund
   locks it too (`workshop.js:1229`); delete locks all of a job's orders
   (`workshop.js:1616`, plural). Every new writer of `paid_pence` must take
   the same lock, and `PUT /api/sale-documents/:id` must stop being able to
   re-link an order holding money (`sales.js:330-346` accepts
   `workshopJobId` on any open document).
5. Refund, cancel, delete, staff removal (`team.js:157-161` nulls cashier
   columns; a new `order_deposits.employee_id` joins that list), and the
   route-list/reply-shape fixtures that exact-match the server
   (`tests/route-list.test.js`, `tests/reply-shapes.test.js`).
6. Money questions only Jack can answer, each with a default.

The change's architecture (a held-payment table, one sale at convert, the
server adding the tender) matches what the repo already does for the online
deposit and is the right shape. The change falls short of my list on 2, 3
and the re-link half of 4, and misses the small fixtures in 5.

## Findings

1. **[P1] Open question 3 misdescribes the common case, and its default
   defeats Jack's 24 Oct decision.** The proposal frames a £0 order as an
   edge case ("for example a flat amount at drop-off before the bike is
   looked at"). In the code it is the normal state of every booked job at
   drop-off: `createWorkshopJob` inserts the order with zero totals
   (`server/workshop/jobs.js:463-465`, verified: `VALUES ('order', ?, 0, 0,
   0, …)`), the booked services sit in `workshop_job_services`, and nothing
   copies them onto the order until a quote is approved or staff edit Work
   and parts (`wholeBill`'s "booked services not on it",
   `jobs.js:652-666`). With Decision 4's "strictly less than
   `leftToPayPence`", a job booked online for a £65 service cannot take a
   deposit at drop-off at all. Jack's 24 Oct answer named exactly that case
   ("or hasn't started, as at drop-off",
   `docs/decisions/2026-10-24-till-deposit-unfinished-work.md`). As written,
   the spec delta enshrines the contradiction as a requirement ("A bill with
   nothing on it yet → no deposit can be taken") and task 1.3 tests it in.
   The question to Mark and Jack must be restated with this evidence and
   real choices (count booked services toward the bill for deposits; put
   them on the order earlier; or keep the default and tell Jack drop-off
   deposits wait until work is added). Independently confirms
   challenge-r1 finding 1.

2. **[P2] The customer-facing money surfaces are out of the design, and the
   claim "doesn't touch public routes" collides with the fix.**
   `portal.js` `jobMoney` (527-560) computes `toPay` from
   `computeOrderTotals` alone — a customer who left £27.75 at the till still
   sees the full bill on their booking page, and `job-messages.js`
   `whatsLeftToPay`/`jobMessageVars` (33-85) text "£111.00 to pay on
   collection" the same way. Decision 5's `orderBalance` lists its callers
   as `/due`, the deposit route and convert; the repair-online payment —
   being built concurrently on the current record (replan §4 answer 3,
   commit `2ed09dc1`, verified: "Paying a repair online does not wait for
   step C… Jack: … paying online") — has no contract to subtract till
   deposits, so a customer could pay the whole bill online on top of a till
   deposit. The gap predates this change for the online deposit, but this
   change doubles the money it applies to. Either scope the fix in
   (requirements, tasks, and the risky-area line in the proposal gaining
   "public routes") or put it to Mark as an explicit known gap with an
   owner. Independently confirms challenge-r1 finding 2.

3. **[P2] An order holding deposits can be re-linked off its job, defeating
   the delete guard and stranding the money.** `PUT /api/sale-documents/:id`
   rewrites `workshop_job_id` on any open document (`sales.js:330-346`;
   verified the handler accepts null or another job). The delete guard only
   looks at orders still linked (`workshop.js:1625`), so unlinking lets the
   job be deleted with money held; the job page's `tillDeposits` and the
   refund route then can't see the deposit, while convert still counts it.
   Decision 9 guards only `status: 'cancelled'`. Related ambiguity the
   design never resolves: "the job's order" is singular throughout
   (`orderBalance(doc)`, the serializer's `json_agg`, the refund route's
   404), but a job can have several orders — the delete route locks them
   all (`workshop.js:1616`, `.all(id)`), and `WORKSHOP_JOB_SELECT`
   (`jobs.js:142`) joins with no kind/status filter or `LIMIT 1`. Refuse
   re-linking while `paid_pence > 0`, and state the rule for several orders.
   Each needs a test. Independently confirms challenge-r1 finding 3.

4. **[P2] Decision 10's "Take payment only while `leftToPayPence` is above
   0" breaks paying a £0 balance, which is decided behaviour.** Today the
   basket's button is enabled when the work is payable, lines exist and
   `/due` loaded (`till-page.tsx:362`), and convert finishes free work by
   taking £0 (`sales.js` `convertOrder`: "work given free is finished by
   taking £0 for it", covered by the work-action tests). Under the new gate
   such a job can never be paid or finished from the till. The same gate
   strands a job whose bill shrank to exactly the deposits held: `overPence`
   is 0, so convert would accept a £0-cash payment with the deposits (the
   sum still equals the total), but the screen can never start it — the only
   way out is refunding a whole deposit and re-taking it. The delta's
   MODIFIED "The till says when a job can't be paid" has no scenario for
   either. Allow the balance payment at £0 left and add both cases to tasks
   1.5 and 3.1. Independently confirms challenge-r1 finding 4.

5. **[P2] Task 1.5's once-per-day assertion can't prove the requirement.**
   `createSale`'s INSERT sets no `created_at` (verified in
   `server/lib/sales.js`), so a convert-made sale carries the database's
   real `now()`, while the dashboard and `?date=today` read the shop's day
   from the pinned clock, 1 Sep 2026 (`server/clock.js`;
   `WHEELHOUSE_TEST_CLOCK`; `nowIso` is plain system time). That is why
   `tests/sales-all-records-routes.test.js:38,55` insert `created_at`
   explicitly. As specified, "nothing on the deposit's day" passes whatever
   the code does, and "£111.00 once on the day paid" fails even when the
   build is right — unless the test backdates the sale by hand, which then
   proves nothing about convert. Assert on `all_sales` rows for the job:
   exactly one row carrying the job's lines, total 11100, and none before
   convert. Independently confirms challenge-r1 finding 5.

6. **[P3] Two exact-match fixtures are missing from Impact and tasks; both
   fail CI loudly, so the omission is mechanical, not silent.**
   - `src/lib/api/shapes.ts`: `shapeProblems` flags fields "not in the
     shape" as well as missing ones (verified), and
     `tests/reply-shapes.test.js:55,73` asserts real job replies against
     `WORKSHOP_JOB`. Adding `tillDeposits` to `serializeWorkshopJob` (task
     2.3) without adding it to `JOB_FIELDS` fails those tests; the task
     names only `src/lib/api/types.ts`.
   - `tests/fixtures/route-list.txt`: `tests/route-list.test.js` asserts
     the route table holds exactly the fixture's routes, so
     `POST /api/sale-documents/:id/deposits` and
     `POST /api/workshop-jobs/:id/till-deposits/:depositId/refund` must be
     added (`node scripts/print-route-list.mjs`) in the same pull requests.
     No task says so.
   Neither can ship broken — `npm test` goes red — but the tasks should
   name them.

7. **[P3] The deposit route checks for a `workshop_job_id` but not for
   `kind = 'order'`.** `PUT /api/sale-documents/:id` can link a *quote* to a
   job (the handler doesn't restrict kind; verified `sales.js:330-346`), and
   convert already treats any document with `workshop_job_id` as a job
   payment. A quote could then take deposits and have them counted at
   convert. Refuse non-order kinds in the deposit route (or say why not);
   one test.

8. **[P3] The idempotent replay's reply shape is unspecified.** Decision
   3's table says a repeated `requestKey` gets "200 with that deposit"; the
   201 carries `{ deposit, paidPence, leftToPayPence, billPence }`. If the
   200 omits the balance fields, a retried deposit leaves the till without
   the numbers it needs to render the result consistently. One sentence and
   a test assertion.

9. **[P3] Cross-order request-key reuse is a 500.** The uniqueness rule is
   `UNIQUE (shop_id, request_key)` but the replay lookup is "for this
   order": a key already used on another order falls through to the insert
   and hits `23505`. Keys are `crypto.randomUUID()` per pop-up opening, so
   this needs a buggy or replayed client — look the key up per shop, or map
   the violation to a 409. Independently confirms challenge-r1 finding 8.

10. **[P3] Housekeeping items, each verified:**
    - Every `[careful]` tag has no kind to justify it:
      `openspec/config.yaml` `rules.tasks` lists three rules (tests first,
      PR size, final checks) and no careful kinds, yet tasks 1.1–1.8, 1.10,
      2.1–2.5, 3.1–3.3 and 3.5 are tagged. Drop the tags or add the kinds
      to the config. (challenge-r1 finding 6, verified.)
    - Migration test naming: the convention is `tests/migration-NNN.test.js`
      (`migration-073`, `migration-075`, `migration-082` all exist), so task
      1.1's `migration-order-deposits.test.js` should be
      `migration-084.test.js`. (challenge-r1 finding 11, verified.)
    - The job page's client-side delete gate reads only
      `orderStatus === 'converted'` (`src/screens/diary/use-diary-extras.tsx:135-141`),
      so with a held deposit the pop-up first offers "Delete [job]?" and
      only the server's 409 stops it. The server refusal is right; say
      whether the screen's wording stands for a deposit. (challenge-r1
      finding 11, verified.)

## What was checked and held

- The delete guard already covers a deposit via `paid_pence > 0`
  (`workshop.js:1625`; commit `3c4f63a3` exists with that message).
- Convert adds "Deposit paid online" server-side and filters the till's
  claim (`sales.js` `convertOrder`); the change copies that pattern
  correctly for `TILL_DEPOSIT_TENDER`.
- The booking-ended refusal list matches the booking machine's rest states
  exactly (`state-machines.js:79,96`: declined, expired, cancelled).
- The percentage rounding in Decision 10 matches the booking deposit's
  (`server/workshop/deposit.js:24-28`: whole pence × whole percent, half up).
- The migration pattern in Decision 2 matches 070's (shop default from
  `current_setting`, RLS policy); 084 is the next free number (083 exists).
- Shop teardown needs no change: `tests/helpers/testShop.js` discovers
  shop-owned tables and retries around foreign keys.
- `pay-dialog.tsx` posts convert/`/api/sales` as the proposal says (the
  convert call is the `apiMutate` at its line ~82).
- Open questions 1, 2, 4, 5, 6 are each stated with a default and the VAT
  one is honestly marked as from memory.
- The replay/idempotency design, the lock ordering (order first, then the
  deposit row), and the refund-after-paid refusal
  (`docs/decisions/2026-10-24-deposit-after-paid.md`) are consistent with
  the existing routes.
