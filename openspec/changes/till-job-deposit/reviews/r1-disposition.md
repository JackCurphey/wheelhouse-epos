# r1 disposition: till-job-deposit

Answers `challenge-r1.md` (first review) and `challenge-r1-second.md`
(second, independent), both against `45c68fa8`. Each finding was checked
against the code before it was answered; where it held, the change was
revised. Files changed: `proposal.md`, `design.md` (rewritten in place, with
r1 rows in its decision log), `tasks.md` (now five pull requests),
`specs/till/spec.md`, `specs/workshop-jobs/spec.md`, and two new delta specs,
`specs/book/spec.md` and `specs/workshop-collection/spec.md`.

The two reviews agree on findings 1–5; they are answered together. "R1-n" is
the first review's finding n, "R2-n" the second's.

## Summary

| Finding | Severity | Verdict | Where it went |
|---|---|---|---|
| R1-1 / R2-1: a £0 order at drop-off blocks Jack's drop-off deposit | P1 | **Accepted** | Proposal Open question 3 restated with three choices; design Decision 4 (expected bill); till spec; tasks 1.3, 5.1 |
| R1-2 / R2-2: customer's page and messages state the whole bill; paying online has no contract | P2 | **Accepted** (scoped in) | Design Decision 12; new delta specs `book`, `workshop-collection`; proposal risky areas; tasks 3.1–3.4 |
| R1-3 / R2-3: an order holding deposits can be moved off its job; several orders | P2 | **Accepted** | Design Decision 9; workshop-jobs spec; tasks 1.5, 2.1, 4.1 |
| R1-4 / R2-4: "Take payment only while left > 0" strands free work and a bill equal to the deposits | P2 | **Accepted** | Design Decisions 7 step 4, 10; till spec "Nothing left to pay still finishes the job"; tasks 2.1, 5.1 |
| R1-5 / R2-5: the once-per-day test can't prove anything | P2 | **Accepted** | Tasks preamble and 2.1 assert on `all_sales` rows by sale id; till spec scenario reworded |
| R1-6 / R2-10a: `[careful]` tags have no kind | P3 | **Partly accepted** | Tags kept; each now names its kind (tasks preamble) |
| R1-7: pull request 1 too large | P3 | **Accepted** | Tasks split into five pull requests |
| R1-8 / R2-9: a request key reused across orders is a 500 | P3 | **Accepted** | Design Decision 3 (`request_key_used`); task 1.3 |
| R1-9: Decision 11 leaves things out | P3 | **Accepted** | Design Decision 11 items 8, 9 |
| R1-10: states allowed, the unlocked booking check, more than one deposit | P3 | **Accepted** | Design Decision 3 bullets; till spec; tasks 1.3, 5.4 |
| R1-11 / R2-10b,c: migration test name; the job page's delete wording | P3 | **Accepted** | Task 1.1 `migration-084.test.js`; design Decision 10; workshop-jobs spec; task 4.4 |
| R2-6: route-list and reply-shape fixtures | P3 | **Accepted** | Design Context and Decision 10; tasks 1.4, 4.3 |
| R2-7: the deposit route doesn't refuse a quote | P3 | **Accepted** | Design Decision 3 (`not_a_job` for `kind ≠ 'order'`); till spec; task 1.3 |
| R2-8: the replay's reply shape | P3 | **Accepted** | Design Decision 3; task 1.3 |

Also found while revising (not raised by either review): the proposal said
the change touches no sign-in or public-route files, but
`server/routes/team.js`, which it already changed, is on the working
agreement's risky list 3 (`openspec/changes/working-agreement/design.md`
§2.3). The proposal's risky areas now name it and `portal.js`.

## Findings in detail

### R1-1 / R2-1 [P1]: Open question 3 misdescribed the usual case — Accepted

**Checked:** `createWorkshopJob` inserts the order with
`VALUES ('order', ?, 0, 0, 0, …)` (`server/workshop/jobs.js:463-465`); the
booked services go into `workshop_job_services` (`jobs.js:445`); a grep of
`server/` and `src/` for `workshop_job_services` finds no writer that copies
them to `sale_document_items`. Only `addApprovedLinesToOrder` and Work and
parts (`work-parts.tsx:76`, `PUT /api/sale-documents/:id/items`) add lines.
`wholeBill` (`jobs.js:656-690`) sums "the order, plus each booked service's
price not already on it". So a booked job's order is £0 at drop-off, and the
old Decision 4 would have refused every drop-off deposit on a booked job,
against Jack's 24 Oct answer ("or hasn't started, as at drop-off").

**Change:**
- Proposal Open question 3 is restated with the evidence and three choices,
  each with what it's best for and what it costs: 1, count the booked
  services toward the bill for deposits (recommended default); 2, put the
  booked services on the order when booking or booking in; 3, keep the
  order alone and tell Jack drop-off deposits wait until the work is added.
- Design Decision 4 is rewritten to the recommended choice: an **expected
  bill** (`expectedBillPence` = the order plus `bookedNotOnOrderPence`, the
  same sum `wholeBill` makes, booked services counted only toward the job's
  newest open order) and `expectedLeftPence`, which a deposit must be below.
  What the till charges (`billPence`, `leftToPayPence`) is unchanged.
  `orderBalance`'s return gains those fields (Decision 5); `/due` and the
  deposit reply expose them (Decisions 3, 7); the pop-up's title,
  percentages, "Paid at collection", the Paid note and the receipt's "Left
  to pay" use them (Decision 10).
- A job with nothing booked and nothing on its order is refused with a new
  code, `nothing_on_bill`, "There’s nothing on this job’s bill yet. Add the
  work in Work and parts, then take a deposit." (Decision 3), rather than
  "less than the £0.00 left to pay".
- What choice 1 leaves is stated (Decision 4 and Risks): if staff never add
  the booked service, the bill at payment can be below the deposit and
  convert refuses with `deposits_over_bill`, which shows the missing line.
- Till spec: the requirement and its £0 scenario are replaced by "A booked
  job at drop-off" and "Nothing booked and nothing on the bill".
- Tests: task 1.3 (a booked-service job with an empty order takes a deposit;
  not counted twice once the service is on the order; `nothing_on_bill`),
  task 5.1 (the screen at drop-off; Deposit greyed with nothing on the bill).

This remains a question for Jack; the change is written to choice 1 pending
Mark's approval of that default.

### R1-2 / R2-2 [P2]: what the customer is told — Accepted, scoped in

**Checked:** `portal.js` `jobMoney` works `due` from `computeOrderTotals`
alone; `job-messages.js` `whatsLeftToPay` and `jobMessageVars` do the same,
under the comment "as the till would charge it". Neither takes the online
deposit off either. Paying a repair online is on Jack's side of replan slice
A, on the current record (`2ed09dc1`,
`docs/superpowers/plans/2026-10-25-playable-slices-replan.md` line 59).

**Change:** scoped in rather than left as a gap, because a till deposit
would make the customer's page and the Bike ready text wrong by the whole
deposit:
- `orderBalance` gains a reader-only partner, `jobOrderBalance(jobId)`, which
  picks the job's order the way `portal.js` and `job-messages.js` already do
  (newest `kind = 'order'` not cancelled) (Decision 5).
- Design Decision 12: `jobMoney`'s `toPay`/`nothingToPay` and both message
  figures read `leftToPayPence`. This also takes the online deposit off,
  which today they don't; it makes them match the till and their own
  comment, and is logged in `decided-while-building.md` (task 3.4). Mark
  should look at this one: it changes what customers with an online deposit
  see today, from the whole bill to the bill less the deposit.
- Paying a repair online gets a contract in Decision 12 (charge
  `leftToPayPence`; lock the order; add and mark used the held till
  deposits; refuse on `overPence`), posted on its issue (task 3.4). This
  change doesn't build that piece.
- New delta specs: `book` ("The booking page's 'to pay' takes every deposit
  off") and `workshop-collection` ("A message's 'What's left to pay' takes
  every deposit off"), each with a deposit and a refunded scenario.
- Proposal: risky area 3 added (`portal.js`, a public route), plus Impact and
  Capabilities. `job-messages.js` is in `server/workshop/`, not the
  messaging core (`server/messaging/**`), so area 4 isn't touched.
- Tasks 3.1–3.4, its own pull request.

### R1-3 / R2-3 [P2]: moving an order off its job; several orders — Accepted

**Checked:** `PUT /api/sale-documents/:id` sets `workshop_job_id` to `null`
or another job on any open document (`sales.js:333-343`); delete's guard
reads only linked orders (`workshop.js:1625`) and locks them all
(`workshop.js:1616`); `WORKSHOP_JOB_SELECT` joins
`sale_documents d ON d.workshop_job_id = w.id` unfiltered (`jobs.js:142`).

**Change:** Design Decision 9 now refuses cancelling **or** moving
(`workshopJobId` different from the order's, including `null`) with
`paid_pence > 0`, `deposit_held`, nothing changed, read under the order's
lock. It states the several-orders rule: a deposit belongs to its order;
`tillDeposits` lists every linked order's deposits with `orderId`; the
refund route finds the deposit among the job's orders and locks that one;
booked services count only toward the newest open order; convert counts only
its own order's deposits. Workshop-jobs spec: the requirement now covers
moving, with a "Moving the order off the job" scenario. Tests: task 1.5
(cancel, unlink, re-link refused; delete still refused after a refused
unlink), task 2.1 (two orders, convert counts its own), task 4.1 (a second
order's deposit is listed and refunds).

### R1-4 / R2-4 [P2]: £0 left to pay — Accepted

**Checked:** Take payment today is disabled on
`!payable || lines.length === 0 || !due || dueQuery.isError`
(`till-page.tsx:362`), so lines at £0 can be paid; convert finishes "work
given free … by taking £0" (`sales.js:608`); `PayDialog` offers
`Card · £0.00` (`pay-dialog.tsx:123-125`).

**Change:** Decision 10's gate is now: order open, what's due loaded, and
either lines on the order (as today, £0 included) or a deposit possible
(`expectedLeftPence` ≥ 2p). Card, Cash and Split additionally need payable
work and lines; Deposit needs `expectedLeftPence` ≥ 2p. Decision 7 step 4
says a £0 balance is paid with cash and card 0, the deposit payments making
up the total. New till requirement "Nothing left to pay still finishes the
job". Tests: task 2.1 (a bill equal to the deposits; free work unchanged),
task 5.1 (Take payment · £0.00 and Card · £0.00 pay it).

### R1-5 / R2-5 [P2]: the once-per-day test — Accepted

**Checked:** `createSale`'s `INSERT INTO sales (…)` lists no `created_at`
(`server/lib/sales.js:515`), so the sale carries the database's `now()`,
while "today" is the pinned 1 Sep 2026.

**Change:** task 2.1 asserts on `all_sales` rows for the order's customer:
none before convert, exactly one after, by the sale's id, `total_pence`
11100, with the job's lines. The tasks preamble says no test reads a sale
through "today". The till spec scenario now says "the shop's sales hold that
one sale for the job and no other" instead of "the day's sales".

### R1-6 / R2-10a [P3]: `[careful]` tags — Partly accepted

**Checked:** `openspec/config.yaml` `rules.tasks` lists no careful kinds,
as both say. The kinds come from the spec-writer's own rules, not the repo
config: kind 4 (database migrations and schema, including RLS) and kind 6
(computes, stores or shows a price, payment or refund). Every tagged task
here is one or the other.

**Change:** tags kept, since dropping them would break the rule they come
from; the tasks preamble now defines the two kinds and each tagged task
names its kind, e.g. `[careful] (migration)`. Adding kinds to
`openspec/config.yaml` is outside a spec change's scope; if Mark wants the
repo config to carry them, that's a separate edit.

### R1-7 [P3]: pull request size — Accepted

Tasks now make five pull requests: 1, the migration, lib, deposit route and
the cancel/move/staff guards; 2, `/due`, convert and the totals check; 3, the
customer's page and messages; 4, refunds and the job page; 5, the till's
screens. Line counts are estimates until built.

### R1-8 / R2-9 [P3]: request key reused across orders — Accepted

Decision 3 looks the key up per shop, first after "order not found": same
order → 200 replay; another order → 409 `request_key_used`, "That request
was already used for another order. Close the pop-up and try again.", never
a 500 from the unique rule. Task 1.3 tests it.

### R1-9 [P3]: Decision 11 omissions — Accepted

Decision 11 item 8: `order_deposits.used_sale_id REFERENCES sales(id)`
blocks dropping `sales` at step E; step E relinks or drops the constraint
first. Item 9: the customer's page, the messages and paying online read
`orderBalance` and move with it.

### R1-10 [P3]: things allowed without being stated — Accepted

Decision 3 now says: `pending`, `offered`, `scheduled`,
`reschedule_requested` and a job marked Didn't come take a deposit (the
booking is still live; the customer may yet bring the bike); the booking
check reads without the booking lock, and a cancel at the same moment ends
in the same state Open question 5's default gives a deposit taken just
before it, so it's accepted, not locked against; more than one deposit per
job is allowed, each its own line, logged in `decided-while-building.md`
(task 5.4) and listed in the proposal's "drawings are silent" paragraph
rather than added to Jack's questions. Till spec states the live states and
more than one deposit.

### R1-11 / R2-10b, c [P3]: test name and delete wording — Accepted

- Task 1.1 is now `tests/migration-084.test.js` (the convention:
  `migration-073`, `-075`, `-082` exist).
- Delete wording: the job page's first step comes from `askDelete` in
  `src/screens/diary/job-dialog.tsx:151-157` (`job.orderStatus === 'converted'`);
  R2 cited `use-diary-extras.tsx:135-141`, which is the action-reason list,
  not the delete pop-up. Decision 10 now counts a held till deposit as paid
  there, so the pop-up goes straight to the existing "Settle up first" and
  "Refund what was paid — then delete." (`job-dialog.tsx:611-628`). New
  workshop-jobs requirement and scenario; task 4.4 tests it.

### R2-6 [P3]: exact-match fixtures — Accepted

**Checked:** `shapeProblems` flags `"${field}: not in the shape"`
(`src/lib/api/shapes.ts:79`), asserted on job replies
(`tests/reply-shapes.test.js:55,73`); `tests/route-list.test.js` deep-equals
the route table to `tests/fixtures/route-list.txt`.

**Change:** Design Context and Decision 10 name both; task 1.4 adds the
deposit route to the fixture, task 4.3 the refund route and
`tillDeposits: ['array']` in `JOB_FIELDS`.

### R2-7 [P3]: a quote linked to a job — Accepted

The deposit route refuses `kind ≠ 'order'` with `not_a_job` (Decision 3).
Till spec scenario "A quote linked to a job"; task 1.3 tests it. Convert's
own handling of a linked quote is unchanged and out of scope.

### R2-8 [P3]: the replay's reply shape — Accepted

Decision 3: the 200 replay has the same shape as the 201, with the deposit
and the balance as it is now. Till spec "Pressed twice" scenario and task
1.3 assert it.

## Open questions for Mark (unchanged in number, one restated)

- **Question 3 is restated** with three choices and recommends choice 1; the
  change is written to it. It is a money question for Jack.
- **New for Mark to check, not for Jack:** Decision 12 makes the customer's
  page and the Bike ready / Bike still waiting messages take an **online**
  deposit off as well as a till deposit. It's a fix that makes them say what
  the till charges, logged as decided while building; Mark may prefer to
  scope it to till deposits only, which would keep today's (wrong) figure
  for online deposits.

## Validation

`openspec validate till-job-deposit --strict`, run after the revision:
`Change 'till-job-deposit' is valid`. (A first run warned that the till
requirement "A deposit is always less than what's left to pay" was over 500
characters; the `nothing_on_bill` rule was split into its own requirement,
"A job with nothing on its bill takes no deposit", and the rerun was clean.)
