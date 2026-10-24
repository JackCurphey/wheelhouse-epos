# Design: the shop's deposit settings

## Decisions

1. **Six settings on `workshop_settings`** (migration 069, additive):
   `deposit_on` (0/1, off), `deposit_kind` ('percent' or 'fixed', percent),
   `deposit_percent` (whole 1–100), `deposit_fixed_pence`,
   `deposit_unknown_pence` (both whole pence, 1p–£10,000, or null), and
   `deposit_cancel_hours` (0–168, 24, as drawn). Money in pence, as sales in
   pence (#404) moves everything to.
2. **The API** is the existing `GET`/`PUT /api/workshop-settings`, with
   `depositOn`, `depositKind`, `depositPercent`, `depositFixedPence`,
   `depositUnknownPence`, `depositCancelHours`, and a read-only
   `paymentsConnected`. Switching on needs the amount its kind uses ("How
   much"); switching on with no provider connected is refused with
   `code: 'payments_not_connected'`.
3. **The provider** (`server/payments/provider.js`): `PAYMENTS_PROVIDER` is
   `pretend` or `none`; left out, it is `pretend` except when
   `NODE_ENV=production`, where it is `none`, so a real shop never takes a
   pretend deposit. Stripe is added here later.
4. **The amount** (`server/workshop/deposit.js`, `depositPence(settings,
   prices)`): pure. `prices` are each service's shown price in pence, or
   null when not known. Off, or no provider: null. Any price not known: the
   "If the price isn't known" amount, or null. Percent: the sum times the
   percentage over 100, rounded half up to the penny. Fixed: the amount.
   Either way never more than the sum (not drawn: a deposit bigger than the
   bill isn't a deposit; logged). Today's service prices are pounds
   (`workshop_services.price`); the caller turns them into pence with one
   helper, the one line #404 changes.
5. **The screen** (`OnlineBookingBox`): the drawn rows after "Confirm
   bookings automatically", under a "Deposits" heading, each saved as soon as
   changed like the rows above. The rows under the switch show only while it
   is on (not drawn off; the pattern of "Drop off before the booking", shown
   only for set times). "How much" shows % for a percentage and £ for a
   fixed amount. The note about declining shows only while automatic
   confirming is off, as the note's own words say.
6. **"For: Every booking / Chosen services"** is left out until the new app
   has a service editor (out of scope); every booking takes the deposit.
