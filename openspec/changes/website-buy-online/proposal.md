WP: WP-6.3

# Proposal

## Why

A customer on a Wheelhouse shop's website can see what's on the shelf (once
WP-6.2 is in) but can't buy it. Journey 2 settled how buying should work:
pay online, collect from the shop, no account needed, and staff see every
online order in one list. This piece builds that, from Add to basket to the
item being handed over, with the refunds, reminders and messages around it.

**Who takes it:** not yet taken. Written overnight on 12–13 Nov 2026 for
whoever picks up the theme that holds WP-6.3; take it in STATUS's "who is
on what" block first.

**Risky areas:** all four.
- Migrations: new online order tables, and changes to `online_payments`,
  `pretend_payments`, `online_order_settings`, `categories`,
  `store_credit_entries` and `stock_movements`.
- Money and stock: card payments through the payments adapter, store
  credit spent and given back, a sale recorded at payment, `stock_qty`
  going down at payment and back up on a refund.
- Public routes and customer accounts: the basket, checkout and paying on
  the public website, the customer's private order link, and the order in
  their account.
- Messaging: six new order messages and an uncollected-order reminder round.

So it is a full change at any size: `/review` and `risky-area-reviewer` on
each pull request marked risky in `tasks.md`, and hand-run CI before merging
them.

**Not a small piece:** about 7,500 changed lines, split into fifteen pull
requests (see `tasks.md`). Ten are server and staff screens that need no
other piece. Three customer-facing pull requests wait for WP-6.2's website
app; one waits for the till's next piece (WP-3.1); one waits for roles
(WP-1.1).

Five questions for Jack (8–12, overnight 12–13 Nov) are written with the
recommended answer. Three are defaults taken, which Jack can overrule: store
credit online now with gift cards later; only "what's on the shelf" for now;
remind after 3 days and keep for 7. Two wait for Jack, because they are
money and the till: the sale and the stock drop at payment, and a Hand over
step on the staff order page. Pull requests 5–10, which depend on those two,
wait for his answers (`docs/decisions/2026-11-13-website-buy-online-defaults-taken.md`).

## What Changes

- **Add to basket and the basket** on WP-6.2's product page and website:
  the product page's buying situations, the shop chooser asked once, and the
  basket with its changed and empty states. The basket is a cookie.
- **Checkout on one page:** how you'll get it (collect from a shop, the only
  choice for now, built so delivery can be added), your details, and paying.
  No account is needed; a signed-in customer's details are filled in and
  their store credit is offered.
- **Paying** by card, Apple Pay or Google Pay through the payments adapter
  (pretend for now, "[payment provider]" on screen), and with store credit.
  Paying, the bank's check, declined, "couldn't confirm" and "sold out just
  before paying" are each handled, and nothing is taken for what isn't there.
- **The order becomes a sale at payment:** the stock count drops, the money
  is online money (kept out of till takings), and the confirmation says
  what happens next, with the order number and how it was paid.
- **The customer's order page:** its steps (Ordered, Getting it ready, Ready
  to collect, Collected), Receipt, and Cancel until it's ready, reached from
  a private link in the confirmation email or from their account. "Save your
  details for next time" makes an account with an emailed code.
- **Front desk › Online orders** for staff: one list in three groups (To
  get ready, Ready to collect, Collected), the order page, Mark ready (the
  email waits a few seconds, with Undo, as decided), Not ready after all, Can't supply an
  item, Cancel and refund, and Hand over.
- **Refunds go back the way the order was paid:** card through the
  adapter's refund, store credit back to store credit, and the items back on
  sale.
- **Not collected:** one reminder, then the order shows on Today with
  Contacted and Open. Today also shows new online orders.
- **Six order messages** in Settings › Messages, wording marked as draft.
- **Settings › Front desk › Online orders** gains what the website sells
  (only what's on the shelf, for now), showing products by category, the
  online payment switches, Not collected, and where ready orders wait.
- **The till's side** (hand-over at the till, the "for an online order"
  warning, the Orders group in the till's search) uses the same server steps
  once the till's Collect screen exists.

## Capabilities

### New Capabilities
- `online-orders`: an online order from payment to collection or refund:
  its stages, order number, staff list and order page, Mark ready, Not
  ready after all, Hand over, Can't supply, Cancel and refund, reminders and
  not collected, the customer's private order link, and who may do each.

### Modified Capabilities
- `website`: Add to basket, the shop chooser's situation, the basket,
  checkout, paying and the confirmation on the customer website. (`website`
  is not yet in `openspec/specs/`: WP-6.1's `website-management` and WP-6.2's
  `website-browse` both add it; this delta adds to whichever lands first.)
- `settings`: the rest of the Online orders settings.
- `messages`: the six online order messages.
- `today`: new online orders, and an order not collected.
- `stock`: stock goes down at payment and back on a refund; an item for an
  online order warns at the till.
- `till`: the hand-over of an online order and the "for an online order"
  warning (waiting for WP-3.1).
- `customer-accounts`: online orders in the customer's account, and saving
  details after an order.
- `reports`: online order refunds taken off takings and VAT on the day made.

## What is already built, and what this piece waits for

Checked against `origin/main` at `38fb14cb` on 12 Nov 2026.

| Needed | State | What it blocks | What this change does instead |
|---|---|---|---|
| WP-6.2 the customer website (`website-browse`: plan pull request #742, build pull requests #744, #745 and on) | Not merged; nothing of it is on main | Every customer screen: the product page situations, the shop chooser, basket, checkout, confirmation, the order page | Pull requests 1–10 build the server and staff side first. Pull requests 11, 12 and 13 wait for WP-6.2's website app, product page, chosen shop and cookies list. |
| WP-6.1 website management (`website-management`) | Partly built, not archived. Online orders settings page with Buying online and Paying online is built; `online_order_settings` has `buying_online` only | Nothing | Adds its other sections, as WP-6.1's defaults-taken item 4 says. |
| The payments adapter (`server/payments/`) | Built, pretend only: hold, card, take, release, refund (part or whole) | The bank's check, "couldn't confirm", Apple Pay and Google Pay | Takes at once by holding and taking straight after the card says yes; adds pretend outcomes for the bank's check, "couldn't confirm" and the wallets. "[payment provider]" stays on screen. |
| WP-3.1 the till, complete (`till-collect`, `till-held`, refunds at the till, the till's Orders search) | Not built | The till's hand-over screen, the warning at the till, the Orders group in the till's search | Hand over is a step on the staff order page now (question 11). Pull request 14 adds the till's screens, reusing the same server steps, once WP-3.1 is in. |
| Refunding a sale at the till (WP-3.1) | Not built: no sale refund model exists | Nothing here | Online orders keep their own refund records; reports take them off on the day made. WP-3.1 can read them. |
| WP-1.1 roles and switches | Not built: only `is_owner` | "Till only" opening Online orders; Manager for "Keep orders for" | Settings are Owner only (`ownerOnly`, as WP-6.1); the everyday order steps are open to anyone signed in. Pull request 15 swaps in the roles. |
| Stock transfers between shops (WP-5.2) and supplier lead times | Not built | "Anything in stock at any of our shops", "We order it in", the second shop's "Send to Bolton" | Left for later (question 10), with their drawn words kept. |
| Gift cards | Nothing built | The gift card box and switch | Left for later (question 8); not on screen. |
| Messages (`server/messaging/`) | Built, pretend sending, Undo | A shorter wait for the ready email | Six new keys through `queueMessage`. |
| Store credit (`store_credit_entries`, migration 126) | Built | Nothing | Spent at payment, given back on a refund. |
| Private code links (`/api/portal/:shopSlug/c2w-links/:code`) | Built | Nothing | The order link follows it. |
| Customer accounts (`/book/<slug>/account`, code sign-in) | Built | Nothing | Orders join the account; "Save my details" uses the code sign-in. |

## Drawings it follows

All in `docs/design/user-journeys/generator/online.mjs` (journey 2,
`journeys.mjs:189-260`), merged per `generator/consolidate/j02.mjs`, unless
noted:

- On `wb-product` (WP-6.2): `on-product`, `on-product-added`,
  `on-product-out`, `on-product-out-other`, `on-product-no-shop`,
  `on-product-off`. On `wb-choose-shop` (WP-6.2): `on-choose-shop`.
- `on-basket` with `on-basket-changed`, `on-basket-empty`
- `on-checkout` with `on-checkout-errors`, `on-checkout-credit`,
  `on-checkout-covered`, `on-checkout-paying`, `on-checkout-declined`,
  `on-checkout-unsure`, `on-checkout-sold-out`; `on-checkout-bank`
- `on-confirmed` with `on-save-details`
- `on-order` with `on-order-ready`, `on-order-collected`, `on-order-cancel`,
  `on-order-cancelled`, `on-order-clash`, `on-order-shop-cancelled`,
  `on-order-cant-supply`
- `on-email-ready`
- `on-orders` with `on-orders-ready`, `on-orders-sold-at-till`, and the
  written line "Till only (no email)"
- `on-order-staff` with `on-order-staff-ready`, `on-not-ready`;
  `on-cant-supply` with `on-cancel-refund`
- `on-settings` with `on-settings-show`, `on-settings-pay`,
  `on-settings-keep`
- On `till-collect` (WP-3.1): `on-hand-over`, `on-hand-over-refunded`
- On `op-today` (WP-1.10): `on-today`, `on-today-uncollected`
- On `set-msg-list` (WP-1.8): `on-messages`

Left for later, with their drawn words kept: `on-product-two-shops`,
`on-product-order-in`, `on-order-moving`, `on-orders-arrived`,
`on-orders-second`, `on-settings-order-in`, `on-checkout-gift-code`,
`on-checkout-gift`, `ws-shopify-order` (`website.mjs:492-495`).
Dropped on 4 Oct and not built: `on-settings-start`,
`on-settings-start-answered`.

## Decisions it follows

- Journey 2, Buy online: `docs/decisions/2026-10-01-buy-online-review.md`,
  decisions 1–10 and every audit line (H1–H6, M1–M13, L1–L5), with its later
  changes of 2 Oct and 4 Oct.
- Coverage walks: `docs/decisions/2026-10-04-coverage-walks.md` item 2;
  `docs/design/user-journeys/walk-4/coverage-6-online-orders-saturday.md`
  L2 (Staff can refund).
- Walk-through 2: `docs/decisions/2026-10-02-ux-walkthrough.md` M3–M9 and
  L4 (online money kept out of each till's close; held stock warns but
  doesn't block; a sixth online message).
- Till only opens Online orders: `docs/decisions/2026-10-03-ux-walkthrough-8.md:76`.
- Refunds go back the way they were paid; no manager PIN:
  `docs/decisions/2026-09-29-selling-at-the-till-review.md` decision 9.
- Online money kept beside the till's takings: Jack's answer 7, 27 Oct
  (`server/routes/close-the-day.js`, `ONLINE_TENDERS`).
- Payments: `docs/decisions/2026-10-05-card-payments-provider.md` (behind
  the adapter, pretend until Jack says yes);
  `docs/decisions/2026-10-02-website-management-review.md` decisions 5, 8, 10.
- Starting numbers: `docs/decisions/2026-10-03-build-plan-questions.md` Q8;
  draft message wording: same file, Q9.
- Uncollected bikes, the pattern for orders: `docs/decisions/decided-while-building.md:3157`.
- WP-6.2's answers: `docs/decisions/2026-11-12-website-browse-answers.md`
  (on pull request #742), answers 1 and 2.
- WP-6.1's defaults: `docs/decisions/2026-11-12-website-defaults-taken.md`
  item 4.
- Not-drawn pages: `docs/decisions/2026-10-08-not-drawn-pages.md`, Stage 6
  rows 5, 82, 84, 85.
- Owner-only settings until roles: `docs/decisions/2026-10-19-owner-only-settings.md`.
- Release 2 build plan, WP-6.3 entry:
  `docs/superpowers/plans/2026-10-03-release-2-build-plan.md` (lines 861-886).

## Out of scope

- Gift cards: selling, codes, balances, and paying with them online or at
  the till. A later piece of its own (question 8).
- "Anything in stock at any of our shops" and "Also things we can order in",
  with the "Ready at Bolton in [n] days" and "We order it in" lines, "Show
  ones ready in [n] days", and the second shop's side (question 10).
- Delivery and postage. Every order records how it reaches the customer, so
  it can be added (decision 1); every "Collect from" place is listed for then.
- Shopify orders in Online orders (`ws-shopify-order`): they need Shopify
  orders to become online orders first.
- Search finding online orders (decision 10: "search finds orders all the
  same"); nothing is drawn.
- Buy now, pay later (decision 5: left for when the provider is chosen).
- A real payment provider. Connecting one stops and asks Jack.

## Impact

- New: `server/online-orders/` (orders, basket, paying, refunds, messages,
  reminders), `server/routes/online-orders.js` (staff),
  public routes under `/api/site/` (basket, checkout, paying) and
  `/api/portal/:shopSlug/order-links/:code`, `src/screens/online-orders/`,
  the website app's basket, checkout, confirmation and order pages.
- Changed: `server/payments/pretend.js` (new pretend outcomes),
  `server/routes/online-payments.js` (settings), `server/routes/today.js`,
  `server/messaging/templates.js`, `server/routes/close-the-day.js`
  (`ONLINE_TENDERS`), the VAT and takings reports, `src/staff/routes.ts`
  (the existing `orders` nav entry gets its page).
- One migration (the next free number at build time; latest on main is 149).
- No new dependency.
