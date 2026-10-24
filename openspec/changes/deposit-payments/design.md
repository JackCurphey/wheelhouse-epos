# Design: paying a booking's deposit, the server

## Decisions

1. **The adapter** (`server/payments/index.js`) is what the rest of the server
   calls: `hold({ amountPence, key })` (the same key answers the same hold),
   `status(ref)`, `take(ref)`, `release(ref)`, `refund(ref, amountPence)`.
   It picks the provider from `PAYMENTS_PROVIDER` (part 1's
   `provider.js`); with none connected it refuses. This is Stripe's shape: a
   card payment held ("manual capture"), then captured, cancelled or refunded,
   so Stripe slots in later behind the same five calls.
2. **The pretend provider** (`server/payments/pretend.js`) keeps its own
   records in `pretend_payments` (what Stripe would keep on its side): a ref,
   the amount, a status (`waiting`, `held`, `declined`, `taken`, `released`,
   `refunded`), the card's last four. Its stand-in for the provider's card form
   is `POST /api/portal/:shopSlug/pretend-payments/:ref/card`, only while the
   pretend provider is connected: `4242 4242 4242 4242` is accepted (held),
   `4000 0000 0000 0002` is declined, as Stripe's test cards; anything else is
   "Check the card number". No real card is ever sent anywhere.
3. **Wheelhouse's own record** is `online_payments` (migration 070, row-level
   security): the provider and its ref, the amount, what it's for (`deposit`),
   its status as Wheelhouse last saw it, the booking request's key hash, and
   the job once booked. One payment per booking request (unique key hash).
4. **`POST /api/portal/:shopSlug/deposit-holds`** takes the booking's
   services (`serviceIds`, or `notSure`) and its `requestKey`. It answers
   `{ depositPence: null }` when no deposit is taken, else holds the amount
   (part 1's `depositPence` on the stored prices) and answers `{ paymentId,
   depositPence, provider, ref }`. The same request key answers the same
   payment while the amount is the same; a changed amount (other services, or
   the shop's setting changed) lets the old hold go and makes a new one.
   Rate-limited as guest bookings are.
5. **The booking request** (`POST …/bookings`) works the deposit out again
   inside its booking lock. With a deposit due it needs `paymentId`: that
   payment must be this request key's, the same amount, and held at the
   provider (`status`), or it is refused (`code: 'deposit_needed'`,
   `'deposit_changed'`, `'deposit_not_held'`). The job is saved with
   `deposit_pence` and `deposit_cancel_until` (the booked start, or the day's
   start for a whole-day booking, less the shop's hours), the payment gets the
   job. After the commit the money is taken (`take`); if the provider can't take
   it then, the payment stays held, the failure is logged, and the booking
   stands (taking it again later is part 3's). A refusal after the hold lets
   it go (`release`). A replay (same key) answers the booking made, taking
   nothing again.
6. **Money in pence** throughout, as part 1. The deposit isn't a sale yet:
   it comes off the bill at the till after #404 (answer 4).
