# Draw the third walk: Jack's ten answers and the third walk's no-choice fixes

Issue #116 step 6, after the third walk. The third walk clicked the twelve
stories through the mockup at desktop, tablet and phone
(`docs/design/user-journeys/walk-3/`). Jack answered its ten questions on 3 Oct,
every one with option 1 (`docs/decisions/2026-10-03-ux-walkthrough-third-walk.md`).
This pass draws:

- **(A)** the ten answers: 1, 2, 3, 4, 6, 8, 9 and 10 in the drawings; 5 and 7
  in the mockup;
- **(B)** the diary's block text at 12px or more on the desktop ("Taken without
  a question" in the answers file);
- **(C)** every third-walk finding whose second check says it follows a
  recorded decision, or whose fix is a wrong link, a drawing whose figures
  disagree, or the website's "Turn it on" while moving (same section);
- **(D)** the mockup: the Lightspeed story, the situation lines under each
  drawing, the new drawings wired in, the wrong links fixed, better story paths,
  and size gaps closed.

Sources read 3 Oct: the twelve walk-3 reports (findings, second checks,
questions), the answers file, the second spec (`2026-10-03-draw-the-answers.md`,
for style), the generator on `design/one-canvas` at `1b9dc26`, the built canvas
(`generator/out/project/`: 177 notes, 211 boards) and the mockup build.

## Intent

The mockup should click the way Jack decided. Where the third walk found the
mockup showing something wrong (Maya's money taken twice, a repair "still in the
shop" after it was collected, Jo seeing costs), the drawings or the wiring are
corrected, using only what an answer or a recorded decision says.

## Approach

1. **Lines before drawings** (README rule 1). New drawings only where an answer
   asks for one. All new drawings are **situations** (`into()`), so the one
   canvas gains **no boards**: they show on their journey's own canvas and in
   the mockup, and as a line under their screen's board.
2. **Wording and example data come from the drawings, the answers and the
   reports' fix text.** Names: Maya Patel, Jo Taylor, Alex Morgan, Jack Lewis,
   Oliver Chen, Sam Reed, Jamie Brooks, Aisha Khan; WH-1042, Trek Domane AL 3,
   North Street Cycles, Bolton, [Second site]. Anything unknown stays bracketed.
3. **Generators only.** Every drawing change is made in `generator/*.mjs` and
   `consolidate/j*.mjs`; `out-*` is rebuilt, never edited.
4. **Remove what an answer replaces**: a line that a new drawing now shows goes
   (its `into()` diff says it instead); `fr-today-moving`'s `later()` goes.
5. **Grouped by module** so groups can be drawn at the same time without
   editing the same file. `journeys.mjs` (titles) was edited first, once, for
   all groups; each group owns its module(s) and its `consolidate/jNN.mjs`.
6. **Visual changes:** the diary text (B) is covered by Jack's 3 Oct "yes you
   can go ahead and make some text bigger"; walk-12 L3's four 12px words go to
   15px under the same yes. Nothing else changes size.
7. **Budgets.** Notes: limit 200 (177 now). Files: limit 512 (212 now, with
   the index). No boards are added.

## New drawings (all situations)

| Id | Into | Module | Answer |
|---|---|---|---|
| `staff-search` | `staff-app` | `app-map.mjs` | 1 |
| `till-search-paid` | `till-search` | `app-map.mjs` | 1, 8 |
| `till-checkin-workshop` | `till-checkin` | `signin.mjs` | 8 |
| `till-receipt-split` | `till-receipt` | `till.mjs` | walk 2 H1 |
| `till-c2w-paid-cert` | `till-receipt` | `till.mjs` | 4 |
| `rp-home-all` | `rp-home` | `reports.mjs` | 2, 3 (walk 11 H1) |
| `ms-today-shown` | `op-today` | `sites.mjs` | 6 |
| `fr-today-moving` (redrawn; was later) | `fr-today` | `setup.mjs` | 10 |

## Changes, by group

### G1. `app-map.mjs`, `consolidate/ja.mjs` (answer 1, 8)
- `till-search` redrawn: each result row is its name (a link that opens the
  job, order, customer or product) and the till button on the right. The job
  row: "WH-1042 · Maya Patel", "Trek Domane AL 3 · Standard service · Expected
  11:30", button "Book in". Order row button "Hand over". Customer row button
  "Add to sale". "Add to basket" goes from the job row.
- `till-search-paid` (new): the same search with the WH-1042 row "Paid online
  · [date]" and "Hand over".
- `staff-search` (new): the header search open on a staff page (Jo's page
  behind), the same groups and rows, each row opening its page, no till
  buttons, no basket.
- Lines removed because a drawing now shows them: `till-search` "A job paid
  online…", "A job expected today: Book in"; `staff-app` "Search open on any
  staff page…". "Each result row…" is cut to what isn't drawn ("Enter and
  scanning still do the till action").

### G2. `diary.mjs`, `consolidate/j12.mjs` (B; walk 1 M3; walk 9 L3, M4)
- Desktop week and day blocks: bike and service text at least 12px, hour labels
  and "No time" at least 12px. A block too short for two lines shows the bike
  only; the service stays in the block's name, the hover summary and the quick
  look.
- Filler blocks on the desktop week stop using Maya Patel: they take the other
  example customers already in the drawings (Oliver Chen, Sam Reed, Jamie
  Brooks, Aisha Khan) or "[Customer]". Only WH-1042 is Maya's.
- Quick look over WH-1042: the declined gear cable reads "· no thanks" (as
  `dq-answered`), and "Cost £111.00" becomes "Agreed £111.00".
- `new-job-pick`: the free time the mockup clicks is after today (Thu 17 Sep),
  on a day the drawing already shows.

### G3. `till.mjs`, `consolidate/j11.mjs` (answer 4; walk 2 H1, L2; walk 10 L4, L6)
- `till-receipt-split` (new): "Paid · £70.00 · Cash £20.00 · Card £50.00" over
  the discounted basket (pads, fitting, "Discount · [reason]" −£4.00).
- `till-c2w-paid-cert` (new): "Paid · Cycle to Work · [Provider]", nothing from
  Maya, the bike collected. `till-c2w-paid` stays, reached from
  `till-c2w-extra`.
- `till-collect`: Maya Patel and her order's items, as her order shows them.
- `till-hand-over-job`: the "Tick each item…" sentence goes (one bike, nothing
  to tick).
- `till-book-in`: "Acknowledged" → "Printed".

### G4. `collect.mjs`, `consolidate/j05.mjs` (walk 1 L1; walk 2 H1; walk 12 M2)
- `cp-paid`: "£111.00 paid for your repair · WH-1042".
- `cp-receipt-email-guest` is the discounted till sale where story 2 sends it:
  pads, fitting, "Discount −£4.00", "Total £70.00", "Paid by Cash £20.00 and
  Card · [card ending] £50.00" (if the repair email is needed elsewhere, the
  group checks and says).
- `cp-summary-counter`: "[shop phone]" is a phone link.

### G5. `book.mjs`, `quote.mjs`, `consolidate/j03.mjs`, `j04.mjs` (walk 12 M2, L3)
- "[shop phone]" is a phone link on `bk-request`, `dq-quote`, `dq-answered`.
- At phone size, 12px → 15px: "Waiting for the shop to confirm" (`bk-request`),
  "Answered" (`dq-answered`), "Tap to enlarge" (`dq-quote`).

### G6. `account.mjs`, `consolidate/j07.mjs` (walk 12 M1, L3; walk 4 M2; answer 9)
- `ac-account` line: "After collecting: the repair moves to Earlier, 'WH-1042 ·
  Trek Domane AL 3 · Standard service · Repair · collected · receipt £111.00 ›'".
- `ac-account` phone: the "In the shop" tag 15px.
- `ac-service-edit`: the service box headed with the service clicked (Gear
  adjustment), with name, group, time in the diary, price and the reminder
  (Owner setup 16; Account 2).

### G7. `signin.mjs`, `consolidate/jb.mjs` (answers 8, 9)
- `till-checkin-workshop` (new): "Enter your PIN" on a workshop computer, no
  till number; what you do is recorded under your name.
- Line removed because the drawing shows it: `till-checkin` "A workshop
  computer: Enter your PIN…".
- Line on `cust-signin`: "Opened from a link (See it in your account on a
  receipt email): after the code, that page opens, with the account behind it".

### G8. `setup.mjs`, `consolidate/j08.mjs` (answer 10; walk 4 M2, M3)
- `fr-today-moving` redrawn to the decided wording and made a situation of
  `fr-today`: one checklist, the move's stage, "Running alongside Citrus Lime:
  the tills start on switch-over day"; no practice-mode wording. Its `later()`
  goes; the `fr-today` line it now shows goes.
- `set-staff-invited`: the Getting started bar, "Getting started: Invite your
  staff · Checklist · Next: Workshop services and prices".
- `set-workshop-services` tablet and phone: each service row offers Edit, as
  the desktop row does.

### G9. `reports.mjs`, `consolidate/j17.mjs` (answers 2, 3; walk 3 L2)
- The strip's period on `rp-home` reads "So far: Mon 14 – Thu 17 September";
  its takings are with VAT (Reports, later change 3 Oct, walk-through 11 H2).
- `rp-home-all` (new): the strip with a row for Bolton and one for [Second
  site]; each shop's name links to that shop's Sales report. The "All shops…"
  line goes; a line says the link switches the shop menu to that shop.
- `rp-margin`: chart axis labels 12px.

### G10. `sites.mjs`, `consolidate/j19.mjs` (answer 6; walk 7 L3)
- `ms-today-shown` (new): the checklist with "Show [Second site] to customers"
  ticked, and a toast "[Second site] is showing on the website, in booking and
  for collecting" with "Undo".
- Line on the Tills page's kept board: after a move, Till [code]3 under [Second
  site], "Was B3", Bolton 2 tills.

### G11. `c2w.mjs`, `consolidate/j06.mjs` (walk 5 M3, L1, L2)
- History lines: "Jack Lewis held the bike longer", "Jo Taylor added
  certificate".
- `op-today-c2w`'s deposit line names "[Customer]".
- Line on `cw-owed-provider`: after Record a payment, the ticked bikes leave
  the list, with what was recorded.

### G12. `online.mjs`, `consolidate/j02.mjs` (walk 2 M1; walk 12 L1)
- `on-order-ready`: every item "On the shelf at Bolton".
- `on-product-added`: the basket count agrees with `on-basket`.

### G13. `cashup.mjs`, `opening.mjs`, `consolidate/j16.mjs`, `j10.mjs` (walk 2 M2; walk 10 L2, L5)
- `eod-entry`: the basket behind is empty.
- Cash-up workings and `eod-z` read the story's float as checked: "Float this
  morning · looked right · Jo Taylor", not counted, not short.
- Line on `op-float-check`: Looks right opens the till with "Float checked ·
  looked right · [Name]"; only a count says "counted by".

### G14. `receiving.mjs`, `moving.mjs`, `consolidate/j13.mjs`, `j09.mjs` (walk 3 M2, L1; walk 4 L3)
- Line on `rs-order`: just ordered, every line "ordered [n] · arrived 0",
  "Waiting for the delivery"; WH-1042's line reads On order.
- `rs-job-arrived`: the diary behind shows the part-arrived block.
- Line on `mv-morning`: after Turn it on, step 2 ticks, "Your website is on".

### M. The mockup (`generator/mockup/`)
- **Answer 7.** `build.mjs`'s situation list moves to a shared module
  (`consolidate/situation-lines.mjs`), so `build-mockup.mjs` writes exactly the
  canvas's lines into `manifest.json` (`lines: { screen id → [line] }`), and
  `page.html` shows them under the drawing as a plain read-only list. Test
  first: the manifest's lines equal the canvas notes' lines for every kept
  screen.
- **Answer 5.** Story 6 books in through `ls-book-in`, opens the job as
  `ls-job-sent`, and presses Mark ready there (→ `ls-job-unpaid`).
- **Notes with a link.** A link may carry a short note (`go(id, note)`), shown
  over the page it opens: for "Now working: Alex Morgan", "Saved: Booking
  confirmed sent…", and "showing Till B2's report"-type notes where the walks
  ask for one.
- **The person and shop on every page** (walk 7 M3, walk 8 L1, the mockup spec):
  when a page opens that isn't drawn for the chosen person or shop, the mockup
  opens that screen's situation for them where one is drawn.
- **Wrong links fixed:** a radio, tab or switch stays on the page (walk 11 M1,
  walk 9 L2); Today by role (walk 1 L2); Stock and Stock take by role, and the
  Staff stock pages link to each other (walk 3 M1, walk 9 M2); the diary's
  WH-1042 card opens `job-mechanic`, other jobs' cards say not drawn (walk 8 M2,
  walk 9 M1); checklist Close and Done go back (walk 6 M1, walk 8 L2); a job
  page's Close goes back (walk 9 L1); `eod-z` Close and the paid boxes' Close go
  to the empty till (walk 2 L1, walk 10 L3, walk 5 L2); `till-c2w-pay` Close
  goes back; Looks right → the till (walk 2 M2); "See your quote" → the PDF,
  outside (walk 5 M1); Hold longer and Undo (walk 5 M3); "[Second site]" and
  "All shops" shop labels open the shop menu (walk 7 L1); Book in on journey 19
  boards → `job-book-in` (walk 7 L2, walk 11 L3); a person's Open → `ms-person`
  in the two-shop mockup (walk 7 M1); Show [Second site] → `ms-today-shown`;
  Make my website and Website while moving → `ws-page-moving`, `mv-morning`'s
  Turn it on → the website on (walk 4 M1); `pin-first` → the till (walk 4 L1);
  Add to sale → `till-customer` (walk 9 M3); the card refund joins the
  "Refunded" gap (walk 2 M3); Mark as ordered stays (walk 3 M2); the disabled
  Mark ready has no target (walk 2 M1); "[shop phone]" opens the phone app.
- **New drawings wired:** `till-search` rows → `till-book-in`,
  `till-hand-over-job`, `till-collect`, `till-customer`; header search →
  `staff-search`; `till-checkin-workshop` keys → the mechanic's diary with "Now
  working: Alex Morgan"; `till-c2w-pay` → `till-c2w-paid-cert`;
  `till-split-discounted` → `till-receipt-split`; `rp-home-all` shop names →
  `rp-sales`; the receipt email's "See it in your account" path ends on
  `ac-receipt` (answer 9).
- **Stories:** 1 and 12 end on the receipt (answer 9); 2 Looks right → the till;
  3 Jo's steps on the Staff pages, one count all the way through; 4 Jo's first
  check-in after `mv-morning`, Make my website → `ws-page-moving`; 5 `cw-today`,
  and certificate-only payment; 6 answer 5; 7 `ms-person`, `ms-today-shown`;
  8 the workshop PIN and the paid-online search row; 9 the Staff stock pages and
  `job-mechanic`; 10 the till search's Book in and Hand over; 11 the B2 row and
  `rp-home-all`; 12 the featured product.
- `missingAt` removed wherever a size gap is now closed.

## Done when
1. `node --test docs/design/user-journeys/generator/consolidate/` passes,
   including `plan-coverage.test.mjs` (the build plan lists the new situations
   and the moved `fr-today-moving`, and its written-line counts add up).
2. `node --test docs/design/user-journeys/generator/mockup/` passes, with a new
   test for the manifest's lines watched failing first.
3. Each changed journey rebuilt with `--theme sand`; `node build.mjs`;
   `node fitcheck-canvas.mjs` 0 problems, under 200 notes and 512 files;
   `node mockup/build-mockup.mjs` 0 dead; `node mockup/gaps.mjs` run.
4. Each answer's decision file has a dated "Later change" note pointing here.

## Left for Jack (not settled by a decision, or not done here)
1. **Walk 3 M3 (one stock count all the way through):** settled 3 Oct (Jack: "1", count an area): `tk-hub` shows [Area] ready to check, `tk-diff` and `tk-applied` name [Area]. Was: not changed. Both fixes
   need a choice the decisions don't make: the story counting a category while
   `tk-count` is drawn counting an area, or a new "still counting" state on
   `tk-hub`.
2. **Walk 10 L1 (every PIN opens the first-in float check):** the mockup can
   give a key only one target; left as it is.
3. **Walk 11 M3 and L1 (mockup notes on Jo's Sales and on "Show report"):**
   not added; the situation lines under each drawing now say the same.
4. **Wording the drawers chose where the answers gave none**, for Jack to
   check: `rp-home-all` "use the shop menu for one shop"; `till-checkin-workshop`
   leaves out the start-up line, "Checked in today", "No PIN yet?" and the
   phone's menu.

## Decision log
- 3 Oct: new drawings made situations, not boards, so the one canvas keeps its
  211 boards (README rule 1; answer 1 asks for "one new drawing", not a board).
- 3 Oct: the Reports strip's VAT question is settled by the 3 Oct walk-through
  11 H2 later change ("which settles the strip's VAT question: takings with
  VAT"); the "strip and the shop menu" note's period and link are settled by
  answers 2 and 3.
- 3 Oct: walk 10 L5 ("checked by" on `op-float-matched`) is met by routing Looks
  right to the till (walk 2 M2's fix): `op-float-matched` is only reached by a
  real count, so "counted by" there is right.
- 3 Oct: walk 2 H1's `till-find` and `till-sale-detail` stay as they are: the
  story already says Jo looks up "an earlier sale", which is the fix's second
  option.
- 3 Oct: walk 7 M1: the mockup always has two shops (its shop menu), so a
  person's Open goes to `ms-person` everywhere.
- 3 Oct: `cp-receipt-email-guest` stays the repair receipt (the texted
  receipt's "Email it to me" uses it); story 2's till email is
  `cp-receipt-email-till`, filled with the discounted sale's figures.
- 3 Oct: `on-orders-ready` now moves the order that is all on the shelf to
  Ready (the drawing had moved Maya's, which is still waiting); story 2 marks
  that order ready from the list (walk 2 M1).
- 3 Oct: `mv-morning` is a situation of `mv-start`, so its "after Turn it on"
  line sits on `mv-start`; the Tills page's line sits on `set-till-quick`.
- 3 Oct: the mockup picks a person's or shop's view on a click only when it is
  the same page drawn for them (its id plus -staff, -mechanic, -manager,
  -owner or -all); a first version that picked any situation for the role sent
  clicks to different moments (job pages to "in the workshop"), so it was
  narrowed. "-all" counts as All shops only when the title says so.
- 3 Oct: the customer page's "Messages" history filter is a pressed button,
  not a radio, so it is kept on the page by its own rule.
- 3 Oct: the situation-lines check skips screens the mockup has no drawing of
  (the Release 1 picture `pending`).

### Done (3 Oct)
- Consolidate checks 16 of 16; mockup checks 5 of 5 (the new lines check
  failed first on the old manifest: 145 screens differed).
- `node build.mjs`: 211 boards (unchanged), 178 notes (+2: `cw-owed-provider`,
  `eod-z`; −1: journey 8's later list); `node fitcheck-canvas.mjs`: 211 boards,
  0 problems; `node mockup/build-mockup.mjs`: 763 screens, 0 dead;
  `node mockup/gaps.mjs`: 96 not drawn, 21 size gaps (was 22), 43 outside.

### Review fixes (3 Oct)
- `fr-today-moving`: the added "The weekly check matched 2 weeks in a row"
  step is removed; no decision puts it on Getting started. The move's line
  keeps "ready to switch over: 3 of 4", the count of the switch-over list as
  drawn on `mv-ready` after practice sales were dropped (Moving, later change,
  issue #116 question 4).
- `till-c2w-paid-cert`: "Nothing to take from Maya." removed; no decision
  supplies it.
- `customer.mjs`: Maya's own jobs (WH-1051, 1054, 1056, 1059, 1062, 1071, 1074,
  1077, as drawn at `1b9dc26`) are held in the module, so the diary's filler
  rename leaves her history, open jobs and counts as they were (checked: every
  job row and count on the customer canvas matches the `1b9dc26` build). "jobs"
  is singular for one.
- 3 Oct: walk 3 M3 settled by Jack ("1"): the area count is followed through on `tk-hub`, `tk-diff` and `tk-applied` (`stock.mjs`); story 3's step and the j14 link renamed to "Check the count of [Area]". Checks: consolidate 16/16, mockup 5/5, fitcheck 0 problems, 0 dead.
