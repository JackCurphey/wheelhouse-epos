# UX walk-through 8, second walk: the workshop on a shared computer, and several mechanics at once

Walked 3 Oct 2026 on the one canvas (issue #116 step 4), with `ux-walkthrough-script.md` and step 4's three changes (the eighth question, screens counted, joins followed by their links). I read the boards' text, buttons and links in `generator/out/project/`, not the boards rendered. The first walk is `../ux-walkthrough-8-shared-workshop.md`; Jack's answers are `docs/decisions/2026-10-03-ux-walkthrough-8.md`.

## The story

Thursday 17 September, North Street Cycles, Bolton. Jo Taylor (Staff, works in the workshop) books Maya Patel's Trek Domane AL 3 in: WH-1042, Hook 3. Alex Morgan (Mechanic) works it on the shared workshop desktop, fits the Shimano brake pads B05S-RX and presses "Mark ready for collection" (£111.00). Jo takes the same computer for WH-1068, then Alex takes it back. Other days they each have a tablet and work at once, with WH-1046 in "No time" for whoever is free. On Saturday the Saturday worker, at the till, hands WH-1042 over.

## Clicks and screens, per person

From the boards. "As decided" is what Jack's 3 Oct answers would give once on the canvas.

| Person, device | As drawn: clicks | As drawn: different screens | As decided: clicks | As decided: screens |
|---|---|---|---|---|
| Alex, shared desktop, two hand-overs | ~26 + 3 email-and-password sign-ins | 5: workos-signin, auth-signedout, diary, job-overview, job-checklist | ~22 + 2 PINs | 4 (PIN screen for the two sign-in screens) |
| Alex, own tablet | ~22 + 1 sign-in | 4 | same | same |
| Jo, front desk then shared desktop | ~12 + 1 sign-in | 6: overview, job-overview, diary, dq-record-answer, auth-signedout, workos-signin | ~9 + 1 PIN | 5 |
| Saturday worker, emailed | ~4 + PIN (the till's Diary link goes nowhere) | 4: till-checkin, till-sale, diary, job-overview | 2 + PIN | 2: till-checkin, till-search |
| Saturday worker, till only | no drawn way | 2, then stuck | 2 + PIN | 2 |

The mechanic's ~20 clicks on the job are the first walk's estimate, not recounted.

## High

**H1. `diary`, `job-overview`, `job-checklist`, `till-checkin`, `till-setup`, `your-settings`, `pin-change` (desktop and tablet): none of walk-through 8's decisions are on the one canvas, so a shared computer still changes hands by email and password.**
- *What happens:* a search of every board and generator file for "Working:", "workshop computer", "has this job open", "I'll do this", "Who did what", "Use my phone", "Keep mine" and "Signed off by" finds none of them. The decisions say "The drawings … are not changed yet", and step 3's merge plans didn't add them. A swap is still Sign out (link `#`), `auth-signedout`, `workos-signin`: 4–6 clicks plus email and password. `diary` shows "Everyone · Alex · Jo", no "Me"; the till rail says "Sign out", not "Check out".
- *Why it matters:* built from the canvas, every part, tick and "marked it ready" goes under whoever last signed in. Alex's check ("clear whose name the work is recorded under?") fails.
- *Fix, no choice (Jack has chosen; this is where it goes).* Lines, not boards:
  1. `till-setup`: "Make this computer a workshop computer" (decision 1).
  2. `till-checkin`: "Workshop computer: your PIN puts your name on the work"; "Idle 10 minutes: back to Enter your PIN, nothing lost" (decision 3, Q6); "'Now working: Jo Taylor' is announced"; "Digits can be typed".
  3. `diary`, `job-overview`: "'Working: Alex Morgan · Switch' bar, also in the job's header" (decision 4, block 26); "Nobody working: opens on Everyone"; "'Me' for anyone who works in the workshop".
  4. `job-overview`: "Who did what, folded"; "Mark ready records 'Signed off by Alex Morgan · 15:30'" (decision 7, Q3); "Desktop Add photo: Choose a file or Use my phone" (decision 6).
  5. `your-settings`: "Follow the PIN person"; `pin-change`: "Not on a workshop computer"; `staff-app`: "Owner and manager pages only after an Owner or Manager PIN" (decision 3).
  6. `till-rail`: "'Jo Taylor · Staff · Check out'".
- *8th question:* all lines. The bar is the only visible change, one strip; show it once on the existing `job-checklist` board (already the Mechanic's view) so the mockup has an example. No new drawing.
- *Decision it touches:* walk-through 8 decisions 1, 3, 4, 6, 7 and fixes M2, M3, M6; build-plan Q3, Q6; Signing in 4, 6–8; Workshop day 13, 64.

**Second check:** CONFIRMED — none of the eight phrases is in any generator `.mjs`, `consolidate/*.mjs` or `out/project` file (the only "Check out" hits are oversight's "Check out Jo Taylor"); `j12-diary-desktop` reads "Everyone · A Alex · J Jo" with no "Me"; `ja-till-rail-desktop`'s foot is "Jo Taylor · Staff · Sign out" (`href="#"`); decision file line 71 says the drawings are not changed; severity right. Two notes: build plan WP-W.6 (`2026-10-03-release-2-build-plan.md` lines 124–127) already schedules drawing these decisions, so this finding is a known gap whose value is the where-it-goes list; and the lines "'Now working: Jo Taylor' is announced" and "Digits can be typed" come from the first walk's "not checked" (first report line 160), not from any decision, so they are new additions rather than "Jack has chosen".

**H2. `diary`, `job-overview` (desktop, tablet): several mechanics working at once is still not drawn.**
- *What happens:* decisions 2 (live diary and job, "Jo Taylor has this job open", "Keep mine / Keep Alex's") and 5 ("I'll do this", "Taken by Jo Taylor") are in none of `diary`'s 16 lines or `job-overview`'s 22. WH-1046 sits in "No time" with nothing to take it.
- *Why it matters:* on a tablet each, Alex and Jo can both start WH-1046 or both type in WH-1042's notes, and nothing says what each sees.
- *Fix, no choice:* lines. `job-overview`: "'Jo Taylor has this job open'"; "Notes: the other person's words arrive"; "'Alex changed this a moment ago' · Keep mine / Keep Alex's". `diary`: "I'll do this → 'Taken by Jo Taylor'"; "Changes elsewhere show within seconds".
- *8th question:* lines; the clash shows in the line, not a box over the page, so rule 1 needs no drawing.
- *Decision it touches:* walk-through 8 decisions 2, 5; Owner setup 19; Workshop day 38.

**Second check:** CONFIRMED — `j12_sit_diary` has 16 lines and `j12_sit_job-overview` 22 (canvas.json notes), none with "has this job open", "Keep mine", "I'll do this" or "Taken by"; the diary boards show "No time · WH-1046 · Standard service" and no drag, queue or take wording; severity right (WP-1.9 and WP-W.6 in the build plan cover it later, same note as H1).

**H3. `set-staff-person`, `till-sale`, `ms-till-move` (desktop): decision 1 relied on Signed-in devices, which 3 Oct answer 5 put off, so nothing lists or stops a workshop computer.**
- *What happens:* decision 1: "Signed-in devices lists it". Answer 5 makes Signed-in devices and "Sign out everywhere" later (`j20_later`). A workshop computer is signed in as the shop, so "Removing a person still signs them out" doesn't reach it. Yet `set-staff-person` still draws "Signed-in devices [n] tills · [n] phones and computers" and "Sign out everywhere", and `till-sale`'s line "Check Jo Taylor out of Till B1" was only reachable from that list (`oversight.mjs` line 170).
- *Why it matters:* a workshop computer that is lost or sold can't be seen or stopped and stays signed in as the shop. A builder reading `set-staff-person` builds the deferred rows.
- *Fix:*
  1. **Beside the tills.** Settings › Front desk › Till already lists "Bolton 3 tills" with "…" and "+ Add a till" (`ms-till-move`). Add lines: "Workshop computers: [name] · … › Stop using as a workshop computer", and "Check Jo Taylor out" in a till's "…". Uses a drawn screen; costs two lines.
  2. **Bring Signed-in devices back for tills and workshop computers only.** Matches decision 1's wording; costs a screen answer 5 put off.
  3. **Leave it.** No work; a lost workshop computer can't be stopped.

  Also, no choice: move `set-staff-person`'s Signed-in devices and "Sign out everywhere" rows to its "Later" list. Recommend 1.
- *8th question:* option 1 is lines; only option 2 adds a screen.
- *Decision it touches:* walk-through 8 decision 1; issue #116 answer 5; Management oversight 3, 6.

**Second check:** CONFIRMED — `j08-set-staff-person-desktop` draws "Signed-in devices · [n] tills · [n] phones and computers" and a "Sign out everywhere" button; `j20_later` lists Signed-in devices and "Sign out everywhere" as later (Management oversight line 117); `consolidate/j20.mjs` line 20 folds `ops-till-checkout` into `till-sale`, and `oversight.mjs` line 170 draws it over the devices list; `j19-ms-till-move` is under Settings › Front desk › Till with "Bolton · 3 tills", "…" per till and "+ Add a till". Option 2 partly reopens answer 5, which the finding says. Severity could be Medium rather than High: no story step or money/time promise breaks; the harm is a lost computer staying signed in and a builder building deferred rows.

## Medium

**M1. Dead ends at the joins.** Following every link on the story's boards, these go nowhere (no link, or `#`):
- `workos-signin` "Continue"; `auth-site`'s three shop cards; `auth-signedout` "Sign in again"; `till-setup` "Make this computer Till B1"; `till-checkin`'s PIN pad (nothing leads to `till-sale`).
- "Sign out" on all 147 staff boards that have it.
- Till boards (`till-sale`, `till-collect`, `till-rail`, `till-search`): every sidebar item including Diary; the search's "WH-1042 … Add to basket" and "Order … Hand over".
- `dq-quote` "Approve £111.00"; `cp-summary` "Pay £111.00 now". No link points at a board missing from the canvas.

*Why it matters:* step 5's mockup is built from these; the story can't be clicked across them. *Fix, no choice:* link each to the board that follows (Continue → `diary`, PIN pad → `till-sale`, Sign out → `auth-signedout`, till Diary → `diary`, search job → `till-sale`, order → `till-collect`, Pay now → `cp-pay`). *8th question:* no new screens.

**Second check:** CONFIRMED — parsing every `<a>`/`<button>` in the boards: `workos-signin` "Continue", `auth-signedout` "Sign in again", `till-setup` "Make this computer Till B1", the `till-checkin` digit keys, `dq-quote` "Approve £111.00" and `cp-summary` "Pay £111.00 now" have no link; `auth-site`'s three cards, all till-board sidebar items and `till-search`'s job and order rows are `#`; "Sign out" is `#` on exactly 147 boards; no link points at a missing file. Small correction: the person link in the till sidebar does go to `ja-your-settings-desktop`. One fix needs care: on till boards "Sign out" becomes "Check out" (decision file line 62, M6 part 1), so it should lead to `till-checkin`, not `auth-signedout`; and "Approve £111.00" has no target named.

**M2. `job-overview`, `job-checklist`: the job's stages are lines, so a click-through can't follow the bike.** "Book in" (all three sizes) links to the same "Job · expected" board; "Bike is here" goes nowhere; "Mark ready for collection" returns to `job-overview` at "Expected". Booked in, In the workshop, Finished and "At the counter, paid online: Hand over" are lines only, judged from their lines and the old `diary.mjs` code. *Why it matters:* this is the stretch Alex and Jo hand between them; each press goes back to the start. *Fix, no choice:* in step 5's mockup a press switches the one job board to the matching line (Book in → Booked in; Mark ready → Finished, with Undo). *8th question:* lines are right; the mockup must show them. *Touches:* Workshop day 20.

**Second check:** CONFIRMED — "Book in" on `j12-job-overview` desktop, tablet and phone links to its own board (titled "Job · expected"), "Bike is here" has no link on all 11 boards with it, and `job-checklist`'s "Mark ready for collection" links to `j12-job-overview-desktop`; the stages are lines in `j12_sit_job-overview` (Workshop day 20, `2026-09-27-workshop-day-review.md` lines 77–83); the Undo on "Mark ready" is already decided (UX walk-through decisions, `2026-10-02-ux-walkthrough.md` lines 44, 82), not invented.

**M3. `till-search`, `till-collect`, `till-sale`: the Saturday worker still can't book a bike in or hand over a paid-online repair at the till.** Decision 8 says the till does both ("Two new till screens"); `till-sale`'s 21 lines and `till-collect`'s one cover online orders and paying for a job, not these. *Why it matters:* Saturday workers work the front desk; a till-only one "can't open anything away from the till", so Maya waits for someone with an email sign-in. *Fix, no choice:* two lines, not two screens. `till-search`: "Expected job WH-1042 · Book in, hook and tag". `till-collect`: "Workshop job paid online: WH-1042 · Hand over". *8th question:* same layout as the drawn online-order hand-over, so lines. *Touches:* walk-through 8 decision 8; Collect and pay 3.

**Second check:** CONFIRMED — `j11_sit_till-sale` has 21 lines and `j11_sit_till-collect` one ("Hand over an online order while offline"), neither a till book-in nor a paid-online repair hand-over; the quote is `setup.mjs` line 275. Note: decision 8 says "Two new till screens"; making them two lines changes that wording, which the finding doesn't say, so Jack should see it (it fits issue #116's lines-first approach).

**M4. `auth-signedout`: the line "Signed out after a while — Walk-through 8, decision 3" cites the wrong rule.** It is the old `auth-expired` email sign-out (`signin.mjs` line 65), labelled decision 3 in `consolidate/jb.mjs`. Decision 3 is a workshop computer going back to "Enter your PIN" after 10 minutes, nothing lost. *Why it matters:* a builder could make the workshop computer sign itself out, the email-and-password loss decision 3 avoids. *Fix, no choice:* relabel it "Signing in; time still open (auth spec §14)"; the workshop idle rule goes on `till-checkin` (H1). *8th question:* lines. *Touches:* walk-through 8 decision 3; answer Q6.

**Second check:** CONFIRMED — `jb_sit_auth-signedout` reads "Signed out after a while — Staff · Walk-through 8, decision 3", from `consolidate/jb.mjs` line 9 (`'auth-expired': into('auth-signedout', 'Walk-through 8, decision 3')`); `signin.mjs` line 65 is the `auth-expired` "You were signed out after a while without activity" board; the suggested label is grounded in the WorkOS auth spec §14 item 2, "Inactivity timeout" (`2026-08-31-workos-auth-migration-design.md` line 714); severity right.

**M5. `pin-change`, `till-checkin`, `set-staff-person`: the PIN is still a till-only PIN, though decision 1 gives one to everyone using a workshop computer.** First sign-in: "Skip for now if you never use the till"; `till-checkin`: "puts your name on sales". *Why it matters:* a mechanic who never uses the till skips it and is then locked out of the workshop computer. *Fix, no choice:* "…if you never use the till or a workshop computer"; "…puts your name on sales and workshop work". *8th question:* wording only. *Touches:* walk-through 8 decision 1; Signing in 6–7; Owner setup 9.

**Second check:** CONFIRMED — `jb_sit_pin-change` has "Skip for now if you never use the till", `jb-till-checkin-desktop` reads "Your PIN checks you in and puts your name on sales", and `set-staff-person` says "Wheelhouse gives each person a till PIN"; decision 1 (decision file lines 22–24) says everyone using a workshop computer needs one; severity right.

## Low

**L1. `job-quick-overview`, `job-checklist`: the book-in note still says "Jo Taylor · 09:05".** The clashing "printed by Jack Lewis" strip went when book-in became a line. Maya's page promised 09:12 (now a `bk-page` line, not checked). *Fix, no choice:* Jo Taylor, 09:12. *Touches:* walk-through 8 L1.

**Second check:** CONFIRMED — `j12-job-checklist-desktop` and `j12-job-quick-overview-desktop` both read "Jo Taylor · 09:05 · Bike booked in, tag printed."; the decision file's L1 fix (lines 63–65) sets 09:12.

**L2. 30 boards (till boards and others): a screen reader hears the shop switcher as "Switch site";** others say "Shop: Bolton. Choose a shop". *Fix, no choice:* the latter everywhere. *Touches:* Multiple sites 9.

**Second check:** CONFIRMED — exactly 30 boards carry `aria-label="Switch site"` (21 of them journey 11, from `app-map.mjs` line 106 and `stage1.mjs` line 27) against 116 with "Shop: Bolton. Choose a shop"; Multiple sites 9 says "shop" wherever staff read it (`2026-10-01-multiple-sites-review.md` line 108).

## Earlier findings: fixed on the one canvas?

| First walk | Decided | On the one canvas |
|---|---|---|
| H1 PIN hand-over | Decision 1 | No (H1) |
| H2 several devices | Decision 2 | No (H2) |
| H3 idle lock, owner pages | Decision 3, Q6 | No. Mislabelled (M4) |
| M1 whose name shows | Decision 4 | No (H1) |
| M2 "Me" | Fix | No. Jo's diary has no "Me" |
| M3 settings follow the person | Fix | No |
| M4 shared queue | Decision 5 | No (H2) |
| M5 photo from a desktop | Decision 6 | No; "Add photo" only on `ls-part-search` |
| M6 part 1 "Check out" | Fix | No. The rail says "Sign out" |
| M6 part 2 till hand-over | Decision 8 | No (M3) |
| L1 two names | Fix | Partly (L1) |
| L2 who did what | Decision 7, Q3 | No |
| L3 word list | Fix | Yes. The row is in the script |

## Persona checks

- **Jo:** one search finds WH-1042, but it goes nowhere (M1); shop words except "Switch site" (L2); undo only in a line (M2).
- **Alex:** quick swap no; name clear no (H1); sees others' changes no (H2); not tied to one machine yes, but can't be stopped (H3).
- **Saturday worker:** the PIN is explained on screen; paid-repair hand-over no (M3); taking a queue job is learnt by being shown until "I'll do this" (H2); no owner access needed.
- **Screen reader:** PIN keys labelled, no swap announcement (H1), "Switch site" (L2). **Keyboard:** typing digits not checked. **Low vision:** Larger text follows the account (H1).

## End table

| Id | One line | Needs Jack |
|---|---|---|
| H1 | Walk-through 8's decisions aren't on the canvas; add as lines | No |
| H2 | Several devices at once and the shared queue: add lines | No |
| H3 | Signed-in devices is later; nothing lists or stops a workshop computer | Yes (1–3) |
| M1 | Buttons and links that go nowhere | No |
| M2 | Job stages are lines; the mockup must switch them | No |
| M3 | Till book-in and paid-repair hand-over: two lines | No |
| M4 | Idle line cites the wrong decision | No |
| M5 | PIN described as till-only | No |
| L1 | 09:05 should be 09:12 | No |
| L2 | "Switch site" spoken name | No |

## Choices for Jack

1. How the owner sees and stops a workshop computer now that Signed-in devices is later (H3): 1 a line beside the tills in Settings › Front desk › Till, 2 bring Signed-in devices back for tills and workshop computers only, 3 leave it. Recommend 1.

## Verification

- **Boards** (text, buttons, links): all of journeys B (9), 12 (14), 4 (2), 5 (6), plus `staff-app`, `till-rail`, `till-search`, `your-settings`, `set-staff-person`, `till-sale`, `till-collect`, `ms-till-move`; desktop, plus tablet and phone where drawn. Situation and "Later" lists for A, B, 4, 5, 8, 10, 11, 12, 15, 19, 20.
- **Generator:** `consolidate/jb, j04, j05, j12, j20.mjs`; `signin.mjs`, `oversight.mjs`, `sites.mjs` at the lines cited; a search for H1's wording.
- **Decisions:** walk-through 8 and build-plan answers in full; issue #116 answer 5; the later-change notes of the story's journeys. Older decision numbers as the reviewed first walk cites them.
- **Not checked:** rendered boards; focus order; a real screen reader; tablet dragging; the workshop offline; `bk-page`'s 09:12; the mechanic's on-job clicks; WorkOS's password page.

## Second check

Checked 3 Oct 2026 by a second reviewer against `generator/out/project/` (canvas.json notes and every board's `<a>`/`<button>` links, parsed), the generator and `consolidate/` files, the walk-through 8 and build-plan decision files, Management oversight's later-change note, Multiple sites 9, Workshop day 13/20/38/64 and the build plan's stage W.

- **Counts:** 10 confirmed, 0 refuted, 0 uncertain (3 High, 5 Medium, 2 Low).
- **Severity:** H3 could be Medium (no story step or promise breaks); the rest stand.
- **Decisions:** no finding reopens one silently. H3 option 2 partly reopens issue #116 answer 5 and says so. M3 turns decision 8's "Two new till screens" into two lines without saying so (noted under M3).
- **8th question:** no fix adds a drawing. H1's "Working" bar goes on the existing `job-checklist` board; H3 option 2 is the only extra screen, and it is marked as one.
- **Invented:** nothing in the data. H1's "'Now working: Jo Taylor' is announced" and "Digits can be typed" are new lines from the first walk's "not checked" list, not from Jack's decisions.

Missed by the walker (mine, checked):

1. `set-staff-person` also draws "Alerts on Today · Discounts, refunds, voids, prices below cost · set by the owner", which answer 5 also put off (Management oversight decision 2, `j20_later` "Settings › Office › Alerts on Today"). H3's no-choice move to "Later" should take that row too. Low.
2. M1's "Sign out → `auth-signedout`" fix is wrong for the till boards (`till-sale`, `till-collect`, `till-rail`, `till-search`): walk-through 8's M6 part 1 makes the till rail's foot "Jo Taylor · Staff · Check out", which goes back to `till-checkin`. Low.
3. Build plan WP-W.6 ("Draw the decisions", `2026-10-03-release-2-build-plan.md` lines 124–127) already plans to put walk-through 8's decisions on the canvas. H1 and H2 are real on today's canvas, but they are a known, scheduled gap. Their value is the list of which screen gets which line. Not a finding, only context.
4. The "Earlier findings" table says "Add photo" is only on `ls-part-search`. It is also on the customer's `bk-bike-phone`. No staff board other than `ls-part-search` has it, so M5's point stands. Wording only.
