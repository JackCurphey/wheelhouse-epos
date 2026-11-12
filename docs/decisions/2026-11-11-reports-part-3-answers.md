# Jack's answers, 11 Nov 2026: Reports, the third part (WP-5.3)

Questions from writing the spec for the third part of WP-5.3, Reports and accounts (`openspec/changes/reports-your-own`): your own reports, meaning "Change what's shown", the changed report, "Save as my report", Your reports, and the saved report's menu. Jack answered on 11 Nov and the Front desk session passed the answers on. Each answer was the recommendation. Part 1's answers are in `2026-11-10-reports-answers.md` and part 2's in `2026-11-11-reports-part-2-answers.md`.

## 1. Which reports get "Change what's shown" now

The question: decision 2 gives every report except VAT "Change what's shown", but the drawn panel's measures (Takings, Items sold, Margin, Jobs, Hours) don't fit Returning customers or Margin and stock value.

**The recommendation.** Sales, Takings and cash-ups, and Workshop get it in part 3. Returning customers and Margin and stock value get it later, once their own choices are designed. VAT never gets it.

## 2. What "Only" picks from

The question: the drawing's "Only" chips (Workshop, Parts, Accessories) are the till's quick-button groups, which the shop would set up. Those aren't built yet (`src/screens/till/till-page.tsx`).

**The recommendation.** "Only" lists the shop's top-level Stockroom categories, plus Labour for labour lines. Ticking a category counts everything under it. This matches walk-through 3 M10, where margin uses the Stockroom categories.

## 3. Categories and suppliers as the product is now

The question: a sale line doesn't keep its category or supplier. Products keep the supplier as typed text, with no link to the shop's supplier list.

**The recommendation.** A line's category and supplier are read from its product as it is now, so a product moved to another category takes its past sales with it. Supplier choices are the names typed on products, so "Shimano" and "Shimano UK" show as two suppliers. Nothing changes in how sales are saved.

## 4. Sharing until managers exist

The question: "Share with managers" needs managers, who come with Mark's staff roles (WP-1.1). Until then Reports is Owner only.

**The recommendation.** "Me and the other managers" and "Share with managers" are shown greyed out, with their reason, until roles exist. They are not hidden. Who can see a report is kept with it from the start, so nothing needs changing when roles land.

## 5. The small ones

**The defaults**, as `design.md` lists them:

- Split by Day is greyed out for Last 12 months and for dates over 62 days, with "too many days — choose Week".
- A deleted report can be brought back with Undo, then is hidden for good. Its row is kept and never tidied away.
- A report saved on Pick dates opens on the report's first period (This week for Sales and Workshop).
- Rename reuses the Save popup with only the name.
