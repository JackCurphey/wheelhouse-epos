# Draw the answers: the second change list for the one canvas

Issue #116 step 4, second drawing pass. The first pass
(`2026-10-03-draw-the-decisions.md`) drew the decisions recorded before the
second walks; its changes are done and are not repeated here. This pass draws:

- **(A)** Jack's answers of 3 Oct to the walk-through questions, recorded as
  "Later change (3 Oct 2026, walk-through …)" notes at the bottom of the
  decision files (commit `bb2b6d8`, "Not drawn yet" in every one);
- **(B)** every fix in the twelve second-walk reports
  (`docs/design/user-journeys/walk-2/`) that the report and its second check
  call "no choice", that the first pass didn't do, and that isn't left out
  below.

Sources read 3 Oct: the twelve reports (refuted parts left out, second-check
corrections and severity changes used), the first spec with its "Done" notes,
the 23 notes from `bb2b6d8`, the generator on `design/one-canvas`, and the
built canvas in `generator/out/project/` (built 3 Oct 17:50: 174 notes, 211
boards, 213 files including `Main`, `Workflow` and `canvas.json`).

## The rules for this pass

1. **Only what an answer, a recorded decision, or a confirmed no-choice fix
   says.** Every change names its source: the decision file and its 3 Oct note,
   or the report and finding. Anything that still needs a choice is in "Still
   needs Jack" at the end, one line each.
2. **Lines before drawings** (README rule 1: draw a situation only if it
   changes the layout a lot). A change is one of:
   - **(a)** edit an existing drawing (wording, example data, a role label, a
     row added or taken off, screen-reader markup);
   - **(b)** add a line to a board's situation list, given as
     "situation — who · decision", or move a line;
   - **(c)** a new drawing, only where a decision asks for one. **There is
     none in this pass.**
3. **Wording comes from the decision notes, the drawings or the reports' fix
   text.** Example data stays the drawings' own (Maya Patel, WH-1042, Trek
   Domane AL 3, Jo Taylor, Alex Morgan, Jack Lewis, North Street Cycles,
   Bolton, [Second site]); anything unknown stays bracketed ([£], [n], [date],
   [time], [Name]). The one exception is S7: the three customer texts are new
   wording because the answer asks for drafts (build plan Q9, walk-through 12
   M2), marked as drafts for Q9's read-through.
4. **Left out on purpose:**
   - every dead link between boards (step 5's clickable mockup), including
     buttons that should be links (walk-through 12 L2);
   - "what's different" phrases on situation lines: that pass is running now
     in `consolidate/*.mjs` (`into(id, decision, diff)` and the new README rule
     2 check in `check.test.mjs`). **No group below edits an existing `into()`
     entry.** The few changes that must (moving a line, a duplicate line, a
     board swap) are in group Z, which waits until that pass is merged.
5. **Grouped by generator module**, so implementers working at the same time
   never edit the same file. Each group owns its module and, in its journey's
   `consolidate/jNN.mjs`, **only** the `lines` export and `keep`/`later`
   entries. `journeys.mjs` (titles and roles) and `build.mjs` each have one
   group. Line numbers are approximate (3 Oct, `design/one-canvas`).
6. **Visual changes wait for Jack.** Seven fixes below change text size
   (marked **visual**). The reports call them no-choice accessibility fixes,
   but the global rules say no visual change without asking, so they are
   drawn only after Jack says yes to this list.
7. **Budgets.** Canvas notes: limit 200, now 174; this pass adds one
   (`jb-cust-signin`'s new list, N6) and group Z takes one away
   (`bk-request`'s list goes with the board, Z1): 174 at the end. Files: limit
   512, now 213; CP1 and Z1 each take a board off: 211 at the end. Long lists
   grow (`till-sale` 21 → 25 lines, `cw-order-held` 13 → 14), so
   `fitcheck-canvas.mjs`'s "no two notes at one spot" must be re-run.

## Before anything else

**B1 — tag the Lightspeed lines (`build.mjs`, `consolidate/check.test.mjs`).**
Lightspeed shops, later change (3 Oct, walk-through 6 M4): "Every Lightspeed
situation line on the one canvas is tagged 'after the trading week
(build-plan question 5)' where it sits … The lines stay beside the screens
they change." There are about 20 such lines in other journeys' files
(`bk-page`, `bk-cancel`, `dq-quote` ×3, `cp-summary` ×3, `op-today` ×5,
`set-msg-list`, `set-workshop-services`, `cs-page`, `ops-log`), and editing
each `into()` would collide with the "what's different" pass. So the tag is
added by the build: in `situationText()` (~315–323), a line whose folded
screen is in journey 21, or whose text or decision says "Lightspeed", ends
with " · after the trading week (build-plan question 5)". `lines` entries
follow the same rule. Test first: a check that every situation line in the
built notes mentioning "Lightspeed" ends with the tag; watch it fail on
today's build, then make it pass. The retitle is J1.

**Z0 (group Z only, after the "what's different" pass) — a "same as" entry
(`consolidate/plan.mjs`, `check.test.mjs`).** Two old drawings are the same
board as another folded one, so their line is a duplicate (walk-through 5 L2,
walk-through 6 L1). Add `same(id)`: the screen is the same drawing as `id`
(itself an `into()`), so it gives no line and isn't listed as later. The check
fails when `id` isn't an `into()` screen. Test first, as B0 was.

## Changes, by module

Totals: 47 (a), of them 7 visual; 34 (b) changes adding 46 lines; 0 (c);
group Z: 7 line moves or merges; build changes B1 and Z0.

### 1. `journeys.mjs` — titles and roles (6 a)

| Id | Change | From | Board / line | Line | Type |
|---|---|---|---|---|---|
| J1 | Journey 21 name "Lightspeed shops (Release 1)" → "Lightspeed shops (after the trading week, build-plan question 5)" | Lightspeed shops, 3 Oct (walk-through 6 M4): "journey 21 is retitled to say so instead of '(Release 1)'" | `j21_title` note | ~1208 | a |
| J2 | `tr-receive` "Receiving a transfer: one short" → "Receiving a transfer: 1 missing"; `tr-today-short` "Today: a transfer arrived short" → "Today: a transfer arrived with 1 missing" | Walk-through 3 L3 (the word list says "1 missing") | lines under `rs-receive` and `op-today` | ~902, 904 | a |
| J3 | `st-adjust` role "Staff" → "Owner" (drawn with Jack Lewis signed in, cost and margin behind the box; its own line already says Owner) | Walk-through 3 L1; Stock control 11 | `st-adjust` board | ~891 | a |
| J4 | `tr-sites` "A product's stock at each shop, and on its way" role "Manager" → "Staff" | Stock control, 3 Oct (walk-through 9 M2): "This settles that Staff see the other shop's count (the product page's 'stock at each shop' line was marked Manager without a decision)" | line under `st-product` | ~899 | a |
| J5 | `till-give-pin` title "Till only (no email) — the Owner or a manager gives the PIN at the till, screen turned to the person" → "No PIN yet — the Owner or a manager gives it at the till, screen turned to the person" | Signing in, 3 Oct (walk-through 4 M3): "can give anyone their first PIN at the till, as they already do for till-only people" | line under `pin-change` | ~109 | a |
| J6 | `pending`: give the Release 1 picture the title "Request received — Release 1 picture, replaced by bk-request" (`d('pending', { title: … })`; `build.mjs` reads `x.title` first) | Walk-through 12 L5 | `jb-pending` board | ~116 | a |

### 2. `build.mjs` (B1 only)

B1 above. Nothing else in this pass touches `build.mjs`.

### 3. `app-map.mjs`, `stage1.mjs` and `consolidate/ja.mjs` (3 a, 4 b)

- **A1 (a) — the till's search is a combobox.** `app-map.mjs` `searchResults()`
  ~47–52 and its input ~58: follow the website search's pattern
  (`browse.mjs` ~175, 190): the box gets `role="combobox"`, `aria-expanded`,
  `aria-controls`; rows become `role="option"`, the highlighted one named by
  `aria-activedescendant`; the result count and "No products match" are
  announced (`role="status"`). Walk-through 9 M5. Boards: `till-search`, and
  every till board drawn with the search open.
- **A2 (a) — the app map's search sentence.** `app-map.mjs` ~357: "Search sits
  at the top of every page (on the till it finds products too)" → "Search sits
  at the top of every page; on the till, a result can also go into the basket."
  Walk-through 9 M1 (its fix wording). Board: `map`.
- **A3 (b) — `till-search`, three lines.**
  - "Each result row: its name opens the job, customer or product; a button on
    the right does the till action; Enter and scanning still do the till action
    — Staff · App map, 3 Oct (walk-through 9 H1)".
  - "A job row shows its stage and ready-by date: Waiting for parts · ready by
    Thu 17 Sep · approved £111.00 — Staff · App map, 3 Oct (walk-through 9 H1)".
  - "A product row shows its price and [n] in stock here · [n] at [Second
    site], for everyone, Staff included — Staff · Stock control, 3 Oct
    (walk-through 9 M2)".
- **A4 (b) — `staff-app`.** "Search open on any staff page: the same groups
  and rows as the till's search; each row opens its page; no till buttons —
  Staff · App map 2; Customer service 12; walk-through 9 M1".
- **A5 (b) — `till-rail`.** "Till only (no email): the rail opens the till and
  Front desk › Online orders, so they can mark online orders ready; every other
  room stays hidden — Staff · Walk-through 8 decision 8; 3 Oct (walk-through
  10 M1)".
- **A6 (b) — `site`.** "A Lightspeed shop: no Shop or Basket in the header —
  Customer · Lightspeed shops 10 (H1); walk-through 6 L4" (B1 adds the tag).
- **A7 (a) — `stage1.mjs` ~271, ~279:** "maya@example.com" →
  "maya@example.test", if any kept board uses these frames (check with a
  search of `out/project` after the build; otherwise log it and leave).
  Walk-through 12 L1, walk-through 9 L1.

### 4. `signin.mjs` and `consolidate/jb.mjs` (4 a, 1 visual; 2 b)

- **N1 (a) — the till's "No PIN yet?" line.** `signin.mjs` `noPinLine` ~121:
  "No PIN yet? Sign in to Wheelhouse on a phone or computer — it gives you one.
  No email? Ask the owner or a manager." → "No PIN yet? Sign in on your phone,
  or ask the owner or a manager to give you one here." (exact words of the
  answer). Signing in, 3 Oct (walk-through 4 M3). Board: `till-checkin`.
- **N2 (a) — the PIN is for workshop work too.** ~130 "Your PIN checks you in
  and puts your name on sales" → "…puts your name on sales and workshop work";
  ~156 (first PIN) "This PIN checks you in at the till and puts your name on
  sales" → "…on sales and workshop work". Walk-through 8 M5 (its fix wording);
  walk-through 8 decision 1. Boards: `till-checkin`, `pin-change` and the
  first-PIN line's drawing.
- **N3 (a) — the code can be pasted and filled in.** `codeBox` ~207: one field
  with `autocomplete="one-time-code"` and `inputmode="numeric"`, drawn to look
  like the six boxes; the email field on `cust-signin` gets
  `autocomplete="email"`. Six digits and 10 minutes stay (Signing in 5).
  Walk-through 12 M3. Boards: `cust-code`, `cust-signin`.
- **N4 (a) — one address for Maya.** ~212 and the `cust-signin` email field:
  "maya@example.com" → "maya@example.test". Walk-through 12 L1; walk-through 9
  L1. Boards: `cust-signin`, `cust-code`.
- **N5 (b) — `till-checkin`, three lines.**
  - "While running alongside Citrus Lime: Sales start on switch-over day,
    [date] · keep using Citrus Lime until then; check-in, search, customers and
    jobs still work — Staff · Moving from Citrus Lime, 3 Oct (walk-through 4
    H2)".
  - "Forgotten PIN: the owner or a manager gives a one-time PIN from their
    phone, read out over a call; you change it here at check-in — Staff ·
    Signing in, 3 Oct (walk-through 10 M2)".
  - "The keyboard's number keys work too — Staff · Walk-through 10 L1".
- **N6 (b) — `cust-signin`** (no list today; this starts one, +1 note). "From
  a booking: you come straight back to your booking — Customer · Book a repair
  6, 9; walk-through 12 L6".
- **N7 (a, visual) — `till-checkin` text size.** "Bolton · North Street
  Cycles" (12px, opacity 0.8) and "Checked in today" (12px) → at least 13px,
  full colour. Walk-through 4 L2 (part 2).

### 5. `setup.mjs`, `settings-frame.mjs` and `consolidate/j08.mjs` (4 a, 4 b)

- **S1 (a) — till only opens Online orders.** `setup.mjs` ~274: "They don't
  sign in to Wheelhouse, so they can't open anything away from the till." →
  "They don't sign in to Wheelhouse, so they can't open anything away from the
  till except Front desk › Online orders." Walk-through 8 decision file, 3 Oct
  (walk-through 10 M1). Board: the `set-staff-invite` line "Add someone with
  no email: till only" (its drawing).
- **S2 (a) — a forgotten PIN from your phone.** ~275: after "A forgotten PIN is
  cleared and given again the same way." add "Or use Give a new PIN on their
  page, from your phone: it shows a one-time PIN to read out over a call, and
  they change it at check-in." Signing in, 3 Oct (walk-through 10 M2). Same
  drawing as S1.
- **S3 (b) — `set-staff-person`.** "Give a new PIN, from your own phone: a
  one-time PIN to read out over a call; they change it at check-in — Owner and
  Manager · Signing in, 3 Oct (walk-through 10 M2)".
- **S4 (a) — Getting started while running alongside.** ~485 (`moving`
  version): "Your tills are in practice until switch-over — do these in any
  order." → "Running alongside Citrus Lime: the tills start on switch-over day."
  Moving from Citrus Lime, 3 Oct (walk-through 4 H2). The moving version is
  on `j08_later`, so this is behind the later list; it also takes a "practice"
  wording off.
- **S5 (b) — `fr-today`.** "Running alongside Citrus Lime: the tills start on
  switch-over day — Owner · Moving from Citrus Lime, 3 Oct (walk-through 4
  H2)".
- **S6 (a) — Getting started's website step ticks on the one rule.** ~443:
  "the website's three-step start is done" → "no Words and photos row says
  Check this". Website management, 3 Oct (walk-through 4 H3): "the move's
  checklist and Getting started tick 'the website is ready' on that one rule".
  Board: `fr-today`.
- **S7 (b) — `set-msg-list`, three draft texts.** Build-plan questions, 3 Oct
  (walk-through 12 M2): drafted now as lines on Settings › Messages, each saying
  who it's from, what to do, and that no app or sign-in is needed; read again
  at Q9. Pattern: the drawn Bike ready text (`editMsgDialog` ~397).
  - "Request received, draft: Hi Maya, North Street Cycles, Bolton has your
    request for a Standard service on your Trek Domane AL 3, Thu 17 Sep, 11:30.
    We'll let you know when it's confirmed. See your booking: [link] — no app or
    sign-in needed. Job WH-1042. — Manager · Build-plan questions Q9, 3 Oct
    (walk-through 12 M2)".
  - "Booking confirmed, draft: Hi Maya, your Standard service at North Street
    Cycles, Bolton is booked for Thu 17 Sep: bring your Trek Domane AL 3 at
    11:30. See or change your booking: [link] — no app or sign-in needed. Job
    WH-1042. — Manager · Build-plan questions Q9, 3 Oct (walk-through 12 M2)".
  - "Quote to approve, draft: Hi Maya, North Street Cycles, Bolton has a quote
    for more work on your Trek Domane AL 3. See it and say yes or no to each
    part: [link] — no app or sign-in needed. Job WH-1042. — Manager ·
    Build-plan questions Q9, 3 Oct (walk-through 12 M2)".
- **S8 (b) — `set-till-quick`** (it carries the Tills list line), two lines.
  - "Workshop computers, listed beside the tills: [name] · … › Stop using as a
    workshop computer — Owner · Walk-through 8 decision 1; 3 Oct (walk-through
    8 H3)".
  - "A till's …: Check Jo Taylor out — Owner · Walk-through 8, 3 Oct
    (walk-through 8 H3)".

`settings-frame.mjs` needs no change in this pass.

### 6. `till.mjs` and `consolidate/j11.mjs` (4 a, 3 b)

- **T1 (a) — the held-for-a-job warning is announced and says what it costs.**
  `till.mjs` ~84: the basket line's `warn` span gets `role="status"`; ~134
  `till-held-job`: "1 held for job WH-1042 — sold anyway" → "1 held for job
  WH-1042 — selling it leaves Maya's job waiting for parts". Never blocks the
  sale. Walk-through 3 M6 (its fix wording). Drawing behind the `till-sale`
  line "Selling pads held for job WH-1042".
- **T2 (a) — `till-customer`.** ~175 "maya@example.com" → "maya@example.test".
  Walk-through 9 L1.
- **T3 (a) — Maya's book-in time is [time].** ~453 (`till-book-in`'s tag):
  "09:12 · printed by Jo Taylor" → "[time] · printed by Jo Taylor"; update the
  comment ~450. Walk-through 8 decision file, 3 Oct (walk-through 1 L3):
  "'[time]' everywhere (job note, tag, quote page) … Replaces fix L1's 09:12."
- **T4 (a) — the noted-refund box names both reminders.** ~487: "When the till
  is back online, Today shows '[n] refunds to finish'." → "When the till is
  back online, Today shows '[n] refunds to finish', and Past sales shows the
  count." UX walk-through decisions, 3 Oct (walk-through 2 H1). Drawing behind
  the `till-sale` line "Offline refund noted for later".
- **T5 (b) — `till-sale`, four lines.**
  - "A refund noted while offline, still to finish: Past sales carries the
    count — Staff · UX walk-through decisions 5; 3 Oct (walk-through 2 H1)".
  - "While running alongside Citrus Lime: Take payment is off until switch-over
    day — Staff · Moving from Citrus Lime, 3 Oct (walk-through 4 H2)".
  - "A job already paid online can't go in the basket; it says Paid online ·
    [date] — Staff · Collect and pay 5 (H3); walk-through 10 H2".
  - "After closing time, for someone who can't close the day: Closing up?
    [Name] closes the day. If nobody who can is in, just check out; the drawer
    is counted when the shop next opens — Staff · Cash-up 5; Opening the shop
    7; walk-through 10 M3".
- **T6 (b) — `till-refund`.** "Finishing a noted refund: the sale and items
  already filled in — Staff · UX walk-through decisions 5; 3 Oct (walk-through
  2 H1)".
- **T7 (b) — `till-collect`.** "Handed over: Handed over · Undo for a few
  minutes — Staff · Collect and pay 5 (M4); walk-through 10 L2".

### 7. `opening.mjs` and `consolidate/j10.mjs` (1 b)

- **OP1 (b) — `op-today`.** "[n] refunds to finish · Finish: finishing one
  opens the refund with the sale and items filled in — Owner, Manager, or
  anyone with Can close the day · UX walk-through decisions 5; 3 Oct
  (walk-through 2 H1)". ("To those who see Needs attention": Opening the shop
  3, 4.)

### 8. `cashup.mjs` and `consolidate/j16.mjs` (1 a)

- **E1 (a) — `eod-z` labels.** `cashup.mjs` ~157–158:
  - `row('Sales', …)` → `row('Takings', …)`; the online line "Online payments
    today: £[£] — see Reports" → "Online money is not in this till's takings:
    £[£] today — see Reports". Reports and accounts, 3 Oct (walk-through 11
    H2): "the end-of-day report … says 'Takings' instead of 'Sales' … says that
    online money is not in it".
  - `row('Card machine', …)` → `row('Card', …)`; "Gift cards, credit,
    accounts, other" → "Gift cards, store credit, customer accounts, other", so
    the till's report matches the saved day (`rp-day`). Walk-through 2 L3
    (and its second check's extra pair). The card machine check in Close the
    day ("Card machine payments in Wheelhouse", ~139) stays: it is about the
    machine.

### 9. `reports.mjs` and `consolidate/j17.mjs` (3 a, 1 visual; 1 b)

Reports and accounts, 3 Oct (walk-through 11 H2): "'Takings' has one meaning
everywhere: all money for sales in the period, with VAT, refunds taken off,
online and Cycle to Work money in, and an open day counted 'so far' … The
closed-days figure is 'Closed days' takings' … Labels only."

- **R1 (a) — "Takings" on Sales, Change what's shown and the saved day.** Every
  `'Takings (with VAT)'` (~164, ~174, and where `rp-change` and `rp-day` draw
  it) → `'Takings'`. ~168 note "Takings include VAT and take refunds off." →
  "Takings include VAT, take refunds off, and count online and Cycle to Work
  money; today counts so far." The strip's comment ~132–138: takings are with
  VAT (settled), so only the period and the link's target stay bracketed.
  Boards: `rp-sales`, `rp-change`, `rp-day`, `rp-home` (comment only).
- **R2 (a) — `rp-takings`.** ~224: the closed-days figure → "Closed days'
  takings".
- **R3 (a) — labour out of margin.** Reports and accounts, 3 Oct (walk-through
  11 M2): "Labour is left out of margin and shown beside it: 'Labour £[£] · not
  in margin'. Margin, on the strip and in Margin and stock value, is on goods
  only." ~42 `MARGIN_ROWS`: drop 'Labour'; under the table add "Labour £[£] ·
  not in margin" and the note "Margin is on goods only." Board: `rp-margin`.
- **R4 (b) — `rp-margin`.** "Cycle to Work bikes: margin after the provider's
  commission, taken from the provider's settings at the sale and corrected when
  the bike is marked paid, so a closed day's margin can move — Owner · Reports
  and accounts, 3 Oct (walk-through 5 M3)".
- **R5 (a, visual) — comparison lines at 14px.** ~70 `stat()`: the "[Up or
  down] £[£] on the same days last week" span 12px → 14px. Walk-through 11 L1.
  Boards: `rp-sales`, `rp-margin`, `rp-takings`.

### 10. `sites.mjs` and `consolidate/j19.mjs` (1 a, 1 b)

- **SI1 (a) — Today, all shops.** ~85 `head('Sales so far')` → `head('Takings
  so far')`. Walk-through 11 H2 (as above). Drawing behind the `ms-today-all`
  line.
- **SI2 (b) — `ms-switch-open`.** "On tablet and phone, at a business with more
  than one shop: North Street Cycles · Bolton (or All shops) under each page's
  title, 14px — Staff · Multiple sites 11; walk-through 7 L2, L3". (The 14px is
  the first walk's L2 fix, taken.)

### 11. `diary.mjs`, `job-page.mjs` and `consolidate/j12.mjs` (2 a, 3 b)

- **D1 (a) — Maya's book-in time is [time].** `diary.mjs` ~379 `when: '09:12'`
  → `'[time]'`; ~2285 and ~2362 "09:12 · printed by Jo Taylor" → "[time] ·
  printed by Jo Taylor"; comment ~370. Walk-through 8 decision file, 3 Oct
  (walk-through 1 L3). Boards: every board showing the note or tag (17 today:
  `job-overview`, `job-quick-overview`, `job-checklist`, `diary`,
  `request-new`, `new-job`, `dq-record-answer`, `staff-app`, `your-settings`,
  `pin-change`, `till-book-in` (T3), and the `ls-*` job boards).
- **D2 (a) — the customer link's name.** `job-page.mjs` ~74, ~92, ~331:
  `aria-label="View ${name}'s account"` → `"Open ${name}'s page"` ("account"
  means pay-later elsewhere). Walk-through 9 L2.
- **D3 (b) — `job-overview`, two lines.**
  - "A part added with no free stock (stock less holds): it goes on the For
    customers restock list by itself, and the line reads On order once that
    part is on an order marked ordered — Mechanic · Receiving stock, 3 Oct
    (walk-through 3 M7)".
  - "At a Lightspeed shop: the Lightspeed strip under the header, Hand over in
    place of Take payment, and the header tag reads Agreed — Staff · Lightspeed
    shops 10; walk-through 6 L5" (B1 adds the tag).
- **D4 (b) — `new-job`.** "Saved: Booking confirmed sent to 07700 900 142, or No
  message — no phone or email — Staff · Book a repair 12; 3 Oct (walk-through 9
  L4)".
- **D5 (b) — `diary`.** "Maya's own request, WH-1042, with no deposit, in
  Waiting for you — Staff · Walk-through 1 L6" (the existing line is a request
  with a deposit; the second check refutes only "no line at all").

### 12. `quote.mjs` and `consolidate/j04.mjs` (1 a, 1 visual)

- **Q1 (a) — `quote.mjs` ~143:** "booked in Thu 17 Sep at 09:12" → "booked in
  Thu 17 Sep at [time]"; comment ~16. Walk-through 8 decision file, 3 Oct
  (walk-through 1 L3). Drawing behind the `dq-quote` "in the shop" line.
- **Q2 (a, visual) — `dq-quote` text size:** "Your answers are final once
  sent." (13px) and "Needed", "Optional", "Waiting for your answer" (12px) →
  the page's body size (15px). Walk-through 12 M5.

### 13. `book.mjs` and `consolidate/j03.mjs` (2 a, 1 visual; 1 b)

- **BK1 (a) — "Ask me", not "Call me".** Drop off and approve the quote, 3 Oct
  (walk-through 12 H1): "'Call me before any extra work' becomes 'Ask me before
  any extra work', and the pages that repeated 'We'll call you before any extra
  work' say 'We'll send you the quote to approve, or call us'."
  - ~147 the radio "Call me before any extra work" → "Ask me before any extra
    work".
  - ~53 `LIMIT` and ~106 `'We’ll call you first'` → "We'll send you the quote
    to approve, or call us". Update the comment ~51–52.
  - Boards: `bk-bike`, `bk-request`, `bk-page`, and the booking bar wherever it
    shows "Extra work".
- **BK2 (a) — `bk-page` without a deposit.** ~366 `def('bk-page', …)`: draw
  Maya's confirmed page with `deposit: false` (her path has none; `bk-request`
  already has none). `bookingLines`' default (~227) is unchanged for the
  deposit line. Walk-through 1 M3 (High after its second check);
  walk-through 12 M6.
- **BK3 (b) — `bk-page`.** "Confirmed, after paying a deposit: Deposit paid
  £[deposit] and Free to cancel until [date and time] — Customer · Book a
  repair 8; walk-through 1 M3". (Tell the "what's different" pass: the
  `bk-page-dropoff` diff "no deposit rows" is no longer a difference.)
- **BK4 (a, visual) — `bk-when` text size:** "Full", "Closed" and "[n] times"
  on the day strip (12px) → body size. Walk-through 12 M5.

### 14. `online.mjs` and `consolidate/j02.mjs` (2 a, 1 b)

- **ON1 (a) — checkout agrees with the basket.** The basket has the pads at 2
  and "Basket, 3 items". ~165 `basket: 2` → `3`, and ~145 the pads row
  `sumRow(PADS.name, PADS.price)` → the pads "× 2" with "£[£]". Walk-through
  12 L4. Boards: `on-checkout` and the checkout lines.
- **ON2 (a) — a guest paid no store credit.** ~46 `PAID_BY` on `on-confirmed`:
  "Card" only (store credit is for signed-in customers, ~313). Walk-through 12
  L4.
- **ON3 (b) — `on-orders`.** "Till only (no email): this page opens from the
  till, so a till-only worker can mark orders ready — Staff · Walk-through 8
  decision 8; 3 Oct (walk-through 10 M1)".

### 15. `c2w.mjs` and `consolidate/j06.mjs` (3 a, 1 visual; 3 b)

- **CW1 (a) — `cw-cancel` in a state that can happen.** ~393: today it draws
  "Waiting for a £[£] deposit before ordering" beside a history that has the
  deposit taken and no order, and a pop-up saying the bike "goes back on sale"
  though it was never in the shop. Draw it as "Deposit paid, bike ordered"
  (`next: 'depositPaid', deposit: 'refund', hist: [… 'deposit', 'ordered']`),
  with the pop-up's ordered version and the deposit refunded by the shop's rule
  for a customer who pulls out. That keeps it different from the line
  "Cancelling after ordering: the deposit kept" (the second check's caution).
  `cancelOrder()` ~244–247 needs that variant: "The bike was ordered from
  [supplier] on [date], after Maya paid a £[£] deposit" with "Deposit: £[£]
  refunded, the way it was paid — your rule for a customer who pulls out" (both
  drawn wordings). The board's title "The customer isn't going ahead: a deposit
  to refund" still fits. Walk-through 5 M4.
- **CW2 (b) — `cw-cancel`.** "Cancelling before the bike is ordered, with no
  deposit held: no deposit line; an in-stock bike goes back on sale at Bolton —
  Staff, Owner and Manager · Cycle to Work 4, 7; 3 Oct (walk-through 5 L4);
  walk-through 5 M4".
- **CW3 (b) — `cw-order-held`.** "More, as Staff: Cancel the order when it
  holds no deposit; with a deposit held, A deposit is held: ask a manager to
  cancel — Staff · Cycle to Work 7; 3 Oct (walk-through 5 L4)".
- **CW4 (b) — `cw-customer-view`, two lines.**
  - "Collected: the bike and its frame number — Customer · Cycle to Work 6, 7;
    walk-through 5 M2" (the third of M2's lines; the first pass added the other
    two).
  - "Opened from the email's See your order: a private link, no sign-in, like a
    repair's; also in the website account when signed in — Customer · Cycle to
    Work 7; 3 Oct (walk-through 12 M4)".
- **CW5 (a) — the history follows the quote when the bike isn't in stock.**
  ~114 `EV.quote` ends "it says the bike is put aside until [date]". Add two
  versions for the not-in-stock histories, ending with the quote's own closing
  sentence (`CLOSING.applied`, `CLOSING.deposit`, ~183–184), and use them where
  `hist` starts `['quote', 'toOrder' …]` or `['quote', 'toOrderDep' …]`
  (~357–365, 377, 393–396). Walk-through 5 L1. Boards: `cw-applied`,
  `cw-order-anyway`, `cw-cancel` and the order-page lines.
- **CW6 (a) — the certificate tick's hint.** ~213: "Untick if it needs work
  first. Maya is sent 'Certificate received' now, and 'Ready to collect' when
  you mark it ready." → "Leave it ticked if the bike can go now. Untick it if
  it needs work first: Maya is sent 'Certificate received' now, and 'Ready to
  collect' when you mark it ready." Walk-through 5 L1. Board: `cw-certificate`.
- **CW7 (a, visual) — `cw-list` status text:** "Hold ends in [n] days", "Ready
  to order" and the top line (12px) → at least 14px. Walk-through 5 L3.

### 16. `collect.mjs` and `consolidate/j05.mjs` (1 b, a board off)

- **CP1 (b) — the older "Bike ready" picture becomes a line.** Collect and pay,
  3 Oct (walk-through 1 L6): "The older-style 'Bike ready' picture (`ready`)
  becomes a line in `cp-summary`'s situation list and leaves the canvas as a
  board (README rule 5 …). Changes decision 6, which kept it."
  `consolidate/j05.mjs` ~50 `'ready': keep(37)` → `into('cp-summary', 'Collect
  and pay 6; 3 Oct (walk-through 1 L6)', <diff>)`, with the diff written from
  the picture itself (`shots/screens.json` id `ready`), as the README rule 2
  check now requires. Board `j05-ready` leaves (−1 file).

### 17. `receiving.mjs` and `consolidate/j13.mjs` (3 b)

- **V1 (b) — `rs-delivery`.** "Booked in, as someone who can order stock: each
  line has Cost went up? Change it, and the product's cost and history record
  it — Owner and Manager · Receiving stock, 3 Oct (walk-through 3 M3)".
- **V2 (b) — `rs-restock`.** "For customers: a part added to a job with no free
  stock is on the list by itself, not yet ordered — Owner · Receiving stock, 3
  Oct (walk-through 3 M7)".
- **V3 (b) — `rs-receive`.** "On a phone: Scan the box at the top, the list
  fills the screen, Book in [n] items at the bottom — Staff · Stock control 5,
  12; walk-through 3 M5". (Read from the old phone drawing,
  `out-receiving-sand/project/rs-receive-phone.dc.html`.)

### 18. `stock.mjs` and `consolidate/j14.mjs` (1 b)

- **K1 (b) — `tk-count`.** "On a phone: Scan what's here at the top, the list
  fills the screen, I've finished my part at the bottom — Staff · Stock control
  5, 12; walk-through 3 M5". (From `out-stock-sand/project/tk-count-phone.dc.html`.)

### 19. `moving.mjs` and `consolidate/j09.mjs` (2 b)

- **MV1 (b) — `mv-start`.** "Running alongside: the tills wait for switch-over
  day — check-in says Sales start on switch-over day, [date], and Take payment
  is off — Owner · Moving from Citrus Lime, 3 Oct (walk-through 4 H2)".
- **MV2 (b) — `mv-start`.** "The website is ready ticks once no Words and
  photos row says Check this — Owner · Website management, 3 Oct (walk-through
  4 H3)". Update the comment ~194–195 to the same rule.

### 20. `website.mjs` and `consolidate/j18.mjs` (2 a, 1 b)

- **W1 (a) — a "Words and photos" list on the Website page.** Website
  management, 3 Oct (walk-through 4 H3): "one row per fixed part (headline, a
  line about the shop, the big photo, the workshop's words, the shop's own words
  and photo, Collection and returns, Privacy), each with Edit opening a form
  box. A row with starting wording says 'Check this' until it is saved once."
  `website.mjs` ~118–125: add the section with those seven rows, each with
  Edit; "Collection and returns" and "Privacy" (the two with starting wording,
  ~100) say "Check this". No new board: the rows go on `ws-page` (block 2 rows,
  as the page's others). What happens to "Edit website" and the Pages row is
  for Jack (below). Boards: `ws-page`, and `ws-history` behind its box.
- **W2 (b) — `ws-page`.** "Edit on a Words and photos row: a form box with that
  part's words or photo; a row with starting wording says Check this until it's
  saved once — Owner · Website management, 3 Oct (walk-through 4 H3)".
- **W3 (a) — the Settings path.** ~95 `payRow`: "in Settings › Online orders" →
  "in Settings › Front desk › Online orders" (the same board's bottom line
  already says so). Walk-through 4 L1. Boards: `ws-page`, `ws-history`.

### 21. `oversight.mjs` and `consolidate/j20.mjs` (1 a)

- **O1 (a) — checking Jo out is beside the tills.** ~168 `ops-till-checkout`
  draws the "Check Jo Taylor out of Till B1?" box over Signed-in devices, which
  is later. Draw it over the Tills page (the one behind `set-till-quick`'s
  "Settings › Till › Tills: every till, by shop" line, from `setup.mjs` or
  `sites.mjs`; import it if exported, otherwise log and leave). Walk-through 8
  decision file, 3 Oct (walk-through 8 H3). Drawing behind the `till-sale` line
  "Check Jo Taylor out of Till B1".

### 22. `lightspeed.mjs` and `consolidate/j21.mjs` (2 b)

- **L1 (b) — `ls-job-sent`.** "On a tablet: the desktop layout with a shorter
  icon rail; on a phone: the strip at the top of the job with its button full
  width, pop-ups fill the screen, and part-search rows put the name on its own
  line — Staff · Lightspeed shops 13; walk-through 6 M5". (Decision 13's own
  words; a line, not a new note.)
- **L2 (b) — `ls-job-sent`.** "Marked ready while waiting for Maya's answer:
  the work order keeps £28.00 — Staff · Lightspeed shops 12; walk-through 6 L3"
  (the second half of L3; the first pass did the first).

### 23. `customer.mjs` and `consolidate/j15.mjs` (1 a)

- **C1 (a) — the Ready job shown is on or before today.** ~116: Maya's Ready
  job is picked as the newest Ready one, which is WH-1074 on Fri 18 Sep, the
  day after "today" (Thu 17 Sep). Pick the newest Ready job on or before
  `TODAY` instead (WH-1056, Tue 15 Sep, already in `diary.mjs` ~413). No diary
  data changes. Walk-through 9 L5 and its second check. Board: `cs-page`.

### 24. `browse.mjs` (1 a, visual)

- **X1 (a, visual):** ~71 `ready()` "Ready today at Bolton" 13px → body size.
  Walk-through 12 M5. Boards: `wb-home`, `wb-category` and every product card.

### 25. `account.mjs` (1 a, visual)

- **X2 (a, visual):** the history lines on `ac-account` (13px) → body size.
  Walk-through 12 M5.

### Z. After the "what's different" pass is merged: moving lines (one person, 7 moves)

These change existing `into()` entries, so they wait, and one person makes
them all, keeping each line's decision and diff.

- **Z1 — `bk-request` becomes a line under `bk-page`.** Walk-through 1 L1: the
  two drawings show the same rows and buttons; README rule 5 ("Nothing is drawn
  twice"), the rule Jack used for the same kind of case the same day (CP1).
  `consolidate/j03.mjs` ~25 `keep(40)` → `into('bk-page', …)` with the diff
  "Just sent: Thanks, Maya — your request is with us"; `bk-request-deposit` and
  `bk-confirmed` (~26–27) move to `bk-page` with it. J6's title becomes
  "…replaced by bk-page". −1 board, −1 note.
- **Z2 — `ac-reminder-landing` → `bk-when`.** Walk-through 1 L2
  (`consolidate/j07.mjs` ~42; `account.mjs` builds it as booking's When step).
- **Z3 — `on-hand-over`, `on-hand-over-refunded` → `till-collect`.**
  Walk-through 2 L1 (`consolidate/j02.mjs` ~51–52; built from `till-collect`).
- **Z4 — `ms-job-other-shop` → `new-job`; `ms-request-from-shop` →
  `request-new`.** Walk-through 7 L1 (`consolidate/j19.mjs` ~20–21).
- **Z5 — `ls-book-in` becomes the board, `ls-customer-pick` its line.**
  Walk-through 6 L2: the board should show book-in with Maya at the desk ("Link
  and book in", over Today), the more common moment. `consolidate/j21.mjs` ~21,
  ~31 swap `keep(21)` and `into()`; the `lines` entries `on:
  'ls-customer-pick'` move to `ls-book-in`. Drawings unchanged.
- **Z6 — `cw-today-choose` is the same as `op-today-c2w`.** Walk-through 5 L2
  (one copy of the Today line): `consolidate/j06.mjs` ~64 → `same('op-today-c2w')`
  (Z0).
- **Z7 — `ls-customer-ready` is the same as `cp-summary-ls`.** Walk-through 6
  L1: `consolidate/j21.mjs` ~55 → `same('cp-summary-ls')`.

## Every board changed

Drawn content (a): `j21_title` (J1); `st-adjust` (J3); `jb-pending` (J6);
`till-search` and every till board with the search open (A1); `map` (A2);
`till-checkin` (N1, N2, N7); `pin-change` (N2); `cust-code`, `cust-signin`
(N3, N4); `fr-today` (S6); `till-customer` (T2); `till-book-in` (T3); `eod-z`
(E1); `rp-sales`, `rp-change`, `rp-day`, `rp-takings`, `rp-margin` (R1–R5);
`job-overview`, `job-quick-overview`, `job-checklist`, `diary`, `request-new`,
`new-job`, `dq-record-answer`, `staff-app`, `your-settings`, the `ls-*` job
boards (D1, the book-in note), and every job page with the customer link (D2);
`dq-quote` (Q2); `bk-bike`, `bk-request`, `bk-page` (BK1, BK2), `bk-when`
(BK4); `on-checkout`, `on-confirmed` (ON1, ON2); `cw-cancel`, `cw-applied`,
`cw-order-anyway`, `cw-certificate`, `cw-list` (CW1, CW5–CW7); `ws-page`,
`ws-history` (W1, W3); `cs-page` (C1); `wb-home`, `wb-category` and product
cards (X1); `ac-account` (X2). Boards leaving: `j05-ready` (CP1), `bk-request`
(Z1).

Situation lists (b, or a line's title or role): `till-search`, `staff-app`,
`till-rail`, `site`, `till-checkin`, `cust-signin` (new list), `pin-change`
(J5), `set-staff-person`, `fr-today`, `set-msg-list`, `set-till-quick`,
`till-sale`, `till-refund`, `till-collect`, `op-today` (OP1, J2), `rs-receive`
(J2, V3), `st-product` (J4), `rp-margin`, `ms-switch-open`, `job-overview`,
`new-job`, `diary`, `bk-page`, `on-orders`, `cw-cancel`, `cw-order-held`,
`cw-customer-view`, `cp-summary`, `rs-delivery`, `rs-restock`, `tk-count`,
`mv-start`, `ws-page`, `ls-job-sent`; every list with a Lightspeed line (B1).
Group Z: `bk-page`, `bk-when`, `till-sale`, `till-collect`, `diary`,
`new-job`, `request-new`, `ls-customer-pick`, `ls-book-in`, `op-today`,
`cp-summary`.

Drawings changed only behind a line or a later list: `set-staff-invite`'s
till-only line (S1, S2), Getting started while moving (S4), `till-held-job`
(T1), the noted refund (T4), `ms-today-all` (SI1), the `dq-quote` in-the-shop
page (Q1), `ops-till-checkout` (O1).

## Done when

1. `node --test docs/design/user-journeys/generator/consolidate/` passes,
   with B1's check (and Z0's, for group Z) seen failing first.
2. `node build.mjs` builds the one canvas, and `fitcheck-canvas.mjs` passes:
   at most 200 notes (expected 175 before Z, 174 after), at most 512 files
   (212 before Z, 211 after), no "undefined", no two notes at one spot.
3. A search of `out/project/*.dc.html` finds none of these on any board:
   "09:12", "maya@example.com", "Call me before", "call you before", "call you
   first", "in Settings › Online orders", "View Maya Patel", "puts your name on
   sales." (with the full stop), "Untick if
   it needs work first. Maya", "Takings (with VAT)", "Sales so far", "one
   short", "arrived short", "sold anyway" beside "job WH-1042", "Deposit paid"
   on `j03-bk-page-phone`.
4. Every (b) line above appears word for word in `out/project/canvas.json`,
   and every note line mentioning "Lightspeed" ends "after the trading week
   (build-plan question 5)".
5. Each group's own `build-*.mjs` still builds its journey canvas without
   errors.
6. The seven visual changes (N7, R5, Q2, BK4, CW7, X1, X2) are drawn only after
   Jack's yes; until then the list is done without them.
7. A fresh reviewer walks this list against the built canvas, line by line,
   before anything is published; publishing waits for Jack's yes.

## Still needs Jack

1. Two edges still not drawn: a job marked ready with its quote unanswered, and a "Not sure what's wrong?" booking that reaches a quote — walk-through 1 L7.
2. The "Tablet and phone ↗" / "Sizes ↗" link: rename it to say it opens the old canvas, or remove it — walk-through 2 L4.
3. The staff search box's wording, "Search jobs, customers, products" or "…orders, products" — walk-through 5 L1 and walk-through 2 L3 (walk-through 9 M1's second check calls the difference deliberate).
4. Moving edges: where "Fix" on an import row leads, where "Give [name] their PIN" sits in the Serving menu, a weekly refresh with an unreadable file, and the first sign-in note if it comes back — walk-through 4 L3.
5. With the Words and photos list on the Website page, what "Edit website" opens and whether the Pages row keeps "2 to check" — walk-through 4 H3 (follows from Jack's answer).
6. Cycle to Work edges: internet drops during the sale, card declined after the provider's line, adding a new customer from New order, a bike back after the provider paid — walk-through 5 L5.
7. Lightspeed edges: the strip when Lightspeed signs Wheelhouse out, a refund at the Lightspeed till, two shops on the job side, telling Maya she still owes after "pays later", a by-hand number typed while Lightspeed is unreachable — walk-through 6 L7.
8. Written tablet and phone rules for every journey (one note each would take the canvas to about 197 notes) — walk-through 7 L3 (canvas-wide, per its second check).
9. Two-shop edges: unticking a shop for someone with jobs there, closing the day at [Second site] while the owner views Bolton, collecting at the other shop, a manager at Bolton only adding [Second site] to Jo's shops, a transfer cancelled while a job waits for it — walk-through 7 L4 and its second check.
10. Announcing "Now working: Jo Taylor" when someone takes over a workshop computer (new wording, not in a decision) — walk-through 8 H1 (second check).
11. One job, three status words ("Scheduled", "Expected", "approved"): reconcile the diary legend with Workshop day 20's stages, and draw `job-overview` as booked in or without the hook — walk-through 9 M4.
12. What the search finds (bikes, frame numbers, requests without a WH number) and where the cursor starts on the till, with one key back to it — walk-through 9 L3.
13. One name for WH-1042 to the customer ("Reference", "Your booking · WH-1042", "Job WH-1042") and for the Cycle to Work order ("See your order", "Your Cycle to Work bike", "See your quote"); "Full service checklist" is Workshop day 39's name — walk-through 12 L1.
14. Whether the repair's Pay now offers checkout's Apple Pay and Google Pay (it extends Buy online 5) — walk-through 12 L7.
15. `bk-when`'s "Book this time" shortcut offers 09:30, the story's arrival is 11:30 — walk-through 12, second check's own finding.
16. The job page's tag "Call before any extra work": with "Ask me before any extra work" chosen and no call option, what it should read — walk-through 12 H1 (follows from Jack's answer; the answer gives no staff wording).

## Decision log

- 3 Oct: Lightspeed lines are tagged by the build (B1), not by editing about
  20 `into()` decisions, so this pass doesn't collide with the "what's
  different" pass. Jack's answer said where the tag goes, not how it's made.
- 3 Oct: every change that has to edit an existing `into()` (moves, duplicates,
  the `ls-customer-pick` swap) is held in group Z until that pass is merged.
- 3 Oct: walk-through 1 L1 (`bk-request` leaves) is included as no-choice:
  the report and its check call it so, and Jack applied the same rule ("nothing
  drawn twice") to `j05-ready` the same day. Noted: step 3 kept `bk-request` as
  building block 40's example; block 40 has other boards (`pending`).
- 3 Oct: `bk-page` is redrawn without a deposit (walk-through 1 M3, High after
  its check) rather than only lined (walk-through 12 M6's option), as the
  caller asked; the deposit version becomes the line.
- 3 Oct: `cw-cancel`'s base board becomes "deposit paid, bike ordered, deposit
  refunded by the rule", so it stays different from the "deposit kept" line;
  Jack's walk-through 5 L4 answer gives the no-deposit cancel to Staff, so
  CW2's "who" includes Staff.
- 3 Oct: `eod-z` takes the saved day's words ("Card"; "Gift cards, store
  credit, customer accounts, other") so the till's report and Reports match;
  walk-through 2 L3 asked for one word each without naming which.
- 3 Oct: WH-1074's date is fixed by choosing an earlier Ready job already in
  the diary (WH-1056) for `cs-page`, not by moving diary blocks. Not changed:
  `cs-page`'s "Open now" also lists a Scheduled job on Wed 16 Sep, before
  today; no report fix covers it.
- 3 Oct: labour "beside" margin is drawn on `rp-margin` only; the strip's
  margin becomes goods-only by the same rule without a drawn change.
- 3 Oct: "Takings" drops "(with VAT)" from its label; the note under Sales says
  what it includes, per the answer's single meaning.
- 3 Oct: the three customer texts (S7) are drafted here, as the Q9 and
  walk-through 12 M2 answers ask; they are marked "draft" for Q9's read-through.
- 3 Oct: not done: `pin-change`'s close stays a link (walk-through 4 L2 part 1),
  because "a ✕ that goes back to another board stays a link" was decided after
  the first walk-through 1 (L7). Not repeated: walk-through 7 M5's "[Second
  site] · [n] steps" line, done on `ms-switch-open` by the first pass (SI1).
  Walk-through 8 H1's "Digits can be typed" is N5's keyboard line.
- 3 Oct: `jb-pending` is relabelled, not removed, because walk-through 12 L5's
  fix says relabel.
- 3 Oct: the seven text-size fixes are listed, but gated on Jack, because they
  are visual changes.

### Done (3 Oct)

- Drawn: every change in this list, the seven text-size changes (Jack: "yes
  you can go ahead and make some text bigger", so the three other `cw-list`
  badges went to 14px too, to match CW7), and group Z. Built: 211 files (−2:
  `j05-ready`, `bk-request`; `ls-customer-pick` swapped for `ls-book-in`),
  174 notes; plan check 9/9; `fitcheck-canvas.mjs` 0 problems.
- Beyond the list, after reports from the implementers: `ac-job-note*` moved
  from `cp-summary` to `bk-page` (the drawing is the job "in the shop", built
  with `inShopAt()` like `dq-in-shop`, which also folds into `bk-page`);
  `j04`'s `dq-in-shop` phrase says "[time]"; `stock.mjs` and `journeys.mjs`
  titles mirrored; `weekPill` gets `on = false` (it printed
  `aria-pressed="undefined"`); `till-find-customer`'s email is
  maya@example.test; `rp-day`'s saved report says "Takings" like the till's
  (Reports, 3 Oct, walk-through 11 H2).
- O1: the Tills board isn't exported, so `ops-till-checkout` (the "Check Jo
  Taylor out of Till B1?" box) now folds into `set-till-quick` beside the
  tills (walk-through 8, 3 Oct, H3) instead of `till-sale`; its drawing still
  sits over Signed-in devices on journey 20's own canvas.
- Fresh review fixes: Your settings' PIN sentence ("…sales and workshop
  work"); the till search's announcements moved outside its results list;
  `ls-customer-pick`'s phrase quotes its own drawing; `on-hand-over` is
  `same('till-collect')` (`same()` may now point at a board); stale phrases on
  `cw-cancel-ordered`, `till-held-job`, `bk-page-dropoff`, `bk-page-ls`,
  `ready` corrected.
- Logged, not changed: `cw-cancel` now refunds the deposit ("your rule for a
  customer who pulls out") while its line "Cancelling after ordering: the
  deposit kept" shows the other rule — both are shop settings (Cycle to Work
  4); `customer.mjs`'s Lightspeed "Change" link points at the old
  `ls-customer-pick` board (for step 5's mockup); 16 quote boards were already
  taller than their frame before the text-size change.
