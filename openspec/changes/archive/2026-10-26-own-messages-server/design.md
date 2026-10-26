# Design: a shop's own messages, the server

## 1. Storage (migration 085, additive)

- **`shop_messages`:**
  - `name`;
  - `send_when` (`after_collected`, `before_booked`, `after_sale`);
  - `amount` and `unit` (`days` 1–365, `months` 1–24);
  - `by_text` and `by_email`, at least one;
  - `wording`;
  - `enabled`;
  - `active_from`, set on adding and whenever the timing changes or it's
    switched back on;
  - row-level security per shop, as `message_templates`.
- **`shop_message_stops`** `(shop_message_id, customer_id)`: who stopped
  which message. Removing a message removes them.
- **`customer_messages`** gains:
  - `shop_message_id` (set to nothing if the message is removed, so the
    outbox keeps what went);
  - `event_key` (`job:<id>`, or `sale:<old|till>:<id>`).

  A unique index on the two means one message per job or sale, even with two
  servers running.
- **`reminder_stop_codes`** gains `shop_message_id`, and its kind check
  allows `own_message`.

## 2. When they go: a check each minute, while the shop is open

Each message is found from what has happened, so nothing is set up at the
moment of collection, booking or sale, and no other route changes.

- **`queueOwnMessages(shopId, now)`** runs in the sender's round, at most
  once a minute per shop.
- **It does nothing while the shop is closed** (today's opening hours in the
  shop's time zone). Anything that came due overnight goes when the shop
  opens, as the service reminder does.
- **For each message that's on,** the jobs or sales whose moment has come:
  - **after a job is collected:** `collected_at` plus the time;
  - **before a booked job:** the job's day minus the time is today or
    earlier, the day hasn't passed, the booking is live, and the bike isn't
    collected;
  - **after a sale:** `made_at` plus the time, a customer on the sale (from
    `all_sales`).
- **Never for anything before `active_from`.** Without this, a new
  "6 months after collection" message would message every customer from the
  last six months at once.
- **Each candidate is checked:**
  - the customer is active and not merged away;
  - they said yes to offers and news (`marketing_permission`);
  - they haven't stopped this message;
  - it hasn't already gone for this job or sale.
- **Queued due now** with `template_key` `own_message`.

## 3. Which way it goes

- **The customer's chosen way, if the message goes that way:** text covers
  text and WhatsApp.
- **Otherwise the message's other way, if the customer has it.**
- **Otherwise nothing.**
- **The subject** for email is the message's name.

## 4. Its words

- **Tap-ins:** the drawn ones (customer's first name, bike, job number,
  amount to pay, link to the job, shop name, opening hours), filled from the
  job as Bike ready's are (`jobMessageVars`).
- **For a sale:** first name, shop name and opening hours only. The rest are
  left out, as `render` does.
- **Links** read "[link]" while sending is pretend. Once real, the job link
  is issued with `APP_PUBLIC_URL`, as the portal's messages are.
- **The ending:** "Stop these: [link]", whose code is `own_message` for this
  message.

## 5. Just before sending

The engine checks each one again: the message is still there and on, the
customer still says yes, and they haven't stopped it. Otherwise it's undone.

## 6. Routes (Owner only, `ownerOnly`)

- `GET /api/own-messages`;
- `POST /api/own-messages`;
- `PUT /api/own-messages/:id`;
- `DELETE /api/own-messages/:id`, which undoes its waiting messages.

**Refusals in plain words:**
- "Give the message a name."
- "Write what the message says."
- "Type how long as a whole number from 1 to 365 days."
- "Type how long as a whole number from 1 to 24 months."
- "Choose text, email or both."

## 7. The stop page

- **`stopView` and `setStopped`** handle `own_message` by adding or removing
  the customer's row in `shop_message_stops`, and give the message's name.
- **The stop page** has words for it: "Stop “[name]”?". These go with the
  screens piece; until real sending, no code is made, as links read "[link]".

## 8. Not drawn, decided here (logged)

- The ways a message goes (3).
- `active_from` (2).
- Sending while open (2).
- The 1–365 and 1–24 limits.
