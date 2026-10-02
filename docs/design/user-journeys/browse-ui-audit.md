# Journey 1 — UI audit (desktop, Soft sand)

Audited 2 Oct 2026 by the designer helper from the 23 desktop renders of the Find the shop and browse the website boards (1280 x 800: `wb-home`, `wb-home-lower`, `wb-shop`, `wb-category`, `wb-category-filtered`, `wb-category-empty`, `wb-category-parent`, `wb-product`, `wb-product-sizes`, `wb-product-photos`, `wb-search-typing`, `wb-search-results`, `wb-search-measure`, `wb-search-none`, `wb-shops`, `wb-shop-page`, `wb-find-us`, `wb-not-found`, `wb-off`, `wb-off-preview`, `wb-cookies-banner`, `wb-cookies-choose`, `wb-cookies-page`), against `docs/decisions/2026-10-02-find-the-shop-review.md` (decisions 1-6), `generator/browse.mjs` (`site`, `hero`, `featuredCats`, `featuredProducts`, `repairs`, `shopsSection`, `home`, `filterGroup`, `check`, `chips`, `listing`, `drivetrain`, `productPage`, `qty`, `sizeBtn`, `photoOpen`, `suggestions`, `searching`, `results`, `measure`, `shopCard`, `shopPage`, `notFound`, `offPage`, `preview`, `banner`, `chooseCookies`, `cookiesPage`), the pieces it borrows (`app-map.mjs` `siteDesktop`; `settings-frame.mjs` `popup`, `overlay`; `ui.mjs` `field`, `button`, colour tokens), the rendered HTML of the boards for the accessibility checks, journey 2's own product page in `online.mjs` (`site`, `AVAIL`, `qty`, `askShop`), and the decisions it has to agree with (Buy online 2, 3, 8 and 9, App map 3 and 10, Multiple sites 1 and 5, Stock control 10). Tablet and phone are not drawn yet, so nothing here covers them.

**Not raised, on purpose.** The [bracketed] placeholders (`[Headline]`, `[Category]`, `[n]`, `[price]`, `[Product]`, `[Brand]`, `[Detail]`, `[shop address]`, `[shop phone]`, `[opening hours]`, `[Tracking tool]`, `[Second site]`, and the rest). The Soft sand look. Tablet and phone. 12-13px text that is only a label. Clipped scroll areas the renderer cuts off (the bottom of the home page, the product page's specifications, the shop page's opening hours). The theme editor and the "add a tracking tool" setting (journey 18). The payment provider. Real example data: North Street Cycles, Bolton, Shimano brake pads B05S-RX £28.00, Standard service £65.00, Fit & adjust brakes £18.00, sizes S, M, L, XL, Bearings and Drivetrain › Derailleurs. None of the six decisions is reopened, including the sections-the-shop-arranges home page (1), filters made from each category's details (2), no map built into the page (5) and the Reject and Accept buttons being equal (6).

**Verdict.** The decisions are carried out and the structure is sound: filters are real groups with a legend each, the result count is announced politely, every product card is one link, the size and colour pickers are named groups and a size that is out of stock says so in words as well as a line through it, "Reject all" and "Accept all" are the same size and style, each cookie switch says "Off" in words, and the not-found page has a search box and a way home. The gaps are in how journey 1 meets journey 2 and in what the boards leave unsaid. The two-shop boards never show the shop being chosen, yet every line says "at Bolton". A ticked "In stock at Bolton" filter sits above products that are not in stock. The "Ask the shop" buttons lead nowhere. The cookie choice cannot be reopened from the footer that the decision says opens it. The search suggestions are drawn as a list but not yet built so a keyboard can use it. And six boards, the home page among them, have no main page heading.

Checked against source: `siteDesktop()` is called straight from `site()` and never given the "Collecting from" chip that `online.mjs` `site()` adds for `twoShops`; `BEARING_FILTERS()` always ticks "In stock at Bolton" (`check('In stock at Bolton', true)`) and `productCard` can show "Ready at Bolton in [n] days" under it; `measure()` calls `BEARING_FILTERS()` with nothing ticked while its chips say "Inner diameter: 30 mm"; `cookieLink` is `true` only in `cookiesPage()`, so `banner()` and `chooseCookies()` sit on pages whose footer says "Cookies"; `suggestions()` marks the group headings `role="presentation"`, the options are links, "See all results" is not an option, and the box has `role="combobox"`, `aria-expanded` and `aria-controls` but no `aria-activedescendant` or `aria-autocomplete`; `hero()` makes its headline a `<span>`; `banner()` is added at the end of `<main>`; `photo()` is a `role="img"` box with no way to focus or press it, and nothing draws how `photoOpen()` is reached; `qty()` names its buttons "One fewer" and "One more" where journey 2's `qty()` adds the product name; `drivetrain()` gives the parent category the "Number of gears" filter, which Stock control 10 gives to Derailleurs; `sortBox()` has one option, "Most popular"; `shopPage(true)` keeps "Shop for collection from here" for a one-shop business; `offPage()` has a heading and one line and no search box or link; `preview()` puts `role="status"` on a banner that does not change; `cookiesPage()` lists three cookies. Nothing was run in a browser, and no shell was available, so keyboard order, focus and a screen reader were not tested. Contrast was worked out by hand: muted text `#6E6752` on page `#F4EEE1` about 4.9:1, on panel `#FFFDF7` about 5.5:1; staff banner text `#7A5A10` on `#F7EAC2` about 5.3:1; all passing.

## High

**H1 — every two-shop board: nothing shows the shop being chosen.** Buy online 8 says that with two or more shops the header reads "Collecting from Bolton · Change", the shop is chosen once and remembered, and before one is chosen the product says "Choose a shop to see when it's ready". These boards have two shops (the header says "Our shops", the home page lists Bolton and [Second site]) but the header has no chip, and the footer says only "· Bolton". Every card and filter says "In stock at Bolton" and the product page says "Ready today at Bolton" as if Bolton had been picked, and no board shows a first visit with nothing picked, or how Bolton got picked. *Why it matters:* a customer who is nearer [Second site] reads stock for the wrong shop and has no sign of how to change it; journey 1 is also the first page a customer sees, so this is where the shop gets chosen. *Fix:* Follow decision 8, no new choice.
- Add the chip to the header whenever there are two or more shops, as journey 2 draws it (search shortened to "Search", 150px wide, shop name cut short with the full name in its label). The suggestions list (H4) then has to move to sit under the shorter box.
- Draw the first visit once: chip reads "Choose a shop", cards show no stock line, the filter reads "In stock at the shop you choose" and is off, the product page says "Choose a shop to see when it's ready" (journey 2's `AVAIL.noshop`). Tapping the chip opens journey 2's "Which shop?" pop-up, where one tap saves.
- The footer names every shop, or none (L4).
- With one shop none of this shows.

**H2 — `wb-category-parent`, `wb-search-results`, `wb-search-measure`, `wb-category-filtered`, `wb-category-empty`: the filters and the list disagree.** Three separate things.
- "In stock at Bolton" is ticked on every list as if the customer had chosen it, yet the third card on the Drivetrain and search boards says "Ready at Bolton in [n] days", which is not in stock. The ticked filter should have hidden it.
- On the measurement board the chips say "Category: Bearings" and "Inner diameter: 30 mm" but no box in the sidebar is ticked. On the plain filtered board the box is ticked.
- The empty board says "Try removing a filter" over three chips and does not say which. The one that shuts most people out, "In stock at Bolton", is a default the customer never chose, and "Clear all" on the filtered board would also remove it, so the list gets longer with products that are not in stock.
*Why it matters:* the customer cannot trust a filter that is ticked and wrong, and a pre-ticked stock filter hides everything the shop can get in a few days, which is the opposite of what the shop selling online wants. *Fix:*
1. Nothing pre-ticked. Each card keeps its own line ("Ready today at Bolton", "Ready at Bolton in [n] days") and the customer ticks "In stock at Bolton" if they want it. Ticked boxes always match the chips on every board, including the measurement one. On the empty board, name the filter that is doing it ("Nothing is in stock at Bolton with an inner diameter of [n] mm. Show products we can get in [n] days").
2. Keep it pre-ticked, but then say so ("Showing what is in stock at Bolton · Include items ready in [n] days") and make sure no "Ready in [n] days" card can appear while it is ticked. Fewer boards to change; the customer still has to untick to see the full range.
Recommend 1.

**H3 — `wb-cookies-banner`, `wb-cookies-choose`, `wb-cookies-page`: the choice cannot be reopened from the footer.** Decision 6 says the footer's "Cookie choices" opens it again. In the source the footer says "Cookie choices" only on the Cookies page, where it replaces "Cookies", and every other page including the banner and the choose pop-up says "Cookies". The pop-up's own line says "Change these any time from 'Cookie choices' at the bottom of every page", which the page behind it contradicts. Not drawn either: what the banner does after a choice (it goes; does anything say it was saved?), and the Cookies page does not show what the visitor chose, so the button "Change cookie choices" gives no idea of what it would change. The out-of-the-box version (no tracking tool, so no banner, no "Tools the shop has added" box, no "Change" button) is not drawn. *Why it matters:* changing your mind must be as easy as agreeing, and today the only route is by finding the Cookies page. *Fix:*
1. Footer on every page of a shop with a tracking tool: "Cookies" (the page) and "Cookie choices" (opens the pop-up), side by side. A shop without a tool shows "Cookies" only. After a choice a short line appears ("Your cookie choices are saved") and the Cookies page shows them ("You said no to measuring visits. Change"). Draw the Cookies page for a shop with no tool too.
2. One footer link, "Cookies", and the button on that page does the reopening. One link fewer; reopening takes an extra click and disagrees with decision 6's words.
Recommend 1.

**H4 — `wb-search-typing`: the suggestions are a list but not yet a search box a keyboard can use.** The box says it controls a list, but nothing tells it which suggestion is under the cursor (`aria-activedescendant` is missing, and no row is drawn highlighted), so Down arrow and Enter cannot be used with a screen reader, and sighted keyboard users have no row to see. The group headings ("Products", "Repairs", "Categories") are marked as decoration inside the list, which a screen reader reads as a list with loose pieces; they should be named groups. "See all results for 'brake'" is not one of the rows, so arrow keys cannot reach it. Not drawn: nothing being suggested for what was typed, the moment between typing and results, Escape closing the list, and a spoken count ("5 suggestions"). The box is not wrapped as a search area. *Why it matters:* search is how someone looks for a part, and the people who most need the keyboard route are the ones this audit is meant to protect (Accessibility first). *Fix:* No choice, one pass.
- Down arrow moves a visible highlight through the rows and "See all results" is the last row; Enter opens the highlighted row, or the results page when none is highlighted; Escape closes the list and keeps what was typed; the box says which row is current.
- Groups are named groups; a polite spoken line says "[n] suggestions" or "No suggestions".
- Draw a highlighted row and a "No suggestions — press Enter to search" state.
- Wrap the header search in a search area.

**H5 — `wb-category-empty`, `wb-search-none`, `wb-product`, `wb-product-sizes`: "Ask the shop" goes nowhere, and promises something the shop may not offer.** Three buttons and one link say "Ask the shop" or "Ask the shop about this", and no board draws what they do. Journey 2 already draws the answer: "Ask the shop about it" opens the shop's phone and email in place (Buy online 9, `askShop`). The two empty boards also say "We may be able to order it in", but ordering in is an owner choice that starts off (Buy online 2), so a shop that has not switched it on is promising what it will not do. *Why it matters:* these are the dead ends: the customer has searched, found nothing, and the only suggested next step is a button that cannot be followed. *Fix:*
1. Every "Ask the shop" opens journey 2's block in place: the chosen shop's phone and email (with nothing chosen, each shop's, as on Our shops). Say "we may be able to order it in" only when that shop has ordering in switched on; otherwise the sentence is not there. Draw it once, on `wb-search-none`.
2. A short message form (name, phone, what they want) that lands with staff. Customers need not phone; staff need somewhere to read it, which no journey has drawn.
Recommend 1.

## Medium

**M1 — `wb-home`, `wb-home-lower`: the home page for one shop, two shops and more.** Only the two-shop version is drawn. With two shops, the page carries four dark "Book a repair" buttons (the hero, the repairs section, and one in each shop card), against the one-dark-button-per-section rhythm of the rest of the journey. With one shop, the header says "Find us" but the section underneath still reads "Our shops" and would show one big card, and "Book a repair here" repeats the repairs section directly above it. With five shops the section is five cards tall and pushes "the shop's own words" off the page. *Fix:*
1. One shop: the section is called "Find us" and holds the one card (address, today's hours, phone, Directions), no "Book a repair here". Two shops: the cards stay, with "Book a repair here" as an outlined button so the page keeps dark buttons for the hero and the repairs section. Three or more: the first [n] cards and an "All shops" link. Draw `wb-home-one-shop`.
2. Leave as drawn. Nothing to redraw; the home page has more dark buttons than any other page and a one-shop shop gets a duplicate card.
Recommend 1.

**M2 — `wb-shop-page`, `wb-find-us`: "Shop for collection from here" is a plain link with nothing to say what it did.** Decision 5 calls it "Collect from here", and it is what sets the chosen shop (Buy online 8). Here it is a text link, the wording differs, nothing says it chose the shop, and the one-shop "Find us" board has it too, though there is nothing to choose. *Fix:* On a shop's page it is an outlined button "Collect from here"; pressing it sets the shop, the header chip changes (H1) and a short line says "Collecting from Bolton"; it then opens the Shop page. It is not shown for a one-shop business.

**M3 — six boards have no main page heading.** `wb-home`, `wb-home-lower`, `wb-search-typing`, `wb-off-preview`, `wb-cookies-banner` and `wb-cookies-choose` have no `<h1>` in the rendered files; the 17 others have exactly one. The home page's headline is a plain text line in `hero()`. A screen reader user moving by headings finds nothing at the top of the page, and search engines read the first heading to learn what a page is about. *Fix:* the hero's headline is the page's one `<h1>`. A shop that removes the hero (decision 1 lets it) still has one: the shop's name, hidden from view, as the heading. No change to what is drawn.

**M4 — `wb-category-parent`: a parent category offers a filter that belongs to a child.** Drivetrain shows "Number of gears", which Stock control 10 gives to Derailleurs; chains and cassettes in Drivetrain have no number of gears, so the filter can only hide them. The child category's own page (Shop › Drivetrain › Derailleurs) is not drawn. *Fix:*
1. A parent page offers only what all its products have (Availability, Brand, Price) plus the child categories as links, as drawn; "Number of gears" appears once the customer opens Derailleurs. Draw the Derailleurs page, with a three-step path above the heading.
2. Keep "Number of gears" on the parent with a note "Derailleurs only". One page does everything; the filter still cuts the list down to Derailleurs.
Recommend 1.

**M5 — every list: the sort box has one choice, and it is not what decision 2 lists.** Decision 2 says sorting by price, newest and A-Z. The box shows "Most popular" on every board, including search results, where the natural order is best match; popularity needs a source of its own that no decision or Stock field provides. *Fix:*
1. Sort choices: "Price, low to high", "Price, high to low", "Newest", "A to Z". Search results also have "Best match", first and selected. Category lists start on "A to Z".
2. Keep "Most popular". Needs sales counts to be kept and shown, which is a new piece of data to design, with nothing saying where it comes from.
Recommend 1.

**M6 — `wb-product-sizes`: a size is already chosen for the customer.** Size L and Colour 1 are drawn as picked, and the line below says "Ready today at Bolton · size L in [Colour 1]". Nothing says whether the page picks a size itself or waits. For clothing and tyres a wrong size is a return. The "Colour" heading shows the choice ("Colour: [Colour 1]") but "Size" does not. *Fix:*
1. With sizes or colours, nothing is picked: the ready-when line says "Choose a size to see when it's ready", and pressing "Add to basket" moves focus to the unchosen group with "Choose a size" in words. A size is picked in one tap. A product with one size, or one colour, has it picked already.
2. Pick the first size that is in stock, and say it plainly in the basket line ("Size L"). One tap fewer for people who want that size; the wrong-size risk stays.
Recommend 1.

**M7 — `wb-product-sizes`: a size out of stock here, in stock at the other shop.** The line says "M is out of stock at Bolton in [Colour 1]" and stops. Journey 2 says, for the same case, "Not in stock at Bolton — in stock at our [Second site] shop" with "Collect from [Second site] instead" (Buy online 9). *Fix:* With two shops and stock at the other: "M is out of stock at Bolton in [Colour 1] — in stock at [Second site]" and a "Collect from [Second site] instead" button, which changes the chosen shop and keeps the size. The same words on the product card line and the list for products that are out at Bolton.

**M8 — no board shows a product, category or shop with no photo.** Every card, the home page's category tiles, Our shops and the shop page are drawn with a photo box (placeholder). Stock is added when items are booked in (Stock control), and most will not have photos. *Fix:*
1. A plain tile in the same size with the product's name or the category's name in it and no picture; nothing is made up, and rows stay level.
2. No tile; the card shrinks to its text. Fewer pixels; rows of cards no longer line up.
Recommend 1.

**M9 — `wb-search-typing`, `wb-search-results`, `wb-search-measure`: search leaves out what the decision lists and forgets what was typed.** Decision 4 says search finds products, categories, repairs and the shop's own pages; the suggestions show products, repairs and categories, and no pages ("Our shops", the Cookies page, "Delivery and returns"). On the results boards the header search box is empty, so to change a word the customer retypes all of it. The suggestion box also sits 110px left of the search box rather than under it. *Fix:* add a "Pages" group (at most three) to the suggestions and the results page; keep the typed words in the header box on results pages; the list's right edge lines up with the box.

**M10 — `wb-category`, `wb-search-results`: what happens when a list is long.** The boards show six cards and a count. Nothing shows how the next ones arrive, how many there are, or what the Back button does after opening a product. *Fix:*
1. A "Show more" button under the list that adds the next [n], with "Showing [n] of [n] products" announced, and the filters, sort and place in the list kept so Back returns to the same spot. One press for more.
2. Numbered pages. Back always works and a page can be linked to; two presses to see page 3.
Recommend 1.

**M11 — `wb-product`, `wb-product-photos`: the big photo cannot be opened by keyboard, and the larger view is half built.** The large photo is a picture only; nothing says pressing it opens the larger view, and nothing can be focused. The thumbnails change which photo shows; how the larger view opens is not drawn. In the larger view the close control is a link rather than a button, "Photo 2 of 4" is not a heading, the arrows at the first and last photo are not drawn greyed, and where the focus goes on closing is not stated. *Fix:* the big photo is a button ("Open larger photo 1 of 4"), Left and Right arrows change photo, Escape closes and returns to the same button, close is a button, "Photo 2 of 4" is the dialog's title.

**M12 — targets below 44px.** The 44px rule holds for buttons, the search box, quantity buttons and sizes. It does not hold for: the filter chips and "Clear all" (36px), the filter tick-box rows and "Show [n] more" (40px), the child-category pills on Drivetrain (40px), the shop name, phone and email links on the cards and shop page, the breadcrumb links, the footer links and "About cookies" (as tall as their text). *Fix:* raise each to 44px tall (padding, not bigger text). Chips can stay compact beside each other if there is 8px between them.

**M13 — `wb-off`: the switched-off page and the decision.** Decision 6 says "page not found" and "website switched off" look the same to the public, each with a search box and a link home. `wb-not-found` has both. `wb-off` is a plain white page with a heading and one line, no search box, no link, and no theme, so it does not look like the other. It cannot take the theme, since that would show that a shop exists. A search box on it would have nothing to search. *Fix:*
1. Keep it as drawn and record that "search box and link home" applies to the not-found page inside a live website; the off page has nothing it may safely search or link to, and the browser's Back is the way out. Say so in the handover.
2. Add a plain "Go back" button to the off page. Gives a way out and shows nothing about the shop; it does not meet the decision's literal words either.
Recommend 1, so Jack can confirm the reading of decision 6.

**M14 — `wb-off-preview`: staff see the page, but get no way out and no result.** "Turn it on" publishes the whole website with one press, and nothing says what happens next (does the banner go? does a line say "Your website is on · Turn off"?). The banner is drawn only on the home page; whether it stays on every other page staff open is not shown. Staff have no link back to Wheelhouse from here, so the way back is the browser. *Fix:*
1. One press, as drawn (reversible, fewest clicks), then the banner turns into "Your website is on · Turn off"; the banner stays at the top of every page staff open while it is off; it gets "Back to Wheelhouse".
2. "Turn it on" opens a short confirm ("Customers will be able to see these pages"). One more click for something that can be switched off again straight away.
Recommend 1.

**M15 — names, landmarks and keyboard order (source and rendered HTML).**
- `qty()` names its buttons "One fewer" and "One more"; journey 2's audit (M10) made them "One fewer [product name]". Same here.
- No "Skip to the main content" link in `siteDesktop()`; a keyboard user passes the logo, three links, search, Account and Basket on every page, and the filter column on every list, before reaching the results.
- "Show [n] more" does not say whether it is open (`aria-expanded`).
- The row of child-category pills on Drivetrain is an unnamed group of links; make it "Types of drivetrain" and a list.
- Shop names on cards are links and not headings, so a screen reader moving by heading skips them (Our shops and the home page).
- "Price from / to": nothing says when it applies. Say it applies when the customer leaves the box or presses Enter, and the count is announced.
- The cookie banner is last in the page's order, so a keyboard user tabs through the whole page first. Put it first in the order, without trapping focus; leave room at the bottom of the page so it never hides content.
- Both `wb-not-found` search boxes are named "Search the shop"; rename the page's own "Search for a page or product".
*Fix:* one pass as above. No choice.

## Low

**L1** — `wb-cookies-banner`, `wb-cookies-page`: "Reject all" and "Accept all" each wrap onto two lines in a narrow box; widen the buttons. The Cookies page lists the basket, signing in and the chosen shop; a shop with a tracking tool also keeps a cookie that remembers the choice, which should be a fourth row. The cookie table has a heading above it but no caption of its own. *Fix:* as above.
**L2** — `wb-shops`, `wb-shop-page`: "Open today", "Closed today", "Thursday (today)" and Sunday "Closed" are drawn as facts while every other hours cell is a placeholder. They stand for states, but a reader will take Sunday "Closed" as the data. *Fix:* bracket them ("[Closed]", "[today]") so they read as examples; the real state is worked out from the shop's hours.
**L3** — wording against journey 2 and plain English: cards say "In stock at Bolton" and the product page "Ready today at Bolton"; use "Ready today at Bolton" on both. "Supplier code" in Specifications is shop language (the code is already in the title); check what the field is called in Stock and use "Part code". The footer says "Delivery and returns" for a shop that only offers collection; "Collection and returns". The "Size" heading does not show the choice where "Colour" does. *Fix:* as above.
**L4** — the footer: "Contact us", "Delivery and returns" and "Privacy" lead to pages no journey has drawn; "Contact us" with two shops should open Our shops. The footer says "North Street Cycles · Bolton" even where there are two shops. *Fix:* name the pages and who draws them in the handover; footer names every shop or none.
**L5** — page titles in the browser tab are not specified (the files carry the board names). One line each in the handover: "Bearings · North Street Cycles", "Shimano brake pads B05S-RX · North Street Cycles", "Results for 'brake' · North Street Cycles". The product breadcrumb shows one category; for nested categories it should show the whole path. Four pages (Shop, Our shops, Find us, Cookies) have a one-item breadcrumb that repeats the heading above it; remove it.
**L6** — layout: the "Sort by" box moves down 52px between Bearings and Drivetrain because the child-category pills sit under the heading; on the search results the repairs strip stops at 660px with Sort beside its foot, so it reads as a gap. The staff banner on `wb-off-preview` is marked as a spoken status though it never changes (journey 2's L4 again); keep that only where text appears after an action. *Fix:* hold Sort in one place; stretch the strip to the list's width; drop the status marking.

## Summary of what to decide

11 recommendations, each a choice between real options; Jack to pick:

1. Pre-ticked "In stock" filter and boards that disagree (H2, options 1-2).
2. Reopening the cookie choice (H3, options 1-2).
3. Where "Ask the shop" goes (H5, options 1-2).
4. Home page for one shop, two, and more (M1, options 1-2).
5. Parent category filters (M4, options 1-2).
6. Sort choices (M5, options 1-2).
7. Size picked for the customer (M6, options 1-2).
8. Products with no photo (M8, options 1-2).
9. Long lists (M10, options 1-2).
10. The switched-off page against decision 6 (M13, options 1-2).
11. Turning the website on from the staff view (M14, options 1-2).

H1, H4, M2, M3, M7, M9, M11, M12, M15 and L1-L6 have a single fix each and are listed so they are not lost. H1 follows Buy online 8 and is the biggest piece of redrawing.

| Id | Boards | One line | Needs Jack |
|---|---|---|---|
| H1 | every two-shop board | No header chip or first visit; "at Bolton" everywhere | Yes |
| H2 | category-parent, search-results, search-measure, category-empty | Ticked filter over items not in stock; boxes against chips | Yes (1-2) |
| H3 | cookies-banner, cookies-choose, cookies-page | Footer does not reopen the choice | Yes (1-2) |
| H4 | search-typing | Suggestions not usable by keyboard | Yes |
| H5 | category-empty, search-none, product, product-sizes | "Ask the shop" has no destination | Yes (1-2) |
| M1 | home, home-lower | One shop, two, and more; four dark buttons | Yes (1-2) |
| M2 | shop-page, find-us | "Collect from here" as a link, shown for one shop | Yes |
| M3 | home, home-lower, search-typing, off-preview, cookies-banner, cookies-choose | No main page heading | Yes |
| M4 | category-parent | Child's filter on the parent | Yes (1-2) |
| M5 | all lists | One sort choice, not in decision | Yes (1-2) |
| M6 | product-sizes | Size already picked | Yes (1-2) |
| M7 | product-sizes | Out here, in stock at the other shop | Yes |
| M8 | cards, shops, shop-page | No photo state | Yes (1-2) |
| M9 | search-typing, search-results, search-measure | Pages missing; typed words forgotten | Yes |
| M10 | category, search-results | Long lists and Back | Yes (1-2) |
| M11 | product, product-photos | Photo not keyboard-openable | Yes |
| M12 | filters, chips, links, footer | Targets under 44px | Yes |
| M13 | off | Against decision 6's words | Yes (1-2) |
| M14 | off-preview | No result, no way back | Yes (1-2) |
| M15 | header, lists, banner | Names, skip link, order | Yes |
| L1-L6 | various | See above | Yes |

## Verification (2 Oct 2026)

Checked by reading: all 23 renders; `browse.mjs` in full; `app-map.mjs` `siteDesktop`; `settings-frame.mjs` `popup` and `overlay`; `ui.mjs` `button`, `field`, `badge`, `card` and colour tokens; `online.mjs` `site`, `AVAIL`, `qty`, `askShop` and the product page, for the comparison with journey 2; decisions 1-6 of the find-the-shop review; Buy online 2, 8 and 9; Multiple sites 5; Stock control 10. Searched the rendered HTML for headings (17 of 23 files have one `<h1>`; `wb-home`, `wb-home-lower`, `wb-search-typing`, `wb-off-preview`, `wb-cookies-banner` and `wb-cookies-choose` have none), for the search box's combobox markup on `wb-search-typing`, for landmark tags, and for spoken-status markings. Not checked: tablet and phone; keyboard order, focus and a screen reader in a browser (H4, M11, M15 are read off the source and not tested); whether the Website management journey (18) draws the "add a tracking tool" setting that H3 depends on; whether the Contact us, Delivery and returns and Privacy pages are drawn elsewhere (L4); whether Stock calls the code "Supplier code" (L3); the Shop websites spec's wording for the switched-off page, which M13 does not reread beyond what decision 6 quotes; how Stock decides which products show on the website. H5's order-in point relies on Buy online 2 saying ordering in starts off, and was not checked against the Settings board. Contrast worked out by hand. Pixel observations (the suggestions list offset in M9, the sort box moving in L6, the buttons wrapping in L1) are read off screenshots.

Re-checked by the main session (2 Oct): the home page has no h1 (M3), the footer reads "Cookies" behind the cookie choice (H3), and "In stock at Bolton" is pre-ticked in the filters (H2) — all hold.
