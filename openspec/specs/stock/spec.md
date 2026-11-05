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
A product's page SHALL show: back to Stock, its name, photo and codes; In stock with its low-stock level; its price and VAT; and its stock history newest first, which can be narrowed to Sold, Received, or Counted and adjusted (`st-product`). Each history line SHALL say who made it where that is recorded. The only change made from the page SHALL be Adjust stock.

#### Scenario: The brake pads' history
- **WHEN** staff open Shimano brake pads and press Sold
- **THEN** only the lines where it was sold show, newest first

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
