# Design: two specs say what the code does

Spec text only. What the code does, read on 22 Oct 2026:

| Message | Who triggers it | Wait before it goes | Where |
|---|---|---|---|
| Bike ready | staff, Mark ready for collection | a minute, Undo on the server | `queueBikeReady`, `delayMs: UNDO_MS` |
| Quote to approve | staff, Send quote | a minute's Undo in the quote panel, then at once | `quote-panel.tsx`; `POST /api/quotes/:id/send` |
| Booking confirmed, New time offered, Request declined, Date change answered | staff answers | none, at once | `sendBookingMessage` |
| The old app's one-off text | staff | none, at once | `POST /api/customers/:id/texts` |

The workshop jobs save route refuses any body carrying `status` (400)
before it changes anything, so no save can move a booking out of declined, expired or
cancelled.

## Decisions

- **Narrow, don't widen.** The spec moves to the code, because Jack's
  decisions only ever drew an Undo for the quote and Bike ready. Giving the
  booking answers an Undo would be new behaviour for Jack to decide.
- **Keep the requirement, rename it.** "Staff can undo a message for a minute"
  is renamed "Staff can undo Bike ready and a quote for a minute" so its
  name doesn't overpromise either.
- **The Purpose line.** OpenSpec deltas carry requirements, not a spec's
  Purpose, so at archive the Purpose line is edited by hand to: "The texts
  and emails a shop's customers get: Wheelhouse's wording or the shop's own,
  queued the customer's way (Bike ready and a quote with a minute to Undo),
  and an outbox staff see on each job. Pretend for now: nothing reaches a
  real phone or inbox until Jack switches real sending on (Jack, 20 Oct)."
