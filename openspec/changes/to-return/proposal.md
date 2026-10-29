# Proposal: To return to [Supplier], with Returned

## Why

Since 26 Oct, items marked Damaged or Wrong item at booking in are kept off
stock and recorded (`delivery_problems`, migrations 092 and 094), "for To
return to [Supplier] later". Nothing shows them yet, so the shop has no list
of what to send back. Receiving decision 9 (Jack, 30 Sep) says they "go on
'To return to [Supplier]' in Deliveries and orders (for people who can order
stock), each with a 'Returned' button". The hub drawing has the list, second
on the page, only when something is on it.

Work package: **WP-2.3** (deliveries and purchase orders), slice C, taken by
Jack. It needs nothing of Mark's: who can order stock is the Owner until
roles, as orders already are. Slice B's remaining pieces in Jack's lane wait
on Mark or on Jack (see `decided-while-building.md`, 29 Oct, To return
entry 1).

**Risky area:** a migration (105, when an item was returned and by whom). No
money, stock count, sign-in or public route: returned items were never in
stock, and marking one returned changes no stock.

## What Changes

- **To return to [Supplier]** on Stockroom › Deliveries and orders
  (`rs-hub`), after "A delivery arrived?", one section per supplier, only
  when something is on it: each damaged or wrong item, "Damaged · [n] · from
  the delivery on [date]", with **Returned**.
- **Returned** marks it sent back, who and when, and it leaves the list.
- For the Owner only, as orders are (receiving decision 4, until "Can order
  stock"); Staff see the hub as now, with its drawn note.
- Migration 105: `delivery_problems.returned_at` and `returned_by_login_id`.
- Server: `GET /api/deliveries/to-return`, `POST /api/deliveries/to-return/:id/returned`.

## Drawings and decisions

- Drawings: `rs-hub` (`docs/design/user-journeys/generator/receiving.mjs`
  :62-69, `hubBoard`, the To return section; `journeys.mjs` lists it);
  `rs-hub-staff` (no To return); `rs-problem`'s words (:253-254, "They go on
  'To return to [Supplier]' in Deliveries and orders until they're sent
  back").
- Decisions: receiving decisions 4 and 9, and 10 (the UI audit: "the hub
  reordered (To return second, only when something's on it)")
  (`docs/decisions/2026-09-30-receiving-stock-review.md`).

## Out of scope

- "Products to add", "Recent deliveries" and the restock list on the hub.
- "On To return" on a booked-in delivery (`rs-delivery`) and "See the list"
  on the booked-in board (`rs-booked`): neither page is built.
- A returns process with return numbers and credit notes (decision 9 chose
  against it).
