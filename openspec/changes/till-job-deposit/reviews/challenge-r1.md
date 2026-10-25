# Challenge r1: till-job-deposit

- Verdict: **partial**
- Confidence: medium-high
- `openspec validate till-job-deposit --strict`: `Change 'till-job-deposit' is valid` (exit 0)
- Reviewed against `45c68fa8` (main after #492).

## Phase 1: what I worked out from the repo, before reading past "Why"

A correct change on the current path has to:
1. Record money taken at the till against the job's order without making a
   second revenue record. Convert must then charge only the balance, and
   `paid_pence` and `check-money-totals.mjs` `checkOrders` (which today expects
   `paid_pence` = converted sale total + till lines) must agree.
2. Share one balance calculation across `/due`, convert, the customer page
   (`portal.js` `jobMoney`) and the Bike ready / Bike still waiting messages
   (`job-messages.js` `whatsLeftToPay` / `jobMessageVars`). All four work out
   "what's left" separately today.
3. Answer what a deposit is on a job whose order is still £0. Booked services
   sit in `workshop_job_services`, not on the order (`jobs.js:441-465`;
   `wholeBill`'s "booked services not on it", `jobs.js:650-656`).
4. Lock the order for every writer: convert, delete, refund, cancel, and
   re-linking the order to another job (`PUT /api/sale-documents/:id`
   accepts `workshopJobId`).
5. Cover refunds, cancel and decline, Didn't come, delete (which already
   checks `paid_pence > 0`, `workshop.js:1625`), and removing a staff member.
6. Put the money-meaning questions to Jack: which day a deposit counts, VAT,
   over-payment, kept deposits.

The change covers 1, 4 (in part), 5 and 6 well. It differs from my list on
2, 3 and the re-link half of 4. Those are the findings below.

## Findings

1. **[P1] Open question 3's default would block Jack's "deposit at
   drop-off" for most booked jobs, and the question doesn't say so.** The
   proposal (Open question 3) presents a £0 order as an edge case: "nothing
   agreed yet, for example a flat amount at drop-off before the bike is
   looked at". It is actually the normal state of a booked job at drop-off.
   Job creation inserts the order at £0 (`server/workshop/jobs.js:461-465`).
   The booked services go into `workshop_job_services` (`jobs.js:441-448`),
   and nothing copies them onto the order. Only approved quote lines
   (`addApprovedLinesToOrder`, `jobs.js:610`) and the work-and-parts editor
   (`work-parts.tsx:76`) add order lines. `wholeBill` exists because booked
   services are "not on it yet" (`jobs.js:650-656`).
   With Decision 4 (`deposit < leftToPayPence`, so £0 takes nothing), a job
   booked online for a service can't take a deposit at drop-off until someone
   adds work to its order. The question Jack answered named that case: "or
   hasn't started, as at drop-off"
   (`docs/decisions/2026-10-24-till-deposit-unfinished-work.md`). The default
   therefore contradicts a recorded decision in practice, and the trade-off
   given to Mark is described inaccurately. Restate question 3 with this
   evidence. Name the real choices, for example:
   - 1: count the booked services' prices in the bill for deposit purposes;
   - 2: put the booked services on the order at booking or book-in;
   - 3: keep the default, and tell Jack it means no drop-off deposit until
     work is added.

   Also add a test for a booked-service job at drop-off.

2. **[P2] The customer's page and the "Bike ready" text will still state the
   whole bill after a deposit, and paying a repair online has no contract to
   take till deposits off.** `portal.js` `jobMoney` (`527-563`) works out
   `toPay` from `computeOrderTotals` alone. `job-messages.js`
   `whatsLeftToPay` and `jobMessageVars` (`32-75`) do the same; their comment
   says "as the till would charge it", which stops being true. After a
   £27.75 deposit, the customer is texted and shown "£111.00 to pay on
   collection" and then charged £83.25.
   Paying a repair online is being built at the same time on the current
   record (replan `2ed09dc1`, slice A, "Jack: … paying online"). It needs
   `orderBalance`, or a customer could pay online the full bill on top of a
   till deposit. None of these files is in Impact or Decision 11. The
   proposal says the change "doesn't touch … public routes", but fixing
   `portal.js` would. Either add requirements, tasks and the risky-area
   note, or list the gap for Mark and Jack with a default. The online
   deposit has the same gap today, so the fix would cover both.

3. **[P2] An order holding till deposits can be moved off its job, which
   gets around the delete guard and loses the deposit.**
   `PUT /api/sale-documents/:id` changes `workshop_job_id` on any open order
   (`sales.js:330-343`). Decision 9 guards only `status: 'cancelled'`.
   Setting `workshopJobId: null` (or another job) on an order with held
   deposits has three effects:
   - the job's delete check, which only looks at orders still linked
     (`workshop.js:1625`), passes, and the job is deleted with money held;
   - the job page's `tillDeposits` and the refund route ("the job's order")
     no longer find the deposit;
   - convert on the now job-less order still counts the deposits.

   Related: a job can have more than one order (`workshop.js:1620` "a job can
   have more than one"). The design says "the job's order" throughout (the
   serializer's `json_agg`, the refund route's "not on this job's order"
   404) without saying which order, or all of them. Refuse re-linking while
   `paid_pence > 0`, as cancel is refused, and say how several orders on one
   job are handled. Each needs a test.

4. **[P2] Decision 10's "Take payment only while `leftToPayPence` is above 0"
   breaks two things that work today.** The basket's Take payment is
   currently disabled only when there are no lines or `/due` failed
   (`till-page.tsx:362`), so a job whose lines come to £0 (fully discounted
   or free) can be paid. Convert relies on that: "work given free is
   finished by taking £0 for it" (`sales.js`, `convertOrder`). The new rule
   would make such a job impossible to pay or finish at the till.
   It also strands a job whose bill dropped to exactly the deposits held.
   There, `overPence` is 0, so convert would accept a £0-cash payment with
   the deposits, but the till never lets staff press the button. The only
   way out is refunding a whole deposit and taking it again. Allow the
   balance payment at £0 left (Card, Cash and Split for £0, or a "Nothing
   left to pay" path), and add both cases to tasks 1.5 and 3.1.

5. **[P2] Task 1.5's check that sales are counted once by day would pass even
   if the feature were broken.** Convert's sale gets the database's
   `created_at = now()` (`createSale`'s insert sets no `created_at`). The
   dashboard and `?date=today` read the shop's today from the pinned clock,
   1 Sep 2026 (`server/clock.js`; `WHEELHOUSE_TEST_CLOCK`). That is why
   `tests/sales-all-records-routes.test.js` inserts its rows with
   `created_at '2026-09-01…'` directly. As a result:
   - "nothing on the deposit's day" passes whatever the deposit records,
     even if a broken build wrote it as a sale;
   - "£111.00 once on the day paid" can't pass unless the test reads the
     real day or by sale id.

   Assert on `all_sales` rows for the order's customer and the job's lines
   (count 1, total 11100, and no row before convert), not on "today".

6. **[P3] Every `[careful]` tag has no kind to justify it.** `openspec/config.yaml`
   `rules.tasks` lists no careful kinds (tests first, PR size, final
   checks), yet tasks 1.1–1.8, 1.10, 2.x and 3.1–3.3, 3.5 are all tagged.
   Either drop the tags or add the kinds to the config.

7. **[P3] Pull request 1 will likely exceed the 250–600 line rule.** It holds
   the migration, the new lib, the deposit route, `/due` and convert, the
   totals check, cancel and team, plus five test files. Consider splitting
   it: migration, deposit route and lib in one; convert, `/due` and the
   totals check in the next.

8. **[P3] A request key reused across orders turns into a server error.**
   The uniqueness rule is `(shop_id, request_key)`, but Decision 3's replay
   lookup is "for this order". A key already used on another order falls
   through to the insert and hits `23505`, a 500. Look the key up per shop,
   or answer 409.

9. **[P3] Decision 11 (what step C/E must redo) leaves things out.**
   `order_deposits.used_sale_id REFERENCES sales(id)` will block dropping
   `sales` at step E. Also missing: the customer page, the messages and
   paying online (finding 2).

10. **[P3] Several things are allowed or left open without being stated.**
    - A deposit is not refused on a `pending` or `offered` request, or on a
      job marked Didn't come (`no_show_at`).
    - The booking-ended check reads the job without the job's lock, so it
      can race a cancel. Harmless under question 5's default, but worth a
      sentence.
    - More than one till deposit per job is allowed by assumption: the
      drawing (`till-job-balance`) shows one "Deposit paid" line. Add it to
      Jack's list, or say it follows the closest pattern and log it.

11. **[P3] Test and wording details.**
    - Migration tests are named `tests/migration-NNN.test.js`
      (`migration-073`, `migration-075`), so task 1.1's
      `migration-order-deposits.test.js` should be `migration-084.test.js`.
    - The job page decides "Settle up first" from `orderStatus === 'converted'`
      (`job-dialog.tsx:153`), so a held deposit first shows "Delete [job]?"
      and only then the server's refusal, listed as "Paid on its order".
      State whether that wording stands for a deposit.

## What was checked and held

- **Delete already refuses `paid_pence > 0`:** `workshop.js:1624-1628`.
- **The online deposit is added by the server at convert:** `sales.js`
  `convertOrder`. `paid_pence` = the sale total; `checkOrders` holds that:
  `check-money-totals.mjs:146`.
- **Decision 8's line being superseded:** `wp-1-6-sales-in-pence/design.md:186-190`.
- **Receipt prints `extraPayments`:** `receipt.tsx:89`.
- **Staff removal clears these columns:** `team.js:157-161`.
- **The next migration number is 084:** the last is
  `083_all_sales_view.sql`.
- **The drawings exist as cited:** `till.mjs:241`, `630-636`;
  `book.mjs:444-446`.
- **The decisions are cited correctly:**
  `2026-10-24-deposit-after-paid.md`, morning answers 2 and 3.
- **Over-billing is checked only for till deposits:** `overPence` can't
  fire for an online deposit alone, because `onlineUsedPence` is capped at
  the bill. The online over-the-bill behaviour is unchanged.
- **Open questions 1, 2, 4, 5, 6 and 7** are each stated with a default. The
  VAT one says it is from memory.
