# The quote stage

**Decided by Jack, 3 Oct 2026** ("1": every step, plus the database changes,
nothing that only pretends to work). Journey 4, "Drop off and approve the
quote" (`docs/decisions/2026-10-01-drop-off-and-quote-review.md`), drawn by
`quoteJobBoards` in `docs/design/user-journeys/generator/diary.mjs` and by
`quote.mjs`. Also Workshop day decisions 41–46 and UX walk-through H1, H2
and M3.

## The story

1. In the job page's Work and parts table, staff add the extra work and
   parts the bike needs. Each line is Needed or Optional, with a reason for
   the customer. The footer shows the **Proposed total**: the booked work
   plus the new lines.
2. **Send quote.** A bar reads "Sending the quote to Maya by text in 1
   minute", with Undo. When the minute is up, the customer gets a text with
   a link to their booking page. The job shows "Waiting for the customer"
   (teal) in the diary and on the job page.
3. The customer opens the link with no sign-in, ticks yes or no for each
   line, and approves.
4. Or staff press **Record their answer** after a phone call or a chat in
   the shop. It saves who took the answer, when, and how. Or staff press
   **Withdraw quote**.
5. Once answered, the approved lines join the job's work and parts, and
   declined lines are struck through. The footer shows the **Approved
   total**, and the main button is **Start work**.

## Database (migration 038, additive)

- `workshop_quote_lines` gains:
  - `need` (`needed` or `optional`; default `needed`);
  - `reason` (text for the customer);
  - `decided_via` (`online`, `phone` or `in_shop`);
  - `decided_by_login_id` (the member of staff, for phone or in shop);
  - `decided_at`;
  - `added_to_order_at` (when an approved line joined the job's work and parts; a link to the order line itself would break, because saving work and parts rewrites every line).
- `workshop_quotes` gains `sent_at`, and the state `withdrawn`. The quote
  state machine gains `withdraw`, which goes from `sent` to `withdrawn`
  (final). The state CHECK is re-rendered from the machine, as the drift
  test requires.

## Server

- `POST /api/workshop-jobs/:id/quotes` (exists) also takes `need` and
  `reason` per line. A draft is replaced in place.
- `GET /api/quotes/:id` lines also carry `need`, `reason`, `decidedVia`,
  `decidedAt` and `decidedByName`. The quote carries `sentAt`.
- Every job read carries `quote: { id, state, revision }`, the latest
  revision, or null.
- **Send:** `POST /api/quotes/:id/send`. The quote goes from draft to sent,
  `sent_at` is set, and the customer's booking link is issued afresh. The
  server keeps only a scrambled copy of the old link, so it can't be sent
  again; the old link stops working and the text carries the new one. The
  text goes to the customer's phone and is recorded in `customer_messages`.
  The answer says whether the text went: sent, failed (with the reason), or
  not sent (no phone number, or texts aren't set up). It also returns the
  link, so staff can copy it. The one-minute Undo lives in the staff app,
  which only calls send once the minute is up.
- **Withdraw:** `POST /api/quotes/:id/withdraw`.
- **Record their answer (staff):** `POST /api/quotes/:id/answer` with
  `{ via: 'phone' | 'in_shop', decisions: [{ lineId, decision }] }`. Every
  line must be decided. It records the member of staff and the time, then
  approves (all, some or none).
- **The customer, by booking link:**
  - `GET /api/portal/:shopSlug/booking-links/:code/quote` returns the job's
    current quote, if it is readable (sent or answered);
  - `POST …/:code/quote/answer` with `{ revision, decisions }` saves every
    line's yes or no and approves, in one call (the link's rate limit counts
    calls, not taps). Recorded as `online`.
- **Approved lines join the job's work and parts.** When a quote is
  answered, each approved line is added to the job's order. A part with a
  product goes on as that product; labour, or a part without one, goes on as
  a labour line with its description. Each line records
  when (`added_to_order_at`), so it is never added twice. If the order is
  closed, the answer is refused.

## Pieces

1. **This piece: the server.** Migration, routes, sending, and approved
   lines added to the order.
2. Staff build and send on the job page; Record their answer; Withdraw.
3. The customer's quote on their booking-link page.
4. The diary's teal "Waiting for the customer" state.

## Limits, said plainly

- **Texts only.** There is no email sending in Wheelhouse yet, so a customer
  with no phone number can't be sent a quote. Staff can copy the link, or
  record the answer.
- **Texts need Twilio settings.** Without them, nothing is sent and the
  staff app says so.
- **Left for later**, each needing more database work: a photo per line,
  "Goes with", automatic reminders, the spending limit ("OK up to £200"),
  and the message wording in Settings.

## Tests first

- `tests/migration-038.test.js`.
- `tests/workshop-quote-stage.test.js`: need and reason, send (the link is
  issued afresh and the old one stops working; a fake text provider; the
  not-sent cases), withdraw, staff answer (who and when; every line
  decided), the customer answer by link (revision, decisions, readable
  states), approved lines added to the order, and the job's quote summary.
- The existing quote tests keep passing.
