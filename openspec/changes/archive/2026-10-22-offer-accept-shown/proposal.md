# Proposal: an offer is accepted only at the time the customer was shown

## Why
Mark's 22 Oct audit (P2 2, draft #385): the customer's Accept carried no
time, so if the shop offered again, or an edit moved the offered booking,
pressing Accept on a page still showing the old time confirmed the new one
unseen, breaking "Accepting the offer" (confirmed for the time suggested to
them). Jack, 22 Oct: "refuse an Accept for a time the customer wasn't shown;
show them the new time to accept instead. And an offered booking can't be
dragged in the diary; staff offer again instead." The diary already doesn't
drag an offered booking (20 Oct, request-offered); an edit (Change details)
still could move one.

## What changes
- `POST …/booking-links/:code/accept-offer` takes `{ jobDate, startTime }`,
  the time the page shows; a different time on the job now is refused (409
  `stale`, "The shop has changed the time it’s offering. Here’s the new one.");
  none given (a page loaded before this change) gets the same answer, so it
  reloads and shows the time on offer. The page sends it, and on the refusal shows the server's
  words and reloads with the new time.
- `PUT /api/workshop-jobs/:id` refuses moving an offered booking's day, times
  or mechanic (409 `illegal`, "This time is on offer to the customer. To change
  it, use Offer another time."); notes and other details still save.

## Risky areas
A public route (`/api/portal/*`). Reviewed.
