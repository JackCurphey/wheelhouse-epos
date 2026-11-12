## Context

What this piece builds on:

- **Finding the shop.** `server/storefront.js` already does this in three steps:
  - `parseStorefrontSlugCandidate` reads the shop's name from the address. It tries `<slug>.wheelhouseepos.com` first (`STOREFRONT_BASE_DOMAIN`, with www, app, api, admin and staff reserved), then `/store/<slug>/`, then `?storefrontSlug=`.
  - `resolveStorefrontShop(req, url, sessionShopId)` answers only when the website is on (`website.is_on`), or when the signed-in staff member's own shop is asked for.
  - `getStorefrontInfo` reads only `website.published`, never the draft, and reports the published tracking tools (WP-6.1 design 2, "Customer side").
- **How the server dispatches these requests.** `server/server.js` routes `/api/storefront/*`, `/store/<slug>/` (the old static `public-storefront/`) and `/book/<slug>` (the booking app, `src/customer/`). It finds the shop once, then runs the handler inside `runWithShop(shop.id, …)`, so row-level security holds every query to that shop. These routes have no rate limit today. The portal's routes (`server/routes/portal.js`) use `makeRateLimiter` (`server/lib/http.js`).
- **What the website shows (WP-6.1, `openspec/changes/website-management/`):**
  - `website` (migration 141), with `published`, `is_on`, `kind` (wheelhouse or shopify) and `live_version_id`
  - the seven published parts: `headline`, `about_line`, `big_photo`, `workshop_words`, `shop_words`, `collection_returns`, `privacy`
  - `logo`, `main_colour` and `tracking`
- **Products (Stock, `openspec/specs/stock/spec.md`):**
  - `products`, with `name`, `price`, `brand`, `description`, `photo_url`, `show_online`, `active`, `created_at`, `category` (a path such as "Drivetrain › Derailleurs") and `vat_rate_bp`
  - `product_categories` (migration 119), a tree joined by " › "
  - each category's own details and each product's answers (`product_details`, `value_number`/`value_key`/`value_text`, migration 121), which Stock already uses to filter a category and to find "bearing 30 mm"
  - sizes and colours as one product group (`product_groups`, migration 120; each size has its own `size`, `colour` and `photo_url`)
  - stock at each shop (`product_stock`, migration 117), with `sites` (migration 036) as the shops
- **The shop's details (`openspec/specs/shop-details/spec.md`).** The address, phone, email and opening hours are "one set for the whole business until shops have sites".
- **Repairs.** The workshop's services and their prices, as the booking site lists them (`openspec/specs/book/spec.md`).
- **Sign-in cookies.** Sessions are set with no `Domain` (`server/lib/session.js`), so they belong to the address that set them. A staff member signed in at `app.wheelhouseepos.com` is not signed in at `<slug>.wheelhouseepos.com`.

## Goals / Non-Goals

**Goals:**

- Build journey 1's customer website as drawn, in place of the old customer site and at the same addresses.
- Read only what the shop published and switched on.
- Show stock at the chosen shop.
- Filter by each category's own details, and search across products, repairs, categories and pages.
- Show the staff banner on a switched-off site.
- Ask before any tracking cookie is set.

**Non-Goals:**

- The basket, checkout, paying and orders (WP-6.3).
- Which stock is offered beyond the chosen shop's shelf (WP-6.3, Jack's answer 2).
- The editor, theme, extra pages and the shop's own web address (later).
- A Shopify shop's website.
- Roles (WP-1.1).
- Any change to how stock, prices or products are saved.

## Decisions

### 1. The website is a third app in the same build, served at the old site's addresses

- A new entry, `src/website/main.tsx`, joins `staff` and `book` in `vite.config` (named entry points).
- `server/server.js` serves it at `/store/<slug>/…` and at `<slug>.wheelhouseepos.com/…`, where `public-storefront/` is served today. Unknown paths fall through to the app, which draws `wb-not-found`.
- The booking app stays at `/book/<slug>`. "Book a repair" and "Book a repair here" link there, with `?site=` for a chosen shop when there is more than one.
- Account links to `/book/<slug>/account` (Customer accounts, built).
- Basket and Add to basket link to WP-6.3's basket path. Until WP-6.3 is merged they show the basket's own "coming soon" state; see written line 1.
- The old `public-storefront/` and `/api/storefront/products` stay until pull request 9 removes them, so nothing breaks between pull requests.
- Chosen over a new path, because WP-6.1's design and "View website" already say the new site replaces the old one.

### 2. Read-only public routes under `/api/site/`, each inside the shop found from the address

| Route | Answers | Screens |
|---|---|---|
| `GET /api/site` | Shop name, logo, main colour; the seven published parts; shops (sites) with name, address, phone, email, today's hours or next opening; tracking tools (kind and name only, never the ID until the visitor accepts); `preview` (staff of this shop, site off), `canTurnOn` | shell, `wb-home`, `wb-off-preview*`, `wb-cookies-*` |
| `GET /api/site/categories` | The tree: each category's name, path, product count, and its types | `wb-shop`, `wb-home` |
| `GET /api/site/products?category=&filter[...]=&sort=&shop=&after=` | One page of products, plus the filters for that category (each detail's values with counts, brand, price range, availability) and the total | `wb-category*` |
| `GET /api/site/products/:id?shop=` | The product, its photos, its specifications (the category's details with this product's answers), its sizes and colours with stock at each shop | `wb-product*` |
| `GET /api/site/suggest?q=&shop=` | Up to the drawn groups: products, repairs, categories, pages | `wb-search-typing`, `wb-search-no-suggestions` |
| `GET /api/site/search?q=&filter[...]=&sort=&shop=&after=` | Repairs and pages that match, products as `/products` does with Best match, and a measurement read as a category plus a detail | `wb-search-*` |
| `POST /api/site/turn-on`, `POST /api/site/turn-off` | Staff only, this shop's Owner until roles; calls WP-6.1's own publish-and-switch code, never a copy of it | `wb-off-preview`, `wb-turned-on` |

- **Each route finds the shop** with `resolveStorefrontShop`, then runs inside `runWithShop`. An unknown shop, or a switched-off one asked for by anyone but its own signed-in staff, gets one answer: 404, `{ error: "This website isn’t available" }` (`wb-off`). That answer is the same for both cases, so the address of a switched-off shop can't be told from one that doesn't exist.
- **A Shopify website** (`kind = 'shopify'`) gets the same 404.
- **Products shown:** `show_online` and `active`, with a price above £0 (as now). The answer never carries cost, supplier, stock figures at other shops beyond what is drawn, or anything WP-6.1 keeps in the draft.
- **Rate limit:** `/api/site/*` gets one `makeRateLimiter` per visitor address, with suggestions limited apart because they are asked for at every key press. The numbers are set in the first pull request, for a browsing customer (and logged).
- **Page size:** six products, as drawn ("Showing 6 of [n] products"), then **Show more** fetches the next six with `after`.
- **Errors:** the routes never let a slow or failed query stop the server (`customer-accounts` spec, "The shop's website never stops the server"). A failed read answers 503 with "Something went wrong — try again", and the page says so.
- Every route carries `// screens: wb-…`.

### 3. Stock at the chosen shop is one line, worked out on the server

- The visitor's chosen shop (decision 4) is passed as `shop` (a site id the server checks belongs to this shop).
- For each product, the server answers one of:
  - `ready` with a quantity ("Ready today at Bolton · [n] in stock" on the product page; "Ready today at Bolton" on a card), when the chosen shop's `product_stock.qty` is above 0
  - `elsewhere` with the shop's name, for a size in stock at another shop but not this one (`wb-product-size-other`)
  - `sold-out` ("Sold out at Bolton", `wb-product-held`), when nothing is left; a Cycle to Work hold already counts the bike out, so it needs nothing of its own
  - `none` (no line), when no shop is chosen
- With one shop, that shop is always the chosen one.
- **Availability filter:** "Ready today at Bolton" is the only availability choice in this piece. The "Ready at Bolton in [n] days" and "We order it in" lines, and the setting for them, come with WP-6.3 (Jack's answer 2).
- Card counts and filter counts are worked out by the same query that lists the page, so they always agree.

### 4. The chosen shop and the cookie choices are kept in the visitor's browser

- **The chosen shop** is a first-party cookie, `wh_shop` (the site id, 1 year, `SameSite=Lax`, not `HttpOnly` so the app can read it). It is one of the cookies "needed for the site to work" (find-the-shop decision 6), so it needs no consent.
- **The cookie choices** are a second cookie, `wh_cookies`, holding `measuring` and `advertising` on or off. It lasts 6 months (shown on the Cookies page as "[n] months" until set).
- **The basket** cookie is WP-6.3's.
- **Signing in** is Customer accounts' own cookie, already set.
- The Cookies page lists the cookies from one list in the code, so the page and what is really set can't drift apart. Names and lengths are shown as they are; the drawing's `[name]` and `[n] days` are placeholders for them.
- **Tracking tools load only after Accept**, or after a "Save my choices" that turns their kind on. The script for a tool is added to the page then and never before. Its ID is given to the page only at that moment (from `/api/site`, after the choice is sent with it).
- **No tracking tool:** no banner, `wb-cookies-page-plain`.

### 5. The staff banner works at `/store/<slug>/`, where "View website" opens it

- The banner (`wb-off-preview`, `-product`, `-ask`, `wb-turned-on`) shows to staff of this shop who are signed in.
- Because staff sessions belong to the address that set them, staff are recognised on the staff app's own address. They are recognised at `/store/<slug>/`, which is what WP-6.1's "View website" opens, and not at `<slug>.wheelhouseepos.com`; Jack chose this (answer 4), with no change to sign-in.
- **"Turn it on" and "Turn off"** call the routes in decision 2. WP-6.1's own code publishes the first time and switches on, so the two pages can never disagree.
- **Who can turn it on:** the Owner, until "Can edit the website" (WP-1.1). Anyone else gets `wb-off-preview-ask`, naming the shop's Owner, as WP-6.1's `ws-no-access` names them.
- "Edit this page" opens WP-6.1's Website page (`ws-page`). "Back to Wheelhouse" opens the staff app.
- **The banner sits only in the page**, never in the public answer. A visitor who isn't staff of this shop gets the 404 from decision 2.

### 6. Filters, sorts and search

- **Filters for a category** are the category's own details, as Stock keeps them (Stock, "Each category has its own details"; "A category picked on the list filters by its details").
  - A number detail lists its values with the unit ("[n] mm"); a text detail lists its values.
  - The first three values show, then "Show [n] more".
  - A parent category's page offers only Availability, Brand and Price, and its types (`wb-category-parent`), because its children's details differ.
  - Details apply with AND between details and OR within one.
  - Brand comes from `products.brand`. Price is From and To, applied when the box is left or Enter is pressed (as drawn).
- **Nothing is ticked to start** (audit M6, decision 7). Sizes and colours start unchosen.
- **Sorts:**
  - A to Z (the default for a category)
  - Price, low to high, and Price, high to low
  - Newest (`created_at`)
  - Best match, first and the default, on search results only (audit M5)
- **Filters and sort live in the address** (`?inner-diameter=30&sort=price-asc`), so Back and a shared link keep them.
- **The phone Filter panel** applies when **Show [n] products** is chosen (not-drawn row 62). The count is asked from the server as the ticks change.
- **Nothing matches** (`wb-category-empty`): the page names the ticked filters in the drawn sentence. It offers **Clear all filters**; "Show ones ready in [n] days" comes with WP-6.3 (Jack's answer 2). **Ask the shop about it** shows each shop's phone and email in place (H5).
- **Search** uses one query across:
  - products (name, brand, part code, category path)
  - repairs (the workshop's services)
  - categories
  - the fixed pages (Collection and returns, Privacy, Cookies, Contact us, Our shops)
- **Measurement search** reuses Stock's "bearing 30 mm" reading (`value_key`) and answers a category with one detail ticked (`wb-search-measure`).
- **Best match** ranks a name match above a brand or category match, then A to Z.
- Suggestions start from the second letter.

### 7. Photos

- A product shows what it has: its own `photo_url`, then the photos of its sizes and colours (`product_groups`), with no repeats.
- The gallery and "Photo 2 of 4" show only when there is more than one photo.
- A product with no photo shows its name in a tile (as drawn on the cards).
- More photos for one product is a later Stock task (Jack's answer 3).

### 8. The home page is the fixed design, in the drawn order

- Find-the-shop decision 1 said "sections the shop arranges". The build plan's later change, the fixed design with editable words and photos (WP-6.1, "Later": the full editor), puts arranging in the editor.
- So the home page has the drawn sections in the drawn order. Each is filled from the published parts:
  - the big photo, headline and about line
  - the top categories
  - featured products
  - the repairs box with `workshop_words`, and the workshop's services with their prices as the booking site shows them
  - Our shops
  - `shop_words` and a photo
- **Featured products** are the newest four products with a photo that are online (written line 2), until the editor lets the shop choose. A section with nothing in it is left out, rather than shown empty.

### 9. Our shops reads the shop's details

- Address, phone, email and opening hours are the business's one set (Shop details). Closures are those the diary already keeps.
- Today's hours, or "Closed today · opens [day] [time]", are worked out in the shop's own time zone.
- **Directions** opens `https://www.google.com/maps/dir/?api=1&destination=<address>` in a new tab. It is a plain link that sets no cookie on this site, labelled "(opens your maps app)" (decision 5: no map built into the page).
- **A second shop's own address and hours** (Jack's answer 1): the two-shop parts are built now from the business's `sites`. Each shop's card and page show its name, and the shared address, phone, email and hours appear on the first shop's card and page only, until Multiple sites (WP-5.2) gives each shop its own.
- **Contact us** is the shop card and the shop's email (not-drawn row 79).

### 10. Accessibility

As the audit took it (M11, M12, M15):

- "Skip to the main content"
- the current navigation item marked with `aria-current`
- search inside `role="search"`
- the suggestions list as a listbox with its groups
- filters in an `aside` labelled "Filters"
- each removable chip labelled "Remove filter …"
- the photo viewer moved by the arrow keys and closed with Esc, with focus returned to the photo that opened it
- the struck-through size carrying " — not in stock at Bolton" for screen readers
- every target at least 44 pixels

Jack's "accessibility first" applies throughout.

### 11. The tests

- Each of the 37 journey 1 screens and the 4 `site` screens has at least one test (build plan line 131).
- **Server tests** cover, for each route:
  - the shop found by subdomain, by `/store/<slug>/`, and by neither
  - another shop's products never appearing (two shops in every server test)
  - off and unknown giving the same answer
  - draft words never being sent
  - cost never being sent
  - the rate limit
- **Screen tests** use the drawn example data. **Browser tests** cover a phone and a computer for the home page, a filtered category, a product with sizes, search, and the cookie banner.

## Risks / Trade-offs

- **Public routes are open to anyone.** Mitigations:
  - one answer for off and unknown
  - row-level security on every query
  - a rate limit
  - no cost and no draft in any answer
  - a `risky-area-reviewer` and `/review` on each route pull request
- **The suggestions route is asked for at every key press.** Mitigations: a separate limit, a short wait in the page before asking (250 ms), and an index-backed search on name. This is measured in pull request 6 with the full seed.
- **The old and new sites side by side** for pull requests 1–8. The old site keeps working at its address. The new app is reached only once pull request 3 switches the address to it, and pull request 9 removes the old one.
- **Tracking tools are someone else's code** on the shop's site. They load only after consent. Their names come from WP-6.1's list, and the ID is checked there.
- **Staff not recognised at the shop's own address** (decision 5): a staff member visiting `<slug>.wheelhouseepos.com` sees what a customer sees. That is safe, and Jack chose it (answer 4).

## Migration Plan

No migration: Jack's answers 1 and 3 need none. Rolling back the site means pointing `/store/<slug>/` back at `public-storefront/` until pull request 9 has merged.

## Written lines (decided while writing this change, for Jack to overrule)

1. Until WP-6.3, Basket and Add to basket open the basket path, which says the shop can't take orders online yet. This follows the closest built pattern, the booking site's "not available" message. It goes in this month's decided-while-building file when built.
2. Featured products are the newest four online products with a photo, until the editor lets the shop choose.
3. The Directions link uses Google Maps' public directions address, which opens the visitor's maps app on a phone. It is a link, not an embedded map, so it sets no cookie here.
4. The Cookies page shows the cookies' real names and lengths in place of `[name]` and `[n]`.

## Jack's answers (12 Nov)

Jack answered option 1 on each of the four questions, through the Front desk (`docs/decisions/2026-11-12-website-browse-answers.md`):

1. **Each shop's own address, phone and hours:** build the two-shop parts now. The shared address, phone and hours appear on the first shop's card only, until Multiple sites (WP-5.2) gives each shop its own.
2. **"Ready at Bolton in [n] days" and which stock the website offers:** show only what's on the chosen shop's shelf. The setting and the "in [n] days" and "We order it in" lines are left to WP-6.3.
3. **Photos:** show the photos a product already has, with the viewer when there's more than one. More photos per product is a later Stock task.
4. **The staff banner:** at `/store/<slug>/` only, with no change to sign-in.
