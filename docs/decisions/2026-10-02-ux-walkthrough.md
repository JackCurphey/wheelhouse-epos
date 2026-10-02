# UX walk-through — Jack's decisions (2 Oct 2026)

Every journey is drawn (704 screens, 701 designed; the three left are journey
13's supplier screens, held for a later release). Each journey had its own UI
audit. This is the end-of-project UX walk-through planned on 1 Oct (Jack: "i
guess we can just do a ux audit at the end when all the pages are done?"):
follow a whole story across journeys, as the people living it, looking for
gaps at the hand-offs. Jack will run more walk-throughs with Mark later
(Jack, 2 Oct: "I will be running more UX walkthroughs with mark later"), so
the walk-through also produces a script they can reuse.

How it works: a helper walks each story through the drawings and the code
that draws them; every finding is checked before it reaches Jack; findings
are numbered with choices and a recommendation, as in the UI audits.

The seven stories proposed: 1 a repair start to finish (journeys 1, 3, 4,
12, 5, 7); 2 a shop day (10, 11, 2, 16); 3 stock (13, 11, 14, 17); 4 a new
shop (9, 8, B, 18); 5 a Cycle to Work bike (6, 11, 17); 6 a repair at a
Lightspeed shop (21); 7 an owner with two shops (19, 20, 17).

1. **The repair story first, as a pilot, then the other six** (Jack, 2 Oct:
   "1"). The pilot settles the report's format and the reusable script
   before Mark uses them. Chosen over all seven at once, and only the repair
   story with the rest left for Jack and Mark.
2. **Walk-through 1 (the repair story): every recommendation taken** (Jack,
   2 Oct: "1"). From `design/user-journeys/ux-walkthrough-1-repair.md`
   (2 High, 9 Medium, 9 Low). Where the report gave no recommendation, the
   one Claude gave was taken: booking at a two-shop business reuses the shop
   the website remembered (M1), and "waiting for the customer" gets a diary
   state and colour of its own (M3). The fixes are listed with the work as
   it's done, below.
3. **The staff canvas link goes in the script** (Jack, 2 Oct: "yes put the
   link in"): https://claude.ai/artifact/WzmMdudJPoWH5aUd7J9V4j, which is
   shared with anyone who has the link.

## Walk-through 1 fixes (decision 2), as planned

- **H1 spending limit:** the story's example changes so Maya picks "Call me
  before any extra work" at booking, so her quote is sent legitimately and
  every board shows the same limit. The within-limit path is drawn: a line
  by "Send quote" ("Within the customer's £200 limit — no quote needed"), a
  "Work added within your limit" message row, and the line on her page.
- **H2 one press:** "Mark ready for collection" marks the job ready and sends
  "Bike ready" with a short Undo; "Work finished" goes; Messages reads "When
  a job is marked ready"; straight after approval the main button is "Start
  work".
- **M1:** booking starts with the shop the website remembered, as a closed
  line with Change (touches Multiple sites decision 5 and its audit M8).
- **M2:** the arrival time is the diary slot's start: WH-1042 sits at 09:30
  and Today and the overview say "09:30 appointment".
- **M3:** a diary state of its own, "Waiting for the customer", with its own
  colour and a legend entry; purple stays "booking request" only.
- **M4:** two message rows, "New ready date" and "Your answers"; the
  waiting-for-parts strip says when it was sent.
- **M5:** one expiry rule: the link lives until [n] days after collection;
  for a booking that never arrives, [n] days after the booked date.
- **M6:** a percentage deposit is worked out on the price known at booking,
  then fixed; the pay, paid and receipt pages are drawn for the balance with
  the deposit as its own row; "Request received" is drawn without a deposit.
- **M7:** the reminder link fills in Maya's details part-hidden, no sign-in.
- **M8:** "Bike still waiting" fills in "Paid — nothing more to pay" for a
  paid job.
- **M9:** the website's repairs use booking's list, and a repair chosen on
  the website opens booking with it ticked.
- **L1–L8:** customer words "Book a repair", staff "Book in"; one approval
  word; the shop address a placeholder everywhere; a glossary in the script;
  the reminder tick shown as already chosen; the account opens the same
  receipt; a line telling a guest they can sign in; the ready page names
  the checks not done (L5, touching Collect and pay M1); "Don't close things
  by themselves" in Your settings › Accessibility; the ✕ on every pop-up a
  real button (app-wide); the diary time follows a moved job. L9's edge
  cases stay listed, not drawn.

## Walk-through 1 fixes: as built (2 Oct)

Drawn and copied into every canvas they touch (22 journey canvases and both
big canvases). Checked against the plan above:

- **Met as planned:** H1 (Maya's example asks to be called first; the
  within-limit path drawn as `dq-job-within` and `dq-within-limit`, with a
  "Work added within your limit" message), H2 ("Mark ready for collection"
  marks it ready and sends "Bike ready" with Undo; `job-finished` now shows
  that, with Take payment; "Start work" after approval), M1, M3 (a teal
  "Waiting for the customer" state with its own symbol and legend entry;
  `dq-diary-waiting`), M4 ("Your answers" and "New ready date" rows; the
  count is now 22 messages on, 13 for a Lightspeed shop), M5, M6 (balance
  pay and paid pages, a receipt with the deposit as its own row, and the
  request page without a deposit plus `bk-request-deposit`), M7, M8, M9
  (`bk-service-chosen`), L1–L8.
- **Changed in the doing — M2:** the plan said to move Maya's diary block to
  09:30. That slot sits under the diary's "two jobs at once" example at
  09:00, which the move would break, so instead Maya books 11:30 — the start
  of her diary block — and Today and the overview say "11:30 appointment".
  The rule is the same: the arrival time is the diary slot's start.
- **Changed in the doing — L1:** "24 North Street" turned out to come from an
  early mock-up, not a recorded address, so it became [Shop address]
  everywhere, matching the receipt.
- **Left as it was:** the staff collection boards for a deposit taken at the
  till (journey 11's £27.75) — a different kind of deposit from one paid
  when booking; the customer's pages now use £[deposit].
- **Not drawn (as planned):** L9's edge cases. The ✕ on pop-ups that go back
  to another board in the prototype stays a link so the canvas can follow
  it; every other ✕ is now a button.

## Walk-through 2

4. **Walk-through 2 is a shop day** (Jack, 2 Oct: "1"): opening up (journey
   10), sales at the till (11), an online order to pick (2), cash-up (16).
   Chosen over another of the remaining stories, and stopping the
   walk-throughs to leave the rest for Jack and Mark.
