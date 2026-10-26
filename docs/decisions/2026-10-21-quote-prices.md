# A quote's prices with Show prices off

"Show prices on the booking page" (Settings › Workshop › Online booking) hides
prices in online booking and the figures on the customer's booking page
(`2026-10-21-booking-page-stages.md`, answer 4). Nothing said whether it hides
a quote's prices too.

## Answer

1. **A quote always shows its prices.** Jack, 21 Oct: "Yes: quotes always
   show their prices, even with Show prices off, because the customer is
   approving an amount."

   The quote the customer answers on their booking link shows each line's
   price and the total whatever the switch says. The switch still hides
   prices in booking and on the booking page's summary of the work. The app
   already worked this way; a test in `tests/workshop-quote-stage.test.js`
   keeps it so.
