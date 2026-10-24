# Design: the diary job's deposit, the server

## Decisions

1. **Migration 072** adds `workshop_jobs.no_show_at` and
   `no_show_by_login_id`. "Didn't come" is a mark, not a booking state: the
   booking stays as it was, so nothing else changes, and Undo clears it.
2. **The job's deposit** (`serializeWorkshopJob`'s `deposit`): `{ pence,
   paidAt, state, refundedAt, refundReason, refundedBy, noShowAt, noShowBy }`
   or null, from the job's latest online payment and its logins, joined into
   `WORKSHOP_JOB_SELECT`. `state`: `refunded` (refunded, let go or owed),
   `kept` (taken, and the job cancelled late or marked Didn't come) or
   `paid`.
3. **`POST /api/workshop-jobs/:id/deposit-refund`** `{ reason }`: any signed-in
   staff member, as other job actions; a reason of 1 to 200 characters; the
   payment taken or held and not already owed or refunded, else 409
   `code: 'not_refundable'`. It owes the refund with the staff member's login
   (part 3's `oweRefund`), then makes it, and answers the job.
4. **`POST /api/workshop-jobs/:id/didnt-come`** `{ version }`: only while the
   booking stands (`scheduled`), the bike is expected and the booked day is
   before the shop's today; marks it and moves the version, else 409
   `illegal` (or `stale`). **`POST …/didnt-come/undo`** `{ version }` clears it.
   Neither touches the deposit.
5. **The job's own `noShowAt`** goes on the job too, for the pop-up's status
   and footer, whether or not it took a deposit.
