# Consolidation — back office (journeys 8, 9, 13, 14, 17, 18, 19, 20)

Read-only re-check of Mark's estimates in issue #116, for step 1, 3 Oct 2026. All counts come from `generator/journeys.mjs`. Anything marked *(inferred)* is judgement, not something read in a file.

## How this counts

- **Real screen:** a page, or a box over a page that has its own form (for example the person form or "Add a shop").
- **Settings section:** another part of a Settings page that is already counted.
- **Other journey's screen:** a drawing that is really a screen from another journey (the job page, diary, Today, booking, Your settings), shown here again.
- **Situation or edge case:** empty, saved, failed, Staff or Manager view, all shops, Cycle to Work, while moving, on/off, a yes/no box, a one-choice box.

## Counts by class

| Journey | In map | Drawn | Real | Settings section | Other journey's | Situation or edge | Deferred by 3 Oct (drawings) |
|---|---|---|---|---|---|---|---|
| 8 Owner setup | 41 | 41 | 14 | 11 | 1 | 15 | 0 |
| 9 Moving | 24 | 24 | 5 | 0 | 0 | 19 | 5 |
| 13 Receiving | 47 | 44 | 8 | 1 | 7 | 28 | 7 |
| 14 Stock | 37 | 37 | 10 | 1 | 3 | 23 | 0 |
| 17 Reports | 39 | 39 | 11 | 4 | 2 | 22 | 0 |
| 18 Website | 64 | 64 | 13 | 0 | 1 | 50 | 29 |
| 19 Multiple sites | 25 | 25 | 5 | 3 | 7 | 10 | 0 |
| 20 Oversight | 24 | 24 | 3 | 2 | 4 | 15 | 17 |
| **Total** | **301** | **298** | **69** | **22** | **25** | **182** | **58** |

Mark's 301 matches the map. However, 3 of journey 13's ids (`po-suppliers`, `po-feed`, `po-send`, journeys.mjs:852-856) are placeholders, not drawings. Jack already held them back (build plan:295).

**Drawings the 3 Oct answers defer (58):**
- **Question 4 (practice mode dropped), 5:** `mv-practice-checkin`, `mv-practice-sale`, `mv-practice-card`, `mv-practice-job`, `mv-go-real`.
- **Question 6 (invoice check later), 7:** `rs-invoice`, `rs-invoice-checked`, `rs-invoice-diff`, `rs-invoice-cost`, `rs-invoice-queried`, `rs-invoice-accepted`, `rs-invoice-setting`.
- **Question 2 (fixed website design), 23:**
  - the 12 `ws-editor-*` screens, plus `ws-editor-first` and `ws-editor-moving`;
  - the 5 `ws-theme*` screens;
  - `ws-pages`, `ws-pages-new`, `ws-page-settings`, `ws-page-returns` (website decision 4).
- **Question 3 (own address frozen), 6:** `ws-address`, `ws-address-typo`, `ws-address-steps`, `ws-address-waiting`, `ws-address-done`, `ws-address-moving`.
- **Question 5 (oversight extras later), 17:**
  - everything in `ops-*` except the activity log;
  - plus `ops-log-filtered`, because it is opened from a Today alert;
  - plus `ops-my-activity`, because it belongs to "What Wheelhouse records about you" *(inferred)*.

## Merge table compared with Mark's

| Journey | Drawn now | Mark: after merging | This check: after merging | This check: after 3 Oct | Main merges | Decision touched |
|---|---|---|---|---|---|---|
| 8 | 41 | ~22 | 14 | 14 | One drawing per Settings page; invite and till-only person are one form; `set-workshop-diary` is journey 12's `diary-settings` (setup.mjs:323) | none |
| 9 | 24 | ~9 | 5 | 5 | One move page with 3 stages (moving.mjs:259-278 all draw the same `movePage`); the practice drawings are the till and job page with a band | Moving 6 (answered by question 4) |
| 13+14 | 84 | ~24 | 18 | 17 | 7 receiving ids are the job page, diary and overview (receiving.mjs:337-342); transfers reuse the delivery list and scan screen; one stock list with filters | Receiving 6 (answered by question 6) |
| 17 | 39 | ~20 | 11 | 11 | One report page per report, with "All shops" as a choice; `rp-person` is journey 8's person form (reports.mjs:356) | none |
| 18 | 64 | ~31 | 13 | 6, plus 1–2 to draw | One editor, one Website page; "while moving" becomes situations | Website 1, 3, 4, 7 (answered by questions 2 and 3) |
| 19 | 25 | ~12 | 5 | 5 | Booking step, till setup and person form belong to journeys 3, B and 8 (sites.mjs:26-32) | none |
| 20 | 24 | ~7 | 3 | 1 | `ops-reports-home` and `ops-reports-staff` *are* `rp-home` and `rp-home-staff` (oversight.mjs:157-158) | Oversight 2, 3, 4 (answered by question 5) |
| **Total** | **301** | **~125** | **69** | **59, plus 1–2** | | |

**Where these numbers differ from Mark's, and why.** This check counts other journeys' screens (25 drawings) and Settings sections (22) as no new drawing. Adding them back gives 69 + 22 + 25 = **116**, close to Mark's ~125, which is probably how that figure was reached *(inferred)*. Journey by journey, the direction agrees with Mark's everywhere. Mark's journey 8 figure (~22) sits between the strict count (14) and the count with Settings sections kept as their own drawings (25).

The 3 Oct answers take a further **58 drawings** and **10 real screens** out. The reduced target is **59 screens**, plus 1–2 new website screens (finding H1).

## Building blocks

Mark's 1–14 stay as they are, with two changes:
- the person form moves from block 4 (detail page) to block 9 (form box);
- block 15 ("the job page") becomes a rule rather than a block: **link to other journeys' screens, don't redraw them**. That rule covers 25 drawings.

Five blocks are added:

16. **Scan-and-count list**: receiving a delivery, receiving a transfer, and stock-take counting (`rs-receive`, `tr-receive`, `tk-count`). They use different code today (`receiveBoard` and `countBoard`). Whether one block can serve all three is *(inferred)*.
17. **Price at each shop field**: `ms-service-price`, `ms-product-price`.
18. **Stage strip or step-by-step start**: the move's stages (moving.mjs:44-58) and the website's three-step start (website.mjs:145).
19. **"You can't open this — ask [name]"**: `ws-no-access`, `ws-no-settings`, `ops-log-refused`.
20. **Simple text-and-photo editor**: new, needed for question 2's fixed design.

The full website editor is out of the first release. That gives **19 blocks plus one rule, covering 298 drawings**. From the generator: 63 screen definitions draw a box over a page (`overlay(`), and 16 are Today with one card changed.

## Main tasks walked

| Task (persona) | Clicks | Different screens | Source |
|---|---|---|---|
| Takings split by shop (owner) | about 4 now (Reports, Sales, shop menu, All shops); 1 after question 1 | 2, then 1 | reports.mjs:132, 365 |
| Margin by shop (owner) | can't be done | — | no all-shops margin drawn (journeys.mjs:1014) |
| Set up a new shop (owner) | about 16 | 8 (Today plus 7 different pages) | setup.mjs:436-444; walk-through 4:19 |
| Move from Citrus Lime (owner) | about 30, including the website | about 6 | walk-through 4:25 |
| Receive a delivery (Jo) | about 4, plus one scan per item | 3, plus the labels box | receiving.mjs:311-332 |
| Add a second shop (owner) | about 20 | 4–5 | walk-through 7:25 |
| Website after question 2 (manager) | can't finish | — | finding H1 |

## Persona findings

**High**

1. **The first-release website can't be finished.**
   - Question 2 defers the editor (website-management-review.md:208), but nothing is drawn for "edit text and photos" on the fixed design.
   - Publish, Discard and History (decision 2, still standing) are drawn only on top of the deferred editor (website.mjs:516-519).
   - Step 2 still says "You can change anything later under Theme" (website.mjs:148), and Theme is deferred.
   - Policy pages (privacy, returns) probably still need wording the shop can edit *(inferred)*.
   - This needs 1–2 new drawings.
2. **Getting started can't finish for a one-person shop.** Confirmed:
   - "Invite your staff" ticks only when someone accepts an invite (setup.mjs:439).
   - The checklist only goes when every step is ticked (owner-setup-review.md:122).
   - The checklist card has no Close or Skip (setup.mjs:480-492).
   - New: someone added "till only, no email" never accepts an invite either, so that shop can't finish either *(inferred from the tick rule)*.
   - The 3 Oct answers don't settle this. A "Just me for now" option would add to decision 16 without reversing it.
3. **Owner's first check: question 1 settles most of it, two gaps remain.**
   - Confirmed: the Reports home has cards only (reports.mjs:132).
   - Gap 1: margin is never drawn split by shop. Only Sales, Takings, VAT and Workshop have "All shops" versions, but the owner wants figures split by shop (personas.md:115-117).
   - Gap 2: the new strip will put takings *with* VAT (reports.mjs:154) beside margin worked out from sales *before* VAT (reports.mjs:267). The two will disagree on the very first screen *(inferred; the strip isn't drawn yet)*.

**Medium**

4. **Figures that disagree by design: mostly confirmed, with corrections.**
   - Confirmed: Sales and Margin start from different VAT figures (reports.mjs:154 against 267).
   - Online money is already explained on the Takings page (reports.mjs:208), and reopened days are too (reports.mjs:211).
   - New: products sold without a cost are left out of margin (reports.mjs:268).
   - So the "why this differs" line is needed on Sales and on the new strip.
5. **Two checklists while moving: confirmed, but 3 steps are shared, not 4.**
   - The shared steps are card machine, float and website (setup.mjs:438, 442, 444; moving.mjs:201-204).
   - After question 4, the switch-over list drops "Everyone has made a practice sale" (moving.mjs:203). That leaves 4 items, 3 of them shared, so it is nearly the same list twice. Showing one checklist while a move is on would fix this.
   - These words are out of date after question 4: "Your tills are in practice" (setup.mjs:486), "Every till is in practice" (moving.mjs:138), "Clear and go real" (moving.mjs:225).
6. **Website step 1 asks "Wheelhouse or Shopify?" before the owner has seen anything.**
   - Confirmed (website.mjs:145).
   - It is not settled by 3 Oct. It comes from website decision 11 (website-management-review.md:123) and decision 9 (:106).
   - Shopify still conflicts with business plan §6 (business-plan.md:490-492). That question is still open. The custom-address half is settled by question 3.
7. **The build plan still builds deferred work.** These lines were not changed after the 3 Oct answers:
   - WP-2.3: the invoice check (plan:199);
   - WP-5.4: alerts, devices and feedback (:257-259);
   - WP-6.1: the editor, sections, theme, pages and web address (:264);
   - WP-8.1: practice mode (:284).

**Low**

8. **Pure duplicates:**
   - `ops-reports-home` and `ops-reports-staff` (oversight.mjs:157-158);
   - `set-workshop-diary` (setup.mjs:323);
   - 7 receiving ids that are the job page, diary or overview (receiving.mjs:337-342).
9. **Mark's 84 for journeys 13 and 14 includes 3 undrawn placeholders** that are already held back (journeys.mjs:852-856; plan:295).
