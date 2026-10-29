# Proposal: The look at closing on a normal day

## Why

When nobody checks the float in the morning, the Owner looks at it when
closing (27 Oct answer 8). That look has been starting the drawer's figure,
so every cash sale made before it was left out, and the day showed its
cash as over. Jack's 29 Oct answer 7, "Start from last close"
(`docs/decisions/2026-10-29-answers.md`): the day starts from the last
close, with the float left in, so all the day's cash sales are expected.

WP-3.4 (close the day), slice B. Taken by Jack.

**Risky area:** money (the drawer's expected cash). No migration. `/review`
before merging.

## What Changes

- Tonight's close, when the day's only float check is the Owner's look at
  closing: the drawer's figure is the float, plus every cash sale since the
  last close, less cash taken out since it. The same window a day nobody
  closed already uses for such a look (unclosed-day, the money review).
- The figures on the Close the day page and in the report follow; no screen
  changes.

## Drawings and decisions

- Jack's 29 Oct answer 7; 27 Oct answers 8 (a look only, at closing) and 9
  (now for a morning check); `eod-count-result` "How the till worked it
  out" (`docs/design/user-journeys/generator/cashup.mjs:89`).

## Out of scope

- The screen's "Float this morning" wording for a look made at closing
  (unchanged, as built).
