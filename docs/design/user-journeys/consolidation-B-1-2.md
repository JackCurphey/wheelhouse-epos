# Consolidation — journeys B, 1, 2

Read-only analysis for issue #116 step 1, 3 Oct 2026. Sources: `generator/journeys.mjs:88-250`, `signin.mjs`, `browse.mjs`, `online.mjs`, the decision files named below, and walk-throughs 1, 2, 4, 7 and 8. Screens counted by running `journeys.mjs` (B 20, 1 37, 2 57; checked by count). **Inferred** marks anything worked out rather than read.

## Counts by class

| | B Signing in | 1 Browse | 2 Buy online | Total |
|---|---|---|---|---|
| Real screen | 7 | 13 | 7 | 27 |
| Settings | 1 (`till-setup`) | 0 | 1 (`on-settings`) | 2 |
| Situation of another screen | 10 | 22 | 44 | 76 |
| Edge case | 1 (`till-give-pin`) | 2 (`wb-product-held`, `wb-off-preview-ask`) | 5 (`on-checkout-unsure`, `-sold-out`, `on-order-clash`, `on-orders-sold-at-till`, `on-settings-start`) | 8 |
| Put off by the 3 Oct answers | 1 (`till-checkin-practice`, question 4) | 0 | 0 | 1 |
| **Drawn now** | **20** | **37** | **57** | **114** |

Journey 2 has 9 product-page drawings and 4 drawings of screens owned by other journeys: hand-over (journey 11), Today (journey 10) and Messages (journey 8).

**Affected by question 2 (fixed design) but not put off:** every board built on the home page in `browse.mjs:237-272` (`wb-home`, `-lower`, `-one-shop`, `wb-first-visit`, `wb-choose-shop`, both search boards, the three staff-banner boards, the three cookie boards). Find the shop decision 1 (`find-the-shop-review.md:31`), the shop arranging the home page's sections, is now later (`website-management-review.md:208`). For the first release the home page is one fixed layout.

## Merge table

| Ids | Becomes | Saved | Decision touched |
|---|---|---|---|
| `till-checkin`, `-offline`, `-stale`, `till-pin-wrong` | PIN screen; status line and wrong PIN listed as situations | 3 | Leftover 4: "one line on the PIN screen" (`leftover-screens-review.md:46`); Signing in 9 |
| `pin-change`, `pin-first`, `pin-cleared`, `till-give-pin` | "Your till PIN" box (`signin.mjs:160` already draws all four with one function) | 3 | Signing in 6–7; walk-through 4 H1 |
| `auth-signedout`, `auth-expired` | Message page | 1 | Walk-through 8, decision 3 |
| `auth-noaccess` | One line in the staff page frame's situation list | 1 | — |
| `cust-signin`, `cust-code`, `cust-code-expired` | Emailed-code sign-in, 2 steps | 1 | Signing in 5, 9 |
| `pending`, `expired` | Booking-link page (Release 1 images; titles inferred) | 1 | Signing in 10 |
| `wb-home`, `-lower`, `-one-shop`, `wb-first-visit` | Home page | 3 | Find the shop 1 (now fixed), M1 |
| `wb-choose-shop`, `on-choose-shop` | "Which shop?" box | 1 | Buy online 8, audit M3 |
| `wb-category`, `-filtered`, `-empty`, `-parent`, `-child`, `-no-shop`, `wb-search-results`, `-measure`, `-none` | Product list, plus the phone filter panel | 7 | Find the shop 2, 4, 7 (H2, M4) |
| `wb-product`, `-sizes`, `-size-other`, `-held`, and `on-product`, `-added`, `-two-shops`, `-order-in`, `-out`, `-out-other`, `-no-shop`, `-off` | Product page | 11 | Find the shop 3; Buy online 2, 8; later change (`buy-online-review.md:159`) |
| `wb-search-typing`, `-no-suggestions` | Search suggestions | 1 | Find the shop 4 |
| `wb-shop-page`, `wb-shop-collect`, `wb-find-us` | A shop's page | 2 | Find the shop 5, M2 |
| `wb-not-found`, `wb-off` | Message page (same block as above) | 1 | Find the shop 6, M13 |
| `wb-off-preview`, `-product`, `-ask`, `wb-turned-on` | Staff banner on the website | 3 | Find the shop M14; later change (`:117`) |
| `wb-cookies-banner`, `-choose`, `-saved` | Cookie banner and its Choose box | 1 | Find the shop 6, H3 |
| `wb-cookies-page`, `-plain` | Cookies page | 1 | — |
| `on-basket`, `-changed`, `-empty` | Basket | 2 | Buy online audit H1 |
| `on-checkout` and its 10 situations | Checkout, plus the bank's check box | 9 | Buy online 5, 10; audit H2, M7 |
| `on-confirmed`, `on-save-details` | Order confirmed | 1 | Buy online 4 |
| `on-order` and its 8 states | The customer's order page; cancelling uses the shared "Are you sure?" box | 8 | Buy online 7, M4 |
| `on-orders`, `-ready`, `-arrived`, `-sold-at-till`, `-second` | Online orders list | 4 | Buy online 6; H4, M1 |
| `on-order-staff`, `-staff-ready`, `on-not-ready` | One-order box | 2 | H4, H5 |
| `on-cant-supply`, `on-cancel-refund` | "Refund with a reason" box | 1 | Buy online 7, M2 |
| `on-hand-over`, `-refunded` | Lines in journey 11's hand-over | 2 | H5 |
| `on-today`, `-uncollected` | Lines in journey 10's Today | 2 | Buy online 6, 7 |
| `on-settings` and 5 others | Settings › Online orders (`on-settings-start` stays as its own box) | 5 | Buy online 2, 3 |
| `on-messages` | Line in journey 8's Messages | 1 | M5 |

**Lines in a situation list, not drawings:** all 8 edge cases.

**Possibly too big for a first release (questions, not reopened):**
1. Gift cards and store credit at checkout. That is 4 checkout situations, and no persona asks for it (Buy online 5).
2. A customer cancelling online, with its clash case (Buy online 7, "no objection").
3. Tracking tools, and with them the cookie choice. These are not put off, but with a fixed design they could be (Website management 6).

## Reduced count and building blocks

**114 → 35 drawings** (B 9, browse 15, buy online 11), plus 1 put off. Only the phone size needs drawing for customer pages.

**New customer blocks**, none of them in Mark's 15:
1. Website frame: header, "Collecting from · Change", skip link, footer. It is drawn twice today (`browse.mjs:41`, `online.mjs:52`).
2. Product card and product list, with filters, sorting and Show more.
3. Product page.
4. Availability line ("Ready today at Bolton…").
5. "Which shop?" box. There are three copies today: `browse.mjs:87`, `online.mjs:113` and booking's `ms-book-shop`.
6. Search with suggestions.
7. Shop card.
8. Basket line.
9. Checkout sections, with the Pay bar on phone.
10. Progress steps (inferred: shared with booking).
11. Emailed-code sign-in.
12. PIN pad, for the till and the workshop computer.
13. Message page.
14. Staff banner on the website.
15. Cookie choice.
16. Email frame.

**Mark's blocks reused:** Settings page, Settings row, Table, Detail page, Today cards, "Are you sure?" box, Form box, Saving/failed/Undo message, Empty list, Hidden controls. That is 10 of the 15.

**Total: 26 blocks behind 114 drawings.**

## Persona walks (clicks · screens)

- **Maya buys on a phone**, first visit, two shops: Home → category → product → Add to basket → Which shop? → View basket → Go to checkout → Pay. About 7 taps, 3 fields and the card details, across 6 screens and 1 box. Inferred from the buttons in `online.mjs`.
- **Maya collects:** "See your order" in the email (1 tap), then nothing at the counter (walk-through 2, step 7).
- **Maya signs in:** email → code. 2 taps plus email and code, 2 screens, plus a trip to the email app.
- **Jo checks in:** 4 key presses, 1 screen.
- **Jo marks an order ready:** 3 clicks (walk-through 2, step 6).
- **Jo hands over:** found from the till search (`app-map.mjs:151`). Clicks not recounted after the fix.
- **Jo's first sign-in:** email, password, then "Keep this PIN". About 3 clicks, 2 screens.
- **Alex signs in:** 2 clicks and 2 fields (walk-through 8, step 1).
- **Jack's settings path:** not counted.

## Findings

**High**
1. **A till-only Saturday worker may not be able to mark an online order ready.** "Mark ready" exists only on Online orders; a search of `till.mjs` and `app-map.mjs` found none. The invite note says till-only people "can't open anything away from the till" (`setup.mjs:275`). Walk-through 8 M6 part 1 says the rest of the shop opens as the person checked in by PIN (`2026-10-03-ux-walkthrough-8.md:60`). The two disagree. If the note wins, the customer's "ready" email is never sent. Conditional, inferred.

**Medium**
1. **The product page and the "Which shop?" box are each built twice, and the copies already differ.** One says "Ask the shop about this" (`browse.mjs:165`), the other "Ask the shop about it" (`online.mjs:96`). The two shop boxes also have different subtitles. Build plan WP-6.2 and WP-6.3 would both build them.
2. **There are two ways of typing an emailed code.** `cust-code` has six separate boxes and no code autofill (no `one-time-code` in `signin.mjs`). `on-save-details` uses one field with autofill (`online.mjs:179`). Make it one block. The single field is easier for a low-confidence phone user.
3. **With the fixed design, nothing is drawn for choosing what goes on the home page.** That means `[Featured products]` (`browse.mjs:93`) and the featured categories.
4. **It isn't stated which standard pages the first release has.** Website management decision 4 (its ready-made Contact, Collection and returns, Privacy and Cookies pages) is now later. The footer links on every page and checkout's "terms" link (`online.mjs:159`) need to point somewhere, or they are dead links. Question for Jack.
5. **The workshop computer's PIN take-over is decided but not drawn** (walk-through 8, decisions 1 and 3). It should reuse the PIN-pad block.

**Low**
1. The sign-out time on `auth-expired` is still "[n]" (walk-through 8, decision 3).
2. `wb-home-lower` is just the bottom of the scrolling home page. It doesn't need a drawing of its own.

## Real gaps

- High 1 (Saturday worker).
- Medium 3 (choosing the home page contents).
- Medium 4 (the standard pages).

## Not checked

- The real titles of `pending` and `expired`.
- Jack's click counts for settings.
- Hand-over clicks after the walk-through 2 fix.
