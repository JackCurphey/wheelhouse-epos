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
5. **Walk-through 2 (a shop day): every recommendation taken** (Jack, 2 Oct:
   "1"). From `design/user-journeys/ux-walkthrough-2-shop-day.md` (1 High,
   11 Medium, 6 Low): an unclosed day can be counted and banked at night and
   finishes closing once its sales have sent, and a day nobody counted is
   expected in the next morning's float (H1); the float check goes to the
   first person in who takes payments (M1); online money has its own line,
   kept out of each till's close (M5); stock held for an online order warns
   at the till but doesn't block (M6); a "Note it for later" list offline,
   and paid orders handed over from the till's copy (M7); "Keep orders for
   [n] days" (M8); the till's older-sale hint becomes a customer search in
   Past sales (M10); one named shelf for ready orders (L4); and every fix
   with no choice. The work is listed below as it's done.

## Walk-through 2 fixes: as built (2 Oct)

Drawn by three helpers working on separate modules, checked by rendering, and
copied into every canvas they touch. Against decision 5:

- **Met:** H1 (`eod-waiting` lets Jack count and bank while sales wait, the
  till bar shows offline and the card check waits; `eod-waiting-banked`;
  `op-today-banked`; `op-float-check-unclosed` expects the float plus
  Wednesday's cash, and "Close it" opens at banking), M1 (the float check
  goes to the first in who takes payments; Alex shows "In"), M2 (the day's
  report and the saved day show the float at the start; the count result
  shows how the expected figure was made), M3 (a count on the till's
  Online orders), M4 (an Orders group in the till's search; the hand-over
  over an empty basket), M5 (card-machine payments only in the card check;
  an "Online" line in Reports, kept out of the tills), M6 (`till-held`,
  `on-orders-sold-at-till`), M7 (`till-noted`, `till-collect-offline`), M8
  ("Keep orders for [n] days"), M9 (a sixth online message; 23 on), M10
  (`till-find-customer`, `till-refund-older`), M11 (`till-discounted`,
  `till-card-discounted`), L1–L5. "Where ready orders wait" and "kept for
  [n] days" live in the shared settings, so the website canvas shows them
  too.
- **Partly:** M11 — the card pop-up is drawn from £70.00; "Take payment"
  and "Split payment" are still drawn from £74.00. L1 — Jack is Manager on
  Online orders now, but stays Owner in Reports, where connecting Xero is
  owner-only: one role for Jack across every example is still open.
- **Raised by the work, for Jack:** on the uncounted-day float check, "Looks
  right" is kept beside "Count it"; pressing it makes Wednesday's figure
  what the till expected, not a count.

## Standing instruction for walk-throughs 3–7

6. **Walk every remaining story and take every recommendation, without
   asking each time** (Jack, 2 Oct: "if you can just keep going through all
   the stories and implement all the suggestions each time, they have all
   been good so far"). Each walk-through's report is still written, its
   claims checked, its fixes drawn, published and committed, and its
   choices recorded here with the recommendation taken. This also settles
   the three things left from walk-through 2, by the recommendation:
   only "Count it" on the float check for a day nobody counted; Jack Lewis
   is the Owner in every example; "Take payment" and "Split payment" drawn
   from the discounted £70.00.

## Walk-through 2 leftovers and walk-through 3 (stock): as built (2 Oct)

- **Walk-through 2 leftovers (decision 6):** the float check for an
  uncounted day offers only "Count it"; "Take payment" and "Split payment"
  are drawn from £70.00 (`till-pay-discounted`, `till-split-discounted`);
  Jack Lewis is the Owner in every example. Boards drawn as a manager's
  view (People lists that say "Only the owner can add or remove people",
  manager-only Settings, the manager's activity log) now show a "[Manager]"
  placeholder signed in, with Jack listed separately as Owner; the "Shop
  owner" placeholder on owner boards is now Jack Lewis.
- **Walk-through 3 (stock), every recommendation taken** (decision 6;
  `ux-walkthrough-3-stock.md`, 2 High, 10 Medium, 6 Low): booking in holds
  the job's pads and the till warns without blocking (`till-held-job`); a
  job whose part is sold, missing, damaged or whose order closed says so
  (`rs-part-*`); stock take "Expected" leaves out held stock and allows for
  every movement during the count; Staff can leave an unknown product for
  the owner or manager and book the rest in (`rs-receive-staff`,
  `rs-receive-staff-left`, `rs-add-left`, `rs-today-to-add`); a Staff
  version of "booked in"; the restock list has "For customers"; "Did a cost
  go up?" when accepting an invoice difference; stock written off is
  reported at cost; the VAT report's stock-purchase wording; Reports use
  the Stockroom's categories; transfers use the delivery's list; "Faulty —
  to return to supplier"; and the word and accessibility fixes. The
  Overview lists a job waiting for parts under "Needs attention" (the
  report left the tab open; this is the drawing's choice).

## Walk-through 4 (a new shop): as built (2 Oct)

Every recommendation taken (decision 6; `ux-walkthrough-4-new-shop.md`, 3
High, 7 Medium, 4 Low):
- **H1:** a first-time "Your till PIN" (`pin-first`, `pin-cleared`); Your
  settings shows "No PIN yet · Get your PIN"; the PIN screen says what to do
  with no PIN (and with no email: ask the owner or a manager); the invite
  says Wheelhouse gives the PIN.
- **H2:** the switch-over checklist's website item is "The website is
  ready", and the website goes on as a step on switch-over morning
  (`ws-page-moving`, `ws-page-switch-over`, `ws-editor-moving`,
  `ws-pay-tested-moving`, `ws-address-moving`). This changes what one item
  of Moving from Citrus Lime decision 7 means, as the report said.
- **H3:** no automatic messages go to customers until switch-over day; jobs
  show "Not sent — practice" (`mv-practice-job`, `set-msg-alongside`).
- **M1–M7, L1–L3:** Getting started while moving (`fr-today-moving`; the
  checklist is now 5 items, "3 of 5"); a till-only person with no email
  (`set-staff-invite-till-only`, `till-give-pin`); invited and expired
  invites (`set-staff-invited`, `set-staff-invite-expired`); no float check
  or Close the day in practice, and the first real morning counts the float
  (`mv-practice-checkin`, `till-checkin-practice`, `op-today-practice`,
  `op-float-check-first`); the refresh remembers import decisions; product
  photo and price counts before the website goes on; "every product online
  or nothing" asked once (`ws-start-products-answered`,
  `on-settings-start-answered`); the editor shows waiting orders only when
  there are some; Jack Lewis as Owner on the move's boards; named "Set up"
  buttons and stage words on a phone. Getting started uses the same
  Settings paths as the switch-over checklist.
- **Not drawn:** where "Fix" on the import leads and where the two
  "Change" links on the starting answer lead (the report left both open);
  where "Give [name] their PIN" sits in the till's Serving menu.

## Walk-throughs 5 (Cycle to Work) and 6 (a Lightspeed repair): as built (2 Oct)

Every recommendation taken (decision 6).
- **Walk-through 5** (`ux-walkthrough-5-cycle-to-work.md`, 4 High, 8 Medium,
  4 Low): the till sale at hand-over is drawn (`till-c2w-pick`, `till-c2w`,
  `till-c2w-pay`, `till-c2w-extra`, `till-c2w-paid`), and a deposit taken at
  the till (`till-c2w-deposit`); "Who pays what" follows the deposit rule and
  the refund is the order's next step; Cycle to Work has its own takings
  line, Xero rows for it, its commission and shortfalls, and a Reports card
  "Cycle to Work: owed and paid" (`rp-c2w`, `rp-accounts-c2w`); Maya is told
  when the certificate is for less or more, with a revised quote; a "the
  bike is ready" tick in the certificate pop-up; holds are never released
  silently and Maya is told either way; a held frame warns at the till and
  shows sold out online; the order is on Maya's customer page and account,
  findable by quote or certificate number, and the bike joins her Bikes;
  messages go the way she chose (the quote stays an email); providers' bulk
  payments; cancellation messages. 25 automatic messages on.
- **Walk-through 6** (`ux-walkthrough-6-lightspeed.md`, 2 High, 6 Medium,
  6 Low): Maya's own pages drawn as a Lightspeed shop — no deposit, no Pay
  now, no Basket, "Pay when you collect · Agreed price £111.00 — pay at the
  till", "give your name or job number WH-1042" (`bk-page-ls`,
  `bk-cancel-ls`, `dq-quote-ls`, `cp-summary-ls`, `cp-summary-ls-paid`;
  `ls-customer-ready` now shows the same page); a bike with no work order
  can be handed over as "pays later" or linked to one rung up by hand
  (`ls-hand-over-no-wo`); the Lightspeed customer is chosen at book-in while
  Maya is at the desk (`ls-book-in`), and Staff see the Lightspeed lines on
  Today (`op-today-staff-lightspeed`); a wrong Lightspeed customer can be
  changed from her page (`ls-customer-page`); "a price has gone up since you
  agreed" for Maya and for the job (`dq-quote-price-ls`,
  `dq-answered-price-no-ls`, `ls-job-price-asked`); "Mark it sorted…" with a
  recorded reason (`ls-job-sorted`); and the word fixes ("Agreed £111.00" on
  Lightspeed jobs). This changes *when* the Lightspeed look-up runs
  (Lightspeed shops decisions 3–4), not the rule.

## Walk-through 7 (an owner with two shops): as built (2 Oct)

Every recommendation taken (decision 6; `ux-walkthrough-7-two-shops.md`,
2 High, 6 Medium, 4 Low): Bolton's Today carries "[Second site] · 3 things
need attention", the shop menu and the sign-in shop choice show it, and the
owner gets an "All shops" card; a job booked into the other shop's workshop
is drawn as Maya's one job in [Second site]'s diary, and Bolton sees the
answer (`ms-request-answered`); a till can be moved to the other shop
(`ms-till-move`) and set up there with its own numbers (`ms-till-setup`;
journey B's "Set up this till" stays Bolton's B1); a new shop stays hidden
from customers until "Show [Second site] to customers"; the Workshop report
compares shops (`rp-workshop-all`); the activity log, alerts and devices
keep to their shop; transfers always say "[Second site]" and have a scan
box; messages name the shop ("North Street Cycles, Bolton"); the other
shop's buttons name their shop and line, and the shop name under a title is
no longer small and faded; a customer's history says which shop.

All seven stories in `ux-walkthrough-script.md` are walked. The staff canvas
holds 497 of its 512 files.

**Later change (3 Oct 2026, walk-through 2 second walk H1, `docs/design/user-journeys/walk-2/`):** Jack, 3 Oct: "1". A refund noted while offline is reminded in two places: Today shows "[n] refunds to finish · Finish" (to those who see Needs attention), and finishing one opens the refund with the sale and items already filled in; the till's "Past sales" button also carries a count, so whoever is on the till sees it. Fills the gap in decision 5 (M7). Chosen over the Today line only, and the till count only. Not drawn yet.

**Later change (3 Oct 2026, third walk, answer 6, `docs/decisions/2026-10-03-ux-walkthrough-third-walk.md`):** Jack, 3 Oct: "1". Walk-through 7 M3's "Show [Second site] to customers" is one press, with "Undo" for a moment; the shop shows on the website, in booking and for collecting straight away. Drawn in `docs/superpowers/specs/2026-10-03-draw-the-third-walk.md`.
