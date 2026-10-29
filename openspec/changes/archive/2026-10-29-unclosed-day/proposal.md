# Proposal: A day nobody closed

## Why

When a day isn't closed (nobody did it, or the internet was down at
closing), its cash stays in the drawer overnight. Until now the next
morning's float check expected only the float, so yesterday's cash showed
as over that night and yesterday got no report of its own (Jack's 27 Oct
answer 9, "Trust the morning check"). UX walk-through 2 H1(b)
(`docs/design/user-journeys/ux-walkthrough-2-shop-day.md`, option 1, which
Jack took) drew the fix: the morning check expects the float plus
yesterday's cash, that count becomes yesterday's count, and "Close it" on
Today closes yesterday at banking.

On 29 Oct Jack chose **Build the drawings** (`docs/decisions/2026-10-29-answers.md`,
answer 5). It replaces 27 Oct answer 9 for a day nobody closed only; on a
normal day answer 9 stands.

Slice B, WP-3.3 (the float check) and WP-3.4 (close the day), in
`docs/superpowers/plans/2026-10-03-release-2-build-plan.md`. Taken by Jack.

**Risky areas:** a migration (106), and money (the drawer's expected cash,
the banking and the day's takings; which close counts each sale).
`/review` runs before each pull request merges.

## What Changes

- **The morning after a day nobody closed**, the first person in sees "The
  drawer should have [£] plus Wednesday's cash [£]" with Count it only; the
  count is kept as that day's count (`op-float-check-unclosed`).
- **Today** lists "Wednesday 16 September wasn't closed" with Close it, for
  the Owner (`op-today-unclosed`, `op-today-two`).
- **Close it** opens that day's Close the day at banking: the count is
  done ("Counted this morning by Jo Taylor"), "Cash taken out on
  Wednesday", "Bank Wednesday's cash", "Leave in the drawer: The float and
  today's sales" (`op-close-yesterday`). Closing it saves that day's own
  report: its sales up to the morning count, its float, its difference and
  what was banked.
- **Tonight's close** starts from the morning count less the cash banked
  for yesterday, so nothing is counted twice; it waits until yesterday is
  closed.
- **Server (pull request 1, `jack/unclosed-day`):** migration 106, the
  float check, Close the day for an earlier day, Today's line.
- **Screens (pull request 2, `jack/unclosed-day-screens`, stacked):** the
  float check's unclosed pop-up, Today's line, and the earlier day's Close
  the day page.

## Drawings and decisions

- Drawings (`docs/design/user-journeys/generator/opening.mjs`):
  `op-float-check-unclosed` (`:225`, the pop-up `:45-51`),
  `op-today-unclosed` (`:236`, the line `:117`), `op-close-yesterday`
  (`:237`, drawn by `cashup.mjs` `closeUncounted` `:231` and
  `stepBanking(…, uncounted)` `:105-116`), `op-today-two` (`:238`); where
  each button goes, `mockup/links/j10.mjs` `:24-46`.
- Decisions: Jack's 29 Oct answer 5; 27 Oct answers 5 (a drawer below the
  float), 6 (a day runs from the previous close), 8 (a float nobody checked
  is only looked at, at closing) and 9 (on a normal day, trust the morning
  check); opening the shop 7 (the till still opens with the float check
  when yesterday wasn't closed) and 8 H1 and H3; UX walk-through 2 H1(b)
  and decision 6 (Count it only for a day nobody counted).

## Out of scope

- `op-today-banked` and `eod-waiting`, `eod-waiting-banked`: a day counted
  and banked while sales wait to send needs the till's send queue (Mark's
  step C).
- A shop that has never closed a day: its earlier days are before Close the
  day began counting (close-the-day design 6), so they aren't "a day nobody
  closed" (logged for Jack).
- Steps 1, 2 and 5 of Close the day, as before (close-the-day proposal).
- Closing after midnight (logged 27 Oct, not handled).
