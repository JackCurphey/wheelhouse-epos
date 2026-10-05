# WP-1.4 Shops everywhere — the business and its sites (issue #133)

**Intent.** Before anyone adds tables in stage 1, one page says what belongs
to the whole business and what belongs to each physical shop, how the server
knows which physical shop a request is for, and how every new table proves
one business can't see another's data. Codex finding 7
(`docs/reviews/2026-10-04-release-2-plans-codex-adversarial.md` line 57)
found the plan's "Shops (sites)" mixed the two, the till's stock sync keeps
one stock figure per product, and the separation check reads switches, not
rules.

WP-1.4 is Mark's (split plan §6, "whole, no screens"). This page is what his
contract builds on. Jack's answers on 5 Oct are in
`docs/decisions/2026-10-05-shops-and-sites.md` (**S1–S3**). Anything marked
*(proposed)* has no decision behind it: Mark confirms or changes it in the
contract, and Jack can overrule it.

## 1. Two words, kept apart

- **Business**: the whole company, one row in `shops`. One customer list, one
  website, one set of staff, one VAT number (S3). Nothing ever crosses from
  one business to another: the database enforces it (row-level security on
  `shop_id`, `app.current_shop_id`, `runWithShop`).
- **Site**: one physical shop inside a business, one row in `sites` (Bolton,
  [Second site]). Keeping sites apart is a matter of who works where, not
  security between businesses: owners and "All shops" legitimately read
  across them. The server enforces it in code (§3).

**The naming trap.** In the code, "shop" means the business (`shops`,
`shop_id`, `:shopSlug`). On screen, "shop" means a site ("Switch shop"), and
"Sites" appears only in Settings (Multiple sites, M12). Older decisions
written before 1 Oct say "each shop chooses" when there was only one, so
they meant both. From here on, plans and specs say **business** and
**site**; screens keep "shop". The code keeps `shop_id` for the business
*(proposed: renaming 46 tables isn't worth it)*.

## 2. What belongs to the business, and what to each site

| Thing | Belongs to | Source |
|---|---|---|
| Customers, their bikes and history (each line says which site) | Business | Multiple sites 2; walk-through 7 L3 |
| Products | Business | Multiple sites 2 |
| Prices; services and their prices | Business, with "only at this shop" for one site | Multiple sites 2, 3 |
| Staff, their role and switches | Business (one role across all their sites) | Multiple sites 2, 4 |
| Which sites a person works at ("Works at") | Each person, a list of sites | Multiple sites 4; WP-1.1 spec §3 |
| A mechanic's working days | Each person, per site | Multiple sites 4 |
| Message wording | Business; each message names its site | Multiple sites 2; walk-through 7 M6 |
| Stock counts and stock movements | Site | Release 2 rule 3; Multiple sites 2 |
| Moving stock between shops | Site to site | Stock control 8 |
| Purchase orders and deliveries | Site the delivery arrives at | *(proposed)* |
| Suppliers | Business | *(proposed)* |
| Tills, receipts (code carries the site letter) | Site; a till always sells for its own site | Multiple sites 9; foundations spec |
| Workshop computers | Site, fixed like a till | *(proposed)* |
| Cash-up and closing the day | Site | Multiple sites 2 |
| Address, phone, opening hours | Site | Multiple sites 2, 7 |
| Workshop diary, its capacity and time off | Site | Multiple sites 2 |
| Workshop jobs and quotes | Site of the workshop doing the job; collected and paid there | Multiple sites 12; second walk 9c |
| Job numbers (WH-1042) | Business, one run | S2 |
| Online booking | One booking page for the business, starting "Which shop?" | Multiple sites 5 |
| Website, Shopify, the website's stock rule | Business | Buy online 2; Website management 9 |
| Shown to customers | Each site ("Show [Second site] to customers") | Multiple sites, later change |
| Gift cards, store credit, customer accounts | Business: spend or pay at any site | *(proposed)* |
| Customer groups, Cycle to Work providers | Business | *(proposed)* |
| Label printers and print agents | Site | *(proposed)* |
| Reports, Today, the activity log | Chosen site, or "All shops" | Multiple sites 1, 6, 8; Management oversight 1 |
| Xero or QuickBooks | One summary per site per closed day; one company (S3) | Reports 4 |
| VAT | One VAT number and return for the business | S3 |
| Time zone | Business *(proposed; the app keeps one today)* | — |

**Settings (S1).**

| Per site | Business-wide |
|---|---|
| Address, phone, opening hours (Multiple sites 2) | Blind cash count (Cash-up 2) |
| Storage slots and their list (Workshop day 27) | What a diary block shows (Workshop day 17, 33) |
| Online booking: exact times or drop-off, the drop-off window, notice (Booking mode 1, 2) | Showing prices online (Booking mode) |
| When "Close the day" appears (Owner setup 18) | Trust PIN (Roles and switches 3) |
| Where "Take payment" goes (Workshop day 1) | Everything else in Settings (Multiple sites 2, "most settings") |

Owners always see every site; a Manager or anyone with "Give everything"
works at one site at least *(proposed)*.

## 3. How the server knows the site

Today the server finds the business on every request (the staff session, the
URL's shop slug for tills and customer pages, the business id for Shopify).
It knows a site only on till requests, from the till's own row.

*(proposed)*:

1. **Signed in (phone, laptop, office computer):** the chosen site is kept
   on the session; "Switch shop" changes it. Empty means "All shops". Every
   request checks it against the person's "Works at" list, so an old or
   made-up value is refused.
2. **Till:** its own site, always (already true). The session's choice never
   overrides it.
3. **Workshop computer:** its own site, fixed when the Owner makes it one.
4. **Customer pages and the website:** the business from the shop slug, as
   today; the site from "Which shop?" or the remembered shop, sent with the
   request and checked as one shown to customers. A hidden site answers like
   an unknown one.
5. **Background work** (reminders, Shopify, the accounts link): each job
   names its business and site; nothing reads a "current" site.
6. **Every route declares its site rule** next to its WP-1.1 role guard:
   one site, one site or "All shops", or none (business-wide). The route-list
   test (#150) requires every route to declare one.

**"All shops"** means every site the person works at (the Owner: all).
Overview pages (Today, reports, stock lists, the activity log) accept it and
say which site each line is from. Pages that only make sense for one site
(the till, the diary, cash-up, receiving, a new job) refuse it, and the
screen asks "Which shop?" (Multiple sites 1).

## 4. What WP-1.4 changes in the code

What the code has today, and what WP-1.4 does about it:

- `sites` holds only a name and a code, and a new business gets no site.
  WP-1.4 gives every existing business a first site (the per-business
  backfill pattern Codex names), makes signing up create one, and moves
  address, phone, opening hours and the per-site settings in S1 off
  `workshop_settings` (one row per business today) onto the site.
- Only `tills` and `till_sales` carry a `site_id`. WP-1.4 adds one to stock
  movements, workshop jobs, capacity holds, time off, purchase orders and
  cash-up, and a per-site list of who works where, with each mechanic's days
  there *(proposed: a `staff_sites` table)*.
- The till's sync takes stock off one figure per product
  (`server/till/sync.js`). Stock per site is WP-1.5's, built on WP-1.4's
  site column.

## 5. The test rule for every new table

This rule is also in the split plan, §4.2 rule 6, where every migration
author looks before adding a table.

Every migration that adds a table, or a column that points at another
table, ships with isolation tests in the same pull request, each watched
failing first:

1. **Across businesses** (every table with `shop_id`): as business B, a row
   made by business A can't be read, listed, changed or deleted, through the
   route and directly under `runWithShop`; and B can't make a row that points
   at one of A's rows. Database references don't check row-level security
   *(to confirm against the Postgres docs)*, so this is checked in code or
   with a key that includes `shop_id`, as `POST /api/tills` does today.
2. **Across sites** (every table with `site_id`): someone who doesn't work at
   a site can't read or change its rows through any route; "All shops"
   returns only their sites; a till or workshop computer writes only its own
   site's rows.
3. **Background work** on the table runs for one business at a time and is
   tested with two businesses' data present.

A table without `shop_id` says why in its migration (registry tables only).
To watch each test fail: loosen the rule (`USING (true)`) or remove the site
filter, see it fail, put it back.

**The separation check gets stronger** *(proposed, WP-1.4)*.
`scripts/ci/assert-rls-coverage.mjs` today only checks that row-level
security is switched on for tables with a `shop_id` column. It also needs
to fail when a policy doesn't compare `shop_id` with
`app.current_shop_id` in both its read and write halves, and when a table
has neither `shop_id` nor a listed reason.
