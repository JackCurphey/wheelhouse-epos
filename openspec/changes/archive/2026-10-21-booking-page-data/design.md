# Design
- **Custody times:** `applyEvent` adds `booked_in_at = now()` on `book_in`, `collected_at = now()` on `collect`, and `collected_at = NULL` on custody `reopen`, in the same UPDATE as the move. Every way a bike moves records it.
- **Expiry:** `linkExpiry({ jobDate, custodyState, collectedOn }, today)` is pure, with `collectedOn` as the shop's own date of collection (`collected_at AT TIME ZONE` the shop's zone). `isLinkExpired` stays the 30-day count.
- **The 410's shop:** joined through the job's `shop_id`, never "the first shop".
- **`shopLines()`:** reads the current shop's address and phone. Opening hours use the messages' `formatOpeningHours(openingHoursFor(…))`.
