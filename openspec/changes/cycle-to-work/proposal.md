WP: WP-7.1

# Proposal

## Why

A shop selling a bike through a Cycle to Work scheme today keeps the order
on paper or in its head: the quote, the bike it has put aside, the
certificate when it arrives, the hand-over, and the money the scheme
provider owes weeks later. Jack's journey 6 review settled that Wheelhouse
doesn't run a scheme; it organises the shop's side of one. This piece
builds that: its own order kind with stages, under Front desk › Cycle to
Work, from the quote to "Paid by the provider".

**Who takes it:** not yet taken. Written overnight on 11–12 Nov 2026 for
whoever picks up the theme that holds WP-7.1; take it in STATUS's "who is
on what" block first.

**Risky areas:** all four.
- Migrations: new Cycle to Work tables.
- Money and stock: the hand-over sale at the till, the provider's payment,
  deposits, and held bikes leaving the stock that can be sold.
- Public routes: the customer's private "See your order" link and their
  account page.
- Messaging: four new messages (two more drawn, waiting for Jack).

So it is a full change at any size: `/review` and `risky-area-reviewer` on
each pull request that touches those parts, and hand-run CI before merging
them.

**Not a small piece:** about 5,000 changed lines, split into thirteen pull
requests (see `tasks.md`). Three wait for other pieces. Of the ten that
need no other piece, pull requests 7 and 8 (the hand-over at the till and
the provider's money) wait for Jack, because money taken at the till is
his to approve; the paid box wording and two extra messages also wait for
him (`docs/decisions/2026-11-12-cycle-to-work-defaults-taken.md`).

## What Changes

- **A Cycle to Work order** with six stages, in the drawn words: Quote
  given → Waiting for the certificate → Certificate received → Ready to
  collect → Collected → Paid by the provider. Each order keeps one growing
  list, "What's happened", of every step, who took it and when.
- **Front desk › Cycle to Work** (`cw-list`): the list grouped by stage,
  the top line of things to act on, the sidebar count, "+ New Cycle to Work
  order", and the first-use page.
- **New order and the quote** (`cw-new`, `cw-quote`): customer, scheme
  provider, bike, accessories; "Hold the bike until [date]"; the quote as a
  printable, emailable document with the shop's own "How to apply" words.
- **The order page** (`cw-order-held` and its 13 situations): Who pays
  what, the next step for its stage, "What's happened", and the More menu.
- **Holding bikes:** a bike in stock is held from the quote for the days
  the shop sets, then firmly from the certificate. A reminder offers Hold
  longer or Release the bike; it is never released without someone
  choosing. A held bike shows as held in Stock and the till search, and as
  sold out on the website.
- **Bikes not in stock:** ordered by the shop's rule (once the certificate
  arrives, once the customer has applied, or straight away with a deposit).
  "Order now anyway…" needs a reason. Ordering makes the supplier order in
  Deliveries; booking the bike in holds its frame and moves the order to
  Ready to collect.
- **The certificate** (`cw-certificate`): number, amount and date; a
  certificate for less or more than the order offers the drawn choices; a
  late one warns "Quote ran out on [date] — check the price."
- **Hand-over at the till** (`cw-hand-over`, `till-c2w-pick`, and the
  till's Cycle to Work situations): the provider's checks as ticks, then
  the till with "Cycle to Work · [Provider]" as the first way to pay, the
  customer paying any difference, and the order moving to Collected.
- **The provider's money:** "Expected: £[£] by [date]"; Mark paid and
  Record a payment (`cw-mark-paid`, `cw-record-payment`), flagging any
  difference; Save as part paid; Close with a reason; the Owed lists
  (`cw-owed`, `cw-owed-provider`); late payments on Today.
- **Cancelling** (`cw-cancel`), with the rule for a held deposit.
- **Messages:** five switchable texts and emails, the quote email, and the
  customer's view (`cw-customer-view`) through a private no-sign-in link and
  their account.
- **Settings › Front desk › Cycle to Work** (`cw-settings`,
  `cw-settings-provider`): holding, ordering, deposits, how to apply, and
  the scheme providers with their terms.
- **Today lines, the customer page row, header search, and the report**
  (`rp-c2w`, "Cycle to Work: owed and paid").

There is no outside scheme to connect. Jack's decision is that Wheelhouse
isn't running a scheme: providers are names and terms the shop types in,
and certificates are typed in by hand. So there is no outside service to
put behind an adapter, and none is built (design, decision 1).

## Capabilities

### New Capabilities
- `cycle-to-work`: Cycle to Work orders, their stages, holding and ordering
  bikes, the quote, the certificate, the provider's money, cancelling,
  the customer's view, and who may take each step.

### Modified Capabilities
- `till`: the Cycle to Work pick, the provider's way to pay, the paid box
  and the receipt; the deposit line (waits, see below).
- `today`: the Cycle to Work lines in Needs attention.
- `stock`: a held bike is not for sale; it shows as held.
- `deliveries`: a supplier order line can be for a Cycle to Work order;
  booking it in holds the frame for that order.
- `messages`: the Cycle to Work messages in the message list.
- `customers`: the customer page row.
- `header-search`: the Cycle to Work orders group.
- `customer-accounts`: the order in the customer's account.
- `reports`: "Cycle to Work: owed and paid".
- `settings`: the Cycle to Work settings room.

## What is already built, and what this piece waits for

Checked against the code on 11 Nov 2026 (main at `d1be22ea`).

| Needed | State | What it blocks | What this change does instead |
|---|---|---|---|
| The till and sales | Built: `POST /api/sales`, `sale_documents`, `server/lib/sales.js`, the pay dialog and receipt. Sales in pence (WP-1.6 step C) is Mark's next. | Nothing now. The offline hand-over (edge case 6a: handed over from the till's own copy, marked To send) waits for the till working offline. | Builds the hand-over on today's sales path, as Mark planned for job deposits ("don't wait for step C"). The server adds the "Cycle to Work · [Provider]" payment itself, the way it adds "Deposit paid online" (`server/workshop/counted-deposit.js`); it never takes the till's word for it. |
| WP-1.1 Roles and switches (Mark) | Not built: only `is_owner`; no manager, no "Can close the day", no "Give everything a Manager can do" | Only who else may take the money steps and see Today's lines (managers, and Staff with those switches) | Money steps and Today's Cycle to Work lines are "Owner only" for now (`server/lib/owner-only.js`); cost and commission use `canSeeCosts` (`server/lib/can-see-costs.js`), which WP-1.1 already plans to widen. Pull request 12 swaps in the switches. |
| WP-1.2 Activity log (Mark) | Not built | Nothing | Each order keeps its own "What's happened" list, with who and why for every money step. Pull request 12 also copies the money steps to the activity log once it exists. |
| Mark's till deposit for orders (branch `mark/till-job-deposit`, 25 Oct, "for Mark's approval; nothing built") | Not approved, not built | Everything about a deposit: "Take the deposit at the till" (`till-c2w-deposit`), `cw-order-applied-deposit`, `-deposit-paid`, `-deposit-counted`, `-deposit-refund`, `cw-quote-deposit`, `cw-list-deposit-refund`, `cw-cancel-ordered-deposit`, `cw-settings-deposit`, and "Deposit to refund · [Customer]" on Today | Pull request 11 waits for it. Until then "Straight away, with a deposit" is not offered in Settings, so no order can need a deposit (question 1 for Jack). |
| Stock frames (`stock_frames`, migration 125) | Built: state `in_stock`, `held` or `sold`; nothing sets `held` yet | Nothing | Holding a bike sets its frame to `held`, linked to the order. |
| Supplier orders (`purchase_orders`, Deliveries) | Built; a line can already point at a workshop job | Nothing | Adds the same kind of link to a Cycle to Work order. |
| Messages (`server/messaging/templates.js`, `engine.js`) | Built, with pretend sending | Nothing | New message keys. |
| Private code links (`server/routes/portal.js`, `/booking-links/:code`) | Built | Nothing | "See your order" follows the same pattern. |
| Today board (`server/routes/today.js`) | Built | Nothing | Adds one Needs attention source. |
| Refunding a sale at the till (WP-3.1) | Check at build time | Edge case 6d: a bike brought back after the provider has paid (refund to the provider, or store credit for the customer, and the order reopens) | Store credit exists (`store_credit_entries`, migration 126). 6d is in pull request 13 and waits until the till can refund a sale. |
| Accounts link (Xero) and the Margin report (WP-5.3 parts) | Not built | `rp-accounts-c2w` (the three Cycle to Work rows in the Xero mapping) and the margin line that takes off the commission | Pull request 13 waits for them. The `rp-c2w` report itself is built now. |

So ten pull requests need none of the missing pieces and can be built
first, in order. The last three wait: deposits (pull request 11, for Mark's
till deposit), roles (pull request 12, for WP-1.1), and the late items
(pull request 13: Xero mapping, margin line, edge cases 6a and 6d).

## Drawings it follows

All in `docs/design/user-journeys/generator/c2w.mjs` unless noted:

- `cw-list` with `cw-list-owner`, `cw-first-use`, `cw-ordered`,
  `cw-list-hold-ended`, `cw-list-deposit-refund`
- `cw-new` with `cw-new-not-in-stock`
- `cw-quote` with `cw-quote-deposit`, `cw-quote-revised`
- `cw-order-held` with `cw-order-applied`, `-deposit`, `-deposit-paid`,
  `-deposit-counted`, `-on-order`, `-deposit-refund`, `-get-ready`,
  `cw-marked-ready`, `cw-order-ready`, `-owed`, `-part-paid`, `-paid`,
  `cw-more`
- `cw-hold-ending`, `cw-applied`, `cw-order-anyway`
- `cw-certificate` with `-diff`, `-more`, `-late`, `-released`;
  `cw-certificate-match`
- `cw-hand-over`
- `cw-owed` with `cw-owed-reports`; `cw-owed-provider`
- `cw-record-payment` with `cw-mark-paid`, `-diff`,
  `cw-record-payment-more`
- `cw-cancel` with `-ordered`, `-ordered-deposit`
- `cw-customer-view` with `-released`, `-cancelled`
- `cw-email` with `cw-email-certificate-revised`, `cw-texts-certificate`,
  `cw-texts-hold`, `cw-texts-cancelled`
- `cw-settings` with `cw-settings-deposit`; `cw-settings-provider`
  (and `settings-frame.mjs`)
- `till-c2w-pick`, and on the till boards (`till.mjs`): `till-c2w`,
  `till-c2w-deposit`, `till-c2w-pay`, `till-c2w-extra`,
  `till-c2w-paid-cert`, `till-c2w-paid`
- `rp-c2w` and `rp-accounts-c2w` (`reports.mjs`)
- On boards built earlier: `cw-today`, `cw-today-held`, `op-today-c2w`
  (`opening.mjs`); `cw-messages` (`setup.mjs`); `ac-account-c2w`,
  `-collected` (`account.mjs`); `rs-receive-c2w`, `rs-frame-c2w`,
  `rs-booked-c2w` (`receiving.mjs`); `cs-page-c2w`, `-collected`
  (`customer.mjs`); `cs-search-c2w`

## Decisions it follows

- Journey 6, Cycle to Work: `docs/decisions/2026-10-02-cycle-to-work-review.md`,
  decisions 1–8 and every audit line (H1–H5, M1–M11, L1–L7), with its later
  changes of 3 Oct (the private link; Staff cancelling; the paid box) and
  5 Oct (Today's lines for "Give everything a Manager can do").
- Paying for orders at the till, deposits at any stage:
  `docs/decisions/2026-10-16-till-paying-orders.md`.
- Edge cases 6a–6d: `docs/decisions/edge-case-lines.md` and
  `docs/decisions/2026-10-03-ux-walkthrough-second-walk.md`.
- Reports and accounts (the Owed report, money in, margin less
  commission): `docs/decisions/2026-10-01-reports-and-accounts-review.md`.
- A held bike in Stock: `docs/decisions/2026-10-01-stock-control-review.md`.
- Cycle to Work under "Other" ways to pay:
  `docs/decisions/2026-09-29-selling-at-the-till-review.md`.
- Not in the Lightspeed version's sidebar:
  `docs/decisions/2026-10-02-lightspeed-shops-review.md`.
- Walk-throughs: `docs/design/user-journeys/walk-2/ux-walkthrough-5-cycle-to-work.md`,
  `docs/design/user-journeys/ux-walkthrough-12-maya-twice.md`.
- Release 2 build plan, WP-7.1 entry:
  `docs/superpowers/plans/2026-10-03-release-2-build-plan.md`.

## Out of scope

- A Cycle to Work page on the shop's website (decision 6 notes it for
  later).
- Any connection to a scheme provider's own system. Certificates and
  payments are typed in by the shop.
- The Lightspeed version: Cycle to Work isn't in its sidebar.
- Deposits, roles, the Xero mapping, the margin line, and edge cases 6a
  and 6d are in this change but wait for other pieces (the table above).
