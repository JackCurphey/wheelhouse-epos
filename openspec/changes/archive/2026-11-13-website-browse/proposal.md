WP: WP-6.2

## Why

WP-6.1 (Website management, `openspec/changes/website-management/`, not yet archived) lets a shop set up, word, publish and switch on its website. It saves what customers should see in `website.published`. Customers still see the old site (`public-storefront/`, served at `/store/<slug>/` and `<slug>.wheelhouseepos.com`). That site is a single list of products. It knows nothing of categories, stock at each shop, search or the words the shop published. WP-6.1's design says "View website" opens the old customer site "until WP-6.2 replaces it" (`openspec/changes/website-management/design.md`, decision 2 and its written line 5; `docs/decisions/decided-while-building/2026-11-jack.md`).

This change is **WP-6.2, Find the shop and browse** (journey 1). It is the customer-facing website, where the shop's customers:

- find the shop
- look through its categories and products
- search
- see its shops
- make their cookie choice

It replaces the old customer site at the same addresses. Buying (basket, checkout, paying, orders) is WP-6.3. The full editor, theme and extra pages are later; the build plan's "Later" section says the first release has a fixed design with editable words and photos, the shop's logo and one main colour.

**It is not built yet.** A builder session builds it from this change, following Jack's answers to its four questions (12 Nov, option 1 on each; `docs/decisions/2026-11-12-website-browse-answers.md`).

## What Changes

### The website shell (`site`, `site-menu`, `site-ocean`, `site-ocean-menu`; building block 16)

- Every page has:
  - "Skip to the main content"
  - the shop's logo and name
  - **Shop**, **Book a repair** and **Our shops** (**Find us** with one shop)
  - the search box, Account and Basket
  - a footer with the shop's name and town, and **Contact us**, **Collection and returns**, **Privacy** and **Cookies**; **Cookie choices** is added when the shop has added a tracking tool
- On a phone the header has Search, Basket and **Menu**; on a tablet it uses icons.
- The shop's one main colour, chosen in WP-6.1, colours the site (`site-ocean`).
- Account and Basket appear on every page in the drawings. Where they lead belongs to other pieces: the basket is WP-6.3, and the customer account is already built at `/book/<slug>/account`.

### The home page (`wb-home`, `wb-home-lower`, `wb-home-one-shop`, `wb-first-visit`)

The sections appear in the order drawn:

1. The big photo, with the shop's headline, its line about the shop, and **Book a repair** and **Shop** buttons.
2. **Shop by category**.
3. The shop's featured products.
4. **Book a repair**, with the shop's workshop words and its repairs and prices.
5. **Our shops** (or **Find us**).
6. The shop's own words and photo.

The words and photos come from what the shop published in WP-6.1.

### Choosing the shop (`wb-choose-shop`, the chip; building block 33)

- With more than one shop, the header says "Collecting from **Bolton** · Change" or "**Choose a shop**".
- "Which shop will you collect from?" chooses a shop with one tap. The choice is remembered, and every product then says when it is ready there.
- Nothing is chosen on a first visit (`wb-first-visit`, `wb-category-no-shop`). Product cards carry no stock line until a shop is chosen.
- With one shop, there is no chip.

### Shop and categories (`wb-shop`, `wb-category`, `wb-category-filtered`, `wb-category-empty`, `wb-category-parent`, `wb-category-child`, `wb-category-no-shop`; building block 31)

- **Shop** shows every top category.
- A category page shows its products, with:
  - **Sort by**: A to Z; Price, low to high; Price, high to low; Newest
  - filters built from **the category's own details** (as Stock already keeps them), beside Availability ("Ready today at Bolton"), Brand and Price, with none ticked to start
  - removable filter chips and **Clear all**
  - "Showing 6 of [n] products" with **Show more**
- A parent category lists its types.
- On a phone, **Filter** opens a full-screen panel with **Show [n] products**.
- When nothing matches, the page names the filters that caused it and offers to remove them. **Ask the shop about it** shows the shop's phone and email in place (audit H5).

### A product (`wb-product`, `wb-product-sizes`, `wb-product-size-other`, `wb-product-photos`, `wb-product-held`; building block 32)

- The product page shows:
  - the name, and the price with "Includes VAT · [Brand]"
  - photos, which open larger with arrows and Esc
  - the availability line ("Ready today at Bolton · [n] in stock")
  - quantity and **Add to basket** (which opens WP-6.3's basket)
  - **Ask the shop about this**
  - **About it**, with the shop's description
  - a **Specifications** table filled from the category's details
- A product with sizes and colours starts with none chosen ("Colour: choose one", "Size: choose one").
- A size not in stock at the chosen shop is struck through, and the page says where it is in stock.
- A product with nothing left says "Sold out at Bolton" and offers only Ask the shop. That includes a bike held for a Cycle to Work order.

### Search (`wb-search-typing`, `wb-search-no-suggestions`, `wb-search-results`, `wb-search-measure`, `wb-search-none`; reuses building block 17)

- One search box suggests as you type, grouped into **Products**, **Repairs**, **Categories** and **Pages**, with "See all results for “brake”".
- Enter opens the results page: repairs and pages above, then products with the category filters, sorted by **Best match** first.
- A measurement ("bearing 30mm") opens the category with that detail ticked.
- When nothing is found, the page says what to try and how to ask the shop.

### Our shops (`wb-shops`, `wb-shop-page`, `wb-shop-collect`, `wb-find-us`; building block 34)

- Each shop has a card with:
  - its address
  - today's hours, or when it next opens
  - its phone number
  - **Book a repair here**
  - **Directions**, which opens the visitor's maps app; no map is built into the page
- A shop's own page adds its email, the week's hours with today in bold, its closures, the shop's words, and **Collect from here**.
- With one shop, the page is **Find us**.

### When things go wrong (`wb-not-found`, `wb-off`, `wb-off-preview`, `wb-off-preview-product`, `wb-off-preview-ask`, `wb-turned-on`; building blocks 40 and 44)

- A missing page says "We can’t find that page", with a search box, **Go to the home page** and **Our shops**.
- A switched-off website, and an address with no shop, both show only "This website isn’t available" on a plain page.
- The shop's own staff, when signed in, see the switched-off site with the banner "Only your staff can see this.", and with:
  - **Turn it on**, which also publishes the site the first time
  - **Edit this page**
  - **Back to Wheelhouse**
- Staff who can't edit the website are told who to ask.
- Once the site is on, the banner says "Your website is on." with **Turn off**.

### Cookies (`wb-cookies-banner`, `wb-cookies-choose`, `wb-cookies-saved`, `wb-cookies-page`, `wb-cookies-page-plain`; building block 45)

- A shop with no tracking tool shows no pop-up. It sets only the cookies a visit needs (basket, signing in, the chosen shop, the cookie choices), and the **Cookies** page lists them.
- A shop that added a tracking tool in WP-6.1 gets the banner, with equal **Reject all** and **Accept all** buttons and **Choose** for each kind. Nothing tracks until the visitor says yes.
- "Cookie choices" in the footer changes the choice.

### The pages the footer links to (not drawn; `docs/decisions/2026-10-08-not-drawn-pages.md` stage 6, rows 78, 79, 81)

- **Collection and returns** and **Privacy** are plain pages like the Cookies page, with the shop's published words.
- **Contact us** shows the shop card and the shop's email.

### The old site goes

- The last pull request removes the old customer site: `public-storefront/` and its `/api/storefront/products` list.
- WP-6.1's double write to `storefront_settings` stops (see its design, "The old and new website side by side").

### Not in this change, and why

- **Basket, checkout, paying, orders, and what Add to basket does** (the `on-*` screens): WP-6.3. Add to basket links there.
- **"Collect from [Second site] instead"** and the second shop's product page: WP-6.3 (`on-product-two-shops`, not-drawn row 73).
- **`wb-choose-shop`'s situation** (`on-choose-shop`): WP-6.3, as the build plan says.
- **The other 8 of `wb-product`'s 11 situations**: WP-6.3.
- **Which stock the website offers** (the three choices in Buy online decision 2), and the "Ready at Bolton in [n] days" and "We order it in" lines: left to WP-6.3 (Jack's answer 2, 12 Nov).
- **The full editor, theme, extra pages, and the shop's own web address**: later (the build plan's "Later" section). "Edit this page" opens WP-6.1's Website page.
- **A Shopify shop's website**: a shop whose website `kind` is Shopify sells on Shopify (WP-6.1). This site answers only for a Wheelhouse website.
- **Roles**: "Can edit the website" (on `wb-off-preview-ask`) waits for WP-1.1. Until then the Owner can edit it, as in WP-6.1.

## Who and risk

WP-6.2 is built by one builder session, in nine pull requests (see `tasks.md`). It is not a small piece.

**Risky: yes, for six of the nine pull requests.**

- The website is made entirely of **public routes**: no sign-in, any visitor, any shop's address. That is the third risky area (sign-in, customer accounts and public routes).
- Its routes are added to `server/server.js`, which is the fourth risky area.
- Pull requests 1, 2, 3, 7, 8 and 9 are risky. Each needs `/review`, the `risky-area-reviewer`, a hand-run CI, and a line in the weekly digest.
- Pull requests 4, 5 and 6 are screens built on routes that have already been reviewed.

It adds **no migration**: Jack's answers 1 and 3 (12 Nov) need none.

It touches no money, no stock changes and no messaging. It reads stock and never writes it.

## Follows

### Drawings

Journey 1, `docs/design/user-journeys/generator/browse.mjs`:

- screen ids in `journeys.mjs:133-186`
- the shell in `app-map.mjs` (`siteDesktop`, `siteTablet`, `sitePhone`)
- the link map, `generator/mockup/links/j01.mjs`

The screens:

- **Home and the shell:** `wb-home`, `wb-home-lower`, `wb-home-one-shop`, `wb-first-visit`, `wb-choose-shop`, and journey A's `site`, `site-menu`, `site-ocean`, `site-ocean-menu`
- **Shop and categories:** `wb-shop`, `wb-category`, `wb-category-filtered`, `wb-category-empty`, `wb-category-parent`, `wb-category-child`, `wb-category-no-shop`
- **A product:** `wb-product`, `wb-product-sizes`, `wb-product-size-other`, `wb-product-photos`, `wb-product-held`
- **Search:** `wb-search-typing`, `wb-search-no-suggestions`, `wb-search-results`, `wb-search-measure`, `wb-search-none`
- **Our shops:** `wb-shops`, `wb-shop-page`, `wb-shop-collect`, `wb-find-us`
- **When things go wrong:** `wb-not-found`, `wb-off`, `wb-off-preview`, `wb-off-preview-product`, `wb-off-preview-ask`, `wb-turned-on`
- **Cookies:** `wb-cookies-banner`, `wb-cookies-choose`, `wb-cookies-saved`, `wb-cookies-page`, `wb-cookies-page-plain`

### Build plan

`docs/superpowers/plans/2026-10-03-release-2-build-plan.md`:

- the WP-6.2 entry (17 screens and their situations)
- the "Later" lines for the editor, theme, extra pages and own address

### Decisions

- `docs/decisions/2026-10-02-find-the-shop-review.md`:
  - decisions 1–8
  - its audit (`docs/design/user-journeys/browse-ui-audit.md`: H5, M5, M6, M9, M11, M12, M13, M15)
  - the line on "Turn it on" publishing
- `docs/decisions/2026-10-01-buy-online-review.md`:
  - decision 2 (which stock is offered)
  - decision 3 (show on website)
  - the chosen shop being remembered
  - M9
- `docs/decisions/2026-10-01-multiple-sites-review.md`: "Which shop?" comes first; M8.
- `docs/decisions/2026-10-01-stock-control-review.md`: decision 10 (finding by a measurement).
- `docs/decisions/2026-10-02-website-management-review.md`:
  - pages filled from Settings
  - the free address
  - the later change to a fixed design
- `docs/decisions/2026-10-08-not-drawn-pages.md`: stage 6, rows 3, 62, 78, 79, 80, 81, 87.
- `docs/decisions/decided-while-building.md`: another shop's address gives "Storefront not found".
- `docs/decisions/decided-while-building/2026-11-jack.md`: "View website" opens the old site until WP-6.2.
- `docs/decisions/2026-11-12-website-defaults-taken.md`: none of its four defaults is about browsing, and nothing here contradicts them.

### Built

- `openspec/changes/website-management/`: what `website.published` holds; `is_on`; `kind`; tracking tools.
- `openspec/specs/stock/spec.md`:
  - categories inside categories, and each category's details
  - sizes and colours
  - stock at each shop
  - finding by a measurement
- `openspec/specs/shop-details/spec.md`: address, phone, email and opening hours.
- `openspec/specs/book/spec.md`: the booking site that the Book a repair links open.
- `openspec/specs/customer-accounts/spec.md`: "The shop's website never stops the server".
