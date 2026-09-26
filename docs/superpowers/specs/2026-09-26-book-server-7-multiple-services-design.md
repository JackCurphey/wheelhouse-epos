# Book server piece 7: several services in one booking

**Date:** 2026-09-26. **Follows:** d1 (#75). **Changes:** pieces 3
(`2026-09-25-book-server-3-booking-request-design.md`, "exactly one of
`serviceId` or `notSure`"), 3b (`...-3b-booked-price-design.md`, one
`service_id` / `booked_price` per job), 4
(`2026-09-25-book-server-4-guest-link-design.md`, the link returns
`serviceName`), 5 (`...-5-service-questions-design.md`, one flat answer list),
book-a (`2026-09-25-book-a-booked-price-design.md`, one `bookedPrice`) and d1
(`2026-09-26-book-d1-groundwork-design.md`, the draft's single `serviceId`).

## Why

Jack, 26 Sep: a customer should be able to book several jobs at once (e.g. a
brake bleed and a wheel true). Every booking so far holds exactly one service.

## Order of work (Jack, 26 Sep)

1. **Piece 7** (this spec): several services per booking.
2. **Piece 8**: a full service lists the individual services it includes
   (shop-set in staff settings), so the booking screen can tell a customer
   who picks both that one is already part of the other.
3. **d2**: the service screens, multi-select with a Continue button, and the
   "already included" message.

## Decisions (Jack, 26 Sep)

1. **Any mix of full and individual services; "Not sure" stays on its own.**
   Chosen over "a full service is always alone" and "anything including Not
   sure" (a 60-minute guess added to named jobs).
2. **After booking the customer sees each service with its price, and the
   total**, following the shop's "show prices online" setting as before.
   Chosen over total only and per-service only. The total is summed in SQL.

## Rules

- A booking is **1 to 10** of the shop's active, bookable-online services, no
  service twice, or `notSure: true` alone (60 minutes, as now).
- **Length** = the sum of the services' minutes. Over 720 minutes (12 hours)
  is refused: "That's too much work for one visit - please book the jobs
  separately". Capacity checks, end time and planned minutes use the sum.
- **Price** per service is copied in SQL at booking time (never through a
  JavaScript number), as piece 3b does for one service.
- **Questions**: every chosen service's questions are asked. An answer names
  its service: `{ serviceId, questionId, text | choice | notSure: true }`. Each
  service's answers are checked with the existing `checkAnswers`; the frozen
  copy stores each answer with its `serviceId`. Answers are refused with
  "Not sure" (unchanged). Existing bookings' flat copies (no `serviceId`)
  still read back.
- **Title**: `Online booking: <name> + <name> - <description>`, cut to 200
  characters as now.

## Storage (migration 030)

- New table `workshop_job_services`: `id`, `shop_id` (default and row-level
  security as `023_capacity_blocks.sql`, ENABLE + FORCE + shop isolation
  policy), `workshop_job_id` (FK, cascade delete), `service_id` (FK
  `workshop_services`), `booked_price NUMERIC(10,2)` (null when the service
  had no price), `position` (order chosen).
- Backfill: every `workshop_jobs` row with a `service_id` gets one row
  (position 0) with its `service_id` and `booked_price` and its `shop_id`.
- Then drop `workshop_jobs.service_id` and `workshop_jobs.booked_price`. The
  new table is the only source.
- `createWorkshopJob` takes `serviceIds` and inserts the rows in its
  transaction, each price copied with `(SELECT price FROM workshop_services
  WHERE id = ?)`.

## Request and replies

- `POST /api/portal/:shopSlug/bookings` takes `serviceIds: number[]` (replaces
  `serviceId`) or `notSure: true`. A body still sending `serviceId` is refused
  with the "choose a service" message (no customer app sends it; the old page
  is not served).
- The 201 reply and `GET /booking-links/:code` return
  `services: [{ name, price }]` in chosen order and `totalPrice`. `price` and
  `totalPrice` are `null` unless the shop shows prices online, and for any
  service with no price; `totalPrice` is `null` if any chosen service's price
  is null (a partial total would mislead). They replace `bookedPrice`, and the
  link's `serviceName`. "Not sure" gives `services: []`, `totalPrice: null`.
- The customer's bookings list is unchanged (no service or price fields).
- Staff routes are unchanged; `questionAnswers` items now carry `serviceId`.

## Out of scope

Piece 8 (what a full service includes); all screens (d2); staff screens.

## Tests (first, each watched failing, each with a break step)

- Parsing: a list of ids; empty, eleven, duplicates, non-integers refused;
  `serviceId` alone refused; `notSure` with ids refused.
- Booking: two services give summed minutes and end time, both rows with
  frozen prices in order, and the joined title; a service over the 720-minute
  sum refused before anything is saved; a foreign / not-bookable / retired id
  in the list refused.
- Answers: each service's required questions enforced; an answer for a service
  not chosen refused; the frozen copy carries `serviceId`.
- Replies: `services` and `totalPrice` on the 201 and the link; all price
  fields null with prices hidden; `totalPrice` null when a service has no
  price; "Not sure" gives `[]` and null.
- Migration 030: table, columns, FK, RLS enabled and forced; an existing
  single-service job is backfilled with its price; the old columns are gone;
  CI's second migrate applies nothing.
- Existing tests that assumed one service are updated, not deleted.

## Done when

`npm test`, typecheck, lint and `npm run test:browser` pass locally, the RLS
check passes, the break steps have been seen to fail, and a pull request is
open for Jack with CI run on its final commit.
