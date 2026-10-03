# Draw the decisions: the change list for the one canvas

Jack, 3 Oct 2026: "Redraw the boards to match what you've already decided, and
nothing else — situation lines wherever possible, list every board changed, no
new design ideas." This is build plan WP-W.6 ("Draw the decisions"), done on
the one canvas (issue #116 step 3) before step 5's clickable mockup.

Sources: the 12 second-walk reports in `docs/design/user-journeys/walk-2/`
(each finding's "Second check" line; refuted parts left out, corrections
used); the "Later change (3 Oct 2026, issue #116 question N)" notes at the end
of the Reports and accounts, Website management, Moving from Citrus Lime,
Management oversight and Receiving stock decision files;
`docs/decisions/2026-10-03-ux-walkthrough-8.md`; the build-plan answers
(`docs/decisions/2026-10-03-build-plan-questions.md`, Q3, Q6); and the
generator in `docs/design/user-journeys/generator/`.

## The rules for this pass

1. **Only what a recorded decision says.** Every change below names the
   decision file and number (or later-change note) it carries out. Anything
   that needs a new choice from Jack is in "Not included — needs Jack" at the
   end, one line each.
2. **Lines before drawings.** A change is one of:
   - **(a)** edit an existing drawing's content (take off what was put off,
     change wording, fix a role label or example);
   - **(b)** add a line to a board's situation list, given as
     "situation — who · decision";
   - **(c)** a new drawing, only where the decision itself asks for one.
     There is one: walk-through 8 decision 8, "Two new till screens".
3. **Wording comes from the decision files or the drawings.** Where a
   decision gives no exact words, the change says "wording from decision
   text:" and quotes it. Example data comes from the drawings (Maya Patel,
   WH-1042, Trek Domane AL 3, Hook 3, Jo Taylor, Alex Morgan, Jack Lewis,
   North Street Cycles, Bolton, [Second site]); anything unknown stays
   bracketed ([£], [n], [date], [time]).
4. **Left out on purpose:** links between boards (step 5's mockup), and
   "what's different" phrases on situation lines (a separate question for
   Jack, walk-through 1 M2 and walk-through 2 M1).
5. **Grouped by generator module**, so different people can work at the same
   time without editing the same file. Each group owns its drawing module and
   its journey's `consolidate/jNN.mjs`. `journeys.mjs` (titles and role
   labels) and `build.mjs` (the line mechanism) each have their own group.
   Line numbers are approximate (taken 3 Oct from the files as they are on
   `design/one-canvas`).

## Before anything else: a way to add a line without a drawing

Today a situation line only exists when a screen id from `journeys.mjs` is
folded into a kept board (`build.mjs` lines 305–318: the line is the folded
drawing's title, its role, then the decision). Most (b) changes below are
lines with no old drawing behind them, so the build needs one small addition
first.

**B0 — `build.mjs`, `consolidate/plan.mjs`, `consolidate/check.test.mjs`.**
Each `consolidate/jNN.mjs` may also export `lines`: a list of
`{ on, text, who, decision }`. `situationText()` adds them after the folded
lines, in the same "• text — who · decision" form. The check fails when `on`
is not a kept screen id, or when `text` or `who` is empty. Test first: add a
`lines` entry pointing at a folded id, watch the check fail, then make it
pass. Note budget: two boards gain a situation note they don't have today
(`rp-margin`, `auth-site`) and journey 17 gains a "Later" note (R5), so the
canvas goes from 171 notes to 174 (limit 200, checked by
`fitcheck-canvas.mjs`).

## Changes, by module

Totals: 46 (a), 20 (b), 1 (c), plus B0. Counts per group are in each heading.

### 1. `journeys.mjs` — titles and role labels (9 a, and T1's two entries)

These are the only edits to `journeys.mjs`, so one person makes them all.
Where a module also keeps a `TITLES` map with the same id, that module's group
mirrors the title (named in its own change).

| Id | Change | Decision | Board / line | Line | Type |
|---|---|---|---|---|---|
| J1 | `till-setup` role "Manager" → "Owner" (the board already reads "Signed in as Jack Lewis (Owner)") | Owner setup 10: "Only the Owner adds or removes staff and registers tills" | `till-setup` board | ~99 | a |
| J2 | `auth-site` role "Staff" → "Owner" (it shows the owner's "All shops" card and the other shop's count) | Multiple sites 1 and 9 (only owners, and managers at two shops, get "All shops"); walk-through 7 H1 as taken (`2026-10-02-ux-walkthrough.md`, "the owner gets an 'All shops' card") | `auth-site` board | ~93 | a |
| J3 | `eod-entry` role "Manager" → "Owner, Manager, or anyone with Can close the day" | Cash-up 5; Owner setup 9 ("Can close the day" switch); Opening the shop 4 | the line under `till-sale` "Close the day appears in the till bar after closing time" | ~961 | a |
| J4 | `ms-request-from-shop` role "Mechanic" → "Staff" (the drawing has "[Name] · Staff") | Multiple sites 12: "Someone there who can accept bookings accepts it" | the line under `diary` "At [Second site]: the request, from Bolton, to accept" | ~1151 | a |
| J5 | `rs-add-product` role "Staff" → "Owner" | Stock control 11: Staff "can't … edit or add products" | `rs-add-product` board | ~801 | a |
| J6 | `rs-delivery` title "A booked-in delivery, waiting for its invoice" → "A booked-in delivery"; `rs-booked-staff` "…labels first, no invoice" → "…labels first"; `rs-delivery-staff` "…no costs, no invoice" → "…no costs" | Receiving stock, later change (issue #116 question 6): the invoice check comes later | `rs-delivery` board and two of its lines | ~809, 834, 841 | a |
| J7 | `rp-vat-check-off` title → "VAT with the supplier invoice check: invoices booked in" (it becomes the later version; see R5) | Reports and accounts, later change (question 6) | `j17_later` | ~1013 | a |
| J8 | `mv-morning` title "Switch-over morning: last refresh, go real, then turn the website on" → "Switch-over morning: last refresh, then turn the website on" | Moving from Citrus Lime, later change (question 4): "no 'Clear and go real'" | the line under `mv-start` | ~641 | a |
| J9 | `pin-first` title "(Skip for now if you never use the till)" → "(Skip for now if you never use the till or a workshop computer)"; mirror in `signin.mjs` `TITLES` (~233) | Walk-through 8 decision 1: "Everyone who uses a workshop computer needs a PIN, not only people with 'Can use the till'" | the line under `pin-change` | ~107 | a |
| (T1) | Add two screen entries to journey 11's rows: `till-book-in` "Book a bike in at the till" and `till-hand-over-job` "Hand over a repair paid online at the till", both "Staff" | Walk-through 8 decision 8 | new boards (see T1) | journey 11 rows | c |

### 2. `reports.mjs` and `consolidate/j17.mjs` (3 a, 3 b)

**R1 (a, waits on Jack for its details) — the figures strip on `rp-home`.**
- What is decided (Reports and accounts, later change, question 1): a strip
  of 3 figures at the top, above the report cards: "takings by shop, margin,
  and a link to each shop". Figures, not charts (decision 1's "dashboard of
  charts" stays turned down). Labelled "Margin", not "Profit". Drawn on the
  `rp-home` board itself, with no new board.
- Also decided, and the strip must keep it: the shop menu sets the shop for
  reports (Multiple sites 1: "The sidebar's shop switcher sets the shop for
  every page — … reports"; "Every page says which shop it is showing"); and
  margin is shown only to people with "Can see costs and margin"
  (Reports and accounts 5).
- What is open (needs Jack, N1): which shops it shows when the menu is on one
  shop, which period, whether takings are with or without VAT beside a margin
  worked out before VAT, the "[n] products have no cost" and "sales still to
  send" gaps, and what "a link to each shop" opens. Draw the strip once N1 is
  answered; until then the figures stay "[£]".
- File: `reports.mjs` `home()` ~132. Board: `rp-home` (desktop).

**R2 (b) — `rp-home`.** "Staff with Can see reports, without Can see costs
and margin: no margin figure in the strip — Staff · Reports and accounts 5;
issue #116 question 1". In `consolidate/j17.mjs` `lines`.

**R3 (b) — `rp-margin`** (no situation list today, so this starts one).
"Margin and stock value for all shops: a shop column — Owner · Reports and
accounts 8 (M13)". Wording from decision text: "Takings and VAT get 'All
shops' versions, the others a shop column".

**R4 (b) — `rp-discounts`.** "Discounts and refunds for all shops: a shop
column — Owner · Reports and accounts 8 (M13)".

**R5 (a) — `rp-vat`: the no-figure box becomes the board.** Reports and
accounts, later change (question 6): "decision 3's 'Stock purchases' box
gives no figure and says to take it from the accounts software".
- `reports.mjs` ~378–381 and `vat()` ~239–245: `rp-vat` (and so `rp-vat-all`
  and `rp-vat-first`, which draw over it) shows the existing drawn sentence
  "Supplier invoices are checked in your accounts software — take this figure
  from there." Drop the note "The invoice check is off in Settings ›
  Stockroom…" (it names a switch that is also later) and the "[n] deliveries
  are still waiting… See them" line.
- `rp-vat-check-off` is redrawn as the old invoice version (the "VAT on stock
  invoices · Supplier invoices booked in · [n]" table), retitled (J7; mirror
  in `reports.mjs` `TITLES` ~432), and in `consolidate/j17.mjs` becomes
  `later('Issue #116 question 6: invoice check later')`. Its old line "VAT
  with the invoice check off…" leaves `rp-vat`'s list.

**R6 (a) — `rp-sales`.** `reports.mjs` ~158: remove "Practice sales from
moving across are never counted." and keep "Takings include VAT and take
refunds off." Moving from Citrus Lime, later change (question 4): "no practice
sales to keep out of reports". Board: `rp-sales`.

### 3. `oversight.mjs` and `consolidate/j20.mjs` (1 a)

**O1 (a) — `ops-log`: take the put-off extras off the log.** Management
oversight, later change (question 5): alerts on Today, Signed-in devices and
"Sign out everywhere" come later; Website management, later change
(question 2): no theme editor.
- `oversight.mjs` ~80: drop the flag "Seen by Jack Lewis at [time]".
- ~81, ~83: drop `flag: 'today'` (the "On Today" tag) from the price and void
  lines. Keep "All shops" on the price line (walk-through 7 M4).
- ~87: remove the line "Signed out from Signed-in devices".
- ~89: "Home page and Theme" → "Home page" (Publish stays: Website
  decision 2 is not put off).
- If the log's filters list a sign-out kind or an "On Today" filter, take
  those off too.
- Boards: `ops-log`; its lines `ops-log-manager`, `ops-log-all` draw from the
  same entries. `j20_later` already lists the extras, so it needs no change.

### 4. `setup.mjs`, `settings-frame.mjs` and `consolidate/j08.mjs` (3 a, 1 b)

`settings-frame.mjs` is shared by several modules; only this group edits it.

**S1 (a) — Staff and roles: no Signed-in devices or Alerts on Today folds.**
`settings-frame.mjs` `staffFolds()` ~225–228 (both the normal and the
Lightspeed version): remove `fold('Signed-in devices', …)` and
`fold('Alerts on Today', …)`; update the comment ~222. Management oversight,
later change (question 5). Boards: `set-staff`, `set-staff-invite`,
`set-staff-person` (behind its box), and `ms-add-shop` if its page is drawn
from these folds (group 14 checks).

**S2 (a) — `set-staff-person`: no "Signed in … Sign out everywhere" row.**
`setup.mjs` ~239: remove the "Signed in · Till B1 now · [n] phone or
computer" row and its "Sign out everywhere" button. Management oversight,
later change (question 5); "Removing a person still signs them out" needs no
drawing.

**S3 (a) — Settings › Stockroom no longer offers the invoice check.**
`settings-frame.mjs` ~64 (the room's summary "Supplier invoices, stock
adjustments, categories" → "Stock adjustments, categories"), ~251
(`STOCK_INTRO` likewise), ~253 (remove the "Supplier invoices" fold). Receiving
stock, later change (question 6): "The supplier invoice check (decision 6),
with its Settings › Stockroom switch, comes later". Boards: any board that
shows the Settings rooms list or the Stockroom page (check with a search of
`out/project` for "Supplier invoices" after the build).

**S4 (b) — `set-staff-person`.** "Uses a workshop computer: needs a PIN,
not only people with Can use the till — Owner · Walk-through 8, decision 1".

### 5. `app-map.mjs`, `stage1.mjs` and `consolidate/ja.mjs` (3 a, 4 b)

**A1 (a) — `your-settings`: no Help cards.** `app-map.mjs` ~181 (`helpBlock`)
and where it is placed: remove both cards, "Something wrong or missing? … Send
feedback" and "What Wheelhouse records about you … See my own activity".
Management oversight, later change (question 5): "Send feedback (decision 4
and audit H6), and the first sign-in note with 'What Wheelhouse records about
you' (audit H2)" come later. This replaces the 2 Oct note "Your settings has
the Help cards" (Reports and accounts, later change, Oversight 6 and 7).
`j20_later` already lists them.

**A2 (b) — `your-settings`, two lines.**
- "On a workshop computer: Your settings belong to the person who typed their
  PIN, and switch with them — Staff and Mechanic · Walk-through 8, fix M3".
- "On a workshop computer: no Change PIN — Staff and Mechanic · Walk-through
  8, decision 3".

**A3 (a) — the till's rail foot reads "Check out".** `app-map.mjs` ~101
(`personBlock`, the till rail's foot): "Sign out" → "Check out", so it reads
"Jo Taylor · Staff · Check out". Walk-through 8, fix M6 part 1. If the till
frames in `stage1.mjs` (~42, ~68) are used by any kept till board, change them
the same way; the staff sidebar's "Sign out" (`diary.mjs` ~182) stays.
Boards: `till-rail`, `till-search`, and every journey 11 and 16 till board
that shows the unfolded rail.

**A4 (a) — the till's shop switcher is named for screen readers like every
other.** `app-map.mjs` ~106 and `stage1.mjs` ~27: `aria-label="Switch site"`
→ "Shop: Bolton. Choose a shop", with the same open-state markup as the
sidebar switcher. Multiple sites 9 ("'shop' wherever staff read it") and its
1 Oct later change ("the shop switcher in the sidebar is named 'Shop: Bolton.
Choose a shop' (with its open state)"). About 30 boards: every `j11-till-*`,
the `j16-eod-*` boards, `op-float-check`, `op-float-short`,
`cp-receipt-address`, `till-rail`, `till-search`.

**A5 (b) — `till-rail`.** "On a till, the rest of the shop opens as the person
checked in by PIN, with their role — Staff · Walk-through 8, fix M6 part 1".

**A6 (b) — `staff-app`.** "On a workshop computer, owner and manager pages
open only after an Owner or Manager PIN — Owner and Manager · Walk-through 8,
decision 3".

**A7 (b) — `till-search`, two lines.**
- "A job paid online: Paid online · [date], with Hand over in place of Add to
  basket — Staff · Walk-through 8, decision 8; Collect and pay 5 (H3)".
  ("Paid online · [date]" is the job page's drawn strip.) Hand over opens
  `till-hand-over-job` (T1).
- "A job expected today: Book in — Staff · Walk-through 8, decision 8". Book
  in opens `till-book-in` (T1).

### 6. `signin.mjs` and `consolidate/jb.mjs` (2 a, 3 b)

**N1 (a) — `auth-signedout`: the "Signed out after a while" line cites the
wrong decision.** `consolidate/jb.mjs` ~9: `into('auth-signedout',
'Walk-through 8, decision 3')` → `into('auth-signedout', '')`. Decision 3 is a
workshop computer going back to "Enter your PIN" with nothing lost, not an
email sign-out; that rule goes on `till-checkin` (N3). Walk-through 8 M4 (and
walk-through 1's second check). The line text "Signed out after a while"
stays.

**N2 (b) — `till-setup`.** "Make this computer a workshop computer: it stays
signed in as the shop, and each person takes over by typing their PIN — Owner
· Walk-through 8, decision 1".

**N3 (b) — `till-checkin`, three lines.**
- "A workshop computer: Enter your PIN, and what you do is recorded under your
  name and role — Staff and Mechanic · Walk-through 8, decision 1".
- "A workshop computer left alone for 10 minutes: back to Enter your PIN,
  nothing lost — Staff and Mechanic · Walk-through 8, decision 3; build plan
  Q6".
- "A till with nobody checked in: only the PIN screen — Staff · Walk-through
  8, fix M6 part 1".

**N4 (b) — `auth-site`** (no situation list today, so this starts one).
"Staff at two shops (Jo Taylor): their two shops, no All shops; the counts
only for people who can close the day — Staff · Multiple sites 9; Opening the
shop 3 and 4". (`ms-switch-open`'s own line already says staff with two shops
get no "All shops".)

**N5 (a) — `jb_later`.** `consolidate/jb.mjs` ~20 `till-checkin-practice`:
reason → "Dropped, not later: issue #116 question 4, practice mode dropped".
(Same wording as MV8 and OP1.)

### 7. `till.mjs` and `consolidate/j11.mjs` (1 a, 1 c)

**T1 (c) — two new till screens: book a bike in, and hand over a repair paid
online.** Walk-through 8 decision 8: "The till can book a bike in and hand over
a repair paid online … a till-only worker must be able to do both without an
email sign-in. Two new till screens."
- `till-book-in` (building block 9, a form box over the till page): the
  expected job found from the till's search (WH-1042 · Maya Patel · Trek
  Domane AL 3 · Standard service), the storage choice and tag print as the job
  page's book-in already draws them ("Kept on Hook 3"; tag printed by Jo
  Taylor at 09:12, walk-through 8 fix L1).
- `till-hand-over-job` (building block 9, the same layout as `till-collect`'s
  online-order hand-over): WH-1042 · Maya Patel · Paid online · [date] ·
  £111.00 · Hand over.
- Both stay on the till: nothing opens the job page, because decision 8 was
  chosen to keep "till only" true (walk-through 8 M6 part 2). Wording comes
  from the job page and `till-collect` as drawn; anything not on a drawing
  stays bracketed.
- `till.mjs`: two new `def`s and `TITLES` entries; `consolidate/j11.mjs`:
  `keep(9)` for each; `journeys.mjs`: the two entries in group 1. Adds 2
  boards (213 files, limit 512).

**T2 (a) — `till-sale`: the Cycle to Work lines cite the decision behind
them.** `consolidate/j11.mjs` ~53 and ~57 (`till-c2w`, `till-c2w-deposit`):
decision `SALE` → `SALE + '; Cycle to Work 5'`. Walk-through 5 L2 (Cycle to
Work 5 sets the till hand-over). Only those two lines change.

### 8. `diary.mjs` and `consolidate/j12.mjs` (2 a, 3 b)

**D1 (a) — book-in and tag print: Jo Taylor at 09:12.** Walk-through 8, fix
L1: "the book-in and the tag print are one person and one time: Jo Taylor at
09:12 … The quick look's 09:05 moves."
- `diary.mjs` ~379: "09:05" → "09:12" on Jo Taylor's "Bike booked in, tag
  printed." note.
- `diary.mjs` ~2285: "09:12 · printed by Jack Lewis" → "09:12 · printed by Jo
  Taylor".
- Boards: `job-quick-overview`, `job-checklist`, and `job-overview` wherever
  the note shows. (`job-options.mjs` ~76, 81 is not on the one canvas; leave
  it.)

**D2 (a) — show the "Working" bar once.** Draw building block 26, "Working:
Alex Morgan · Switch", on the `job-checklist` board (already the mechanic's
view), as the workshop-computer example. Walk-through 8 decisions 1 and 4: "A
bar on every workshop page reads 'Working: Alex Morgan · Switch'"; "in the
job pop-up's header, at every size". The job keeps "Mechanic: Alex Morgan".

**D3 (b) — `diary`, five lines.**
- "A workshop computer: the Working: Alex Morgan · Switch bar, and everything
  done is recorded under that name and role — Mechanic · Walk-through 8,
  decisions 1 and 4".
- "A change on another device shows here within a few seconds — Staff and
  Mechanic · Walk-through 8, decision 2".
- "A shared-queue job: I'll do this puts it in your column at your next free
  time; every device shows Taken by Jo Taylor — Staff and Mechanic ·
  Walk-through 8, decision 5". (It sits beside the drag, Owner setup 19.)
- "Me is the person working now; anyone with Works in the workshop gets Me —
  Staff and Mechanic · Walk-through 8, fix M2".
- "A workshop computer with nobody working: opens on Everyone — Staff and
  Mechanic · Walk-through 8, fix M2".

**D4 (b) — `job-overview`, six lines.**
- "A workshop computer: Working: Alex Morgan · Switch in the job's header —
  Mechanic · Walk-through 8, decision 4".
- "Open on another device: Jo Taylor has this job open — Staff and Mechanic ·
  Walk-through 8, decision 2".
- "Notes: the other person's words arrive as they type — Staff and Mechanic ·
  Walk-through 8, decision 2".
- "Two people change one line: Keep mine or Keep Alex's — Staff and Mechanic
  · Walk-through 8, decision 2".
- "On a desktop, Add photo: Choose a file or Use my phone (a code to scan
  opens that line's photo step, no sign-in) — Mechanic · Walk-through 8,
  decision 6".
- "Who did what, folded: name, what, time; Mark ready records Signed off by
  Alex Morgan · 15:30 — Staff and Mechanic · Walk-through 8, decision 7;
  build plan Q3".

**D5 (b) — `job-quick-overview`.** "After Mark ready: Signed off by Alex
Morgan · 15:30 in the hover summary — Staff and Mechanic · Build plan Q3".

### 9. `moving.mjs` and `consolidate/j09.mjs` (8 a)

All from Moving from Citrus Lime, later change (question 4): "Practice mode
is dropped … no practice tills, no 'Practice: not real money' band, and no
practice sales … Decision 7's checklist loses 'every member of staff has made
a practice sale', and on the switch-over day the tills are real from the first
sale, with no 'Clear and go real'." MV6 is from Website management, later
change (question 3).

- **MV1 (a) — the running-alongside page.** `moving.mjs` ~138: remove the
  "Tills" section ("Every till is in practice · Until switch-over day · not
  real money · no float check or Close the day"). ~139: "Not sent — practice"
  → "Not sent — before switch-over" (the rule that no messages go out until
  switch-over day is walk-through 4 H3, as taken; only the word "practice"
  goes). Boards: `mv-change-day`, `mv-both`.
- **MV2 (a) — `mv-start`.** ~98: remove "Running alongside puts every till
  into practice until switch-over day."
- **MV3 (a) — the switch-over checklist.** ~203: remove the row "Everyone has
  made a practice sale" with "Remind Alex". ~207 `READY_COUNT` and ~209 "of 5"
  become 4 rows: "3 of 4" before, "4 of 4" when all are ticked. Boards:
  `mv-weeks`, `mv-pick-day` (both drawn over the checklist).
- **MV4 (a) — `mv-pick-day`.** ~214: "Practice sales are cleared, the tills
  take real money and messages to customers start" → "The tills take real
  money and messages to customers start".
- **MV5 (a) — switch-over morning (the `mv-morning` line under `mv-start`).**
  ~225: remove step 2 "Clear practice sales and make the tills real" and its
  "Clear and go real" button; the website step becomes step 2; the note under
  the list keeps "The first person to check in counts the float…" and adds
  "messages to customers start" (wording from the pick-day box, MV4). ~230
  `goReal` is only used by `mv-go-real`, already later.
- **MV6 (a) — own web address on switch-over morning.** ~226: remove "if you
  use your own address, point [your address] to it — this can take up to a
  day". Wording from decision text: "Wheelhouse sets up a shop's own address
  for them as a service".
- **MV7 (a) — the `mv-today-refresh` line's drawing.** ~125: `today({ refresh:
  true, practice: true, … })` → `practice: false`, so the drawing behind the
  line under `op-today` has no practice Tills card. Update the comments at
  ~124, 130–131, 182 and 241.
- **MV8 (a) — `j09_later`.** `consolidate/j09.mjs` ~18–21 and ~27: reason →
  "Dropped, not later: issue #116 question 4, practice mode dropped", so the
  "Later — not drawn here" note doesn't list dropped things as coming later
  (walk-through 4 L1).

No change to `till.mjs`'s practice band or `signin.mjs`'s practice check-in:
only later-listed drawings use them (checked by search, 3 Oct).

### 10. `opening.mjs` and `consolidate/j10.mjs` (1 a)

**OP1 (a) — `j10_later`.** `consolidate/j10.mjs` ~25 `op-today-practice`:
reason → "Dropped, not later: issue #116 question 4, practice mode dropped".
`opening.mjs`'s `practice` option is used only by that later screen and by
MV7, so it needs no other change.

### 11. `website.mjs` and `consolidate/j18.mjs` (5 a)

Website management, later change (question 2): "a fixed design with editable
text and photos: no live-preview editor with drag-and-drop sections, and no
theme editor" (decisions 1, 3 and 4 later). Decision 2 (Publish, history) is
not put off, so Publish and History stay.

- **W1 (a) — `ws-history` drawn over the Website page, not the editor.**
  `website.mjs` ~519: `overlay(ed({}), history())` → over the Website page
  (`overview(…)`), so "Drag the dots", "+ Add section", the Sections and
  Theme panel and "3 online orders waiting" go from the board. The "Earlier
  versions" box itself is unchanged.
- **W2 (a) — `ws-start-look`.** ~148: remove "You can change anything later
  under Theme." (Theme is later.) The rest of the step is unchanged; whether
  the colour choice stays in a fixed design is for Jack (N12).
- **W3 (a) — `ws-page`: the Web address row.** ~125 `row('Web address',
  FREE)`: the row shows the free address and says the shop's own address is
  set up for them. Website management, later change (question 3); wording from
  decision text: "Wheelhouse sets up a shop's own address for them as a
  service … Every shop still has its free address."
- **W4 (a) — the switch-over morning message (the `ws-page-switch-over` line's
  drawing).** ~110: remove "If you use your own address, point it here next —
  this can take up to a day." and its "Web address" link. Question 3, as W3.
- **W5 (a) — the unpublished-changes list (the `ws-page-changes` line's
  drawing).** ~86 `CHANGES`: remove `['Theme', 'Main colour']`. Question 2.

`j18_later` already lists the editor, theme, pages and own-address screens.

### 12. `receiving.mjs` and `consolidate/j13.mjs` (4 a)

Receiving stock, later change (question 6): "The supplier invoice check
(decision 6), with its Settings › Stockroom switch, comes later."

- **V1 (a) — `rs-delivery` without the invoice.** `receiving.mjs` ~216
  (`deliveryBoard`): drop the "Invoice" section for people who can order
  stock, so the board is the booked-in delivery (its lines keep "Held for job
  WH-1042 · 1", ~195). Title in group 1 (J6); mirror in `receiving.mjs`
  `TITLES`.
- **V2 (a) — booked-in delivery and the Staff note.** ~186: remove the "Add
  the invoice" button (keep "Print labels" first). ~216: the Staff note "Costs
  and the invoice are for people who can order stock." → "Costs are for people
  who can order stock." Lines affected: `rs-booked`, `rs-booked-staff`,
  `rs-booked-job-waiting`, `rs-delivery-staff` (all under `rs-delivery`).
- **V3 (a) — `rs-hub`: no invoice tags.** ~86–89: remove the "Waiting for
  invoice" and "Invoice checked" tags from Recent deliveries.
- **V4 (a) — `rs-add-product`: no supplier catalogue.** ~143: remove the row
  "Look it up in a supplier's catalogue to fill this in · Find it". Receiving
  stock, later change (2 Oct): the supplier catalogue waits for a later
  release. Role label in group 1 (J5).

### 13. `stock.mjs` and `consolidate/j14.mjs` (1 a)

**K1 (a) — counts say "at cost".** `stock.mjs` ~284 (`tk-diff`, "£[value]
under in all") and ~266 (`tk-hub`, "£[value] under"): add "at cost" — "£[value]
under, at cost". Walk-through 3 M7, taken under walk-through decision 6
(`2026-10-02-ux-walkthrough.md`: "stock written off is reported at cost").
Boards: `tk-diff`, `tk-hub`.

### 14. `sites.mjs` and `consolidate/j19.mjs` (1 a, 1 b)

**SI1 (b) — `ms-switch-open`.** "While [Second site] is being set up:
[Second site] · [n] steps to get it ready — Owner · Walk-through 7 H1 (as
taken)". Wording from the first walk's H1 fix, taken under walk-through
decision 6: "While a shop's checklist is unfinished, the line reads '[Second
site] · 3 steps to get it ready'" (and the script's word list, "[n] steps").
It goes on `ms-switch-open`, where the other version is drawn, because the
same fix says "`op-today` itself stays a one-shop board".

**SI2 (a, only if needed) — `ms-add-shop`.** After S1, check the board no
longer shows "Signed-in devices" or "Alerts on Today". If `sitesBoard()`
(~211) draws them itself, remove them here (question 5).

### 15. `customer.mjs` and `consolidate/j15.mjs` (1 a)

**C1 (a) — `cs-page`: a Ready job is open, not "Earlier".** `customer.mjs`
~116–117 treats a Ready job as past. Ready jobs go under "Open now". Customer
service 12: "newest first with what's open now at the top". (WH-1074's date,
Fri 18 Sep, comes from the diary's data in `diary.mjs` ~441 and is not changed
here.)

### 16. `c2w.mjs` and `consolidate/j06.mjs` (1 b)

**CW1 (b) — `cw-customer-view`, two lines.** Walk-through 5 H4, as taken:
"The customer view gets a 'What you pay at collection' line, from the same
'Who pays what' figures."
- "Certificate received: What you pay at collection £[£] — Customer · Cycle to
  Work 6, 7; walk-through 5 H4".
- "Ready to collect: What you pay at collection £[£] — Customer · Cycle to
  Work 6, 7; walk-through 5 H4".

### 17. `lightspeed.mjs` and `consolidate/j21.mjs` (1 a, 4 b)

Journey 21 comes after the trading week (build plan Q5) but stays on the
canvas (one-canvas spec). These finish fixes from walk-through 6 that were
taken on 2 Oct (`2026-10-02-ux-walkthrough.md`, "Walk-throughs 5 and 6").

- **L1 (b) — `ls-job-sent`, two lines** (walk-through 6 H2 option 1, taken:
  the strip keeps the button for its cause).
  - "Ready, Maya still to choose: the strip keeps Choose the customer — Staff
    · Walk-through 6 H2; Lightspeed shops 10".
  - "Ready, not sure it arrived: the strip keeps Check this in Lightspeed —
    Staff · Walk-through 6 H2; Lightspeed shops 10".
- **L2 (b) — `ls-job-check`.** "The box's first sentence follows the cause —
  Staff · Walk-through 6 H2; Lightspeed shops 10".
- **L3 (a) — the by-hand box asks for a work order.** `lightspeed.mjs` ~183:
  the hint "The number on the sale you rang up for WH-1042 · agreed £111.00"
  → asks for the work order's number, matching the field's drawn label "Work
  order number in Lightspeed". Walk-through 6 H2 option 1, taken: "linked to
  one rung up by hand" (the second check on walk-2 M3 says this is the reading
  already chosen; a plain-sale reading would reopen it).
- **L4 (b) — `ls-job-sent`.** "Maya said no to £[£]: back to Keep £28.00 or
  Ask Maya again — Staff · Walk-through 6 M4; Lightspeed shops 12". (Wording
  from the first walk's M4 fix, taken: "If she says no, the strip returns to
  the price-changed state with 'Maya said no to £[£]' and the two buttons.")
- **L5 (b) — `ls-customer-pick`.** "Changing Maya's Lightspeed customer:
  WH-1042's unpaid work order moves to the customer you choose; paid work
  orders stay where they are — Staff · Walk-through 6 M3; Lightspeed shops 4".
  (Wording from the first walk's M3 fix, taken; whether Lightspeed lets a work
  order move is unverified, as that fix says.)

## Every board changed

Drawn content changes (a or c): `rp-home` (R1, after N1), `rp-vat`,
`rp-vat-all`, `rp-vat-first`, `rp-sales`, `ops-log`, `set-staff`,
`set-staff-invite`, `set-staff-person`, `ms-add-shop`, `your-settings`, every
till board with the rail or the till's shop switcher (A3, A4: `till-rail`,
`till-search`, all `j11-till-*`, `j16-eod-*`, `op-float-check`,
`op-float-short`, `cp-receipt-address`), `till-setup` (label),
`auth-site` (label), `job-quick-overview`, `job-checklist`, `job-overview`
(D1 note), `mv-start`, `mv-change-day`, `mv-both`, `mv-weeks`, `mv-pick-day`,
`ws-history`, `ws-start-look`, `ws-page`, `rs-delivery`, `rs-hub`,
`rs-add-product`, `tk-diff`, `tk-hub`, `cs-page`, any Settings board showing
the Stockroom summary (S3), and the new `till-book-in` and
`till-hand-over-job`.

Situation lists changed (b, or a line's title, role or decision): `rp-home`,
`rp-margin` (new list), `rp-discounts`, `rp-vat`, `set-staff-person`,
`your-settings`, `till-rail`, `staff-app`, `till-search`, `till-sale` (J3,
T2), `auth-signedout`, `till-setup`, `till-checkin`, `pin-change` (J9),
`auth-site` (new list), `diary` (J4, D3), `job-overview`,
`job-quick-overview`, `mv-start` (J8), `ms-switch-open`, `cw-customer-view`,
`ls-job-sent`, `ls-job-check`, `ls-customer-pick`, `rs-delivery` (J6). Later
notes changed: `j09_later`, `j10_later`, `jb_later`, and a new `j17_later`.

Drawings changed only behind a line (not shown on the one canvas, kept true
for the journey canvases): `mv-morning`, `mv-today-refresh`,
`ws-page-switch-over`, `ws-page-changes`.

## Done when

1. `node --test docs/design/user-journeys/generator/consolidate/` passes, with
   B0's new check seen failing first.
2. `node build.mjs` builds the one canvas; `fitcheck-canvas.mjs` passes (at
   most 200 notes, 512 files; no "undefined"; no two notes at one spot).
3. A search of `out/project/*.dc.html` for each of these finds nothing on a
   kept board: "practice" (case-insensitive), "Clear and go real",
   "Signed-in devices", "Sign out everywhere", "Alerts on Today", "On Today"
   (as a log tag), "Seen by Jack Lewis", "Send feedback", "records about you",
   "Waiting for invoice", "Invoice checked", "Add the invoice", "Supplier
   invoices booked in", "under Theme", "point [your address]", "Switch site",
   "Find it", "printed by Jack Lewis", "Jo Taylor · 09:05".
4. Every (b) line above appears, word for word, in `out/project/canvas.json`.
5. Each group's own module still builds its journey canvas (`build-*.mjs`)
   without errors.
6. A fresh reviewer walks this list against the built canvas, line by line,
   before anything is published; publishing waits for Jack's yes.

## Not included — needs Jack

1. The Reports strip's details: which shops when the menu is on one shop,
   which period, takings with or without VAT, the no-cost and unsent gaps,
   what a shop's link opens — walk-through 11 H1; walk-through 7 H1 (the two
   reports disagree; walk 11's choice 1 would reopen Multiple sites 1).
2. One meaning of "takings" everywhere — walk-through 11 H2.
3. Labour in the Margin report — walk-through 11 M2.
4. Cycle to Work commission in Margin — walk-through 5 M3.
5. Walk-through 8 decision 1 says "Signed-in devices lists it", but question
   5 put Signed-in devices off: how the owner sees and stops a workshop
   computer, and where "Check Jo Taylor out of Till B1" (drawn over the devices
   list) now lives — walk-through 8 H3.
6. Decision 8 as two new screens (drawn here, T1) or as lines and one pop-up
   — walk-through 1 H1 (second check), walk-through 8 M3, walk-through 10 H1.
7. Whether a till-only person can open Online orders and mark them ready —
   walk-through 10 M1.
8. A till-only worker's forgotten PIN with no manager in — walk-through 10 M2;
   walk-through 4 M4.
9. Jo's first PIN when the front-desk computer is the till — walk-through 4
   M3.
10. What the tills do while running alongside, now practice is dropped —
    walk-through 4 H2.
11. Where the fixed website's words and photos are edited, and what happens
    to `ws-page`'s Pages row and "2 pages still have starting wording" (and
    the move checklist's item that waits for it) — walk-through 4 H3.
12. Whether a fixed design keeps the shop's own colour: `ws-start-look`'s
    colour step and the kept `site-ocean` board ("a shop's own theme", App map
    3) — not in a report; found while writing this list (question 2 says "no
    theme editor").
13. Where a noted offline refund reminds people — walk-through 2 H1.
14. Catching a cost that went up, now the invoice check is later —
    walk-through 3 M3.
15. How a job's part becomes "On order" — walk-through 3 M7.
16. Maya's book-in time: 09:12 (drawn here, D1) or "[time]" — walk-through 1
    L3.
17. Keeping the older "Bike ready" picture `j05-ready` beside `cp-summary` —
    walk-through 1 L6.
18. `bk-page` shows "Deposit paid" on Maya's no-deposit booking: redraw the
    board, or add a line — walk-through 1 M3; walk-through 12 M6.
19. "Call me before any extra work" against a quote sent by text —
    walk-through 12 H1.
20. Draft the four customer texts now, or at Q9 — walk-through 12 M2.
21. Opening the Cycle to Work order without signing in — walk-through 12 M4.
22. The till's search: open a result as well as sell it — walk-through 9 H1.
23. Price and stock in product results — walk-through 9 M2.
24. Whether a job made by staff sends Maya a message — walk-through 9 L4.
25. Marking journey 21's lines "after the trading week" — walk-through 6 M4.
26. Which state the `cw-cancel` board draws (its Next box and history
    disagree; the fix overlaps an existing line) — walk-through 5 M4.
27. What Staff see in a Cycle to Work order's More menu — walk-through 5 L4.

## Left out: fixes with no recorded decision behind them

Real findings, but each would add something no decision has settled, so they
wait for a later pass (or for Jack): walk-through 1 L1, L2, L6 (Maya's request
line), L7; walk-through 2 L1, L3; walk-through 3 M5, M6, L1, L3 (except
"Switch site", A4); walk-through 4 L1 (the Online orders path), L2, L3;
walk-through 5 L1, L2 (the doubled Today line), L3, L5; walk-through 6 L1, L2,
L4, L5, L7; walk-through 7 L1 (moving lines between boards; the role fix is
J4), L3 (written tablet and phone rules for every journey), L4;
walk-through 8 H1's "Now working: Jo Taylor is announced" and "Digits can be
typed"; walk-through 9 M1, M4, M5, L1, L2, L3; walk-through 10 M3, L1, L2;
walk-through 11 L1; walk-through 12 M3, M5, L1, L2, L4, L5, L6, L7.

Left out by instruction: every dead-link finding (walk-throughs 1 M1, 2 M2,
3 M8, 4 M2, 5 M1, 6 M1, 7 M3, 8 M1 and M2, 9 M3, 10 M4, 11 M4, 12 M1) is step
5's mockup; "what's different" on situation lines (walk-through 1 M2,
walk-through 2 M1) and the "Tablet and phone ↗" link (walk-through 2 L4) are a
separate question.

## Decision log

Kept here as the work goes: each decision taken while drawing, what changed,
and why.

- 3 Oct: decision 8's "Two new till screens" is drawn as two screens (T1),
  as decided; the reports' "lines instead" is left for Jack (item 6).
- 3 Oct: walk-through 6's "rung up by hand" hint (L3) is included as a fix
  the first walk already took, following the second check, not as a new
  choice.
- 3 Oct: the "[Second site] · [n] steps to get it ready" line goes on
  `ms-switch-open`, not `op-today`, because the fix it comes from keeps
  `op-today` a one-shop board.

### Done (3 Oct)

- All changes made except R1 (the Reports strip), which waits on Jack's
  answer to "needs Jack" item 1. Built: 213 files, 174 notes; plan check 7/7;
  `fitcheck-canvas.mjs` 0 problems; none of the done-condition's banned
  phrases on any board.
- Fresh review fixes: the website's "4 unpublished changes" → 3 (W5 took one
  out); `rp-your-settings` drops the Help cards like the other Your settings
  drawings; the new till screens titled as T1 says ("…at the till"),
  "Workshop job · WH-1042" like "Online order · [order number]", "Not now"
  instead of "Back" on book-in, and `till-collect`'s "Tick each item as you
  hand it over".
- Logged, not changed: `mv-ready` retitled "one still to do" (it follows from
  MV3); `rs-delivery` still sits in the row "Checking the invoice"; the
  `ws-history` box still lists "Home page, Theme colour" and "Going back puts
  that version in the editor", as W1 left it; `till.mjs` copies the storage
  list from `diary.mjs` (it isn't exported); `job-checklist` shows the
  "Working: Alex Morgan · Switch" bar while the sidebar still says "Sign out"
  — both are right for different devices (a shared workshop computer checks
  out; Alex's own tablet signs out), so the diary's shared sidebar is left.
- Implementer choices the review accepted: the switch-over morning's website
  step is the current step, with "Turn it on" (wording from `website.mjs`);
  deferred Settings folds are still drawn on the deferred boards that open
  them; W3's "Wheelhouse sets up your own address for you".
- R1 drawn after Jack's answer (3 Oct, "1": the strip follows the shop menu):
  Takings, Margin (owners and anyone with "Can see costs and margin") and the
  shop as a link, above the report cards on `rp-home`; the period, VAT basis
  and link target stay bracketed. A line on `rp-home` covers "All shops".
  The strip pushes "Your reports" partly below the board's edge, as the page
  would scroll.
