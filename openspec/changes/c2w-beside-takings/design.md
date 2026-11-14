## Context

`takingsIn` in `server/routes/close-the-day.js` works out a close's figures from both sales records: cash, card, Other, Cycle to Work (`c2w`, the "Cycle to Work · " tenders, matched without case) and online money. Since cycle-to-work pull request 10d it returned `takingsPence = card + cash + other + c2w`. Closing the day, closing a reopened day again, closing an earlier day, and a past day nobody closed (`takingsSoFarFor`) all take their takings from it. The Takings report sums the saved `takings_pence` of the closes.

## Goals / Non-Goals

**Goals:** Cycle to Work money is beside a close's takings, not in them (Jack, 14 Nov, merge-c2w Q1 option 2), as online money already is.

**Non-Goals:**
- The accounts summary's filing under Gift cards (the other half of Q1, still Jack's).
- The Sales report's takings.
- Any screen change.

## Decisions

1. **One line in `takingsIn`:** `takingsPence = card + cash + other`. Every close path and the "so far" figure use it, so they all follow. The `c2w_pence` figure is still saved and shown as before.
2. **Days already closed are not worked out again** (default, logged). A close's figures stay as they were at the close (close-the-day spec, "One close a day, with its report"). No migration. A day closed between pull request 10d and this change keeps its Cycle to Work money in its takings, unless it is reopened and closed again, which works its figures out afresh. That follows item 3 of the 13 Nov entry for days closed before 10d.
3. **Screens unchanged.** The drawings already put the Cycle to Work figure beside the takings, between Other and Online on the Takings report, and after Gift cards on the end-of-day report.

## Risks / Trade-offs

- A period that spans this change can mix closes whose takings include Cycle to Work money with closes whose takings don't. Before shops close real days on Wheelhouse this affects test data only. Jack can overrule decision 2 if he wants old closes worked out again.

## Contract

`POST /api/close-the-day` and the close shown on the Takings report: `takingsPence` = `cardPence + cashPence + otherPence`. `c2wPence` and `onlinePence` are beside it. No field is added or removed.
