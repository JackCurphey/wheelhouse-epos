# Coverage cell 3: App map and navigation × Jack Lewis, Your settings › Show graphs in reports (clicked on the mockup)

Stage W coverage check (`../coverage-check.md`, "Empty cells", cell 3), walked 4 Oct 2026. I used the method in `../ux-walkthrough-script.md` and the owner's checks in `../personas.md` (the overview first with no clicks; margin one step away; figures match), with issue #116's three changes: fewer steps rather than more drawings, screens counted as well as clicks, and the joins clicked through the mockup at desktop, tablet and phone. The mockup was rebuilt first (763 screens, 0 dead links). Targets below are the `data-go` / `data-act` values in `generator/out-mockup/data/*.json`, read with a scratchpad script. Nothing was saved to the repo.

Kept screens walked: `staff-app` and `your-settings`, with its situation `rp-your-settings` ("Your settings › Accessibility (scrolled down): show graphs in reports", Owner).

## The story, as the mockup clicks it

Story 11, started in the staff app:

1. Jack Lewis is on Bolton's Today (`op-today`). He clicks his name ("Your settings — Jack Lewis, Owner").
2. In Your settings › Accessibility he finds "Show graphs in reports" (`rp-your-settings`). The cell's suggestion says he "turns on" the switch, but the drawing shows it **already on** (`aria-checked="true"`, at all three sizes). That matches Reports 7: graphs are at the top of every report, and "anyone can hide graphs in Your settings". So I walked it as checking it's on, turning it off and on again, and closing.
3. He goes to Reports (`rp-home`), then a report with a graph (`rp-sales`, "Takings by day").

## Clicks and screens

| Size | Clicks as drawn | Clicks in the mockup | Screens | Notes |
|---|---|---|---|---|
| Desktop | 3: name, Close, Reports (+2 to switch off and on; + a scroll, the drawing is "scrolled down") | 4 (name, Close, Today, Reports), and the switch is never shown (M1: Jo's settings open; M2: Close lands on Jo's diary) | 3: `op-today`, `rp-your-settings`, `rp-home` (4 with `rp-sales`) | |
| Tablet | 3 (+2) | as desktop | 3 | The rail's "JL" opens the same drawing |
| Phone | not counted | not counted | — | The phone menu is drawn for staff only, with no Office room and no Reports. That's already in `mockup-gaps.md` (story 11 step 3) and Jack accepted the longer way round (3 Oct). Not raised again |

Fewer steps: the switch is one click from any page, plus a scroll. No new drawing is needed. `rp-your-settings` is already a situation of `your-settings`, and "Show graphs in reports" is decided to live in Accessibility (Reports 8, audit L4). So it isn't moved onto the report page.

## High

None found.

## Medium

### M1: Jack Lewis's name opens Jo Taylor's settings, which have no "Show graphs in reports"

- **Screens:** `op-today` → `your-settings` (desktop, tablet). The same from every Owner page's name button.
- **What happens:** "Your settings — Jack Lewis, Owner" goes to `your-settings` (`links/shared.mjs` line 33). That drawing reads "Jo Taylor · Staff · just for you", and its Accessibility section ends at "Folded sidebar", with no "Show graphs in reports". The owner's drawing, `rp-your-settings` ("Jack Lewis · Owner", with the switch on), exists, but nothing links to it: an incoming-link scan of all 69 data files finds 0. The person choice in the mockup doesn't swap it in, because on a click it only swaps a view whose id is the page's own id plus `-owner`, `-staff` and so on (`page.html` `viewOf()`), and `rp-your-settings` isn't named that way.
- **Why it matters:** this is the whole step. Clicked, the owner opens his own settings, sees Jo's name, and can't find the switch Reports 7 promises. Reports 9 says Jo's settings don't have it on purpose ("only for people who can see reports"), so the screen he gets is right for her and wrong for him.
- **Fix, no choice:** in `links/shared.mjs`, `'Your settings — Jack Lewis, Owner': go('rp-your-settings')`. This is a mockup link. The drawing is scrolled down over the Reports page. That's fine as an example, and the Close fix in M2 takes him back to where he was.
- **Decision it touches:** Reports and accounts 7, 8 (L4) and 9; App map 8 (later change 1 Oct, "Show graphs in reports"). None reopened.
- **Second check:** KEPT. `op-today` at desktop and tablet: `"Your settings — Jack Lewis, Owner" → your-settings`. `your-settings` text: "Jo Taylor · Staff", and its switches are status symbols, reduce motion, don't close by themselves, larger text and folded sidebar (5). `rp-your-settings` adds "Show graphs in reports … The figures are always in the table below it, for screen readers too", `aria-checked="true"`. Nothing leads to `rp-your-settings`. Walk 3's story 11 doesn't visit Your settings.

### M2: Closing Your settings drops the owner on Jo's diary, where there's no Reports

- **Screens:** `rp-your-settings` → `diary` (desktop, tablet, phone). `your-settings` → `diary` the same.
- **What happens:** "Close" goes to `diary`, the Staff view. Its sidebar is Jo Taylor's: Front desk, Workshop, Stockroom, and Office with only "Today". It has no Reports, Website or Settings. To go on to Reports, Jack has to click Today (→ `op-today`), then Reports.
- **Why it matters:** the story is "turn on graphs, then go to Reports". Clicked, closing the pop-up changes the page behind it to someone else's, and the link he wants has gone. That's 2 extra clicks, and in a walk with Jack it looks like a real dead end.
- **Fix, no choice:** in the mockup, "Close" on `your-settings` and its situations goes back to the page it was opened from (`BACK`). This is a mockup link. (Cell 2's L1 is the same fix, seen from Alex's side.)
- **Decision it touches:** none.
- **Second check:** KEPT. "Close" → `diary` at all three sizes on both drawings. The `diary` desktop text is "… Office | Today | JT | Jo Taylor | Staff | Sign out", with no Reports link among its controls.

## Low

None found.

## Seen in passing, not counted

- **The story's "turns on" doesn't fit the decision.** Graphs are on unless someone hides them (Reports 7), and the drawing shows the switch on. The coverage check's wording is the only thing off. A real owner would come here to turn graphs *off*. I didn't edit `coverage-check.md` (it isn't this cell's file).
- **What changes with graphs off isn't drawn.** It's the same report without the graph area ("The table always stays below", Reports 7). A line, if anything; not raised.
- **Reports' front page has no graph.** The strip is figures, not charts (Reports, 3 Oct, question 1). The first graph Jack sees is inside a report (`rp-sales`, "Takings by day … [£]"). This is as decided.

## Persona and access checks

- **Owner:** one click to the switch plus a scroll, and Reports one click after Close, once M1 and M2 are fixed. The overview strip is still the first thing on Reports. Walk 3's H1 (All shops) is a separate, earlier finding, not raised again.
- **Screen reader:** the switch is `role="switch"` named "Show graphs in reports", with a hint saying the figures are always in the table below. Graphs carry a spoken description (Reports 8, M15/M16).
- **Keyboard only:** the switch is a button. Not checked: focus order inside the pop-up, or whether focus returns to the name button.
- **Low vision:** the hint text is 13px at desktop. "Larger text" sits two rows above it.

## End table

| Id | Screens | One line | Jack chooses? |
|---|---|---|---|
| M1 | op-today, your-settings, rp-your-settings | The owner's name opens Jo's settings, with no graphs switch | No |
| M2 | rp-your-settings, your-settings, diary | Close lands on Jo's diary, which has no Reports | No |

## Questions for Jack

None. Both findings are mockup links, and where the switch lives is already decided (Reports 7, 8 L4, 9).

## Verification

- **Walked:** `op-today`, `rp-your-settings`, `your-settings`, `diary`, `rp-home`, `rp-sales` at desktop and tablet; `rp-your-settings`, `your-settings` and `op-today` at phone. I read text, every control with its resolved target, the switches' `aria-checked`, and the situation lines (`consolidate/j17.mjs` line 11, `consolidate/ja.mjs`).
- **Mockup code read:** `controls.mjs` `resolve()`, `links/shared.mjs` (lines 32–33), `page.html` (`fitFor`, `viewOf`, `onClick`), `stories.mjs` story 11.
- **Incoming-link scan:** nothing leads to `rp-your-settings`.
- **Decisions read:** Reports and accounts (`2026-10-01-reports-and-accounts-review.md`, decisions 7–9 and every later change); App map in full; the third walk decisions; walk 3's story 11 report; `mockup-gaps.md`.
- **Not checked:** the rendered pop-up (how far it has to scroll at desktop), and focus order.
