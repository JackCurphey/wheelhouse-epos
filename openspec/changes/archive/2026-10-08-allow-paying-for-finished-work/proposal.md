## Why

"Mark ready for collection" finishes a job's work, and the customer pays
afterwards — the shop's normal order. Paying for the job's order then failed
with "cannot finish a job that is complete; from here you can reopen", and
the job page offers no way back. Found while writing the workshop-jobs spec
(8 Oct); Jack decided the fix the same day
(`docs/decisions/2026-10-08-paying-for-finished-work.md`, reading his 20 Sep
"the job record governs" decision as "the record must say the work is done").

## What Changes

- Paying for a job's order is also accepted when the work is already
  finished; the job is left as it is (no second finish, no version change).
- Unchanged: payment is still refused for work not started, on hold or
  waiting for parts; work in progress is still finished by the payment.

Out of scope: the old job form's save resetting work (a separate finding);
a "Reopen work" button on the job page.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `workshop-jobs`: "Paying for a job's order finishes the work only when
  finishing is allowed" — already-finished work is now accepted.

## Impact

- Work package: a bug fix to built behaviour, outside the stage plan.
- Lane: the check lives in the sales code (`POST /api/sale-documents/:id/convert`,
  Mark's); the job rules are Jack's. A server change by Jack, so Mark approves.
- Code: one guard in the convert route; one new server test.
