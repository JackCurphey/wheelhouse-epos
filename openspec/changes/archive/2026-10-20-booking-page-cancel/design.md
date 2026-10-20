# Design: Cancel booking

## Contract (exists, piece 12)

- `POST /api/portal/:slug/booking-links/:code/cancel`, no body. 200 → the booking link view, `stage: 'cancelled'`; a second press returns the same. 409 `in_shop` ("Your bike is already with the shop - please contact them to cancel") or `illegal` ("This booking can't be cancelled online"); 404, 410, 429 as the link.
- The link view's `canCancel` (boolean) says whether to offer it. `BookingLink` gains `canCancel?: boolean`.

## Screens

- Confirmed page: a default-style "Cancel booking" button after the card, only when `canCancel`; the contact line reads "Need to change the date? Contact [shop]".
- Pop-up (`Dialog`, as `details.tsx` uses): title "Cancel this booking?", sub "[day], [time] · [bike]" (time left out for a whole-day booking; "your bike" when none is named), body "There's nothing to pay or refund.", footer Keep my booking (ghost, closes) and Cancel booking (danger). While sending, Cancel booking is disabled. On 200 the cached link is replaced by the reply, so the page becomes the cancelled page. On a refusal, the server's words show in the pop-up (`role="alert"`); other failures say "Wheelhouse couldn't cancel that. Try again in a moment.".
- Cancelled page (`stage === 'cancelled'`): eyebrow and heading as drawn ("Cancelled" in a status line, h1 "Your booking is cancelled"), "[day], [services] for your [bike]. There's nothing to pay or refund.", a "Book another time" link to the shop's booking start, the shop's name. The drawing's "We've sent you a text to confirm." is left out: no texts are sent yet.
