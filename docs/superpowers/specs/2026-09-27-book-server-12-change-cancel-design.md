> **History (8 Oct 2026).** Its staff side (the diary, capacity, the shop's today, workshop settings) is now described in `openspec/specs/workshop-diary/spec.md`; its customer side moves with the online-booking spec. Kept as the record of how it was designed.

# Book server piece 12: customers change or cancel through the booking link

**Date:** 2026-09-27. **Follows:** d5 (#87) and the look tweaks (#88).
**Then:** a staff diary piece (the "Waiting for you" column, jump and
highlight, Accept/Decline in the job), then d6 (the customer's change and
cancel screens). **Approved by Jack, 26-27 Sep**, including migration 035.
**Changes:** the screen-design notes for `reschedule`, `change-pending`, `cancel`,
`cancelled` are followed except that an unconfirmed booking moves at once
(decision 4).

## Why

A customer can book online but must phone the shop to change or cancel.
Staff have no list of what is waiting for them: new online bookings are
accepted only through the old diary's status field, and nothing would tell
them a customer had cancelled.

## Decisions (Jack, 26-27 Sep)

1. **Cancel is immediate** while the bike hasn't been dropped off; the
   customer confirms once; the slot is freed at once.
2. **A change to a confirmed booking is a request** staff accept or
   decline; the booking keeps its old slot meanwhile.
3. **Staff answer requests in the existing diary**, with a left-hand
   "Waiting for you" column listing new online bookings, change requests and
   customer cancellations; clicking an item jumps the diary to that week and
   highlights the job; the job opens with its notes and Accept / Decline.
   (Built in the staff diary piece; this piece supplies the server side.)
4. **An unconfirmed booking moves at once** when the new time is free, and
   stays awaiting confirmation.
5. **Customer cancellations appear in "Waiting for you"** as "Cancelled by
   customer" until a staff member clicks "Seen".
6. **A requested new time is held** until staff decide.

## Customer actions (through the booking link)

All three routes take the link code as the booking-link read route does
(hashed lookup, the same rate limiter, 404 for an unknown code, 410 for an
expired link), run inside `withBookingLock` for every date involved, and
return the updated link view (the booking-link GET's shape).

- **Cancel** (`POST /api/portal/:shopSlug/booking-links/:code/cancel`):
  - allowed when `custody_state` is `expected` and `booking_state` is
    `pending`, `scheduled` or `reschedule_requested`;
  - `booking_state` becomes `cancelled` (the state machine's `cancel`
    event); every hold of the job is released (its own and a requested
    one); the job records `cancelled_by = 'customer'` and `cancelled_at`;
  - refused once the bike is in the shop or collected: "Your bike is
    already with the shop - please contact them to cancel" (409);
  - refused in any other state: "This booking can't be cancelled online"
    (409).
- **Change** (`POST /api/portal/:shopSlug/booking-links/:code/change`, body
  `{ jobDate, mechanicId, startTime? }` as for a new booking):
  - allowed when `custody_state` is `expected` and `booking_state` is
    `pending`, `scheduled` or `reschedule_requested`; otherwise the same
    refusals as cancel with "changed" in place of "cancelled";
  - the new time passes every check a new booking's time passes (past date,
    too soon, drop-off vs timed mode, the mechanic's working time, free
    capacity, slot conflicts), with the booking's own job excluded from its
    own conflicts; refusals use the booking route's existing messages and
    statuses;
  - **pending:** the job's `job_date`, `mechanic_id`, `start_time` and
    `end_time` change at once; it stays `pending`; its hold moves with it;
  - **scheduled:** the requested day, mechanic and times are stored; a hold
    is placed on the requested slot; `booking_state` becomes
    `reschedule_requested` (the `request_reschedule` event); the old slot
    stays held;
  - **reschedule_requested:** the new request replaces the stored one; the
    previous requested hold is released and a new one placed.
- **Withdraw a change request**
  (`POST /api/portal/:shopSlug/booking-links/:code/withdraw-change`): only
  in `reschedule_requested`; clears the stored request, releases its hold,
  and returns the booking to `scheduled`. Otherwise: "There's no change
  request to withdraw" (409).
- **The link view gains:** `requested` (`{jobDate, startTime, mechanicId} |
  null`), `canChange` and `canCancel` (booleans, per the rules above), and
  `changeDeclined` (true after staff declined a change, until the customer
  next changes, withdraws or cancels).

## Staff actions

- **Accept and Decline of new online bookings:** the existing
  `POST /api/workshop-jobs/:id/accept|decline` routes, unchanged.
- **Accept a change request** (`POST /api/workshop-jobs/:id/accept-change`,
  `{ version }`): in `reschedule_requested` only. Under the booking lock for
  both dates, moves the job to the requested day, mechanic and times, turns
  the requested hold into the job's hold and releases the old one, clears the
  request, and returns to `scheduled`. If the requested slot has somehow
  become unavailable: 409 "The requested time is no longer free".
- **Decline a change request** (`POST /api/workshop-jobs/:id/decline-change`,
  `{ version }`): releases the requested hold, clears the request, sets
  `change_declined_at`, returns to `scheduled` at the original time.
- **"Seen"** (`POST /api/workshop-jobs/:id/cancellation-seen`, `{ version }`):
  sets `cancellation_seen_at` on a customer-cancelled job.
- **Waiting list** (`GET /api/workshop-waiting`): `{ count, items }`, oldest
  first by when each arrived, items:
  - `kind: 'new_booking'`: online bookings in `pending`;
  - `kind: 'change_request'`: jobs in `reschedule_requested`, with `from`
    and `to` (day, time, mechanic);
  - `kind: 'customer_cancelled'`: jobs with `cancelled_by = 'customer'` and
    no `cancellation_seen_at`;
  each with the job id, reference, day and time, mechanic id and name,
  customer name, service names, and `arrivedAt`.
- **The staff job view** (`serializeWorkshopJob`) gains `requested`,
  `cancelledBy`, `cancelledAt`, `cancellationSeenAt` and `changeDeclinedAt`.
- All staff routes use the existing optimistic `version` check.
- Staff cancellations (`POST /api/workshop-jobs/:id/cancel`) record
  `cancelled_by = 'staff'` and never appear in the waiting list.

## Data (migration `035_booking_change_cancel.sql`, additive only)

- `workshop_jobs` gains: `requested_job_date`, `requested_mechanic_id`,
  `requested_start_time`, `requested_end_time`, `requested_at`,
  `cancelled_by` (`'customer' | 'staff'`), `cancelled_at`,
  `cancellation_seen_at`, `change_declined_at`.
- A requested slot is held in `workshop_capacity_holds`, marked as the
  request's hold (a new column or kind value, whichever fits the table's
  existing live-slot unique index so that the index also protects requested
  slots from double-booking).
- The state machine gains the event `change_time` on `pending` (to
  `pending`).
- Capacity counts a requested hold like any other live hold.

## Tests (written first, each watched failing with a targeted mutation)

- Cancel in each allowed state (holds released, `cancelled_by`), refused
  after drop-off and in other states.
- Change: pending moves at once; scheduled creates a request holding both
  slots; a second request replaces the first; every new-booking time check
  applies; the booking's own slot doesn't conflict with itself.
- Withdraw; refused with no request.
- A requested hold blocks other customers from that slot.
- Staff accept-change (moves, one hold left) and decline-change (original
  time, `changeDeclined` on the link); version conflicts refused.
- The waiting list's items, fields and order; "Seen" removes a
  cancellation; staff cancellations never listed.
- Two actions at once on the same slot: only one succeeds (the lock).
- The link view's new fields; unknown and expired codes refused on every
  new route.

## Not in this piece

- The staff diary screens (next piece) and the customer's screens (d6).
- Messages to customers (email/SMS) about accept/decline.
- Refunds, deposits, cancellation fees.
