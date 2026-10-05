# Journey 17, Reports and accounts — Jack's decisions (1 Oct 2026)

Journey 17 is how an owner or manager sees how the business is doing and
gets the figures to their accountant: sales over any period, takings and
past cash-ups, VAT, margin and stock value, the workshop's figures, and the
link to accounts software. Background, not reopened here: Reports sit under
Office (names); the shop switcher sets the shop for reports, with "All
shops" for the owner and for managers at two or more shops (Multiple sites
1, 8, 9); a till sells for its own shop and cash-up is per till (Multiple
sites 9; Cash-up 6); the end-of-day report is drawn and "saved to Reports",
and a closed day can be reopened by a manager from Reports with a reason
(Cash-up 6); "Can see reports" is a switch on a person, and Staff see no
cost or margin (Owner setup 9; Stock control); managers see every discount
and its reason in the reports (Selling at the till 4; Customer service 8);
practice sales stay out of reports (Moving from Citrus Lime 6); money is
held in whole pence with VAT on every sale line, so a VAT return period can
be produced (offline foundations; ownership sign-off TILL-4); Release 2
piece 6 is "Sales, margin, stock reports; Xero and QuickBooks", and every
piece ships an export of its own data (Release 2 design, rule 5). Real
example data: North Street Cycles, Bolton (tills B1–B3), Jack Lewis, Jo
Taylor, Alex Morgan, WH-1042 (£111.00); no real day's or period's figures
exist, so every figure is a bracketed placeholder. Generator: `reports.mjs`
+ `build-reports.mjs --theme sand`. Designed in the Soft sand look on its
own canvas (https://claude.ai/artifact/NXHvoKd8wY8wpAhBYsPRUt), desktop
first, then tablet and phone. Rules for
every journey apply (Workshop day 45, 48, 50, 53, 57, 62, 65–67; A2, A6 — as
few clicks as possible).

1. **Ready-made reports, plus a report you can build yourself** (Jack, 1
   Oct: "I would like 1 and to be able to build a report like in 2 if
   possible?"). The Reports page lists a handful of named reports — Sales,
   Takings and cash-ups, VAT, Margin and stock value, Workshop, Discounts
   and refunds — each opening on a sensible period with quick choices
   (Today, This week, Last month, pick dates), compared with the period
   before, and with Download (a spreadsheet). Alongside them, owners and
   managers can build their own report: what to measure, how to split it,
   which period. Chosen over ready-made reports only, a builder only, and a
   dashboard of charts.
2. **Build your own by starting from any report, then save it** (Jack, 1
   Oct: "1"). Every report has "Change what's shown": what to measure
   (sales, items sold, margin, jobs, hours), how to split it (by day, week,
   category, product, staff member, shop or payment type), and what to
   narrow it to (Workshop only, one supplier). "Save as my report" names it
   and puts it under "Your reports" on the Reports page, opening on the
   latest period; it can be shared with the other managers or kept to
   yourself. Chosen over a blank "New report" page, and changes that don't
   save.
3. **A VAT report for any quarter; the return is filed in accounts software
   or by the accountant** (Jack, 1 Oct: "1"). Sales before VAT and VAT
   charged, by rate (standard, reduced, zero), with refunds taken off; and,
   separately, VAT on stock invoices booked in, marked "Stock purchases
   only — not your full VAT reclaim". Quarter quick choices, Download, and
   it flows to Xero or QuickBooks when connected. Wheelhouse does not file
   with HMRC (Making Tax Digital) — it doesn't hold every business cost.
   The layout is for the shop's accountant to confirm. Chosen over filing
   the return from Wheelhouse, and sales VAT only.
4. **Xero or QuickBooks gets one summary per shop per closed day** (Jack,
   1 Oct: "1"). When a day is closed (Cash-up), Wheelhouse posts one entry
   for that shop: sales split by the account each category goes to, the
   VAT, and the money taken by how it was paid (cash, card, account, gift
   card). Which account each category and payment type goes to is chosen
   once, when connecting; a problem (a category with no account) shows on
   Today, with a list of what was sent. Single sales stay in Wheelhouse.
   Shops without either can download the same figures to import. Chosen
   over every sale sent as its own invoice, and download-only.
5. **Two switches on a person: "Can see reports" and "Can see costs and
   margin"** (Jack, 1 Oct: "3"). "Can see reports" opens the reports
   without costs — Sales, Takings and cash-ups, Workshop, Discounts and
   refunds, and the person's own saved reports. "Can see costs and margin"
   adds Margin and stock value, the margin and cost columns, and VAT.
   Owners and managers have both. This adds a switch to Staff and roles'
   person pop-up (Owner setup 9) and refines Stock control's "Staff see no
   cost or margin" to "unless given Can see costs and margin". Chosen over
   sales-side reports only for Staff, and one switch showing everything.
6. **The Workshop report: jobs, money, how full each mechanic was,
   turnaround and quotes** (Jack, 1 Oct: "1"). Jobs booked in, finished and
   collected; workshop takings split into labour and parts; each mechanic's
   hours booked in the diary against hours available ("how full"); the
   average time from booked in to ready; quotes approved, declined and left
   unanswered — each split by mechanic or service. Uses only what the diary
   and job pages already record. Chosen over jobs and takings only, and
   adding each mechanic's speed against the planned time (which would need
   a timer on every job).
7. **A graph at the top of every report, the table underneath** (Jack, 1
   Oct: "are able to add graphs too? some stores might like to visualise the
   data" — then "1"). Bars for a period split by day, category or shop, a
   line for a trend over months, with the period before shown faintly
   behind. The graph follows "Change what's shown", so saved reports get one
   too; anyone can hide graphs in Your settings. The table always stays
   below, so exact figures, screen readers and downloads still work. No real
   figures exist, so the drawn graphs are even placeholder bars marked
   "[£]" — they show where the graph goes, not a real shape. Chosen over a
   Graph / Table switch, and graphs only on a separate Overview page.
8. **UI audit: every recommendation taken** (Jack, 1 Oct: "yeah go ahead
   with them all"). From `design/user-journeys/reports-ui-audit.md`: a
   closed day opens from its row, and a reopened day is called out on every
   report it leaves out (H1, H2); connection lost, a day waiting for a till,
   a category with no account and disconnecting are drawn, and the failed-day
   example is Wednesday, with Thursday "Not closed yet" (H4, H5); **the shop
   says once which month its VAT quarter starts**, and VAT shows "This VAT
   quarter" against the quarter before, with no graph — the tables are what
   the accountant needs (H6, decision 7); Change what's shown and Download
   sit beside the title (M1); pairings that make no sense are greyed with a
   reason, and Margin shows only to people who can see costs (M2); a saved
   report starts "Just me", with messages for a missing or taken name (M5),
   and a "…" menu renames, shares or stops sharing, and deletes with Undo
   (M6); an unfinished period says "So far", empty periods and periods with
   nothing before are drawn (M7); comparisons in words (M9); **Staff with
   "Can see reports" see discounts without who gave them** (M10); Takings
   and VAT get "All shops" versions, the others a shop column (M13);
   switching on "Can see costs and margin" also switches on "Can see
   reports", each switch with a hint (M14); graphs get a scale and a spoken
   description naming the busiest day and the change (M15/M16); "Show graphs
   in reports" moves into Accessibility (L4); Discounts and refunds gets a
   graph by reason. Also: Reports in the sidebar for Staff with the switch, a
   picker for "Pick dates", unchanged-looking choices fixed, the changed
   report's own title and Save banner, stock value as its own block, an
   "Other" takings tile, "Not closed yet" days, a "Sent to Xero" column,
   unmapped lines (cash differences, refunds, discounts) — the mapping is for
   the shop's accountant to confirm (M15) — and the wording and screen-reader
   fixes.
9. **Tablet and phone drawn; approved and copied into the big canvas**
   (Jack, 1 Oct: "yeah that all looks good, lets get it on the canvas").
   Tablet as desktop. On phone, Change what's shown and Download share the
   row in two halves ("Download" for short), tables use smaller type with
   headings that can wrap, and three boards are drawn scrolled to their
   point (a saved report's menu, a category with no Xero account, Show
   graphs in reports). The owner's Discounts and refunds table still scrolls
   sideways on a phone. 34 screens, 103 boards. In the big canvas journey 17
   replaces its old placeholders; "Returning customers" stays as still to
   design, the old dashboard ("Today") is covered by Opening the shop, and
   Multiple sites' "Reports and cash-up by site" is covered by the All shops
   boards here. "Can see costs and margin" was carried into every person
   pop-up (Owner setup, Multiple sites). "Show graphs in reports" shows in
   Your settings only for people who can see reports, so Journey A's Your
   settings (Jo Taylor, Staff) is unchanged.

**Later change (2 Oct 2026, Management oversight decisions 6 and 7):** Reports gains an "Activity log" card beside the ready-made reports, for owners and managers only (hidden from staff with "Can see reports"); every person shows "Sign out everywhere"; Your settings has the Help cards. Nothing else changed.

**Later change (2 Oct 2026, Cycle to Work decision 7, audit M6):** the ready-made reports gain "Owed by Cycle to Work providers", for owners and managers (hidden from staff with "Can see reports", as the Activity log is). The sidebar on every board has the new Front desk › Cycle to Work item.

**Later change (3 Oct 2026, issue #116 question 1):** Jack, 3 Oct: "1". The Reports page gains a strip of 3 figures at the top, above the report cards: takings by shop, margin, and a link to each shop. It is figures, not charts, so the "dashboard of charts" turned down in decision 1 stays turned down. It is labelled "Margin", not "Profit", because Wheelhouse doesn't hold the business's other costs. This meets the owner's first check in `personas.md` (the overview, split by shop, with no clicks). Chosen over cards only. The drawings are not changed yet; they are redone when the canvases are merged (issue #116 step 3).

**Later change (3 Oct 2026, issue #116 question 6):** Jack, 3 Oct: "2". The supplier invoice check is later (Receiving stock and purchase orders, later change), so Wheelhouse has no invoices to count. Until it is built, decision 3's "Stock purchases" box gives no figure and says to take it from the accounts software (as walk-through 3 M8 option 1 has it for a shop with the check off). The drawings are not changed yet; they are redone when the canvases are merged (issue #116 step 3).

**Later change (3 Oct 2026, the strip and the shop menu):** Jack, 3 Oct: "1". The figures strip (question 1 above) follows the shop menu, as every report does (Multiple sites 1): on one shop it shows that shop; on "All shops" it has a row for each shop. Chosen over always showing every shop whatever the menu says. Still open, and bracketed on the drawing: the period, takings with or without VAT beside a margin worked out before VAT, and what the shop's link opens (walk-throughs 7 and 11, `docs/design/user-journeys/walk-2/`).

**Later change (3 Oct 2026, walk-through 11 H2, `docs/design/user-journeys/walk-2/`):** Jack, 3 Oct: "1". "Takings" has one meaning everywhere: all money for sales in the period, with VAT, refunds taken off, online and Cycle to Work money in, and an open day counted "so far". It is used on the figures strip (which settles the strip's VAT question: takings with VAT), Sales, Takings and cash-ups, Today and the end-of-day report, which says "Takings" instead of "Sales". The end-of-day report is one till's close (Cash-up 6), so it says that online money is not in it. The closed-days figure is "Closed days' takings". Chosen over keeping each figure with a line saying what it covers. Labels only; not drawn yet.

**Later change (3 Oct 2026, walk-through 11 M2):** Jack, 3 Oct: "1". Labour is left out of margin and shown beside it: "Labour £[£] · not in margin". Margin, on the strip and in Margin and stock value, is on goods only. Chosen over counting labour at no cost, and a cost per hour in Settings › Workshop. Not drawn yet.

**Later change (3 Oct 2026, walk-through 5 M3):** Jack, 3 Oct: "1". Margin takes the Cycle to Work provider's commission off each Cycle to Work bike: the commission from the provider's settings at the sale, corrected when the bike is marked paid. A line on Margin and stock value says so. A closed day's margin can move when the provider pays. Chosen over leaving margin as it is with a note. Not drawn yet.

**Later change (3 Oct 2026, third walk, answers 2 and 3, `docs/decisions/2026-10-03-ux-walkthrough-third-walk.md`):** Jack, 3 Oct: "1" to each. This settles the two details the "strip and the shop menu" change left open. The period: the strip shows this week so far, the same period every report opens on ("So far: Mon 14 – Thu 17 September"), chosen over today only and this month so far. The shop's link: a shop's name in the strip opens that shop's Sales report, with the shop menu switched to that shop, chosen over that shop's Today and no link. The third detail, takings with or without VAT, was settled by the walk-through 11 H2 change above (takings with VAT). The All shops strip, a row for each shop, is drawn as a situation of Reports (walk-through 11 H1 of the third walk). Drawn in `docs/superpowers/specs/2026-10-03-draw-the-third-walk.md`.

**Later change (5 Oct 2026, issue #132, `docs/decisions/2026-10-05-roles-and-switches.md`):** Jack, 5 Oct, answer 1. The "Owed by Cycle to Work providers" report, kept for owners and managers, is also open to a Staff member given "Give everything a Manager can do".
