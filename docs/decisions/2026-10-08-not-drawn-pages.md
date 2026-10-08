# Pages not drawn yet: an answer for each — Jack's decisions (8 Oct 2026)

**The gap.** The clickable mockup has 95 buttons that lead to a page no
drawing shows yet, listed in `docs/design/user-journeys/mockup-gaps.md`
("Pages a button leads to that no drawing shows yet (95)"), for example
"Fix" on a sale that didn't send, and sending a payment link. None of them
was in a work package, and the build plan's coverage test doesn't look at
them (Codex's review finding 12, `docs/reviews/2026-10-04-release-2-plans-codex-adversarial.md`).
Issue #139 asked for one answer for each, and a work package:

- **A** — draw it;
- **B** — a line or variation on a screen that is already drawn;
- **C** — follow a pattern already built or drawn, and log it in
  `decided-while-building.md`;
- **D** — later.

Each row below was researched against the drawings, the mockup's link files
(`docs/design/user-journeys/generator/mockup/links/*.mjs`), the build plan
and the decisions. The 21 phone and tablet detours Jack already accepted
(third walk, `2026-10-03-ux-walkthrough-third-walk.md:68-76`) are a separate
list and stay as they are.

**How many.** 95. The build board said 96, which was out of date: the list
dropped to 95 on 4 Oct (commit 65ff995), when "Another customer's question,
opened in Messages" was settled by coverage walks answer 3
(`2026-10-04-coverage-walks.md:16-20`).

Status: **all 95 answered** (8 Oct). Four pages are to be drawn, each just
before its stage.

## Decided

### 1. The batch

**Decision** (Jack, 8 Oct: "1"). The suggested answer and work package for
all 95, as in the table below. That covers the 16 already settled by earlier
decisions (the 13 rows marked later, plus #43, #63 and #80) and the 77 B and
C rows. Each stage re-checks its own rows before building, so a row can
still change when its stage comes. Rows marked "(guess)" stay marked as
guesses until then.

### 2. Signing out a lost phone

**The gap.** Row #57, "Sign out — [Computer] / [Phone model]" on
`ops-till-checkout`, is later: on 3 Oct, Signed-in devices and "Sign out
everywhere" moved out of the first release (Management oversight, later
change to decision 3, issue #116 question 5). But stage 1 gaps decision 14
(`2026-10-07-stage-1-drawing-gaps.md`) signs staff out after 30 days
without use and says "a lost phone is handled by the Owner signing out that
person's devices" — which nothing in the first release would do.

**Decision** (Jack, 8 Oct: "1"). Only "Sign out everywhere" on a person
comes back into the first release: the drawn screen `ops-person-everywhere`
("Sign Jo Taylor out everywhere?"). Mark builds the server half, Jack the
button.

It is built in WP-5.1 (Jack, 8 Oct: "1", a second question). It was first
meant for WP-1.1, but the button sits on a person's page (`set-staff-person`,
built in WP-5.1) and uses the "Are you sure?" box (built in WP-3.1), so it
comes with them. That is still well before any shop goes live (stage 8), so
the 30-day rule is covered by then. Chosen over moving the person's page and
the box into stage 1, and over a new, simpler button on the team list. The full Signed-in devices list (`ops-devices`,
`ops-devices-signout`, `ops-devices-signed-out`) stays later, and so does
signing out a single device, so row #57 stays D. A lost phone is covered.

### 3. The four pages to draw

**Decision** (Jack, 8 Oct: "1"). The five A rows are four new drawings,
each drawn just before its stage. Until then they wait on Jack.

- #30, "Ask us to help" while moving from Citrus Lime (WP-2.4): before
  stage 2.
- #7 and #8, a bike's own page (WP-3.2): one drawing, before stage 3.
- #10, fixing a sale that didn't send (WP-3.1): before stage 3.
- #51, sending the customer a link to pay (WP-3.1): before stage 3.

## The 95, by stage

Kept as researched on 8 Oct, from `origin/main` at that date. "plan:N" is a
line in `docs/superpowers/plans/2026-10-03-release-2-build-plan.md` as it
stood before this change (commit 2c6ae7b); decision files are in
`docs/decisions/`. `'*'` means the link is set for every screen in that
journey. "Decision already?": Yes means a recorded decision settles what
happens; Partly means a decision covers the feature but not the missing
page.

### Count

| Stage | A | B | C | D | Total |
|---|---|---|---|---|---|
| 0 | 0 | 0 | 0 | 0 | 0 |
| 1 | 0 | 0 | 0 | 0 | 0 |
| 2 | 1 | 5 | 5 | 0 | 11 |
| 3 | 4 | 10 | 7 | 0 | 21 |
| 4 | 0 | 8 | 8 | 0 | 16 |
| 5 | 0 | 7 | 4 | 0 | 11 |
| 6 | 0 | 13 | 6 | 0 | 19 |
| 7 | 0 | 1 | 2 | 0 | 3 |
| 8 | 0 | 0 | 1 | 0 | 1 |
| Later / after the trading week (no WP-x.y) | 0 | 0 | 0 | 13 | 13 |
| Unclear | 0 | 0 | 0 | 0 | 0 |
| **Total** | **5** | **44** | **33** | **13** | **95** |

Five A rows make four drawings (#7 and #8 are one page). Of the 77 B and C
rows, three (#43, #63, #80) were already settled by earlier decisions. No
row sits in a stage 0 or stage 1 package except #59, whose button is on
`till-rail` (WP-1.1); its page is built in WP-3.1. Two of the 95 are what
the accepted detours go around: #90 (Story 2 step 4 says the phone sale
"isn't drawn") and #59.

### Stage 2

| id | From (screen: button) | What the missing page does | WP / plan line | Answer and evidence | Decision already? |
|---|---|---|---|---|---|
| 18 | st-list ('*' j14): + Add a category | New empty category with its own details | WP-2.1, plan:376-377 (`st-categories`, `st-category-edit`) | B: empty version of `st-category-edit` | Partly: 2026-10-01-stock-control-review.md:91-108 |
| 21 | st-product-sizes: + Add a size or colour | Add a size/colour (own stock, barcode) to a product | WP-2.1, plan:378 | C: Form box (block 9, WP-1.3) | Partly: stock-control-review.md:40-47 |
| 30 | '*' j09 (mv-start): Ask us to help | How the owner contacts Wheelhouse for help moving | WP-2.4, plan:443 (guess; also on WP-8.1 screens) | A: no screen or channel decided (guess) | Button only: moving-from-citrus-lime-review.md:22, :80 |
| 31 | tr-incoming: Cancel transfer T-[0000] | Cancel a transfer that is on its way | WP-2.3, plan:415 (`tr-incoming`) | C: "Are you sure?" box (block 8). Block 8 is not built until WP-3.1 (plan:468) | Partly: stock-control-review.md:126-127 |
| 33 | rs-labels: Change the label printer | Pick the label printer in Settings › Stockroom | WP-2.3, plan:419 (`rs-labels`) | C: follow the drawn `set-till-printer` (WP-5.1, plan:696), which comes later | Partly: receiving-stock-review.md:102, :125 |
| 36 | '*' j14 (st-product): Edit | Edit a product's name, codes, photo, price, cost | WP-2.1, plan:378 | C: drawn add-product form `rs-add-product` (WP-2.3, plan:417) | Partly: stock-control-review.md:31-39 |
| 37 | '*' j14 / j19: Edit details | Fill in a product's category details | WP-2.1, plan:378 | C: `rs-add-product` / `st-category-edit` fields | Partly: stock-control-review.md:99-100 |
| 40 | '*' j14: Edit [Category] | Edit another category | WP-2.1, plan:377 | B: `st-category-edit` with other data | No |
| 41 | '*' j14: Edit Bearings | Edit the Bearings category | WP-2.1, plan:377 | B: `st-category-edit` | No |
| 42 | '*' j14: Edit Drivetrain / Change it on Drivetrain | Edit the Drivetrain (parent) category | WP-2.1, plan:377 | B: `st-category-edit` | No |
| 43 | mv-fix: Fix [Customer name] / [Customer row] / [Job number] | Pop-up to fix one imported row | WP-2.4, plan:443 (`mv-fix`) | B: already a written line on `mv-start` (consolidate/j09.mjs:37) | Yes: 2026-10-03-ux-walkthrough-second-walk.md:19-22 |

### Stage 3

| id | From (screen: button) | What the missing page does | WP / plan line | Answer and evidence | Decision already? |
|---|---|---|---|---|---|
| 6 | ac-privacy-requests: Send the copy | Privacy request row after the copy is sent | WP-3.2, plan:515 (`cs-privacy`); situation from WP-4.5, plan:669 | B: a row state on `cs-privacy` | No |
| 7 | ac-customer-delete: Trek Domane … Under warranty | A bike's own page from the staff customer page | WP-3.2, plan:498-500 ("bike warranty") | A: no bike page drawn (same page as #8) | Partly: customer-service-review.md:28-33 (warranty on the bikes list only) |
| 8 | '*' j12 / j15: Trek Domane … / [Bike] · [Size] Frame … | A bike's details, warranty and jobs | WP-3.2, plan:498-500 | A: as #7. Could use Detail page block 4 (guess) | Partly: as #7 |
| 9 | '*' j12 / j15: Refund Refund · Till B1 … | Open a past refund from the history | WP-3.2, plan:517 (`cs-sale` on `till-sale-detail`) | B: `till-sale-detail`. links/j07.mjs:147 already sends the same row there | No |
| 10 | '*' j11 (till-failed): Fix | A sale that didn't send, with its problem | WP-3.1, plan:494 (`till-failed`) | A: how to fix is undecided; `till-failed` is a list only (consolidate/j11.mjs:70) | No |
| 14 | ac-customer-delete: Credit Store credit added … | One store credit entry | WP-3.2, plan:500 | B: the history row already holds reason and who (guess). Same page as #15 | No |
| 15 | '*' j12 / j15: Credit Store credit added … | One store credit entry | WP-3.2, plan:500 | B: as #14 (guess) | No |
| 17 | ac-customer-delete: + Add | Add a bike on the staff customer page | WP-3.2, plan:498-501 | C: Form box block 9; bike handling in src/screens/diary/new-job-dialog.tsx | No |
| 23 | '*' j12 / j15: + Add | Add a bike on a customer's page | WP-3.2 | C: same form as #17 | No |
| 34 | eod-card: Match to a sale | Pick the sale a card-machine-only payment belongs to | WP-3.4, plan:544 (`eod-card`) | C: sale search `till-find` (block 3, WP-3.1, plan:487) | No (line only: consolidate/j16.mjs:20) |
| 44 | cs-account: Email the statement | The statement email the customer gets | WP-3.2, plan:500, :513 | C: receipt email `cp-receipt-email` (block 41, WP-4.3). That block is built later (guess) | Statement exists: customer-service-review.md:50-56 |
| 45 | ac-privacy-requests: + Log a request | Log a privacy request by hand | WP-3.2, plan:515 | C: Form box. Same page as #46 | No |
| 46 | cs-privacy: + Log a request | Log a privacy request by hand | WP-3.2, plan:515 | C: Form box block 9 | Row wording only: decided-while-building.md:125-132 |
| 51 | '*' j11 (till-pay-other): Payment link … | Text or email the customer a link to pay | WP-3.1, plan:478 (`till-pay-other`); adapter WP-1.11, plan:351 | A: no screen; Stripe payment links chosen | Partly: selling-at-the-till-review.md:106-110; 2026-10-05-card-payments-provider.md:5 |
| 52 | '*' j11 (till-refund): Refund £28.00 to the card / · open the drawer / Add [£] to store credit | Till after a refund is done | WP-3.1, plan:489 | B: a refund situation on `till-receipt` (guess) | No |
| 58 | '*' j11 (till-deposit): Take £18.50 now / £27.75 now | Paying a deposit, and its paid box | WP-3.1, plan:485 (`till-deposit`) | B: deposit situation on `till-pay` / `till-receipt` (guess) | Partly: selling-at-the-till-review.md:78-80 |
| 59 | till-rail: Open the basket | Basket opened on a phone till | WP-3.1 (till-sale, plan:473); button on WP-1.1 `till-rail`, plan:220 | B: `till-sale` at phone size. Tied to the accepted detours (Story 2, step 4) | No; detours accepted only: third-walk.md:68-76 |
| 61 | cs-privacy: Send the copy | The data copy as the person receives it | WP-3.2, plan:515 | C: customer download `ac-download` (WP-4.5, plan:655) (guess) | No |
| 76 | '*' j11 (till-customer): Add new customer to sale | Sale with a just-added customer | WP-3.1, plan:473-475 | B: customer row on `till-sale` (`till-loyalty` is drawn) | No |
| 86 | cs-account: Take a payment at the till | Till taking an account payment | WP-3.2, plan:500; till WP-3.1 | B: `till-sale` with the balance loaded, like `till-job-balance` (plan:473) | Partly: customer-service-review.md:50-56 |
| 90 | '*' j11: Open the sale | Whole sale on a phone till | WP-3.1, plan:473 | B: `till-sale` phone (drawn with warning, discount or customer). Its absence is why the accepted detour Story 2 step 4 exists | No; detour accepted: third-walk.md:68-76 |

### Stage 4

| id | From (screen: button) | What the missing page does | WP / plan line | Answer and evidence | Decision already? |
|---|---|---|---|---|---|
| 13 | ac-customer-delete: Text Bike ready … | A sent text from the history | WP-4.5, plan:659 | B: the Messages thread (`ac-inbox`, `ac-reply-text`) (guess) | No |
| 16 | '*' j07: + Add a bike | Customer adds a bike on their account | WP-4.5, plan:644 | C: "A different bike" on drawn `bk-bike` (WP-4.4, plan:632) (guess) | No |
| 19 | '*' j03: Add a note for the shop | Note box on the booking's page | WP-4.5, plan:664 (`ac-job-note` on `bk-page`) | B: `ac-job-note`. links/j05.mjs:23 sends the same button there | Partly: book-a-repair-review.md:108 |
| 22 | new-job: + Add a bike | Add a bike while making a new job | WP-4.1, plan:570 | C: src/screens/diary/new-job-dialog.tsx (customer bikes) | No |
| 28 | '*' j07 (ac-inbox): [Customer name] | Another customer's answered question | WP-4.5, plan:658-659 | B: `ac-question` with other data | Not this one: coverage-walks.md:16-20 settled the unanswered version |
| 38 | '*' j07: Edit your details | Customer edits their details | WP-4.5, plan:661 | C: `ac-contact` Form box | No |
| 48 | request-new: Offer another time / Another time | Choose a time to offer the customer | WP-4.1, plan:555, :569 | C: src/components/ui/day-diary.tsx or the `bk-when` day strip. src/screens/diary/request-dialog.tsx:16-18 says the server can't do it yet | Partly: 2026-09-27-workshop-day-review.md:56 |
| 49 | '*' j07: Oliver Chen | An answered conversation in Messages | WP-4.5, plan:658-659 | B: `ac-question` thread | No |
| 65 | '*' j04 / j05; job-overview: Add item | Job's search for services and products | WP-4.1, plan:571 | C: already built in src/screens/diary/item-search.tsx (used by work-parts.tsx) | No |
| 71 | dq-ready; '*' j05: Photo … open larger photo | Enlarged pads photo over the ready page | WP-4.3, plan:606 | B: the enlarged-photo pop-up `dq-quote-photo` (plan:587; consolidate/j04.mjs:12) | No |
| 75 | '*' j07: Message [first line …] waiting for a reply | Customer's question before the shop replies | WP-4.5, plan:655, :658 | B: `ac-question` without the reply | No |
| 77 | '*' j03; ac-book-remind: booking terms | The shop's booking terms | WP-4.4, plan:617 | C: already built as TermsDialog, src/screens/book/details.tsx:306 + terms-query.ts | No |
| 83 | '*' j04: 1 photo — view or add for Shimano brake pads | View or add photos on a job line | WP-4.2, plan:577 ("photo per line") | C: src/components/ui/photo-picker.tsx | No |
| 91 | shared '~' (job rows except WH-1042), 656 places | Any other job's page | WP-4.1, plan:571 (`job-overview`) | B: `job-overview` with other data | No |
| 93 | shared '~': WH-1046 · Standard service | Shared-queue job's page | WP-4.1, plan:566, :571 | B: `job-overview`; "I'll do this" is already a diary line (consolidate/j12.mjs:50) | Partly: 2026-10-03-ux-walkthrough-8.md:40 |
| 95 | bk-settings / bk-settings-deposits: Use your own | Shop types its own booking terms | WP-4.4, plan:637 | C: Form box on `bk-settings`; the server already serves the shop's own terms (src/screens/book/terms-query.ts:5-9) | Partly: book-a-repair-review.md:110-116 |

### Stage 5

| id | From (screen: button) | What the missing page does | WP / plan line | Answer and evidence | Decision already? |
|---|---|---|---|---|---|
| 2 | '*' j19: Edit [Second site] | Second shop's details in Settings | WP-5.2, plan:724 (`ms-sites` on `set-shop-details`) | B: `set-shop-details` for the other shop | No |
| 11 | '*' j17 (rp-home): [Report name] Workshop: jobs by service | Open a saved Workshop report | WP-5.3, plan:741, :748 | B: `rp-workshop` under the saved name | No |
| 20 | '*' j19: + Add a service | Empty service box | WP-5.1, plan:693 | B: empty `ac-service-edit`. Same page as #25 | No |
| 24 | cs-groups: + Add a group | Add a customer group | WP-5.1, plan:688 (`cs-groups`) | C: Form box block 9 | Partly: customer-service-review.md:58 (decision 8) |
| 25 | set-workshop-services ('*' j07 / j19): + Add a service | Empty service box | WP-5.1, plan:693 | B: empty `ac-service-edit` | No |
| 26 | set-pay-other: Add | Add another way to pay | WP-5.1, plan:688 | C: Form box block 9 | Partly: selling-at-the-till-review.md:106-110 |
| 39 | cs-groups: Edit | Edit a customer group | WP-5.1, plan:688 | C: as #24 | Partly: as #24 |
| 53 | ac-services / ac-service-edit: Remove | Remove a workshop service | WP-5.1, plan:693 | C: "Are you sure?" (block 8) or "Saved · Undo" (block 10) | No |
| 55 | ops-till-checkout: Check out Jo Taylor | Till B1 with nobody checked in | WP-5.4, plan:770 | B: till row state on `set-till-quick` | No |
| 56 | set-till-remove: Remove the till | Tills list after removing B1 | WP-5.1, plan:696 | B: `set-till-tills-owner` minus that till | No |
| 74 | rp-margin: See … (9 buttons) | Filtered list behind a Margin line | WP-5.3, plan:747 | B: a filter on `st-list` / `tk-hub` (guess) | No (walk-3 L3: ux-walkthrough-3-stock.md:59) |

### Stage 6

| id | From (screen: button) | What the missing page does | WP / plan line | Answer and evidence | Decision already? |
|---|---|---|---|---|---|
| 1 | '*' j02 (on-orders): Send to Bolton | Second shop's Online orders, item on its way | WP-6.3, plan:846 (`on-orders-second`) | B: `on-orders` | Partly: buy-online-review.md:117 |
| 3 | '*' j01: [Second site] | Second shop's own page | WP-6.2, plan:819 | B: `wb-shop-page` with other data | No |
| 5 | '*' j02 (on-orders): [Customer] Order … collected | A collected order, staff side | WP-6.3, plan:847 | B: `on-order-staff` (`on-order-collected` is the customer side, plan:844) | No |
| 27 | ws-history: View | Look at an earlier website version | WP-6.1, plan:793 | B: the site under the staff banner (`wb-off-preview`) (guess; could be D) | No |
| 32 | ws-start-look: Choose another colour | Pick another main colour | WP-6.1, plan:791 | C: Pick-one box block 21 (guess) | Partly: website-management-review.md:214 |
| 62 | wb-category-filtered: Show [n] products | Filtered list on a phone, panel closed | WP-6.2, plan:814 | B: `wb-category` with the filter chips | No |
| 63 | ws-page / ws-page-changes: Edit: Headline … / Add it | Form box for one Words and photos part | WP-6.1, plan:792 | B: already a written line on `ws-page` (consolidate/j18.mjs:74) | Yes: website-management-review.md:212 |
| 69 | ws-shopify-check: See the list of products | Products that will change in Shopify | WP-6.1, plan:797 | C: Table block 3 (`st-list`) | No |
| 72 | on-choose-shop: [Second site] … | Basket, collecting from second shop | WP-6.3, plan:850-851 | B: `on-product-added` | No |
| 73 | '*' j01 / j02: Collect from [Second site] instead | Product page for the second shop | WP-6.3, plan:850 | B: `wb-product` (`on-product-two-shops`) | No |
| 78 | shared footer, wb-search-results (13+): Collection and returns | The shop's Collection and returns page | WP-6.2, plan:800-802 (shell); words WP-6.1 | C: plain page like `wb-cookies-page` (plan:824) | Partly: website-management-review.md:212 (it's a Words and photos row) |
| 79 | shared footer (12+): Contact us | The shop's Contact us page | WP-6.2, plan:800-802 | C: shop card block 34 / `wb-shop-page` (guess) | Footer link only: 2026-09-29-app-map-review.md:102 |
| 80 | wb-category-empty: Ask the shop about it | Shop phone and email shown in place | WP-6.2, plan:813 | B: a line on `wb-category-empty` | Yes: find-the-shop-review.md:86-87 (H5) |
| 81 | shared footer, j03, j07 (15+): Privacy | The shop's Privacy page | WP-6.2, plan:800-802; words WP-6.1 | C: as #78 | Partly: website-management-review.md:212 |
| 82 | '*' j02 (on-checkout): terms | The shop's terms at checkout | WP-6.3, plan:841 | C: TermsDialog, src/screens/book/details.tsx:306 | No |
| 84 | on-cancel-refund: Cancel and refund | Staff order page, cancelled and refunded | WP-6.3, plan:847-848 | B: `on-order-staff` (`on-order-cancelled` is the customer side) | No |
| 85 | '*' j02 (on-cant-supply): Refund this item | Staff order page, one item refunded | WP-6.3, plan:847-848 | B: `on-order-staff` (`on-order-cant-supply` is the customer side) | No |
| 87 | wb-choose-shop: [Second site] … | Website with the second shop chosen | WP-6.2, plan:811 (`wb-choose-shop`) | B: `wb-home` / `wb-category` with the chip changed | No |
| 89 | ws-discard: Discard changes | Website page, nothing unpublished | WP-6.1, plan:792 | B: `ws-page` / `ws-page-on` | No |

### Stage 7

| id | From (screen: button) | What the missing page does | WP / plan line | Answer and evidence | Decision already? |
|---|---|---|---|---|---|
| 35 | '*' j06 (cw-record-payment, cw-order-held): Close with a reason… | Close a provider's short payment with a reason | WP-7.1, plan:874, :883 | C: reason Form box like `st-adjust` (plan:380) | Partly: cycle-to-work-review.md:110-113 (H4) |
| 54 | '*' j06 (cw-settings): Retire [Provider] | What retiring a provider asks first | WP-7.1, plan:887 | C: "Are you sure?" block 8 (`cw-cancel` pattern) | No |
| 70 | '*' j06 (cw-cancel): Cancel the order | Staff order page once cancelled | WP-7.1, plan:874, :884 | B: cancelled state on `cw-order-held` | Partly: cycle-to-work-review.md:166 |

### Stage 8

| id | From (screen: button) | What the missing page does | WP / plan line | Answer and evidence | Decision already? |
|---|---|---|---|---|---|
| 29 | mv-pick-day: Another day… | Pick a switch-over day further out | WP-8.1, plan:936 | C: src/components/ui/month-calendar.tsx (guess) | Partly: moving-from-citrus-lime-review.md:97 |

### Later / after the trading week (outside Release 2's stages, no WP-x.y)

| id | From (screen: button) | What the missing page does | WP / plan line | Answer and evidence | Decision already? |
|---|---|---|---|---|---|
| 4 | '*' j18: + Add section | Add a section in the editor | Later, plan:1029-1037 (`ws-editor-add`) | D | Yes: website-management-review.md:208 |
| 12 | '*' j18: Header / Big photo … (+4) | A section's settings in the editor | Later, plan:1036 | D | Yes: :208 |
| 47 | '*' j18: Move … up/down (+9) | Move a section in the editor | Later, plan:1036 | D | Yes: :208 |
| 50 | '*' j18: Pages Home, About us, … | The editor's Pages | Later, plan:1036 (`ws-pages`) | D | Yes: :208 |
| 60 | '*' j18: Bigger | Bigger preview in the editor | Later, plan:1036 (`ws-editor-bigger`) | D | Yes: :208 |
| 88 | '*' j01: Edit this page; ws-page-changes: Review in the editor | The website editor | Later, plan:1029-1037; plan:781-782 hides "Review in the editor" | D (hiding "Edit this page" too is a guess) | Yes: :208 |
| 92 | '*' j18: Web address … | Shop's own web address | Later, plan:1038-1043 | D | Yes: website-management-review.md:210 |
| 57 | ops-till-checkout: Sign out — [Computer] / [Phone model] | Sign a device out | Later, plan:1019-1027 | D. Conflicts with: plan:1024-1025 (workshop computers stopped beside the tills, WP-5.1) and stage-1 decision 14 (2026-10-07-stage-1-drawing-gaps.md:212-214, "Owner signing out that person's devices") | Yes: management-oversight-review.md:117 |
| 94 | ops-log-refused: See my own activity | A person's own activity lines | Later, plan:1027 (`ops-my-activity`) | D | Yes: :117 |
| 64 | ls-job-sorted: Mark it sorted | Lightspeed job after marking sorted | After the trading week, plan:960-980 | D | Yes: build-plan-questions.md:58-61, :113-114 |
| 66 | ls-today-person: See the jobs that need someone… | Lightspeed jobs needing a look | After the trading week, plan:985 | D | Yes: as #64 |
| 67 | op-today-staff-lightspeed: See the jobs that need someone… | Same list, from Today | After the trading week, plan:985 | D | Yes: as #64 |
| 68 | ls-today-down: See the jobs | Jobs waiting to send to Lightspeed | After the trading week, plan:985 | D | Yes: as #64 |

## Notes

- The same missing page appears under more than one name: 7/8, 14/15, 17/23
  (and 22), 20/25, 24/39, 45/46, 40/41/42, 66/67, and 77/82 share a pattern.
  About 85 distinct pages (estimate).
- "Decision already: Yes" means a recorded decision settles what happens (13
  Later/D rows, plus 43, 63, 80). "Partly" means a decision covers the
  feature but not the missing page.
- Row #57: decision 2 above settles the clash this row notes. Signing out
  one device stays later; "Sign out everywhere" on a person comes into
  WP-5.1 (decision 2).

## Outside the 95, not looked into

Two buttons are marked as leading to a page not drawn in the mockup's link
files but are not in `mockup-gaps.md`, so they are not among the 95. They
were seen while researching and have not been looked into:

- "Someone else" on `till-serving-pills` (`generator/mockup/links/j11.mjs:11`).
- "Open the sale" on `eod-entry` (`generator/mockup/links/j16.mjs:33`).
