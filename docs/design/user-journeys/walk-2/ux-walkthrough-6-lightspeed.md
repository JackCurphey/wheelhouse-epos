# UX walk-through 6, second walk: a repair at a Lightspeed shop

Walked 3 Oct 2026 on the one canvas (issue #116 step 4), following `ux-walkthrough-script.md` with step 4's three changes. The first walk was `../ux-walkthrough-6-lightspeed.md` (2 Oct). Journey 21 comes **after the trading week** (build-plan question 5), so nothing here is for Release 2's build order. I couldn't see the canvas rendered. I read `out/project/canvas.json`, the board HTML, and, where a state is only a line in a situation list, the old drawing's output in `generator/out-*-sand/` (built 3 Oct 16:43 from the current code). Findings that rest on a line and not a drawing say so.

## The story

1. Maya Patel books a Standard service for her Trek Domane AL 3 at North Street Cycles, Bolton, on her phone. There's no deposit, because Lightspeed shops take none (Lightspeed shops 9).
2. Jo Taylor accepts the request and books the bike in. If Wheelhouse isn't sure which Lightspeed customer Maya is, Jo asks her at the desk.
3. Alex Morgan quotes from Lightspeed's products. Maya approves £111.00 for WH-1042 on her phone, and Wheelhouse makes the work order.
4. Alex does the work and presses "Mark ready for collection". Maya's page reads "Pay when you collect · Agreed price £111.00 — pay at the till".
5. Jo takes payment at the Lightspeed till. Wheelhouse sees it paid, and Jo presses "Hand over".
6. Jack Lewis does nothing on a good day. On a bad day the lines on Today are his, and so is "Mark it sorted…".

## Per person: clicks and different screens

Main path: one shop, payment checking working, nothing going wrong.

| Person | Clicks | Different screens (boards) |
|---|---|---|
| Maya (phone) | about 10 taps, 6 fields | 9: `wb-home`, `bk-service`, `bk-bike`, `bk-when`, `bk-details`, `bk-request`, `bk-page`, `dq-quote`, `cp-summary`. Her three Lightspeed pages are now lines on `bk-page`, `dq-quote` and `cp-summary`, and there is one ready page, not two (the first walk's H1) |
| Jo (desktop) | about 8–10, plus Lightspeed's own till | 5: `diary`, `request-new`, `op-today`, `job-overview` (book in), `ls-job-sent`. 6 if the payment hasn't shown yet (`ls-hand-over-unpaid`) |
| Alex (tablet and shared desktop) | about 25, most of them the checklist | 5: `diary`, `job-overview`, `ls-part-search`, `job-checklist`, `ls-job-sent`. The last three exist only at desktop size (M5) |
| Jack (desktop) | 0. On a bad day, 4 | 0. On a bad day, 3: `op-today`, `ls-job-sent`, `ls-job-sorted` |
| Saturday worker (front desk) | 1–3 | 2: `ls-job-sent`, plus `ls-hand-over-unpaid` or the no-work-order box (a line on `ls-job-check`) |

Journey 21 is down from 38 screens to 8 boards, and those cover the whole story.

## Medium

**M1 — Following the links, every hand-over in this story is a dead end.**
- **Screens:** `bk-page`, `dq-quote`, `cp-summary` (phone), and all 8 `ls-*` boards, `diary`, `job-overview`, `op-today` (desktop).
- **What happens:** the only links between Maya's pages are the canvas's own Prev/Next row. `bk-page` has no link to `dq-quote`, and `dq-quote` has none to `cp-summary`. No board on the canvas links to a journey-21 board, except `Main`. On the journey-21 boards, every job card in the diary opens `j12-job-overview`, which is a normal shop's job page. "Today", "Customers" and "Messages" in the sidebar are `<a>` tags with no `href`, on every staff board I opened, even though `op-today` and `cs-list` are on the canvas. "Book in", "Approve £111.00", "Mark ready for collection", "Hand over" and "Choose the customer" are buttons that lead nowhere. Maya's Lightspeed pages are lines, not boards, so nothing can link to them.
- **Why it matters:** you can't click through this story on the canvas at all. Jo can't get from the job to Today's Lightspeed lines.
- **Fix, no choice:** step 5's clickable mockup covers it. The Lightspeed lines become addresses on the same page, for example `cp-summary.html?state=lightspeed`. The sidebar links point at their boards. Job cards on Lightspeed boards open `ls-job-sent`. The dead-link check fails the build on any of the above.
- **8th question:** this needs links, not drawings.
- **Second check:** CONFIRMED — on `out/project`, only `Main.dc.html` links to any `j21-*` board; on `j21-ls-job-sent-desktop.dc.html` every job card's href is `j12-job-overview-desktop.dc.html` and Today, Customers and Messages are `<a>` with no href (same on `j12-job-overview` and `j10-op-today`); `j03-bk-page-phone` links only to `bk-change`/`bk-request`, `j04-dq-quote-phone` only to `dq-record-answer`; "Approve £111.00", "Choose the customer", "Mark ready for collection" and "Hand over" are `<button>`s. The fix matches issue #116 step 5 ("A dead link is a bug"). One link does cross: the Maya Patel name on the ls boards opens `j15-cs-page-desktop`.

**M2 — "Ready, but not in Lightspeed yet" is written for only one of its three causes.**
- **Screens:** `ls-job-sent` (its line "Ready, but not in Lightspeed yet"), and `ls-job-check` (its line "Hand over with no work order"). Desktop.
- **What happens:** the old drawing's strip reads "Can't reach Lightspeed since [time] · it sends by itself when Lightspeed answers". The box reads "Wheelhouse can't reach Lightspeed since [time]". The other two causes are a customer still to choose (Jo pressed "Not now" at book in) and a send nobody has checked. Both exist only as a code comment (`lightspeed.mjs`, the `readyNoWo` note). Neither is in any situation list.
- **Why it matters:** Maya is at the counter. If the real cause is the customer choice, Jo is told the wrong reason and picks "Maya pays later". Wheelhouse then waits for a person who isn't coming, and the work order is never made.
- **Fix, no choice:** add two lines to `ls-job-sent`'s list: "Ready, Maya still to choose: the strip keeps Choose the customer" and "Ready, not sure it arrived: the strip keeps Check this in Lightspeed". Add one line to `ls-job-check`'s list: "The box's first sentence follows the cause". This is the same pattern decision 10 (H2) used for the unpaid box. Touches Lightspeed shops 6 and 10 (H2, H3). Neither is reopened.
- **8th question:** lines only. The layout doesn't change.
- **Second check:** CONFIRMED — `j21_sit_ls-job-sent` has only "Ready, but not in Lightspeed yet" and `j21_sit_ls-job-check` only "Hand over with no work order: pays later, or rung up by hand"; `lightspeed.mjs:107-112` draws the out-of-reach cause and names the pick and unsure causes only in the comment, and the box (`lightspeed.mjs:183`) says "Wheelhouse can't reach Lightspeed since [time]". The fix carries out the first walk's H2 option 1 ("the strip keeps the button for its cause"), which was taken (walk-through decisions, 2 Oct, walk-through 6), so it reopens nothing.

**M3 — "Rung up by hand" means two different things in two boxes.**
- **Screens:** the no-work-order box (a line on `ls-job-check`, old drawing `ls-hand-over-no-wo`), and `ls-job-sorted`. Desktop.
- **What happens:** the no-work-order box offers "Rung up in Lightspeed by hand — link it", with a field labelled "Work order number in Lightspeed". The field's hint says "The number on the sale you rang up for WH-1042". `ls-job-sorted` treats "rung up as a plain sale" as "Paid in Lightspeed another way", and clears it. Only owners and managers can do that.
- **Why it matters:** a Saturday worker who rang it up as a sale doesn't know whether to type the sale's number into a work-order box or wait for a manager. A sale's number isn't a work order, so whether Wheelhouse can check it is unverified.
- **Fix:**
  1. "By hand" means making the work order in Lightspeed. The hint reads "Make a work order for WH-1042 in Lightspeed, take payment against it, and type its number". Payment is then checked as usual. Good for: one route, no manager needed. Cost: a few more steps in Lightspeed for the person at the counter.
  2. "By hand" means a plain sale. Drop the number box. The choice reads "Rung up as a plain sale", and it hands the bike over and asks a manager to mark it sorted. Good for: the quickest thing at the counter. Cost: every one of these needs a manager afterwards, and the job stays marked until then.

  Recommend 1. Touches Lightspeed shops 6 and 10 (H2), as built from the first walk's H2 and M5.
- **8th question:** wording on existing lines.
- **Second check:** CONFIRMED — `lightspeed.mjs:183` labels the field "Work order number in Lightspeed" with the hint "The number on the sale you rang up for WH-1042", and `lightspeed.mjs:186` lists "Paid in Lightspeed another way · For example, rung up as a plain sale". Not said in the finding: option 2 reopens a recorded decision. The first walk's H2 option 1, which was taken, has "Rung up in Lightspeed by hand" show the "Work order number in Lightspeed" box and link that work order so no second one is sent (`../ux-walkthrough-6-lightspeed.md:52`). Option 1 is the reading that decision already chose, and the first walk's M5 (line 78) sends plain sales to "Mark it sorted…". So this could be "Fix, no choice" (option 1, a hint wording fix), with option 2 only if Jack wants to reopen H2.

**M4 — Nothing on the canvas says journey 21 comes after the trading week.**
- **Screens:** the `j21_title` note, and the Lightspeed lines on `bk-page`, `bk-cancel`, `dq-quote` (3 lines), `cp-summary` (3 lines), `op-today` (5 lines), `set-msg-list`, `set-workshop-services`, `cs-page` and `ops-log`.
- **What happens:** the title says "21 · Lightspeed shops (Release 1)". There is no `j21_later` note. The Lightspeed lines sit inside the situation lists of screens that Release 2 builds, and nothing on them says they wait.
- **Why it matters:** the builder may "build exactly what the drawings show". That means either building Lightspeed versions early, against question 5, or guessing which lines to skip.
- **Fix:**
  1. Tag every Lightspeed line "after the trading week (Q5)", and retitle journey 21 to match. The lines stay beside the screens they change. Good for: when Lightspeed is built, the lines are already in place. Cost: about 20 lines to edit.
  2. Move them all to a `j21_later` note. Good for: cleaner lists for Release 2. Cost: the lines lose their screens, and someone has to put them back later.

  Recommend 1. Touches build-plan question 5. It isn't reopened.
- **8th question:** lines only.
- **Second check:** CONFIRMED — `canvas.json` note `j21_title` reads "21 · Lightspeed shops (Release 1) — Owner, Manager and Staff", there is no `j21_later` note, and the Lightspeed lines on `bk-page` (1), `bk-cancel` (1), `dq-quote` (3), `cp-summary` (3), `op-today` (5), `set-msg-list`, `set-workshop-services`, `cs-page` and `ops-log` (1 each) carry no "later" mark, while Q5 (`2026-10-03-build-plan-questions.md:58-61`, answered at line 113) and the build plan's "After the trading week" list put journey 21 later. Not said in the finding: option 2 goes against the one-canvas spec's decision log, "Journey 21 … is consolidated like the rest and stays on the canvas" (`docs/superpowers/specs/2026-10-03-one-canvas.md:68`), so option 1 fits what was planned.

**M5 — Alex's tablet: journey 21's other sizes are neither drawn nor written down.**
- **Screens:** all 8 `ls-*` boards (desktop only).
- **What happens:** decision 13's rules for other sizes aren't on the one canvas: on a phone the strip goes at the top with a full-width button, boxes fill the screen, and part-search rows put the name on its own line. Each board's "Tablet and phone ↗" link goes to the old journey-21 canvas (`2qnzyGx8enhxbVN17Brpnf`), which is off the one canvas. The job page has tablet and phone boards (`job-overview`), but the Lightspeed strip isn't on them.
- **Why it matters:** Alex's check is to walk every step on a tablet. Here I could only do that from the old canvas.
- **Fix, no choice:** add one note under journey 21 with decision 13's size rules (drawing rule 3), and point "Tablet and phone" at `job-overview`'s tablet board. Touches Lightspeed shops 13.
- **8th question:** a written rule, not drawings.
- **Second check:** CONFIRMED — no note in `canvas.json` gives decision 13's size rules (no "icon rail", "full width" or "fill the screen" anywhere), and every `j21-*` board's "Tablet and phone ↗" goes to `https://claude.ai/artifact/2qnzyGx8enhxbVN17Brpnf`. Severity should be Low, not Medium: decision 13 says the tablet "keeps the desktop layout" and `consolidation-12-21.md:102` says journey 21 needs no tablet drawing, so Alex's tablet screen is the desktop board, and what's missing is the written rule (drawing rule 3), not a screen the story needs.

## Low

- **L1 — `cp-summary`'s list has the Lightspeed ready page twice:** "A Lightspeed shop: the agreed price, pay at the till", and "Maya's job page at Ready: agreed price, pay at the till — from journey 21". Fix, no choice: remove the second line. *8th:* one line fewer.
  **Second check:** CONFIRMED — `j05_sit_cp-summary` has both "A Lightspeed shop: the agreed price, pay at the till" and "Maya's job page at Ready: agreed price, pay at the till — Customer · from journey 21 · Walk-through 6 H1" (the second comes from `consolidate/j21.mjs`, `ls-customer-ready` into `cp-summary`).
- **L2 — The kept `ls-customer-pick` board shows the less common moment.** It draws the choice made at approval ("WH-1042 is ready to go to Lightspeed", "Link and send"). The moment that was agreed as built, at book in with Maya at the desk ("Link and book in"), is only a line. Fix, no choice: swap them, so the book-in version is the board and approval time is the line. *8th:* a swap, with no new drawing.
  **Second check:** CONFIRMED — `lightspeed.mjs:225` draws `ls-customer-pick` with `customerPick()` ("WH-1042 is ready to go to Lightspeed", "Link and send"), and the board HTML has both; the book-in box (`bookInPick()`, "Link and book in", line 167) is only the line `j21_sit_ls-customer-pick`. In the old drawing the book-in box sits over Today (`lightspeed.mjs:215`), not over the job, so the swap also changes the page behind it.
- **L3 — When Maya says no to the new price, the staff side isn't listed.** "Maya said no to £[£]" is only a code comment. While her answer is awaited (the line "Waiting for Maya's answer on the new price"), the footer still offers "Mark ready for collection", and nothing says which price a ready bike carries. Fix, no choice: add a line "Maya said no: back to Keep £28.00 / Ask Maya again, saying so", and add "the work order keeps £28.00 if it's marked ready" to the waiting line. That follows decision 12 (the approved price wins). *8th:* lines.
  **Second check:** CONFIRMED — the "Maya said no to £[£]" state is only the comment at `lightspeed.mjs:100-101`, and `priceAsked` uses `readyFooter` ("Mark ready for collection", line 131). Partly covered already: the waiting strip says "The work order keeps £28.00 until she answers" (line 102), so the second half of the fix only needs to say that holds once the bike is marked ready.
- **L4 — The website header without a Basket isn't recorded where builders look.** The rule from decision 10 (H1) shows only on the three Lightspeed pages. `bk-service` to `bk-request` all show "Basket, 0 items", and `ja-site`'s list has no Lightspeed line. Fix, no choice: add one line to `ja-site`: "A Lightspeed shop: no Shop or Basket in the header". *8th:* a line.
  **Second check:** CONFIRMED — `wb-home`, `bk-service`, `bk-bike`, `bk-when`, `bk-details`, `bk-request` (and `bk-page`, `dq-quote`, `cp-summary`) boards all contain "Basket, 0 items", and `ja_sit_site` has one line ("Customer website: phone menu open"). Small correction: of the Lightspeed lines, only `dq-quote`'s ("no deposit, no Basket") states the rule; the `bk-page` and `cp-summary` lines don't mention the header.
- **L5 — The job page's own list (`job-overview`, 22 lines) never mentions Lightspeed.** Drawing rule 5 says other journeys add their line to it. Fix, no choice: add "At a Lightspeed shop: the Lightspeed strip under the header (`ls-job-sent`), Hand over in place of Take payment, and the header tag reads Agreed". *8th:* a line.
  **Second check:** CONFIRMED — `j12_sit_job-overview` has 22 lines and none mentions Lightspeed; drawing rule 5 (`README.md`, "Other journeys link to them and add a line to their situation list") asks for one.
- **L6 — Changing the Lightspeed link doesn't say what happens to the open work order.** `cs-page` has the line, and the old drawing's "Change" opens the picker. Nothing says what happens to WH-1042's unpaid work order (the first walk's M3, partly done). Fix, no choice: add a line on `ls-customer-pick`: "Changing it: the unpaid work order moves, or is cancelled and made again if Lightspeed can't move it; paid ones stay". Whether Lightspeed can move it is unverified. Touches Lightspeed shops 3 and 4. *8th:* a line.
  **Second check:** CONFIRMED — `customer.mjs:100-102` draws "In Lightspeed: Maya Patel" with Change opening the picker, and no generator file or note has the work-order line (searched "unpaid work order"). That line was part of the first walk's M3 fix, which was taken (`../ux-walkthrough-6-lightspeed.md:74`), so this finishes an approved fix rather than adding one.
- **L7 — Edge cases at the joins that still aren't listed.**
  - Alex is still the example person who "doesn't use Lightspeed".
  - The job strip when Lightspeed signs Wheelhouse out.
  - A refund at the Lightspeed till.
  - Two Lightspeed shops.
  - After "Maya pays later", nothing tells Maya she still owes £111.00.
  - A by-hand number typed while Wheelhouse can't reach Lightspeed can't be checked until it answers.

  Fix, no choice: one line each, where they're decided. *8th:* lines.
  **Second check:** CONFIRMED, with one part already covered — Alex is the example (`lightspeed.mjs:76`, "Alex doesn't use Lightspeed"); the sign-out banner is only on Settings (line 81, `j21_sit_ls-settings-on`), not in `ls-job-sent`'s list; nothing lists a Lightspeed refund or a "still owes" message after "Maya pays later"; and the by-hand box only appears when Lightspeed can't be reached (line 183), so its number can't be checked then. "Two Lightspeed shops" is partly covered: `j21_sit_ls-connect-signin` has "Two shops: which Lightspeed shop is which"; what isn't listed is the job side at two shops.

## Accessibility, and the Saturday worker

- **Screen reader and keyboard:** strips are `role="status"`; "Why?" is now a button (first walk's L3 fixed); strip buttons name the job; pickers are radio groups with nothing chosen and the main button unavailable ("Choose one", "Choose why"). Not checked: focus order, and focus after a trip to the Lightspeed till.
- **Low vision:** the work order number is now in the strip's bold line (the first walk's M2 is fixed), and badges carry words as well as colour. Not checked: zoom and reflow, because the boards are fixed frames.
- **Saturday worker:** the hand-over boxes explain themselves. M3 is where they would stall. "Mark it sorted…" correctly says "Owners and managers only".

## Earlier findings (2 Oct)

| Earlier | Now |
|---|---|
| H1 Maya's pages not drawn for a Lightspeed shop | Fixed. They are lines on `bk-page`, `bk-cancel`, `dq-quote`, `cp-summary`, with one ready page. The header rule is only partly recorded (L4), and there's a duplicate line (L1) |
| H2 No work order at the counter | Fixed for "can't reach". Other causes M2, wording M3 |
| M1 Look-up at book in, Staff's Today | Fixed (lines on `ls-customer-pick` and `op-today`). The board shows the other moment (L2) |
| M2 How the till finds WH-1042 | Fixed: the work order is in the bold line, "Linked to [Lightspeed customer]", and "give your name or job number WH-1042" |
| M3 A wrong link can't be undone | Mostly fixed (`cs-page` line). What happens to the open work order is L6 |
| M4 Price went up | Fixed for Maya. The staff "no" and the ready footer are L3 |
| M5 Can't clear a bike handed over unpaid | Fixed (`ls-job-sorted`) |
| M6 Messages state the amount | Fixed (`set-msg-list` line; `setup.mjs` wording) |
| L1–L5 | Fixed ("Agreed £111.00" tag, "Opens the till with this job's lines", "Why?" button, partial-match rows, WH-1042 out of "Still to arrive") |
| L6 edge cases | Still open (L7) |

## The end table

| Id | Screens | One line | Jack chooses? |
|---|---|---|---|
| M1 | Maya's pages, `ls-*`, sidebar | No links across the joins, and sidebar links have no destination | No |
| M2 | `ls-job-sent`, `ls-job-check` | Ready with no work order is written for one cause only | No |
| M3 | `ls-job-check`, `ls-job-sorted` | "Rung up by hand": a work order or a sale? | Yes |
| M4 | `j21_title`, Lightspeed lines | Not marked as after the trading week | Yes |
| M5 | `ls-*` | Tablet and phone rules not on the one canvas | No |
| L1 | `cp-summary` | Ready page listed twice | No |
| L2 | `ls-customer-pick` | Board shows approval time, not book in | No |
| L3 | `ls-job-sent` | Maya's no, and ready while waiting | No |
| L4 | `ja-site`, `bk-*` | No-Basket header rule not recorded | No |
| L5 | `job-overview` | Job page list has no Lightspeed line | No |
| L6 | `ls-customer-pick` | Changing the link: the open work order | No |
| L7 | — | Edge cases not listed | No |

## Choices for Jack

1. **"Rung up by hand" (M3).** Recommend 1: it means making a work order in Lightspeed and typing its number, so payment is checked as usual.
2. **Marking journey 21 as later (M4).** Recommend 1: tag each Lightspeed line "after the trading week" where it sits, and retitle journey 21.

## Verification

- **Boards read (HTML):** Maya's `wb-home`, the nine `bk-*`, `dq-quote`, `cp-summary`, `cp-pay`, `j05-ready` (a picture, not readable); staff `op-today`, all `j12-*`, `cs-page`, the eight `ls-*`. Every `href` on them listed.
- **Old drawings (for lines):** `bk-page-ls`, `bk-cancel-ls`, `dq-quote-ls`, `cp-summary-ls(-paid)`, `ls-book-in`, `op-today-staff-lightspeed`, `ls-hand-over-no-wo`, `ls-job-ready-no-wo`, `ls-job-price-asked`. Code: `lightspeed.mjs`, `customer.mjs`, `setup.mjs`, `quote.mjs`, `consolidate/j03–j05, j12, j15, j21`; situation notes for journeys 1, 3–5, 7, 8, 10, 12, 15, 20, 21, A, B.
- **Decisions:** Lightspeed shops and the build-plan questions in full; walk-through decisions 5–6; Later-change notes of Book a repair, Drop off and approve, Collect and pay (none from issue #116 touches journey 21).
- **Not checked:** Lightspeed's real behaviour (no test account), its till, `j05-ready`'s picture, the shared-computer bar (story 8), a real screen reader, focus and zoom. Clicks worked out, not timed.

## Second check

Done 3 Oct 2026 by a second reviewer who didn't write the report. Read: this report, the first walk, `ux-walkthrough-script.md`, `personas.md`, Lightspeed shops decisions 1–13, build-plan question 5, the walk-through decisions (walk-through 6, as built), drawing rules 1–6 in `README.md`, the one-canvas spec's decision log, `out/project/canvas.json` notes, the `j21-*`, `j03`/`j04`/`j05` customer, `j10-op-today`, `j12-job-overview` and `j15-cs-page` boards' links, and `lightspeed.mjs`, `customer.mjs`, `collect.mjs`, `setup.mjs`, `consolidate/j21.mjs`.

- **Counts:** 12 findings. 12 confirmed, 0 refuted, 0 uncertain. Two are partly covered already (L3: the waiting strip says the work order keeps £28.00; L7: two shops at connection).
- **Severity:** M5 should be Low. Decision 13 says the tablet keeps the desktop layout, so no screen is missing, only the written rule. The rest stand.
- **Recorded decisions:** M3's option 2 reopens the first walk's H2 option 1 (taken). M4's option 2 goes against the one-canvas spec's decision log (journey 21 "stays on the canvas"), which isn't a Jack decision file. Neither finding said so. No other finding reopens anything.
- **8th question:** no fix adds a drawing. L2 swaps which state is drawn, and its book-in box sits over Today, not the job.
- **Invented data or wording:** none found. Every quoted wording I checked is in the generator or the boards. The suggested new wording (M2, M3, L3–L6) is marked as a fix, and it uses the drawings' example data and bracketed placeholders.
- **Missed by the walker (mine):** the Lightspeed lines on `cp-summary` and `bk-page` don't mention the header, so the no-Basket rule sits on only one line (`dq-quote`), not three (L4). Also, the box for a bike with no work order picks "Maya pays later" to start (`lightspeed.mjs:183`), so if the cause is really a customer still to choose (M2), the wrong option is already picked before Jo reads anything. That makes M2's first-sentence fix more urgent.

