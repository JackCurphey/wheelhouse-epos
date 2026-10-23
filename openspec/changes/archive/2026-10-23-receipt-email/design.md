# Design: emailing a receipt

## Decisions

1. **Its own engine call, `sendEmailTo`**, not `queueMessage`: a receipt goes
   to the address typed, not the customer's chosen way (`channelFor`), and
   can go with no customer. It writes the message (`template_key 'receipt'`,
   channel email, `sale_id`, the customer when the sale has one) due at once,
   so the timer sends it through the pretend sender like any other.
2. **Migration 066** makes `customer_messages.customer_id` nullable and adds
   `sale_id` (`ON DELETE SET NULL`). A conversation reads messages by customer
   or job, so a receipt to an address shows in neither.
3. **The words are built on the server** (`receipt-email.js`) from the sale as
   `GET /api/sales/:id` reads it (pounds, as the till today), laid out as the
   drawing's email and the printed receipt: each line, "qty × price" when more
   than one, discounts, Total, then each payment. Plain text, as every message.
4. **Subject "Your receipt — [Shop name]"**, not drawn. *Pattern:* "Your bike
   is ready — [Shop name]".
5. **The footer without an account**: "Questions? Call [shop phone]." and
   "Keep this for returns. Show this email or give the sale number." — "sale
   number" for the drawing's "receipt number" until receipts have their own.
6. **A new routes file**, so #404's `routes/sales.js` and `lib/sales.js` stay
   untouched; it reads the sale tables directly.

## Risks / Trade-offs

- [No screen sends it until the till's button] → Jack chose the email side
  first (answer 3); the till's button is the next piece after #404.
- [#404 moves sales to pence later] → The builder reads the sale in one place,
  so only it changes then.
