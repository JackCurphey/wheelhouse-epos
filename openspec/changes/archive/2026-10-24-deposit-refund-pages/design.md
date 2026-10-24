# Design: the deposit on the customer's pages

## Decisions

1. **From the link's `deposit`** (3a): `state` picks the words, `refundable`
   picks the pop-up. A deposit already refunded or kept shows no pop-up words
   (the booking can't be cancelled then anyway).
2. **The late pop-up names the shop's number** when the shop has one, else
   "call the shop"; the button sends `losesDeposit: true`. A cancel refused
   because the cut-off passed meanwhile reads the link again, so the pop-up
   turns into the late one, with the server's words.
3. **The green note** uses the page's existing "Booking confirmed" colours.
