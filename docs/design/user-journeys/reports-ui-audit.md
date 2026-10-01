# Journey 17 — UI audit (desktop, Soft sand)

Audited 1 Oct 2026 by the designer helper from the 21 desktop renders of the Reports and accounts boards (1280 x 800: `rp-home`, `rp-home-staff`, `rp-sales`, `rp-sales-all`, `rp-sales-year`, `rp-your-settings`, `rp-change`, `rp-changed`, `rp-save`, `rp-takings`, `rp-day`, `rp-reopen`, `rp-vat`, `rp-margin`, `rp-workshop`, `rp-discounts`, `rp-accounts-connect`, `rp-accounts-map`, `rp-accounts-log`, `rp-today-accounts`, `rp-person`), against `docs/decisions/2026-10-01-reports-and-accounts-review.md` (decisions 1-7), `generator/reports.mjs` (`periodRow`, `head`, `stat`, `table`, `graph`, `lineGraph`, `home`, `changePanel`, `saveDialog`, `takings`, `dayReport`, `reopenDialog`, `vat`, `margin`, `workshop`, `discounts`, `mapOpen`, `logOpen`, `personBoard`), the pieces it borrows (`settings-frame.mjs` `offer`; `opening.mjs` `today`; `setup.mjs` `personDialog`; `app-map.mjs` `yourSettingsDialog`), the rendered HTML of the boards for the accessibility checks, and the decisions it has to agree with (Cash-up 6, Multiple sites 1, 4, 8, 9, Owner setup 9, Selling at the till 4). Tablet and phone are not drawn yet, so nothing here covers them.

**Not raised, on purpose.** The [bracketed] placeholders (`[£]`, `[n]`, `[sales]`, `[Product]`, `[Report name]`, `[Second site]`, `[Account]`, `[time]`, `[date]`) and the even placeholder bars and flat line in the graphs (decision 7). The Soft sand look. Clipped scroll areas the renderer cuts off. Tablet and phone. 12-13px text that is only a label. Real example data: North Street Cycles, Bolton, tills B1-B3, Jack Lewis, Jo Taylor, Alex Morgan, Mon 14 - Sun 20 September 2026, Workshop/Parts/Accessories, UK VAT rates 20%, 5%, 0%. None of the seven decisions is reopened.

**Verdict.** The decisions are carried out and the look is right: one dark button per board, controls at 44px, labelled fields, dialogs with a role, labelled title and Close button, tables with column and row headers, numbers right-aligned in monospace, graph always above a table holding the same figures, graphs hidden from screen readers with a label pointing at the table, and the Stock-purchases warning in the decision's exact words. Plain wording is mostly good. The problems are in what the decisions leave to the design: a closed day cannot be opened from the table that says to open it; the reopened-day, broken-connection, empty, first-period and part-period states are not drawn; VAT assumes calendar quarters; Staff with "Can see reports" have no door to the page; and the "day didn't go to Xero" board shows a day still open.

Checked against source: day rows in `rp-takings` contain no link or button; `rp-home-staff` draws a sidebar with no Reports item; the Save dialog's `role="radiogroup"` holds `aria-pressed` buttons while the Change panel uses `role="radio"`; Workshop's two tables open with an empty `<th>`; every page has two `<h1>`; graphs are `<figure role="img" aria-label="… The figures are in the table below.">`; `mapOpen(missing)` exists but no board calls it; `rp-today-accounts` names Thu 17 September while Till B1 is "Open". Nothing was run in a browser.

## High

**H1 — `rp-takings`, `rp-day`, `rp-reopen`: a closed day cannot be opened from the table that tells you to.** The note says "Open a day…"; the rows are plain cells with no link, arrow or hover. Reopening (Cash-up 6) is only reachable this way. *Why it matters:* the way a manager corrects a wrong close has no visible or keyboard control. *Fix:*
1. Row header becomes a link named "Wed 16 Sep, Till B2, open end-of-day report", with chevron, hover tint, 56px row. One click.
2. Plain rows plus an "Open" button per row. Clearer for mouse users; adds a column.
Recommend 1.

**H2 — `rp-takings`, `rp-reopen`: a reopened day silently changes every total.** The dialog says its figures come out of the reports; no report shows it happened. *Why it matters:* a low week reads as a bad week, or an accountant gets figures missing a day. *Fix:*
1. Warning above the figures on every affected report ("1 day is reopened and left out: Wed 16 Sep, Till B2. Close it to bring it back."), row marked "Reopened" in text. Draw `rp-takings-reopened`.
2. Keep the figures in with a "Reopened, not final" tag. Contradicts the dialog and Cash-up 6.
Recommend 1.

**H3 — `rp-home-staff`, `rp-person`: Staff with "Can see reports" see a Reports page but the sidebar has no Reports item, and the person board disagrees.** Jo's "Can see reports" is Off on `rp-person`. Jo also gets a switcher chevron, though one-shop people see no switcher (Multiple sites 9). *Fix:* Staff sidebar with the switch on shows Today and Reports (highlighted); `rp-person` shows reports On, costs Off for Jo; no chevron for a one-shop person.

**H4 — accounts boards: failure states are not drawn beyond "no account chosen".** Not drawn: expired or refused connection, a day waiting for a till to close, a non-account send failure, disconnect or switching Xero to QuickBooks, who may connect, and the missing-account mapping row (coded, never used). *Why it matters:* when the link breaks the books stop updating silently. *Fix:*
1. Draw four: connection lost (Today and top of section), day waiting ("Wed 16 Sep · Bolton: waiting for B3 to close"), missing-account row (red border plus words), Disconnect with a consequence line.
2. Only connection lost and the missing-account row. Fewer boards; two states unspecified.
Recommend 1.

**H5 — `rp-today-accounts`, `rp-accounts-log`: "didn't go to Xero" for a day not yet closed, and two meanings of "sent".** Decision 4 posts a day on close; Thu 17 is today and Till B1 is Open. The till's "All sales sent" sits beside "didn't go". *Fix:*
1. Move the failing example to Wed 16 Sep, show Thu 17 as "Not closed yet", rename the till badge "All sales saved".
2. Keep the example and say "Closed at [time], didn't go to Xero". Changes a journey 16 board.
Recommend 1.

**H6 — `rp-vat`: calendar quarters assumed; no graph or comparison; "Change what's shown" offered.** Many UK shops have staggered quarters, and the period is a legal fact. Decision 7 says every report has a graph, decision 1 a period-before comparison, decision 3 says the accountant confirms the layout. *Decision for Jack:*
1. Ask once for the VAT quarter start month (Shop and sites); pills "This VAT quarter" / "Last VAT quarter". Right figures; one new setting.
2. Keep calendar quarters, rely on "Pick dates". No setting; most shops start with wrong dates.
Recommend 1. Also add last quarter beside figures, a graph (or state VAT has none), and remove "Change what's shown" here.

## Medium

**M1 — every report: the table starts at the fold.** Back link, title, sub-title, six periods, a wrapped second button row, four tiles and a 150px graph push the first row to about y 690; two rows show. *Fix:*
1. Buttons on the title row right-aligned (as VAT does), graph 120px; gains about 100px.
2. As 1, plus tiles as one text line. Gains more, loses the big figures.
Recommend 1.

**M2 — `rp-change`: any measure with any split; Margin offered to all.** Hours by Payment type, Jobs by Product mean nothing. The note about Margin is printed to the owner, who can see it; for Staff the chip would be dead or a leak. *Fix:*
1. Grey out splits that don't fit with a reason; don't draw Margin for people without the costs switch; delete the note.
2. Allow everything and show "Nothing to show for this mix". Less to build; dead ends found by trying.
Recommend 1.

**M3 — `rp-change`: choice looks differ and unselected ones look disabled.** Measure/Split: fill, no tick. Only: fill plus tick. Unselected Only chips use muted text and a faint border (about 1.3:1). "Show it" is vague; "A supplier…" has no picker; one-or-several for Only is unsaid. *Fix:* one selected look (fill plus tick), ink border on unselected, "Show report", "Pick one or more", draw the supplier list.

**M4 — `rp-changed`: Save is below the fold, "Changed" is inert, title unchanged.** Title stays "Sales" for an Items sold report; total row says "Accessories". *Fix:* a banner under the title ("You've changed this report. Save as my report · Back to Sales"), title "Sales: items sold by product", total row "Total, Accessories only".

**M5 — `rp-save`: wrong role, shared by default, no errors, no Staff version.** *Fix:*
1. `role="radio"`/`aria-checked`, default "Just me", "Name is needed" and "You already have a report called that", Staff see "Only you can see it".
2. As 1 but default shared. Faster for sharing shops; first report shared by accident.
Recommend 1.

**M6 — Your reports: no management.** Missing: rename, delete, stop sharing, owner on shared reports, editing someone else's, owner removed. *Fix:*
1. "…" menu (Rename, Share/stop sharing, Delete with Undo), "Shared by Jack Lewis", others "Save as my report" for a copy.
2. Rename and delete on the report page only. Smaller; list unmanaged.
Recommend 1.

**M7 — empty, first and part-finished periods not drawn.** "This week" on Thursday shows Mon-Sun equal bars against a whole last week. *Fix:*
1. In words: "So far: Mon 14 - Thu 17 against the same days last week"; "Nothing sold in this period" with no graph; "No period before to compare", no dashed bars.
2. Whole periods only. Simplest; drops the Thursday report.
Recommend 1.

**M8 — "Pick dates": no picker, no selected state.** *Fix:* a small dialog (From, To, "Show report") and a lit pill reading "14 Sep - 20 Sep".

**M9 — tile comparisons are a bare "Last week [£]".** No direction; one arrow colour would be wrong for Refunds. *Fix:*
1. "Up £[£] on last week" / "Down [n] on last week" in ink, no good/bad colour.
2. Keep as is. Point of comparing lost.
Recommend 1.

**M10 — `rp-home-staff`, `rp-discounts`: Staff see colleagues' discounts and refunds by name and reason.** Decision 5 includes the report; Selling at the till 4 says managers see them. *Decision for Jack:*
1. Staff see it without the "By" column, or totals only.
2. Leave and say so in Staff and roles. Matches decision 5; switch bigger than its name.
Recommend 1.

**M11 — `rp-margin`: stock value is a snapshot; "sold without a cost" note under the table.** *Fix:* note under the tiles; stock value as its own block ("On the shelves today: £[£], what it cost you") with a by-category table.

**M12 — `rp-takings`: tiles don't add up; open days in graph; no sent tag.** Card plus Cash is less than Takings (gift cards, credit, accounts, other). *Fix:* an "Other" tile; "Not closed yet" for unclosed days; "Sent"/"Not sent" tag per closed day.

**M13 — only Sales has an All shops view.** Multiple sites 1 and 8 want reports by shop. *Fix:*
1. Draw All shops for Takings and cash-ups (shop column) and VAT; describe the others as "adds a Shop column".
2. Draw none; decided in code.
Recommend 1.

**M14 — `rp-person`: no hints; costs without reports.** *Fix:*
1. Hints under each; switching costs On turns reports On with a note.
2. Hints only; allow costs without reports. A switch that does nothing.
Recommend 1.

**M15 — `rp-accounts-map`: a day's entry may not balance.** Not mapped: cash differences, refunds, discounts; one VAT account for three rates; "accounts" ambiguity. *Fix:* "Cash differences go to" row, refunds and discounts rows (or say they net off), VAT note, "Xero account" in labels. Accountant to confirm.

**M16 — graphs: no scale, line has no values, generic text alternative.** *Fix:*
1. Zero baseline, two or three labelled gridlines, labels at highest and latest line points, a text alternative with the busiest day or month and change from before (built from the table).
2. Highest value only. Shape unreadable without the table.
Recommend 1.

**M17 — `rp-takings`: three "£0.00" cash differences are not placeholders.** *Fix:* bracket them; keep B2's warning row. (VAT zero-rate £0.00 is true by definition.)

**M18 — wording.** "Stock value at cost" becomes "Stock value (what it cost you)"; gloss Margin once; say which basis (Takings with VAT, Sales before VAT) each page uses; "Gift cards, credit, accounts, other" becomes "Gift cards, store credit, customer accounts, other"; "Zero 0%" becomes "Zero rate 0%"; graph key from the period ("Last week"/"This week"); "Show it" becomes "Show report"; "Choose an account for [Category]"; "Download as spreadsheet".

## Low

**L1** — Two `<h1>` per page, "Reports" repeated three times, period choices as toggles. *Fix:* one `<h1>`, home card "Ready-made reports", period as radio group (top bar is a shared-frame change).
**L2** — `rp-workshop`: empty first headers; takings and quotes below the fold; no quotes comparison; "Shared queue" shows "—". *Fix:* "Money", "Quote", "Last week", "No set hours".
**L3** — `rp-day`, `rp-reopen`: list of divs; Reopen shown to anyone; reason not required. *Fix:* `<dl>` or table, hide Reopen for non-managers, disable until a reason is typed.
**L4** — `rp-your-settings`: graph switch under "Reports" in the Till column. *Fix:* 1. move to Accessibility; 2. leave. Recommend 1.
**L5** — Saved report row ("Sales · by product…") and title ("Items sold · by product…") disagree. *Fix:* same line, measure first.
**L6** — `rp-person`: sidebar shows Jack as Manager; Owner elsewhere.
**L7** — `rp-sales-all`: long shop names will crowd the graph. *Fix:* two-line labels, full name in the table.

## Summary of what to decide

1. How a closed day opens from the table (H1, options 1-2).
2. How a reopened day shows on reports (H2, options 1-2).
3. How much of the broken-connection states to draw (H4, options 1-2).
4. How the failed-day example and "sent" are fixed (H5, options 1-2).
5. VAT quarter start month or calendar quarters (H6, options 1-2).
6. Where Change what's shown and Download sit (M1, options 1-2).
7. Allowed Change-panel combinations, Margin for non-cost people (M2, options 1-2).
8. Sharing default for saved reports (M5, options 1-2).
9. Managing saved reports (M6, options 1-2).
10. Part, empty and first periods (M7, options 1-2).
11. Comparison wording (M9, options 1-2).
12. Staff seeing colleagues' discounts (M10, options 1-2).
13. Which reports get All shops (M13, options 1-2).
14. Whether costs needs reports (M14, options 1-2).
15. Graph scale and text alternative (M16, options 1-2).
16. Where "Show graphs in reports" lives (L4, options 1-2).
17. Whether Discounts and refunds and VAT get a graph (decision 7).

| Id | Boards | One line | Needs Jack |
|---|---|---|---|
| H1 | takings, day, reopen | Closed day has no control to open it | Yes (1-2) |
| H2 | takings, reopen | Reopened day silently changes totals | Yes (1-2) |
| H3 | home-staff, person | Staff have no sidebar door; person board disagrees | Yes |
| H4 | accounts boards, today-accounts | Failure states not drawn | Yes (1-2) |
| H5 | today-accounts, accounts-log | "Didn't go" for an open day; two "sent"s | Yes (1-2) |
| H6 | vat | Calendar quarters; no graph or comparison | Yes (1-2) |
| M1 | every report | Table at the fold | Yes (1-2) |
| M2 | change | Impossible mixes; Margin for all | Yes (1-2) |
| M3 | change | Chip looks; disabled look | Yes |
| M4 | changed | Save below fold; inert label | Yes |
| M5 | save | Role; shared default; errors | Yes (1-2) |
| M6 | home, home-staff | No manage or owner | Yes (1-2) |
| M7 | every report | Empty, first, part periods | Yes (1-2) |
| M8 | every report | No Pick dates picker | Yes |
| M9 | every report | Bare comparison | Yes (1-2) |
| M10 | home-staff, discounts | Staff see discounts | Yes (1-2) |
| M11 | margin | Stock snapshot; note placement | Yes |
| M12 | takings | Tiles, open days, sent tag | Yes |
| M13 | sales-all, others | Only Sales has All shops | Yes (1-2) |
| M14 | person | No hints; dependency | Yes (1-2) |
| M15 | accounts-map | Unmapped lines | Yes |
| M16 | graphs | No scale; generic alt | Yes (1-2) |
| M17 | takings | Unbracketed £0.00 | Yes |
| M18 | several | Wording | Yes |
| L1-L7 | various | See above | Yes |

## Verification (1 Oct 2026)

Checked by reading: all 21 renders; `reports.mjs` in full; decisions 1-7; Cash-up 6, Multiple sites 1, 4, 8, 9, Owner setup 3, 9, Selling at the till 4, 9; `settings-frame.mjs` `offer`; `ui.mjs` colour tokens; rendered HTML of `rp-sales`, `rp-save`, `rp-reopen`, `rp-workshop`, `rp-takings`. Not checked: tablet and phone; keyboard order and focus; a screen reader; Xero, QuickBooks and VAT rules (H6 and M15 are from general UK practice, not this product's documents, and need the accountant); contrast beyond shared tokens (warning ink `#7A5A10` on `#F7EAC2` about 5.3:1 and chip border `#E6DFCB` on `#F4EEE1` about 1.3:1, both worked out by hand); `app-map.mjs`, `setup.mjs`, `opening.mjs` beyond what the renders show. Pixel positions in M1 are read off screenshots.

Re-checked in the main session (1 Oct 2026) against the built files: H1 — the
closed-day rows on `rp-takings` are plain table cells with no link or button;
H3 — `rp-home-staff`'s sidebar has no Reports item; H5 — `rp-today-accounts`
shows Till B1 as open on the day it says didn't go to Xero. All confirmed. The
helper could not save this file; it was saved from its report by the main
session, unchanged.
