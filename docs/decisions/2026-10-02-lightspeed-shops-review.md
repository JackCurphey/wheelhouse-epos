# Journey 21, Lightspeed shops — Jack's decisions (2 Oct 2026)

Journey 21 is Wheelhouse for a shop that keeps Lightspeed as its till — the
second of the "two versions" (Workshop day review, opening lines: one "Take
payment" step, a per-shop setting decides where it goes). Background, not
reopened here: Release 1 is a workshop add-on for Lightspeed shops with one
Lightspeed connection (`2026-09-10-release-1-scope-reduction.md`); Lightspeed
owns products, stock, invoicing, payment and refunds, Wheelhouse owns
requests, the diary, jobs, quotes and messages, and makes no financial writes
(`2026-09-10-release-1-lightspeed-readiness.md`); Lightspeed R-Series has no
webhooks, so Wheelhouse checks it every so often and says how fresh its
figures are (`2026-09-02-r-series-sync-and-rate-limits.md`); customers are
matched by staff one job at a time, with no bulk import; Lightspeed's own
"work order" keeps its name, Wheelhouse calls its side a "Job" (Names). Five
Release 1 screens were drawn in the old style (connect, connect-proof, pos,
pos-done, pos-unknown); nothing is built and there is no Lightspeed test
account yet (proof steps LS-01–09 pending). Real example data only: North
Street Cycles, Bolton, Jack Lewis (Owner), Jo Taylor (Staff), Alex Morgan
(Mechanic), Maya Patel with WH-1042 (Trek Domane AL 3, Standard service,
approved total £111); Lightspeed's own references are bracketed
placeholders. Rules for every journey apply (Workshop day 45, 48, 50, 53, 57,
62, 65–67; A2, A6 — as few clicks as possible).

1. **Workshop only, with Lightspeed doing the money** (Jack, 2 Oct: "1").
   A Lightspeed shop's Wheelhouse has bookings, the diary, jobs, quotes,
   messages, customers and Today. The Till, Stock, Reports, Online orders
   and Cycle to Work aren't in its sidebar. An approved job goes to
   Lightspeed as a work order, and the customer pays at the Lightspeed till.
   Chosen over the workshop plus the extras Lightspeed lacks (Cycle to Work,
   the website), and everything Wheelhouse does with Lightspeed only taking
   payment.
2. **Wheelhouse checks the linked work order and shows when it's paid**
   (Jack, 2 Oct: "1"). The job reads "Waiting to be paid in Lightspeed",
   then "Paid in Lightspeed · [time]" once Lightspeed shows the work order
   settled. Staff still record the collection in Wheelhouse. Depends on
   Lightspeed letting Wheelhouse see that a work order has been paid —
   unchecked until there is a test account (add to proof steps LS-01–09);
   if it can't, this falls back to staff ticking "Paid in Lightspeed" at
   hand-over. Chosen over staff ticking it every time, and Wheelhouse never
   showing payment.
3. **The work order is made automatically when the quote is approved**
   (Jack, 2 Oct: "1"). The job shows "In Lightspeed · work order [number]";
   later changes to the job (an extra part, a new price) update the work
   order, and a cancelled job marks it cancelled in Lightspeed. Staff do
   nothing, and the work order is ready long before collection. Chosen over
   staff pressing "Send to Lightspeed" when the job is finished, and staff
   pressing it at approval (the Release 1 drawing).
