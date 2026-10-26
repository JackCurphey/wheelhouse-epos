# Design: "Ask the shop a question", the screens

Follows `openspec/changes/ask-the-shop-server/design.md` (the routes and
their answers; section 5 is this change's list) and the drawings in
`account.mjs`.

## 1. The conversation page

- `MESSAGES_ROUTE = '/book/:shopSlug/messages'` in `src/customer/routes.ts`,
  apart from the booking steps as `ACCOUNT_ROUTE` is, and registered beside
  it in `src/customer/app-shell.tsx`. The screen is
  `src/screens/book/conversation.tsx` (`ConversationScreen`).
- It reads `GET /api/portal/:shopSlug/messages` (`{ shopName, items }`) and
  reads again every 30 seconds while open. A `401` goes to
  `/book/:shopSlug/sign-in?from=/book/:shopSlug/messages`, as the account does.
- In `BookFrame`, a little wider than the booking steps (the drawing's 720px
  column), with a back link reading "Your account" (`BookFrame` gains
  `backLabel`), and the heading "Messages with [shop]".
- The thread, oldest first, as the repair page's notes (`notes-card.tsx`):
  the customer's own on the right, "You · [day, time]"; the shop's on the
  left with its `from`. An item with `about` adds "About WH-[n] ›", a link to
  `/book/:shopSlug/booking/job-<jobId>`.
- The box: "Ask the shop a question" while the thread is empty, "Your
  message" after; a 1,000-letter text box; the line "We'll let you know when
  [shop] replies."; Send. Send posts `{ text }` to the same address, puts the
  answer's thread in place and fills the status line "Sent. We'll let you
  know when [shop] replies." An empty box sends nothing. A `400` or `429`
  refusal shows the server's own words (too long; "That’s a lot of messages
  at once. Try again in a few minutes."); a `401` says "Please sign in again
  to send this."; anything else "Wheelhouse couldn’t send that. Try again in
  a moment."

## 2. The account page

- The header's buttons: "Ask the shop a question" (a link styled as the
  default button, as drawn) before "Book a repair", opening the conversation.
- `/history`'s `{ kind: 'messages', at, shopReplied }` is one row: kind
  "Messages", title "Messages with [shop]", under it "[date] · [shop]
  replied" or "[date] · waiting for a reply", chip Replied (green) or Sent
  (grey), opening the conversation. As drawn (`history()`), it shows under
  Everything only; waiting for a reply it is under Now, answered under
  Earlier, each by its date.

## 3. The staff inbox

`src/screens/messages/messages-page.tsx`:

- List: `GET /api/customer-conversations?filter=`; rows keyed by
  `customerId`; the address holds `?customer=`. The row's second line is
  `about`'s bike and reference, or "From their account" for a general
  message (the redrawn row).
- Thread: `GET /api/customer-conversations/:customerId` (its `phone` for the
  header). Each repair note carries "About WH-[n]", opening the job in the
  diary. The header links "Customer page".
- Reply: `POST /api/customer-conversations/:customerId/messages` with
  `jobId` = the repair of the customer's newest message (none when that was
  general). The hint says which: "About WH-[n]: goes to Maya the way they
  chose, with a link to reply on the job’s page." or "Goes to Maya the way
  they chose, with a link to their messages." After sending, the same words
  as now for a repair, and "…with a link to their messages." for general.
- "See the text Maya gets": `/api/messages?jobId=` (`shop_reply`) for a
  repair reply, `/api/messages?customerId=` (`message_reply`) for a general
  one. This reads `/api/messages` rather than `/api/customers/:id/texts`
  (design 5 of the server) because only it gives each message's key.
- Then `GET /api/job-notes/conversations` and `conversations()` go, with the
  route list (237 → 236).

## 4. The inbox drawings

`inbox()` in `account.mjs`, one row per customer: Maya's row (her repair
note, about WH-1042), a second customer waiting with a general message
("From their account"), and two answered. The open conversation: her name and
phone, "Customer page", the thread with "About WH-1042" on the repair note,
and the reply box saying what it's about. Rebuilt, with the mockup's links in
`mockup/links/j07.mjs`.
