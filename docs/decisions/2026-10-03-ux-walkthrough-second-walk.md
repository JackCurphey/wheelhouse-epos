# The second walk-through's smaller questions — Jack's answers (3 Oct 2026)

Issue #116 step 4 walked twelve stories on the one canvas
(`docs/design/user-journeys/walk-2/`). Jack answered its larger questions one
at a time (the "Later change (3 Oct 2026, walk-through …)" notes in each
journey's decision file). These are the sixteen smaller ones left over
(`docs/superpowers/specs/2026-10-03-draw-the-answers.md`, "Still needs Jack"),
answered on 3 Oct from a checklist, every one with option 1.

1. **Two in-between moments are written as lines now** (walk-through 1 L7):
   a bike marked ready while its quote is unanswered, and a "Not sure what's
   wrong?" booking that reaches a quote. Each follows the nearest thing already
   decided; Jack checks the wording before it is published.
2. **The "Tablet and phone ↗" link is renamed** to say it opens the
   journey's own canvas, where every size is drawn (walk-through 2 L4).
3. **The staff search box reads "Search jobs, customers, orders,
   products"** everywhere except the till, whose wording stays as it is
   (walk-through 5 L1, walk-through 2 L3).
4. **The moving-over edge cases are written as lines now** (walk-through 4
   L3): where "Fix" on an imported row leads, where "Give [name] their PIN"
   sits, a weekly refresh with a file that can't be read. Following what's
   decided; Jack checks them.
5. **"Edit website" becomes "Edit words and photos" and opens the Words and
   photos list; the Pages row drops "2 to check"**, since the list's "Check
   this" says it (walk-through 4 H3, following Website's 3 Oct later change).
6. **The Cycle to Work edge cases are written as lines now** (walk-through 5
   L5): the internet dropping during the sale, a card declined after the
   provider's part, adding a new customer from New order, a bike back after
   the provider paid. Jack checks them.
7. **The Lightspeed edge cases wait until Lightspeed is built** (walk-through
   6 L7), after the trading week, with a test account.
8. **The tablet and phone rules are one table in the drawings' README**, not
   notes on the canvas, which stays under its 200-note limit (walk-through 7
   L3).
9. **The two-shop edge cases are written as lines now** (walk-through 7 L4
   and its second check): removing a shop from someone with jobs there,
   closing the day at the other shop, collecting at the other shop, a manager
   at one shop adding the other to Jo's shops, a cancelled transfer a job
   waits for. Jack checks them.
10. **Taking over a workshop computer announces "Now working: [name]"** to a
    screen reader (walk-through 8 H1, second check).
11. **One job, one set of status words: the job page's stages (Workshop day
    20) everywhere**, and the diary's key follows them (walk-through 9 M4).
12. **The search also finds bikes, frame numbers and booking requests, and on
    the till the cursor starts in the search box** (walk-through 9 L3).
13. **To the customer, the repair is "Your repair · WH-1042" everywhere, and
    the Cycle to Work order is "Your Cycle to Work bike"** (walk-through 12
    L1). "Full service checklist" (Workshop day 39) is staff wording and stays.
14. **The repair's Pay now offers Apple Pay and Google Pay**, as online
    checkout does (walk-through 12 L7; extends Buy online 5).
15. **The booking's quick "Book this time" button shows "[time]"**, so the
    example doesn't clash with Maya's 11:30 (walk-through 12, second check).
16. **The job's tag for staff reads "Ask before any extra work"**, the
    customer's own choice (walk-through 12 H1, following Drop off's 3 Oct
    later change).

## The edge-case lines, checked (3 Oct)

Jack checked the ten drafted lines in `docs/design/user-journeys/walk-2/edge-case-lines.md`
("all look right") and took the recommended option for the six cases no
decision covered ("go with the recommended ones"):

- **1a.** "Mark ready for collection" waits while a quote is unanswered,
  until it is answered, recorded from a phone call (Quote 4), or withdrawn.
- **1c.** Looking at a "Not sure what's wrong?" bike costs nothing; every
  line on its quote is new.
- **4d.** What the one-row Fix pop-up asks for each kind of imported row is
  left for the build, once Citrus Lime's real export files are known (Moving
  2), and logged then for Jack to overrule.
- **6d.** A Cycle to Work bike back after the provider has paid: a manager
  chooses a refund to the provider or store credit to the customer, and the
  order reopens.
- **9c.** A bike is collected and paid for only at the shop that did the work.
- **9d.** A manager can only give someone the shops the manager works at; the
  owner can give any shop.

All are situation lines on the one canvas; no drawing changes.

Fresh review fixes (3 Oct): `job-overview`'s diary backdrop shows WH-1042 as
Expected, so the board agrees with itself; tablet and phone diary blocks read
their own stage aloud; an unsent quote is "Quoting" on both its drawings
(Workshop day 20); the repair's Pay now says "For your repair · WH-1042";
the Website page keeps its "2 pages still have starting wording" sentence
beside Turn on (answer 5 only took "2 to check" off the Pages row). Left:
`job-overview`'s backdrop block still reads "approved £111".
