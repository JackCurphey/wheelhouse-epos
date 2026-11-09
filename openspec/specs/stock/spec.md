# stock Specification

## Purpose
TBD - created by archiving change stock-list. Update Purpose after archive.

## Requirements

### Requirement: Stock opens on a searchable list
The Stock page SHALL list the shop's products, each with its name, its code, category and supplier, its stock, and its price, and SHALL find products by name, barcode, code or supplier from one search box (`st-list`). Each product SHALL open its own page.

#### Scenario: Finding the brake pads
- **WHEN** staff type "B05S" into Search stock
- **THEN** Shimano brake pads B05S-RX shows, with its stock and £28.00

### Requirement: Running low and Below zero
A product with a low-stock level whose stock is at or under it SHALL show "Running low"; a product under zero SHALL show "Below zero". The Running low and Below zero filters SHALL show only those products.

#### Scenario: Below zero
- **WHEN** staff press Below zero
- **THEN** only products with stock under 0 are listed, each marked Below zero

### Requirement: Margin and cost for the Owner only
The list's Margin and the product page's Cost and Margin SHALL show only to someone who can see costs, and the product page's Show on website only to the Owner. Until roles bring the person's "Can see costs and margin" switch, that is the Owner, and only when the Owner is the person at the computer. The server SHALL send a product's cost, from every route, only to someone who can see costs (stock decision 11; Reports and accounts decisions 5 and 9).

#### Scenario: Jo Taylor opens the brake pads
- **WHEN** Jo Taylor (Staff) opens Shimano brake pads
- **THEN** she sees Price and VAT, and no Cost or Margin

#### Scenario: Jo Taylor at the Owner's till
- **WHEN** Jo Taylor is checked in on a till signed in as the Owner, or nobody is checked in there, and Stock or a product is opened
- **THEN** no cost is in what the server sent, and no Cost or Margin shows

#### Scenario: the Owner
- **WHEN** the Owner, signed in on their own computer or checked in, opens Stock or a product
- **THEN** the Cost and Margin show

### Requirement: A product's page
A product's page SHALL show: back to Stock, its name, photo and codes; In stock with its low-stock level; its details; its price and VAT; and its stock history newest first, which can be narrowed to Sold, Received, or Counted and adjusted (`st-product`). Each history line SHALL say who made it where that is recorded. Anyone with the page SHALL be able to Adjust stock; the Owner SHALL also be able to Edit it.

#### Scenario: The brake pads' history
- **WHEN** staff open Shimano brake pads and press Sold
- **THEN** only the lines where it was sold show, newest first

#### Scenario: Staff see no Edit
- **WHEN** Jo Taylor opens Shimano brake pads
- **THEN** there is Adjust stock but no Edit

### Requirement: Adjust stock with a reason
Anyone with the Stock page SHALL be able to adjust a product's stock from its page by the change or the count after it, with a reason that follows the sign: going down, Damaged, Lost or stolen, Used in the workshop, Faulty — to return to supplier, or Other; going up, Found or Other. Other SHALL need a note. No reason SHALL be picked until one is, and Adjust SHALL say why it can't be pressed yet (`st-adjust`, `st-adjust-faulty`).

#### Scenario: Damaged brake pads
- **WHEN** Jack Lewis opens Shimano brake pads, presses Adjust stock, leaves the change at −1, picks Damaged and presses Adjust
- **THEN** its stock goes down by 1 and the history's newest line reads "Adjusted · Damaged" with his name

#### Scenario: No reason yet
- **WHEN** Jack Lewis opens Adjust stock and picks no reason
- **THEN** Adjust is greyed and says "Pick a reason to adjust"

### Requirement: Every adjustment records who
Every adjustment SHALL be recorded in the product's stock history with its reason, its note, who made it and when.

#### Scenario: Who adjusted it
- **WHEN** Jack Lewis adjusts the brake pads
- **THEN** the line says Jack Lewis

### Requirement: Two adjustments at once both count
Two adjustments made at the same moment SHALL both change the stock; neither SHALL be lost, and they SHALL not take stock below zero.

#### Scenario: Two people take one off at once
- **WHEN** two adjustments of −1 reach a product with 6 in stock at the same moment
- **THEN** it has 4, with two lines in its history

### Requirement: Anyone with the Stock page adjusts
The Owner, Managers and Staff SHALL all see Adjust stock and be able to adjust, since who adjusts what is recorded (Jack, 26 Oct, `docs/decisions/2026-10-26-day-answers.md` section 11).

#### Scenario: Jo Taylor adjusts
- **WHEN** Jo Taylor (Staff) adjusts Shimano brake pads, Lost or stolen
- **THEN** the history's newest line reads "Adjusted · Lost or stolen" with Jo Taylor's name

### Requirement: A product's details saved twice at once both stay
When two saves of different details of the same product arrive at the same moment, each SHALL be kept: the second save SHALL start from what the first wrote, never from what was stored before it. The checks on what is sent (a name, a code or barcode no other product has), and which shop's products a save can reach, SHALL be unchanged.

#### Scenario: A price and a description at once
- **WHEN** a product's new price and a new description save at the same moment
- **THEN** both are stored

#### Scenario: A refused save
- **WHEN** a product save is refused because the name is empty
- **THEN** nothing it sent is stored, and the next save goes straight through

### Requirement: A Shopify refund and another stock change at once both count
When a refund made in Shopify puts stock back while another change to the same product's stock (a sale, an adjustment, a delivery) is being made, both SHALL count: the refund SHALL add to the stock as it is when the refund is recorded, never to a figure read before. The refund's line in the product's stock history SHALL be recorded together with its stock change, or not at all. The stock figure Wheelhouse then sends to Shopify SHALL be the stock after both changes.

#### Scenario: Stock taken off while a refund comes in
- **WHEN** a product has [n] in stock, three are taken off, and a Shopify refund of one arrives at the same moment
- **THEN** it has [n] − 3 + 1, with the refund's "Shopify refund" line in its history, and Shopify is sent [n] − 3 + 1

### Requirement: A failed Shopify refund is applied when Shopify sends it again
A Shopify refund that fails partway SHALL change no stock and write no history line, and SHALL be recorded as failed. When Shopify sends the same refund again, it SHALL be applied.

#### Scenario: A refund fails, then Shopify retries it
- **WHEN** a refund of two products fails on the second
- **THEN** neither product's stock changes, and when Shopify sends it again both go back

### Requirement: A Shopify refund sent twice counts once
The same Shopify refund received more than once, one after the other or at the same moment, SHALL put its stock back once, with one history line.

#### Scenario: The same refund arrives twice at once
- **WHEN** Shopify sends one refund of one item twice at the same moment
- **THEN** the stock goes up by one, with one "Shopify refund" line

### Requirement: A Shopify refund that doesn't restock leaves stock alone
A refund line that Shopify marks as not restocked (`no_restock`: the money goes back, the item doesn't go back on the shelf) SHALL leave the product's stock and its history unchanged. Other lines of the same refund SHALL be put back.

#### Scenario: One line restocked, one not
- **WHEN** a refund has one line marked `no_restock` and one marked `return`
- **THEN** only the `return` line's product goes back up

### Requirement: An adjustment keeps its value at cost
Every adjustment SHALL keep its value at cost when it was made: how many it moved, up or down, times the product's cost, in whole pence. Whether it goes to Today SHALL be settled when it is made, against the amount set then.

#### Scenario: The cost changes later
- **WHEN** an adjustment was worth £[value] and the product's cost changes afterwards
- **THEN** Today's line still says £[value]

### Requirement: Stock opens with Below zero picked from Today
Stock SHALL open with Below zero picked when it is opened from Today's See them.

#### Scenario: See them
- **WHEN** Jack Lewis presses See them on Today's below-zero line
- **THEN** Stock opens listing only the products below zero, with Below zero picked

### Requirement: A save never overwrites a cost it wasn't given
Saving a product with no cost, a null or an empty cost SHALL leave its stored cost as it is. Someone who can't see costs SHALL NOT be able to change a product's cost, whatever they send, and a product they add SHALL start with no cost recorded. The Owner SHALL still be able to change a cost, including to £0.

#### Scenario: Jo Taylor saves the brake pads
- **WHEN** Jo Taylor changes the description of Shimano brake pads, and what's sent has the cost as null, 0 or a new figure
- **THEN** the description changes and the cost stored stays as it was

#### Scenario: adding a product in the old app with costs hidden
- **WHEN** someone who can't see costs opens the old app's add form
- **THEN** it offers no cost box, so nothing typed there is thrown away

#### Scenario: the Owner corrects a cost
- **WHEN** the Owner saves the brake pads with a new cost
- **THEN** the new cost is stored

### Requirement: A supplier's trade price follows the same rule
A supplier's catalogue item SHALL send its trade price only to someone who can see costs, and importing one SHALL still record that price as the new product's cost, without sending it to someone who can't.

#### Scenario: Jo Taylor reads a supplier's catalogue
- **WHEN** Jo Taylor opens a supplier's catalogue items
- **THEN** each item's trade price isn't in what the server sent

### Requirement: A product's price and cost are whole pence
Every product SHALL have its price and cost in whole pence, exactly equal to its price and cost in pounds, however that price or cost was written, by any part of the app, old or new.

#### Scenario: The brake pads
- **WHEN** Shimano brake pads are priced at £28.00
- **THEN** their price is 2800 pence

#### Scenario: A price that floating point gets wrong
- **WHEN** a product is priced at £19.99, £4.35 or £1.15
- **THEN** its price is 1999, 435 or 115 pence, never a penny out

#### Scenario: The old app saves a price
- **WHEN** the old app saves a product with a price of £[price]
- **THEN** its price in pence changes with it, and the old till still sells it at £[price]

### Requirement: A price or cost can be saved in whole pence
A product SHALL be able to be added or saved with a price or cost in whole pence. A figure that isn't a whole number SHALL be refused, as SHALL a cost over 9,999,999,999 pence, and a refused save SHALL store nothing. A price in pence SHALL win over a price in pounds sent with it.

#### Scenario: Saving a price
- **WHEN** a product is saved with a price of 2800 pence
- **THEN** its price is £28.00 on every screen

#### Scenario: A fraction of a penny
- **WHEN** a product is saved with a price of 28.5 pence and a new description
- **THEN** the save is refused, and neither changes

### Requirement: A price stops at what a sale can carry
A price over £21,474,836.47 SHALL be refused however it is sent or brought in, since a sale line can't carry it. A product already priced over it SHALL still open and save when its price isn't changed.

#### Scenario: Too large a price
- **WHEN** a product is saved at £21,474,836.48, in pence or pounds
- **THEN** the save is refused and nothing it sent is stored

#### Scenario: From a Citrus Lime file
- **WHEN** a row of a price list has a price of £21,474,836.48
- **THEN** the row needs a look and the rest come across

### Requirement: A count holds any cost a product can
A stock take SHALL count, apply, show and undo a product whatever its cost.

#### Scenario: A very large cost
- **WHEN** a product costs more than £21,474,836.47 and a count finds one fewer
- **THEN** Apply goes through with its value at cost exact, and Undo puts it back

### Requirement: A cost in pence follows the cost rules
A cost in pence SHALL go only to someone who can see costs. Someone who can't see costs SHALL NOT be able to change a cost in pence, whatever they send. A save with no cost in pence, or a null or empty one, SHALL leave the stored cost as it is.

#### Scenario: Jo Taylor opens the brake pads
- **WHEN** Jo Taylor (Staff) opens Shimano brake pads
- **THEN** no cost, in pounds or pence, is in what the server sent

#### Scenario: Jo Taylor sends a cost in pence
- **WHEN** Jo Taylor saves the brake pads with a cost in pence
- **THEN** the save goes through and the stored cost stays as it was

### Requirement: A product's save never hangs on a locked product
When a product can't be saved because it's held by something else for more than a short time, the save SHALL stop waiting and say Wheelhouse is busy, storing nothing, so the shop's other requests aren't starved of connections.

#### Scenario: The brake pads are held
- **WHEN** a product's row stays locked and someone saves that product
- **THEN** they are told Wheelhouse is busy within seconds, and nothing they sent is stored

### Requirement: Every stock change says who, why, which shop and what caused it
Every change to a product's stock SHALL write a line in its history saying who made it, why, at which shop where one is known, and what caused it. Who SHALL be the person at the computer, not only the sign-in, and SHALL still be named if that person is later removed. A change no person made, such as a Shopify refund, SHALL name nobody and say what caused it.

#### Scenario: Jo Taylor at the Owner's till
- **WHEN** Jo Taylor is checked in on a till at Bolton signed in as Jack Lewis, and adjusts Shimano brake pads
- **THEN** the line names Jo Taylor and Bolton, and the history and Today say Jo Taylor

#### Scenario: A delivery
- **WHEN** Jack Lewis books in a delivery against an order
- **THEN** each line names him, the order and the delivery

#### Scenario: A line from before
- **WHEN** a line was written before this
- **THEN** it keeps the name it recorded

### Requirement: Nobody checked in, nothing changes
On a till or workshop computer with nobody checked in, adjusting stock, adding or importing a product with stock, and applying or undoing a count SHALL ask for a PIN and change nothing. Sales SHALL carry on as they do today.

#### Scenario: Adjusting at an empty till
- **WHEN** nobody is checked in on a till and Adjust is pressed
- **THEN** it says "Check in with your PIN first" and the stock doesn't change

### Requirement: All stock changes go through one place
Nothing in the server SHALL change a product's stock or write a stock line except the one function for it.

#### Scenario: A sale, a refund and a count at once
- **WHEN** a sale, a Shopify refund and an applied count change one product at the same moment
- **THEN** all three count, each with its own line

### Requirement: A stock change never hangs on a held product
A stock change SHALL wait a short time for a product something else holds, then say Wheelhouse is busy and change nothing. A till's sale SHALL be sent again by the till, and a Shopify order or refund again by Shopify, and each SHALL then count once. Staff SHALL be told Wheelhouse is busy, not that something failed, and at the till SHALL NOT be told to reverse a card payment for it.

#### Scenario: Adjusting a held product
- **WHEN** a product is held and someone adjusts it
- **THEN** within seconds they're told Wheelhouse is busy, and the stock and history are unchanged

#### Scenario: A till's sale while the product is held
- **WHEN** a till's sale reaches a held product
- **THEN** the till is told to send again, and when it does the sale counts once

#### Scenario: A Shopify order while the product is held
- **WHEN** a Shopify order reaches a held product, and Shopify sends it again
- **THEN** the first changes nothing, and the second sells it once with one line

#### Scenario: A paid Shopify order with an item at nothing
- **WHEN** a Shopify order has one item with none in stock and another with some
- **THEN** both lines are recorded, the first goes below zero, and it shows in Today's below-zero warning

#### Scenario: A paid Shopify order with a product taken off sale
- **WHEN** a Shopify order has one product taken off sale here and another on sale
- **THEN** both lines are recorded with their stock changes, and the product stays off sale, refused at the till and everywhere else

#### Scenario: A job already paid
- **WHEN** an answer was lost on a job's card payment and Card approved is pressed again
- **THEN** the till says the sale was recorded and not to take payment again

#### Scenario: A card sale at a busy moment
- **WHEN** Card approved is pressed and Wheelhouse is busy
- **THEN** it says the sale may not be recorded yet and to try again, and that if the card machine took the payment not to take it again

### Requirement: Applying a very large count doesn't stop the shop
Applying a count SHALL hold its products as briefly as it can. A sale of one of them during a very large count (50,000 products) MAY be told to try again for about 6 seconds, and SHALL then go through.

#### Scenario: A sale during a large count
- **WHEN** a count of 50,000 products is being applied and one of them is sold
- **THEN** the sale goes through, after being told to try again if it had to wait over 2 seconds

### Requirement: A supplier's item imported with stock has a history line
Importing a supplier's item with stock SHALL write a line in the new product's history saying where it came from.

#### Scenario: Importing an item with stock
- **WHEN** Jack Lewis imports an item with [n] in the supplier's feed
- **THEN** the product starts with [n] and a line saying it was imported from that supplier's catalogue, naming him

### Requirement: Every business has a first shop
Every business SHALL have at least one shop: one made when it signs up, and one given to any business already here with none. It SHALL be named after the business, with the first letter of its name as its code, or A where the name has no letter. A business with a shop already SHALL keep what it has, and get no other.

#### Scenario: Signing up
- **WHEN** North Street Cycles signs up
- **THEN** it has one shop, North Street Cycles, code N, and Set up this till offers it, with N1 as the first till number

#### Scenario: Renaming the business
- **WHEN** North Street Cycles is renamed in Settings
- **THEN** its shop named North Street Cycles takes the new name and keeps code N; a shop named Bolton would stay Bolton

#### Scenario: A business with Bolton already
- **WHEN** this reaches a business that already has Bolton
- **THEN** it has Bolton and nothing else

### Requirement: Stock is held at each shop, with the total kept beside it
Each product's stock SHALL be held per shop. The business's total SHALL stay on the product, and SHALL always equal the sum of its shops, because the one function that changes stock changes both together. Whatever reads the total SHALL read what it read before: the old till, Shopify, reports, the stock list and the below-zero warning.

#### Scenario: A change at a till
- **WHEN** a till at [Second site] sells one Shimano brake pads, with 5 at the first shop and 3 at [Second site]
- **THEN** [Second site] has 2, the first shop has 5 and the total is 7

#### Scenario: A change with no shop of its own
- **WHEN** stock changes from an ordinary browser, Shopify or the Citrus Lime import
- **THEN** it is the business's oldest shop's

#### Scenario: Fixing a Citrus Lime row at a till
- **WHEN** a row with stock is fixed at a till at [Second site]
- **THEN** its line names the person fixing it, and its stock goes to the business's oldest shop, with the rest of the file

#### Scenario: Stock already here
- **WHEN** this reaches a product with stock
- **THEN** all of it is at the business's oldest shop, below zero included, and its total hasn't changed

### Requirement: Every stock line says its shop
Older stock lines SHALL be given their shop: a till sale's line the till's shop, any other the business's oldest. A line that says already SHALL keep it. Every new line SHALL say its shop.

#### Scenario: An older till sale
- **WHEN** a line from before this records a sale on a till at [Second site]
- **THEN** it says [Second site]

### Requirement: Adjust stock works on this shop's figure
Adjust stock SHALL show this shop's figure and SHALL refuse to take this shop below zero, whatever another shop holds. A sale on the old till SHALL still be checked against the total, as it always has been, so it can take one shop below zero. Going up SHALL always be allowed.

#### Scenario: Nothing at this shop
- **WHEN** a till at [Second site], where there are none, adjusts a product the first shop has 5 of, by one fewer
- **THEN** it says "Stock cannot go below zero" and nothing changes

### Requirement: A product's page shows its stock at each shop
A product's page SHALL list each shop with its stock, oldest first, for everyone with the Stock page, Staff included. With more than one shop its low-stock level SHALL read "[n] each".

#### Scenario: Two shops
- **WHEN** Jack Lewis opens Shimano brake pads with two shops
- **THEN** In stock lists Bolton [n] and [Second site] [n], then Low-stock level [n] each

### Requirement: Categories sit inside others
A business's categories SHALL form a tree: each sits at the top or inside one other, and a product's category SHALL be its whole path, "Drivetrain › Derailleurs". The tree SHALL be built from the categories products already have, and wherever a product's category is written the categories in it SHALL be found or made. "Uncategorised" SHALL NOT be a category.

#### Scenario: A product added to Drivetrain › Derailleurs
- **WHEN** a product is added with the category "Drivetrain ›Derailleurs "
- **THEN** it reads "Drivetrain › Derailleurs", and Derailleurs sits inside Drivetrain

#### Scenario: Uncategorised inside a path
- **WHEN** a product is added with the category "Uncategorised › Tyres"
- **THEN** its category is Tyres, and there is no category called Uncategorised

#### Scenario: A category called Uncategorised
- **WHEN** the Owner adds a category called "uncategorised", or renames one to it
- **THEN** it is refused, saying it's what a product with no category shows

### Requirement: Each category has its own details
In Settings › Stockroom › Categories the Owner SHALL give a category details: a name and the kind of answer, a number with its unit, a choice from a list with its choices, or text. A category SHALL pass its details down to the categories inside it, and a detail's name SHALL be used once from the top of the tree to the bottom. Removing a detail SHALL remove its answers, and the edit box SHALL be able to say how many products that is.

#### Scenario: Bearings
- **WHEN** Jack Lewis gives Bearings Inner diameter, Outer diameter and Height, each a number in mm
- **THEN** Bearings lists those three, each with its unit

#### Scenario: A detail with no unit
- **WHEN** a number detail is saved without a unit
- **THEN** it is refused, saying to give it a unit

### Requirement: Renaming or moving a category takes its products with it
Renaming a category, or moving it inside another, SHALL change the path of every category inside it and of every product in them, at once. It SHALL NOT be able to sit inside itself or one of its own, take a name already beside it, or change while one of its categories is being counted.

#### Scenario: Renaming Drivetrain
- **WHEN** Drivetrain is renamed
- **THEN** its derailleurs read "[new name] › Derailleurs"

#### Scenario: Moving where a detail's name is taken
- **WHEN** Wheels and Bearings each have Height, and Bearings is moved inside Wheels
- **THEN** it is refused, saying Wheels already has a detail called Height, and Bearings stays where it was

#### Scenario: Being counted
- **WHEN** Drivetrain › Derailleurs is being counted and Drivetrain is renamed
- **THEN** it says "Drivetrain › Derailleurs is being counted. Apply that count first." and nothing changes

#### Scenario: A count started while a rename is under way
- **WHEN** a count of a category is started at the same moment the category is renamed
- **THEN** either the rename is refused because the count is running, or the count finds no products in the old name; never a count of a category that's gone

### Requirement: A category of any depth can be counted
Starting a count of a category SHALL work for any path the tree holds, however long. An area's name SHALL still stop at 60 characters.

#### Scenario: A deep category
- **WHEN** a count of "Components › Drivetrain › Derailleurs › Rear derailleurs › 12-speed" is started
- **THEN** it starts

### Requirement: A product with sizes and colours is one product
A product with sizes and colours SHALL be one product people see, with each size and colour its own product underneath, with its own barcode, code, price, cost and stock. Each size and colour SHALL be in a product once, whatever its case. Everything that sells, orders, receives, counts or changes stock SHALL treat each size as the product it is, unchanged.

#### Scenario: Selling a size
- **WHEN** size M in [Colour 1] is sold on the old till
- **THEN** that size's stock goes down as any product's does, and the product's total with it

### Requirement: Stock lists a product with sizes once
The new stock list SHALL show one row for a product with sizes, with its total stock, how many sizes and colours it has, how many sizes are below zero and running low, and its lowest and highest price. Staff SHALL see no cost.

#### Scenario: The list
- **WHEN** Jack Lewis opens Stock with a product with sizes in two sizes and two colours, one size below zero
- **THEN** it is one row, "[n] sizes · [n] colours · 1 size below zero", with its total

### Requirement: Searching a size opens that size
Searching SHALL find a size by its barcode or code, and by its product's name with its size or colour, each its own row named by its product with its size and colour. A product's name alone SHALL find the product's one row.

#### Scenario: Jersey M
- **WHEN** someone searches "[Product with sizes] M"
- **THEN** size M in each colour it comes in is listed, each with its own stock and price

### Requirement: A product with sizes has its grid
A product with sizes SHALL list its sizes and its colours, and each size and colour with its own barcode, stock and price, for its grid.

#### Scenario: Its grid
- **WHEN** its page is opened
- **THEN** it has its sizes and colours in the order they were made, and each size and colour's own figures

### Requirement: Only the Owner adds or changes a product
Adding a product, changing one, its price or cost, taking it off or back on sale, its photo or its details, bringing a supplier's item in, and making or changing a product with sizes SHALL be the Owner's, until "Can order stock" exists. Anyone else, including someone checked in by PIN under the Owner's sign-in, SHALL be told "Only the shop’s owner can add or change products" and nothing SHALL change. Adjusting and counting stock and receiving deliveries SHALL stay with everyone.

#### Scenario: Jo Taylor adds a product on the old Stockroom
- **WHEN** Jo Taylor adds a product
- **THEN** she is told "Only the shop’s owner can add or change products", and it isn't added

### Requirement: A product answers its category's details
A product SHALL have an answer to each detail of its category and those above it: a number of up to four decimal places, one of a choice's choices, or text. An answer that doesn't fit SHALL be refused, saying why.

#### Scenario: A bearing's outer diameter
- **WHEN** Jack Lewis gives a bearing an outer diameter of 30
- **THEN** its page shows Outer diameter 30 mm

### Requirement: Products are found by their measurements
Searching a number with a unit SHALL find products with a number detail in that unit with that value. Picking a category SHALL show it and those inside it, and each of its details SHALL narrow them.

#### Scenario: bearing 30 mm
- **WHEN** someone searches "bearing 30 mm"
- **THEN** the bearings with a 30 mm detail are found, and nothing with 30 cm

### Requirement: Each size is named with its size and colour
Each size of a product with sizes SHALL be named with the product's name, its size and its colour, and SHALL have the product's category, kept in step whenever the product, a size or a colour is renamed. A sale's line SHALL say that name.

#### Scenario: Jersey M Blue
- **WHEN** size M in Blue of Jersey is sold
- **THEN** the sale's line reads "Jersey M Blue"

#### Scenario: Renaming
- **WHEN** Jersey is renamed
- **THEN** every one of its sizes is renamed with it, at once

#### Scenario: A size's category
- **WHEN** one size of Jersey is saved on its own with another category
- **THEN** it is refused, saying to change the category on Jersey

#### Scenario: Swapping M and L
- **WHEN** sizes M and L are swapped in one save
- **THEN** both are saved, each with its new name

### Requirement: Settings shows each category with its details
Settings › Stockroom SHALL have a Categories fold after Stock adjustments, summarised by its most particular categories ("Bearings, Drivetrain › Derailleurs and 1 more"). It SHALL list every category, one inside another set in, with its own details on one line, whether it passes them down or has some from above, and an Edit button, then "+ Add a category".

#### Scenario: The drawn categories
- **WHEN** the Owner opens Settings › Stockroom › Categories with Bearings, Drivetrain and Drivetrain › Derailleurs
- **THEN** Bearings reads "Inner diameter (mm) · Outer diameter (mm) · Height (mm)", Drivetrain "[Detail] · passed down to its sub-categories", and Derailleurs, set in, "Number of gears (a choice) · and Drivetrain’s details"

### Requirement: The category box asks for what each detail needs
Editing or adding a category SHALL show where it sits, picked from a list by keyboard and never itself or one of its own, what it has from the categories above with a way to change it there, and its own details. Adding a detail SHALL ask for a unit for a number, the choices for a choice, and nothing more for text. A removed detail SHALL be undoable until Save, and the box SHALL say how many products lose its answers.

#### Scenario: A detail removed then undone
- **WHEN** the Owner removes Number of gears from Derailleurs, answered on 3 products
- **THEN** it shows struck through with Undo, and the box says "Saving removes Number of gears from 3 products."; pressing Undo brings it back

#### Scenario: A category can't sit inside its own
- **WHEN** the Owner edits Drivetrain and types in Sits inside
- **THEN** neither Drivetrain nor Drivetrain › Derailleurs is offered

#### Scenario: Adding Bearings by keyboard
- **WHEN** the Owner presses "+ Add a category", types Bearings, and adds Inner diameter, Outer diameter and Height each in mm, pressing Enter in Unit
- **THEN** Save makes Bearings with those three details, and its row lists them, at computer and phone widths with nothing scrolling sideways

### Requirement: The list shows a product with sizes on one row
The Stock list SHALL show a product with sizes as one row with its category, how many sizes and colours it has, how many sizes are below zero or running low, its total stock and its prices from lowest to highest. Searching a size or colour SHALL show each size found on its own row, with its size, colour and barcode, opening that size.

#### Scenario: A jersey in sizes
- **WHEN** the list holds [Jersey] in M and L, [Red] and [Blue], one size below zero, priced £30.00 and £35.00
- **THEN** its row reads "[Clothing] · 2 sizes · 2 colours · 1 size below zero", with the total stock and "£30.00–£35.00"

#### Scenario: Searching a size
- **WHEN** someone searches "jersey M"
- **THEN** each M is its own row, "Size M · [Red] · [barcode]", and opens that size's page

### Requirement: A category picked on the list filters by its details
The Stock list SHALL let a category be picked by searching for it, shown as a dark pill that can be removed. A picked category's details, its own and those passed down, SHALL become filters and, on a computer, columns. A measurement searched SHALL show each row's details on its line, the one matched in bold. The list's answer SHALL carry each row's answers only when a category is picked or a measurement searched, and each row's VAT rate.

#### Scenario: Bearings with an outer diameter of 30 mm
- **WHEN** the Owner picks Bearings and types 30 in Outer diameter
- **THEN** the list shows the bearings answering 30 mm, with Inner diameter, Outer diameter and Height as columns, and says "2 in Bearings with Outer diameter 30 mm"

#### Scenario: The plain list
- **WHEN** no category is picked and no measurement is searched
- **THEN** the list's answer carries no product's answers

### Requirement: The Owner edits a product on its page
Edit SHALL open one box with the product's name, supplier code, barcode, supplier, cost, price, low-stock level, category and that category's details, filled in. Saving SHALL save the product and then its details, and show the server's words if either is refused, keeping the box open. Prices and costs SHALL be typed in pounds and saved in whole pence.

#### Scenario: Changing the price
- **WHEN** the Owner edits Shimano brake pads and changes the price from £28.00 to £[price]
- **THEN** the page shows £[price]

#### Scenario: A bearing's outer diameter
- **WHEN** the Owner edits a bearing in Bearings and types 30 in Outer diameter
- **THEN** its Details · Bearings box reads "Outer diameter 30 mm"

### Requirement: A price or cost change goes into the history
Every change to a product's price or cost, from its page, a size's save or a delivery, SHALL be kept with what it was, what it became, who and when. The Owner SHALL see them in the product's history, "Price changed · £28.00 → £[price]", with a Price changes filter; staff SHALL NOT be sent them. Adding a product SHALL record no change.

#### Scenario: Jack changes the price
- **WHEN** Jack Lewis changes Shimano brake pads from £28.00 to £[price]
- **THEN** the history's newest line reads "Price changed · £28.00 → £[price]" with Jack Lewis

#### Scenario: Jo opens the page
- **WHEN** Jo Taylor opens the same page
- **THEN** no price or cost change is in what the server sent

### Requirement: A product with sizes has its own page
A product with sizes SHALL open from its Stock row on a page with its category and how many sizes and colours, its stock at each shop, its prices, a grid of sizes across and colours down with each cell's stock opening that size, and one history for all its sizes saying each line's size and colour (`st-product-sizes`). The Owner SHALL be able to add a size or colour and edit its name and category there.

#### Scenario: The grid
- **WHEN** someone opens [Product with sizes] in S, M, L and XL and two colours, with M in [Colour 1] below zero
- **THEN** the grid shows that cell as below zero, and pressing it opens size M in [Colour 1]

#### Scenario: Adding a size
- **WHEN** the Owner adds size XL in [Colour 2] with its barcode and price
- **THEN** it is in the grid, named "[Product with sizes] XL [Colour 2]"

### Requirement: The Owner adds a product on screen
"+ Add a product" on Stock, "+ Add “[typed]” as a product" when nothing matches, and the new shop's "+ Add a product" SHALL open the product box empty, for the Owner only. Once added, its page SHALL open.

#### Scenario: Nothing matches
- **WHEN** the Owner searches "[what was typed]", finds nothing and presses "+ Add “[what was typed]” as a product"
- **THEN** the box opens with that name filled in

### Requirement: Products are ticked on Stock
Whoever can change prices SHALL see a tick box on each product on Stock and, on a computer, "Tick all [n] shown" above them. With any ticked, a bar SHALL say "[n] ticked" with Untick all and Change prices. Ticks SHALL stay while the search, the filter or the category changes (`st-list-ticked`).

#### Scenario: Ticking a supplier's products
- **WHEN** the Owner searches "[Supplier]" and ticks all 3 shown
- **THEN** the bar says "3 ticked" with Change prices

#### Scenario: Jo Taylor
- **WHEN** Jo Taylor (Staff) opens Stock
- **THEN** there are no tick boxes and no Change prices

### Requirement: Change prices shows old and new before anything changes
Change prices SHALL offer A new price for each, Up or down by a percentage, or A target margin, and for a percentage or margin an ending: Leave as they are, .99 or .00. It SHALL list each ticked product (each size of a product with sizes) with its price now, its new price and its margin before and after, mark a new price under the product's cost "Below cost", and change nothing until "Change [n] prices" is pressed (`st-prices`).

#### Scenario: Ten per cent up, ending in .99
- **WHEN** the Owner ticks Shimano brake pads B05S-RX at £28.00 and picks Up or down by a percentage, +10, ending .99
- **THEN** the preview shows Now £28.00 and New £30.99, and the price is still £28.00

#### Scenario: A target margin with no cost recorded
- **WHEN** a ticked product has no cost recorded and A target margin is picked
- **THEN** it keeps its price, says "No cost recorded", and isn't counted in "Change [n] prices"

#### Scenario: Nothing would change
- **WHEN** the rule leaves every price as it is
- **THEN** "Change prices" is greyed and says "Nothing would change"

### Requirement: Prices are rounded to the nearest ending chosen
Ending in .99 SHALL take the nearest price ending in .99, and .00 the nearest whole pound, halfway going up. A price of £0.00 SHALL stay £0.00, and no other price SHALL round to £0.00.

#### Scenario: Rounding to .99
- **WHEN** a percentage change gives £30.80, and another gives £30.40
- **THEN** they become £30.99 and £29.99

### Requirement: A bulk change goes into each product's history
Each price a bulk change makes SHALL be recorded in that product's history as an edited price is, "Price changed · £28.00 → £[price]", with who and when, and SHALL be pushed to the website as a saved price is.

#### Scenario: The brake pads' history
- **WHEN** the Owner changes the brake pads' price from £28.00 in a bulk change
- **THEN** its history's newest line reads "Price changed · £28.00 → £[price]" with the Owner's name

### Requirement: A bulk change can be undone
After a bulk change, "Prices changed · [n] products" SHALL show with Undo (`st-prices-done`). Undo SHALL put back every price the change made that is still as it made it, record each in the product's history, and leave alone, and count, any price changed since. A change SHALL be undone only once.

#### Scenario: Undo straight after
- **WHEN** the Owner changes 3 prices and presses Undo
- **THEN** all 3 go back to what they were, and it says "Prices put back · 3 products"

#### Scenario: A price edited in between
- **WHEN** one of the 3 products' price is edited after the change, then Undo is pressed
- **THEN** the other 2 go back, the edited one keeps its new price, and it says "· 1 changed since, left as they are"

### Requirement: Only the Owner changes prices in bulk
Previewing, making and undoing a bulk change SHALL be refused to anyone but the Owner, the one at the computer, with "Only the shop’s owner can add or change products", until roles bring "Can order stock"; on a till or workshop computer with nobody checked in it SHALL ask for a PIN. A business's change SHALL never reach another business's products.

#### Scenario: Jo Taylor sends a change
- **WHEN** Jo Taylor sends a bulk price change
- **THEN** it is refused and no price changes

#### Scenario: Another business's product
- **WHEN** a bulk change names a product of another business
- **THEN** that product is left out and its price doesn't change

### Requirement: A bulk change never hangs on a held product
A bulk change SHALL wait a short time for a product something else holds, then say Wheelhouse is busy and change nothing.

#### Scenario: One product is held
- **WHEN** one ticked product's row stays locked and the change is made
- **THEN** within seconds it says Wheelhouse is busy, and no price has changed

### Requirement: A bike's page lists its frame numbers
A bike's page SHALL show "Bikes by frame number" with each frame in stock, "Frame [frame number]", In stock, "Booked in [date] from [Supplier]" (`st-product-bike`). Its history's received line SHALL read "Received · delivery from [Supplier]" with how many frame numbers came in, and open the delivery.

#### Scenario: A bike with two in stock
- **WHEN** staff open a bike with two frames booked in from [Supplier]
- **THEN** both frames are listed, each In stock, and the history says "Received · delivery from [Supplier]" and "2 frame numbers"

### Requirement: Stock says how many bikes by frame number
A bike's line on Stock SHALL read "[Category] · [n] bikes, each by frame number", [n] the frames in stock (`st-list`).

#### Scenario: Two bikes
- **WHEN** a bike has two frames in stock
- **THEN** its line on Stock reads "[Category] · 2 bikes, each by frame number"

### Requirement: A frame is ready to be sold
Each frame SHALL keep room for when it is sold, the customer it is sold to and the customer's bike it becomes, so the till can sell a bike by its frame and the warranty can start from the right bike.

#### Scenario: Nothing sold yet
- **WHEN** a frame is booked in
- **THEN** it is In stock, with no sale, customer or customer's bike
