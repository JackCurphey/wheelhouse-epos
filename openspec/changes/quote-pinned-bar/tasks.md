# Tasks

## 1. The bar on a tablet or phone

- [x] 1.1 Write screen tests first (`tests/customer/`) with a pretend touch screen: the bar is pinned with "New total £111.00", "Your answers are final once sent." and "Approve £111.00"; the quote itself has neither the line nor the button; unticking Shimano brake pads gives £65.00 and "Decline the extra work" in the bar; the bar's button sends at once; no bar once answered. Watch each fail for the right reason
- [x] 1.2 Write a screen test that on a computer (no touch, wide) there is no bar and the button stays in the quote; it passes today and must keep passing
- [x] 1.3 Build the bar in `src/screens/book/quote-card.tsx` (touch screen or narrower than a computer; the frame's pinned style; bottom padding and scroll padding while it shows; a failed send's message in the bar). Verify 1.1 and 1.2 pass
- [x] 1.4 Add a browser test at 320px wide on a touch screen: at the bottom of the page the last line sits above the bar. Watch it fail first by leaving the padding out, then pass
- [x] 1.5 Log the touch-or-narrow rule in `docs/decisions/decided-while-building.md` (Jack's section)

## 2. Checks

- [x] 2.1 `npm run lint`, `npm test` and `npm run test:browser` pass, then a fresh review against this change's spec and the drawings

## Workflow follow-up

- Archive the change with `/opsx:archive` as the last commit of the pull request, before it merges.
