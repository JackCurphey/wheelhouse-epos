# Paying a job's order at the till, first piece (18 Oct 2026)

Jack, 18 Oct, choosing the next work after the old diary's features
(`2026-10-18-old-diary-features.md`, "The menu's till actions wait for the
till").

1. **The old app stays as the plan has it** (Jack: "3"): each old screen is
   removed when its new version is built (project rule 5); the old app
   stays the front page and the sign-in until then. Chosen over going
   straight to the new app after signing in, and over removing the old till
   now. (He first asked why it can't all come down: signing in and signing
   up live only in the old app.)
2. **The full payment now; the rest when its server pieces exist** (Jack:
   "1"). "Open in the till" (the diary menu) and "Take payment" (the job
   page) open the till with the job's lines locked and "Bike collected when
   paid" on; card or cash pays the whole order, the job is finished if it
   was in progress, and the bike is recorded as collected. Deposits and
   paying in parts wait for Mark's sales-in-pence server work (stage 3);
   the till's "Who's signing this off?" waits for the sign-off to be built;
   the "job changed while you were paying" warning waits for its drawing.
   Chosen over waiting to build it all together, and over building
   deposits now.

The drawings it follows: `till-job` (desktop, tablet, phone, `till.mjs`),
the job page's "Take payment" (`job-finished`, `diary.mjs`) and
`diary-menu-job` (desktop).
3. **Two small server changes, flagged for Mark** (Jack: "1"; found by the
   fresh review): paying a job's order could charge the card and then be
   refused, when the customer or order has a discount the till didn't know
   of, or when a fitted part is out of stock. So the till asks the server
   for the amount actually due (discounts included) before taking payment,
   and paying a job's order sells past zero stock as the plain till does
   (journey 11 decision 5), the line warning "Stock says [n] — sold anyway".
   Both change `server/routes/sales.js`, Mark's; STATUS tells him. Chosen
   over guarding on the screen only, and over holding the work for Mark.
