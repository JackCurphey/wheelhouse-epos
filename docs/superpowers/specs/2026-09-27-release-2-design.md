# Release 2 — the whole shop, replacing Citrus Lime

**Date:** 27 September 2026
**Status:** design agreed in brainstorm with Jack; awaiting his review of this written spec
**Kind:** programme spec — the map of Release 2. Each piece below gets its own
brainstorm, spec and plan when its turn comes, the way the booking pieces did.

## 1. Goal, finish line, scope

**Goal.** One system that runs an independent UK bike shop end to end — till,
stock, suppliers, customers, workshop, website, reports — built to replace
Citrus Lime, and to beat it on, in Jack's order of importance:

1. easier to use
2. cheaper
3. features Citrus Lime lacks
4. a better workshop
5. we do the move for the shop
6. open data

**First shop.** Jack's shop, which runs on Citrus Lime today and uses its till,
stock, supplier feeds and purchase orders, stock take, workshop, customers,
website, reports, and more than one site.

**Finish line.** Release 2 is ready when Jack's shop has switched Citrus Lime
off and traded for **one full trading week, including a weekend, on Wheelhouse
alone**. Before switch-over day every piece is used alongside Citrus Lime on a
regularly refreshed copy of the shop's real data.

**In scope:** till; products and stock; stock take; suppliers and purchase
orders; customers, loyalty and credit accounts; the Release 1 workshop;
reports; Xero and QuickBooks; a deeply customisable website with click and
collect and online payments; Cycle to Work (Jack's own design, to be explained);
multiple sites; the Citrus Lime import; a till that keeps selling offline.
After switch-over: online service history with rebooking, service reminders,
stock suggestions.

**Out of scope for Release 2:** eBay and Amazon listings.

**Not decided here:** price. The business plan's £49–79 a month
(`docs/decisions/2026-08-31-business-plan.md`) was set before the website and
multiple sites came in; it needs revisiting on its own.

**Release 1 carries on.** Release 1 still ships as a workshop add-on for
Lightspeed shops. Release 2 is built in the same codebase and shares the same
workshop. The Lightspeed connection stays on Release 1's list (it has not been
started: no spec or account yet, per `.agents/STATUS.md`).

## 2. The pieces

Built in this order. Each is built and merged in small parts.

| # | Piece | Covers | Needs first | How the shop uses it before switch-over |
|---|---|---|---|---|
| 1 | Foundations | New front-of-house screens in the modern system; data built for multiple sites and variants; offline groundwork; the Citrus Lime import, re-run on a schedule | — | Sees its real products and customers in Wheelhouse |
| 2 | Products and stock | Serial numbers, transfers between sites, stock take, barcode and shelf labels | 1 | Real stock takes, counts compared with Citrus Lime |
| 3 | Till | Sales, refunds, voids, end-of-day cash-up, VAT, card terminal, receipt printer, offline selling | 1, 2 | Practice sales and staff training; no real money |
| 4 | Customers | Loyalty, credit accounts, history; joined to the Release 1 workshop so a job and a sale share a customer | 1 (full link needs 3) | The workshop, live |
| 5 | Suppliers | Madison, ZyroFisher and Raleigh feeds; purchase orders; receiving stock in | 2 | Browsing feeds, drafting orders |
| 6 | Reports and accounts | Sales, margin, stock reports; Xero and QuickBooks | 3 | Same-period reports compared with Citrus Lime's — also proves the import |
| 7 | Website | Deeply customisable shop sites, click and collect, online payments | 2, 4 | A preview site on real products |
| 8 | Cycle to Work | Jack's own version | 3 (7 for online) | Depends on the design |
| — | **Switch-over, then one trading week alone** | | | |
| 9 | Extras | Service history with rebooking, service reminders, stock suggestions | 4, 6 | — |

The import is the backbone: every piece's run-alongside use depends on it. The
till is the one piece that cannot really run alongside, because real money
cannot be taken in two systems, so it most needs a rehearsal.

**Why run alongside and not build-then-switch.** A Citrus Lime shop's website,
stock and till share one database, so the shop cannot move half over. Building
everything and then switching tests nothing against real use until the end.
Running alongside on imported data tests each piece as it lands and proves the
move itself first.

## 3. Rules for every piece

1. **New screens use the modern system.** Every front-of-house screen is built
   in the React component system the booking screens use (`src/`, the
   `registry/` controls). The old plain-JavaScript screens in `public/app.js`
   (Till, Tender, Inventory, Suppliers, Purchase orders, Sales history,
   Customers, Dashboard) are retired piece by piece, not extended. Existing
   tables (`products`, `stock_movements`, `sales`, `sale_items`,
   `sale_payments`, `customers`, `suppliers`, `purchase_orders` and others) are
   reused where sound, judged per piece.
2. **Jack approves every screen design** before it is built.
3. **Multiple sites and variants from day one.** Every stock record belongs to
   a site; every product can have sizes and colours. Both go into Foundations.
4. **Online first, never down.** The till normally works online, as now. When
   the internet drops it keeps selling and catches up when the connection comes
   back. Jack's shop cannot trade today when its internet or Citrus Lime goes
   down; that is the problem this fixes. How far offline selling reaches (cash
   only, or card too — most card terminals need their own connection to
   approve a payment) is decided in the Foundations brainstorm, but the till
   is designed around it from the start.
5. **Everything can be exported.** Each piece ships an export of its own data.
6. **Websites are customised through a theme system, not free-form code.**
   Shops change layout, sections, colours, fonts and images within a system
   Wheelhouse controls, so deep customisation does not break sites when
   Wheelhouse updates. Detail belongs to piece 7.
7. **Test first, with real data.** Each piece is built test-first and checked
   against the shop's real data (for example a week's sales totals in
   Wheelhouse match Citrus Lime's for the same week).

## 4. Before the pieces start

- **Find out what Citrus Lime lets the shop export** — products, stock,
  customers, sales, workshop jobs, and in what formats. Jack is best placed to
  check, from his shop's Citrus Lime admin. Earlier research found no public
  way to read a shop's data out of Citrus Lime
  (`docs/decisions/2026-09-02-lightspeed-first-platform.md`). If the exports
  are not enough, the run-alongside approach has to be rethought. This is the
  largest risk and the cheapest to check.
- **Choose where Wheelhouse is hosted** (open item PL-1 in `.agents/STATUS.md`).
  Needed before the till takes real money; it bears on how offline selling
  works.

## 5. Decisions taken in this brainstorm (27 Sep 2026)

| Decision | Reason given |
|---|---|
| Release 2 is brainstormed from scratch, not from the feature catalogue | Jack's choice; the goal is replacing Citrus Lime end to end |
| First shop is Jack's own Citrus Lime shop | A real shop gives a concrete finish line and shows what data must come out |
| Website built into Wheelhouse, not run on Shopify | "One system that does everything"; Citrus Lime sites all look alike, so deep customisation is the draw |
| Cycle to Work and the accounts link are in scope | To do more than Citrus Lime and give shops a reason to move |
| Extra features: service history, reminders, stock suggestions | Chosen from a list of ideas; to be checked against Citrus Lime before being claimed as gaps |
| Approach: run alongside, then switch | A shop cannot move half over; this tests every piece on real data as it lands |
| Release 1 and the Lightspeed plan carry on alongside | Two ways into the market; Release 1 can earn while Release 2 is built |
| Till must keep selling offline | Jack's shop cannot trade when the internet drops today |
| Done = one full trading week, including a weekend, on Wheelhouse alone | Jack's choice (a month was also offered, to cover a month-end) |

**Conflicts with the business plan's gates — not yet resolved.**
`docs/decisions/2026-08-31-business-plan.md` §8 freezes storefront, distributor
feeds, offline mode, multi-site and product variants (Track D) "behind G3"
(3 shops paying at a published price), and says only Track A may reorder that
list and "nothing else may unfreeze it". §10's gate G2 (3 shops running the free
workshop on real jobs for 30 days) unlocks anything beyond the closed B2 till
list. Release 2 needs all five frozen items and goes beyond the B2 list before
either gate is met. This spec does not override those gates on its own; the
business plan is shared with Mark, so the change is Jack's and Mark's to
decide and record as a decision.

## 6. Facts and their sources

- Citrus Lime's feature coverage and tiers — Essentials from £105/mo, Growth
  from £339/mo (adds ecommerce), Advanced from £515/mo (adds accounts
  integration): citruslime.com/cycle and citruslime.com/pricing/uk, read
  27 Sep 2026.
- Confirmed supplier feeds: Madison, ZyroFisher, Accell (Raleigh). Shimano and
  Cyclorama **not** confirmed.
- Citrus Lime's cycle page says its till works offline; Jack's shop experiences
  the till stopping when the internet drops. Unresolved which is the case —
  a different setup or tier, or marketing ahead of the product.
- "Closed ecosystem" as a Citrus Lime weakness rests on one Trustpilot review
  and a competitor's blog (push.bike); weak evidence.

## 7. Open, for later pieces

- Cycle to Work: Jack's own design, to be explained before piece 8.
- How far offline selling reaches: piece 1.
- Theme system detail: piece 7.
- Price: separate decision.
- The business plan gates in §5: Jack and Mark to decide.
