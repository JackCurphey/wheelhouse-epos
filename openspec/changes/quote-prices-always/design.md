# Design

No code change. `GET /api/portal/:shopSlug/booking-links/:code/quote` sends
each line's `unitAmount` and `lineTotal`, and the quote's totals, without
reading `show_prices_online`. The new test in
`tests/workshop-quote-stage.test.js` turns the switch off, sends a quote and
reads it as the customer; it was watched failing with the route temporarily
hiding prices when the switch is off.
