# Journey 1, Find the shop and browse the website — Jack's decisions (2 Oct 2026)

Journey 1 is how a customer finds the shop and looks round its website: the
home page, categories and product lists, a product page, search, Our shops,
and what happens when a page isn't there or the website is switched off,
plus cookie choices. Background, not reopened here: the website is built
into Wheelhouse, not Shopify, and shops change it through a theme system —
layout, sections, colours, fonts, images — not free-form code (Release 2
design rule 6, piece 7); it's called "Website" (Names); drawn in Soft sand
by default, the frame assuming no colours, with header links Shop, Book a
repair and Our shops, search, Account and Basket, and each shop choosing
which header link stands out as a button (App map 3, 10); customers sign in
with an emailed code in the shop's theme (Signing in 2–3); a product says
when it's ready at the chosen shop, the shop is chosen once and remembered,
and "Show on website" is a switch on each category and product (Buy online
2, 3, 8); booking starts with "Which shop?", already chosen when the
customer comes from that shop's page (Multiple sites 5); each shop has its
own address, phone, opening hours and stock (Multiple sites 1); sizes and
colours are one product with a grid, categories nest and carry their own
details, and staff search by name, code or measurement (Stock control 2, 4,
10); an unknown shop and a switched-off website look the same to the public
(Shop websites spec). The theme editor itself is Website management
(journey 18). Real example data only: North Street Cycles, Bolton,
"[Second site]", Shimano brake pads B05S-RX (£28.00), the stockroom's
categories (Bearings; Drivetrain › Derailleurs); other products, words and
photos are bracketed placeholders. Own canvas:
https://claude.ai/artifact/7g2TbX8jMauaaTqSkvj5CQ, desktop first, then
tablet and phone. Rules for every journey apply (Workshop day 45, 48, 50,
53, 57, 62, 65–67; A2, A6 — as few clicks as possible).

1. **The home page is sections the shop arranges** (Jack, 2 Oct: "1"). A
   stack of sections the shop can add, remove and reorder — a big photo with
   a headline and button, featured categories, featured products, Book a
   repair, our shops with opening hours, and a block of the shop's own words
   and pictures. Drawn here: the sections and a sensible starting page; the
   tool that arranges them is Website management (journey 18). Chosen over a
   few ready-made layouts, and layouts plus sections.
2. **Category pages with filters made from each category's own details**
   (Jack, 2 Oct: "1"). A category's details from Stock (Stock control 10) —
   a bearing's inner diameter, a derailleur's number of gears, sizes and
   colours — become its filters, beside price, brand and "In stock at
   Bolton", with sorting (price, newest, A–Z). On a phone the filters open
   from a "Filter" button. Chosen over sorting only, and no category pages.
3. **A product page with photos, size and colour, specifications and the
   description** (Jack, 2 Oct: "1"). Several photos to flick through; size
   and colour chosen on the page, with any not in stock at the chosen shop
   greyed and saying so; a "Specifications" table filled from the
   category's details; the shop's description; "Ask the shop about this";
   and journey 2's price, readiness and Add to basket. Chosen over adding
   "You might also need", and adding customer reviews.
4. **One search box finds products, categories, repairs and the shop's
   pages, with suggestions as you type** (Jack, 2 Oct: "1"). Typing shows a
   few products, matching categories and repairs (which open Book a repair);
   measurements work as in Stock ("bearing 30mm"); Enter opens a results
   page with the category filters. Chosen over products only, and products
   and categories without repairs.
5. **An Our shops page and a page for each shop** (Jack, 2 Oct: "1"). Our
   shops lists every shop as a card — address, today's hours, phone,
   "Directions" (the customer's own maps app) and "Book a repair here". Each
   shop's page adds the week's hours and closures, a photo and "Collect from
   here"; "Book a repair here" starts booking with that shop chosen
   (Multiple sites 5). With one shop the header link reads "Find us" and
   goes straight to its page. No map built into the page (it would set
   Google's cookies). Chosen over cards only, and shop pages from a menu.
6. **Shops can add visitor-tracking tools, and only then does a cookie
   choice appear** (Jack, 2 Oct: "2"). Out of the box Wheelhouse sets only
   the cookies a visit needs (the basket, signing in, the chosen shop), so
   there is no pop-up; the footer's "Cookies" page lists them. A shop that
   adds a tracking tool (in the website's settings, journey 18) gets a
   choice on the first visit with "Reject all" and "Accept all" as equal
   buttons and "Choose" for each kind; the footer's "Cookie choices" opens it
   again. The wording is for the shop's solicitor to check (sign-off WEB-2).
   Also, with no objection when offered: "page not found" and "website
   switched off" look the same to the public, each with a search box and a
   link home. Chosen over only necessary cookies with no tracking, and a
   pop-up always.
7. **UI audit: every recommendation taken** (Jack, 2 Oct: "yeah go ahead
   with them all"). From `design/user-journeys/browse-ui-audit.md`: with
   two or more shops the header shows journey 2's "Collecting from Bolton ·
   Change", and a first visit has nothing chosen (H1); **no filter is ticked
   for the customer** — each card says when it's ready, ticks always match
   the chips, and an empty list says which filter is the cause (H2); a shop
   with a tracking tool has "Cookies" and "Cookie choices" in the footer, a
   "saved" line after choosing, and the Cookies page shows the choice (H3);
   search suggestions work by keyboard and say how many there are (H4);
   "Ask the shop" shows the shop's phone and email in place, and "we may be
   able to order it in" appears only when the shop orders in (H5); the home
   page with one shop has a "Find us" section, with two the shop cards'
   buttons are outlined, with three or more the first few and "All shops"
   (M1); "Collect from here" is a button that sets the shop (M2); one main
   heading on every page (M3); **a parent category offers only filters all
   its products share** — Derailleurs has "Number of gears" (M4); sort by
   price, newest or A to Z, and "Best match" for search (M5); **sizes and
   colours start unchosen** (M6); out here but in stock at the other shop
   says so (M7); a product with no photo gets a plain tile with its name
   (M8); search also finds the shop's pages and keeps what was typed (M9);
   long lists have "Show more" and Back returns to the same place (M10);
   photos open by keyboard (M11); targets 44px (M12); **the switched-off
   page stays plain** — decision 6's search box and link home is for "page
   not found" inside a live website, since a switched-off page may not show
   or search anything of the shop (M13); "Turn it on" is one press, then
   "Your website is on · Turn off", and the staff banner shows on every page
   while it's off, with "Back to Wheelhouse" (M14); names, a skip link and
   keyboard order (M15); and L1–L6 (wording "Ready today at Bolton" on
   cards, "Collection and returns" in the footer, page titles).
8. **Tablet and phone drawn; approved and copied into the big canvas**
   (Jack, 2 Oct: "lets get it on the canvas"). On tablet and phone the
   header's search button opens a search box across the top with the
   suggestions under it; on a phone "Filter" opens a full-screen panel with
   "Show [n] products"; shop cards go one to a row; "Collecting from Bolton
   · Change" is a line at the top of the page. 35 screens, 106 boards. In
   the big canvas (customers and the website) journey 1 replaces its seven
   placeholders. Carried into every journey's website pages: a "Skip to the
   main content" link, the footer's "Collection and returns" (was "Delivery
   and returns") and "Cookies" links, footer links 44px tall.
