WP: WP-6.1

# Proposal

## Why

A shop needs to put its website up, keep its words and photos right, take
payments online and, if it wants, keep its Shopify shop — all from Office ›
Website, without a web designer. This is the first piece of the Sell online
theme: every later website piece (WP-6.2 Find the shop and browse, WP-6.3 Buy
online) reads the website this piece makes and the payments it connects.

**Who takes it:** not yet taken. Written overnight on 11–12 Nov 2026 for
whoever picks up the Sell online theme; take it in STATUS's "who is on what"
block first.

**Risky areas:** yes, three of the four. A migration (new website tables);
money (connecting online payments, the £1 test payment and its refund, and
the switch that turns booking deposits and "Pay now" on); and a public route
(the customer site reads only the *published* version). So it is a full
change at any size: `/review` and `risky-area-reviewer` on each pull request
that touches those parts, and hand-run CI before merging them.

**Not a small piece:** about 3,000 changed lines, split into nine pull
requests (see `tasks.md`).

## What Changes

- **A website model with drafts and publishing.** The shop's website has one
  working draft and a published version. Editing saves to the draft; Publish
  makes it what customers see; Discard goes back to the last published
  version. Published versions and discarded drafts are kept in History for
  [n] days, with "Go back to this". The first "Turn it on" also publishes.
- **The Website page (Office › Website, `ws-page`).** Off or on, with Turn it
  on / Turn off; "Edit words and photos" with the count of unpublished
  changes; the open list of unpublished changes with Publish and Discard
  changes; the summary rows (Taking payments, Pages, Tracking tools, Web
  address, Wheelhouse's website or Shopify); and the **Words and photos**
  list — seven fixed parts, each with Edit opening a form box, and "Check
  this" on a part still holding its starting wording.
- **The three-step start** (`ws-start-which`, `ws-start-look`,
  `ws-start-products`, `ws-start-shopify`): Wheelhouse's website or Shopify;
  logo and main colour (colours suggested from the logo, each checked for
  easy reading); start with every product online or nothing.
- **Tracking tools** (`ws-tracking`): pick a tool from the list, type its ID;
  each is marked Statistics or Marketing; nothing loads until a customer
  agrees, and a tool goes live only when the website is published.
- **Online payments setup** in Settings › Front desk › Online orders
  (`ws-pay-none` and its situations): Connect [payment provider], the £1 test
  payment that is refunded, failed and "needs more details", and the Buying
  online switch that can't be On until payments are connected. "Needs more
  details" also shows on Today (`ws-today-pay-more`) and the Website page.
  Payments go through the existing payments adapter, with a pretend provider
  until a real account exists.
- **Shopify in the new frame** (`ws-shopify-connect` and its situations,
  `ws-shopify-on`): connect, see what will change, send, problems, pause, and
  switch back to Wheelhouse's website. Behind a Shopify adapter with a
  pretend version until a real Shopify app account exists.
- **Who can change it:** "Owner only until roles are built", like every
  settings screen today. A person who can't change it doesn't see Website in
  the sidebar and gets `ws-no-access` if they follow a link.
- Every shop keeps its free address, [shop-name].wheelhouseepos.com.

## Capabilities

### New Capabilities
- `website`: the shop's own website as staff manage it — drafts, publishing,
  history, the Words and photos list, the three-step start, logo and colour,
  tracking tools, Shopify, and who can change it.

### Modified Capabilities
- `settings`: Settings › Front desk › Online orders gains Buying online and
  Paying online — connecting the payment provider and the test payment.
- `today`: Needs attention gains "[payment provider] needs more details by
  [date]".

## What is already built, and what this piece waits for

Checked against the code on 11 Nov 2026 (main at `4c9829d0`).

| Needed | State | What it blocks | What this change does instead |
|---|---|---|---|
| WP-1.3 Settings page (block 1) and Form box (block 9) | Built in part: `src/screens/settings/settings-page.tsx`, `src/components/ui/dialog.tsx` | Nothing | Reuses them |
| WP-1.10 Today board | Built | Nothing | Adds one Needs attention source in `server/routes/today.js` |
| WP-1.1 Roles and switches (Mark) | Not built: no "Can edit the website" or "Can change settings" switch on the server | Only `ws-no-settings` (someone who may edit the website but not settings) and the rule that Shopify needs both switches. Everything else works on "Owner only". | Uses `ownerOnly` (`server/lib/owner-only.js`); `ws-no-access` lists the Owners as the people who can change it. The last pull request swaps in the two switches once WP-1.1 lands. |
| WP-1.2 Settings store, change record and activity log (Mark) | Not built | Nothing that can't be done another way: website settings follow the one-table-per-area pattern already used by `storefront_settings` and `workshop_settings` | Keeps its own tables; History reads website versions directly |
| WP-5.1 Activity list (block 14) | Built in part; no activity list component yet (Settings says it "waits for the activity log") | `ws-history` can't reuse block 14 | History is a list in a form box over the Website page, read from the website's saved versions (walk-through 4: "Draw History over the Website page"). Logged as decided while building. |
| WP-2.4 Stage strip (block 24) | Built in part; no stage strip component in `src/` | The look of "Step 1 of 3" | The start shows the drawn "SET UP YOUR WEBSITE · STEP 1 OF 3" line; swapped for block 24 when it exists. Logged. |
| WP-8.1 Switch-over checklist and the move's state | Not built (selling stage) | `ws-page-moving`, `ws-page-switch-over`, `ws-pay-tested-moving` | Builds the "website is ready" rule (every starting-wording part checked) as a server function the checklist will read; the three moving situations are the last pull request that waits on WP-8.1 |
| WP-6.3 Online orders settings (`on-settings`) | Not built | Nothing, if the order is agreed | This piece makes the Online orders page with only Buying online and Paying online; WP-6.3 adds its other folds (see question 4 for Jack) |
| WP-6.2 Website shell | Not built | "View website" on the Published toast shows the old customer site until WP-6.2 replaces it | Customer site reads only the published version from day one |

So the split builds first everything that needs none of Mark's pieces —
the model, the Website page, the start, tracking, payments setup and Shopify
— and leaves two small pull requests at the end: one for the roles switches
(after WP-1.1) and one for the moving situations (after WP-8.1).

## Drawings it follows

All in `docs/design/user-journeys/generator/website.mjs`:

- `ws-start-which`, `ws-start-products`, `ws-start-shopify`, `ws-start-look`
- `ws-page`, `ws-page-on`, `ws-page-changes`, `ws-no-access`,
  `ws-no-settings`, `ws-page-moving`, `ws-page-switch-over`,
  `ws-published`, `ws-published-off`, `ws-discard`, `ws-shopify-on`
- `ws-history`
- `ws-tracking`, `ws-tracking-on`, `ws-tracking-error`
- `ws-pay-none`, `ws-pay-tested-moving`, `ws-pay-connected`,
  `ws-pay-tested`, `ws-pay-failed`, `ws-pay-more`, `ws-pay-shopify`
- `ws-shopify-connect`, `ws-shopify-connect-failed`,
  `ws-shopify-connect-check`, `ws-shopify-connect-sending`,
  `ws-shopify-connect-problem`, `ws-shopify-connect-switch`
- `ws-today-pay-more` on the `op-today` board

`ws-published`, `ws-published-off` and `ws-discard` are drawn on the later
full editor; here their toasts and box sit on the Website page. "Review in
the editor" on `ws-page-changes` stays hidden until the editor exists (build
plan, WP-6.1 entry).

## Decisions it follows

- Journey 18, website management: `docs/decisions/2026-10-02-website-management-review.md`
  — decisions 2, 5–11 and the audit H2, H3, H5, H6, M3, M4, M6, M7, M10; and
  its later changes: issue #116 question 2 (fixed design, editable text and
  photos; decisions 1, 3 and 4 put off), question 3 (own address set up as a
  service), the shop's colour (logo and one main colour).
- Walk-through 4 H3, the Words and photos list:
  `docs/design/user-journeys/walk-2/ux-walkthrough-4-new-shop.md`.
- Buy online, coverage walk 5 (4 Oct): every product online or nothing is
  asked once, in step 3; connecting payments turns buying online on —
  `docs/decisions/2026-10-01-buy-online-review.md`.
- Release 2 build plan, WP-6.1 entry:
  `docs/superpowers/plans/2026-10-03-release-2-build-plan.md`.
- Outside services behind an adapter with a pretend version (CLAUDE.md).

## Out of scope

- The full editor, theme and extra pages (23 screens: `ws-editor-*`,
  `ws-theme-*`, `ws-pages*`, `ws-page-settings`, `ws-page-returns`) — later.
- The shop's own web address (6 `ws-address-*` screens) — later; set up as a
  service.
- What customers see: the website shell, home, browsing (WP-6.2), basket,
  checkout and orders (WP-6.3), including `ws-shopify-order` and the rest of
  `on-settings`.
- A real payment provider or a real Shopify app: both need a real account,
  which is Jack's to create. Until then, only the pretend versions.
- The cookie choice banner customers see: this piece stores which tools are
  on and their kind; WP-6.2 shows the banner and loads the tools.
- One person editing at a time (audit M3): with no editor, each part is
  saved on its own and two people changing different parts don't clash.
