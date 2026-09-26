# Book server piece 8: what a full service includes

**Date:** 2026-09-26. **Follows:** piece 7 (#76). **Changes:** piece 7's
spec (`2026-09-26-book-server-7-multiple-services-design.md`, "Order of work"
said piece 8 is "shop-set in staff settings"): no staff screen edits services
yet, so piece 8 is server only (decision 1).

## Why

Jack, 26 Sep: a full service (e.g. "General service") covers work the shop
also sells on its own (e.g. "Brake service"). When a customer ticks both,
the booking screen (d2) should tell them the individual one is already part
of the full service, and the full service's card should say what it covers.

## Decisions (Jack, 26 Sep)

1. **Server only.** Storage, the staff interface's rules and the customer
   service list. The staff screens "Service catalogue & questions" (65) and
   "Configure a service" (66) are a later piece of their own; nothing in
   `public/` or `src/` calls `/api/workshop-services` today (checked
   26 Sep). Until then the list is set through the staff interface only
   (tests, seed data). Chosen over building screens 65-66 now (delays d2 by
   about two pieces) and a stand-alone "includes" page (thrown away later).
2. **Warn and offer to remove; both can still be booked.** d2 shows "Already
   part of your General service" under a ticked individual service that a
   ticked full service includes, with a "Remove <name>" link. A booking of
   both still goes through. Chosen over warn only (easy double charge) and
   locking included services (ticking one silently changes another; no way
   for a shop to allow both). **The booking route gains no new rule.**
3. **The full service's card lists what it includes**, e.g. "Includes brake
   service, gear service", shortened past a few items ("… and 6 more") -
   d2's job. Chosen over the warning alone.
4. **The line names any included service still in use**, whether or not it
   is bookable online on its own; services the shop has removed
   (`active = 0`) never appear. Chosen over bookable-online only (a full
   service would look like it covers less than it does).
5. **Storage is a table of its own** (below), not a list of ids on the
   service row: the database checks each link points at a real service of
   the same shop.

## Rules

- Only a `kind = 'full'` service includes anything. Each included service
  must be one of the shop's services with `kind = 'individual'` (active or
  not). No service twice; at most **50** per full service. An empty list is
  allowed.
- The order given is kept (`position`); the customer list follows it.
- A service marked no longer in use (`DELETE`, i.e. `active = 0`) keeps its
  links; it is hidden from customers and reappears if the shop reactivates
  it.
- Changing a full service to individual deletes its list.
- Changing an individual service to full is refused while any full service
  includes it: "<name> is part of <full service name> - take it out of that
  first" (first such full service by name).
- An individual service sent with a non-empty `includes` is refused: "Only a
  full service can include other services".
- Booking is unchanged: a full service plus something it includes books as
  two services, each at its own price (decision 2).

## Storage (migration 031)

- New table `workshop_service_includes`: `id SERIAL`, `shop_id` (default,
  foreign key and row-level security exactly as
  `030_job_services.sql`: ENABLE + FORCE + a shop-isolation policy with
  `USING` and `WITH CHECK`), `service_id` (FK `workshop_services`, the full
  service, `ON DELETE CASCADE`), `included_service_id` (FK
  `workshop_services`, `ON DELETE CASCADE`), `position INTEGER NOT NULL`,
  `UNIQUE (service_id, included_service_id)`, `CHECK (service_id <>
  included_service_id)`, index on `(shop_id, service_id)`.
- No backfill: every shop starts with empty lists. Nothing is dropped, so
  old code runs unchanged against the migrated schema.
- The foreign keys alone bypass row-level security, so the server looks each
  included id up through the shop-scoped database first (as
  `readServicePlacement` does for a category).

## Staff interface (`/api/workshop-services`)

- `POST` and `PUT /:id` accept `includes`: an array of whole-number service
  ids, in order. On `POST` omitted means `[]`; on `PUT` omitted keeps the
  saved list (as `questions` and placement do, so a caller that predates the
  field can't wipe it). Not an array, a non-whole number, a duplicate, more
  than 50, an unknown id or another shop's id, or a full service's id -> 400
  with a plain message ("That service does not exist", "<name> is not an
  individual service", "A service can't be included twice", "A full service
  can include at most 50 services").
- The list is replaced whole in the same transaction as the service's own
  update.
- Every serialized service (`GET` list, `POST` 201, `PUT` 200) carries
  `includes: number[]`: all linked ids in order, removed ones included (the
  future screen shows them as removed). Individual services: `[]`.

## Customer service list (`GET /api/portal/:shopSlug/services`)

- Each entry in `full` gains `includes: [{ id, name }]`: its linked services
  with `active = 1`, bookable online or not, in the shop's order.
- Nothing else changes; individual services carry no `includes`. d2 finds
  the warning by checking whether a ticked individual service's id is in a
  ticked full service's `includes`.
- `src/screens/book/services-query.ts` gains `includes` on its full-service
  type (d2 uses it; no screen change in this piece).

## Tests (written first, each watched failing)

- `tests/migration-031.test.js`: table exists; a shop sees only its own rows
  (row-level security); the unique and self-link checks hold.
- `tests/service-includes-api.test.js` (signed-in staff over HTTP): create
  and edit a full service with `includes`, order kept; `PUT` without
  `includes` keeps the list; each refusal above with its message; another
  shop's id refused; full -> individual clears the list; individual -> full
  refused while included, allowed once taken out; a removed service stays in
  staff `includes`.
- `tests/portal-service-list.test.js` (added cases): `full[].includes` lists
  names in order; a removed service is hidden; a not-bookable-online one is
  shown; individual services have no `includes`.
- A booking of a full service plus a service it includes returns 201 with
  both in `services` (`tests/portal-booking-multi.test.js`).

## Not in this piece

- Staff screens 65 and 66 (a later piece).
- Any d2 screen work (the warning, the "Includes" line, "Remove" link).
- A price or time discount when both are booked.
