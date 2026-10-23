# Proposal: the quote's answer bar pinned on a tablet or phone

## Why

On a tablet or phone the customer's quote is longer than the screen, so the
new total and the Approve button scroll out of sight while the customer ticks
and unticks lines. Jack decided (1 Oct) that on those screens the new total,
"Your answers are final once sent." and the button sit in a bar pinned along
the bottom, as "Your booking" does on the booking page. Today they sit inline
in the quote at every size. It is one of the three quote pieces left in
Jack's order (STATUS, 23 Oct).

## What Changes

- On a tablet or phone, while a quote waits for an answer, a bar pinned to
  the bottom of the customer's booking page holds the new total, "Your
  answers are final once sent." and the one button ("Approve £[total]", or
  "Decline the extra work" when nothing new is ticked). The total in the bar
  changes as lines are ticked and unticked, and is announced politely.
- In that case the quote itself no longer shows the final-answer line or the
  button; it keeps its "New total" line, as drawn.
- On a computer nothing changes: the line and the button stay in the quote.
- The page leaves room at the bottom so the bar never covers the end of the
  page, and a field reached with Tab never lands behind it.
- Sending is still one click, with no "Send your answers?" pop-up (decision 7,
  re-checked for phone in decision 8).

Work package WP-4.2 (quotes), taken by Jack. Touches no risky area: screens
only, no server, route, migration, money or stock change.

Follows:
- Drawings: `dq-quote`, `dq-quote-untick`, `dq-quote-decline`,
  `dq-quote-reminded`, `dq-quote-newer`
  (`docs/design/user-journeys/generator/quote.mjs`, `quoteBar` and
  `quotePage`).
- Decisions: `docs/decisions/2026-10-01-drop-off-and-quote-review.md`,
  decisions 7 and 8.

Out of scope:
- The drawn "· deposit £[deposit] paid" in the bar (`dq-quote-deposit`):
  deposits aren't built yet, so the bar has no deposit to show; it comes with
  deposits.
- The Lightspeed shop's "A price has gone up" bar (`dq-quote-price-ls`),
  which comes with the Lightspeed version (WP-L).
- The staff side of quotes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `book`: the customer's quote on the booking page gains a pinned answer bar
  on a tablet or phone.

## Impact

- `src/screens/book/quote-card.tsx` (the quote card and its new bar).
- `tests/customer/` screen tests and one browser test at phone width.
- No server, API, data or dependency change.
