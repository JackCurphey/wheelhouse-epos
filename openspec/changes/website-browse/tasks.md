Each group is one pull request of about 250–600 changed lines. **Risky** marks a pull request in a risky area (public routes, `server/server.js`). Before merging one: run `/review` and the `risky-area-reviewer` agent, hand-run CI (`gh workflow run test.yml --ref <branch>`) and wait for green, and add it to the weekly digest. The other pull requests use the `reviewer` agent. Every test is watched failing for the right reason before the code is written. Run only the related test files while building. Before each merge, run `npm run full-check` (lint, `npm test`, `npm run test:browser`) on the final commit after merging main.

Jack answered questions 1–4 in `design.md` on 12 Nov, option 1 on each (`docs/decisions/2026-11-12-website-browse-answers.md`).

## 1. Risky — the site's read routes: shop, published words, categories, shops

- [x] 1.1 Test: `GET /api/site` finds the shop by `<slug>.wheelhouseepos.com` and by `/store/<slug>/`, and answers name, logo, main colour, the seven published parts and the shops (two shops in the test; neither sees the other)
- [x] 1.2 Test: a switched-off website, an unknown shop and a Shopify-kind website all answer the same 404, "This website isn’t available" (wb-off)
- [x] 1.3 Test: the draft is never in the answer, and tracking tools come with kind and name only, no ID
- [x] 1.4 Test: `preview` and `canTurnOn` are set only for signed-in staff of this shop, with the site off
- [x] 1.5 Test: `GET /api/site/categories` answers the tree with counts of online, active, priced products only
- [x] 1.6 Test: the rate limit turns away a visitor past the limit and not another visitor
- [x] 1.7 Test: a failed read answers 503 with "Something went wrong — try again" and the server keeps running
- [x] 1.8 Build `server/routes/site.js` with `resolveStorefrontShop`, `runWithShop`, the limiter and `// screens:` lines; mount it in `server/server.js`
- [x] 1.9 Today's hours and the next opening worked out in the shop's time zone (the shared hours on the first shop's card only, Jack's answer 1); test it on an open day, a closed day and a closure
- [x] 1.10 Self-review, `/review`, `risky-area-reviewer`, hand-run CI, full check, merge

## 2. Risky — products: listing, filters, sort, product, suggestions and search

- [x] 2.1 Test: `GET /api/site/products?category=` lists six at a time A to Z with the total and `after` for the next six; offline, archived and £0 products never appear
- [x] 2.2 Test: filters from the category's own details (number with unit, text), AND between details and OR within one, Brand, Price From/To, and "Ready today at [shop]"; each value's count agrees with the list
- [x] 2.3 Test: a parent category offers only Availability, Brand and Price, and its subcategories
- [x] 2.4 Test: the sorts A to Z, Price low to high and high to low, and Newest
- [x] 2.5 Test: `GET /api/site/products/:id?shop=` answers name, price, brand, description, photos (own and sizes', no repeats), specifications, sizes and colours with the stock line `ready`, `elsewhere`, `sold-out` or `none`; never cost or supplier; a held last bike counts as sold out
- [x] 2.6 Test: a `shop` that isn't one of this business's shops is ignored (no stock line)
- [x] 2.7 Test: `GET /api/site/suggest` groups products, repairs, categories and pages, starts from the second letter, and has its own limit
- [x] 2.8 Test: `GET /api/site/search` answers repairs and pages that match and products by Best match; "bearing 30 mm" answers Bearings with inner diameter 30 mm ticked; nothing found answers empty
- [x] 2.9 Build the queries in `server/site-products.js`, reusing Stock's detail filter and "bearing 30 mm" reading
- [x] 2.10 Self-review, `/review`, `risky-area-reviewer`, hand-run CI, full check, merge

## 3. Risky — the website app: shell, home, Shop, not found, off, footer pages

- [x] 3.1 Add the `website` entry to `vite.config` (`src/website/main.tsx`) and serve it in `server/server.js` at `/store/<slug>/…` and `<slug>.wheelhouseepos.com/…`, in place of `public-storefront/`; test that both addresses get the new app and that `/book/<slug>` is unchanged
- [x] 3.2 Screen test: the shell (site): Skip to the main content, logo, Shop, Book a repair, Our shops, "Search the shop", chip, Account, Basket, footer links, current page marked
- [x] 3.3 Screen test: the phone menu (site-menu) opens, closes on Esc and returns focus
- [x] 3.4 Screen test: the main colour (site-ocean, site-ocean-menu) and "Find us" with one shop
- [x] 3.5 Screen tests: wb-home, wb-home-lower, wb-home-one-shop and wb-first-visit with the drawn example data; an empty section is left out; featured products are the newest four with a photo
- [x] 3.6 Screen test: wb-shop lists the categories with their subcategories
- [x] 3.7 Screen tests: wb-not-found and wb-off
- [x] 3.8 Screen tests: Collection and returns, Privacy and Contact us show the published words and the shops' details
- [x] 3.9 Basket and Add to basket open the basket path's "can't take orders online yet" message until WP-6.3 (written line 1); log it in this month's decided-while-building file
- [x] 3.10 Build `src/website/` (shell, home, Shop, not found, off, footer pages)
- [x] 3.11 Browser test: the home page on a phone and a computer
- [ ] 3.12 Self-review, `/review`, `risky-area-reviewer`, hand-run CI, full check, merge

## 4. Category pages with filters

- [ ] 4.1 Screen tests: wb-category (six, "Showing 6 of [n] products", Show more moving focus, nothing ticked) and wb-category-filtered (chips "Remove filter …", Clear all, the count)
- [ ] 4.2 Screen tests: wb-category-parent, wb-category-child (path "Drivetrain › Derailleurs") and wb-category-no-shop
- [ ] 4.3 Screen test: wb-category-empty, with "Nothing matches", the sentence naming what is ticked, "Clear all filters" and "Ask the shop about it" showing phones and emails in place (no "Show ones ready in [n] days" until WP-6.3, Jack's answer 2)
- [ ] 4.4 Screen test: the sort menu, and filters and sort kept in the address for Back and a shared link
- [ ] 4.5 Screen test: Price From/To applies on leaving the box or pressing Enter
- [ ] 4.6 Screen test: the phone Filter panel's "Show [n] products" applies only when pressed
- [ ] 4.7 Build the category page, the filters `aside` and the phone panel
- [ ] 4.8 Browser test: filtering a category on a phone and a computer
- [ ] 4.9 Self-review (`reviewer`), full check, merge

## 5. The product page

- [ ] 5.1 Screen test: wb-product ("£28.00", "Includes VAT · Shimano", "Ready today at Bolton · [n] in stock", Add to basket, Ask the shop about this, About it, Specifications)
- [ ] 5.2 Screen test: wb-product-sizes ("Colour: choose one", "Size: choose one", nothing chosen, "Choose a colour and size to see when it’s ready")
- [ ] 5.3 Screen test: wb-product-size-other (struck size, the drawn sentence, " — not in stock at Bolton" for screen readers)
- [ ] 5.4 Screen test: wb-product-held ("Sold out at Bolton")
- [ ] 5.5 Screen test: wb-product-photos ("Photo 2 of 4", arrows, Esc closes and returns focus); one photo shows no viewer; no photo shows the name tile
- [ ] 5.6 Screen test: a product that isn't online shows wb-not-found
- [ ] 5.7 Build the product page and the photo viewer
- [ ] 5.8 Browser test: choosing a colour and size on a phone
- [ ] 5.9 Self-review (`reviewer`), full check, merge

## 6. Search

- [ ] 6.1 Screen test: wb-search-typing (groups, "See all results for “brake”", arrow keys, a listbox inside `role="search"`, a 250 ms wait before asking)
- [ ] 6.2 Screen test: wb-search-no-suggestions
- [ ] 6.3 Screen tests: wb-category-search-results ("Results for “brake”", "Repairs for “brake”", Best match first), wb-category-search-measure and wb-category-search-none
- [ ] 6.4 Build the search box and the results page (reusing group 4's list and filters)
- [ ] 6.5 Measure suggestions with the full seed; note the time in the pull request
- [ ] 6.6 Browser test: searching from the shell on a phone and a computer
- [ ] 6.7 Self-review (`reviewer`), full check, merge

## 7. Risky — the chosen shop, Our shops and the shop page

- [ ] 7.1 Test: the `wh_shop` cookie is set on choosing, read on every visit, and ignored when it names a shop the business doesn't have
- [ ] 7.2 Screen tests: the chip ("Choose a shop", "Collecting from Bolton · Change") and wb-choose-shop ("Which shop will you collect from?", "We’ll remember it, and show when things are ready there")
- [ ] 7.3 Screen tests: wb-shops (cards, today's hours, Book a repair here with the shop, Directions "(opens your maps app)") and wb-shop-page (today in bold, closures, Collect from here)
- [ ] 7.4 Screen tests: wb-shop-collect (the drawn sentence, the chip changes) and wb-find-us (one shop, no Collect from here)
- [ ] 7.5 Build the chip, the Which shop box, Our shops and the shop page
- [ ] 7.6 Self-review, `/review`, `risky-area-reviewer`, hand-run CI, full check, merge

## 8. Risky — cookies and the staff banner

- [ ] 8.1 Test: with a tracking tool, no tool script is on the page until Accept all, or until Save my choices turns its kind on; Reject all is remembered in `wh_cookies`
- [ ] 8.2 Screen tests: wb-cookies-banner, wb-cookies-choose and wb-cookies-saved
- [ ] 8.3 Screen tests: wb-cookies-page (table from the one list in the code, tools the shop added, what was chosen, Change cookie choices) and wb-cookies-page-plain
- [ ] 8.4 Test: `POST /api/site/turn-on` and `turn-off` work only for this shop's signed-in Owner, use the Website page's own publish-and-switch, and refuse anyone else
- [ ] 8.5 Screen tests: wb-off-preview, wb-off-preview-product, wb-off-preview-ask ("Ask Jack Lewis to turn it on.") and wb-turned-on ("Your website is on.", "Customers can see it now.", Turn off)
- [ ] 8.6 Test: a customer, and staff of another shop, see only wb-off on a switched-off website
- [ ] 8.7 Build the cookie banner, Choose cookies, the Cookies page and the staff banner
- [ ] 8.8 Browser test: the cookie banner on a phone
- [ ] 8.9 Self-review, `/review`, `risky-area-reviewer`, hand-run CI, full check, merge

## 9. Risky — remove the old site and archive

- [ ] 9.1 Test: `/api/storefront/products` answers 404, and `/store/<slug>/` serves the new website
- [ ] 9.2 Remove `public-storefront/` and `listStorefrontProducts`, and stop the Website page writing `storefront_settings` (old-app removal, rule 5)
- [ ] 9.3 Check that every journey 1 screen and the four `site` screens have at least one test (build plan line 131)
- [ ] 9.4 Self-review, `/review`, `risky-area-reviewer`, hand-run CI, full check
- [ ] 9.5 `/opsx:archive website-browse` as the last commit, then merge
