# Design

## Context

Nothing of Cycle to Work is built. The sidebar link is already there
(`src/staff/nav.ts`, key `c2w`, route `/workshop/c2w` in
`src/staff/routes.ts`), and `tests/screens/staff-shell.test.js` expects it.
Everything this piece needs to build on is built, except four pieces that
belong to other work: roles (WP-1.1), the activity log (WP-1.2), Mark's till
deposit for orders, and the accounts link and Margin report (WP-5.3 parts).
The proposal's table says what each holds up.

Example data in tests and fixtures comes from the drawings only: North
Street Cycles, Bolton, "[Second site]", Jack Lewis (Owner), Jo Taylor
(Staff), Maya Patel (customer). Providers, bikes, prices, dates, and
quote, certificate and frame numbers stay bracketed (`[Provider]`, `[£]`,
`[quote number]`), or are made up visibly as test values in the test file
only, never shown as real.

## Goals / Non-Goals

**Goals:** the six-stage order from quote to "Paid by the provider";
holding and ordering bikes; the hand-over at the till; the provider's money;
messages and the customer's view; settings; Today, search, customer page
and the report. Build first everything that needs none of the missing
pieces.

**Non-Goals:** a connection to any scheme provider; the website's Cycle to
Work page; the Lightspeed version; till offline hand-over before the till
works offline.

## Decisions

### 1. No adapter, because there is no outside service

The brief for this plan asks for outside schemes behind an adapter with a
pretend version. Jack's journey 6 decision is that Wheelhouse "isn't
running a scheme": the shop types in providers and their terms, and types
in each certificate. Nothing is sent to or read from a provider. So there
is nothing to put behind an adapter, and building a pretend one would be
building something no decision asked for. If a provider connection is
ever wanted, it becomes its own change.

### 2. Tables

The next free migration number at build time (the latest on main is 129,
and `website-management` also plans 130, so check before writing).

- `c2w_settings`: one row per shop: `hold_days`, `remind_days`,
  `quote_valid_days`, `order_rule` (`certificate` | `applied` |
  `deposit`), `deposit_kind` (`pounds` | `percent`), `deposit_value`,
  `deposit_on_certificate` (`refund` | `count`), `deposit_on_pull_out`
  (`refund` | `keep`), `how_to_apply`, `today_lines` (on or off),
  `no_certificate_days` and `payment_late_days` (the two `[n]`s in the On
  Today fold), `next_quote_number` (the shop's quote counter).
  The shop's rule for keeping a deposit, printed on the quote, is built
  from `deposit_on_pull_out`. Follows the one-table-per-area pattern of
  `workshop_settings` and `payment_settings`, since the settings store
  (WP-1.2) isn't built.
- `c2w_providers`: `name`, `commission_kind` (`percent` | `pounds`),
  `commission_value`, `pays_in_days`, `accessories_inside` (boolean),
  `handover_note` (one check per line), `retired_at`.
- `c2w_orders`: `customer_id`, `provider_id`, `site_id`, `stage`
  (the six stages, plus `cancelled` and `closed`), `quote_number`,
  `quote_given_at`, `quote_revised_at`, `valid_until`, `hold_until`
  (null when not held or firm), `hold_wanted` (false for "Don't hold this
  one"), `product_id`, `frame_id` (the held frame, nullable),
  `accessories` (lines with product and price), `total_pence`,
  `applied_at`, `application_reference`, `certificate_number`, `certificate_pence`, `certificate_received_on`,
  `difference_choice`, `sale_id`, `collected_at`, `expected_pence`,
  `expected_by`, `paid_pence`, `paid_on`, `provider_reference`,
  `customer_code` (the private link), `close_reason`.
  Money is kept in pence, so this piece doesn't add to the pounds-to-pence
  move (WP-1.6). The customer, provider, product, site, frame and sale
  links all carry the shop (`(id, shop_id)`), so an order can only name its
  own shop's rows; migration 137 adds the `(id, shop_id)` indexes on
  `customers`, `stock_frames` and `sales` this needs.
- `c2w_order_events`: "What's happened": `order_id`, `kind`,
  `employee_id`, `reason`, `detail` (JSON), `created_at`. Only ever
  added to.
- `c2w_payments`: a provider payment that covers one or more orders:
  `provider_id`, `amount_pence`, `received_on`, `reference`; and
  `c2w_payment_orders` linking it to each order with the amount put
  against it.
- `stock_frames`: add `c2w_order_id` (nullable). Holding sets `state =
  'held'` and the link; releasing puts it back to `in_stock`.
- `purchase_order_items`: add `c2w_order_id` (nullable), as
  `workshop_job_id` is today.

Every new table has `shop_id` and row-level security like the rest.

### 3. Quote numbers

Each shop counts its own quotes from 1, with a prefix, in a per-shop
counter row, taken under a row lock so two quotes never share a number.
The drawings show only "[quote number]", so the format is logged as
decided while building (item 1 below).

### 4. Holding

Holding locks the frame row (`FOR UPDATE`) and takes a free `in_stock`
frame of the bike at the order's site. If none is free, the order is
"not in stock" and follows the ordering rule. A hold never ends by itself:
`hold_until` only drives the reminder and the "hold ended — choose" line.
Available stock (till search, the Stock page, the storefront's
`stock_qty`-based sold-out check) counts `in_stock` frames only; for
products without frames the hold is a count on the order and the
available number subtracts held orders (default taken 12 Nov, `docs/decisions/2026-11-12-cycle-to-work-defaults-taken.md`, item 2).

### 5. The hand-over sale

Built on today's sales path, as Mark's till deposit plan does. The till
opens the order (`till-c2w-pick`), which loads the basket from the order.
On `POST /api/sales` with `c2wOrderId`, the server, inside the sale's
transaction and with the order row locked (`server/c2w/hand-over.js`):
- checks the order is at "Ready to collect";
- puts the order's bike and accessories on the sale at their quoted
  prices, ahead of the sale's `items`, which hold only what was added at
  the counter (so they may be empty), and the order's customer;
- works out the provider's share: the certificate, up to the whole order
  (`providerPays`), and never more than the sale comes to once a discount
  is taken off;
- adds the payment line `Cycle to Work · [Provider]` itself, like
  `DEPOSIT_TENDER` in `server/workshop/counted-deposit.js`, refusing a
  sale that claims a different share (`c2w_share`), and refusing that
  payment on any other sale or order;
- takes the ticked checks (`c2wChecks`), each one of the provider's lines
  from Settings, into the event; none ticked is allowed;
- marks the frame sold, moves the order to Collected, sets `sale_id`,
  `collected_at`, `expected_pence` and `expected_by`, and adds the event.

The provider's share is never cash in the drawer: the cash count and close
the day leave that payment kind out of the drawer total. A sale sent twice
counts once, through the existing sale key.

### 6. The provider's money

Mark paid and Record a payment write `c2w_payments` and move each covered
order to "Paid by the provider", or keep it at Collected marked part paid.
A difference is shown, never hidden: "Close with a reason…" closes the
order with the shortfall recorded as a "shortfall closed" event, which the
report counts. All are "Owner only" until WP-1.1.

### 7. Who may do what, until WP-1.1

| Step | Now | After WP-1.1 |
|---|---|---|
| See the list, make quotes, add certificates, hold, release, mark applied, mark ready, hand over | Anyone signed in | Same |
| Cancel with no deposit | Anyone signed in | Same |
| Mark paid, part paid, close with a reason, order now anyway, cancel with a deposit | Owner (`ownerOnly`) | Owner, managers, Staff with "Can close the day" |
| Cost, commission, owed totals (the expected amount for one order goes to everyone, decision H3) | `canSeeCosts` (Owner today) | "Can see costs and margin" |
| Today's Cycle to Work lines | Owner | Owner, managers, "Give everything a Manager can do" |
| Settings | Owner | "Can change settings" |

### 8. The customer's view

`GET /api/portal/c2w-links/:code` follows `/booking-links/:code`: a long
random code, rate limited, nothing returned for a wrong code, and a reply
built from a list of allowed fields (no commission, cost or staff names).
The signed-in account reads the same fields for the customer's own orders.

### 9. Messages

Six keys in `server/messaging/templates.js`, queued with `queueMessage`
(pretend sending, as today), each with the drawn wording. The decision
names four messages; `setup.mjs` lists six. The two extra ("Your bike is
no longer put aside", "Your order is cancelled") would go beyond a recorded
decision, so they wait for Jack (`docs/decisions/2026-11-12-cycle-to-work-defaults-taken.md`, item 3). The four the
decision names are built now; the other two are added only if Jack says so.

### 10. The paid box

`till.mjs` draws the title "Paid" with the line "Cycle to Work ·
[Provider] · receipt [receipt number]". The 3 Oct change said the
certificate-only paid box reads "Paid · Cycle to Work · [Provider]". Jack
chose the drawing on 12 Nov (`docs/decisions/2026-11-12-cycle-to-work-defaults-taken.md`,
item 4), and pull request 7 goes ahead under the risky-area rules.

## Decided while building (to log in your own month file)

1. The quote number format (decision 3).
2. (Moved to the defaults decision file: held stock without frame numbers
   is a count on the order.)
3. The "Paid · last 30 days" group counts back 30 days from today.
4. The sidebar count adds up: holds ending or ended, bikes ready to order,
   deposits to refund, payments late.

## Risks / Trade-offs

- **Money in the till.** A wrong provider share means wrong takings.
  Mitigation: the server sets it, the till never does, and tests try a
  tampered share.
- **Stock.** A held frame sold by mistake leaves a customer without a bike.
  Mitigation: available stock counts `in_stock` frames only, and the till
  warns about a held frame in any sale but its own order's (`till-serial-held`:
  warned, never blocked).
- **The public link.** Mitigation: the existing code-link pattern and an
  allowed-fields list, with tests that a wrong code shows nothing.
- **Mark's work.** Pull request 11 builds on Mark's till deposit. If his
  design changes, only pull request 11 changes.
- **Size.** About 5,000 lines over thirteen pull requests; each stands on
  its own and leaves the app working.

## Order of pull requests

1. Tables and settings (server)
2. Settings screen
3. Orders and quotes (server)
4. List, New order, quote and order page (screens)
5. Holding bikes and stock
6. Certificate, applied and ordering in
7. Hand-over at the till
8. The provider's money and cancelling
9. Messages and the customer's view
10. Today, search, customer page and the report
11. Deposits — waits for Mark's till deposit
12. Roles and the activity log — waits for WP-1.1 and WP-1.2
13. Late items — Xero mapping and margin (WP-5.3 parts), edge cases 6a
    (till offline) and 6d (till refunds)

## Open Questions

Defaults taken and questions still open are in `docs/decisions/2026-11-12-cycle-to-work-defaults-taken.md`:
deposits wait for Mark's till deposit (default); a bike without frame
numbers is held as a count (default). Jack answered the paid box wording
and the two extra messages on 12 Nov: both as drawn.
