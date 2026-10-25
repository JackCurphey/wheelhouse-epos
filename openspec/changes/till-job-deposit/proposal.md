# Proposal: taking a deposit at the till on a repair job

## Why

Jack decided on 29 Sep that part-paying a workshop job starts from the
payment: "Deposit" on Take payment, the bike stays in, and when the customer
comes back the job loads with a "Deposit paid" line and only the balance to
pay (`docs/decisions/2026-09-29-selling-at-the-till-review.md` decision 11;
drawn as `till-job-deposit` and `till-job-balance`, `generator/till.mjs:631-636`).
On 16 Oct and again on 24 Oct he said a deposit may be taken **at any stage**
of the job, and that the payment that pays the rest still needs the work
finished (`docs/decisions/2026-10-16-till-paying-orders.md` item 2;
`docs/decisions/2026-10-24-till-deposit-unfinished-work.md`: "Yes, deposits
only"; the rule it narrows is `docs/decisions/2026-10-08-paying-for-finished-work.md`).

The sales-in-pence design put paying an order in parts on the new till's sync
path (`openspec/changes/wp-1-6-sales-in-pence/design.md` Decision 8, step D).
That path doesn't exist yet: the new till still pays through `POST /api/sales`
and `POST /api/sale-documents/:id/convert` (`src/screens/till/pay-dialog.tsx:82-84`),
and the browser's offline core isn't built. On 25 Oct Mark decided that paying
a repair online is built on the current sales record now and redone at step C
(commit `2ed09dc1`, `docs/superpowers/plans/2026-10-25-playable-slices-replan.md`
§4 answer 3, on a branch not yet merged). Mark's decision for this change is
the same: **don't wait for step C**; build the smallest correct version on the
current path, and say what step C must redo.

## What Changes

- A deposit taken at the till is recorded against the job's order in a new
  table, `order_deposits` (migration), with how it was paid (cash, card or
  both), who took it and when. It is **not a sale**: no `sales` row, nothing
  in the `all_sales` view, no stock movement. The order's `paid_pence` goes up
  by the deposit in the same transaction.
- A deposit is taken at any stage of the work, but only for **less than what's
  left to pay**, so a deposit can never be the payment that pays the job off.
  "What's left" counts the booked services not yet on the order (the order is
  £0 at drop-off until staff add the work), so a booked job can take a
  deposit at drop-off (Open question 3). Refused on an order that isn't open,
  on anything but a workshop job's order, and on a booking that has ended
  (declined, expired, cancelled).
- What's due (`GET /api/sale-documents/:id/due`) takes deposits taken at the
  till off what's left to pay, after the online deposit, and lists them.
- Paying the rest (convert) still needs the work finished (unchanged). The one
  sale it makes carries the job's full lines and total, so the job's revenue is
  counted **once**, on the day it's paid in full. The deposits are a payment on
  that sale, "Deposit paid at the till", added by the server (never the till's
  claim), exactly as "Deposit paid online" is today (#473). The deposits are
  marked as used by that sale.
- A deposit taken at the till can be refunded by hand on the job, the whole
  deposit with a reason, until the order is paid; staff give it back the way
  it was paid. `paid_pence` goes down by it.
- Cancelling the job's order, or moving the order off its job, is refused
  while a deposit is held. Deleting the job is already refused while
  `paid_pence > 0` (audit item 12, `3c4f63a3`); this change adds the
  till-deposit case to its tests, and the job page goes straight to "refund
  what was paid".
- The customer's booking page and the Bike ready / Bike still waiting
  messages say what's left to pay as the till will charge it, every deposit
  taken off (today they state the whole bill, even after an online deposit).
  Paying a repair online, being built at the same time, is given the same
  rule to follow (design Decision 12).
- The totals check (`scripts/ci/check-money-totals.mjs`) learns the new rule
  for `paid_pence` on an open order, and checks each sale's "Deposit paid at
  the till" against the deposits it used.
- The till: a "Deposit" button on Take payment for a job, the drawn deposit
  pop-up (10%, 25%, 50%, Other; Deposit now; Paid at collection; "Bike stays
  in."), and a "Deposit paid · [date] · card" line when the customer comes
  back. The job page's deposit strip shows deposits taken at the till, with
  Refund the deposit.

## Capabilities

### Modified Capabilities

- `till`: take a deposit on a job at any stage; pay the rest once the work is
  finished, with deposits taken off.
- `workshop-jobs`: show and refund a deposit taken at the till; the job's order
  can't be cancelled or moved, nor the job deleted, while one is held.
- `book`: the booking page's "To pay when you collect" takes every deposit off.
- `workshop-collection`: Bike ready and Bike still waiting say what's left
  to pay with every deposit taken off.

## Work package, who, risky areas

- **WP-3.1** (the till, complete; build plan `till-deposit` board, situation
  `till-job-deposit`), the part STATUS calls "Taking a deposit at the till
  (`till-job-deposit`, paying an order in parts)". **Mark** takes it (STATUS
  "Mark is on"; replan slice A, "Mark: B, C, deposit at the till").
- **Risky areas:** (1) a migration (`order_deposits`); (2) money (payments,
  `paid_pence`, convert, refunds); (3) sign-in and public routes: the
  customer's page (`server/routes/portal.js`, what's left to pay) and
  `server/routes/team.js` (removing a staff member), both on the working
  agreement's list. Each pull request runs `/review` and goes in the weekly
  digest. It doesn't touch the core (`server/server.js`, `server/db.js`,
  `server/messaging/**`): `server/workshop/job-messages.js` only builds a
  message's words.

## Drawings and decisions it follows

- Drawings: `till-pay` (the "Deposit" button, `till.mjs:241`), `till-job-deposit`
  (`till.mjs:632-635`), `till-job-balance` (`till.mjs:636`), `till-job`
  (`till.mjs:458`), the job page's deposit strip and refund pop-up
  (`bk-staff-deposit`, `bk-staff-deposit-refund`, `bk-staff-deposit-refunded`,
  `book.mjs:444-446`, approved 24 Oct), `till-refund-cash` (`till.mjs:625`,
  giving money back in cash).
- Decisions: Selling at the till 8, 9, 10, 11
  (`2026-09-29-selling-at-the-till-review.md`); paying for finished work
  (`2026-10-08-paying-for-finished-work.md`); the till paying orders
  (`2026-10-16-till-paying-orders.md`); the till paying a job
  (`2026-10-18-till-job-payment.md`); deposits at any stage
  (`2026-10-24-till-deposit-unfinished-work.md`); a deposit counted at the till
  can't be refunded from the job (`2026-10-24-deposit-after-paid.md`); the
  morning questions 24 Oct answers 2 and 3 (`2026-10-24-morning-questions.md`);
  deleting a job (`2026-10-18-attachments-and-delete.md` answer 1, audit item 12).

## Out of scope

- A deposit on a plain sale, not a job (`till-deposit`'s own board, "Part now,
  the rest later — kept with the customer and the sale") and Cycle to Work
  deposits (`till-c2w-deposit`, WP-7.1).
- The till on sync (step C) and the new till paying orders through sync
  (step D). `design.md` lists what step C must redo.
- A real card machine (WP-3.1's adapter): Card stays "key it into the card
  machine, then Card approved", and a card refund is keyed into the machine.
- The cash-up and the day's takings report (WP-3.4), VAT reports (stage 6),
  and the till's general refunds (WP-3.1). `design.md` Decision 6 says what
  they must read.
- Emailing a deposit's receipt (the email route sends a sale).
- Building paying a repair online (Jack's piece); this change only states
  the rule it must follow (design Decision 12).
- A walk-in job with nothing booked and nothing on its order taking a
  deposit before any work is added (Open question 3).
- Money kept from a deposit on a cancelled job showing in sales (the same gap
  exists for kept online deposits today; design Decision 9).

## Open questions (for Jack; Mark approves or changes each default before they go to him)

Money questions only Jack can answer. Each is blocking until answered or its
default is accepted; the change is written to the recommended default.

1. **Which day does a deposit count in the shop's sales?** Default: **the day
   the job is paid in full**, as the online deposit is counted today. The till
   deposit isn't a sale, so the dashboard's "today" figure doesn't include it
   on the day it's taken; the cash-up (WP-3.4, not built) will count its cash
   in the drawer on that day. *Other way:* count it on the day it's taken, as
   its own sale, with the final sale taking it off as a minus line. That makes
   each day's sales match the money in, but every sale's discount working and
   the "top 5" figures have to learn to skip the minus line, and refunding a
   deposit before collection then needs a refund record the sales figures
   read, which doesn't exist yet. Costly to undo once shops have data.
2. **VAT on a deposit.** From memory, not checked here: HMRC treats a
   payment taken before the work is done as having its own VAT date, the
   day it's received. Jack's accountant should confirm. Default: **record the
   amount and the date taken, and no VAT now.** The old sales record has no
   VAT at all and labour's VAT rate is still Jack's open answer (#134), so
   nothing changes for VAT today; the VAT reports (stage 6) use the date kept.
3. **What a deposit at drop-off is measured against.** *Restated after
   review.* This is the usual case, not an edge case: a booked job's order
   is £0 when the bike is dropped off. The booked services (say a £65.00
   service) sit on the booking, not on the order, until staff add them in
   Work and parts or a quote is agreed (`server/workshop/jobs.js:445-465`).
   A deposit must be less than what's left, so with the order alone a
   booked job could take no deposit at drop-off, which is the case Jack's 24
   Oct answer names. Choices:
   1. **Count the booked services' prices toward the bill for deposits
      (recommended default).** The deposit pop-up shows the order plus any
      booked service not on it yet (the same sum the spending limit already
      uses); what the till charges at the end is still the order. Best for:
      drop-off deposits on every booked job, with nothing else changing.
      Costs: if staff never put the booked service on the order, the bill at
      payment can be below the deposit, and the till then refuses payment
      until a deposit is refunded (question 4), which shows the missing line.
      A walk-in with nothing booked and nothing on its order still takes no
      deposit until the work is added.
   2. **Put the booked services on the order when the job is booked or the
      bike is booked in.** Best for: one bill everywhere. Costs: changes how
      every job is made and what the spending limit, the quote and the
      customer's page add up; a larger change in other people's code, and
      a decision of Jack's on its own.
   3. **Keep the order alone.** Best for: the smallest build. Costs: no
      deposit at drop-off on a booked job until someone adds the work first,
      so Jack must be told his 24 Oct answer only half holds.
4. **The bill drops below the deposits taken** (work declined after the
   deposit). Default: **paying is refused until a deposit is refunded on the
   job**, saying so; then the rest is taken. *Other way:* count deposits up to
   the bill and show the extra as "not paid back here yet", as the online
   deposit does, which leaves the shop owing the customer with nothing
   recording it.
5. **A cancelled, declined or expired booking with a till deposit held, or a
   customer who doesn't come back.** Default: **nothing happens by itself**;
   the job shows the deposit with Refund the deposit, and staff hand it back
   or keep it. *Other way:* owe it back by itself when the shop cancels (as
   the online deposit is), shown until someone hands the money over.
6. **Refunding a till deposit** is by hand, the whole deposit, with a reason,
   back the way it was paid (cash from the drawer, card keyed into the card
   machine), with no manager PIN, until the job is paid. Default: **as
   stated**, following 24 Oct answer 2 and Selling at the till decisions 4 and 9.

One screen question (Jack's, as a change to an approved flow):

7. **Reaching Deposit when the work isn't finished.** Today Take payment is
   greyed until the work is under way or finished, and on work in progress it
   asks "Who's signing this off?" before the payment opens. Default: **Take
   payment can be pressed at any stage; Card, Cash and Split stay greyed until
   the work can be paid for, and Deposit is always offered; the sign-off
   question moves to when Card, Cash or Split is chosen**, so a deposit never
   asks it. *Other way:* a separate "Take a deposit" button beside Take
   payment, which isn't drawn.

Where the drawings are silent and the closest built pattern is followed
(logged in `decided-while-building.md`, Mark's section): the deposit's
printed receipt and its Paid note (design Decision 10); more than one till
deposit on a job, each its own "Deposit paid" line (the drawing shows one;
design Decision 3); the customer's page and messages now taking the online
deposit off too (design Decision 12).

## Impact

- Migration: `server/migrations/084_order_deposits.sql` (the next free
  number; `scripts/ci/check-migrations.mjs` checks it).
- Server: new `server/lib/order-deposits.js`; `server/routes/sales.js` (a new
  deposit route, `/due`, convert, `PUT /api/sale-documents/:id` refusing
  cancel or a move while money is held); `server/routes/workshop.js` (a refund
  route); `server/workshop/jobs.js` (the job's `tillDeposits`);
  `server/routes/team.js` (removing a staff member);
  `server/routes/portal.js` (`jobMoney`) and `server/workshop/job-messages.js`
  (`whatsLeftToPay`, `jobMessageVars`).
- Fixtures: `tests/fixtures/route-list.txt` (two new routes);
  `src/lib/api/shapes.ts` (`JOB_FIELDS` gains `tillDeposits`).
- Scripts: `scripts/ci/check-money-totals.mjs`.
- Screens: `src/screens/till/pay-dialog.tsx`, `till-page.tsx`, a new
  `deposit-step.tsx`, `receipt.tsx`; `src/screens/diary/job-deposit.tsx`,
  `job-dialog.tsx` (the delete pop-up's first step).
- Another change: `openspec/changes/wp-1-6-sales-in-pence/design.md` Decision 8
  says convert refuses an order with `paid_pence > 0`; this change supersedes
  that line for till deposits (task 1.9 updates it).
