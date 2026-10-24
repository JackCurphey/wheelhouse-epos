# Design: the deposit on the booking page

## Decisions

1. **`deposit`** on the booking link's answer: `{ pence, cancelUntil: { date,
   time } }`, the cut-off turned into the shop's time zone by the database,
   or null when the booking took none.
2. **The rows** follow the drawing's order: after When, before Your repair.
   The cut-off reads as the page's other dates do ("Sunday 4 October, 11:30").
3. **Only while the booking stands** (request, confirmed, a change or an
   offer waiting), as the drawing's answer pages; a cancelled or declined
   booking's deposit words are part 3's.
