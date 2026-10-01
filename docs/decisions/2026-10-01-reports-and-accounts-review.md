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
