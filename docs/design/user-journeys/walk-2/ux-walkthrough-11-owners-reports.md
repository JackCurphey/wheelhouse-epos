# UX walk-through 11 — the owner's reports

Walked 3 Oct 2026 on the one canvas (`generator/out/project/`, published at https://claude.ai/artifact/WzmMdudJPoWH5aUd7J9V4j), for issue #116 step 4 and build plan WP-W.3. Journeys 17, 19, 20 and 8. A new story; walk-through 7 and `consolidation-back-office.md` touched these screens and are checked at the end.

## The story

1. Jack Lewis (Owner) signs in on a desktop and lands on Bolton's Today (`op-today`).
2. They open Reports (`rp-home`) and want what they read in Citrus Lime: takings and margin, split between Bolton and [Second site], with no clicks.
3. One step on, they want the margin breakdown, by category and by shop (`rp-margin`).
4. They check the figures match: Sales, Takings and cash-ups, a closed day's end-of-day report, and Today's All shops row.
5. They glance at the activity log (`ops-log`), and in Settings give Jo Taylor "Can see reports" (`set-staff-person`).
6. A [Manager] who works at both shops does steps 2–3 for their own shops.

## Clicks and screens per person

On the main path, as drawn. A box over a page with its own board counts as a screen.

| Person | Task | Clicks | Different screens |
|---|---|---|---|
| Jack Lewis (Owner) | Today → Reports → All shops → Margin → margin by shop (through Sales › Change what's shown) → Takings → a closed day → Activity log | about 15 | 9 (`op-today`, `ms-switch-open`, `rp-home`, `rp-margin`, `rp-sales`, `rp-change`, `rp-takings`, `rp-day`, `ops-log`) |
| Jack Lewis (Owner) | Give Jo "Can see reports" | about 6 (Settings, Office, Staff and roles, Jo, the switch, Done) | 2 (`set-staff`, `set-staff-person`) |
| [Manager] at two shops | Today → Reports → All shops → Margin | 4 | 4 (`op-today`, `ms-switch-open`, `rp-home`, `rp-margin`) |
| Jo Taylor (Staff, with "Can see reports") | Reports → Sales | 2 | 2 (`rp-home` as Staff, a situation line; `rp-sales`) |
| Saturday worker | No reports: "Can see reports" is off unless given | 0 | 0 |

With the decided strip drawn as H1 recommends, the owner's overview becomes 1 click and 1 screen from Today, and margin by shop 2 clicks and 2 screens.

## High

**H1 — `rp-home` (desktop): the decided figures strip is not on the canvas, and what it must show is not yet settled, so the owner's first check still fails.**
- *What happens:* Reports opens on "Thursday 17 September · North Street Cycles, Bolton · use the shop menu for another shop or all shops", then nine report cards. No strip is drawn. It isn't a line in `rp-home`'s situation list either (the five lines are Staff, the saved-report menu, Undo, Activity log, and no log for Staff), and there is no "Later" note for journey 17. Jack's 3 Oct answer 1 ("takings by shop, margin, a link to each shop… Labelled Margin") is recorded only in the Reports decision file.
- What the strip has to settle, from what the drawings show:
  1. **Which shops.** The page follows the shop menu and opens on Bolton, so "takings by shop" needs the menu ignored, or 2 more clicks. A [Manager] gets only their own shops.
  2. **Which period.** Every report opens on "So far: Mon 14 – Thu 17 September"; Today's All shops row shows today's "Sales so far". The strip must match the report it links to.
  3. **VAT.** Sales shows "Takings (with VAT)"; Margin is on "Sales before VAT". Side by side, the margin looks smaller than it is.
  4. **Gaps.** Margin leaves out "[n] products sold without a cost", possibly many after a move from Citrus Lime.
  5. **Sales still to send** at [Second site] ("[n] sales waiting" on Today) make that shop's figure short.
  6. **Staff** with "Can see reports" but not costs must not see margin (Reports 5).
  7. **"A link to each shop"**: whether it opens that shop's Sales or switches the whole app isn't said.
- *Why it matters:* it's the first thing Jack Lewis reads. If it disagrees with the report one click away, they stop trusting every figure.
- *Fix:* drawn on the `rp-home` board itself (it's the default state), with the shop and Staff cases as lines. Choices:
  1. **Every shop you can see, whatever the menu says; "This week so far"; takings with VAT; margin £ and % with "Margin is on sales before VAT · [n] products have no cost"; "[n] sales still to send" on a row; each shop's name opens its Sales.** Matches the report one click away; one extra note line.
  2. The same, but following the shop menu. Simpler rule, but "split by shop" takes 2 clicks, failing the persona check.
  3. Today only. Matches Today, but no report opens on Today.
  Recommend 1.
- *Decision it touches:* Reports 1 (no chart dashboard: the strip is figures only, so this holds), Reports 5, the 3 Oct answer 1 later change, Multiple sites 1 and 8.
- *8th question:* it changes the existing board's default, so no new board; the other cases are lines.
**Second check:** CONFIRMED, with one correction — `j17-rp-home-desktop` has no strip (opening line, then nine `href="#"` cards), `j17_sit_rp-home` has exactly the five lines listed and `canvas.json` has no `j17_later`, and the Reports file's 3 Oct question 1 later change says "The drawings are not changed yet"; but choice 1's "every shop you can see, whatever the menu says" goes against Multiple sites 1 ("The sidebar's shop switcher sets the shop for every page — … reports", with "Every page says which shop it is showing", chosen over "showing every shop everywhere"), so it reopens that decision and must say so, and it is the opposite of `walk-2/ux-walkthrough-7-two-shops.md` H1, which recommends the line "One shop chosen: that shop's figures, and a link to the other". High is right (the owner's first persona check fails).

**H2 — `rp-sales`, `rp-takings`, `rp-day`, `eod-z`, `op-today` (All shops situation), the coming strip (desktop): "takings" has three names and at least two meanings, so the figures can't be relied on to match.**
- *What happens:*
  - Sales: "Takings (with VAT)", Thursday already counted "so far"; online and Cycle to Work money not said.
  - Takings and cash-ups: the same label, but "Takings by closed day", Thursday "Not closed yet", Online a separate tile, a reopened day "left out and said so". Sales doesn't say whether it leaves that day out.
  - End-of-day report (`eod-z`): "Sales [£ total]", including Cycle to Work owed, leaving online out.
  - Today, All shops (situation; `sites.mjs` `todayAll`): "Sales so far".
  - Workshop: "Workshop takings… Total", VAT not said.
- *Why it matters:* the owner's third check is "Do the figures match everywhere they appear?" Two tiles with the same label can differ on the same Thursday, and the till uses a third name. The owner can't tell a real difference from two reports counting differently.
- *Fix:* choices:
  1. **One meaning everywhere:** "Takings" is all money for sales in the period, with VAT, refunds off, online and Cycle to Work in, open days "so far" — on the strip, Sales, Takings, Today and the end-of-day report (which says "Takings", not "Sales"). The closed-days figure is "Closed days' takings". A few label changes, no drawings.
  2. Keep each figure and add a line saying what it covers. No label changes, but one word keeps two meanings.
  Recommend 1.
- *Decision it touches:* Reports 1 and 8 (audit M13), Cash-up 6, the word list ("Close the day… 'Takings and cash-ups' in Reports").
- *8th question:* labels and footnotes on existing boards, plus one line on `eod-z`'s situation list. No new drawing.
**Second check:** CONFIRMED, with one caution — `rp-sales` reads "Takings (with VAT)" and "Takings include VAT and take refunds off" with no word on online, Cycle to Work or a reopened day (Reports 8 wants a reopened day "called out on every report it leaves out"); `rp-takings` has the same label with Online and Cycle to Work as separate tiles and "Thu 17 Sep · B1 … Not closed yet"; `eod-z` reads "Sales [£ total]" with a Cycle to Work row and "Online payments today: £[£] — see Reports"; `sites.mjs:85` heads Today's all-shops column "Sales so far"; `reports.mjs:307` has "Workshop takings" with Labour/Parts/Total and no VAT word. Caution: choice 1 puts online "in" Takings on the end-of-day report too, but that report is one till's close ("Day closed · Till B1") and Cash-up 6 / Multiple sites 9 make cash-up per till, so online can't sit in a till's figure — the fix needs that exception said. Also `eod-z` has no situation list in `canvas.json` (only `j16_sit_eod-count`), so "one line on eod-z's situation list" would start one. High is defensible (issue #116 item 4 and the third persona check); Medium would also fit, as no figure is wrong, only unclear.

## Medium

**M1 — `rp-margin` (desktop): margin split by shop isn't on the canvas, and takes 5 clicks.**
- *What happens:* `rp-margin` is Bolton only, with no situation list, so no "All shops" line as Sales, Takings, VAT and Workshop have. `margin('All shops')` changes only the title (`reports.mjs` 266-270). The only route is Sales → Change what's shown → "Margin" → "Shop" → Show report: 5 clicks, 3 screens.
- *Why it matters:* the owner's second check is margin "in one step", split between the shops.
- *Fix, no choice (Reports 8, audit M13, already says "the others a shop column"):* a line on `rp-margin`: "All shops: a Shop column in margin by category and stock value". The strip's margin opens it.
- *Decision it touches:* Reports 8; walk-through 7 M1.
- *8th question:* a line will do; it's the same table with one more column.
**Second check:** CONFIRMED — `canvas.json` has no `j17_sit_rp-margin`, `reports.mjs:266` `margin(site)` uses the shop only in `shopName(site)` (its comment: "not drawn as a board"), and `rp-change` offers Measure "Margin" and Split by "Shop", so the 5-click route is real. Reports 8 (M13, "the others a shop column") settles it, so no choice is right. It drops Discounts and refunds, which the "Earlier findings" section says also has no all-shops line and which `walk-2/ux-walkthrough-7-two-shops.md` M1 already fixes with a line; this finding duplicates that one and should point to it.

**M2 — `rp-margin` (desktop): what labour "cost" is isn't said.**
- *What happens:* "Margin by category" has a "Labour" row with "What it cost you [£]". Wheelhouse doesn't hold wages, and no decision says what labour costs.
- *Why it matters:* counted at no cost, labour inflates the margin on the strip and here, and it won't match Citrus Lime's.
- *Fix:* choices:
  1. **Leave labour out of margin and show it beside it: "Labour £[£] · not in margin".** Margin stays on goods, which have real costs.
  2. Count labour at no cost, said on the row.
  3. A cost per hour in Settings › Workshop. More accurate, but another setting, and staff pay is sensitive.
  Recommend 1.
- *Decision it touches:* none (Reports 6's labour split is unchanged).
- *8th question:* a row and a note on the existing board.
**Second check:** CONFIRMED — `rp-margin`'s "Margin by category" table has a Labour row with "What it cost you [£]", and no decision file mentions a cost for labour (searched `docs/decisions/` for labour with cost, margin, wage or hour: none). Medium is right; no decision reopened.

**M3 — `set-staff-person`, `ops-log`, `rp-vat`, `rp-sales` (desktop): deferred work is still drawn on main boards.**
- *What happens:* the person form shows "Signed-in devices", "Alerts on Today" and "Sign out everywhere" (question 5, listed in `j20_later`). The log shows "Seen by Jack Lewis", "On Today" tags, "Signed out from Signed-in devices" and "Website published Home page and Theme" (questions 5 and 2). VAT's board shows "Supplier invoices booked in · [n]" (question 6; the check-off version is only a line). Sales says "Practice sales from moving across are never counted" (question 4).
- *Why it matters:* the build follows the boards, so it would build deferred work.
- *Fix, no choice (carries out the 3 Oct answers):* change the text or make each a "Later" line; VAT's check-off wording becomes the default.
- *Decision it touches:* issue #116 questions 2, 4, 5, 6 and their later changes.
- *8th question:* text and lines only.
**Second check:** CONFIRMED, with one correction — `set-staff-person` shows "Signed-in devices", "Alerts on Today" and "Sign out everywhere"; `ops-log` shows "Seen by Jack Lewis at [time]", "On Today", "Signed out from Signed-in devices" and "Website published Home page and Theme"; `rp-vat` shows "Supplier invoices booked in · [n]"; `rp-sales` has the practice line. Correction: practice mode is dropped, not deferred (Moving from Citrus Lime, 3 Oct later change: "no practice sales to keep out of reports"), so the Sales line should be removed, not made a "Later" line. Same finding as `walk-2/ux-walkthrough-7-two-shops.md` M2 (which also lists `ms-add-shop`); one fix covers both.

**M4 — every board in this story: the joins can't be walked as clicks.**
- *What happens:* `rp-home`'s nine report cards and two saved reports, and "All reports" on every report, are `href="#"`. In the sidebar only Diary, Overview and Your settings link anywhere; Today, Reports and Settings don't. "Set up" (`fr-today`) and "See them and add a cost" go nowhere. Only the canvas's "‹ Prev / Next ›" moves between reports.
- *Why it matters:* Today → Reports → Margin and back are all dead ends, and step 5's mockup treats a dead link as a bug.
- *Fix, no choice:* the generator links the cards, "All reports" and the sidebar; "See them and add a cost" opens the stock list filtered to no cost.
- *8th question:* links only.
**Second check:** CONFIRMED, severity questionable — on `rp-home` all nine cards and both saved reports are `href="#"`, the sidebar links only Diary, Overview and Your settings, "Set up" on `fr-today` is a plain button, and "See them and add a cost" is a button with no target. But issue #116 step 5 is where "every button and link goes somewhere" and "a dead link is a bug" apply (the mockup, not the canvas), and `walk-2/ux-walkthrough-7-two-shops.md` M3 is the same finding; I would make this Low or fold it into step 5's work rather than count a separate Medium.

## Low

**L1 — `rp-sales`, `rp-margin`, `rp-takings` (desktop): the comparison lines are 12px.** "[Up or down] £[£] on the same days last week" under each figure is 12px. That is the part an owner reads to see whether things are better. *Fix, no choice:* 14px, as walk-through 7 L2 did for the shop line. *8th question:* a style rule, not a drawing.

**Second check:** CONFIRMED — `reports.mjs:70` `stat()` draws the comparison span at `font-size: 12px`, used by every figure tile on Sales, Margin and Takings. Low is right.

## Edge cases and accessibility

- **Edge cases:** a shop opened part-way through gets "Opened [date] — nothing to compare before then" on Sales and Workshop for all shops (lines only), not on Margin or the strip. A reopened day is said on Takings only (H2). Sales waiting to send show on Today only (H1). A day that didn't reach Xero has a Today line. Internet dropping on a report: not checked.
- **Screen reader:** graphs have a spoken description pointing to the table; periods are a `radiogroup` with `aria-checked` and a tick; "Up or down" is in words; row buttons are named; the shop menu says "Shop: Bolton. Choose a shop". The strip can't be checked (not drawn).
- **Keyboard:** report cards are links. Focus in Change what's shown: not checked.
- **Low vision:** comparison lines at 12px (L1). Desktop boards only, so zoom, reflow and phone: not checked; the owner's device is "not known".
- **Saturday worker:** no reports unless given the switch; if allowed to close the day, the end-of-day "Sales" is H2's clash.

## Earlier findings on these screens

- Walk-through 7 H1 (Bolton's Today silent about the other shop): **fixed.** `ms-switch-open` shows "[Second site] · 3 things need attention… See them".
- Walk-through 7 M1 (only 3 reports compare shops): **partly fixed.** Workshop for all shops is now a line, with "A job counts at the shop whose workshop did it". Margin and Discounts still have none (M1 here).
- Walk-through 7 M2 (moving a till): **fixed**, `ms-till-move`. M4 (log keeps to its shop): **fixed**, situation "All shops: every line shows its shop". H2, M3, M5, M6, L3: not on this story's path, not re-checked.
- Consolidation finding 3 (strip disagreement, no all-shops margin): **still open** (H1, M1). Finding 4 (figures that differ by design): **still open** (H2).

## End table

| Id | Screens | One line | Jack chooses? |
|---|---|---|---|
| H1 | rp-home | The decided strip isn't drawn; which shops, period, VAT, gaps and links unsettled | Yes |
| H2 | rp-sales, rp-takings, eod-z, op-today | "Takings" has three names and two meanings | Yes |
| M1 | rp-margin | No margin by shop; 5 clicks through Change what's shown | No |
| M2 | rp-margin | Labour's cost in margin isn't said | Yes |
| M3 | set-staff-person, ops-log, rp-vat, rp-sales | Deferred work still drawn on main boards | No |
| M4 | all | Report cards, All reports and the sidebar go nowhere | No |
| L1 | rp-sales, rp-margin, rp-takings | Comparison lines at 12px | No |

## Choices for Jack

1. **The Reports strip (H1).** Recommend 1: every shop you can see, this week so far, takings with VAT, margin £ and % with a note on VAT and products without a cost, sales still to send, each shop's name opens its Sales.
2. **What "takings" means (H2).** Recommend 1: one meaning everywhere, including the end-of-day report, which says "Takings" instead of "Sales".
3. **Labour in margin (M2).** Recommend 1: leave labour out of margin and show it beside it.

## Verification

- **Boards read (desktop, text and every link):** j17 all 12 boards; j19 `ms-switch-open`, `ms-service-price`, `ms-product-price`, `ms-add-shop`, `ms-till-move`; j20 `ops-log`; j08 `fr-today`, `set-staff-person`; j10 `op-today`; j16 `eod-z`.
- **Also read:** situation lists and Later notes in `canvas.json` for journeys 8, 10, 16, 17, 19, 20; `reports.mjs`, `sites.mjs` `todayAll`, `consolidate/j17.mjs`; the Reports decisions with later changes, the later changes to Multiple sites, Oversight and Owner setup, the build-plan questions, issue #116's answers, walk-through 7, `consolidation-back-office.md`.
- **Not checked:** the rendered look, tablet and phone, focus in Change what's shown, whether "Shop" is greyed for one shop, Discounts' and Returning customers' all-shops cases. Every figure is a placeholder, so matching is judged from labels and notes.

## Second check

Checked 3 Oct 2026 by a second reviewer against the boards and `canvas.json` in `generator/out/project/`, `reports.mjs`, `sites.mjs`, `consolidate/j17.mjs`, the Reports and accounts, Multiple sites, Cash-up, Management oversight and Moving from Citrus Lime decisions with their later changes, `personas.md`, the script and issue #116.

- **Counts:** 7 findings — 7 confirmed (4 with a correction or caution), 0 refuted, 0 uncertain. Severity: H2 could be Medium; M4 should be Low or folded into issue #116 step 5.
- **Nothing invented:** every quoted label matches the boards; figures are all placeholders.
- **Missed by the walker (mine):**
  1. **This walk repeats `walk-2/ux-walkthrough-7-two-shops.md`, written the same day, without citing it.** Its H1, M1, M2 and M3 are this report's H1, M1, M3 and M4. The "Earlier findings" section checks only the first walk (`../ux-walkthrough-7-two-shops.md`). Jack should get one question per issue, not two.
  2. **The two walks disagree on the strip.** Walk 7 (second walk) wants the strip to follow the shop menu (a line "One shop chosen: that shop's figures, and a link to the other"); this walk's H1 choice 1 ignores the menu. Only this report's choice 2 keeps Multiple sites 1 as decided. Jack has to choose, knowing choice 1 reopens Multiple sites 1.
  3. **H1 and walk 7 H1 overlap on VAT.** Both recommend takings with VAT plus a note that margin is on sales before VAT, so that part agrees and can be asked once.

