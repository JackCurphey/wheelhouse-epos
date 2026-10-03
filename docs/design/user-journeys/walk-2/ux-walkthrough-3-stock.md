# UX walk-through 3, second walk — stock, on the one canvas

Walked 3 Oct 2026 for issue #116 step 4, on the one canvas (`generator/out/project/`, published at https://claude.ai/artifact/WzmMdudJPoWH5aUd7J9V4j). The method is `ux-walkthrough-script.md` with step 4's three changes: an eighth question ("could this be a line instead of a new screen?"), screens counted as well as clicks, and the joins walked by following the links in the board files. The first walk is `../ux-walkthrough-3-stock.md`.

## The story

1. WH-1042 (Maya Patel's Trek Domane AL 3) is waiting for Shimano brake pads B05S-RX. Jack Lewis finds it under "For customers" on the restock list and puts it on an order (journey 13).
2. The box arrives. Jo Taylor scans it in, marks one item damaged and books it in. One pad is held for WH-1042 (13).
3. The job shows "Part arrived". Alex Morgan carries on with the work (12, reached from 13).
4. Jo, or the Saturday worker, sells pads at the till. If the held pad is rung up, the till warns but doesn't stop the sale (11).
5. Jack starts a count. Jo joins and counts, and Jack applies the differences. Jo adjusts a damaged pad (14).
6. Jack reads Margin and stock value (17). The invoice check is gone from the story: Jack's 3 Oct answer to question 6 put it later.

## Clicks and screens

Clicks are counted from the boards. Scans and typing aren't counted.

| Person | Clicks | Different screens |
|---|---|---|
| Jack Lewis (owner) | 12 (order 4, count 4, check and apply 2, Reports 2) | 8: rs-hub, rs-restock, rs-order, tk-hub, tk-start, tk-diff, rp-home, rp-margin |
| Jo Taylor (front desk) | 20 (receive 9, sell 3, count 3, adjust 5) | 13: rs-hub, rs-receive, rs-problem, rs-delivery, till-sale, till-pay, till-card, till-receipt, tk-hub, tk-count, st-list, st-product, st-adjust |
| Alex Morgan (mechanic) | 2 | 2: diary, job-overview |
| Saturday worker (till) | 3 | 4: till-sale, till-pay, till-card, till-receipt |

Jack's total drops from about 16 clicks to 12 because the invoice check is later. The labels, booked-in, "Part arrived", Staff views and held-pads warning are now lines on screens people already use.

## High

**H1 — `rs-delivery`, `rs-hub`, `rp-vat` (desktop): the one canvas still draws the invoice check as the normal case, though it is now later.**
- **What happens:** `rs-delivery` is still the board for this screen, and its title is "A booked-in delivery, waiting for its invoice". It ends with "Invoice · Waiting for invoice · Add the invoice". `rs-hub`'s Recent deliveries are tagged "Waiting for invoice" and "Invoice checked". The `rp-vat` board's Stock purchases box still gives a figure: "Supplier invoices booked in · [n]", with "[n] deliveries are still waiting for their invoice". The version that sends you to the accounts software is only a situation line, and that line still says "with the invoice check off", which names a Settings switch that is also later (`j13_later`).
- **Why it matters:** the build works from these boards. Jack's accountant would be shown a stock-purchase VAT figure that Wheelhouse has no invoices to work out. Jo's booked-in screen, the one she actually sees, is only a line under a board built around a feature that isn't being built.
- **Fix, no choice** (the decision is already made): make the booked-in delivery the `rs-delivery` board. That is the old `rs-booked`: "Held for job WH-1042 · 1", the job line, and "Print labels" first. Take the invoice tags off `rs-hub`. On `rp-vat`, make the accounts-software wording the board itself and drop the "check off" line.
- **8th question:** no new screen. The board count stays the same and one situation line goes.
- **Decision it touches:** Receiving 6 and Reports 3, both under their 3 Oct later change (question 6). The later changes said the drawings would be redone at step 3. They haven't been.

**Second check:** CONFIRMED — `j13-rs-delivery-desktop` is titled "A booked-in delivery, waiting for its invoice" and ends "Waiting for invoice … Add the invoice"; `j13-rs-hub-desktop` tags Recent deliveries "Waiting for invoice" and "Invoice checked"; `j17-rp-vat-desktop` gives "Supplier invoices booked in · [n]"; `j17_sit_rp-vat` still has "VAT with the invoice check off"; and both later changes (Receiving stock line 169, Reports and accounts line 144) say the drawings were to be redone at step 3. Severity High stands. One detail for the fix: "Held for job WH-1042 · 1" is the wording on the current `rs-delivery` lines (`receiving.mjs` line 195), not on `rs-booked`, and the manager `rs-booked` still has an "Add the invoice" button (`receiving.mjs` line 186), so that button has to come off as well.

## Medium

**M1 — `rp-home` (desktop): the owner's overview strip isn't drawn.**
- **What happens:** under the date line, `rp-home` goes straight to "Ready-made reports". There's no strip with takings by shop, margin and a link to each shop. I also searched `reports.mjs` for it and didn't find it.
- **Why it matters:** this fails the first owner check in `personas.md`, which asks for revenue and profit split by shop with no clicks. Jack answered "1" on 3 Oct to fix exactly this.
- **Fix, no choice:** add the 3-figure strip to the `rp-home` board, labelled "Margin", not "Profit".
- **8th question:** it changes an existing board. No new screen.
- **Decision it touches:** Reports and accounts, later change (question 1).

**Second check:** CONFIRMED — `j17-rp-home-desktop` goes from the date line straight to "Ready-made reports", and `reports.mjs` `home()` (line 132) has no strip; the Reports and accounts later change (line 142) asks for it. Severity Medium stands.

**M2 — `rp-margin` (desktop): margin split by shop has no drawing and no line.**
- **What happens:** `rp-margin` has no situation list. The code says its All shops version is "not drawn as a board" (`reports.mjs` line 265). Sales, Takings, VAT and Workshop each have an "all shops" line.
- **Why it matters:** Jack's detailed reports are margin breakdowns split between shops, and that's the second owner check.
- **Fix, no choice:** add a line to `rp-margin`'s list: "Margin and stock value for all shops: a Shop column in each table".
- **8th question:** a line will do.
- **Decision it touches:** Reports and accounts 8 (M13).

**Second check:** CONFIRMED — there is no `j17_sit_rp-margin` note in `canvas.json`, `reports.mjs` lines 264–265 say "not drawn as a board", and Sales, Takings, VAT and Workshop each have an all-shops line; Reports and accounts 8 (M13) gives "the others a shop column". One wording point: the second owner check in `personas.md` is "overview to the margin breakdown in one step". It doesn't mention shops, so the finding rests on M13 and the first check. Severity Medium stands.

**M3 — `rs-delivery`, `st-product`, `rp-margin`: nothing now catches a cost that went up.**
- **What happens:** the first walk's fix for this (earlier M6), "Accept the difference: did a cost go up?", sits inside the invoice check and is on `j13_later`. The booked-in delivery shows "[n] × £[cost]" taken from the product, and there's no way to change it there.
- **Why it matters:** when the supplier puts the pads up, every margin and stock value figure Jack reads keeps using the old cost, unless he remembers to edit the product.
- **Fix:**
  1. A line on `rs-delivery`'s booked-in situation: each line's cost can be changed by people who can order stock ("Cost went up? Change it"), and the product's history records it. This catches every delivery, with or without an order. It costs one more control on the screen.
  2. Make the cost editable on the order line (`rs-order` already shows "£[cost]"), and update the product's cost when the order is booked in. It fits naturally when ordering, but misses shops that only receive deliveries (Receiving 2).
  3. Leave it to the product's Edit. Nothing to build, but it relies on Jack's memory.

  Recommend 1.
- **8th question:** a line in either case.
- **Decision it touches:** Receiving 6 and question 6. The invoice check isn't reopened.

**Second check:** CONFIRMED — "Accept the difference: did a cost go up?" is on `j13_later`; the delivery lines show "[n] × £[cost]" with no control (`receiving.mjs` line 195); `rs-order` shows "£[cost]" on each line; and Receiving 2 keeps receive-only shops. The invoice check isn't reopened. Severity Medium stands.

**M4 — `rs-add-product` (desktop): the board is marked Staff, but shows what Staff can't do, plus a held-back screen.**
- **What happens:** the header reads "Staff · desktop · 3 of 7". The box asks for Cost and Price, and offers "Look it up in a supplier's catalogue … Find it". Staff "can't … add products" (Stock control 11). Jo's real path is the `rs-receive` line "Leave it for [Owner or manager]". The supplier catalogue is "Build plan: held back" in `j13_later`, so "Find it" leads nowhere.
- **Why it matters:** a builder could give Staff the product form, and build a button to a catalogue that won't exist.
- **Fix, no choice:** mark the board Owner, and remove the "Find it" row until the catalogue is built.
- **8th question:** it changes an existing board. No new screen.
- **Decision it touches:** Stock control 11, and Receiving's later change (2 Oct, supplier screens).

**Second check:** CONFIRMED — the board header reads "Staff · desktop · 3 of 7", the box has Cost, Price and "Find it"; `j13_sit_rs-add-product` itself marks the situation "Owner"; Stock control 11 (line 120) says Staff "can't … edit or add products"; "Supplier catalogue" is "Build plan: held back" on `j13_later`. Severity Medium stands.

**M5 — `tk-count`, `rs-receive` (desktop only): Jo counting on her phone has no drawing and no written rule.**
- **What happens:** decision 5 says staff join a count "ideally on a phone". Drawing rule 3 says the other sizes become written rules. Neither situation list has a phone line. I also found none in `consolidation-back-office.md`.
- **Why it matters:** the count is meant to be done walking the shelves with a phone. As things stand, the build has nothing to say how that screen should look.
- **Fix, no choice:** add a written line to each list, for example "On a phone: the scan box stays at the top, the list fills the screen, and 'I've finished my part' sits at the bottom". This would come from the old phone boards' code (`stock.mjs`, `receiving.mjs`).
- **8th question:** a line. The layout is a single column either way.
- **Decision it touches:** Stock control 5 and 12.

**Second check:** CONFIRMED — neither `j14_sit_tk-count` nor `j13_sit_rs-receive` has a phone line, and `consolidation-back-office.md` has no "phone" in it. Stock control 5 says "ideally on a phone", and `tk-hub` itself says "Staff join on their phones". A written phone line already has a pattern on the canvas (`j07_sit_ac-inbox`: "On a phone: the list first"). Severity Medium stands.

**M6 — `till-sale` (desktop), line "Selling pads held for job WH-1042": a screen-reader user isn't told about the warning, and it doesn't say what it costs.**
- **What happens:** the basket line's warning, "1 held for job WH-1042 — sold anyway", is a plain span with no announcement (`till.mjs` line 84). The till's held-frame warning, by contrast, is announced (`role="alert"`) and spells out the cost: "Sell anyway? Maya's order loses its bike."
- **Why it matters:** this warning is all that stands between the pads and Maya's Saturday date. A Saturday worker who hasn't seen it for a week, or someone using a screen reader, sells the pad without understanding what it means.
- **Fix, no choice:** change the line's wording: announce the warning, and say "1 held for job WH-1042 — selling it leaves Maya's job waiting for parts". It still never blocks the sale.
- **8th question:** a change to the wording of an existing line.
- **Decision it touches:** Selling at the till 5, and walk-through 3 H1 (not reopened).

**Second check:** CONFIRMED — `till.mjs` line 84 draws `l.warn` as a plain span with no role or live region; the held-frame warning (line 199) is `role="alert"` with "Sell anyway? Maya’s order loses its bike."; `till-held-job` (line 134) is "1 held for job WH-1042 — sold anyway". The job's reorder situation already exists (`j12_sit_job-overview`: "its held pads were sold at the till — reorder"), so the new wording matches what happens. Severity Medium stands.

**M7 — `job-overview` (desktop): how a job's part becomes "On order" isn't shown.**
- **What happens:** the "For customers" restock list counts "products a job is waiting for" (`rs-hub`), and the job's line reads "On order". I searched `job-page.mjs`, `diary.mjs` and job-overview's 22 situation lines. "On order" appears only as a word on the line, never as something someone does. I didn't check the line's own pop-up code.
- **Why it matters:** if nobody marks it, the job never reaches Jack's list, and that gap was the first walk's M1.
- **Fix:**
  1. It happens automatically: a part added to a job with no free stock (stock minus holds) goes on "For customers", then reads "On order" once it's on an order marked ordered. No clicks for Alex.
  2. "Needs ordering" in the line's pop-up. It's clear, but it's one more click for the mechanic and easy to forget.

  Recommend 1.
- **8th question:** a line on `job-overview`'s list either way.
- **Decision it touches:** Receiving 2.

**Second check:** CONFIRMED — I found no way to set "On order" in `job-page.mjs`, `diary.mjs` or the 22 `j12_sit_job-overview` lines. "On order" is only an In stock value (`job-page.mjs` lines 187–212; `diary.mjs` line 2267), and I found no line pop-up in `job-page.mjs` either. One thing to note: Receiving 2 says a part is flagged "on a job marked 'On order'", and "For customers" lists "every job line 'On order'" (`receiving.mjs` line 295). Option 1 adds a stage before "On order" (on the list, not yet ordered), so it refines that wording without reversing it. Jack should know that when choosing. Severity Medium stands.

**M8 — Joins: every hand-over in this story is a dead end on the canvas.**
- **What happens:** on the journey 13, 14 and 17 boards, the only sidebar items that link anywhere are Diary and Overview. Stock, Deliveries and orders, Stock take, Today, Reports and Till have no link. On the till, every sidebar link is "#". Inside the pages, product rows, "Open the job" (`st-product`), "See the list" (`rs-hub`), "Check it" (`tk-hub`) and every report card (`rp-home`) link to "#". "Receive a delivery", "Book in [n] items" and "Take payment" are buttons that go nowhere. Each board's "Tablet and phone ↗" links to one of 8 old canvases, not the one canvas. The job's "Part arrived" strip, in the old code, links to `rs-delivery-staff`, which is now a line, not a board.
- **Why it matters:** none of the five hand-overs (13→12, 13→11, 11→14, 14→17, 13→14) can be clicked through.
- **Fix, no choice:** step 5's clickable mockup wires these up. A link to a situation opens its screen's board. Drop the old "Tablet and phone" links.
- **8th question:** no screens added.

**Second check:** CONFIRMED — sidebar items other than Diary and Overview have no href on the j12–j17 boards, and every `till-sale` sidebar link is "#". "See the list" (`rs-hub`), "Check it" (`tk-hub`), "Open the job" (`st-product`) and every `rp-home` card are "#". `diary.mjs` lines 2909 and 2917 link "Part arrived" to `rs-delivery-staff-*`. Two corrections: the story's boards (journeys 10–17) link "Tablet and phone ↗" to 6 old canvases, not 8 (the whole canvas links to 23); and severity should drop to **Low**. These are links on static drawings, the clickable mockup is already step 5 of issue #116 (`.agents/STATUS.md` line 18), and no step of the story is missing a screen.

## Low

**L1 — `st-adjust` (desktop):** marked "Staff", but drawn with Jack Lewis signed in, and with Cost, Margin and Edit behind the box. Fix, no choice: mark it Owner, or draw the Staff product page behind it. 8th question: no new screen.

**Second check:** CONFIRMED — `j14-st-adjust-desktop` reads "Staff · desktop · 6 of 11", signed in as "Jack Lewis Owner", with Edit, Cost £[cost] and Margin [n]% behind the box; `j14_sit_st-adjust` marks its situation "Owner".

**L2 — `tk-diff`, `tk-hub`:** these say "£[value] under in all" and "£[value] under". The first walk's M7 fix asked for "under, at cost". Fix, no choice. Line wording only.

**Second check:** CONFIRMED — `tk-diff` says "£[value] under in all" and `tk-hub` "£[value] under"; the first walk's M7 fix (line 111) asked for "£[value] under, at cost".

**L3 — Situation-line wording:** "Receiving a transfer: one short" and "Today: a transfer arrived short". The word list and the code say "1 missing". Separately, the till bar's shop button is announced as "Switch site" (`till-sale`), where the word list says "shop" (walk-through 7 L1). Fix, no choice: "a transfer with 1 missing", and "Shop: Bolton. Choose a shop".

**Second check:** CONFIRMED — `j13_sit_rs-receive` has "Receiving a transfer: one short", `j10_sit_op-today` has "Today: a transfer arrived short", and `till-sale`'s shop button is `aria-label="Switch site"`. It is wider than the till sale, though: "Switch site" is on every j11 till board, the four j16 cash-up boards, `j10-op-float-check`, `j10-op-float-short`, `j05-cp-receipt-address`, `ja-till-rail` and `ja-till-search`. The fix should cover the shared till bar, not one board.

## Earlier findings on the one canvas

- **Fixed:** H1 (holds drawn on `st-product` and `rs-delivery`; the till warning is a line, M6 here), H2 (`tk-start`, `tk-count`, `tk-diff`), M1 ("For customers" on `rs-hub` and `rs-restock`; how "On order" is set is M7), M2 (lines on `rs-problem`, `rs-delivery`, `rs-order` and four job lines), M3 (lines, and "Products to add" on `rs-hub`; label in M4), M5 (in code; now lines), M7 (on `rp-margin`; "at cost" is L2), M9 (a line on `rs-receive`), M10, L1–L5 (except L3's wording; L5's link now points at a line, M8).
- **Changed by question 6:** M4 is a line under an invoice board, and M8 is settled but not drawn (both H1). M6 is reopened (M3).
- **Not checked again:** L6.

## End table

| Id | Screens | One line | Needs Jack |
|---|---|---|---|
| H1 | rs-delivery, rs-hub, rp-vat | The invoice check is still drawn as normal; VAT gives a figure it can't have | No |
| M1 | rp-home | The owner's 3-figure strip isn't drawn | No |
| M2 | rp-margin | No all-shops margin line | No |
| M3 | rs-delivery, rp-margin | Nothing catches a cost rise now the invoice check is later | Yes (1–3) |
| M4 | rs-add-product | Marked Staff, shows cost and price, and "Find it" goes to a held-back catalogue | No |
| M5 | tk-count, rs-receive | Counting on a phone has no drawing and no written rule | No |
| M6 | till-sale | The held-pads warning isn't announced and doesn't say what it costs | No |
| M7 | job-overview | How a part becomes "On order" isn't shown | Yes (1–2) |
| M8 | all | Every join in the story is a dead end on the canvas | No |
| L1 | st-adjust | Board marked Staff but drawn as the owner | No |
| L2 | tk-diff, tk-hub | "At cost" missing | No |
| L3 | rs-receive, op-today, till-sale | "short" and "site" wording | No |

Counts: 1 High, 8 Medium, 3 Low. None needs a new drawing.

## Choices for Jack

1. A cost that went up on a delivery (M3): recommend 1, change it on the booked-in delivery.
2. How a job's part gets "On order" (M7): recommend 1, automatically when there's no free stock.

## Verification

Read as text, desktop only (links and buttons pulled out by a script in the session scratchpad): `canvas.json` (boards; the j10–j17 and ja situation notes; every `_later` note) and the boards rs-hub, rs-receive, rs-add-product, rs-problem, rs-delivery, rs-order, rs-restock, st-list, st-product, st-adjust, tk-hub, tk-start, tk-count, tk-diff, rp-home, rp-margin, rp-vat, till-sale, op-today and job-overview. Links were also counted on till-pay, till-receipt, diary and overview. Code: `consolidate/j13.mjs` and `j14.mjs`; searched `receiving.mjs`, `stock.mjs`, `till.mjs`, `diary.mjs`, `job-page.mjs`, `reports.mjs`, `opening.mjs` and `oversight.mjs`. Decisions: Receiving stock (13), Stock control (14) and Reports (17) in full with their later changes; Selling at the till (11); the build-plan questions; the walk-through 3 decision.

Not checked: rendered images; tablet and phone (not on the canvas for these journeys); a real screen reader, keyboard order or focus; zoom; the job line's pop-up code (M7); the first walk's L6 edge cases; the published artifact as against the local build.

## Second check

Checked 3 Oct 2026 by a second reviewer who didn't write the report. They used the canvas text (`canvas.json` notes and the j10–j17 board files, read as text), the generator code (`receiving.mjs`, `till.mjs`, `reports.mjs`, `job-page.mjs`, `diary.mjs`, `consolidate/j13.mjs`), the decision files for Receiving stock, Stock control and Reports and accounts with their later changes, the walk-through 3 decision, `personas.md`, the drawing rules in `README.md`, and the first walk.

- **Counts:** 12 confirmed, 0 refuted, 0 uncertain. One severity change: M8 drops from Medium to Low. That makes 1 High, 7 Medium and 4 Low.
- **Reopened decisions:** none. H1, M1 and M2 carry out decisions already made (issue #116 questions 1 and 6, Reports and accounts 8). M3 keeps the invoice check later. M7 option 1 refines Receiving 2's "a job marked 'On order'" without reversing it (see M7's check).
- **8th question:** no fix adds a drawing. M4 and L1 relabel existing boards, and H1 swaps which state the `rs-delivery` board shows.
- **Invented data:** none found. The proposed wordings (M5, M6) are offered as fixes, and the example data (WH-1042, Maya Patel, Hook 3) comes from the drawings.
- **Not checked by the second reviewer:** the click and screen counts in the table were not recounted board by board. Same limits as the walker otherwise: no rendered images, no screen reader, and not the published artifact.

Found by the second reviewer (mine, not the walker's):
1. **Low, H1's fix:** making the old `rs-booked` the board also means taking off its "Add the invoice" button (`receiving.mjs` line 186). The staff `rs-delivery` situation's note "Costs and the invoice are for people who can order stock" (line 216) also names the invoice and needs rewording.
2. **Low, L3's reach:** "Switch site" is the till bar's label on every till board, the cash-up boards, the two float boards, `j05-cp-receipt-address` and the journey A till boards, not just `till-sale`.
3. **Low, wording in the report:** "question 6" in the story and in H1 means issue #116 question 6 (the invoice check). It is not Q6 in `2026-10-03-build-plan-questions.md`, which is the workshop PIN wait. Writing "issue #116 question 6" would stop a reader mixing them up.
