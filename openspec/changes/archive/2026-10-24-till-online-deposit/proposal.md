# Proposal: a deposit paid online comes off at the till

## Why

A customer who paid a deposit when booking online is charged the whole bill
at the till today: nothing takes the deposit off. Jack decided on 29 Sep
(`docs/decisions/2026-09-29-selling-at-the-till-review.md` decision 11) that
the job loads with "a "Deposit paid" line, only the balance to pay". It's
drawn as `till-job-balance` (`till.mjs:636`), with the receipt in
`collect.mjs:204` (`cp-receipt-email-deposit`). The 18 Oct note says "when
they are [taken], a deposit counts too"
(`decided-while-building.md:419`). It waited for Mark's sales in pence
(#404), now merged. On 24 Oct Jack decided that once the job is paid, the
deposit can't be refunded from the job
(`docs/decisions/2026-10-24-deposit-after-paid.md`). Jack's lane.

## What Changes

- What's due for a job's order says its paid deposit and what's left to pay.
- Paying a job's order records the deposit as its own payment, "Deposit paid
  online". The server works the amount out itself, never taking the till's
  word for it, and the till takes only what's left.
- The till's job view shows "Deposit paid · [date] · online" taken off,
  then Take payment for the rest.
- Once a job's order is paid, "Refund the deposit" isn't offered, and the
  server refuses it.

## Capabilities

### Modified Capabilities

- `till`: a job's online deposit comes off what's due.
- `workshop-jobs`: a deposit can be refunded by hand until the job is paid.

## Out of scope

- Taking a deposit at the till (`till-job-deposit`): it needs paying an
  order in parts, a piece of its own.
- A deposit larger than the bill (if work was declined): the deposit counts
  up to the bill; what's left over isn't paid back yet, and the till says so.

## Impact

`server/routes/sales.js` (`/due`, convert), a new
`server/workshop/counted-deposit.js`, `server/routes/workshop.js`
(deposit-refund), `src/screens/till/till-page.tsx`,
`src/screens/diary/job-deposit.tsx`, tests. **Risky area:** money (sales and
payments), so `/review` runs. No migration.
