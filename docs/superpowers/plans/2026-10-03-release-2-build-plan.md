# Release 2 build plan — from here to the trading week

**Date:** 3 October 2026
**Status:** answered by Jack on 3 Oct (`docs/decisions/2026-10-03-build-plan-questions.md`);
waiting for Mark's view before anything starts. Jack: "dont start the build
yet".
**Kind:** programme plan. It puts every remaining piece of Release 2 in order,
so a session can pick up the next piece without asking. It sits under the
programme spec `docs/superpowers/specs/2026-09-27-release-2-design.md`, which
still sets the goal, scope and finish line, and it does not change them.

> **Changed 3 Oct (issue #116 step 6).** Each work package used to say "build
> to the drawings". The drawings are now one canvas of kept screens, each
> naming its building block and listing its situations (issue #116 steps 1–3),
> so each work package now says exactly what it builds: the **building blocks**
> it builds first (later packages reuse them), the **screens** (board ids on
> the one canvas), and the **situations** on each screen it must cover. Every
> kept screen and every situation is in exactly one package, and every
> building block is built in exactly one package, before any package reuses
> it. The test `docs/design/user-journeys/generator/consolidate/plan-coverage.test.mjs`
> checks this plan file against the consolidation files; it was watched
> failing on a deliberately broken copy of this plan before it passed.
> Jack's answers to issue #116 questions 2–6 moved some work out of the first
> build: the invoice check, the oversight extras, the full website editor,
> theme, extra pages and own web address are **later**, and practice mode is
> **dropped**. They are listed under "Later, not in Release 2's first build"
> with the decision each follows. The order, stages and work-package numbers
> are unchanged.

## 1. Why this exists

Jack, 3 Oct: "I want ultimately to give you the go ahead and you go and build
the whole thing without my input as we have already created the artifacts
that should have everything from me in them." Before this plan, the build
went journey by journey with no recorded order past Workshop day, so each
session had to ask what came next.

## 2. Finish line (unchanged)

From the programme spec §1: Release 2 is ready when Jack's shop has switched
Citrus Lime off and traded for one full trading week, including a weekend, on
Wheelhouse alone.

Along the way, each stage below ends with a **stage check**: the stage's
journeys walked in the real app with `docs/design/user-journeys/ux-walkthrough-script.md`
and the personas in `personas.md`, the same way the drawings were walked.
Findings that break a story are fixed before the next stage starts.

## 3. Where things stand (3 Oct)

- All 21 journeys are drawn: 820 of 823 screens. The three not drawn are
  journey 13's supplier screens, held for a later release.
- Issue #116 cut those drawings down to **one canvas**
  (https://claude.ai/artifact/WzmMdudJPoWH5aUd7J9V4j): 202 kept
  screens (209 boards, a few drawn at more than one size), whose
  situation lists hold 556 folded-in situations and 100
  written lines; 3 more screens are the same drawing as another,
  and 64 are later or dropped. The plan for every screen id is in
  `docs/design/user-journeys/generator/consolidate/` (`j*.mjs`, one file per
  journey). The clickable mockup (https://claude.ai/artifact/6rfhPpmSNY8eDtD6bEnChi)
  walks the stories through them.
- Built in the new app: the Soft sand look, the staff frame, the diary and
  job page (Workshop day, mostly), quotes stages 1–3, the customer booking
  pages from Release 1. Open: #110 (teal "Waiting for the customer"), #111
  (till piece 1), #112 (diary extras), #114 (walk-through 8 decisions).
- Roughly 10–15% of the journeys are built. About 240 pull requests remain
  (counted from three surveys of the decision files and code on 3 Oct, at
  250–600 changed lines each, before issue #116 moved work to later). At 3
  Oct's pace that is about 20 long sessions; foundations will be slower than
  screens.

## 4. How every piece is built (the loop)

Each work package below is built the same way, without stopping for Jack
unless a rule in the project's `CLAUDE.md` says to stop.

**How to read a work package.** Under its description, each package lists:

- *Building blocks built here*: the numbered parts from the building-blocks
  list in `docs/design/user-journeys/README.md` (1–47) that this package
  builds for the first time. A block is built once, in the first package that
  needs it; every later package reuses it and does not build its own version.
- *Reused, already built*: blocks its screens use that an earlier package
  built.
- *Screens it builds*: the kept screens, by their board id on the one canvas
  (the board's name strip says its block).
- *Situations*: each board's situation list is the same screen in a
  different situation (empty, failed, as Staff, at the second shop, and so
  on), one line each with what's different. A package covers the situations
  listed against it, by screen id. Some situations of a board come with a
  later package, when the thing they show is built (a Cycle to Work line on
  Today comes with Cycle to Work). "Written lines" are situation lines with no
  old drawing behind them (decisions written onto the board); they are on the
  canvas, and the package covers the count given.
- Tablet and phone: the "Tablet and phone, written down" table in the same
  README, one row per journey. Where it says "not decided", follow the
  closest pattern already built and log it.

1. **Read** the journey's decision file(s), the package's boards on the one
   canvas with their situation lists, and any walk-through decisions that
   touch it.
2. **Short spec**, as a section in a spec file in `docs/superpowers/specs/`
   (the way `2026-10-03-staff-diary-view-design.md` holds pieces 1–6): what
   the piece builds, which blocks, screen ids and situations, which
   decisions, what's left out.
3. **Tests first**, each watched failing for the right reason. Each
   situation in the package's lists gets at least one test.
4. **Build** the package's new building blocks, then its screens from those
   blocks and the ones already built, covering every situation listed for it.
   Where a board and its lines are silent, follow the closest pattern already
   built, and log it in `docs/decisions/decided-while-building.md`
   ("Decided here, for Jack to overrule") — never stop to ask.
5. **Review** by a fresh reviewer (a subagent that didn't write the code)
   against the spec, the boards and their situation lists.
6. **Tests pass** locally (`npm test`, `npm run test:browser`), then a pull
   request; merge when CI is green.
7. **Update** the build board artifact and `.agents/STATUS.md`.

Pull requests aim for 250–600 changed lines. A database change listed in
this plan needs no separate approval (see the questions file, Q1).

## 5. Things Wheelhouse can't do alone — built against stand-ins

Each is built behind a small adapter with a pretend version for tests and
development, and switched to the real service when an account exists. None
of them blocks building; all of them block going live.

| Outside service | Stand-in until it's real | Who unblocks it |
|---|---|---|
| Hosting and a public address (PL-1) | local server | Mark |
| Card machine | staff key the amount in (already in #111) | Paymentsense (Jack, Q7); model, linking and offline still to check |
| Online payments (PAY-05) | fake provider with test outcomes | Jack and Mark (Q10) |
| Email sending | an outbox kept in the database, viewable in the app | Mark: an email service account (Q10) |
| Staff sign-in service (WorkOS) | today's sign-in behind `use-session.ts`, and the plan's fake | Mark: WorkOS account (Q10) |
| Text messages (Twilio) | already real; fake in tests | keys exist in Jack's set-up |
| Xero and QuickBooks | spreadsheet downloads first, then a fake connector | developer accounts (Q10) |
| Citrus Lime import | Excel files laid out by the real Cloud Reports column names (`specs/2026-10-05-citrus-lime-exports.md`, #136) | Jack's real export files, and Citrus Lime's full export |
| Lightspeed | fake Lightspeed server | a test account (Q5) |
| Receipt and label printers | browser print; the existing print agent | — |

## 6. The order

Stages run in order. Inside a stage, work packages run in the order listed
unless marked as able to run alongside. Each line under a work package is
roughly one pull request. Journey numbers refer to the decision files in
`docs/decisions/`.

### Stage W — Persona walk-throughs of everything, before building

Jack, 3 Oct: "i also want to make sure that we have done persona
walkthroughs of everything before we build so that we have to make the least
changes at the end." Walk-throughs 1–8 walked eight stories, but the
personas file (`docs/design/user-journeys/personas.md`) only arrived with
walk-through 8, and two journeys (A App map, 15 Customer service) are in no
story yet. A problem found on a drawing costs a redraw; found after building
it costs a rebuild.

Each walk-through follows `ux-walkthrough-script.md`, uses the personas'
"Walk-through checks", has every finding checked by a second reviewer, and
ends with Jack's choices. Nothing in stage W is built.

- **WP-W.1 Walk-through 9 — Jo on the phone** (journeys 15, A, with 3 and
  11): a customer rings; Jo finds them, their bike, their job, a product and
  a price from one search box, one-handed, while talking.
- **WP-W.2 Walk-through 10 — the Saturday worker's day** (journeys 10, 11,
  16, 2, with the book-in and hand-over of 3 and 5): someone in one day a
  week, at the front desk, with till-only access, who doesn't remember last
  week's screens.
- **WP-W.3 Walk-through 11 — the owner's reports** (journeys 17, 19, 20, 8):
  the revenue and profit overview by shop first, margins one step away,
  figures that match everywhere.
- **WP-W.4 Walk-through 12 — Maya, not confident with phones, and Maya in
  a hurry** (journeys 1, 2, 3, 4, 5, 7, and the customer side of 6): every
  customer page walked twice, once as each.
- **WP-W.5 The coverage check.** A table of every journey against every
  persona who uses it, saying which walk-through covered it. Any empty cell
  gets walked before stage W closes.
- **WP-W.6 Draw the decisions.** Walk-through 8's decisions and stage W's
  are drawn on the canvases (walk-through 8 says "The drawings and the build
  are not changed yet"), so the build starts from drawings that match every
  decision. Issue #116 (fewer drawings, one canvas, re-walk, clickable
  mockup) replaces this package.

### Stage 0 — Close what's open

- **WP-0.1 Merge the open pull requests:** #110, #112, #111, #114.
- **WP-0.2 Fix the recorded booking bugs** (`.agents/STATUS.md`, booking
  list): a shop's subdomain showing another shop's booking page; "today"
  worked out at midnight UTC rather than shop time; Back while "Sending…"
  losing the private link; a lost reply causing a duplicate booking; a
  `null` body giving an error.
- **WP-0.3 Trim `.agents/STATUS.md`** to the 8,000-byte cap by moving history
  to `ARCHIVE.md` (it is 38,891 bytes, read at the start of every session).

### Stage 1 — Foundations

Everything later stands on these. Order matters: roles first. Several
foundations have no screen of their own; the screens that show them come in
later packages.

- **WP-1.1 Roles and switches** (Signing in; Owner setup 8–11). Four roles
  (Owner, Manager, Staff, Mechanic) and the nine switches on the server (the
  table: `docs/superpowers/specs/2026-10-05-wp-1-1-roles-and-switches.md`, #132);
  `/api/auth/me` returns them; every route checks them; the sidebar shows
  each role its rooms; a mechanic lands on the Diary; a login linked to its
  staff member (the mechanic's "Me").

<!-- screens 1.1 -->
*Building blocks built here:* 12 Controls hidden by role (no board of its own); 16 App frame; 29 "You can't open this — ask [name]" (no board of its own).

*Screens it builds (3) and the situations it covers:*

- **`map`** (block 16, App frame) — no other situations.
- **`staff-app`** (block 16, App frame) — 4 situations: `staff-app-mechanic`, `staff-app-menu`, `staff-search`, `auth-noaccess`; plus 3 written lines.
- **`till-rail`** (block 16, App frame) — 1 situation: `till-rail-open`; plus 2 written lines.
<!-- /screens -->

- **WP-1.2 Settings store, change record and activity log** (Owner setup 4;
  Management oversight 1). One place for shop settings; every change kept
  with who, when and the old value, with Undo; one activity record that
  every later piece writes to.

<!-- screens 1.2 -->
*Building blocks built here:* none new.

*Screens:* none of its own on the one canvas; the screens that show this work come in later packages.
<!-- /screens -->

- **WP-1.3 The Settings frame** (Owner setup; Receiving decision 7): four
  room pages, Jump-to rows, folding sections, "Saved · Undo", failed save,
  the phone room list. Built on Front desk › Till's quick buttons, the first
  room; WP-5.1 fills the rest of the rooms.

<!-- screens 1.3 -->
*Building blocks built here:* 1 Settings page; 2 Settings row; 9 Form box; 10 Saving / failed / undo message (no board of its own); 11 Empty list (no board of its own).

*Screens it builds (2) and the situations it covers:*

- **`set-till-quick`** (block 1, Settings page) — 3 of its 11 situations here: `set-list`, `set-till-quick-saved`, `set-till-empty`.
- **`set-till-quick-add`** (block 9, Form box) — no other situations.
<!-- /screens -->

- **WP-1.4 Shops (sites) everywhere** (Multiple sites 1–2). The current site
  on the session and every request; a site on stock, jobs, diary, capacity
  and cash-up; address, phone, hours and the per-site settings on each site.
  What belongs to the business and what to each site, how the site travels
  with a request, and the isolation-test rule for every new table:
  `docs/superpowers/specs/2026-10-05-wp-1-4-shops-and-sites.md` (#133).

<!-- screens 1.4 -->
*Building blocks built here:* none new.

*Screens:* none of its own on the one canvas; the screens that show this work come in later packages.
<!-- /screens -->

- **WP-1.5 Products, stock, sizes and colours, in pence** (Stock control 4,
  10; programme rule 3). Stock per shop; sizes and colours with their own
  barcodes; a category tree with details; every stock movement with who,
  why, shop and cause.

<!-- screens 1.5 -->
*Building blocks built here:* none new.

*Screens:* none of its own on the one canvas; the screens that show this work come in later packages.
<!-- /screens -->

- **WP-1.6 One sales record in pence with VAT per line** (offline spec;
  offline plan 2). Move the till from the old sales tables onto the offline
  core (`till_sales`): the till's own numbers, sending through sync, the
  in-browser copy and send queue, offline PIN check.

<!-- screens 1.6 -->
*Building blocks built here:* none new.

*Screens:* none of its own on the one canvas; the screens that show this work come in later packages.
<!-- /screens -->

- **WP-1.7 Sign-in and PINs** (Signing in; walk-through 8 decisions 1, 3).
  Sign-in screens in the new app; Wheelhouse picks each PIN, people change
  their own, a manager clears one; setting up a till; the PIN-only check-in;
  the shared workshop computer ("Working: [name] · Switch", back to the PIN
  screen when idle); WorkOS for staff and emailed codes for customers,
  against the fake until the account exists.

<!-- screens 1.7 -->
*Building blocks built here:* 13 Shop switcher; 22 Status line (no board of its own); 26 "Working: [name] · Switch" bar for a shared workshop computer (no board of its own); 40 Message or outcome page; 42 Emailed-code sign-in; 43 PIN pad.
*Reused, already built:* 1 Settings page (WP-1.3).

*Screens it builds (8) and the situations it covers:*

- **`workos-signin`** (block 42, Emailed-code sign-in) — no other situations.
- **`auth-site`** (block 13, Shop switcher) — no other situations; plus 1 written line.
- **`auth-signedout`** (block 40, Message or outcome page) — 1 situation: `auth-expired`.
- **`till-setup`** (block 1, Settings page) — its one situation comes with a later package; plus 1 written line.
- **`till-checkin`** (block 43, PIN pad) — 6 situations: `till-checkin-offline`, `till-checkin-stale`, `till-checkin-workshop`, `till-checkin-workshop-names`, `workshop-working-pills`, `till-pin-wrong`; plus 6 written lines.
- **`pin-change`** (block 43, PIN pad) — 3 situations: `pin-first`, `pin-cleared`, `till-give-pin`.
- **`cust-signin`** (block 42, Emailed-code sign-in) — no other situations; plus 2 written lines.
- **`cust-code`** (block 42, Emailed-code sign-in) — 1 situation: `cust-code-expired`.
- Added to the `set-till-quick` board (built in WP-1.3) — plus 2 written lines (trust PIN, and when a workshop computer goes back to the start).
<!-- /screens -->

- **WP-1.8 Messages engine and email** (Owner setup Messages; journeys 3, 4,
  5, 7). Message wording kept per shop with tap-in placeholders, sent by the
  customer's chosen way (text or email), a short Undo before sending, and a
  scheduler for reminders. Email through the outbox stand-in. Settings ›
  Messages is built here; each journey's message rows come with that
  journey's package.

<!-- screens 1.8 -->
*Building blocks built here:* none new.
*Reused, already built:* 1 Settings page (WP-1.3); 9 Form box (WP-1.3).

*Screens it builds (3) and the situations it covers:*

- **`set-msg-list`** (block 1, Settings page) — its 10 situations come with a later package.
- **`set-msg-edit`** (block 9, Form box) — no other situations.
- **`set-msg-new`** (block 9, Form box) — no other situations.
<!-- /screens -->

- **WP-1.9 Live updates** (walk-through 8 decision 2). Changes on one device
  show on the others within seconds; "who else has this open".

<!-- screens 1.9 -->
*Building blocks built here:* none new.

*Screens:* none of its own on the one canvas; the screens that show this work come in later packages.
<!-- /screens -->

- **WP-1.10 Needs attention and the Today page skeleton** (Opening the shop;
  used by 8, 9, 13, 14, 17, 18, 19, 20). One model for things that need
  attention, with Seen; Today's Who's in and Workshop today. Each journey's
  lines on Today come with that journey's package.

<!-- screens 1.10 -->
*Building blocks built here:* 6 Today cards.

*Screens it builds (1) and the situations it covers:*

- **`op-today`** (block 6, Today cards) — 2 of its 32 situations here: `op-today-staff`, `op-today-late`.
<!-- /screens -->

- **WP-1.11 Small shared parts:** spreadsheet download (programme rule 5);
  printing receipts and bike tags through the print agent; header search
  across customers, jobs, products and orders; Your settings with the
  Accessibility switches kept per person; the online payments adapter with
  its fake provider.

<!-- screens 1.11 -->
*Building blocks built here:* 17 Search with grouped results.
*Reused, already built:* 2 Settings row (WP-1.3).

*Screens it builds (2) and the situations it covers:*

- **`till-search`** (block 17, Search with grouped results) — 1 of its 2 situations here: `till-search-paid`; plus 4 written lines.
- **`your-settings`** (block 2, Settings row) — 1 of its 2 situations here: `your-settings-no-pin`; plus 2 written lines.
<!-- /screens -->

### Stage 2 — Products and stock

- **WP-2.1 Stock control** (journey 14): stock list with one search and
  filters; product page; size and colour grid; bike frame numbers; adjust
  stock with reasons; bulk price change with Undo; categories in Settings.

<!-- screens 2.1 -->
*Building blocks built here:* 3 Table with search and filters; 4 Detail page.
*Reused, already built:* 1 Settings page (WP-1.3); 9 Form box (WP-1.3).

*Screens it builds (6) and the situations it covers:*

- **`st-list`** (block 3, Table with search and filters) — 9 situations: `st-list-staff`, `st-search-measure`, `st-filter-bearings`, `st-filter-derailleurs`, `st-search-size`, `st-list-none`, `st-list-unknown`, `st-list-new`, `st-list-ticked`.
- **`st-categories`** (block 1, Settings page) — 1 situation: `st-setting-adjust`.
- **`st-category-edit`** (block 9, Form box) — no other situations.
- **`st-product`** (block 4, Detail page) — 3 of its 4 situations here: `st-product-staff`, `st-product-bike`, `st-product-sizes`.
- **`st-prices`** (block 9, Form box) — 1 situation: `st-prices-done`.
- **`st-adjust`** (block 9, Form box) — 1 situation: `st-adjust-faulty`.
- Added to the `op-today` board (built in WP-1.10) — 2 situations: `st-today-adjust`, `st-today-below`.
<!-- /screens -->

- **WP-2.2 Stock take** (journey 14): start a count, count on a phone,
  several counters, differences, recount, apply with Undo; below-zero on
  Today; sending stock to another shop.

<!-- screens 2.2 -->
*Building blocks built here:* 27 Scan-and-count list.
*Reused, already built:* 3 Table with search and filters (WP-2.1); 9 Form box (WP-1.3).

*Screens it builds (5) and the situations it covers:*

- **`tr-send`** (block 9, Form box) — no other situations.
- **`tk-hub`** (block 3, Table with search and filters) — 1 situation: `tk-hub-staff`.
- **`tk-start`** (block 9, Form box) — 1 situation: `tk-start-category`.
- **`tk-count`** (block 27, Scan-and-count list) — 1 situation: `tk-count-below`; plus 1 written line.
- **`tk-diff`** (block 3, Table with search and filters) — 1 situation: `tk-applied`.
- Added to the `st-product` board (built in WP-2.1) — 1 situation: `tr-sites`.
- Added to the `op-today` board (built in WP-1.10) — 1 situation: `tr-today-short`.
<!-- /screens -->

- **WP-2.3 Deliveries and purchase orders** (journey 13): the Deliveries
  page; receive a delivery by scanning; add an unknown product; frame
  numbers; book in (holding stock for a waiting job, "Part arrived" on the
  diary); problem lines and returns; labels; purchase orders; the restock
  list. The invoice check is later (see "Later").

<!-- screens 2.3 -->
*Building blocks built here:* none new.
*Reused, already built:* 3 Table with search and filters (WP-2.1); 4 Detail page (WP-2.1); 9 Form box (WP-1.3); 27 Scan-and-count list (WP-2.2).

*Screens it builds (7) and the situations it covers:*

- **`rs-hub`** (block 3, Table with search and filters) — 3 situations: `rs-hub-empty`, `rs-hub-staff`, `tr-incoming`.
- **`rs-receive`** (block 27, Scan-and-count list) — 7 of its 9 situations here: `rs-frame`, `rs-frame-dup`, `rs-receive-marked`, `rs-book-blocked`, `rs-receive-staff`, `rs-receive-staff-left`, `tr-receive`; plus 1 written line.
- **`rs-add-product`** (block 9, Form box) — 1 situation: `rs-add-left`.
- **`rs-problem`** (block 9, Form box) — 2 situations: `rs-problem-missing`, `tr-problem`.
- **`rs-delivery`** (block 4, Detail page) — 5 of its 6 situations here: `rs-booked`, `rs-booked-staff`, `rs-booked-job-waiting`, `rs-labels`, `rs-delivery-staff`; plus 1 written line.
- **`rs-order`** (block 4, Detail page) — 2 situations: `rs-order-ordered`, `rs-order-close`; plus 1 written line.
- **`rs-restock`** (block 3, Table with search and filters) — 1 situation: `rs-restock-customers`; plus 1 written line.
- Added to the `op-today` board (built in WP-1.10) — 2 situations: `rs-today-to-add`, `rs-today-restock`.
<!-- /screens -->

- **WP-2.4 Citrus Lime import, first half** (journey 9, pieces 1–4): upload,
  products and stock, customers and bikes, rows that need a look. Reads the
  Cloud Reports Excel exports, laid out by their real column names
  (`docs/superpowers/specs/2026-10-05-citrus-lime-exports.md`, #136):
  Price List - Store Level (products, prices, cost, stock and reorder levels
  per shop), Barcode/Alias List, Serial Number List, Top Customers, and
  Service Items Report (the customers' bikes). Each customer's marketing
  consent and its date come across with them *(proposed)*. Top Customers may
  leave out customers who never bought; they come from Citrus Lime's full
  export once Jack has asked for it. The bikes report has no account number,
  so bikes are matched to customers by name, email or phone, and any that
  don't match go to "rows that need a look". Runs alongside WP-2.1–2.3.

<!-- screens 2.4 -->
*Building blocks built here:* 24 Stage strip and its next-step box.

*Screens it builds (1) and the situations it covers:*

- **`mv-start`** (block 24, Stage strip and its next-step box) — 5 of its 13 situations here: `mv-progress`, `mv-progress-failed`, `mv-summary`, `mv-fix`, `mv-sorted`.
<!-- /screens -->

### Stage 3 — The till and the shop day

- **WP-3.1 The till, complete** (journey 11): customer on a sale with the
  group discount; discounts with reasons and line notes; quick-button
  groups; parked sales; receipts (print, email, text link, receipt page);
  past sales and voids; refunds; store credit and gift cards; customer
  accounts; paying for a workshop job with collection recorded; the offline
  screens. Cycle to Work at the till comes with WP-7.1. The till gives a
  customer group's discount by itself (Customer service 8); the groups are
  set up in Settings › Payments › Customer groups (`cs-groups`), built in
  WP-5.1, so until then the group parts are built and tested with groups made
  in the tests.

<!-- screens 3.1 -->
*Building blocks built here:* 8 "Are you sure?" box; 19 Till page; 20 Payment step; 21 Pick-one box.
*Reused, already built:* 3 Table with search and filters (WP-2.1); 4 Detail page (WP-2.1); 9 Form box (WP-1.3).

*Screens it builds (22) and the situations it covers:*

- **`till-sale`** (block 19, Till page) — 14 of its 19 situations here: `till-serving-pills`, `till-empty`, `till-noresults`, `till-held`, `till-held-job`, `till-discounted`, `till-loyalty`, `till-job`, `till-job-balance`, `till-offline`, `till-offline-long`, `till-needs-net`, `till-noted`, `till-no-signout`; plus 6 written lines.
- **`till-line`** (block 9, Form box) — 1 situation: `till-discount`.
- **`till-customer`** (block 21, Pick-one box) — no other situations.
- **`till-variant`** (block 21, Pick-one box) — no other situations.
- **`till-serial`** (block 21, Pick-one box) — 1 situation: `till-serial-held`.
- **`till-pay`** (block 20, Payment step) — 2 of its 4 situations here: `till-pay-other`, `till-pay-discounted`; plus 1 written line.
- **`till-card`** (block 20, Payment step) — 2 situations: `till-card-discounted`, `till-card-declined`.
- **`till-pay-cash`** (block 20, Payment step) — no other situations.
- **`till-pay-split`** (block 20, Payment step) — 1 situation: `till-split-discounted`.
- **`till-receipt`** (block 20, Payment step) — 1 of its 3 situations here: `till-receipt-split`.
- **`till-giftcard`** (block 20, Payment step) — no other situations.
- **`till-account`** (block 20, Payment step) — no other situations.
- **`till-deposit`** (block 20, Payment step) — 1 situation: `till-job-deposit`.
- **`till-park`** (block 21, Pick-one box) — no other situations.
- **`till-find`** (block 3, Table with search and filters) — 1 situation: `till-find-customer`.
- **`till-sale-detail`** (block 4, Detail page) — its one situation comes with a later package.
- **`till-refund`** (block 9, Form box) — 3 situations: `till-refund-older`, `till-refund-cash`, `till-refund-noreceipt`; plus 1 written line.
- **`till-void`** (block 8, "Are you sure?" box) — no other situations.
- **`till-collect`** (block 9, Form box) — 1 of its 2 situations here: `till-collect-offline`; plus 1 written line.
- **`till-book-in`** (block 9, Form box) — no other situations.
- **`till-hand-over-job`** (block 9, Form box) — no other situations.
- **`till-failed`** (block 3, Table with search and filters) — no other situations.
- `on-hand-over` is the same drawing as `till-collect`, so it adds nothing of its own.
<!-- /screens -->

- **WP-3.2 Customers** (journey 15): customers page with duplicates caught;
  the customer page with one history; bike warranty; store credit and
  account statements; a customer's group (setting up the groups themselves
  comes with WP-5.1, as for WP-3.1); merging; privacy requests.

<!-- screens 3.2 -->
*Building blocks built here:* none new.
*Reused, already built:* 3 Table with search and filters (WP-2.1); 4 Detail page (WP-2.1); 9 Form box (WP-1.3).

*Screens it builds (8) and the situations it covers:*

- **`cs-list`** (block 3, Table with search and filters) — no other situations.
- **`cs-page`** (block 4, Detail page) — 5 of its 9 situations here: `customer`, `cs-page-over`, `cs-page-new`, `cs-page-off`, `cs-page-dup`.
- **`cs-credit`** (block 9, Form box) — no other situations.
- **`cs-add`** (block 9, Form box) — 3 situations: `cs-edit`, `cs-add-company`, `cs-add-match`.
- **`cs-account`** (block 4, Detail page) — no other situations.
- **`cs-transfer`** (block 9, Form box) — no other situations.
- **`cs-privacy`** (block 3, Table with search and filters) — 1 of its 2 situations here: `cs-privacy-delete`; plus 4 written lines.
- **`cs-merge`** (block 4, Detail page) — no other situations.
- Added to the `till-sale-detail` board (built in WP-3.1) — 1 situation: `cs-sale`.
<!-- /screens -->

- **WP-3.3 Opening the shop** (journey 10): float check; the note-and-coin
  counter; Today's money side.

<!-- screens 3.3 -->
*Building blocks built here:* 18 Note-and-coin counter (no board of its own).
*Reused, already built:* 9 Form box (WP-1.3).

*Screens it builds (2) and the situations it covers:*

- **`op-float-check`** (block 9, Form box) — 3 situations: `op-float-check-unclosed`, `op-float-check-first`, `op-float-matched`; plus 1 written line.
- **`op-float-short`** (block 9, Form box) — 1 situation: `op-float-over`.
- Added to the `op-today` board (built in WP-1.10) — 3 situations: `op-today-short`, `op-today-seen`, `op-today-waiting`; plus 1 written line.
<!-- /screens -->

- **WP-3.4 End-of-day cash-up** (journey 16): Close the day in six steps;
  the count; paid-outs and banking; card check; end-of-day report; reopen.

<!-- screens 3.4 -->
*Building blocks built here:* 5 Report page; 7 Step-by-step checklist.
*Reused, already built:* 9 Form box (WP-1.3).

*Screens it builds (4) and the situations it covers:*

- **`eod-check`** (block 9, Form box) — no other situations.
- **`eod-count`** (block 7, Step-by-step checklist) — 12 situations: `op-float-count`, `op-close-yesterday`, `eod-waiting`, `eod-waiting-banked`, `eod-attention`, `eod-count-shown`, `eod-count-result`, `eod-count-exact`, `eod-banking`, `eod-banking-none`, `eod-card`, `eod-finish`; plus 1 written line.
- **`eod-paidout`** (block 9, Form box) — no other situations.
- **`eod-z`** (block 5, Report page) — no other situations; plus 1 written line.
- Added to the `op-today` board (built in WP-1.10) — 3 situations: `op-today-banked`, `op-today-unclosed`, `op-today-two`.
- Added to the `till-sale` board (built in WP-3.1) — 1 situation: `eod-entry`.
<!-- /screens -->

### Stage 4 — The workshop and the customer's repair

- **WP-4.1 Workshop day, the rest** (journey 12; walk-through 8): Overview
  page; request pop-up (mechanic pills, offer another time, decline with a
  message); new job extras; storage slots; bike tag at book-in; full service
  checklist; done ticks and notes per line; diary settings; "I'll do this";
  "Who did what"; mechanic sign-off (Q3); "Use my phone" photo.

<!-- screens 4.1 -->
*Building blocks built here:* 15 The job page, reused as it is; 23 Diary; 25 Quick-look box.
*Reused, already built:* 1 Settings page (WP-1.3); 3 Table with search and filters (WP-2.1); 7 Step-by-step checklist (WP-3.4); 9 Form box (WP-1.3).

*Screens it builds (9) and the situations it covers:*

- **`set-workshop-diary`** (block 1, Settings page) — 1 situation: `diary-settings`.
- **`diary`** (block 23, Diary) — 9 of its 14 situations here: `desk`, `diary-mechanic`, `waiting-open`, `change-selected`, `diary-context-menu`, `diary-stack-hover`, `diary-stack-open`, `new-job-pick`, `rs-diary-arrived`; plus 6 written lines.
- **`diary-day`** (block 23, Diary) — no other situations.
- **`job-quick-overview`** (block 25, Quick-look box) — 1 situation: `diary-hover-summary`; plus 1 written line.
- **`request-new`** (block 9, Form box) — 3 of its 4 situations here: `request-decline`, `request-change`, `request-cancel`.
- **`new-job`** (block 9, Form box) — 1 of its 2 situations here: `new-job-day`; plus 1 written line.
- **`job-overview`** (block 15, The job page, reused as it is) — 11 of its 22 situations here: `job-book-in`, `job-quote`, `job-mechanic`, `job-waiting-parts`, `job-finished`, `job-collection`, `rs-job-arrived`, `rs-part-sold`, `rs-part-missing`, `rs-part-damaged`, `rs-part-order-closed`; plus 10 of its 11 written lines.
- **`job-checklist`** (block 7, Step-by-step checklist) — no other situations.
- **`overview`** (block 3, Table with search and filters) — 1 situation: `rs-overview-arrived`.
<!-- /screens -->

- **WP-4.2 Quotes, the rest** (journey 4): the customer's job page with its
  tracker; notes for the shop; photo per line; "Goes with"; reminders;
  spending limit; deposit on the quote.

<!-- screens 4.2 -->
*Building blocks built here:* 37 Customer job page; 38 Quote card.
*Reused, already built:* 9 Form box (WP-1.3).

*Screens it builds (3) and the situations it covers:*

- **`bk-page`** (block 37, Customer job page) — 2 of its 17 situations here: `dq-in-shop`, `dq-waiting-part`.
- **`dq-quote`** (block 38, Quote card) — 12 of its 15 situations here: `dq-quote-photo`, `dq-quote-untick`, `dq-quote-decline`, `dq-quote-deposit`, `dq-quote-reminded`, `dq-quote-newer`, `dq-withdrawn`, `dq-within-limit`, `dq-answered`, `dq-answered-declined`, `dq-answered-deposit`, `dq-answered-by-phone`; plus 2 written lines.
- **`dq-record-answer`** (block 9, Form box) — no other situations; plus 1 written line.
- Added to the `job-overview` board (built in WP-4.1) — 6 situations: `dq-job-quote`, `dq-job-sent`, `dq-job-withdraw`, `dq-job-answered`, `dq-job-within`, `dq-job-waiting`; plus 1 written line.
- Added to the `diary` board (built in WP-4.1) — 1 situation: `dq-diary-waiting`.
- Added to the `op-today` board (built in WP-1.10) — 1 situation: `dq-today-no-answer`.
- Added to the `set-msg-list` board (built in WP-1.8) — 1 situation: `dq-messages`.
<!-- /screens -->

- **WP-4.3 Collect and pay** (journey 5): the customer's ready page; "Bike
  ready" sent on Mark ready; pay now online; receipts; the uncollected
  reminder. Collection settings come with WP-4.4 (they are a section of
  Settings › Workshop › Online booking).

<!-- screens 4.3 -->
*Building blocks built here:* 39 Card payment box; 41 Receipt and printed documents.
*Reused, already built:* 9 Form box (WP-1.3); 37 Customer job page (WP-4.2).

*Screens it builds (5) and the situations it covers:*

- **`cp-summary`** (block 37, Customer job page) — 9 of its 12 situations here: `dq-ready`, `customer-message`, `cp-summary-said-yes`, `cp-summary-deposit`, `cp-summary-paid`, `cp-summary-counter`, `cp-summary-inshop`, `cp-expired`, `ready`.
- **`cp-pay`** (block 39, Card payment box) — 4 situations: `cp-pay-failed`, `cp-pay-balance`, `cp-paid`, `cp-paid-balance`.
- **`cp-receipt-email`** (block 41, Receipt and printed documents) — 4 situations: `cp-receipt-email-guest`, `cp-invoice-email`, `cp-receipt-email-till`, `cp-receipt-email-deposit`.
- **`cp-receipt-text`** (block 41, Receipt and printed documents) — 1 situation: `cp-receipt-text-email`.
- **`cp-receipt-address`** (block 9, Form box) — 5 situations: `cp-receipt-address-error`, `cp-receipt-address-save`, `cp-receipt-address-text`, `cp-receipt-address-customer`, `cp-receipt-address-offline`.
- Added to the `job-overview` board (built in WP-4.1) — 5 situations: `cp-ready-unpaid`, `cp-ready-deposit`, `cp-ready-paid`, `cp-ready-ticks`, `cp-collected`.
- Added to the `till-sale` board (built in WP-3.1) — 1 situation: `cp-till`.
- Added to the `op-today` board (built in WP-1.10) — 1 situation: `cp-today-uncollected`.
- Added to the `set-msg-list` board (built in WP-1.8) — 2 situations: `cp-messages`, `cp-message-wording`.
<!-- /screens -->

- **WP-4.4 Book a repair, rebuilt** (journey 3): change and cancel (d6);
  the one-page booking with steps; the two-week day strip; a saved draft;
  signed-in prefill; online-booking settings, with collection settings;
  auto-confirm; deposits;
  offered times; booking messages. "Which shop?" in the booking comes with
  WP-5.2. The Release 1 request page (`pending`) is rebuilt here, reusing
  block 40.

<!-- screens 4.4 -->
*Building blocks built here:* 36 Step-by-step booking, with the day strip and time picker.
*Reused, already built:* 1 Settings page (WP-1.3); 8 "Are you sure?" box (WP-3.1); 37 Customer job page (WP-4.2); 40 Message or outcome page (WP-1.7).

*Screens it builds (8) and the situations it covers:*

- **`bk-service`** (block 36, Step-by-step booking, with the day strip and time picker) — 3 of its 6 situations here: `bk-service-chosen`, `bk-service-many`, `bk-unavailable`.
- **`bk-bike`** (block 36, Step-by-step booking, with the day strip and time picker) — 2 situations: `bk-bike-signed-in`, `bk-not-sure`.
- **`bk-when`** (block 36, Step-by-step booking, with the day strip and time picker) — 2 of its 3 situations here: `bk-when-full`, `bk-when-dropoff`.
- **`bk-details`** (block 36, Step-by-step booking, with the day strip and time picker) — 6 situations: `bk-details-deposit`, `bk-sending`, `bk-card-failed`, `bk-not-sent`, `bk-checking-payment`, `bk-resume`.
- **`bk-change`** (block 37, Customer job page) — 2 situations: `bk-change-pending`, `bk-change-declined`.
- **`bk-cancel`** (block 8, "Are you sure?" box) — 1 of its 2 situations here: `bk-cancel-late`.
- **`bk-settings`** (block 1, Settings page) — 2 situations: `bk-settings-deposits`, `cp-setting`; plus 2 written lines.
- **`pending`** (block 40, Message or outcome page) — 1 situation: `expired`.
- Added to the `bk-page` board (built in WP-4.2) — 10 situations: `bk-request`, `bk-request-deposit`, `bk-confirmed`, `bk-page-request`, `bk-offered`, `bk-page-dropoff`, `bk-cancelled`, `bk-cancelled-late`, `bk-declined`, `bk-expired`; plus 1 written line.
- Added to the `diary` board (built in WP-4.1) — 2 situations: `bk-staff-request`, `bk-staff-decline`.
- Added to the `set-msg-list` board (built in WP-1.8) — 1 situation: `bk-messages`.
<!-- /screens -->

- **WP-4.5 Account, history and reminders** (journey 7): the account page
  (sign-in by emailed code is built in WP-1.7); receipts in history;
  conversations and the staff Messages inbox; consent and "Stop these";
  service reminders; review requests; Your data.

<!-- screens 4.5 -->
*Building blocks built here:* 47 Conversation thread with a reply box.
*Reused, already built:* 3 Table with search and filters (WP-2.1); 4 Detail page (WP-2.1); 8 "Are you sure?" box (WP-3.1); 9 Form box (WP-1.3); 40 Message or outcome page (WP-1.7); 41 Receipt and printed documents (WP-4.3).

*Screens it builds (9) and the situations it covers:*

- **`ac-account`** (block 4, Detail page) — 10 of its 12 situations here: `bk-bookings`, `ac-account-lower`, `ac-account-repairs`, `ac-account-new`, `ac-account-question-sent`, `ac-account-asked`, `ac-download`, `ac-download-failed`, `ac-account-delete-pending`, `ac-account-delete-cancelled`; plus 1 written line.
- **`ac-receipt`** (block 41, Receipt and printed documents) — 1 situation: `ac-receipt-sent`.
- **`ac-ask`** (block 9, Form box) — no other situations.
- **`ac-question`** (block 47, Conversation thread with a reply box) — no other situations.
- **`ac-inbox`** (block 3, Table with search and filters) — 5 situations: `ac-inbox-list`, `ac-inbox-sent`, `ac-inbox-all`, `ac-inbox-empty`, `ac-reply-text`; plus 1 written line.
- **`ac-review-setting`** (block 9, Form box) — 1 situation: `ac-review-first`.
- **`ac-contact`** (block 9, Form box) — 2 situations: `preferences`, `ac-contact-changed`.
- **`ac-stopped`** (block 40, Message or outcome page) — 1 situation: `ac-stopped-on`.
- **`ac-delete`** (block 8, "Are you sure?" box) — 2 situations: `ac-delete-blocked`, `ac-delete-sent`.
- Added to the `bk-page` board (built in WP-4.2) — 4 situations: `ac-job-note`, `ac-job-note-sent`, `ac-job-note-answered`, `ac-book-remind`.
- Added to the `op-today` board (built in WP-1.10) — 1 situation: `ac-today`.
- Added to the `cp-summary` board (built in WP-4.3) — 1 situation: `ac-collect-remind`.
- Added to the `set-msg-list` board (built in WP-1.8) — 2 situations: `ac-messages`, `ac-reminder-wording`; plus 1 written line.
- Added to the `bk-when` board (built in WP-4.4) — 1 situation: `ac-reminder-landing`.
- Added to the `cs-privacy` board (built in WP-3.2) — 1 situation: `ac-privacy-requests`.
- Added to the `cs-page` board (built in WP-3.2) — 1 situation: `ac-customer-delete`.
<!-- /screens -->

### Stage 5 — The office

- **WP-5.1 Owner setup, the rooms** (journey 8): Till, Payments and End of
  day; Staff and roles with invites; Workshop settings; Shop and sites; Your
  data; the Getting started checklist. (Settings › Messages is WP-1.8; diary
  settings are WP-4.1.)

<!-- screens 5.1 -->
*Building blocks built here:* 14 Activity list.
*Reused, already built:* 1 Settings page (WP-1.3); 7 Step-by-step checklist (WP-3.4); 9 Form box (WP-1.3).

*Screens it builds (10) and the situations it covers:*

- **`fr-today`** (block 7, Step-by-step checklist) — 2 situations: `fr-today-moving`, `fr-done`.
- **`set-eod`** (block 1, Settings page) — 2 situations: `set-eod-close`, `set-save-failed`.
- **`set-pay-ways`** (block 1, Settings page) — 4 situations: `fr-step`, `set-pay-other`, `set-pay-card`, `cs-groups`.
- **`set-staff`** (block 1, Settings page) — 3 situations: `set-staff-roles`, `set-staff-invited`, `set-staff-invite-expired`.
- **`set-staff-person`** (block 9, Form box) — 2 of its 4 situations here: `set-staff-person-all`, `set-staff-clear-pin`; plus 4 written lines.
- **`set-staff-invite`** (block 9, Form box) — 1 situation: `set-staff-invite-till-only`.
- **`set-shop-details`** (block 1, Settings page) — 1 of its 3 situations here: `set-shop-hours`.
- **`set-workshop-services`** (block 1, Settings page) — 3 of its 5 situations here: `ac-services`, `ac-service-edit`, `set-workshop-mechanics`; plus 2 written lines (the service box's online booking and deposit, Book a repair 3 and 11).
- **`set-data-export`** (block 1, Settings page) — no other situations.
- **`set-data-history`** (block 14, Activity list) — no other situations.
- Added to the `set-till-quick` board (built in WP-1.3) — 6 situations: `set-till-reasons`, `set-till-receipts`, `set-till-printer`, `set-till-tills`, `set-till-tills-owner`, `set-till-remove`; plus 2 written lines.
- Added to the `set-msg-list` board (built in WP-1.8) — plus 3 written lines.
<!-- /screens -->

- **WP-5.2 Multiple sites, the screens** (journey 19): shop switcher and
  "All shops"; works-at with days per shop; prices and services per shop;
  adding a shop; tills by shop; Today across shops; booking at the other
  shop's workshop.

<!-- screens 5.2 -->
*Building blocks built here:* 28 Price at each shop field.
*Reused, already built:* 9 Form box (WP-1.3); 13 Shop switcher (WP-1.7).

*Screens it builds (5) and the situations it covers:*

- **`ms-switch-open`** (block 13, Shop switcher) — 2 situations: `ms-switched`, `ms-one-shop`; plus 2 written lines.
- **`ms-service-price`** (block 28, Price at each shop field) — 1 situation: `ms-service-not-offered`.
- **`ms-product-price`** (block 28, Price at each shop field) — no other situations.
- **`ms-add-shop`** (block 9, Form box) — 1 situation: `ms-add-shop-error`.
- **`ms-till-move`** (block 9, Form box) — no other situations.
- Added to the `op-today` board (built in WP-1.10) — 3 situations: `ms-today-all`, `ms-today-new`, `ms-today-shown`.
- Added to the `diary` board (built in WP-4.1) — 2 situations: `ms-pick-shop`, `ms-request-answered`.
- Added to the `till-sale` board (built in WP-3.1) — 1 situation: `ms-till-other`.
- Added to the `set-workshop-services` board (built in WP-5.1) — 1 situation: `ms-services-differs`.
- Added to the `set-staff-person` board (built in WP-5.1) — 1 situation: `ms-person`.
- Added to the `bk-service` board (built in WP-4.4) — 3 situations: `ms-book-shop`, `ms-book-shop-chosen`, `ms-book-shop-change`.
- Added to the `new-job` board (built in WP-4.1) — 1 situation: `ms-job-other-shop`.
- Added to the `request-new` board (built in WP-4.1) — 1 situation: `ms-request-from-shop`.
- Added to the `set-shop-details` board (built in WP-5.1) — 2 situations: `ms-sites`, `ms-sites-manager`.
- Added to the `set-till-quick` board (built in WP-1.3) — 1 situation: `ms-tills`; plus 1 written line.
- Added to the `till-setup` board (built in WP-1.7) — 1 situation: `ms-till-setup`.
<!-- /screens -->

- **WP-5.3 Reports and accounts** (journey 17): the reporting layer;
  reports home; sales with graphs; saved reports; takings and cash-ups; VAT;
  margin and stock value; workshop; discounts and refunds; the Xero and
  QuickBooks link (Q10); "All shops". The Cycle to Work report comes with
  WP-7.1.

<!-- screens 5.3 -->
*Building blocks built here:* none new.
*Reused, already built:* 1 Settings page (WP-1.3); 5 Report page (WP-3.4); 9 Form box (WP-1.3).

*Screens it builds (11) and the situations it covers:*

- **`rp-home`** (block 5, Report page) — 4 of its 6 situations here: `rp-home-all`, `rp-home-staff`, `rp-report-menu`, `rp-report-deleted`; plus 2 written lines.
- **`rp-sales`** (block 5, Report page) — 5 situations: `rp-sales-all`, `rp-sales-year`, `rp-sales-empty`, `rp-pick-dates`, `rp-changed`.
- **`rp-change`** (block 9, Form box) — 2 situations: `rp-save`, `rp-save-taken`.
- **`rp-takings`** (block 5, Report page) — 2 situations: `rp-takings-all`, `rp-takings-reopened`.
- **`rp-day`** (block 5, Report page) — 1 situation: `rp-reopen`.
- **`rp-vat`** (block 5, Report page) — 2 situations: `rp-vat-first`, `rp-vat-all`.
- **`rp-margin`** (block 5, Report page) — no other situations; plus 2 written lines.
- **`rp-workshop`** (block 5, Report page) — 1 situation: `rp-workshop-all`.
- **`rp-discounts`** (block 5, Report page) — 1 situation: `rp-discounts-staff`; plus 1 written line.
- **`rp-returning`** (block 5, Report page) — no other situations.
- **`rp-accounts-connect`** (block 1, Settings page) — 5 of its 6 situations here: `rp-accounts-map`, `rp-accounts-missing`, `rp-accounts-log`, `rp-accounts-lost`, `rp-accounts-disconnect`.
- Added to the `your-settings` board (built in WP-1.11) — 1 situation: `rp-your-settings`.
- Added to the `op-today` board (built in WP-1.10) — 1 situation: `rp-today-accounts`.
- Added to the `set-staff-person` board (built in WP-5.1) — 1 situation: `rp-person`.
<!-- /screens -->

- **WP-5.4 Management oversight** (journey 20): the activity log screen;
  checking a person out of a till. The activity log stays in the first
  release (Management oversight, later change, issue #116 question 5); the
  other oversight screens are later (see "Later").

<!-- screens 5.4 -->
*Building blocks built here:* none new.
*Reused, already built:* 14 Activity list (WP-5.1).

*Screens it builds (1) and the situations it covers:*

- **`ops-log`** (block 14, Activity list) — 4 of its 5 situations here: `ops-log-manager`, `ops-log-all`, `ops-log-empty`, `ops-log-refused`.
- Added to the `rp-home` board (built in WP-5.3) — 2 situations: `ops-reports-home`, `ops-reports-staff`.
- Added to the `set-till-quick` board (built in WP-1.3) — 1 situation: `ops-till-checkout`.
<!-- /screens -->

### Stage 6 — The website

- **WP-6.1 Website management** (journey 18): website model with drafts and
  publishing; the Website page with its "Words and photos" list for the
  fixed design (Website management, later changes, issue #116 question 2 and
  walk-through 4 H3); the shop's logo and main colour; tracking tools;
  online payments setup; Shopify in the new frame. Every shop keeps its free
  address. The editor, theme, extra pages and own web address are later (see
  "Later"). Until the editor exists, the "Review in the editor" button on
  the list of unpublished changes (`ws-page-changes`) stays hidden.

<!-- screens 6.1 -->
*Building blocks built here:* 30 Simple text-and-photo editor for the fixed website (no board of its own).
*Reused, already built:* 1 Settings page (WP-1.3); 9 Form box (WP-1.3); 14 Activity list (WP-5.1); 24 Stage strip and its next-step box (WP-2.4).

*Screens it builds (7) and the situations it covers:*

- **`ws-start-which`** (block 24, Stage strip and its next-step box) — 2 situations: `ws-start-products`, `ws-start-shopify`.
- **`ws-start-look`** (block 24, Stage strip and its next-step box) — no other situations (step 2 of the set-up, the same step strip as step 1; corrected 3 Oct from a mistyped block 18).
- **`ws-page`** (block 1, Settings page) — 10 situations: `ws-page-on`, `ws-page-changes`, `ws-no-access`, `ws-no-settings`, `ws-page-moving`, `ws-page-switch-over`, `ws-published`, `ws-published-off`, `ws-discard`, `ws-shopify-on`; plus 2 written lines.
- **`ws-history`** (block 14, Activity list) — no other situations.
- **`ws-tracking`** (block 1, Settings page) — 2 situations: `ws-tracking-on`, `ws-tracking-error`.
- **`ws-pay-none`** (block 1, Settings page) — 6 situations: `ws-pay-tested-moving`, `ws-pay-connected`, `ws-pay-tested`, `ws-pay-failed`, `ws-pay-more`, `ws-pay-shopify`.
- **`ws-shopify-connect`** (block 9, Form box) — 5 situations: `ws-shopify-failed`, `ws-shopify-check`, `ws-shopify-sending`, `ws-shopify-problem`, `ws-shopify-switch`.
- Added to the `op-today` board (built in WP-1.10) — 1 situation: `ws-today-pay-more`.
<!-- /screens -->

- **WP-6.2 Find the shop and browse** (journey 1): the website shell; home;
  shop and category pages with filters; product page; search; Our shops;
  cookies.

<!-- screens 6.2 -->
*Building blocks built here:* 31 Product card and product list; 32 Product page, with its availability line; 33 "Which shop?" box; 34 Shop card; 44 Staff banner on the website; 45 Cookie choice.
*Reused, already built:* 16 App frame (WP-1.1); 17 Search with grouped results (WP-1.11); 40 Message or outcome page (WP-1.7).

*Screens it builds (17) and the situations it covers:*

- **`wb-home`** (block 16, App frame) — 3 situations: `wb-home-lower`, `wb-home-one-shop`, `wb-first-visit`.
- **`wb-choose-shop`** (block 33, "Which shop?" box) — its one situation comes with a later package.
- **`wb-shop`** (block 31, Product card and product list) — no other situations.
- **`wb-category`** (block 31, Product card and product list) — 7 situations: `wb-category-empty`, `wb-category-parent`, `wb-category-child`, `wb-category-no-shop`, `wb-search-results`, `wb-search-measure`, `wb-search-none`.
- **`wb-category-filtered`** (block 31, Product card and product list) — no other situations.
- **`wb-product`** (block 32, Product page, with its availability line) — 3 of its 11 situations here: `wb-product-sizes`, `wb-product-size-other`, `wb-product-held`.
- **`wb-product-photos`** (block 32, Product page, with its availability line) — no other situations.
- **`wb-search-typing`** (block 17, Search with grouped results) — 1 situation: `wb-search-no-suggestions`.
- **`wb-shops`** (block 34, Shop card) — no other situations.
- **`wb-shop-page`** (block 34, Shop card) — 2 situations: `wb-shop-collect`, `wb-find-us`.
- **`wb-not-found`** (block 40, Message or outcome page) — 1 situation: `wb-off`.
- **`wb-off-preview`** (block 44, Staff banner on the website) — 3 situations: `wb-off-preview-product`, `wb-off-preview-ask`, `wb-turned-on`; plus 1 written line.
- **`wb-cookies-banner`** (block 45, Cookie choice) — 1 situation: `wb-cookies-saved`.
- **`wb-cookies-choose`** (block 45, Cookie choice) — no other situations.
- **`wb-cookies-page`** (block 45, Cookie choice) — 1 situation: `wb-cookies-page-plain`.
- **`site`** (block 16, App frame) — 1 situation: `site-menu`.
- **`site-ocean`** (block 16, App frame) — 1 situation: `site-ocean-menu`.
<!-- /screens -->

- **WP-6.3 Buy online and click and collect** (journey 2): basket;
  checkout; paying; confirmation; the customer's order page; staff Online
  orders; hand-over at the till; reminders; gift cards and store credit
  online; order messages.

<!-- screens 6.3 -->
*Building blocks built here:* 35 Basket and checkout sections; 46 Email and text frame.
*Reused, already built:* 1 Settings page (WP-1.3); 3 Table with search and filters (WP-2.1); 4 Detail page (WP-2.1); 9 Form box (WP-1.3); 39 Card payment box (WP-4.3); 40 Message or outcome page (WP-1.7).

*Screens it builds (10) and the situations it covers:*

- **`on-basket`** (block 35, Basket and checkout sections) — 2 situations: `on-basket-changed`, `on-basket-empty`.
- **`on-checkout`** (block 35, Basket and checkout sections) — 9 situations: `on-checkout-errors`, `on-checkout-credit`, `on-checkout-covered`, `on-checkout-gift-code`, `on-checkout-gift`, `on-checkout-paying`, `on-checkout-declined`, `on-checkout-unsure`, `on-checkout-sold-out`.
- **`on-checkout-bank`** (block 39, Card payment box) — no other situations.
- **`on-confirmed`** (block 40, Message or outcome page) — 1 situation: `on-save-details`.
- **`on-order`** (block 4, Detail page) — 8 situations: `on-order-moving`, `on-order-ready`, `on-order-collected`, `on-order-cancel`, `on-order-cancelled`, `on-order-clash`, `on-order-shop-cancelled`, `on-order-cant-supply`.
- **`on-email-ready`** (block 46, Email and text frame) — no other situations.
- **`on-orders`** (block 3, Table with search and filters) — 5 situations: `on-orders-ready`, `on-orders-arrived`, `on-orders-sold-at-till`, `on-orders-second`, `ws-shopify-order`; plus 1 written line.
- **`on-order-staff`** (block 4, Detail page) — 2 situations: `on-order-staff-ready`, `on-not-ready`.
- **`on-cant-supply`** (block 9, Form box) — 1 situation: `on-cancel-refund`.
- **`on-settings`** (block 1, Settings page) — 4 situations: `on-settings-order-in`, `on-settings-show`, `on-settings-pay`, `on-settings-keep`.
- Added to the `wb-product` board (built in WP-6.2) — 8 situations: `on-product`, `on-product-added`, `on-product-two-shops`, `on-product-order-in`, `on-product-out`, `on-product-out-other`, `on-product-no-shop`, `on-product-off`.
- Added to the `wb-choose-shop` board (built in WP-6.2) — 1 situation: `on-choose-shop`.
- Added to the `till-collect` board (built in WP-3.1) — 1 situation: `on-hand-over-refunded`.
- Added to the `op-today` board (built in WP-1.10) — 2 situations: `on-today`, `on-today-uncollected`.
- Added to the `set-msg-list` board (built in WP-1.8) — 1 situation: `on-messages`.
<!-- /screens -->

### Stage 7 — Cycle to Work

- **WP-7.1 Cycle to Work** (journey 6): settings; the list by stage; the
  order page; quote document; ordering rule; hand-over and payment at the
  till; marking paid and the Owed list; Today lines; messages; the
  customer's view; held bikes. It also adds the Cycle to Work situations to
  boards built earlier (the till, the customer page, Today, reports).

<!-- screens 7.1 -->
*Building blocks built here:* none new.
*Reused, already built:* 1 Settings page (WP-1.3); 3 Table with search and filters (WP-2.1); 4 Detail page (WP-2.1); 5 Report page (WP-3.4); 8 "Are you sure?" box (WP-3.1); 9 Form box (WP-1.3); 21 Pick-one box (WP-3.1); 37 Customer job page (WP-4.2); 41 Receipt and printed documents (WP-4.3); 46 Email and text frame (WP-6.3).

*Screens it builds (20) and the situations it covers:*

- **`cw-list`** (block 3, Table with search and filters) — 5 situations: `cw-list-owner`, `cw-first-use`, `cw-ordered`, `cw-list-hold-ended`, `cw-list-deposit-refund`.
- **`cw-new`** (block 9, Form box) — 1 situation: `cw-new-not-in-stock`; plus 1 written line.
- **`cw-quote`** (block 41, Receipt and printed documents) — 2 situations: `cw-quote-deposit`, `cw-quote-revised`.
- **`cw-order-held`** (block 4, Detail page) — 13 situations: `cw-order-applied`, `cw-order-deposit`, `cw-order-deposit-paid`, `cw-order-deposit-counted`, `cw-order-on-order`, `cw-order-deposit-refund`, `cw-order-get-ready`, `cw-marked-ready`, `cw-order-ready`, `cw-order-owed`, `cw-order-part-paid`, `cw-order-paid`, `cw-more`; plus 2 written lines.
- **`cw-hold-ending`** (block 9, Form box) — no other situations.
- **`cw-applied`** (block 9, Form box) — no other situations.
- **`cw-order-anyway`** (block 8, "Are you sure?" box) — no other situations.
- **`cw-certificate`** (block 9, Form box) — 4 situations: `cw-certificate-diff`, `cw-certificate-more`, `cw-certificate-late`, `cw-certificate-released`.
- **`cw-certificate-match`** (block 9, Form box) — no other situations.
- **`cw-hand-over`** (block 9, Form box) — no other situations.
- **`cw-owed`** (block 3, Table with search and filters) — 1 situation: `cw-owed-reports`.
- **`cw-owed-provider`** (block 3, Table with search and filters) — no other situations; plus 1 written line.
- **`cw-record-payment`** (block 9, Form box) — 3 situations: `cw-mark-paid`, `cw-mark-paid-diff`, `cw-record-payment-more`.
- **`cw-cancel`** (block 8, "Are you sure?" box) — 2 situations: `cw-cancel-ordered`, `cw-cancel-ordered-deposit`; plus 1 written line.
- **`cw-customer-view`** (block 37, Customer job page) — 2 situations: `cw-customer-released`, `cw-customer-cancelled`; plus 4 written lines.
- **`cw-email`** (block 46, Email and text frame) — 4 situations: `cw-email-certificate-revised`, `cw-texts-certificate`, `cw-texts-hold`, `cw-texts-cancelled`.
- **`cw-settings`** (block 1, Settings page) — 1 situation: `cw-settings-deposit`.
- **`cw-settings-provider`** (block 9, Form box) — no other situations.
- **`till-c2w-pick`** (block 21, Pick-one box) — no other situations.
- **`rp-c2w`** (block 5, Report page) — no other situations.
- Added to the `op-today` board (built in WP-1.10) — 3 situations: `cw-today`, `cw-today-held`, `op-today-c2w`.
- Added to the `set-msg-list` board (built in WP-1.8) — 1 situation: `cw-messages`.
- Added to the `ac-account` board (built in WP-4.5) — 2 situations: `ac-account-c2w`, `ac-account-c2w-collected`.
- Added to the `till-sale` board (built in WP-3.1) — 2 situations: `till-c2w`, `till-c2w-deposit`.
- Added to the `till-pay` board (built in WP-3.1) — 2 situations: `till-c2w-pay`, `till-c2w-extra`.
- Added to the `till-receipt` board (built in WP-3.1) — 2 situations: `till-c2w-paid-cert`, `till-c2w-paid`.
- Added to the `rs-receive` board (built in WP-2.3) — 2 situations: `rs-receive-c2w`, `rs-frame-c2w`.
- Added to the `rs-delivery` board (built in WP-2.3) — 1 situation: `rs-booked-c2w`.
- Added to the `cs-page` board (built in WP-3.2) — 2 situations: `cs-page-c2w`, `cs-page-c2w-collected`.
- Added to the `till-search` board (built in WP-1.11) — 1 situation: `cs-search-c2w`.
- Added to the `rp-accounts-connect` board (built in WP-5.3) — 1 situation: `rp-accounts-c2w`.
- `cw-today-choose` is the same drawing as `op-today-c2w`, so it adds nothing of its own.
<!-- /screens -->

### Stage 8 — The move, the switch-over and the trading week

- **WP-8.1 Citrus Lime import, second half** (journey 9, pieces 5–11):
  weekly refresh; the move page; the weekly check; the switch-over
  checklist; switch-over morning; the first week. At switch-over it brings
  across what is still owed or held: account balances and credit limits
  (Customer Accounts with Balances), gift vouchers still to spend, open
  orders and their deposits (open workshop jobs among them, to confirm), and
  open purchase orders. The weekly refresh brings in last week's sales from
  Who Bought What and Tender Detail, so Wheelhouse has its own four figures
  (sales total, number of sales, stock value, number of customers); the
  owner types Citrus Lime's figures, as decision 5 says. The customer count
  only matches once every customer has come across, so Citrus Lime's full
  export comes before the weekly check can pass. The workshop job history
  and its notes can't be exported from the screens either: they come from
  that full export, a way for programs to read Citrus Lime's data (an API)
  if they offer one, or, only if Jack decides to and after checking their
  terms and data-protection rules, copying the screens, with the copy kept
  by Jack and never in the repo (#136). While running alongside, the tills
  wait for switch-over day (Moving from Citrus Lime, later change, walk-through 4 H2).
  Practice mode is dropped (see "Later").

<!-- screens 8.1 -->
*Building blocks built here:* none new.
*Reused, already built:* 21 Pick-one box (WP-3.1); 25 Quick-look box (WP-4.1).

*Screens it builds (4) and the situations it covers:*

- **`mv-change-day`** (block 21, Pick-one box) — no other situations.
- **`mv-both`** (block 25, Quick-look box) — no other situations.
- **`mv-weeks`** (block 21, Pick-one box) — no other situations.
- **`mv-pick-day`** (block 21, Pick-one box) — no other situations.
- Added to the `set-msg-list` board (built in WP-1.8) — 1 situation: `set-msg-alongside`.
- Added to the `op-today` board (built in WP-1.10) — 1 situation: `mv-today-refresh`.
- Added to the `mv-start` board (built in WP-2.4) — 8 situations: `mv-alongside`, `mv-check`, `mv-check-result`, `mv-ready`, `mv-ready-all`, `mv-morning`, `mv-week`, `mv-week-done`; plus 5 written lines.
<!-- /screens -->

- **WP-8.2 Run alongside** on the refreshed copy of the shop's data, piece
  by piece, as the programme spec §2 describes.

<!-- screens 8.2 -->
*Building blocks built here:* none new.

*Screens:* none of its own on the one canvas; the screens that show this work come in later packages.
<!-- /screens -->

- **WP-8.3 Switch-over and one trading week alone.** Needs every row of §5
  real, not a stand-in.

<!-- screens 8.3 -->
*Building blocks built here:* none new.

*Screens:* none of its own on the one canvas; the screens that show this work come in later packages.
<!-- /screens -->

### After the trading week (not in this plan's order)

- Lightspeed shops (journey 21) (Jack, Q5). Every Lightspeed situation line
  on the one canvas is tagged "after the trading week" where it sits
  (Lightspeed shops, later change, walk-through 6 M4), and its edge cases wait
  until it is built (second walk, answer 7). Its screens and situations:

<!-- screens AFTER-LS -->
*Building blocks built here:* none new.
*Reused, already built:* 1 Settings page (WP-1.3); 7 Step-by-step checklist (WP-3.4); 9 Form box (WP-1.3); 17 Search with grouped results (WP-1.11); 21 Pick-one box (WP-3.1); 24 Stage strip and its next-step box (WP-2.4).

*Screens it builds (8) and the situations it covers:*

- **`ls-connect-signin`** (block 7, Step-by-step checklist) — 3 situations: `ls-connect-shops`, `ls-connect-shops-two`, `ls-connect-checks`.
- **`ls-settings-on`** (block 1, Settings page) — 4 situations: `ls-settings-off`, `ls-settings-manager`, `ls-disconnect`, `ls-reconnect`.
- **`ls-book-in`** (block 21, Pick-one box) — 1 situation: `ls-customer-pick`; plus 1 written line.
- **`ls-part-search`** (block 17, Search with grouped results) — 1 situation: `ls-part-search-down`.
- **`ls-job-sent`** (block 24, Stage strip and its next-step box) — 13 situations: `ls-job-not-connected`, `ls-job-changed`, `ls-job-price-changed`, `ls-job-price-asked`, `ls-job-cancelled`, `ls-job-pick`, `ls-job-waiting`, `ls-job-unsure`, `ls-job-ready-no-wo`, `ls-job-unpaid`, `ls-job-paid`, `ls-job-fallback`, `ls-job-collected-unpaid`; plus 5 written lines.
- **`ls-job-check`** (block 9, Form box) — 1 situation: `ls-hand-over-no-wo`; plus 1 written line.
- **`ls-hand-over-unpaid`** (block 9, Form box) — 3 situations: `ls-hand-over-found`, `ls-hand-over-unreachable`, `ls-hand-over-unchecked`.
- **`ls-job-sorted`** (block 9, Form box) — no other situations.
- Added to the `bk-page` board (built in WP-4.2) — 1 situation: `bk-page-ls`.
- Added to the `bk-cancel` board (built in WP-4.4) — 1 situation: `bk-cancel-ls`.
- Added to the `dq-quote` board (built in WP-4.2) — 3 situations: `dq-quote-ls`, `dq-quote-price-ls`, `dq-answered-price-no-ls`.
- Added to the `cp-summary` board (built in WP-4.3) — 2 situations: `cp-summary-ls`, `cp-summary-ls-paid`.
- Added to the `op-today` board (built in WP-1.10) — 5 situations: `op-today-staff-lightspeed`, `ls-today`, `ls-today-down`, `ls-today-person`, `ls-today-unpaid`.
- Added to the `cs-page` board (built in WP-3.2) — 1 situation: `ls-customer-page`.
- Added to the `set-msg-list` board (built in WP-1.8) — 1 situation: `ls-messages`.
- Added to the `ops-log` board (built in WP-5.4) — 1 situation: `ls-office-data`.
- Added to the `set-workshop-services` board (built in WP-5.1) — 1 situation: `ls-workshop-settings`.
- Added to the `job-overview` board (built in WP-4.1) — plus 1 written line.
- Added to the `site` board (built in WP-6.2) — plus 1 written line.
- `ls-customer-ready` is the same drawing as `cp-summary-ls`, so it adds nothing of its own.
<!-- /screens -->

- The three journey 13 supplier screens (held by Jack: "I dont want to build
  in browsing things from the suppliers").
<!-- later AFTER-suppliers -->
  Screens not built (3): `po-suppliers`, `po-feed`, `po-send`.
<!-- /later -->
- The programme spec's extras not already in journey 7: stock suggestions.

### Later, not in Release 2's first build

Moved out by Jack's answers to issue #116 on 3 Oct. Each is recorded as a
dated "Later change (3 Oct 2026, issue #116 question …)" note in the
decision file named. Later means built after the rest of Release 2, not
dropped, except practice mode.

- **Supplier invoice check** (was in WP-2.3), with its Settings › Stockroom
  switch. Follows Receiving stock and purchase orders, later change (issue
  #116 question 6), and Reports and accounts, later change (question 6):
  until it is built, the VAT report's "Stock purchases" box points to the
  accounts software instead of giving a figure. Meanwhile a booked-in
  delivery's line cost can be changed (Receiving stock, later change,
  walk-through 3 M3).
<!-- later LATER-invoice -->
  Screens not built (8): `rs-invoice`, `rs-invoice-checked`, `rs-invoice-diff`, `rs-invoice-cost`, `rs-invoice-queried`, `rs-invoice-accepted`, `rs-invoice-setting`, `rp-vat-check-off`.
<!-- /later -->
- **Oversight extras** (was in WP-5.4): alerts on Today, signed-in devices
  and "Sign out everywhere", Send feedback, and the first sign-in note with
  "What Wheelhouse records about you". Follows Management oversight, later
  change (issue #116 question 5). Still to check before release: whether
  shops must by law tell staff what is recorded about them. Workshop
  computers are seen and stopped beside the tills instead (walk-through 8,
  later change H3), in WP-5.1.
<!-- later LATER-oversight -->
  Screens not built (16): `ops-log-filtered`, `ops-first-note`, `ops-your-settings`, `ops-my-activity`, `ops-today-alerts`, `ops-alert-settings`, `ops-devices`, `ops-devices-signout`, `ops-devices-signed-out`, `ops-person`, `ops-person-everywhere`, `ops-feedback-empty`, `ops-feedback`, `ops-feedback-shot`, `ops-feedback-failed`, `ops-feedback-sent`.
<!-- /later -->
- **The full website editor, theme and extra pages** (was in WP-6.1). The
  first release has a fixed design with editable words and photos, the
  shop's logo and one main colour. Follows Website management, later changes
  (issue #116 question 2, and the shop's colour on the fixed design). Jack:
  "once the rest of it is built then im going to spend a lot of time working
  on the editor".
<!-- later LATER-website -->
  Screens not built (23): `ws-editor-first`, `ws-editor-moving`, `ws-editor`, `ws-editor-section`, `ws-editor-add`, `ws-editor-drag`, `ws-editor-moved`, `ws-editor-removed`, `ws-editor-header`, `ws-editor-on-phone`, `ws-editor-bigger`, `ws-editor-pages-menu`, `ws-editor-saving`, `ws-editor-taken`, `ws-theme`, `ws-theme-contrast`, `ws-theme-publish`, `ws-theme-product`, `ws-theme-fonts`, `ws-pages`, `ws-pages-new`, `ws-page-settings`, `ws-page-returns`.
<!-- /later -->
- **The shop's own web address** (was in WP-6.1). Frozen, as the business
  plan has it (ECOM-03); Wheelhouse sets one up for a shop as a service.
  Follows Website management, later change (issue #116 question 3).
<!-- later LATER-address -->
  Screens not built (6): `ws-address-moving`, `ws-address`, `ws-address-typo`, `ws-address-steps`, `ws-address-waiting`, `ws-address-done`.
<!-- /later -->
- **Dropped: practice mode** (was in WP-8.1). No practice tills, no
  "Practice: not real money" band, no "Clear and go real"; the tills are real
  from the first sale on switch-over day. Follows Moving from Citrus Lime,
  later change (issue #116 question 4). `fr-today-moving` was redrawn as one
  Getting started checklist while moving (3 Oct, third walk, answer 10) and
  is built with Getting started in WP-5.1.
<!-- later DROPPED-practice -->
  Screens not built (7): `mv-practice-checkin`, `mv-practice-sale`, `mv-practice-card`, `mv-practice-job`, `mv-go-real`, `op-today-practice`, `till-checkin-practice`.
<!-- /later -->
- **Dropped: the coverage walks' answers 2 and 5** (were in WP-6.3, WP-6.1
  and WP-3.2). Jack, 4 Oct (`docs/decisions/2026-10-04-coverage-walks.md`,
  all option 1): "Start with every product online, or nothing?" is asked
  once, in the website's set-up, so the Online orders box that asked it and
  the two "answered" situations go; connecting payments turns buying online
  on (Buy online, later change 4 Oct). And one way of saying "can't delete
  yet": every privacy request shows "Still in the way: …" on its row with
  Delete held back, so the "Settle up first" pop-up goes (a line on
  `cs-privacy` says it). Drawn in
  `docs/superpowers/specs/2026-10-04-draw-the-coverage-walks.md`.
<!-- later DROPPED-coverage -->
  Screens not built (4): `on-settings-start`, `on-settings-start-answered`, `ws-start-products-answered`, `cs-privacy-blocked`.
<!-- /later -->

## 7. When a session must stop instead of carrying on

Set out in full in the project's `CLAUDE.md` once Jack has answered the
questions. In short: spending money; creating or connecting a real account
or key; touching real shop data; deleting things; anything that contradicts
a recorded decision; a test that can't be made to pass; a stage check that
finds a broken story it can't fix from the decisions.

## 8. Sources

Three surveys on 3 Oct read every journey's decision file, the generator,
the specs and plans, `.agents/STATUS.md`, `src/`, `public/app.js`, `server/`
and the migrations. The piece lists above come from them; each work package
re-reads its own sources before its spec is written.

The building blocks, screens and situations in each package (issue #116
step 6) come from `docs/design/user-journeys/generator/consolidate/plan.mjs`
and its `j*.mjs` files (`keep`, `into`, `same`, `later` and `lines`), and the
building-blocks list in `docs/design/user-journeys/README.md`. A screen's
situations go with the package that builds what they show, never before the
screen itself; Lightspeed situations go to after the trading week, Cycle to
Work situations to WP-7.1.
