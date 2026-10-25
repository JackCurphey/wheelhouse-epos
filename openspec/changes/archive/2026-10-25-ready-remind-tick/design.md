# Design: the reminder tick on the in-shop ready page

## Decisions

1. **Where.** It goes in the "To pay when you collect" card, after its note,
   above a line, as drawn in the pay card (`collect.mjs:77`). It shows only
   while the bike is ready to collect; the paid card has none, as drawn.
2. **Saved at once.** The card has no button to send it with, so ticking
   posts `{ yes: true }` to
   `POST /api/portal/:shopSlug/booking-links/:code/reminders`. The booking
   link's code is the customer's key, as for cancelling.
   - A yes sets service reminders and review requests, now, from
     'collection' (077's check already allows it).
   - `{ yes: false }` turns service reminders off. That is the customer's
     own answer on this page, unlike not ticking when booking.
3. **The view** gains `remindersYes`, a yes or no and nothing that
   identifies the customer, so the page shows the drawn said-yes line.
4. **Change** (drawn as a link) shows the tick, ticked, in place. Unticking
   it says no. Logged, since the drawing doesn't say where Change goes.
