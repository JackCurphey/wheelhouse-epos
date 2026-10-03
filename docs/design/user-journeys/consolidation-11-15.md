# Consolidation — journeys 11, 15

Read-only analysis for issue #116 step 1, 3 Oct 2026. The screen counts come from `generator/journeys.mjs:681-752` (journey 11, `sc(...)`) and `:916-957` (journey 15, `sd15(...)`), checked by count: 52 and 23. Every screen is drawn at desktop, tablet and phone (`till.mjs:509-512`, `customer.mjs:285-290`), so the **75 screens are 225 boards**. Two more "option" boards (`cs-opt-folds`, `cs-opt-timeline`) sit only on the customer canvas and are not in the journey map. Anything marked *(inferred)* is my reading and not written anywhere.

## Counts by class

| Class | J11 Till | J15 Customers | Total |
|---|---|---|---|
| Real screen (its own page, or its own pop-up box) | 20 | 10 | 30 |
| A situation of another screen | 28 | 11 | 39 |
| Edge case | 4 | 1 | 5 |
| Settings | 0 | 1 | 1 |
| Put off until later by the 3 Oct answers | 0 | 0 | 0 |
| **Drawn now** | **52** | **23** | **75** |

None of the 75 screens is one of the 3 Oct put-off screens. However, `till.mjs:26-40` still holds the code for the "Practice: not real money" band, which journey 9's boards use. Practice mode was dropped on 3 Oct (moving decision file, "Later change"), so that code goes when the drawings are redone.

**Real screens (30):**
- Till: `till-sale`, `-line`, `-customer`, `-variant`, `-serial`, `-pay`, `-card`, `-pay-cash`, `-pay-split`, `-receipt`, `-giftcard`, `-account`, `-deposit`, `-park`, `-find`, `-sale-detail`, `-refund`, `-void`, `-collect`, `-c2w-pick`.
- Customers: `cs-list`, `cs-page`, `cs-credit`, `cs-edit`, `cs-add`, `cs-account`, `cs-transfer`, `cs-privacy`, `cs-privacy-delete`, `cs-merge`.

**Edge cases (5):** `till-refund-noreceipt`, `till-needs-net`, `till-no-signout`, `till-failed` (for a manager), `cs-privacy-blocked`.

**Who sees them:** Staff, except `till-failed` (Manager), `cs-groups` (Owner) and `cs-privacy*` (Owner). The privacy screens are drawn with Jack Lewis signed in (`customer.mjs:225`).

## Main tasks walked

These are clicks on the main path, with typing listed separately. Several of these steps are drawn today as separate boards.

| # | Task (who) | Clicks | Different screens | Where they get lost |
|---|---|---|---|---|
| 1 | Simple card sale (Jo) | about 2, plus one tap per item | 1 page and 3 boxes | — |
| 2 | Discount and split payment (Jo) | about 11, plus 2 amounts typed (walk-through 2:20) | 1 page and 5 boxes | — |
| 3 | Refund with the receipt (Jo) | about 5 (walk-through 2:21) | 1 page and 3 boxes | — |
| 4 | Refund an older sale by name (Jo) | about 5, plus typing *(inferred from `till-find-customer` and `till-refund-older`)* | 1 page and 3 boxes | Fixed by walk-through 2 M10 |
| 5 | Pay for workshop job WH-1042 (Jo) | about 4 *(inferred: search, "Add to basket ↵", `app-map.mjs:49`)* | 1 page and 3 boxes | — |
| 6 | Cycle to Work hand-over (Jo) | about 6 *(inferred)* | 1 page and 3 boxes | — |
| 7 | Hand over a repair paid online (Saturday worker, till only) | not possible | — | **H1** |
| 8 | Customer pays off their account by card (Jo) | not drawn | 2 or more | **H2** |
| 9 | Jo on the phone finds Maya and the job | 1, plus typing; +1 for the job | 2 (customer page, then job page) | M2 for a till-only worker |
| 10 | Record a bank transfer | 3 | 1 page and 2 boxes stacked | — |
| 11 | Delete someone's details (Owner) | 3 from Customers | 2 pages and 1 box | — |

## Merge table

| Drawn now (ids) | Becomes | Screens saved | Decision touched |
|---|---|---|---|
| `till-sale` with `-empty`, `-noresults`, `-held`, `-held-job`, `-discounted`, `-loyalty`, `-job`, `-job-balance`, `-c2w`, `-c2w-deposit`, `-offline`, `-offline-long` | **The till page**, with 12 situations | 12 | Till 5, 11, 12; Customer service 10; walk-throughs 2 M6, 3 H1, 5 H1/H2 |
| `till-line` with `till-discount` | **The line box**; "the whole sale" is a situation | 1 | Till 3 says a whole-sale discount uses the "same controls as a line" (`till.mjs:204-205`) |
| `till-pay` with `-pay-other`, `-pay-discounted`, `-c2w-pay`, `-c2w-extra` | **Take payment box**: "any total", "Other opened", "Cycle to Work provider", "two payments" | 4 | Till 6, 15 |
| `till-card` with `-card-discounted`, `-card-declined` | **Card machine box**: waiting, approved, declined | 2 | Till 6 |
| `till-pay-split` with `-split-discounted` | **Split box** | 1 | — |
| `till-receipt` with `-c2w-paid` | **Paid box** | 1 | Till 7 |
| `till-deposit` with `-job-deposit` | **Deposit box**; "on a job" is a situation | 1 | Till 11 |
| `till-find` with `-find-customer` | **Past sales box** | 1 | Till 13 |
| `till-sale-detail` with `cs-sale` | **One past-sale box**; "opened from the customer page" is a situation | 1 | Customer service 12; Till 13 |
| `till-refund` with `-refund-older`, `-refund-cash`, `-refund-noreceipt` | **Refund box**: today or earlier, card or cash, no receipt | 3 | Till 9 |
| `till-collect` with `-collect-offline` | **Hand-over box** | 1 | Walk-through 2 M7 |
| `till-needs-net` with `-noted`, `-no-signout` | **Messages**, not drawings | 3 | Walk-through 2 M7 |
| `cs-page` with `-over`, `-new`, `-off`, `-c2w`, `-c2w-collected`, `-dup`, `ls-customer-page` | **The customer page**, with 7 situations | 7 | Customer service 5, 6, 12; walk-throughs 5 M5, 6 M3, 7 L3 |
| `cs-add` with `-add-company`, `-add-match`, `cs-edit` | **One person form**: adding, company, match found, editing | 3 | Customer service 3, 5, 12(4). Edit keeps its pop-up and "Save changes", so nothing is reopened |
| `cs-privacy` with `-privacy-delete`, `-privacy-blocked` | **Privacy page**; the delete check uses the shared "are you sure?" box | 2 | Customer service 9, 12(2) |
| `cs-search-c2w` | A line in **journey A's search results** | 1 | Walk-through 5 M5 |
| `cs-groups` | A line in **journey 8's Settings › Payments** (drawn once, there) | 1 | Customer service 8 |

**Total saved: 45.** That gives **52 → 21** for the till (20 real screens plus `till-failed`, which has a list layout of its own) and **23 → 8** for customers. **Reduced count: 75 → 29 drawings.**

- **Sizes:** draw desktop only, except one phone board for the till page. On a phone the basket becomes a bar along the bottom (`till.mjs:23-25`), which changes the layout. That makes about **30 boards in place of 225.**
- **A further option:** the gift card, put-on-account and deposit boxes share one layout: a customer or card row, three or four figure rows, a note and two buttons (`till.mjs:285-305`). They could be one "other way to pay" box, which would make the till 19 drawings.
- **Too big for a first release:** nothing stands out. Everything here is in work packages 3.1 and 3.2 of the build plan (`build-plan.md:208-216`). Most of the bulk is Cycle to Work boards that are really situations.

## Building blocks — 16 blocks for 75 screens

**From Mark's list of 15 (11 used):**
- 1 Settings page (customer groups only, moved to journey 8)
- 3 Table or list (past sales, parked sales, recent customers, privacy requests)
- 4 Detail page (the customer page)
- 8 "Are you sure?" box (void, delete, can't delete yet)
- 9 Form box (person form, bank transfer, store credit)
- 10 Saving / failed / undo message (noted for later, sales waiting to send)
- 11 Empty list (empty basket, no results, new customer)
- 12 Hidden controls (accounts switched off, Lightspeed shop, Staff can't change the limit, "Add to sale" only on a till)
- 13 Shop switcher (the shop name on history rows)
- 14 Activity list (the customer's history with filter pills)
- 15 Job page (linked to, not redrawn)

**Not on Mark's list (5 new):**
1. **Till page:** quick buttons grouped under pills on the left; the basket on the right, with warnings on lines, locked lines, a discount row, the customer row and the collected pill.
2. **Payment step:** method buttons, the "Other" list, card machine progress, cash notes, the split record and the Paid box with its countdown. This is shared with the Lightspeed-connected payment version later.
3. **Pick-one box:** size and colour, which frame, customer, Cycle to Work order, parked sales.
4. **Status band:** offline and sales waiting.
5. **Search results** (journey A's one search box).

`cs-merge` (side-by-side compare) is a one-off, not a block.

## Persona findings

**High**

1. **H1: a till-only Saturday worker can't hand over a repair that was paid online, or book a bike in.**
   - Walk-through 8 decision 8 (`2026-10-03-ux-walkthrough-8.md:48-51`) says "Two new till screens". Neither is in `journeys.mjs`. The till-only rule says "they can't open anything away from the till" (`setup.mjs:271-276`).
   - Suggestion: make both situation lines, not drawings. Handing over the repair becomes a situation of `till-job` ("already paid online, nothing to take"). Booking in reuses the job page's book-in box on the till.
   - Jack to confirm before treating the decision's "two new till screens" that way. It isn't a contradiction, because the behaviour is the same.
2. **H2: paying off an account at the till has no screen.**
   - `cs-account` offers "Take a payment at the till" (`customer.mjs:207`). No till board shows an account balance in the basket: searching `till.mjs` for "balance", "owes" and "pay off" finds only the gift card and the job balance.
   - Touches Customer service 7. The fix is one situation of the till page.

**Medium**

1. **M1:** Customer service 12(1) says a sale over the account limit warns and is allowed, with a reason recorded. `till-account` (`till.mjs:292-297`) shows the limit but has no over-limit state. That should be a situation line.
2. **M2 *(inferred)*:** a till-only Saturday worker can't open a customer page at all. The till search offers customers only "Add to sale" (`app-map.mjs:51`). So the "Jo on the phone" check passes for staff with an email sign-in but fails for till-only workers. Touches Customer service 12(5). Settle it in build-plan step W.1 or W.2.
3. **M3:** the same past sale is drawn twice, with different words: "Reprint" on `till-sale-detail` and "Print the receipt" on `cs-sale` (`customer.mjs:250`). Also, "Refund at the till" pressed away from a till leads to no drawn screen.
4. **M4:** after a deposit on an ordinary sale (`till-deposit`, "Left to pay later"), paying the rest is not drawn. It is drawn only for workshop jobs (`till-job-balance`). Searched `till.mjs` for "Left to pay" and "rest later".

**Low**

1. **L1:** four boards exist only to show that the discounted total carries through to payment (`-discounted`, `-pay-discounted`, `-card-discounted`, `-split-discounted`). They are pure situations.
2. **L2:** the Paid box closes on a timer, which is still an accessibility risk for the Saturday worker (walk-through 1 L6).
3. **L3:** journey 15 hasn't been walked as any persona's story yet (`build-plan.md:99-100`). The walks here come from reading the code, not from a full walk-through.

**Read for this report:** `journeys.mjs`, `till.mjs`, `customer.mjs`, `personas.md`, `ux-walkthrough-script.md`; the till, customer service, leftover screens and walk-through 8 decision files; walk-throughs 1–8; the build plan; issue #116. `stage1.mjs`, `ui.mjs` and the 3 Oct "names" file were read only for their exports and these screen ids.
