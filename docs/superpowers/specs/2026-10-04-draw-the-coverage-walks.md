# Draw the coverage walks: Jack's five answers and the walks' no-choice fixes

Stage W's coverage check (WP-W.5) found 12 journey-and-person pairs no walk
had covered. All 12 were walked on the clickable mockup
(`docs/design/user-journeys/walk-4/coverage-*.md`). Jack answered their five
questions on 4 Oct, every one with option 1
(`docs/decisions/2026-10-04-coverage-walks.md`; answer 2 is also a dated later
change in `docs/decisions/2026-10-01-buy-online-review.md`). This pass draws:

- **(A)** the five answers;
- **(B)** every walk-4 finding whose second check says it follows a recorded
  decision, or whose fix is a mockup link, a mockup note or a story step
  ("Taken without a question" in the answers file).

Sources read 4 Oct: the twelve walk-4 reports (findings, second checks,
questions), the answers file and the Buy online later change, the last
round's spec (`2026-10-03-draw-the-third-walk.md`, the model for this one),
the generator on `design/coverage-check` at `a4a4085`, the build plan and its
coverage test.

## Intent

The drawings and the mockup should say what Jack decided on 4 Oct, and every
screen the coverage walks needed should be reachable by clicking. Where a walk
found a drawing or a link saying something a recorded decision contradicts
(the website's "Turn it on" during a move, Jo's settings opening for Alex,
payments counted towards "the website is ready"), it is corrected using only
what an answer, a recorded decision or the walk's own fix text says.

## Approach

1. **Lines before drawings** (issue #116's rule; README rule 1). No new
   drawings. Answers 3, 5 and most findings are situation lines; answers 1 and
   4 and a few findings change the words on an existing drawing.
2. **Removals as earlier removals were done.** `on-settings-start`,
   `on-settings-start-answered`, `ws-start-products-answered` (answer 2) and
   `cs-privacy-blocked` (answer 5) become `later('Dropped, not later: …')` in
   their `consolidate/j*.mjs`, as practice mode's screens were. Their
   `journeys.mjs` rows and module `def()`s stay (each journey's own canvas
   keeps its history); the one canvas, the mockup and the build plan drop
   them. The build plan gets a "Dropped: the coverage walks' answers 2 and 5"
   region, and each package that listed them is corrected.
3. **Generators only.** Every change is in `generator/*.mjs`,
   `consolidate/j*.mjs`, `mockup/links/*.mjs`, `mockup/stories.mjs` or
   `mockup/controls.mjs`; `out-*` is rebuilt, never edited.
4. **Wording and example data come from the answers, the drawings and the
   reports' fix text.** Names already in the drawings: Maya Patel, Jo Taylor,
   Alex Morgan, Jack Lewis; WH-1042. Anything unknown stays bracketed.
5. **Tests first.** New checks, each watched failing before the change:
   - mockup: the screens the walks found unreachable can be reached by a click
     (or a story step); a "Close…" button never stays on the page; the walks'
     link fixes lead where the fix says; no button leads to a dropped screen;
     the walks' wording is in the drawings (answers 1 and 4, the review
     switch's name, payments not counted, the dropped "counts towards");
   - consolidate: the four dropped screens are `later()`, and each new
     situation line sits on its screen.
6. **Budgets.** Notes: limit 200 (178 now). Files: limit 512 (211 now). One
   board goes (`on-settings-start`); none is added.

## Changes, by answer

1. **"Menu" beside the three lines, customer website only** (`app-map.mjs`
   `sitePhone`, which every customer page at phone size uses). The open
   menu's close button is unchanged. The staff app's menu is unchanged.
2. **Asked once, in website set-up** (`consolidate/j02.mjs`, `j18.mjs`):
   `on-settings-start`, `on-settings-start-answered`,
   `ws-start-products-answered` dropped. Mockup: "Change what your website
   started with" on `on-settings-show` opens website set-up step 3
   (`ws-start-products`), the page that asks it (as the dropped
   `ws-start-products-answered` did); the Online orders "Showing products" row
   opens `on-settings-show` (walk 5 L2).
3. **A question from the account is a line on staff Messages**
   (`consolidate/j07.mjs`, line on `ac-inbox`): "A question from the account:
   no bike or job; 'Question from her account'; the reply 'Sent to Maya by
   text, with a link to her question'". The waiting question row in the
   drawing names Maya Patel, "Question from her account" (walk 10 M1's fix),
   its screen-reader name says it is the question. Mockup: the row opens the
   Messages screen with a note saying so; the `mockup-gaps.md` entry
   "Another customer's question, opened in Messages" goes.
4. **Ask to delete while the bike is in; it waits** (`account.mjs`,
   `ac-delete-blocked`): "We’ll delete your account once your bike has been
   collected", the bike, "Keep my account" and "Ask to delete" (→
   `ac-delete-sent`). "Ask again after that" goes. Staff already see "Can be
   deleted once the bike is collected".
5. **One way of saying "can't delete yet"** (`consolidate/j15.mjs`):
   `cs-privacy-blocked` dropped; a line on `cs-privacy`: a request logged by
   hand shows "Still in the way: …" on its row with Delete their details held
   back until it's clear, as the website request does; the dropped pop-up's
   how-to is a line under the row. Store credit is not in the way (Account 8,
   walk 12 M1).

## Changes, by walk finding

| Walk | Finding | Change | Where |
|---|---|---|---|
| 1 | M1 | `site-ocean` Open menu → `site-ocean-menu` | `links/ja.mjs` |
| 1 | L1 | Close menu on both website menus goes back | `links/ja.mjs` |
| 2 | M1 | Alex's name opens `your-settings` with the walk's note; a mechanic's phone Open menu carries a note that the menu is drawn as Jo's | `links/j12.mjs`, `ja.mjs`, `shared.mjs` |
| 2 | M2 | Line on `staff-app`: on a workshop computer the sidebar's foot reads "Alex Morgan · Mechanic · Check out"; Check out goes back to Enter your PIN; no Sign out | `consolidate/ja.mjs` |
| 2, 3 | L1, M2 | Close on Your settings (and its situations) goes back; Diary on mechanic drawings opens `diary-mechanic` | `links/ja.mjs`, `j12.mjs` |
| 2 | L2 | The diary's own "Today" button (a button, not the sidebar's link) stays on the page | `links/shared.mjs`, `controls.mjs` |
| 3 | M1 | "Your settings — Jack Lewis, Owner" → `rp-your-settings` | `links/shared.mjs` |
| 4 | H1 | Line on `wb-off-preview`: while moving from Citrus Lime the banner reads "Your website goes on during switch-over morning"; no "Turn it on", no "Ask Jack Lewis to turn it on" | `consolidate/j01.mjs` |
| 4 | M1 | The address on `ws-page` and `ws-page-moving` opens `wb-off-preview`; story 4 gains Jo opening the address (→ `wb-off-preview-ask`) | `links/j18.mjs`, `stories.mjs` |
| 4 | L1 | "Back to Wheelhouse" on `wb-off-preview-ask` and "Back to Today" on `ws-no-access` → `op-today-staff` | `links/j01.mjs`, `j18.mjs` |
| 4 | L2 | Open menu on the three `wb-off-preview` drawings → `site-menu` | `links/j01.mjs` |
| 5 | M1 | Line on `ws-page`: moving, before payments are connected, the Taking payments row is the not-connected one; on `ws-page-moving` the Taking payments row and "Open Online orders settings" → `ws-pay-none` | `consolidate/j18.mjs`, `links/j18.mjs` |
| 5 | M2 | `ws-page-moving`'s ready list no longer counts payments; `ws-pay-tested-moving` drops "This counts towards 'The website is ready'…" | `website.mjs` |
| 5 | M3 | Settled by answer 2 (the boards are dropped) | — |
| 5 | L1 | The test payment's result carries a note naming the moving version | `links/j18.mjs` |
| 5 | L2 | "Showing products" → `on-settings-show` | `links/j02.mjs` |
| 6 | L1 | Story 10 marks online orders ready (`on-orders` → `on-orders-arrived` → `on-orders-ready`), Mark ready on `on-orders-arrived` with the walk's note | `stories.mjs`, `links/j02.mjs` |
| 6 | L2 | `on-cancel-refund`'s role is Staff | `journeys.mjs` |
| 7 | M1 | Online booking row → `bk-settings`; on `bk-settings` Services → `set-workshop-services`, Mechanics → `set-workshop-mechanics` | `links/j08.mjs`, `j03.mjs` |
| 7 | M2 | Line on `bk-settings`: with no online payments the deposit switch is Off, "Connect [payment provider] first · in Settings › Front desk › Online orders"; `ws-pay-none`'s sentence names deposits | `consolidate/j03.mjs`, `website.mjs` |
| 7 | M3 | Two lines on `set-workshop-services` (the service box): "Customers can book this online" (on by default); "Take a deposit for this service" when deposits are for chosen services | `consolidate/j03.mjs` |
| 8 | M1 | Story 9 starts with Maya ringing about the quote: `dq-today-no-answer` → Record their answer → `dq-record-answer` → Save → `dq-job-answered`; the WH-1042 block on `dq-diary-waiting` → `dq-job-sent` | `stories.mjs`, `links/j04.mjs` |
| 8 | M2 | Line on `job-overview`: a phone answer's note reads "Maya answered by phone at [time] · taken by Jo Taylor"; the mockup's Save shows it as a note | `consolidate/j04.mjs`, `links/j04.mjs` |
| 8 | L1 | Line on `dq-record-answer`: "Goes with" under the fitting; the pair ticks together | `consolidate/j04.mjs` |
| 9 | M1 | Send receipt carries a note: the email is drawn for the £70.00 sale; it always shows the sale it's for | `links/j05.mjs` |
| 9 | L1 | "Add the customer", "Not now", "Send when back online" → `till-empty` | `links/j05.mjs` |
| 10 | L1 | The phone menu's Messages → `ac-inbox-list` | `links/ja.mjs` |
| 11 | M1 | Edit on Review request → `ac-review-first`; Service reminder → `ac-reminder-wording`; Bike still waiting → `cp-message-wording`, on every Messages board | `links/j08.mjs`, `j07.mjs`, `j04.mjs`, `j02.mjs` |
| 11 | L1 | Line on `set-msg-list`: until a review page is saved, the Review request row reads "Off · add your review page first" and can't be switched; Edit is the way in | `consolidate/j07.mjs` |
| 11 | L2 | Each On/Off on Settings › Messages is named with its message ("Review request: Off") | `setup.mjs` |
| 11 | L3 | Save on `ac-review-first` → `set-msg-list` with the note "Review request is now On" | `links/j07.mjs` |
| 12 | M1 | Settled with answer 5 (the pop-up goes); the credit wording lives in M3's line | — |
| 12 | M2 | Answer 4 | — |
| 12 | M3 | Three lines on `cs-privacy`: Maya's request once WH-1042 is collected; "Done [date]" after deleting; Maya told it's done the way she chose (wording drafted under build-plan question 9). Mockup: `cs-privacy`'s Delete their details carries a note naming Maya | `consolidate/j15.mjs`, `links/j15.mjs` |
| 12 | L1 | Today: "Maya Patel asked us to delete her account"; the confirm: "Delete Maya Patel’s details?" | `account.mjs`, `customer.mjs` |

## Files

- Spec: this file.
- Drawings: `app-map.mjs`, `account.mjs`, `customer.mjs`, `website.mjs`,
  `setup.mjs`, `journeys.mjs` (one role).
- Plan: `consolidate/j01, j02, j03, j04, j07, j15, j18, ja.mjs`.
- Mockup: `mockup/controls.mjs`, `mockup/stories.mjs`, `mockup/links/*.mjs`,
  tests in `mockup/check.test.mjs` and `consolidate/check.test.mjs`.
- Build plan: `docs/superpowers/plans/2026-10-03-release-2-build-plan.md`.
- Decision files: dated later-change notes for answers 1, 3, 4 and 5 (App map,
  Account and reminders, Customer service); answer 2's is already in Buy online.

## Done when

1. `node build.mjs`; `node --test 'consolidate/*.test.mjs'` passes, including
   `plan-coverage.test.mjs` (the build plan lists the dropped screens once and
   its written-line counts add up).
2. `node mockup/build-mockup.mjs` 0 dead; `node --test 'mockup/*.test.mjs'`
   passes, with the new checks watched failing first.
3. `node fitcheck-canvas.mjs` 0 problems, under 200 notes, under 512 files;
   `node mockup/gaps.mjs` run; `node coverage.mjs` (repo root) still runs.

## Left for Jack (not settled by a decision, or not done here)

1. **Wording chosen where the answers gave none**, for Jack to check:
   - `cs-privacy`'s answer-5 line keeps the dropped pop-up's how-to as
     "Take the payment and hand the bike back, then delete", without its
     store-credit part (store credit isn't in the way, Account 8).
   - `ac-delete-blocked` (answer 4) keeps "Call [shop phone] if you need to
     talk it through" and has "Keep my account" beside "Ask to delete", as the
     ordinary delete pop-up has.
   - Answer 1 puts "Menu" on the button that opens the website's menu; the
     open menu's close button (an ✕) has no word.
   - `ws-page-moving`'s ready list (walk 5 M2) now reads "1 of 2": "Set up: the
     three steps" and the starting-wording item. The decided rule is the
     wording item alone; the set-up item is always done when this page shows,
     so it was left rather than redesigning the box.
2. **Walk 5 L1:** a mockup button leads to one page, so "Make a test payment"
   opens the everyday result with a note naming the moving one
   (`ws-pay-tested-moving`, in the situations list), rather than opening it.
3. **Walk 8 M1:** the search's WH-1042 row still opens the job at its
   everyday stage (one target per row); story 9 reaches the quote's moment
   through Today (`dq-today-no-answer`) and the diary at that moment
   (`dq-diary-waiting` → `dq-job-sent`).
4. **Walk 12 M3:** the held-back Delete on `ac-privacy-requests` is still
   wired to the confirm, though a browser sends no click from it; the walk's
   route is `cs-privacy`'s enabled row, with a note naming Maya.
5. **Walk 2 M1's `mockup-gaps.md` line** (the phone menu drawn as Jo's) is a
   note on a mechanic's "Open menu" instead: `mockup-gaps.md` is written by
   `gaps.mjs` and lists only not-drawn pages and size gaps.
6. The build plan's "Where things stand (3 Oct)" totals were already out of
   date before this pass and are not changed here.

## Decision log

- 4 Oct: answer 2's "two answered situations" read as the 2 Oct "asked once"
  boards, `on-settings-start-answered` and `ws-start-products-answered`
  (walk 5 question 1, option 1: "drops the kept screen `on-settings-start` and
  both 'answered' situations").
- 4 Oct: `on-settings-show`'s "Change" stays drawn; with the box gone it opens
  website set-up step 3, where the question is now asked (the link the dropped
  `ws-start-products-answered` had).
- 4 Oct: walk 5 M3 needs nothing more: its boards are dropped by answer 2.
  Walk 12 M1 likewise: the "Settle up first" pop-up is dropped by answer 5, and
  the credit's wording is in walk 12 M3's line.
- 4 Oct: the mockup gains a shared "tried before a drawing's own file link"
  list (`links/shared.mjs` '^'): the name buttons link to Jo Taylor's Your
  settings file, so a label rule alone never reached them (walks 2 M1, 3 M1).
  The shared rules also get the control's tag, so the diary's "Today" button
  stays while the sidebar's "Today" link still opens Today (walk 2 L2).
- 4 Oct: the address link opens `wb-off-preview` on every Website page drawn
  with the website off (`ws-page`, `ws-page-moving`, `ws-page-switch-over`)
  and the customers' page on those drawn on (`ws-page-on`, `ws-page-changes`,
  `ws-no-settings`), read from each drawing's own words.
- 4 Oct: walk 4 L2's fix covers `wb-off-preview-product` through its kept
  screen's map; `wb-off-preview`'s "Edit this page" (the editor, later) now
  says "Not drawn yet" like "Review in the editor", found by the new
  "no button leads to a dropped or later screen" check.
- 4 Oct: walk 11 M1 is applied on every Messages board that has the three
  rows (`set-msg-list` and the journey 2, 4 and 7 boards), not only journey 8's.
- 4 Oct: walk 10 M1 gives each conversation row an optional "kind" in its
  screen-reader name, so Maya's job note and her account question are two
  buttons ("Needs a reply: Maya Patel" and "… · Question from her account").
- 4 Oct: walk 7 M3's two lines sit on `set-workshop-services` (the service
  box is its situation `ac-service-edit`; a line must sit on a kept screen),
  in `consolidate/j03.mjs` (Book a repair 3, 11), and are counted in the
  build plan beside that board in WP-5.1.
- 4 Oct: story 10's added steps reach `on-orders` on a phone through the
  menu (`doesAt: { phone: 'Online orders' }`), so no new size gap.
- 4 Oct: the "a Close button never stays" check counts "Close", "Close menu",
  "Close search" and "Close, …" only; "Close the day 1 hour before closing" is
  a setting, not a close button.

### Done (4 Oct)
- Every new check failed first for the reason it names: consolidate 1
  (17 tests, 1 failing: the four screens weren't dropped, the 14 lines
  missing); mockup 5 (12 tests, 5 failing: 7 unreachable screens, 3 buttons
  into the later editor, 2 "Close menu" staying, the walks' links still
  going where the walks found them, and the wording checks).
- `node build.mjs`: 210 files (was 211: `on-settings-start` gone; no board
  added), 181 notes (was 178), 201 kept screens, 1 removed.
- `node --test 'consolidate/*.test.mjs'`: 17 of 17, with
  `plan-coverage.test.mjs` (the plan's new DROPPED-coverage region, 117
  written lines).
- `node mockup/build-mockup.mjs`: 759 screens (was 763), 0 dead;
  `node --test 'mockup/*.test.mjs'`: 12 of 12.
- `node fitcheck-canvas.mjs`: 210 boards, 0 problems.
- `node mockup/gaps.mjs`: 95 not drawn (was 96: Maya's question settled by
  answer 3), 21 size gaps, 43 outside.
- `node docs/design/user-journeys/generator/coverage.mjs` from the repo root
  runs.

