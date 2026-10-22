# Offer another time: three checks it missed

## Why
Mark's audit of the "Check #…" merges (`docs/reviews/2026-10-22-flagged-merges-audit.md`, items 15, 16 and 17 on #315) found three ways an offer could be made that nobody could answer, or that stored rubbish. Item 18 (untimed offers in drop-off mode skip the day's capacity check) is deliberate per the offer design, a staff choice, and is left as it is.

## What changes
- **15:** a request whose bike is already in the shop, or whose work has started, can't be offered another time. The customer's link can't act then (`customerTooLate`), so the offer would wait with no one able to answer it. "The bike is already in the shop, so this can't be offered another time." / "The work has already started, so this can't be offered another time." (409 `illegal`).
- **16:** a time already gone today can't be offered. The check refused only past dates. "That time has passed - please choose a later time." (400), the shop's own clock.
- **17:** the offer's message must be text, as decline's is. An object was stored as "[object Object]". "The message must be text" (400). Left out or null still means no message.

## Decided here, for Jack to overrule
The wording of the three refusals follows the existing "That date has passed - please choose another day." and Jack's plain refusals; no drawing shows them.

## Impact
`server/routes/workshop.js` (Jack's workshop server, the offer route only); `tests/workshop-offer.test.js`; `openspec/specs/workshop-jobs/spec.md` through this change's delta.
