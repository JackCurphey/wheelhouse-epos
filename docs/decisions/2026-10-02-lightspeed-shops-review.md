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
placeholders. Own canvas: https://claude.ai/artifact/2qnzyGx8enhxbVN17Brpnf ,
desktop first, then tablet and phone. Rules for every journey apply (Workshop day 45, 48, 50, 53, 57,
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
4. **Customers are linked by Wheelhouse where it's sure, and by staff
   when it isn't** (Jack, 2 Oct: "1"). The first time a customer's job goes
   to Lightspeed, Wheelhouse looks them up by phone number and email: one
   clear match is linked, no match is added to Lightspeed, several possible
   matches are picked once by staff. The link then stays. Goes beyond the
   Release 1 plan, which only looked customers up (adding a customer is a
   write to Lightspeed; still no money is written). Chosen over staff
   confirming every new customer, and one shared "Wheelhouse" customer in
   Lightspeed.
5. **Parts on a quote come from Lightspeed's products** (Jack, 2 Oct:
   "1"). The quote's part search shows Lightspeed's products with price and
   stock and when it last checked ("3 in stock · checked 40 seconds ago");
   the part goes on the work order as that product, and Lightspeed takes it
   off stock when the job is paid. Chosen over parts typed freely and
   matched in Lightspeed by staff, and quoting labour only.
6. **When Lightspeed can't be reached, the workshop carries on and
   Wheelhouse catches up by itself** (Jack, 2 Oct: "1"). Jobs, quotes and
   the diary keep working; anything to send waits ("Waiting to reach
   Lightspeed") and is retried automatically. A send that may or may not
   have arrived is never repeated blindly: Wheelhouse first looks in
   Lightspeed for the work order and links it if it's there; only when it
   still can't tell do staff get a "Check this in Lightspeed" step (the
   Release 1 "unknown is different from failed" screen). If it lasts longer
   than [n] minutes, a line goes on Today. Chosen over staff retrying every
   failed send, and staff making the work order by hand.
7. **The owner connects Lightspeed in Settings, with a short guided
   start** (Jack, 2 Oct: "1"). Settings › Office gains a Lightspeed
   section: "Connect Lightspeed" signs in on Lightspeed's own page; with more
   than one shop, the owner says which Lightspeed shop is which Wheelhouse
   shop; Wheelhouse matches staff by name so work orders show who did the
   job, and the owner fixes any it can't; then a short checklist shows what
   works — read products and stock, find customers, make work orders, see
   payment — each ticked or flagged. Chosen over the Wheelhouse team
   connecting it for the shop, and a plain "Connected" with no checklist.
8. **Services and labour prices are set in Wheelhouse and sent to the work
   order as labour** (Jack, 2 Oct: "1"). Each service goes on the work order
   as a labour line at the Wheelhouse price, so the approved quote is what
   Lightspeed charges; Settings › Workshop stays as drawn. Any labour prices
   kept in Lightspeed go unused for jobs. Chosen over linking each service
   to a Lightspeed labour item priced in Lightspeed, and one "Workshop
   labour" line.
9. **For Lightspeed shops, Wheelhouse takes no money** (Jack, 2 Oct:
   "1"). Booking deposits (journey 3) and paying online before collection
   (journey 5) are switched off; "Bike ready" says "Pay when you collect";
   the account page (journey 7) doesn't show store credit. No money in two
   places and no payment provider for these shops; they go without
   deposits and paying ahead. Chosen over taking deposits and online
   payments and recording them in Lightspeed, and deposits only.
10. **UI audit: every recommendation taken** (Jack, 2 Oct: "lets do them
    all"). From `design/user-journeys/lightspeed-ui-audit.md`:
    - **Website stays, without selling** (H1, the first of my three open
      choices): the site's header drops Shop and Basket for a Lightspeed
      shop; booking, Our shops, the account pages and Contact us stay.
    - **The "Not paid in Lightspeed yet" pop-up stays, and leaves a trace**
      (H2, my second choice): its words follow the cause (not shown as
      paid; can't reach Lightspeed; payment isn't checked for this shop —
      "Has Maya paid?" with "Yes, she paid"); the fallback's empty tick
      opens it too; "Hand over anyway" writes a history line and the job
      keeps "Collected · not shown as paid in Lightspeed" until payment
      appears; owners and managers get a Today line after [n] days. These
      are new kinds of record, approved here.
    - **Each Lightspeed state on a job has its own wording and button**
      (H3): "Choose the customer", "Check this in Lightspeed"; a Today line
      for jobs waiting on a person; a ready job not yet in Lightspeed says
      Maya can't pay at the till yet. "Mark ready for collection" stays on.
    - **Exactly what Wheelhouse writes** (H4): "Wheelhouse never takes a
      payment, gives a refund or closes a sale in Lightspeed. It does put
      the prices the customer approved on the work order, so the till
      shows what they agreed."
    - **Front desk keeps Messages, filtered to what these shops send** (M1,
      my third choice), with the count to match. Shared Settings lose till,
      sales and stock wording for these shops, and an "Activity" row sits
      under Office › Your data for owners and managers (M2). Today leaves
      out Who's in (no till check-in) (M3); its Lightspeed card wording
      fixed and "payments" said only when payment is checked (M4).
    - The setup checklist gets a third state, "Not proven yet — shows on
      first use" (M5); staff matching can say someone doesn't use
      Lightspeed (M6); fixed timings replaced by "Last checked [n] seconds
      ago · Why?" (M7); amounts shown as "Agreed £111.00" (M8); the
      customer picker starts with nothing chosen and says what matched
      (M9); a part is added in one press (M10); strips and Today lines
      announce changes, notes tied to their boxes (M11); the missing
      states drawn in one pass (M12).
    - L1–L5: plainer wording ("Which Lightspeed shop is Bolton?", "a work
      order is Lightspeed's name for a job"); instructions out of the
      smallest text; Settings tidied (no "—" folds, "Check now" greyed
      briefly after use, Disconnect a real button); when "Check Lightspeed
      now" finds the payment, the pop-up turns into "Paid · Hand over".
