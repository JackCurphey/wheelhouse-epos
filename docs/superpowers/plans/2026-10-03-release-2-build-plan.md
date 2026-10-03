# Release 2 build plan — from here to the trading week

**Date:** 3 October 2026
**Status:** draft, waiting for Jack's answers on
`docs/decisions/2026-10-03-build-plan-questions.md`
**Kind:** programme plan. It puts every remaining piece of Release 2 in order,
so a session can pick up the next piece without asking. It sits under the
programme spec `docs/superpowers/specs/2026-09-27-release-2-design.md`, which
still sets the goal, scope and finish line, and it does not change them.

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
- Built in the new app: the Soft sand look, the staff frame, the diary and
  job page (Workshop day, mostly), quotes stages 1–3, the customer booking
  pages from Release 1. Open: #110 (teal "Waiting for the customer"), #111
  (till piece 1), #112 (diary extras), #114 (walk-through 8 decisions).
- Roughly 10–15% of the journeys are built. About 240 pull requests remain
  (counted from three surveys of the decision files and code on 3 Oct, at
  250–600 changed lines each). At 3 Oct's pace that is about 20 long
  sessions; foundations will be slower than screens.

## 4. How every piece is built (the loop)

Each work package below is built the same way, without stopping for Jack
unless a rule in the project's `CLAUDE.md` says to stop.

1. **Read** the journey's decision file(s), its screens in the generator
   (`docs/design/user-journeys/generator/`, screen ids in `journeys.mjs`),
   and any walk-through decisions that touch it.
2. **Short spec**, as a section in a spec file in `docs/superpowers/specs/`
   (the way `2026-10-03-staff-diary-view-design.md` holds pieces 1–6): what
   the piece builds, which screen ids, which decisions, what's left out.
3. **Tests first**, each watched failing for the right reason.
4. **Build** to the drawings. Where a drawing is silent, follow the closest
   pattern already built, and log it in `docs/decisions/decided-while-building.md`
   ("Decided here, for Jack to overrule") — never stop to ask.
5. **Review** by a fresh reviewer (a subagent that didn't write the code)
   against the spec and the drawings.
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
| Card machine | staff key the amount in (already in #111) | Jack: which provider (Q8) |
| Online payments (PAY-05) | fake provider with test outcomes | Jack and Mark (Q9) |
| Email sending | an outbox kept in the database, viewable in the app | Mark: an email service account (Q10) |
| Staff sign-in service (WorkOS) | today's sign-in behind `use-session.ts`, and the plan's fake | Mark: WorkOS account (Q10) |
| Text messages (Twilio) | already real; fake in tests | keys exist in Jack's set-up |
| Xero and QuickBooks | spreadsheet downloads first, then a fake connector | developer accounts (Q10) |
| Citrus Lime import | a guessed spreadsheet format | Jack's real export files (Q4) |
| Lightspeed | fake Lightspeed server | a test account (Q5) |
| Receipt and label printers | browser print; the existing print agent | — |

## 6. The order

Stages run in order. Inside a stage, work packages run in the order listed
unless marked as able to run alongside. Each line under a work package is
roughly one pull request. Journey numbers refer to the decision files in
`docs/decisions/`.

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

Everything later stands on these. Order matters: roles first.

- **WP-1.1 Roles and switches** (Signing in; Owner setup 8–11). Four roles
  (Owner, Manager, Staff, Mechanic) and the eight switches on the server;
  `/api/auth/me` returns them; every route checks them; the sidebar shows
  each role its rooms; a mechanic lands on the Diary; a login linked to its
  staff member (the mechanic's "Me").
- **WP-1.2 Settings store, change record and activity log** (Owner setup 4;
  Management oversight 1). One place for shop settings; every change kept
  with who, when and the old value, with Undo; one activity record that
  every later piece writes to.
- **WP-1.3 The Settings frame** (Owner setup; Receiving decision 7): four
  room pages, Jump-to rows, folding sections, "Saved · Undo", failed save,
  the phone room list. Later pieces fill its rooms.
- **WP-1.4 Shops (sites) everywhere** (Multiple sites 1–2). The current shop
  on the session and every request; a shop on stock, jobs, diary, capacity
  and cash-up; address, phone and hours per shop.
- **WP-1.5 Products, stock, sizes and colours, in pence** (Stock control 4,
  10; programme rule 3). Stock per shop; sizes and colours with their own
  barcodes; a category tree with details; every stock movement with who,
  why, shop and cause.
- **WP-1.6 One sales record in pence with VAT per line** (offline spec;
  offline plan 2). Move the till from the old sales tables onto the offline
  core (`till_sales`): the till's own numbers, sending through sync, the
  in-browser copy and send queue, offline PIN check.
- **WP-1.7 Sign-in and PINs** (Signing in; walk-through 8 decisions 1, 3).
  Sign-in screens in the new app; Wheelhouse picks each PIN, people change
  their own, a manager clears one; setting up a till; the PIN-only check-in;
  the shared workshop computer ("Working: [name] · Switch", back to the PIN
  screen when idle); WorkOS for staff and emailed codes for customers,
  against the fake until the account exists.
- **WP-1.8 Messages engine and email** (Owner setup Messages; journeys 3, 4,
  5, 7). Message wording kept per shop with tap-in placeholders, sent by the
  customer's chosen way (text or email), a short Undo before sending, and a
  scheduler for reminders. Email through the outbox stand-in.
- **WP-1.9 Live updates** (walk-through 8 decision 2). Changes on one device
  show on the others within seconds; "who else has this open".
- **WP-1.10 Needs attention and the Today page skeleton** (Opening the shop;
  used by 8, 9, 13, 14, 17, 18, 19, 20). One model for things that need
  attention, with Seen; Today's Who's in and Workshop today.
- **WP-1.11 Small shared parts:** spreadsheet download (programme rule 5);
  printing receipts and bike tags through the print agent; header search
  across customers, jobs, products and orders; Your settings with the
  Accessibility switches kept per person; the online payments adapter with
  its fake provider.

### Stage 2 — Products and stock

- **WP-2.1 Stock control** (journey 14): stock list with one search and
  filters; product page; size and colour grid; bike frame numbers; adjust
  stock with reasons; bulk price change with Undo; categories in Settings.
- **WP-2.2 Stock take** (journey 14): start a count, count on a phone,
  several counters, differences, recount, apply with Undo; below-zero on
  Today; sending stock to another shop.
- **WP-2.3 Deliveries and purchase orders** (journey 13): the Deliveries
  page; receive a delivery by scanning; add an unknown product; frame
  numbers; book in (holding stock for a waiting job, "Part arrived" on the
  diary); problem lines and returns; labels; invoice check; purchase orders;
  the restock list.
- **WP-2.4 Citrus Lime import, first half** (journey 9, pieces 1–4): upload,
  products and stock, customers and bikes, rows that need a look. Built on
  the guessed format; matched to the real files when Jack has them (Q4).
  Runs alongside WP-2.1–2.3.

### Stage 3 — The till and the shop day

- **WP-3.1 The till, complete** (journey 11): customer on a sale with the
  group discount; discounts with reasons and line notes; quick-button
  groups; parked sales; receipts (print, email, text link, receipt page);
  past sales and voids; refunds; store credit and gift cards; customer
  accounts; paying for a workshop job with collection recorded; the offline
  screens.
- **WP-3.2 Customers** (journey 15): customers page with duplicates caught;
  the customer page with one history; bike warranty; store credit and
  account statements; customer groups; merging; privacy requests.
- **WP-3.3 Opening the shop** (journey 10): float check; the note-and-coin
  counter; Today's money side.
- **WP-3.4 End-of-day cash-up** (journey 16): Close the day in six steps;
  the count; paid-outs and banking; card check; end-of-day report; reopen.

### Stage 4 — The workshop and the customer's repair

- **WP-4.1 Workshop day, the rest** (journey 12; walk-through 8): Overview
  page; request pop-up (mechanic pills, offer another time, decline with a
  message); new job extras; storage slots; bike tag at book-in; full service
  checklist; done ticks and notes per line; diary settings; "I'll do this";
  "Who did what"; mechanic sign-off (Q3); "Use my phone" photo.
- **WP-4.2 Quotes, the rest** (journey 4): the customer's job page with its
  tracker; notes for the shop; photo per line; "Goes with"; reminders;
  spending limit; deposit on the quote.
- **WP-4.3 Collect and pay** (journey 5): the customer's ready page; "Bike
  ready" sent on Mark ready; pay now online; receipts; the uncollected
  reminder; collection settings.
- **WP-4.4 Book a repair, rebuilt** (journey 3): change and cancel (d6);
  the one-page booking with steps; the two-week day strip; a saved draft;
  "Which shop?"; signed-in prefill; online-booking settings; auto-confirm;
  deposits; offered times; booking messages.
- **WP-4.5 Account, history and reminders** (journey 7): emailed-code
  sign-in on the website; the account page; receipts in history;
  conversations and the staff Messages inbox; consent and "Stop these";
  service reminders; review requests; Your data.

### Stage 5 — The office

- **WP-5.1 Owner setup, the rooms** (journey 8): Till, Payments and End of
  day; Staff and roles with invites; Workshop settings; Messages; Shop and
  sites; Your data; the Getting started checklist.
- **WP-5.2 Multiple sites, the screens** (journey 19): shop switcher and
  "All shops"; works-at with days per shop; prices and services per shop;
  adding a shop; tills by shop; Today across shops; booking at the other
  shop's workshop.
- **WP-5.3 Reports and accounts** (journey 17): the reporting layer;
  reports home; sales with graphs; saved reports; takings and cash-ups; VAT;
  margin and stock value; workshop; discounts and refunds; the Xero and
  QuickBooks link (Q10); "All shops".
- **WP-5.4 Management oversight** (journey 20): the activity log screen;
  what Wheelhouse records about you; alerts on Today; signed-in devices and
  signing out; checking a person out of a till; send feedback.

### Stage 6 — The website

- **WP-6.1 Website management** (journey 18): website model with drafts and
  publishing; the editor; sections; theme; pages; tracking tools; the web
  address; online payments setup; Shopify in the new frame.
- **WP-6.2 Find the shop and browse** (journey 1): the website shell; home;
  shop and category pages with filters; product page; search; Our shops;
  cookies.
- **WP-6.3 Buy online and click and collect** (journey 2): basket;
  checkout; paying; confirmation; the customer's order page; staff Online
  orders; hand-over at the till; reminders; gift cards and store credit
  online; order messages.

### Stage 7 — Cycle to Work

- **WP-7.1 Cycle to Work** (journey 6): settings; the list by stage; the
  order page; quote document; ordering rule; hand-over and payment at the
  till; marking paid and the Owed list; Today lines; messages; the
  customer's view; held bikes.

### Stage 8 — The move, the switch-over and the trading week

- **WP-8.1 Citrus Lime import, second half** (journey 9, pieces 5–11):
  weekly refresh; the move page; the weekly check; practice mode; the
  switch-over checklist; switch-over morning; workshop-job import if Citrus
  Lime exports jobs.
- **WP-8.2 Run alongside** on the refreshed copy of the shop's data, piece
  by piece, as the programme spec §2 describes.
- **WP-8.3 Switch-over and one trading week alone.** Needs every row of §5
  real, not a stand-in.

### After the trading week (not in this plan's order)

- Lightspeed shops (journey 21), unless Jack says otherwise (Q5).
- The three journey 13 supplier screens (held by Jack: "I dont want to build
  in browsing things from the suppliers").
- The programme spec's extras not already in journey 7: stock suggestions.

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
