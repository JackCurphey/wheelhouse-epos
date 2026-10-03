# UX walk-through 7, second walk — an owner with two shops, on the one canvas

Walked 3 Oct 2026 for issue #116 step 4, on the one canvas (built locally at `generator/out/project/`, published at https://claude.ai/artifact/WzmMdudJPoWH5aUd7J9V4j). Journeys 19 Multiple sites, 20 Management oversight and 17 Reports and accounts. The first walk is `../ux-walkthrough-7-two-shops.md` (2 Oct). The oversight extras (alerts on Today, signed-in devices, Sign out everywhere, feedback) are put off by the 3 Oct answer to issue #116 question 5, so they are not walked. I read board text and links, not rendered pictures.

## The story

1. Jack Lewis (Owner) signs in, picks a shop, and sees on Bolton's Today that [Second site] has 3 things needing attention.
2. Jack adds [Second site] in Settings › Office › Shop and sites, then works through its checklist: moves Till B3 there, ticks who works there, sends stock from Bolton, and shows the shop to customers.
3. Jo Taylor (Staff, both shops) books Maya Patel's Standard service at Bolton into [Second site]'s workshop. It goes there as a request.
4. Someone working at [Second site] accepts it. Back at Bolton, Jo sees the answer in Waiting for you.
5. Jack compares the shops in Reports (Sales, Workshop, Margin) and checks the Activity log.

## Clicks and different screens

Counts come from the boards and their situation lines. Typing and scanning are not counted.

| Person | Clicks | Different screens (boards) |
|---|---|---|
| Jack Lewis (Owner) | about 29, plus about 4 per extra person given a shop, plus one scan per product sent | 13 (14 if he sets up a new till instead of moving one) |
| Jo Taylor (Staff) | about 9 (7 to send, 2 to see the answer) | 5 |
| Staff at [Second site] | about 4 | 2 |
| Saturday worker at either till | 1, plus their PIN | 3 |

Jack's main path from the first walk was "about 20 clicks plus about 4 a person", without Reports. With Reports it is now about 29. Margin by shop still can't be done (M1).

## High

**H1 — `rp-home` (desktop): the owner's overview, split by shop, is not on the canvas.**
- *What happens:* Reports opens on cards only: "Thursday 17 September · North Street Cycles, Bolton · use the shop menu for another shop or all shops", then "Ready-made reports". On 3 Oct, Jack chose a strip of 3 figures at the top: takings by shop, margin, and a link to each shop (Reports and accounts, later change, question 1). It isn't drawn, and it isn't a line in `rp-home`'s situation list either. The one-canvas spec says "Nothing is redrawn", so no board picked up the 3 Oct changes. Step 1 also found that the strip, as decided, would put takings *with* VAT (`rp-sales`: "Takings (with VAT)") beside a margin worked out *before* VAT (`rp-margin`: "Sales before VAT"). So the two figures will disagree on the first screen (`consolidation-back-office.md`, finding 3).
- *Why it matters:* this is the owner's first check in `personas.md`: revenue and profit, split by shop, with no clicks. As drawn, it takes about 4 clicks (Reports, shop menu, All shops, Sales), and you still don't see margin.
- *Fix (touches Reports and accounts later change question 1; not reopened):* draw the strip on the `rp-home` board itself. Add situation lines "One shop chosen: that shop's figures, and a link to the other" and "Staff with Can see reports: no margin figure". The open question is what the takings figure is measured on:
  1. Takings with VAT, as at the till, plus one line under the strip: "Margin is worked out on sales before VAT (£[£])". This keeps the word Jack chose and the number staff already know. It costs one extra line of text.
  2. Sales before VAT beside margin, so the two figures agree. This is cleaner for comparing, but the number won't match the till or Takings and cash-ups.

  Recommend 1.
- *8th question:* the strip is the screen as it first opens, not one of its situations, so it goes on the existing board. No new board.
- **Second check:** CONFIRMED — `j17-rp-home-desktop.dc.html` has only the date line and the report cards; `j17_sit_rp-home` (canvas.json) has 5 lines, none a strip; the 3 Oct note is Reports and accounts line 142; `rp-sales` shows "Takings (with VAT)" and `rp-margin` "Sales before VAT"; the spec's "Nothing is redrawn" is `2026-10-03-one-canvas.md` line 13–14. Two corrections: `consolidation-back-office.md` line 105 marks the VAT clash "*(inferred; the strip isn't drawn yet)*", which this finding states as certain; and by the script's definitions (line 55–56) this is **Medium, not High** — the story doesn't break (Jack still reaches All shops in about 4 clicks), it is a decided part of a screen that isn't drawn. The choice for Jack stands either way.

## Medium

**M1 — `rp-margin`, `rp-discounts` (desktop): Margin and Discounts can't be seen by shop.**
- *What happens:* both boards say "North Street Cycles, Bolton". Neither situation list has an All shops line: `rp-margin` has none at all, and `rp-discounts` has only the Staff view. Sales, Takings, VAT and Workshop each have an "…for all shops" line. The code takes a shop (`margin(site)`, `discounts(staff, site)`), but nothing draws or lists the All shops version. This is the half of the first walk's M1 that is still open.
- *Why it matters:* Jack reads "margin breakdowns" split between the shops (`personas.md`). The owner's second check, from the overview to the margin breakdown in one step, fails for anything split by shop.
- *Fix, no choice (touches Reports and accounts 8, audit M13: "the others a shop column"):* add lines "Margin for all shops: shop by shop, and stock value at each" to `rp-margin` and "Discounts and refunds for all shops: a Shop column" to `rp-discounts`.
- *8th question:* lines. The tables only gain a column or a row per shop.
- **Second check:** CONFIRMED — `j17-rp-margin` and `j17-rp-discounts` both read "North Street Cycles, Bolton"; canvas.json has no `j17_sit_rp-margin` note at all and `j17_sit_rp-discounts` has only the Staff line; `reports.mjs` lines 266 and 314 take `site`; Reports and accounts 8 (M13) says "Takings and VAT get All shops versions, the others a shop column", so the fix carries out a decision rather than reopening one. Severity right.

**M2 — `ms-add-shop`, `set-staff-person`, `ops-log`, `rp-vat` (desktop): kept boards still draw work the 3 Oct answers put off.**
- *What happens:*
  - The Settings page behind "Add a shop" lists "Signed-in devices [n] tills · [n] phones and computers" and "Alerts on Today … set by the owner".
  - Jo's person page has "Signed in Till B1 now · [n] phone or computer · Sign out everywhere".
  - The Activity log tags lines "On Today" and "Seen by Jack Lewis at [time]", and has a line "Signed out [Computer] · [browser] · Signed out from Signed-in devices".
  - VAT shows "Supplier invoices booked in · [n] [£]", but question 6 says that box gives no figure until the invoice check is built. The no-figure version is only a line ("VAT with the invoice check off").
- *Why it matters:* `CLAUDE.md` says to "build exactly what the drawings … show". A builder following these boards would build things Jack put off, and Jack would read a Settings page full of options that won't be there.
- *Fix, no choice (touches Management oversight later change question 5 and Reports and accounts later change question 6; carries them out):* take the deferred rows, tags and lines off these boards and keep them in `j20_later`. On `rp-vat`, swap the two: the no-figure box becomes the board, and the invoice-check version goes to the Later note.
- *8th question:* no new drawing. This takes things off boards.
- **Second check:** CONFIRMED — "Signed-in devices" and "Alerts on Today" are on `j19-ms-add-shop` and `j08-set-staff-person`, "Sign out everywhere" on `j08-set-staff-person`, "On Today", "Seen by Jack Lewis at [time]" and "Signed out from Signed-in devices" on `j20-ops-log`, "Supplier invoices booked in · [n]" on `j17-rp-vat`; Management oversight line 117 and Reports and accounts line 144 put these off and say the drawings were to be redone in step 3. Note: `j20_later` already lists Alerts, Signed-in devices and Sign out everywhere, so only the boards need changing. Severity right.

**M3 — every board in this story: the joins can't be clicked.**
- *What happens:* I followed the links on every board, leaving out Prev, Next and Overview. No other link leads into any board of journeys 17, 19 or 20, or into `op-today`, `set-shop-details`, `set-till-quick`, `set-staff-person`, `tr-send`, `auth-site` or `till-setup`. Some examples:
  - The sidebar's "Today", "Reports" and "Settings" have no link.
  - Every report card on `rp-home` is `href="#"`, including "Activity log".
  - "All reports" on each report is `#`.
  - Bolton's "See them" (`ms-switch-open`) is `#`.
  - The three cards on `auth-site` are `#`.
  - The till's "…" menu on the Tills list doesn't open `ms-till-move`.
  - The diary's "New job" links to the diary itself, so `new-job` is reached only from the day view, the job page or the checklist.
  - The only joins that work are into `diary` and `request-new`.
- *Why it matters:* you can't click the owner's story from one shop to the other. Step 5 (the clickable mockup) needs these links, and so would anyone walking it on the canvas.
- *Fix, no choice:* where a link goes to a situation line, point it at that line's board: the report cards to their reports, "See them" and "All shops" to `op-today`, the till "…" to `ms-till-move`, the `auth-site` cards to `op-today`, the sidebar items to their boards.
- *8th question:* links only, no drawings.
- **Second check:** CONFIRMED — tracing every `<a href>` on the 211 boards (Prev, Next, Overview and `Main.dc.html` left out) finds 0 links into every story board except `diary` (233) and `request-new` (16); `new-job` gets 4, from the day view, its phone and tablet, and the checklist; the diary's "New job" is `href="j12-diary-desktop.dc.html"`; the sidebar's Today, Reports and Settings are `<a>` with no `href`; "See them", the `rp-home` cards, "All reports" and the three `auth-site` cards are `#`. The Tills list with its "…" is a situation line on `set-till-quick` (`ms-tills`), and `ms-till-move` has no link into it. This is canvas-wide, not just this story: 1,568 `href="#"` on 190 of the 211 boards, so the fix belongs in the generator. Severity right.

**M4 — `auth-site` (desktop): the Staff board offers "All shops" and the other shop's problems.**
- *What happens:* the board is labelled "Staff". It shows three cards: Bolton, "[Second site] · 3 need attention", and "All shops · Owners, and managers at two or more shops". But staff with two shops "get their shops, no 'All shops'" (`ms-switch-open`'s own line; Multiple sites 9), and Needs attention isn't for Staff (Opening the shop 3, 4). `auth-site` has no situation list.
- *Why it matters:* Jo or the Saturday worker gets offered a card they can't use, and a count they can't act on, on the first screen of the day.
- *Fix, no choice (touches Multiple sites 9, Opening the shop 3; not reopened):* label the board Owner (Jack Lewis), since that is the view with everything on it. Add a line: "Staff at two shops (Jo Taylor): their two shops, no All shops, no counts".
- *8th question:* a line.
- **Second check:** CONFIRMED — `jb-auth-site-desktop` is labelled "Staff · desktop" (from `journeys.mjs` line 93) and shows Bolton, "[Second site] · 3 need attention" and "All shops"; canvas.json has no `jb_sit_auth-site`; `ms-switch-open`'s line says staff with two shops get no "All shops"; the owner's All shops card and count were added on purpose by the first walk (`2026-10-02-ux-walkthrough.md` line 261–263), so labelling the board Owner matches that. One nuance: Opening the shop 4 shows Needs attention to staff with "Can close the day" too, so the new line could say "no counts unless they can close the day". Severity right.

**M5 — `op-today`, `ms-switch-open` (desktop): Today's notice about the other shop has no place in Today's own list, and the new-shop version isn't anywhere.**
- *What happens:* Bolton's "[Second site] · 3 things need attention · Not this shop · 'See them' switches to [Second site]" is drawn only on the shop-switcher board. `op-today`'s 32 lines don't mention it. The version for while a checklist is unfinished, "[Second site] · [n] steps to get it ready", is in the code (`opening.mjs`, `otherShops: 'setup'`) and in the script's word list. But no board uses it and no line lists it.
- *Why it matters:* after Jack switches back to Bolton, only that hidden version reminds him that [Second site] isn't ready yet, or shown to customers yet (the first walk's H1).
- *Fix, no choice (touches the first walk's H1, as taken):* add two lines to `op-today`: "Owner at Bolton: [Second site] · 3 things need attention, See them" and "Owner at Bolton while [Second site] is being set up: [n] steps to get it ready, See the steps".
- *8th question:* lines.

## Low
- **Second check:** CONFIRMED — `j10_sit_op-today` has 32 lines and none is Bolton's line about [Second site]; it is drawn only on `ms-switch-open` (`sites.mjs` line 195, `otherShops: true`); the "steps to get it ready" version exists in `opening.mjs` lines 196–199, and no call in the generator passes `otherShops: 'setup'`; the word list has it. Severity right.

**L1 — `diary`: the lines for a job between shops sit under the wrong boards.** "Booking a job into the other shop's workshop" changes the New job box, and "At [Second site]: the request…" changes the request box. Both are listed under `diary`, not `new-job` or `request-new`. The request line says "— Mechanic", but the code draws someone at [Second site] signed in as "[Name] · Staff". *Fix, no choice (touches Multiple sites 12):* move the two lines to `new-job` and `request-new`, and change "Mechanic" to "Staff at [Second site]". *8th question:* lines, moved.

**Second check:** CONFIRMED — the three lines sit in `j12_sit_diary` (`consolidate/j19.mjs` lines 20–22, marked "inferred"); `journeys.mjs` line 1151 labels the request "Mechanic" while `diary.mjs` draws it with `OTHER_SHELL = { person: '[Name]', roleName: 'Staff' }`; Multiple sites 12 says "someone there who can accept bookings", so "Staff" fits. Severity right.

**L2 — `till-setup`: the board is labelled "Manager".** It reads "Signed in as Jack Lewis (Owner)", and only the Owner registers tills (Owner setup 10; Management oversight background). *Fix, no choice:* label it "Owner". *8th question:* no drawing.

**Second check:** CONFIRMED — `jb-till-setup-desktop` reads "Manager · desktop · 4 of 9" and "Signed in as Jack Lewis (Owner)"; Owner setup 10 says "Only the Owner adds or removes staff and registers tills". Severity right.

**L3 — journeys 17, 19, 20: no written rules for tablet and phone.** Rule 3 turns the other sizes into written rules. None is written for these journeys, so decision 11 ("North Street Cycles · Bolton" under each title on tablet and phone, made larger in the first walk's L2) can only be checked on the older canvases, through each board's "Tablet and phone ↗" link. *Fix, no choice (touches Multiple sites 10, 11):* one note per journey, e.g. "On tablet and phone the shop's name sits under the page title, 14px".

**Second check:** CONFIRMED — canvas.json's j17, j19 and j20 notes are only the title, situation lists and `j20_later`; the 14px comes from the first walk's L2 fix, so it isn't invented. This is canvas-wide: no journey on the one canvas has a tablet and phone note yet (README rule 3, line 89–91), so the fix is one pass across every journey, not three notes. Severity right.

**L4 — edge cases at the joins that still have no line.**
- Unticking a shop for someone with jobs booked there (Multiple sites 9 says it warns first).
- Closing the day at [Second site] while the owner is looking at Bolton.
- A customer collecting at the shop that didn't do the work.
- What customers see once Jack presses "Show [Second site] to customers".

*Fix, no choice:* a line each, where it belongs (`set-staff-person`, `eod-check`, `job-overview`, `op-today`), when Jack wants them settled. *8th question:* lines.

**Second check:** CONFIRMED for three, REFUTED for one — bullets 1–3 have no line (`j08_sit_set-staff-person`, `j16_sit_eod-count`, `j12_sit_job-overview`), though for bullet 1 the `ms-person` hint in `sites.mjs` line 130 already says unticking "says so first"; bullet 4 is drawn: `j01-wb-shops-phone` ("Our shops", a card each for Bolton and [Second site]) and `j01-wb-choose-shop-phone` show customers both shops. Also, the first walk's L4 had two more edge cases this list drops without saying so (see Second check below). Note: the board id is `eod-count`, not `eod-check`.

## The first walk's findings, checked on the one canvas

| First walk | Now |
|---|---|
| H1 Bolton's Today silent about [Second site] | Fixed on `ms-switch-open` (the line, "3 need attention" in the shop menu) and on `auth-site`. The "steps to get it ready" version is missing (M5). |
| H2 Job between shops drawn with Bolton's diary | Fixed in the code: Maya's one job, [Second site]'s next free time, the answer in Bolton's Waiting for you (`diary.mjs`). These are now lines only, judged from the code (L1). |
| M1 Only 3 reports compare shops | Workshop has an all-shops line. Margin and Discounts still don't (M1). |
| M2 Moving a till, numbering a new shop's tills | Fixed: `ms-till-move` ("It becomes Till [code]3. Old receipts keep B3."), and `till-setup`'s line. |
| M3 New shop shows to customers too early | Fixed: "Customers don't see it until you choose to" on `ms-add-shop`, and a fifth checklist step in the code. |
| M4 Log keeps to its shop | Fixed: the price change is tagged "All shops", and there is no [Second site] line in Bolton's log. The alerts and devices parts are now later (M2). |
| M5 "[Site 2]", one product at a time | Fixed: "Send to [Second site] · From Bolton", "To [Second site]", "Scan or search to add". |
| M6 Messages don't name the shop | Fixed: "…ready to collect from North Street Cycles, Bolton". |
| L1 "Site", four names for a till | Fixed: "Shop" on `till-setup`, "shop" on `auth-site`. |
| L2 Unnamed buttons | Fixed in the code ("Seen: [Second site], Till [code]1 float short"). Shop line size not checked (L3). |
| L3 Customer history shop | Fixed: "· Bolton" on every row of `cs-page`. |
| L4 Edge cases | Still open (L4). |

## Accessibility and the Saturday worker

- **Screen reader and keyboard.** Still holds: the shop switcher is "Shop: Bolton. Choose a shop" with `aria-haspopup="menu"` and `aria-expanded`, and its rows are `menuitemradio`. "See them" is named "See the 3 things that need attention at [Second site]". Log names are "Show only Jo Taylor". The "Workshop at" choice is a radio group described by its hint (`aria-describedby="wa-hint"`, now in the code). At the joins: the dead links (M3) would take a keyboard user nowhere. Not checked: focus order, or a real screen reader.
- **Low vision.** One desktop size per screen. Tablet and phone, and zoom, weren't checkable here (L3).
- **Saturday worker.** At sign-in they would see an "All shops" card and another shop's count they can't use (M4). At the till, "A till sells for its own shop" is a line on `till-sale` and holds. The hint for booking at the other shop ("Goes to [Second site] as a request… you and the customer hear back") explains itself without being shown.

## Owner checks (`personas.md`)

1. Overview split by shop, first, no clicks: **fails** (H1).
2. Overview to margin breakdown in one step: one click from `rp-home` to Margin for Bolton. **Fails** by shop (M1).
3. Figures match everywhere: not checkable, because every figure is a placeholder. Takings with VAT against margin before VAT is a known gap (H1).

## End table

| Id | Screens | One line | Needs Jack | New boards |
|---|---|---|---|---|
| H1 | rp-home | No overview strip by shop; takings and margin on different VAT bases | Yes (1–2) | 0 |
| M1 | rp-margin, rp-discounts | No all-shops margin or discounts | No | 0 |
| M2 | ms-add-shop, set-staff-person, ops-log, rp-vat | Deferred extras still drawn | No | 0 |
| M3 | all in story | Joins are `#` or missing; the story can't be clicked | No | 0 |
| M4 | auth-site | Staff board shows All shops and counts | No | 0 |
| M5 | op-today, ms-switch-open | Other-shop line not in Today's list; "steps to get it ready" nowhere | No | 0 |
| L1 | diary, new-job, request-new | Lines for a job between shops in the wrong place; "Mechanic" | No | 0 |
| L2 | till-setup | Labelled Manager, owner-only | No | 0 |
| L3 | j17, j19, j20 | No written tablet and phone rules | No | 0 |
| L4 | — | Edge cases at the joins with no line | No | 0 |

No finding adds a drawing.

## Choices for Jack

1. What the takings figure in the Reports strip is measured on (H1). Recommend 1: takings with VAT, plus a line saying margin is worked out on sales before VAT.

## Verification

- **Boards read as text and links** (a scratchpad script, nothing saved to the repo), all desktop: `ms-switch-open`, `ms-add-shop`, `ms-till-move`, `ms-product-price`, `ms-service-price`, `ops-log`, all 12 `rp-*`, `op-today`, `diary`, `new-job`, `request-new`, `auth-site`, `till-setup`, `set-staff-person`, `set-till-quick`, `set-shop-details`, `tr-send`, `set-msg-edit`, `cs-page`; `bk-service` (phone). Every link on all 211 boards was traced to see what leads into the story's boards (Prev, Next and Overview left out).
- **canvas.json** situation lists for j17, j19, j20 and the boards above, `j20_later`; `consolidate/j17.mjs`, `j19.mjs`, `j20.mjs`. **Code** for line-only situations: `diary.mjs`, `opening.mjs` (`otherShops`), `sites.mjs`, `reports.mjs`.
- **Decisions read:** Multiple sites, Management oversight and Reports and accounts in full, with their 3 Oct later changes; the walk-through decision's walk-through 7 section; the build-plan questions; issue #116 step 4; `README.md`'s drawing rules; `consolidation-back-office.md`; the one-canvas spec.
- **Not checked:** rendered pictures, focus order, a real screen reader, zoom, tablet and phone; `ms-today-all` and [Second site]'s Today as drawings (lines now, judged from `sites.mjs`); whether figures agree (all placeholders). Clicks are worked out from the boards, not timed.

## Second check

Second reviewer, 3 Oct 2026, reading the boards' text and links, canvas.json's notes, the generator modules and the decision files (not rendered pictures).

- **Counts:** 10 findings. 9 CONFIRMED, 0 REFUTED, 0 UNCERTAIN; L4 is CONFIRMED for three of its four edge cases and REFUTED for the fourth.
- **Severity:** H1 should be Medium by the script's definitions (a decided part of a screen not drawn; the story still runs). The others are right.
- **Decisions:** no finding reopens a recorded decision. H1, M1, M2, M4 and M5 carry decisions out. H1's choice is new: question 1 didn't say what VAT basis the takings figure uses.
- **8th question:** no fix adds a drawing. M2's VAT swap makes an existing drawing (`rp-vat-check-off`) the board.
- **Invented:** nothing found. Jo at both shops (`sites.mjs` line 130), Maya Patel's Standard service and Till B3 all come from the code.

Missed by the walker (mine):

1. The first walk's L4 also listed "a [Manager] at Bolton only, adding [Second site] to Jo's Works at" and "a transfer cancelled while a job at the other shop waits for one of its parts" (`../ux-walkthrough-7-two-shops.md`, L4). This report's L4 and its "Still open (L4)" row drop them without saying so. Neither has a line on the canvas.
2. M3 and L3 are canvas-wide. Dead `#` links are on 190 of 211 boards, and no journey has a tablet and phone note. Fixing only journeys 17, 19 and 20 would leave the same gap everywhere else.

