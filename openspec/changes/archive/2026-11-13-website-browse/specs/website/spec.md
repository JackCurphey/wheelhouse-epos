## ADDED Requirements

### Requirement: The customer website is found from its address and shows only what the shop switched on
The customer website SHALL be found by the shop's address: `<slug>.wheelhouseepos.com`, or `/store/<slug>/`. It SHALL show only the shop's published words, photos, logo and main colour, never the draft. An unknown shop, a switched-off website and a Shopify-kind website SHALL all get the same answer, "This website isn’t available", so one can't be told from another.

#### Scenario: A switched-on shop's website opens at its own address
- **WHEN** a customer opens `northstreet.wheelhouseepos.com` and North Street Cycles' website is on
- **THEN** they see North Street Cycles' home page with its published headline, about line and big photo

#### Scenario: The same website opens at the store path
- **WHEN** a customer opens `/store/northstreet/`
- **THEN** they see the same home page

#### Scenario: Draft words never reach a customer
- **WHEN** the Owner has changed the headline in the editor but not published it
- **THEN** the customer website still shows the published headline, and no website answer contains the draft

#### Scenario: A switched-off website and an unknown shop look the same (wb-off)
- **WHEN** a customer opens the address of a shop whose website is off, or of a shop that doesn't exist
- **THEN** both show "This website isn’t available" and "Check the address, or contact the shop another way.", with the same answer from the server

#### Scenario: Another shop's products never appear
- **WHEN** two shops each have products online and a customer browses the first shop's website
- **THEN** no product, category, repair or shop of the second shop appears in any page or answer

### Requirement: The website's public answers carry nothing private and are limited per visitor
The website's routes SHALL answer only what a customer can see. That is: products that are online, active and priced above £0; the published parts; the shops' public details; and the workshop's services and prices. No answer SHALL carry cost prices, supplier details, the draft, tracking IDs before consent, or staff details beyond the Owner's name on the staff banner. Each visitor's address SHALL be limited in how often it can ask, with search suggestions limited apart.

#### Scenario: An offline, inactive or unpriced product is not listed
- **WHEN** a product is off the website, archived, or priced at £0
- **THEN** it appears in no category, search, suggestion or product answer, and opening its product address shows "We can’t find that page"

#### Scenario: Cost never leaves the server
- **WHEN** a customer's browser asks for a product
- **THEN** the answer has its name, price, brand, description, photos, specifications and stock line, and no cost or supplier

#### Scenario: Too many requests are turned away
- **WHEN** one visitor's address asks the website's routes more often than the limit allows
- **THEN** further requests get a "too many requests" answer until the window passes, and other visitors are not affected

### Requirement: Every website page has the same shell
Every page SHALL have the same shell: "Skip to the main content", the logo, the menu, the search box, the chosen-shop chip, Account, Basket and the footer, as the scenarios list them. On a phone the menu SHALL fold into a menu button. The page SHALL use the shop's published main colour.

#### Scenario: The shell on a computer (site)
- **WHEN** a customer opens any page on a computer
- **THEN** they see the logo, "Shop", "Book a repair", "Our shops", "Search the shop", the chip, Account and Basket, with the current page marked in the menu, and a footer with Contact us, Collection and returns, Privacy, Cookies and Cookie choices

#### Scenario: The shell on a phone (site-menu)
- **WHEN** a customer on a phone presses the menu button
- **THEN** the menu opens with the same items, and Esc or the close button shuts it and returns focus to the menu button

#### Scenario: The shop's own main colour (site-ocean)
- **WHEN** the shop has published a different main colour
- **THEN** the shell's buttons, links and marked menu item use that colour, keeping text readable against it

#### Scenario: One shop says Find us
- **WHEN** the business has one shop
- **THEN** the menu says "Find us" in place of "Our shops"

#### Scenario: Skipping to the content
- **WHEN** a keyboard user presses Tab once on any page and then Enter
- **THEN** focus moves past the shell to the page's main content

### Requirement: The home page shows the shop's published sections in the drawn order
The home page SHALL show, in this order: the big photo with headline and about line; the top categories; featured products; the repairs box with the workshop words and the workshop's services and prices; Our shops; and the shop words with a photo. A section with nothing in it SHALL be left out. Featured products SHALL be the newest four online products with a photo.

#### Scenario: The home page's top (wb-home)
- **WHEN** a customer opens the home page
- **THEN** they see the big photo, the headline and the about line, then the top categories and featured products, each product with its price including VAT

#### Scenario: The home page's lower part (wb-home-lower)
- **WHEN** they scroll down
- **THEN** they see the repairs box with "Standard service £65.00" and the other services as the booking site prices them, a Book a repair button, then Our shops and the shop's own words

#### Scenario: A one-shop business's home page (wb-home-one-shop)
- **WHEN** the business has one shop
- **THEN** the home page shows no chosen-shop chip choice, its shop section says "Find us", and every stock line names that shop

#### Scenario: A first visit with two shops (wb-first-visit)
- **WHEN** a customer opens a two-shop business's website for the first time
- **THEN** the chip says "Choose a shop", and no stock line shows until a shop is chosen

#### Scenario: An empty section is left out
- **WHEN** the shop has no products with a photo online
- **THEN** the featured products section does not show

### Requirement: The customer chooses which shop they collect from, and the website remembers it
With more than one shop, the chip SHALL say "Choose a shop" until one is chosen, and "Collecting from **Bolton** · Change" after. Choosing SHALL open "Which shop will you collect from?" with "We’ll remember it, and show when things are ready there", listing each shop. The choice SHALL be kept in a needed cookie, and every stock line SHALL then name that shop.

#### Scenario: Choosing a shop (wb-choose-shop)
- **WHEN** a customer presses "Choose a shop" and picks Bolton
- **THEN** the box closes, the chip says "Collecting from Bolton · Change", and product cards show "Ready today at Bolton" where Bolton has stock

#### Scenario: The choice is remembered
- **WHEN** the customer comes back to the website later on the same browser
- **THEN** the chip still says "Collecting from Bolton · Change", without asking

#### Scenario: Changing shop
- **WHEN** they press Change and pick another shop
- **THEN** every stock line now names that shop

#### Scenario: The remembered shop no longer exists
- **WHEN** the cookie names a shop the business no longer has
- **THEN** the chip says "Choose a shop" again

### Requirement: The Shop page lists the categories
The Shop page SHALL list the top categories, each with its subcategories, as Stock keeps them, linking to each category's page.

#### Scenario: The Shop page (wb-shop)
- **WHEN** a customer presses Shop
- **THEN** they see the categories, such as Bearings and Drivetrain, each linking to its page, with Drivetrain showing Derailleurs beneath it

### Requirement: A category page lists its products with filters from the category's own details
A category page SHALL list its products six at a time with Show more, sorted A to Z by default, with filters from the category's own details plus Availability, Brand and Price. Nothing SHALL be ticked to start. Filters and sort SHALL be kept in the page's address.

#### Scenario: A category's page (wb-category)
- **WHEN** a customer opens Bearings
- **THEN** they see the first six products sorted A to Z, "Showing 6 of [n] products", Show more, and the filters, with nothing ticked

#### Scenario: Filtering by a detail (wb-category-filtered)
- **WHEN** they tick "30 mm" under inner diameter and "Ready today at Bolton"
- **THEN** only bearings with a 30 mm inner diameter and stock at Bolton show, the count updates, each choice shows as a chip labelled "Remove filter …", and Clear all removes them

#### Scenario: Details combine
- **WHEN** they tick two values of one detail and one value of another
- **THEN** products match either of the first two and the third

#### Scenario: Price applies on leaving the box
- **WHEN** they type 20 in From and press Enter
- **THEN** only products of £20.00 or more show

#### Scenario: Show more
- **WHEN** they press Show more
- **THEN** the next six products are added below, and focus moves to the first of them

#### Scenario: Sorting
- **WHEN** they open the sort menu and choose Price, low to high
- **THEN** the menu offers A to Z, Price, low to high, Price, high to low, and Newest
- **AND** the products are listed cheapest first, and the address keeps the sort for Back and a shared link

#### Scenario: The phone Filter panel
- **WHEN** a customer on a phone presses Filter and ticks a value
- **THEN** the panel's button says "Show [n] products" with the new count, and the list changes only when they press it

#### Scenario: A parent category (wb-category-parent)
- **WHEN** they open Drivetrain, which has subcategories
- **THEN** the page lists its subcategories, and offers only Availability, Brand and Price as filters

#### Scenario: A subcategory (wb-category-child)
- **WHEN** they open Derailleurs
- **THEN** the page shows the path "Drivetrain › Derailleurs" and Derailleurs' own details as filters

#### Scenario: No shop chosen yet (wb-category-no-shop)
- **WHEN** a two-shop business's customer hasn't chosen a shop
- **THEN** the Availability filter asks them to choose a shop, and no stock line shows on the cards

#### Scenario: Nothing matches (wb-category-empty)
- **WHEN** their filters match no products
- **THEN** the page says "Nothing matches" and names what was ticked, such as "Nothing is ready today at Bolton…", with "Clear all filters" and "Ask the shop about it", which shows each shop's phone and email in place

### Requirement: The product page shows the product, its stock at the chosen shop and its details
The product page SHALL show:
- the name and the price with "Includes VAT · [Brand]"
- the stock line for the chosen shop ("Ready today at Bolton · [n] in stock")
- Add to basket
- "Ask the shop about this"
- About it (the description)
- Specifications (the category's details with this product's answers)

A product with sizes or colours SHALL ask "Colour: choose one" and "Size: choose one" with nothing chosen. It SHALL say "Choose a colour and size to see when it’s ready" until both are chosen.

#### Scenario: A product (wb-product)
- **WHEN** a customer opens Shimano brake pads B05S-RX with Bolton chosen
- **THEN** they see "£28.00", "Includes VAT · Shimano", "Ready today at Bolton · [n] in stock", Add to basket, About it and Specifications

#### Scenario: A product with sizes (wb-product-sizes)
- **WHEN** they open a product with sizes S, M, L and XL in colours
- **THEN** nothing is chosen, "Choose a colour and size to see when it’s ready" shows, and the stock line appears once both are chosen

#### Scenario: A size in stock at the other shop (wb-product-size-other)
- **WHEN** they choose M in [Colour 1], which Bolton doesn't have but the other shop does
- **THEN** M, struck through until it is chosen, shows chosen with the thick border, and the page says "M isn’t in stock at Bolton in [Colour 1] — it’s in stock at our [Second site] shop", with M read out as " — not in stock at Bolton"

#### Scenario: Sold out at the chosen shop (wb-product-held)
- **WHEN** nothing is left at Bolton, including when the last one is held for a Cycle to Work order
- **THEN** the page says "Sold out at Bolton"

#### Scenario: Asking about a product
- **WHEN** they press "Ask the shop about this"
- **THEN** each shop's phone and email show in place

#### Scenario: A product that isn't online
- **WHEN** someone opens the address of a product that is off the website
- **THEN** they see "We can’t find that page"

### Requirement: A product's photos open in a viewer
A product SHALL show its own photo and its sizes' and colours' photos, with no repeats. When it has more than one, the photos SHALL open in a viewer that says "Photo 2 of 4" and "Left and right arrows change photo · Esc closes". A product with no photo SHALL show its name in a tile.

#### Scenario: The photo viewer (wb-product-photos)
- **WHEN** a customer presses the second of four photos
- **THEN** the viewer opens at "Photo 2 of 4"; the right arrow shows photo 3; Esc closes it and returns focus to the photo they pressed

#### Scenario: One photo
- **WHEN** the product has one photo
- **THEN** it shows without the viewer's controls

### Requirement: Search suggests as the customer types and finds products, repairs, categories and pages
The search box SHALL suggest from the second letter, grouped as Products, Repairs, Categories and Pages, ending with "See all results for “brake”". Results SHALL say "Results for “brake”", with repairs under "Repairs for “brake”", sorted by Best match by default. A search that reads as a measurement SHALL open the category with that detail ticked.

#### Scenario: Suggestions while typing (wb-search-typing)
- **WHEN** a customer types "brake"
- **THEN** a list shows Products, Repairs, Categories and Pages that match, and "See all results for “brake”", moved through with the arrow keys

#### Scenario: No suggestions (wb-search-no-suggestions)
- **WHEN** nothing matches what they typed
- **THEN** the list says "No suggestions for “[what they typed]” — press Enter to search."

#### Scenario: Search results (wb-category-search-results)
- **WHEN** they press Enter on "brake"
- **THEN** the page says "Results for “brake”", shows "Repairs for “brake”" with each service and price, then the products sorted by Best match with the category page's filters

#### Scenario: A measurement search (wb-category-search-measure)
- **WHEN** they search "bearing 30 mm"
- **THEN** the page says "Bearings with an inner diameter of 30 mm · [n] products", with that detail ticked and removable

#### Scenario: No results (wb-category-search-none)
- **WHEN** a search finds nothing
- **THEN** the page says "No results for “[what they typed]”" and "Check the spelling, try a shorter word, or look through the categories.", with Ask the shop showing "Bolton: Call [shop phone] or email [shop email]"

### Requirement: Our shops shows each shop's address, hours and contact details
Our shops SHALL show a card for each shop with:
- the address
- today's hours ("[Open today] [opening hours]", or "[Closed today] · opens [day] [time]")
- the phone
- Book a repair here
- Directions, labelled as opening the visitor's maps app

Each shop's page SHALL show "North Street Cycles, Bolton", the opening hours with today in bold, "Closed [holiday dates]." and "Collect from here". With one shop this SHALL be the "Find us" page.

#### Scenario: Our shops (wb-shops)
- **WHEN** a customer opens Our shops
- **THEN** each shop's card shows its address, today's hours, phone, Book a repair here and Directions (opens your maps app)

#### Scenario: A shop's page (wb-shop-page)
- **WHEN** they open Bolton's page
- **THEN** they see "North Street Cycles, Bolton", the opening hours table with today in bold, the closures, and Collect from here

#### Scenario: Collecting from a shop (wb-shop-collect)
- **WHEN** they press Collect from here
- **THEN** the chip changes to that shop and the page says "Collecting from Bolton — what you see now shows when it’s ready here."

#### Scenario: Find us with one shop (wb-find-us)
- **WHEN** the business has one shop and the customer presses Find us
- **THEN** they see that shop's page, without Collect from here

#### Scenario: A second shop before it has its own details
- **WHEN** the business has two shops and only one set of address, phone and hours
- **THEN** the first shop's card and page show them, and the second shop's card and page show its name only, until Multiple sites gives each shop its own

#### Scenario: Closed today
- **WHEN** today is a day the shop is closed
- **THEN** its card says "[Closed today] · opens [day] [time]", worked out in the shop's own time zone

### Requirement: A page that doesn't exist says so and offers a way on
An address on the website that matches no page or product SHALL show "We can’t find that page" and "It may have moved, or the link may be wrong.", with "Search for a page or product", "Go to the home page" and "Our shops".

#### Scenario: Not found (wb-not-found)
- **WHEN** a customer opens a website address that doesn't exist
- **THEN** they see "We can’t find that page", the search box, Go to the home page and Our shops

### Requirement: The shop's own staff can see a switched-off website and turn it on
Staff of this shop who are signed in SHALL see the switched-off website at `/store/<slug>/` with a banner. It SHALL say "Only your staff can see this.", "Your website is switched off — customers see “This website isn’t available”." and "Turning it on the first time also publishes it.", with Turn it on, Edit this page and Back to Wheelhouse. Turning it on SHALL use the Website page's own publish-and-switch. Only the Owner SHALL turn it on, until roles.

#### Scenario: The staff banner (wb-off-preview)
- **WHEN** the Owner, signed in, opens `/store/northstreet/` while the website is off
- **THEN** they see the home page with the banner, Turn it on, Edit this page and Back to Wheelhouse

#### Scenario: The staff banner on a product (wb-off-preview-product)
- **WHEN** they open a product page
- **THEN** the same banner shows above it, and Edit this page opens the Website page

#### Scenario: Staff who can't turn it on (wb-off-preview-ask)
- **WHEN** a staff member who isn't the Owner opens the switched-off website
- **THEN** the banner says "Ask Jack Lewis to turn it on." in place of Turn it on

#### Scenario: Turning it on (wb-turned-on)
- **WHEN** the Owner presses Turn it on
- **THEN** the website is published (the first time) and switched on, and the banner says "Your website is on." and "Customers can see it now.", with Turn off

#### Scenario: Customers never see the banner
- **WHEN** a customer, or staff of another shop, opens the switched-off website
- **THEN** they see "This website isn’t available" and nothing of the banner

### Requirement: The website asks before any tracking cookie and lists the cookies it sets
When the shop has added a tracking tool, the website SHALL show "Cookies on this website" with "We use the cookies the site needs to work. With your OK, we’d also like to use [tracking tool] to see how people use the site.", About cookies, Reject all, Accept all and Choose. No tracking tool SHALL load until the visitor accepts its kind. The Cookies page SHALL list, from the same list the code sets, the cookies the website sets and the tools the shop has added.

#### Scenario: The banner (wb-cookies-banner)
- **WHEN** a visitor first opens a website whose shop has added a measuring tool
- **THEN** the banner shows, and the tool's script is not on the page

#### Scenario: Accepting
- **WHEN** they press Accept all
- **THEN** the banner closes and the tool loads

#### Scenario: Rejecting
- **WHEN** they press Reject all
- **THEN** the banner closes, the tool never loads, and the choice is remembered

#### Scenario: Choosing (wb-cookies-choose)
- **WHEN** they press Choose
- **THEN** "Choose cookies" shows "Needed for the site to work" (Always on), "Measuring visits" (Off) and "Advertising" (Off), with "Save my choices"

#### Scenario: Saved (wb-cookies-saved)
- **WHEN** they turn on Measuring visits and press "Save my choices"
- **THEN** "Your cookie choices are saved" shows, and only measuring tools load

#### Scenario: The Cookies page (wb-cookies-page)
- **WHEN** they open Cookies from the footer
- **THEN** they see "Cookies this website sets" (keeps your basket, keeps you signed in, remembers the shop you collect from, remembers your cookie choices, each with how long it lasts), "Tools the shop has added", what they chose (such as "You said no to measuring visits."), and "Change cookie choices"

#### Scenario: No tracking tools (wb-cookies-page-plain)
- **WHEN** the shop has added no tracking tool
- **THEN** no banner shows, and the Cookies page says "This website doesn’t use any other cookies, so there’s nothing for you to choose."

### Requirement: The footer pages show the shop's published words
Collection and returns, Privacy and Contact us SHALL be pages in the shell. The first two SHALL show the shop's published words for each. Contact us SHALL show each shop's address, phone and email.

#### Scenario: Collection and returns
- **WHEN** a customer opens Collection and returns from the footer
- **THEN** they see the shop's published collection and returns words

#### Scenario: Contact us
- **WHEN** they open Contact us
- **THEN** they see each shop's address, phone and email

### Requirement: The old customer site is removed once the new one is in
Once every page above is built, the old customer site (`public-storefront/`) and its product list route SHALL be removed. The Website page SHALL stop writing the old site's settings, except the logo, which publishing still copies for the printed Cycle to Work quote until that quote reads the website's own logo.

#### Scenario: The old site is gone
- **WHEN** a customer opens `/store/northstreet/` after this change
- **THEN** they see the new website, and the old product list route answers "We can’t find that page"
