# Journey 9, Moving from Citrus Lime — Jack's decisions (30 Sep 2026)

Journey 9 is how a shop brings its data across from Citrus Lime, runs
Wheelhouse alongside it on a regularly refreshed copy, and then switches
Citrus Lime off (Release 2 finish line: one full trading week, including a
weekend, on Wheelhouse alone — `docs/superpowers/specs/2026-09-27-release-2-design.md`).
Owner setup's Getting started checklist links here (Owner setup decision 16).
The biggest open risk: what Citrus Lime lets a shop export, and in what
format, is not yet known (Release 2 design §4). Designed in the Soft sand
look on its own canvas (https://claude.ai/artifact/Wkp23VuCPRydTjfYmJgKo9),
desktop first, then tablet and phone. Generator: `moving.mjs` +
`build-moving.mjs --theme sand`. Rules for
every journey apply (Workshop day 45, 48, 50, 53, 57, 62, 65–67; A2, A6 — as
few clicks as possible).

1. **Journey 9 is next** (Jack, 30 Sep), chosen over Collect the bike and
   pay, and Receiving stock and purchase orders.
2. **Done with the owner, not by them** (Jack, 30 Sep): the owner uploads
   their Citrus Lime export files; Wheelhouse matches the columns behind the
   scenes and shows a plain summary (how many products, customers and so on
   came across, and how many need a look). The owner only fixes the few rows
   that didn't fit; anything odd has an "Ask us to help" button. No
   column-matching screen for the owner. Depends on knowing what Citrus
   Lime's exports actually contain — still to be checked from Jack's shop's
   Citrus Lime admin before this is built. Chosen over fully self-service
   (the owner matches every column) and us running the import for them.
3. **A weekly refresh with a reminder while running alongside** (Jack, 30
   Sep): once a week, on a day the owner picks, Today shows "Time to refresh
   from Citrus Lime"; the owner drops in the new export files and Wheelhouse
   updates only what changed (new products, price changes, new customers),
   never overwriting what was done in Wheelhouse (practice jobs, notes).
   Where both changed the same thing, Citrus Lime wins until switch-over and
   the owner is told. Chosen over refreshing whenever the owner likes, and
   importing once plus a final catch-up.
4. **The move has its own page under Office while it's on** (Jack, 30 Sep):
   Office › "Moving from Citrus Lime", with three stages across the top —
   Bring your data → Run alongside → Switch over — showing where the shop
   is, the last refresh and what's next. Today's weekly reminder and the
   Getting started "Moving from another system?" link land here. The page
   leaves the sidebar a week after switch-over; its history stays under
   Settings › Your data. Chosen over a section in Settings › Your data and a
   step inside Getting started.
5. **A weekly check against Citrus Lime after each refresh** (Jack, 30
   Sep): once the refresh is in, the move page shows Wheelhouse's own totals
   for last week — sales total, number of sales, stock value, number of
   customers — each beside a box for Citrus Lime's figure. The owner types
   the four numbers from Citrus Lime's reports; each row gets a tick or the
   difference, with "Ask us to help" on one that doesn't match. The weeks
   that matched are kept as a record for deciding when to switch over.
   Chosen over uploading Citrus Lime's report file and no comparison screen.
6. **Every Wheelhouse till is in practice until switch-over** (Jack, 30
   Sep): while the move is at Run alongside, every till shows a band across
   the top, "Practice: not real money". Practice sales don't touch the card
   machine or the cash drawer count, stay out of reports and the weekly
   check, and are cleared on switch-over day, when the band goes and the
   tills become real. Nobody can take real money in both systems by
   mistake, and there is nothing for staff to switch. Chosen over a
   practice switch on each till and a separate practice till.
7. **Switch-over is a readiness checklist that ticks itself, then the
   owner picks the day** (Jack, 30 Sep): the Switch over stage lists what
   must be true first — [n] weeks in a row where the weekly check matched
   (the number is Jack's to set; drawn as [n]), the card machine connected
   (journey 8), every member of staff has made a practice sale, the website
   moved (journey 18) — each ticking itself. When all are ticked the owner
   picks a date; that morning Wheelhouse asks for one last refresh from
   Citrus Lime, clears the practice sales and makes the tills real; then a
   tracker counts the first full trading week including a weekend (the
   Release 2 finish line), after which Citrus Lime can be switched off.
   Chosen over a single "Switch over" button, and a Wheelhouse person
   signing off with the shop.
8. **The owner picks how many matching weeks come before switch-over,
   2 by default** (Jack, 30 Sep): the checklist's first item reads "The
   weekly check matched 2 weeks in a row" with a "Change" link that opens a
   small choice (2, 3, 4 or another number). Settles decision 7's [n].
   Chosen over a fixed 2 weeks and a fixed 4 weeks.
