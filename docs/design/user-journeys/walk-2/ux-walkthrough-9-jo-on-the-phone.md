# UX walk-through 9 — Jo on the phone

Story 9 (WP-W.1 in `docs/superpowers/plans/2026-10-03-release-2-build-plan.md`): journeys 15 Customer service and A App map, with 3 Book a repair and 11 Selling at the till. Walked on the one canvas (`generator/out/project/`, published at https://claude.ai/artifact/WzmMdudJPoWH5aUd7J9V4j), 3 Oct 2026, with the eighth question, screen counts and link-following from issue #116 step 4. A new story, so there is no earlier report to check against.

## The story

1. Jo Taylor is at the front desk on Till B1, Bolton (Staff land on Front desk › Till, App map 11). The phone rings: Maya Patel asks whether her Trek Domane AL 3 is ready and what it will cost.
2. Jo holds the phone in one hand and types "maya" into the till's one search box. Jo needs job WH-1042's status, its ready-by date and the approved £111.00.
3. Maya asks whether the bike is still under warranty. Jo needs her customer page.
4. Maya asks whether the shop has Shimano brake pads B05S-RX in stock and what they cost (£28.00).
5. Maya asks to book her bike in again next week. Jo makes a new job while still talking to her.
6. The same call, taken by the Saturday worker, who has used the till by PIN only and has not seen these screens for a week.

## Clicks and screens, per person

| Person | Clicks (as drawn) | Different screens | Notes |
|---|---|---|---|
| Jo Taylor, desktop at the till | 11 (3 to reach the job's status, 1 for her page, 1 for stock, about 6 for the new job) | 6: `till-search`, `diary`, `job-overview` pop-up, `cs-page`, `st-list`, `new-job` | Typing doesn't count as a click. Three of the clicks go to links with no destination (M3) |
| Saturday worker, at the till | 11 | 6 | The same path, if the till opens the rest of the shop under their Staff role (walk-through 8 M6 part 1, not drawn yet) |
| Maya Patel, on the phone | 0 | 0 | Whether a message reaches her after the new job is not checked (L4) |
| With H1, M1 and M2 fixed | about 7 | 4: `till-search`, `job-overview`, `cs-page`, `new-job` | The status and the price can be read from the search results with no click |

## Findings

### H1 — At the till, the one search can only sell. Jo can't look anything up with it

- **Screens:** `till-search` (desktop), journey A; the till search in `till-sale` (desktop), journey 11.
- **What happens:** Jo types "maya". The results are "WH-1042 · Maya Patel … approved £111.00 **Add to basket ↵**", "Order [order number] · Maya Patel … **Hand over**" and "Maya Patel … **Add to sale**". Each row is a single link (`href="#"`), and its only action is a till action. The first row is highlighted, so pressing Enter puts £111.00 of work into the basket. No row opens the job, the customer or the product. The job row shows the price but not its stage or ready-by date, so "is it ready?" can't be answered from the till at all. Jo has to unfold the rail, open the Diary, find the WH-1042 block among the week's jobs and open it. That's 3 clicks and 2 more screens before the job pop-up shows "Ready by Thu 17 Sep".
- **Why it matters:** Jo's main check is finding a customer, job or product from one box while on the phone, and Jo can't do it from the screen Staff land on. Pressing Enter out of habit adds a sale by mistake. Nothing on the till tells the Saturday worker that the status is in the Diary.
- **Fix:**
  1. **Split each row: the name opens it, and a button on the right does the till action.** The job opens its pop-up, the customer opens their page, the product opens its page. Enter and scanning still do the till action, so selling speed doesn't change. The job row also shows the stage and ready-by date ("Waiting for parts · ready by Thu 17 Sep · approved £111.00"), so the usual question needs no click. Costs: wider rows, and a mouse user selling a job clicks the button, not the row.
  2. **Keep the till's search for selling; look things up from the header search on other pages.** The till doesn't change. Costs: Jo leaves the till on every call (2 more clicks, 1 more screen), and one box behaves two ways.
  3. **Show the status in a hover box over the job row.** No layout change. Costs: hover only, so it fails keyboard, touch and screen-reader users.

  Recommend 1.
- **Decision it touches:** App map 12 (results go into the basket; option 1 keeps that for Enter and scanning, and adds opening), Customer service 12 decision (5) ("Add to a sale" only on a till).
- **8th question:** yes, this can be lines. Add two lines to `ja_sit_till-search`: "Each row: its name opens it; the button on the right does the till action" and "A job row shows its stage and ready-by date". It doesn't need a drawing.
**Second check:** CONFIRMED, with two corrections — `app-map.mjs` `searchResults()` draws every row as one `<a href="#">` whose only action is a till action, the first row highlighted with "Add to basket ↵", and the job row has no stage or ready-by; but the folded rail in `ja-till-search` already has Diary and Customers as links, so Jo does not need to unfold it: the path to the job pop-up is 2 clicks (Diary, the block), not 3 (the table's 11 becomes 10, and "about 7" becomes about 6); and by the script's definitions this is Medium, not High, because the status is reachable and no promise is broken (the Enter-adds-£111 behaviour is App map 12 as decided). The diary's hover quick look (`j12-job-quick-overview`) shows notes and lines but no stage or ready-by, which supports the finding.


### M1 — The search on every other page has no results drawn, and the app map says it doesn't find products

- **Screens:** `staff-app` (desktop), `map`, `cs-list`, `cs-page`, `job-overview`, `st-list` (desktop).
- **What happens:** every staff page has "Search jobs, customers, products" (App map 2). Only the till's search has its results drawn. `ja_sit_staff-app` has no line for "search open". The app map board says "Search sits at the top of every page (on the till it finds products too)", which reads as if products are found only at the till. The search box's own wording says products. The Stock page also has a second box, "Search stock", beside the header one. The till's box mentions "orders" and the others don't.
- **Why it matters:** Jo is often on the Customers page or the Diary when the phone goes. Nothing says what typing "B05S" shows there or what a click on a result does. Jo's check is "one search box without knowing which part of the app it lives in".
- **Fix, no choice:** add a line to `ja_sit_staff-app`: "Search open: the same groups as the till (Jobs, Orders, Customers, Products), with the same row contents; each row opens its page; no till buttons (Customer service 12(5))". Change the app map's wording to "on the till, a result can also go into the basket". Give the placeholder one wording everywhere.
- **Decision it touches:** App map 2; Customer service 12(3) ("one search — the header's").
- **8th question:** a line on `staff-app` plus one changed sentence on `map`. No new drawing.
**Second check:** CONFIRMED — `ja_sit_staff-app` has three lines and none for search open; `ja-map` reads "Search sits at the top of every page (on the till it finds products too)". One correction: the header placeholder is already "Search jobs, customers, products" on `staff-app`, `cs-list` and `st-list`; only the till's differs ("Search or scan: …, orders"), and that difference is deliberate, so "one wording everywhere" is mostly done already.

### M2 — Nothing says what a product result shows: no price or stock count in the search

- **Screens:** `till-search`, `till-sale` (desktop); `st-list`, `st-product` (desktop).
- **What happens:** the only product group drawn in the search says "No products match 'maya'". The till's quick buttons show prices but no stock. To answer "have you got B05S-RX and how much?", Jo has to leave the till for Stockroom › Stock, which shows "In stock: [n]" and "Price: £28.00". The product page's line "A product's stock at each shop, and on its way" is marked Manager. Whether Staff see the other shop's count is not stated.
- **Why it matters:** price and stock are what customers ring about, and Jo's persona check names "a product, a price". Without them the search can't answer the call.
- **Fix:**
  1. **Each product row shows the price and "[n] in stock here · [n] at [Second site]" for everyone.** Jo can say "we've got one at [Second site]". Costs: a slightly longer row, and Staff see the other shop's count.
  2. **Price and this shop's count only. Other shops stay on the product page for managers.** Shorter row. Costs: Jo can't offer the other shop on the call.

  Recommend 1.
- **Decision it touches:** Stock control (the stock at each shop, line 81 of the decision file); Multiple sites (each shop has its own stock counts, decision 4).
- **8th question:** a line on `ja_sit_till-search` (which carries over to the header search through M1). No drawing.
**Second check:** CONFIRMED — `searchResults()` draws only "No products match" and `j14-st-list` shows "In stock: [n]" and "Price: £28.00" per product; `j14_sit_st-product` tags "A product's stock at each shop, and on its way" as Manager while Stock control 8 says the product page shows stock at each shop with no role named, so whether Staff see the other shop is genuinely unsettled and option 1 does not contradict a recorded decision. Still Jack's choice.

### M3 — Dead ends where the journeys join, followed link by link

- **Screens:** `till-search`, `cs-list`, `cs-page`, `staff-app`, `new-job`, `st-product` (desktop).
- **What happens:** every result row on `till-search` goes to `href="#"`. On `cs-list`, all five recent-customer rows, Maya's included, go to `#` (only the board's Next button reaches `cs-page`). On `cs-page`, the WH-1042 row and the other job rows go to `#`, not to `j12-job-overview-desktop.dc.html`. "New job" has no link, and neither do the bike row, "+ Add" or "Edit". On `staff-app`, Till, Customers and Stock in the sidebar have no link. On `new-job`, "+ Add a bike" and "+ New customer" go to `#`. On `st-product`, "Open the job" for WH-1042 goes to `#`. The journey 12 → 15 join works: the job pop-up's "Maya Patel" link opens `cs-page`.
- **Why it matters:** the walk from customer to job to new job (journey 15 → 12 → 3) can't be clicked through. The clickable mock-up in step 5 needs these links.
- **Fix, no choice:** link them: customer rows to `cs-page`, job rows to `job-overview`, "New job" to `new-job` with Maya filled in, and "Open the job" to `job-overview`.
- **Decision it touches:** Customer service 12 ("whole rows clickable").
- **8th question:** these are links, so nothing is drawn.
**Second check:** CONFIRMED — `j15-cs-list` has six `href="#"` (five customer rows plus Add), `j15-cs-page` "New job" has no link, `j14-st-product` "Open the job" is `href="#"`, `j12-new-job` "+ Add a bike" and "+ New customer" are `#`, and `ja-staff-app`'s sidebar links only Diary and Overview; the 12 → 15 join (`j12-job-overview` line 379, Maya's name to `j15-cs-page`) does work.

### M4 — One job, three status words

- **Screens:** `diary`, `job-overview`, `cs-page`, `till-search` (desktop).
- **What happens:** for WH-1042, the diary block reads "Scheduled … approved £111". The job pop-up reads "Standard service **Expected**" with a "Bike is here" button, while the same pop-up also says "Kept on Hook 3", and the quick look behind it says "Bike booked in, tag printed". Maya's page lists "WH-1042 … **Scheduled**" with no price. The till search says "approved £111.00" with no stage.
- **Why it matters:** Jo reads one word and tells Maya something. "Expected" means the shop is still waiting for the bike, but it's on a hook.
- **Fix, no choice:** use the stage words from the diary legend everywhere. The job row on `cs-page` and in search shows the stage, ready-by date and agreed price. Make the `job-overview` example consistent: a booked-in bike, or no hook.
- **Decision it touches:** Workshop day (the stage words); the word list, "Approved".
- **8th question:** row wording, plus a fix to the example data. No drawing.
**Second check:** CONFIRMED — `diary.mjs:396` gives WH-1042 the key `scheduled` with "approved £…", `j12-job-overview` says "Expected" next to "Kept on Hook 3" and "Bike booked in, tag printed", and `cs-page` says "Scheduled"; caution: "expected" is a real job stage in Workshop day 20 and the diary legend has no "Expected", so "use the diary legend words everywhere" needs the two word lists reconciled, not just copied.

### M5 — The till's search can't be followed with a screen reader

- **Screens:** `till-search` (desktop).
- **What happens:** the results panel is `role="listbox"`, but the box has no `role="combobox"`, `aria-expanded` or `aria-controls`. The rows are plain links, not options, so a screen reader isn't told the list opened, how many results there are or which one is highlighted. "No products match" isn't announced. (The till's no-results message does use `role="status"`.) The website's search (`browse.mjs`) and the Cycle to Work search in `customer.mjs` already do this correctly.
- **Why it matters:** a screen-reader user can't find a customer while on the phone. Keyboard users have the same problem: with Enter as "Add to basket", they can't tell what Enter will do.
- **Fix, no choice:** follow the website search's pattern: a named combobox, rows as options, the highlighted row named, and the count announced. Do the same in the header search (M1).
- **Decision it touches:** none.
- **8th question:** a rule line on `ja_sit_till-search`. No drawing.
**Second check:** CONFIRMED — `app-map.mjs` `searchResults()` has `role="listbox"` and plain `<a>` rows, the input has no `role="combobox"`, `aria-expanded` or `aria-controls`; `browse.mjs:175,190` and `customer.mjs:143` use `role="option"` and the combobox attributes.

### L1 — Maya's email differs

`till-customer` shows "maya@example.com". `cs-page`, `job-overview` and `new-job` show "maya@example.test". Fix, no choice: use one. *8th: example data only.*
**Second check:** CONFIRMED — `j11-till-customer` says maya@example.com; `cs-page` and `j12-new-job` say maya@example.test.

### L2 — "Switch site" against "shop"

On `till-search`, `till-rail` and `till-sale`, the switcher's screen-reader name is "Switch site". Everywhere else it is "Shop: Bolton. Choose a shop" (Multiple sites 9; the word list says "shop"). The job pop-up's "View Maya Patel's account" opens her customer page, but "account" elsewhere means pay-later (`cs-account`). Fix, no choice: "Shop: Bolton. Choose a shop", and "Open Maya Patel's page". Touches Multiple sites 9. *8th: wording.*
**Second check:** CONFIRMED, wider than stated — "Switch site" appears on about 30 boards (every `j11-till-*`, `j10-op-float-*`, `j16-eod-*`, `ja-till-rail`, `ja-till-search`), and `j12-job-overview` line 379 says "View Maya Patel's account"; the fix is a wording change in the shared till bar, still no drawing.

### L3 — What the search finds isn't written down

`cs-list` says "by name, phone, email or postcode". The till's no-results message says "part of the name, a part number, a phone number or a job number". Nothing says whether a bike (make, or frame number), a pending request with no WH number ("Pending Sam Reed") or a booking can be found. Nothing says where the cursor starts, or how to get back to the search with one key, which matters for one-handed typing. Fix, no choice: one line on `ja_sit_staff-app` listing what's searched, including requests in the Jobs group, and saying the cursor starts in the search on the till and one key returns to it. *8th: a line.*
**Second check:** CONFIRMED — `j15-cs-list` says "by name, phone, email or postcode", the till's no-results text says "part of the name, a part number, a phone number or a job number", and no `ja_` line or map text covers bikes, requests, or cursor start.

### L4 — New job doesn't say whether Maya gets a message

`new-job` saves with "Save job". Nothing says whether "Booking confirmed" goes to Maya ("Customer's choice", Book a repair 12), so Jo can't promise "you'll get a text". Fix, no choice: a line on `new-job`'s list: "Saved: 'Booking confirmed sent to 07700 900 142', or 'No message — no phone or email'". Touches Book a repair 12. *8th: a line.*
**Second check:** CONFIRMED — `j12_sit_new-job` has one line and the `j12-new-job` pop-up has no message line; Book a repair 12 only covers the customer's own booking. Whether a staff-made job sends a message is a decision nobody has recorded, so the wording of the line may need Jack.

### L5 — A Ready bike filed under "Earlier"

On `cs-page`, "Open now" lists three Scheduled jobs, one on Wed 16 Sep, before today. WH-1074, "Ready", Fri 18 Sep, sits under "Earlier". Jo would miss that Maya has a bike to collect. Fix, no choice: in the example data, a Ready job goes in "Open now" (Customer service 12: "what's open now at the top"). *8th: example data.*
**Second check:** CONFIRMED, and worse than stated — `diary.mjs:441` dates WH-1074 (Ready) Fri 18 Sep, the day after "Today" (Thu 17 Sep), so it is a Ready job in the future as well as under "Earlier"; the example data needs both fixed.

**Access and the Saturday worker:** keyboard users can open the rail with its Unfold button (App map 5), and diary blocks are links. Your settings has "Larger text" and "Show status symbols" for low vision; the search panel with larger text is not checked. For the Saturday worker, H1 and M1 matter most. The labels are in shop words.

## Second check

Second reviewer, 3 Oct 2026, boards, generator modules and decision files read as listed in each line above.

**Counts:** 11 findings checked: 11 CONFIRMED, 0 REFUTED, 0 UNCERTAIN. One severity change (H1 to Medium) and one click-count correction (H1: 2 clicks, not 3).

**Added by the second reviewer (sure of these):**

- The folded rail already links Diary, Customers and Stock (`ja-till-search` nav "Main, folded"), so the "unfold the rail" step in H1, the Clicks table (Jo 10, not 11; fixed path about 6, not 7) and the Saturday worker's count are each one too high.
- No finding adds a drawing where a situation-list line would do. None reopens a decision without saying so; H1 option 1 changes how App map 12 behaves for a click (not Enter), which the report does name.
- Not checked by me: rendered boards, Larger text, tablet and phone.

## Earlier findings

This is a new story with no earlier report. In passing: walk-through 2 M4 (an Orders group in the till's search) and walk-through 5 M5 (Cycle to Work found by quote number, as a line on `till-search`) are both on the one canvas.

## The end table

| Id | Screens | One line | Jack chooses? |
|---|---|---|---|
| H1 | `till-search`, `till-sale` | Till search can only sell; it can't open or show a job's status | Yes |
| M1 | `staff-app`, `map`, `st-list` | Header search results not drawn; map says products only at the till | No |
| M2 | `till-search`, `st-product` | No price or stock count in product results | Yes |
| M3 | `till-search`, `cs-list`, `cs-page`, `staff-app`, `new-job`, `st-product` | Dead links at the 15 → 12 → 3 joins | No |
| M4 | `diary`, `job-overview`, `cs-page`, `till-search` | WH-1042 is Scheduled, Expected and "approved" at once | No |
| M5 | `till-search` | Search not a screen-reader combobox | No |
| L1 | `till-customer`, `cs-page` | Two email addresses for Maya | No |
| L2 | till boards, `job-overview` | "Switch site"; "View … account" | No |
| L3 | `staff-app`, `till-search` | What's searched, and where the cursor starts, unwritten | No |
| L4 | `new-job` | Whether Maya is messaged not said | No |
| L5 | `cs-page` | Ready job under "Earlier" | No |

## Choices for Jack

1. **H1, the till's search:** (1) each row opens what it is, a button on the right sells, and the job row shows its stage and ready-by date (recommended); (2) keep the till's search for selling and look things up from other pages; (3) show the status in a hover box.
2. **M2, product results:** (1) price, plus the stock count here and at [Second site], for everyone (recommended); (2) price and this shop's count only.

## Verification

- **Boards read** (text, buttons, links; desktop only, none seen rendered): `ja-map`, `ja-staff-app`, `ja-till-rail`, `ja-till-search`, `ja-your-settings`, `j15-cs-list`, `j15-cs-page`, `j11-till-sale`, `j11-till-customer`, `j12-job-overview`, `j12-new-job`, `j14-st-list`, `j14-st-product`.
- **Situation lists** in `canvas.json`: `ja_`, `j03_`, `j11_`, `j15_`, `j14_sit_*`, `j12_sit_diary`, `j12_sit_job-overview`, and the `_later` notes (none for A, 3, 11, 15). **Code:** `app-map.mjs` (`searchResults`), `till.mjs` (`noResults`), `consolidate/ja.mjs`, `consolidate/j11.mjs`, and `browse.mjs` and `customer.mjs` for the combobox pattern.
- **Decisions:** App map (29 Sep) and Customer service (30 Sep) in full, with their later changes. Selling at the till and Book a repair: the opening sections and the search and booking-change parts. UX walk-through decisions of 2 Oct (walk-through 2) and 3 Oct (walk-through 8). Build-plan questions. Stock control and Multiple sites: only the parts about stock at each shop.
- **Not checked:** journey 3's customer pages (not on Jo's path); whether a job made by staff sends a message; tablet and phone; the search panel with Larger text on; the rest of the till and booking decision files.
