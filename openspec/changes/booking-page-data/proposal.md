# The booking link's later-stage data, and expiry from collection

## Why
The booking page's later stages (#344) were built with what the link sent. Their contract (`openspec/changes/archive/2026-10-21-booking-page-stages/design.md`) lists what the server should add. It also says the link's 30 days should count from collection, which build-plan Q8 decided on 3 Oct, rather than from the booked day. Under the working agreement (#349), Jack builds it.

## What changes
- **Migration 051:** `workshop_jobs.booked_in_at` and `collected_at`, set by the custody moves. A job made with the bike already in the shop is booked in as it's made. Bringing a bike back clears `collected_at`.
- **The booking link adds:**
  - `workState` and `bookedInAt`;
  - `collectedAt`;
  - `expectedReady` (the job's last day, while the booking stands and the bike hasn't gone; no time until staff can set one);
  - `shop { address, phone, openingHours }`.
- **When the link stops working:** 30 days after collection. A bike still in the shop keeps its link. A bike that never came in keeps its link for 30 days after its booked day. A bike collected before collection was recorded counts from its booked day.
- **The 410 reply** adds `reference`, `reason` (`collected` or `never_came_in`) and `shop { name, address, phone }`. Nothing in it identifies the customer.
- **Not in this change:** the work done with prices, the amount to pay and the paid date, which wait for Jack's answer on showing prices. The checklist doesn't exist yet, so it isn't sent.

## Impact
- **Code:** `server/migrations/051_custody_times.sql`, `server/workshop/transitions.js`, `server/booking-link.js` (`linkExpiry`), `server/routes/portal.js`.
- **Tests:** `tests/booking-link-data.test.js`, `tests/booking-link.test.js`, and older tests that compared the reply exactly.
