# UX walk-through 4, second walk — a new shop, on the one canvas

Walked 3 Oct 2026 for issue #116 step 4, on the one canvas (`generator/out/project/`, https://claude.ai/artifact/WzmMdudJPoWH5aUd7J9V4j), with the script's three step-4 changes. The first walk was `../ux-walkthrough-4-new-shop.md` (2 Oct). Since then Jack has answered three of the issue's questions: **practice mode is dropped** (answer 4), **the website is a fixed design with editable text and photos, with the editor later** (answer 2), and **own web addresses are frozen and set up as a service** (answer 3). Answer 5 also puts off signed-in devices, alerts and the first sign-in note.

## The story

1. Jack Lewis (Owner) signs in, makes the front-desk computer Till B1 and opens Getting started on Today (B, 8).
2. They bring North Street Cycles' Citrus Lime files across and run alongside it with a weekly refresh and check (9).
3. They work through Getting started: card machine, staff (inviting Jo Taylor), services, quick buttons, float, messages, website (8).
4. They set up the website ready for switch-over morning (18).
5. Jo signs in for the first time, gets their till PIN and checks in at Till B1. On the first real day they count the float (B, 10).
6. Jack Lewis picks switch-over day; that morning the last refresh runs and the website goes on (9).

## Clicks and screens

| Person | Clicks | Boards | Real screens |
|---|---|---|---|
| Jack Lewis (desktop) | about 30, plus one per problem row, service and quick button, typing, and 2 a week while running alongside | 17 (`workos-signin`, `till-setup`, `fr-today`, five Settings boards, `set-staff-invite`, `mv-start`, `mv-weeks`, `mv-pick-day`, `ws-start-which`, `ws-start-look`, `ws-page`, `ws-pay-none`) | 10: sign-in, Set up this till, Today, Settings in three rooms, the move page, website steps 1–2, Website page |
| Jo Taylor (till, plus a phone or computer to sign in) | about 6, plus a password and 4 digits | 4: `workos-signin`, `pin-change` (first-time version is a line), `till-checkin`, `op-float-check` (first-real-day version is a line) | 4 |
| Saturday worker (till only) | about 2, plus 4 digits and a manager's clicks (not drawn) | 2–3: `till-checkin`, `pin-change` (till-only line), `op-float-check` if first in | 2–3 |

Clicks are worked out from the boards; nobody was timed. The move is now the right shape: 24 old boards are one page with 13 situation lines and three boxes.

## High

**H1 — The move's kept boards still show practice mode, so the switch-over checklist can never be completed.**
- *Screens:* `mv-change-day`, `mv-both`, `mv-weeks`, `mv-pick-day` (desktop); `mv-start`'s line "Switch-over morning: last refresh, go real, then turn the website on".
- *What happens:* the page still says "Every till is in practice · not real money · no float check or Close the day". The checklist has "Everyone has made a practice sale … Remind Alex" and "5 of 5". The pick-the-day box says "Practice sales are cleared, the tills take real money".
- *Why it matters:* the build follows the drawings. With no practice sales, that row never ticks, "Pick the day" never appears, and the shop can't switch over.
- *Fix, no choice:* remove the Tills and practice-sale rows ("4 of 4"). The morning reads "One last refresh · the tills take real money and messages start · your website goes on". Drop "go real" from the line.
- *Touches:* Moving 6 and 7 (3 Oct later change already says this).
- *8th question:* text on kept boards; no drawing.

**Second check:** CONFIRMED — `j09-mv-change-day`/`mv-both` still show "Every till is in practice · Until switch-over day · not real money · no float check or Close the day", `mv-weeks` has "Everyone has made a practice sale … Remind Alex" with "3 of 5", `mv-pick-day` "Practice sales are cleared…" (moving.mjs:203, 214), and the morning's step 2 is still "Clear and go real" (moving.mjs:225); Moving's 3 Oct later change (moving-from-citrus-lime-review.md:123) already removes all of this, so this is the step-3 redraw that didn't happen, not a reopened decision. High stands only because a builder following the boards would block the switch-over; the decision text itself is already right.

**H2 — With practice gone, nothing says what the till does while running alongside.**
- *Screens:* `fr-today`, `till-checkin`, `op-float-check` (desktop); `j08_later`, `jb_later`.
- *What happens:* Getting started says "Your till is ready, so you can sell now". Its moving version is on the later list. The decision says only "the tills are real from the switch-over date".
- *Why it matters:* Jo, invited during running alongside, checks in at Till B1 and can ring up a real sale that Citrus Lime never sees. The weekly check stops matching, and the money is split across two systems.
- *Fix:*
  1. **The tills wait for switch-over.** `till-checkin` gains "Sales start on switch-over day, [date] · keep using Citrus Lime until then". Check-in, search, customers and jobs still work, but Take payment is off. Getting started reads "Running alongside Citrus Lime: the tills start on switch-over day". Good: one rule, nothing counted twice. Costs: no practice at selling, which Jack accepted when dropping practice mode.
  2. **Real sales from day one, also keyed into Citrus Lime.** Nothing to draw, but every sale is entered twice and the weekly check can't match.

  Recommend 1.
- *Touches:* Moving 6 and 7, Owner setup 16.
- *8th question:* lines on `till-checkin`, `fr-today`, `mv-start` and `op-today`.

**Second check:** CONFIRMED — `fr-today` reads "Your till is ready, so you can sell now", `j08_later` holds the moving version of Getting started, and `jb_later`/`j10_later`/`j09_later` drop the practice-era till lines with nothing replacing them; Moving's later change says only that on switch-over day "the tills are real from the first sale" (the report's quote "real from the switch-over date" is a paraphrase, not the decision's words). Option 1 is a new rule, not in any decision, so it rightly needs Jack; it keeps Moving 6's intent (no real money in both systems) rather than reopening question 4.

**H3 — "The website is ready" can't be reached: nowhere is drawn to edit the fixed design's text and photos, or to check the starting wording.**
- *Screens:* `ws-page`, `mv-weeks` (desktop); `j18_later`.
- *What happens:* `ws-page` has "Edit website" and "2 pages still have starting wording: Collection and returns, Privacy". Both the editor and page editing are on the later list. The move's item ticks only once "its starting wording has been checked" (`moving.mjs` line 195). Getting started ticks the same item when "the three-step start is done".
- *Why it matters:* Jack Lewis can't add the shop's words or photos, or check the returns and privacy wording, so switch-over waits. Answer 2 promised editable text and photos, but no screen does it.
- *Fix:*
  1. **A "Words and photos" section on the Website page:** one row per fixed part (Headline, A line about the shop, Big photo, the workshop's words, the shop's own words and photo, Collection and returns, Privacy), each with Edit, opening a form box (building blocks 2 and 9). A starting-wording row says "Check this" until it's saved once. Good: no new drawing. Costs: words are edited in a list, not on the page.
  2. **One new drawing** of the fixed Home page with its text and photos editable in place. Easier to picture, but it's a new board and close to the editor that was put off.

  Recommend 1. Either way, both checklists tick the item on one rule.
- *Touches:* Website 1, 3 and 4 (3 Oct later change), Moving 7.
- *8th question:* option 1 is lines on `ws-page`. Option 2 adds a drawing only because no screen shows the page's own layout.

**Second check:** CONFIRMED — `ws-page`'s "Edit website" is a plain button with no target and the two starting-wording links are `#`; every editor and page-editing situation ("Editing Collection and returns: starting wording to check", "Pages: ready-made, two with wording to check") is on `j18_later`; moving.mjs:194–195 ticks the move's item only once "its starting wording has been checked" while `fr-today` step 9 ticks on "the website's three-step start is done". Option 2 adds a board where option 1's lines would do (issue #116's eighth question), which the report itself says.

## Medium

**M1 — `mv-start` (morning line), `mv-pick-day`, `ws-page`: the owner is still told to move their own web address.**
- *What happens:* the morning's step 3 says "if you use your own address, point [your address] to it — this can take up to a day" (`moving.mjs` line 226). The Web address row links to frozen screens.
- *Why it matters:* a shop coming from Citrus Lime with its own address finds nothing to press. Its customers keep reaching Citrus Lime's site for up to a day.
- *Fix, no choice:* the box and step 3 read "Using your own address? We move it for you that morning · up to a day · Ask us to help". The row reads "[shop-name].wheelhouseepos.com · want your own? We set it up for you".
- *Touches:* Website 7.
- *8th question:* lines.

**Second check:** CONFIRMED — moving.mjs:226 still says "if you use your own address, point [your address] to it — this can take up to a day" and Website's 3 Oct later change (website-management-review.md:210) makes own addresses a service; one correction: on the canvas the Web address row on `ws-page` links to `#`, not to the frozen screens (they are only lines on `j18_later`). The proposed wording is the walker's own suggestion, not drawn wording.

**M2 — Every hand-over in this story is a dead end on the canvas.**
- *What happens:* the only links between journeys are the sidebar's Diary and Overview, and Your settings. These have no link or `#`: Getting started's nine Start and Set up buttons, "Moving from another system?", the sidebar's Today, Moving, Website and Settings, "Open Website" on `mv-weeks`, and "Open Online orders settings" on `ws-page`. `till-checkin` links nowhere. Your settings' "Get your PIN" pointed at `pin-first`, which is now only a line. A script confirmed that no link points to a missing board.
- *Why it matters:* step 5's mockup can't be clicked from Today to Settings, the move or the website.
- *Fix, no choice:* wire each one to its board.
- *8th question:* links only.

**Second check:** CONFIRMED — `j08-fr-today` has only Diary, Overview, Your settings, Next › and two `#` links ("Sign out", "Moving from another system?"); its nine buttons and the Today, Website and Settings sidebar items have no target; `mv-weeks` "Open Website" and `ws-page` "Open Online orders settings" are `#`; `till-checkin` has only the canvas Prev/Next/Overview; app-map.mjs:178 still points "Get your PIN" at `pin-first`, which consolidate/jb.mjs:17 folds into `pin-change`. I re-ran the missing-target check on these boards: none missing. Medium is fair given step 5 is the clickable mockup; nothing is missing for the build itself, so Low would also be defensible.

**M3 — `till-checkin`, `pin-change`: Jo's first PIN when the front-desk computer is the till.**
- *What happens:* the till says "No PIN yet? Sign in to Wheelhouse on a phone or computer — it gives you one. No email? Ask the owner or a manager." Till B1 "stays signed in" as the till.
- *Why it matters:* Jo works at the front-desk desktop and is "not much about computers". If that desktop is the till, Jo must sign in on their own phone first, and nothing tells them before their shift.
- *Fix:*
  1. **The owner or a manager can give anyone their first PIN at the till**, the way they already do for till-only people. The till reads "No PIN yet? Sign in on your phone, or ask the owner or a manager to give you one here." No new screen, but someone senior must be there.
  2. **A line in the invite box:** "Ask them to sign in on their phone before their first shift." Free, but it depends on the message reaching them.

  Recommend 1.
- *Touches:* Signing in 6 (the PIN is still Wheelhouse-picked, not chosen at the till).
- *8th question:* lines.

**Second check:** CONFIRMED — `till-checkin` reads "No PIN yet? Sign in to Wheelhouse on a phone or computer — it gives you one. No email? Ask the owner or a manager.", `till-setup` says the till computer "stays signed in", and the give-at-the-till path is only for till-only people (`jb_sit_pin-change` line 3); personas.md has Jo on "a desktop at the front desk", "not much about computers". Option 1 stretches Signing in 6 ("so nobody else knows it") a little further than walk-through 4's H1 did — the screen is turned to the person, as now — so Jack should see that it touches it.

**M4 — `set-staff-person`, `pin-change`: a Saturday worker who forgets a till-only PIN with no manager in.**
- *What happens:* only the owner or a manager can clear a PIN and give a new one.
- *Why it matters:* the Saturday worker is in once a week and the likeliest to forget their PIN. On a Saturday with only Jo in, they serve under Jo's PIN, so the day's sales carry the wrong name.
- *Fix:*
  1. **A "Can give till PINs" switch** the owner turns on for a trusted person. One line, at a little cost in trust.
  2. **Give them an email sign-in**, so they get a new PIN on their phone. Nothing to build, but not everyone wants a work login.

  Recommend 1.
- *Touches:* Owner setup 8–11 (adds a switch).
- *8th question:* a line.

**Second check:** CONFIRMED — `j08_sit_set-staff-person` has "Clear a forgotten PIN — Manager" and Signing in 6 says a manager clears it; nothing covers a day with no manager in. "Serve under Jo's PIN" is the walker's guess at what would happen, not drawn; the personas file says the Saturday worker is in "a day or so a week". Option 1 adds a permission to the role set the build-plan questions treat as settled (Owner setup 8–11), so it needs Jack.

**M5 — `ws-history`, `ws-start-look`, `set-staff`, `set-staff-invite`, `set-staff-person`: kept boards still show what answers 2 and 5 put off.**
- *What happens:* History is drawn over the drag-and-drop editor ("Drag the dots", "+ Add section", a Theme tab, "3 online orders waiting"). Step 2 says "change anything later under Theme". Staff and roles shows "Signed-in devices" and "Alerts on Today". The person box shows "Sign out everywhere".
- *Why it matters:* building from the drawings would build what was put off.
- *Fix, no choice:* draw History over the Website page. Step 2 reads "on the Website page". Move the staff rows to the later list.
- *Touches:* Website 1, 3 and 4; Management oversight 2 and 3.
- *8th question:* text only.

**Second check:** CONFIRMED — `ws-history` still has "Drag the dots…", "+ Add section", a Sections/Theme panel and "3 online orders waiting"; `ws-start-look` says "You can change anything later under Theme"; `set-staff`, `set-staff-invite` and `set-staff-person` show "Signed-in devices" and "Alerts on Today", and `set-staff-person` "Sign out everywhere"; Oversight's 3 Oct later change (management-oversight-review.md:117) puts those later. Severity right.

## Low

**L1 — Words.** "Not sent — practice" (`mv-change-day`, `mv-both`) should be "Not sent — before switch-over". The "Later — not drawn here" lists mix dropped practice items with things coming later; mark the practice ones "Dropped". `ws-page` says "Settings › Online orders"; the path is Settings › Front desk › Online orders. Fix, no choice.

**Second check:** CONFIRMED — "Not sent — practice" is on `mv-change-day` and `mv-both`; `j09_later`, `jb_later` and `j10_later` list dropped practice items under "Later — not drawn here"; `ws-page`'s Taking payments row says "in Settings › Online orders" while the same board's bottom line says "Settings › Front desk › Online orders".

**L2 — Accessibility.** `pin-change`'s close is a link to Your settings ("Close without changing your PIN"), acting as a button. `till-checkin`'s shop name and "Checked in today" are 12px, the shop name at 80% opacity. Fix, no choice: make close a button, and use 13px or more at full colour.

**Second check:** CONFIRMED — `pin-change`'s close is `<a href="ja-your-settings-desktop.dc.html" aria-label="Close without changing your PIN">`; `till-checkin` has "Bolton · North Street Cycles" at 12px and opacity 0.8, and "Checked in today" at 12px. (On the canvas a link is how a board moves to the next one, so the build must make it a button; the finding still stands.)

**L3 — Edge cases still not drawn:**
- where "Fix" on an import row leads;
- where "Give [name] their PIN" sits in the Serving menu;
- whether "A file Wheelhouse couldn't read" covers a weekly refresh;
- if the first sign-in note returns for legal reasons (answer 5), it falls between WorkOS's page and "Your till PIN".

**Second check:** CONFIRMED — the 2 Oct as-built note (2026-10-02-ux-walkthrough.md, walk-through 4 "Not drawn") already lists "Fix" on the import and "Give [name] their PIN" in the Serving menu as not drawn; `j09_sit_mv-start` has "A file Wheelhouse couldn't read" with no refresh variant; Oversight's later change keeps the legal check on the first sign-in note.

## Earlier findings, checked

| 2 Oct id | Now |
|---|---|
| H1 first PIN | Fixed. The till line and invite wording are drawn; the first-time PIN and "No PIN yet" are lines. |
| H2 website during the move | Fixed ("The website is ready", on that morning). The address part has changed (M1). |
| H3 messages | Fixed as a line. The wording is out of date (L1). |
| M1 two checklists | Not fixed: the moving version of Getting started is on the later list. Now part of H2 and H3. |
| M2 no email; M3 invites; M7 asked once | Fixed as situation lines. |
| M4 practice float | Gone with practice. The first real day's count is a line. |
| M5 refresh remembers; M6 photo and price counts | Fixed, drawn. |
| L1 words; L3 named buttons | Fixed (phone stage words not checked). |
| L2 orders link | Moot, but still drawn on `ws-history` (M5). |
| L4 edge cases | "Remind Alex" goes with H1; the rest are in L3. |

## Access and the Saturday worker

Screen reader and keyboard: the stages say their state in words, the checklist is a status, Getting started's buttons are named, and the switches and colour radio buttons are labelled. Not checked: focus order, typing a PIN on a keyboard, and focus after "Send the invite". Low vision: L2; zoom and reflow weren't checked (fixed frames). Saturday worker: the till-only path works for a first day, and front-desk tasks need no owner access; M4 covers a forgotten PIN.

## Summary

| Id | One line | Needs Jack |
|---|---|---|
| H1 | Practice mode still drawn; the checklist can't complete | No |
| H2 | The till while running alongside is undefined | Yes |
| H3 | Nowhere to edit the website's words and photos | Yes |
| M1 | Own address on switch-over morning is now a service | No |
| M2 | Every hand-over is a dead link | No |
| M3 | First PIN when the front desk is the till | Yes |
| M4 | Forgotten till-only PIN, no manager in | Yes |
| M5 | Put-off features still drawn | No |
| L1–L3 | Words, accessibility, edge cases | No |

**Choices for Jack**
1. H2: the tills while running alongside. Recommend 1: they wait for switch-over day; staff can still check in and look around.
2. H3: where the website's words and photos are edited. Recommend 1: a "Words and photos" list on the Website page.
3. M3: Jo's first PIN. Recommend 1: the owner or a manager can give anyone their first PIN at the till.
4. M4: a forgotten till-only PIN. Recommend 1: a "Can give till PINs" switch.

## Verification

- **Read as text and links** (not seen rendered), at desktop: the five `j09` boards; `j08-fr-today`, `set-staff`, `set-staff-invite`, `set-staff-person`, `set-pay-ways`; all nine `jb` boards; the seven `j18` boards; three `j10` boards.
- **Read in `canvas.json`:** the situation and later notes for A, B, 8, 9, 10 and 18.
- **Checked by script:** every link target on these boards is on the canvas.
- **Code read:** `consolidate/j09.mjs` and `j18.mjs`; `moving.mjs` lines 98–264; parts of `signin.mjs`, `setup.mjs` and `app-map.mjs`.
- **Decisions read:** Moving, Owner setup, Signing in and Website management (later changes); the 2 Oct walk-through decision; the 3 Oct build-plan questions; Management oversight's question 5 note; the issue #116 answers; `personas.md`; the script; the README's drawing rules.
- **Not checked:** tablet and phone (on the old canvases), WorkOS's pages, a real screen reader, keyboard or zoom, and the `set-shop-details`, `set-workshop-services`, `set-till-quick`, `set-eod` and `set-msg-list` boards beyond their notes.

## Second check

Checked 3 Oct 2026 by a second reviewer who did not write the report, against the board `.dc.html` files and `canvas.json` notes in `generator/out/project/`, `moving.mjs`, `app-map.mjs`, `consolidate/jb.mjs`, the Moving, Website, Oversight, Owner setup and Signing in decision files, the 2 Oct walk-through decision, `personas.md` and the script.

**Counts:** 11 findings checked — 11 confirmed, 0 refuted, 0 uncertain. No severity changes; M2 could fairly be Low, because only the clickable mockup (step 5) is affected, not what gets built.

**Reopened decisions:** none reopened without saying so. H1, M1 and M5 apply 3 Oct later changes that the step-3 redraw didn't carry onto the boards. H2 option 1 and M4 option 1 add new rules, and M3 option 1 stretches Signing in 6. All three are listed as Jack's choices.

**Drawings vs lines (eighth question):** only H3 option 2 adds a drawing, and the report says so. Every other fix is lines, text or links.

**Missed by the walker (second reviewer's own):**
- The Clicks and screens table says Jack Lewis sees 17 boards, but the list beside it names 16 (3 sign-in and Today, 5 Settings, `set-staff-invite`, 3 move, 4 website).
- H2 puts "the tills are real from the switch-over date" in quotes as the decision's words. The decision actually says "on the switch-over day the tills are real from the first sale" (moving-from-citrus-lime-review.md:123).
- M2 leaves out `ws-page`'s "Edit website" button, which has no target either (it belongs with H3's fix).
- The morning's step 2 is still "Clear practice sales and make the tills real" with a "Clear and go real" button, and its confirm box is still "Clear practice sales and go real?" (moving.mjs:225–231). Both are only lines on `mv-start`, but H1's fix should name them so the line text gets rewritten too.
