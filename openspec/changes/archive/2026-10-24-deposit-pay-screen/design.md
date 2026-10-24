# Design: paying the deposit on the booking page

## Decisions

1. **The hold is asked for when step 4 opens** (`useDepositHold`): the
   booking's request key is made then (it was made on Send), saved to the
   draft, and sent with the services to `deposit-holds`. Its answer gives the
   amount, the payment, the provider's ref and the shop's hours before. A
   change of services makes a new key (and so a new hold), as the server lets
   the old one go. No deposit: `{ depositPence: null }`, and step 4 is as
   before.
2. **"Free to cancel until"** is the booked start (the day's start for a
   whole-day booking) less the shop's hours, shown as the booking page shows
   dates and times ("Thu 17 Sep, 11:30").
3. **The pretend card form**: one "Card number" box, inputmode numeric,
   autocomplete off, with the note "Pretend payments while Wheelhouse is being
   built: nothing is taken. 4242 4242 4242 4242 pays; 4000 0000 0000 0002 is
   declined." Its number never leaves the pretend route and is never saved.
4. **Pay, then send**: on press, with fields checked as now, the card goes to
   the pretend route; accepted, the draft notes the payment held
   (`depositHeld`), then the booking is sent with `paymentId`. Declined (402):
   the drawn alert and "Try again". A booking sent after the card was
   accepted that fails for the connection (no answer, or 5xx) is the drawn
   checking state, whose "Check again" resends the booking only. A
   `deposit_changed` refusal asks for the hold again and says "The deposit
   has changed — please pay it again."; `deposit_not_held` clears
   `depositHeld` and asks for the card again.
5. **After a refresh**: the draft keeps the request key and `depositHeld`, so
   a held deposit isn't paid twice; the card box is then not shown, and the
   button sends.
