# deliveries Specification

## Purpose
TBD - created by archiving change deliveries-orders. Update Purpose after archive.

## Requirements

### Requirement: Deliveries and orders lists the open orders
Stockroom › Deliveries and orders SHALL list, for the Owner, each purchase order that is a draft, ordered or partly delivered, newest first, with its supplier, number of lines, when it was ordered and how many items are still to come (or "Draft · not ordered yet"), a status tag and Open, and SHALL offer "+ New order". With no open orders it SHALL say "No orders. Shops that order on the supplier’s website can ignore this — deliveries are received the same way."

#### Scenario: an order still to come
- **WHEN** the Owner opens Deliveries and orders with an order from [Supplier] of 2 lines, ordered, with 3 items still to come
- **THEN** it shows "[Supplier] · 2 lines", "Ordered [date] · 3 still to come", "Ordered" and Open

#### Scenario: a shop that orders on the website
- **WHEN** the Owner opens Deliveries and orders with no open orders
- **THEN** it shows the empty note and "+ New order"

### Requirement: Orders are for people who can order stock
Until roles are built, only the Owner SHALL see the Orders list and its buttons, and the server SHALL refuse anyone else who makes, changes, marks as ordered or cancels a purchase order. Everyone signed in SHALL be able to open the page and read an order.

#### Scenario: a staff member
- **WHEN** a staff member who isn't the Owner opens Deliveries and orders
- **THEN** there is no Orders list and no "+ New order"

#### Scenario: a staff member tries to order
- **WHEN** a staff member who isn't the Owner sends "mark as ordered" for an order
- **THEN** the server refuses it and the order stays a draft

### Requirement: A new order is built by hand
New order SHALL let the Owner pick a supplier, add products by scanning or searching, set each line's count, see each line's cost and the total cost, and either save it as a draft or mark it as ordered.

#### Scenario: Shimano brake pads, marked as ordered
- **WHEN** the Owner picks [Supplier], scans B05S-RX (Shimano brake pads, cost £28.00), sets the count to 2 and presses "Mark as ordered"
- **THEN** the order is made with 2 Shimano brake pads at £28.00, marked as ordered, and its page opens showing a total cost of £56.00

#### Scenario: A product with no cost recorded
- **WHEN** the Owner adds a product with no cost recorded
- **THEN** its line says "No cost recorded" with a box to type a cost, "Mark as ordered" says to type a cost for every line first, and "Save as draft" still saves it

### Requirement: An order shows what has arrived and can be closed
An order's page SHALL show its supplier, when it was ordered, its status, each line's ordered and arrived counts with "All arrived", "[n] to come" or, once the order is closed, "[n] not coming", and the total cost the server gives. While an order is a draft, ordered or partly delivered, the Owner SHALL be able to close it after confirming. Closing an order nothing has arrived from cancels it. Closing a partly delivered order SHALL keep everything that arrived in stock, on the product's stock history and in each line's arrived count, and SHALL mark the rest as not coming: the closed order has nothing still to come and leaves the Orders list. Either way the order shows as "Closed".

#### Scenario: closing an order nothing has arrived from
- **WHEN** the Owner presses "Close the order" and then "Close the order" in the box
- **THEN** the order is cancelled and leaves the Orders list

#### Scenario: closing an order that has partly arrived
- **WHEN** an order for 3 Shimano brake pads B05S-RX has had 1 booked in, and the Owner presses "Close the order" and then "Close the order" in the box
- **THEN** the order shows "Closed", the line says "ordered 3 · arrived 1" and "2 not coming", the 1 that arrived stays in stock, and the order leaves the Orders list

#### Scenario: keeping it open
- **WHEN** the Owner presses "Close the order" and then "Keep it open"
- **THEN** nothing changes

### Requirement: A delivery is scanned in against an order
Receive a delivery SHALL let anyone signed in pick the supplier it's from, if they like, scan or search for each item (each scan adds one, a count can be typed or stepped), see each scanned line and what is still to come on that supplier's orders, and book the scanned items in, which adds them to stock and, for items on an order, to the order's arrived counts. Booking in SHALL then show Delivery booked in.

#### Scenario: Shimano brake pads arrive
- **WHEN** an order from [Supplier] has 1 Shimano brake pads B05S-RX to come, and a staff member scans B05S-RX and presses "Book in 1 items"
- **THEN** the pads' stock goes up by 1, the order's line says "arrived 1", and the page says "1 item booked in · stock updated"

#### Scenario: more than is still to come
- **WHEN** the scanned count would be more than is still to come on the line
- **THEN** the count stops at what is to come and nothing extra is booked in

### Requirement: Booking in counts once
The server SHALL add a delivery to stock once, even when two people book in the same order line at the same moment: what is still to come is checked while the order is held, and a second booking that would go past it is refused.

#### Scenario: two people book the last pads in at once
- **WHEN** two bookings of the 1 pads still to come arrive together
- **THEN** one is booked in, the other is refused, and stock goes up by 1

#### Scenario: the same products in another order
- **WHEN** two deliveries with the same two products, in opposite orders, are booked in together
- **THEN** both are booked in

### Requirement: Something wrong with an item is marked at booking in
Each scanned line SHALL have "Problem?", opening "Something wrong?" with Damaged, Wrong item or Missing, how many and an optional note. Damaged and wrong items SHALL NOT be added to stock and SHALL be set aside, off what is still to come on the line; missing items stay to come. Each problem SHALL be recorded with its order line, kind, how many and note.

#### Scenario: one damaged
- **WHEN** 3 [Product] are scanned, 1 is marked damaged and the delivery is booked in
- **THEN** stock goes up by 2, the line's arrived count by 2, and a damaged problem of 1 is recorded

### Requirement: A line never takes more than was ordered
A line's items booked in plus its items set aside, across every delivery, SHALL NOT be more than were ordered. An order with nothing left to come on any line SHALL be received.

#### Scenario: set aside in an earlier delivery
- **WHEN** a line of 2 has had 1 marked damaged and 1 marked wrong item, and someone marks another damaged or books one in
- **THEN** it is refused: nothing is left to come on that line

### Requirement: A problem marked by mistake can be undone
A problem marked on a scanned line SHALL be removable before booking in, with the controls already on the page.

#### Scenario: undoing a problem
- **WHEN** a line has 2 marked damaged, and the person opens "Problem?" again and presses − until the count would go below 1
- **THEN** the damaged mark is taken off and the line's items are all to book in

### Requirement: An order that is all in is said, not swapped
When the order asked for is not waiting for a delivery, Receive a delivery SHALL say "This order is all in." and pick no supplier until the person chooses one; a delivery not on an order can still be scanned. After booking in, the supplier SHALL stay picked, and another supplier's orders SHALL NOT be picked in its place.

#### Scenario: the last of an order booked in
- **WHEN** the last items still to come on [Supplier 2]'s order are booked in, and [Supplier] has an order waiting
- **THEN** [Supplier 2] stays picked, nothing is listed as still to come, and [Supplier] is not picked

### Requirement: A delivery is received without an order
Receive a delivery SHALL book in items that are on no order still to come from the picked supplier, or when no supplier is picked, as lines "not on an order", adding them to stock and recording who booked them in.

#### Scenario: a shop that orders on the supplier's website
- **WHEN** [Supplier] has no order in Wheelhouse, a staff member picks [Supplier], scans [Product] twice and presses "Book in 2 items"
- **THEN** the line reads "[Supplier code] · not on an order", [Product]'s stock goes up by 2, and the stock movement records that staff member as who booked it in

#### Scenario: part of the delivery on an order
- **WHEN** an order from [Supplier] has Shimano brake pads to come, and the delivery also holds [Product], which is on no order
- **THEN** the pads count against the order, [Product] is "not on an order", and one Book in adds both

### Requirement: Something wrong with an item not on an order
"Problem?" on a line not on an order SHALL offer Damaged and Wrong item, not Missing. Those items SHALL NOT be added to stock and SHALL be recorded with the supplier.

#### Scenario: one damaged, no order
- **WHEN** 3 [Product] not on an order are scanned, 1 is marked damaged and the delivery is booked in
- **THEN** stock goes up by 2 and a damaged problem of 1 is recorded for [Supplier]

### Requirement: Booking in without an order is safe at the till's side
Stock added without an order SHALL be added in the update itself, in product order, so two deliveries, or a delivery and a sale, at the same moment all count.

#### Scenario: two deliveries of the same products at once
- **WHEN** two deliveries with the same two products, not on an order, in opposite orders, are booked in together
- **THEN** both are booked in and stock goes up by both

### Requirement: A supplier or a draft order saved twice at once both stay
When two saves of different details of the same supplier, or of the same draft order, arrive at the same moment, each SHALL be kept: the second save SHALL start from what the first wrote, never from what was stored before it. The checks on what is sent, and which shop's suppliers and orders a save can reach, SHALL be unchanged.

#### Scenario: A supplier's contact and phone at once
- **WHEN** a supplier's new contact name and new phone number save at the same moment
- **THEN** both are stored

#### Scenario: An order's reference and notes at once
- **WHEN** a draft order's new reference and new notes save at the same moment
- **THEN** both are stored

### Requirement: Only a draft order is edited, even when it is ordered mid-save
A change to an order SHALL be checked against the order as it is when the change is written, not as it was when the change arrived. An order marked as ordered while a change to it is waiting SHALL refuse the change with "Only a draft purchase order can be edited", and keep its lines and notes as they were.

#### Scenario: Marked as ordered while an edit waits
- **WHEN** an order is marked as ordered while an edit to its lines is waiting
- **THEN** the edit is refused and the order's lines are unchanged

### Requirement: A closed order can't be received against
Booking a delivery in SHALL refuse a line on a closed or cancelled order with "This purchase order is not awaiting delivery", adding nothing to stock. Receive a delivery SHALL leave a closed order out of what is still to come, and opened for a closed order it SHALL say "This order is all in.".

#### Scenario: booking in on a closed order
- **WHEN** someone books in a line of an order the Owner has closed
- **THEN** it is refused and stock is unchanged

### Requirement: Closing and booking in at the same moment
A close made while a delivery to the same order is being booked in SHALL wait for the booking, then close the order with what that booking brought in kept as arrived. A booking made while a close is being written SHALL wait for it, then be refused, adding nothing to stock.

#### Scenario: a close lands during a booking
- **WHEN** the Owner closes an ordered order while 1 of its 3 is being booked in
- **THEN** the order is closed with 1 arrived and 2 not coming, and the 1 stays in stock

#### Scenario: a booking lands during a close
- **WHEN** a delivery to an order is booked in while the Owner's close is being written
- **THEN** the booking is refused and stock is unchanged

### Requirement: Items set aside are listed to return to their supplier
Stockroom › Deliveries and orders SHALL show, after "A delivery arrived?", a "To return to [Supplier]" section for each supplier with damaged or wrong items not yet returned, and none when there are none (`rs-hub`; receiving decisions 9 and 10). Each item SHALL read "Damaged · [n] · from the delivery on [date]" or "Wrong item · [n] · …", with Returned. Missing items SHALL NOT be listed. Only the Owner SHALL see the list, until roles.

#### Scenario: one damaged
- **WHEN** 1 [Product] from [Supplier] was marked damaged at booking in on 1 September
- **THEN** Deliveries and orders shows "To return to [Supplier]" with [Product], "Damaged · 1 · from the delivery on Tue 1 Sep" and Returned

#### Scenario: nothing to return
- **WHEN** nothing is set aside, or only missing items are marked
- **THEN** there is no To return section

### Requirement: Returned takes an item off the list
Returned SHALL record who sent the item back and when, and the item SHALL leave the list. Stock SHALL NOT change. Only the Owner SHALL mark an item returned, and an item SHALL be marked returned only once.

#### Scenario: sent back
- **WHEN** Jack Lewis presses Returned on [Product]
- **THEN** it leaves To return to [Supplier], and the section goes when nothing else is on it

#### Scenario: pressed twice
- **WHEN** the same item is marked returned twice at once
- **THEN** one is recorded and the other is refused

### Requirement: A delivery is kept when it's booked in
Booking in SHALL keep the delivery: who booked it in and when, its supplier if there was one, each product booked in with how many and what it cost then, and what was set aside. It SHALL be kept or lost together with the stock it added. A booking that only marks items missing SHALL keep no delivery, as nothing arrived.

#### Scenario: a delivery from [Supplier]
- **WHEN** Jack Lewis books in 2 Shimano brake pads from an order from [Supplier], and marks 1 damaged
- **THEN** a delivery from [Supplier] by Jack Lewis holds 2 pads at the order's cost, with 1 damaged set aside

#### Scenario: a refused booking
- **WHEN** a booking is refused because the counts moved on
- **THEN** no delivery is kept and stock doesn't change

### Requirement: Delivery booked in says what happened and what's next
After Book in, the page SHALL say "[n] items booked in · stock updated", then what was set aside as damaged or a wrong item, what is still to come on the delivery's orders, and offer Receive another delivery. Someone who can order stock SHALL get "On To return to [Supplier]" with See the list, and Open the order; anyone else SHALL be told the owner will return it and that it isn't in stock, with no links to either.

#### Scenario: one damaged, some to come, as the Owner
- **WHEN** the Owner books in a delivery with 1 damaged and [n] still to come on the order
- **THEN** the page shows "1 set aside as damaged", "On To return to [Supplier]" with See the list, "[n] still to come on the order", "[Supplier] · ordered [date]" with Open the order

#### Scenario: the same delivery, as Staff
- **WHEN** Jo Taylor books in the same delivery
- **THEN** the page shows "1 set aside as damaged — the owner will return it" and "It isn’t in stock", and neither link

### Requirement: A booked-in delivery can be opened
A delivery's page SHALL show its supplier, how many items, when and by whom it was booked in, each line with its code and count, and what was set aside. Someone who can order stock SHALL also see each line's cost and the booked-in cost before VAT. Anyone else SHALL NOT be sent costs, and SHALL be told "Costs are for people who can order stock."

#### Scenario: as the Owner
- **WHEN** the Owner opens a delivery of Shimano brake pads B05S-RX
- **THEN** the line reads "B05S-RX · [n] × £[cost]" with its total, and "Booked-in cost, before VAT" shows the delivery's total

#### Scenario: as Staff
- **WHEN** Jo Taylor opens the same delivery
- **THEN** the line reads "B05S-RX · [n]", no cost is on the page or in what the server sent, and the note says costs are for people who can order stock

#### Scenario: an item set aside then returned
- **WHEN** a damaged item from the delivery has been marked Returned
- **THEN** its line says Returned instead of On To return

### Requirement: Recent deliveries are on Deliveries and orders
Deliveries and orders SHALL list the newest deliveries for everyone, each "[Supplier] · [n] items", "Booked in [date] by [name]" and Open, and no section when there are none.

#### Scenario: after a delivery
- **WHEN** Jack Lewis has booked in a delivery from [Supplier]
- **THEN** Recent deliveries shows it, and Open goes to the delivery's page

#### Scenario: nothing booked in yet
- **WHEN** no delivery has been kept
- **THEN** there is no Recent deliveries section

### Requirement: A delivery names the person who booked it in
A delivery SHALL name the person checked in by PIN, or on an ordinary browser the person signed in. On a till or workshop computer with nobody checked in, Book in SHALL be refused and nothing booked in. The name SHALL stay if that person is later deleted.

#### Scenario: a workshop computer signed in as the Owner
- **WHEN** Jo Taylor checks in by PIN on a workshop computer signed in as Jack Lewis, and books a delivery in
- **THEN** the delivery reads "by Jo Taylor"

#### Scenario: nobody checked in
- **WHEN** Book in is pressed on a workshop computer with nobody checked in
- **THEN** it is refused with "Check in with your PIN first", and stock doesn't change

### Requirement: Book in sent twice books in once
A Book in sent again with the same request key and the same items SHALL get the first delivery's answer and change nothing. The same key with other items SHALL be refused and change nothing.

#### Scenario: the reply was lost
- **WHEN** Book in is pressed, the reply is lost, and Try again sends it again
- **THEN** stock goes up once and there is one delivery

### Requirement: Order costs are only sent to who can see them
Purchase order replies SHALL include unit costs and totals only for someone who can see costs: the Owner, until roles add each person's "Can see costs and margin" switch. On a shared computer that SHALL follow who is checked in, not who is signed in.

#### Scenario: Jo Taylor at a till signed in as the Owner
- **WHEN** Jo Taylor is checked in and the till reads an order
- **THEN** the reply has no costs in it

### Requirement: An old delivery keeps the names it had
A delivery SHALL show its supplier's and products' names and codes as they were when it was booked in.

#### Scenario: a product renamed later
- **WHEN** a product and its supplier are renamed
- **THEN** a delivery booked in earlier still shows the old names

### Requirement: Print labels starts with what needs one
Delivery booked in SHALL offer Print labels to everyone when anything was booked in. Its box SHALL list what was booked in: a product with no barcode of its own starting at one label per item received, up to 500, and a product with its own barcode starting at 0. Any count SHALL be changeable, by stepping or typing, down to 0 and up to about ten times what came, at least 10 and 500 at most. The box SHALL say "booked in just now" only just after booking in, and the day after that.

#### Scenario: no barcode of its own
- **WHEN** [n] of [Product], with no barcode of its own, were booked in
- **THEN** its line reads "No barcode of its own · [n] received" and starts at [n]

#### Scenario: the maker's barcode
- **WHEN** Shimano brake pads with their own barcode were booked in
- **THEN** the line reads "Has its own barcode · [n] received" and starts at 0, and the button reads "Print 0 labels" and is off

#### Scenario: nothing booked in
- **WHEN** everything in the delivery was set aside
- **THEN** there is no Print labels button

### Requirement: Labels print through the browser, one a page
Print SHALL send the browser one label per count, each one page at the shop's label size, with the product's name, price and a barcode of its barcode or, with none, its code, with that code in words under it. The barcode SHALL keep clear space each side and SHALL fit the label. A product with neither SHALL print its name and price only. If the label size can't be loaded, the box SHALL say so and SHALL NOT print.

#### Scenario: [Product] with a code and no barcode
- **WHEN** 2 labels of [Product], code [Supplier code], are printed
- **THEN** the browser's print window opens with 2 labels, each with [Product], its price, and a barcode of [Supplier code]

### Requirement: A new order by someone who can't see costs
Someone allowed to order who can't see costs (until roles, a person at the Owner's till) SHALL be shown no cost and no total on New order. The server SHALL ignore any cost they send: each line SHALL take the cost already on that draft's line, otherwise the product's stored cost. If a line then has no cost, the order SHALL save as a draft and SHALL NOT be marked as ordered, by them, until it has one.

#### Scenario: Jo Taylor orders the brake pads at the Owner's till
- **WHEN** Jo Taylor saves a new order for Shimano brake pads
- **THEN** the line holds the product's stored cost, not £0, and no cost is on the page or in what the server sent

#### Scenario: the Owner empties a line's cost box
- **WHEN** the Owner saves a draft with a line's cost box empty
- **THEN** the line keeps the cost it had, otherwise it takes the product's, and isn't written as £0; £0 typed on purpose is saved as £0

#### Scenario: a line with no cost
- **WHEN** Jo Taylor marks as ordered a new order with a product that has no cost recorded
- **THEN** it is refused with the reason, and Save as draft still works

### Requirement: Cost went up? Change it on a booked-in delivery
On a booked-in delivery the Owner SHALL be able to change a line's cost. The line, the product's cost and its history ("Cost changed", naming the delivery) SHALL follow, together. Anyone else SHALL be refused and nothing SHALL change.

#### Scenario: The pads went up
- **WHEN** the Owner changes the brake pads' line on a delivery from [Supplier] to £[cost]
- **THEN** the line shows £[cost], the pads' cost is £[cost], and their history says "Cost changed · delivery from [Supplier]"

#### Scenario: Jo tries
- **WHEN** Jo Taylor sends the same change
- **THEN** she is told "Only the shop’s owner can add or change products" and nothing changes

### Requirement: An unknown barcode can be added while receiving
When the Owner scans a barcode Wheelhouse doesn't know while receiving, "Add this product" SHALL open the product box with that barcode, and "Add and count 1" SHALL add the product and count 1 on the delivery. Staff SHALL be told nothing has that barcode, as before.

#### Scenario: A new bearing
- **WHEN** the Owner scans [barcode], fills in [Bearing] in Bearings with an outer diameter of 30 mm and presses Add and count 1
- **THEN** [Bearing] is on the delivery as 1, and is a product with that barcode

### Requirement: The restock list shows what to reorder, by supplier
Deliveries and orders › Restock list SHALL list every product that is running low, selling fast or waited for by a job, grouped by the product's supplier, with its name, supplier code, In stock and "Sold, last 28 days", and a Reorder count already filled in. "Running low" SHALL mean at or under the product's low-stock level, below zero included. A product's supplier SHALL be matched to a supplier in the shop's suppliers by its name, ignoring capitals and spaces at either end; a supplier name not in the list SHALL still be a group of its own, and a product with no supplier SHALL be under "No supplier". A product already ordered enough to cover what the list would suggest SHALL be left off.

#### Scenario: Brake pads running low
- **WHEN** Shimano brake pads, supplied by [Supplier], have [n] in stock and a low-stock level of [n] or more
- **THEN** the list shows them under [Supplier], with "B05S-RX", In stock "[n] · low" and a Reorder count

#### Scenario: Already on order
- **WHEN** a product running low is already on an order still to come, for at least what the list would suggest
- **THEN** it is not on the list

### Requirement: Selling fast means more than usual in the last 28 days
A product SHALL be "selling fast" when at least 3 were sold in the last 28 days and that is at least twice its usual: what it sold in the 24 weeks before, per 28 days. Sales at the till and online SHALL both count. Its Sold column SHALL read "[n] · fast".

#### Scenario: A product selling faster than usual
- **WHEN** a product sold 6 in the last 28 days and 6 in the 24 weeks before
- **THEN** it is on the list with "6 · fast"

#### Scenario: Selling steadily
- **WHEN** a product sold 4 in the last 28 days and 24 in the 24 weeks before
- **THEN** it is not selling fast

### Requirement: The Reorder count is suggested
For a product running low or selling fast, the Reorder count SHALL start at enough to bring it back above its low-stock level and cover another 28 days of sales like the last: its low-stock level, plus what sold in the last 28 days, less what is in stock (after jobs take what they need) and what is already on order, and at least 1. For a job's line it SHALL start at how many that job is short. A product running low or selling fast whose stock and orders already cover that count SHALL be left off. The count SHALL be typed or stepped with − and +, and never below 1.

#### Scenario: Pads running low
- **WHEN** the pads' low-stock level is 3, 2 are in stock, 4 sold in the last 28 days and none are on order
- **THEN** their Reorder count starts at 5

### Requirement: For customers lists what jobs are waiting for
A part on an open job's order SHALL go on For customers by itself when there isn't the stock for it, with no click from the mechanic (walk-through 3 M7). The stock, then what's still to come on orders not for a job, SHALL go to jobs in the order of their day, then the order they were made; each line that neither covers SHALL be listed for its job, "for job WH-1042 · Maya Patel · promised [date]", with how many it is short. A job's part on an order still to come for that job SHALL leave the list. Finished, cancelled and not-yet-accepted jobs SHALL NOT count. A part taken off sale SHALL still be listed for the jobs waiting for it, but not as running low or selling fast. On All, a product waited for by a job SHALL show "for job WH-1042" under its name, and its Reorder count SHALL include what the jobs are short.

#### Scenario: Maya's pads
- **WHEN** job WH-1042 for Maya Patel has Shimano brake pads on its order and there are none in stock
- **THEN** For customers shows the pads under [Supplier], "B05S-RX · for job WH-1042 · Maya Patel · promised [date]", with a Reorder count of 1

#### Scenario: Ordered for the job
- **WHEN** the pads are added to an order for job WH-1042
- **THEN** they are no longer on For customers

### Requirement: Tick what to reorder, by supplier
Every line SHALL start ticked. Each supplier's group SHALL have its own tick box for all of its lines, "[n] ticked", Add to an order and Download for [Supplier]’s basket, which act on that group's ticked lines only, at the counts shown. The pills All, Running low, Selling fast and For customers SHALL show those lines; opened from "See the list" on Deliveries and orders, the matching pill SHALL be picked. On a phone, In stock and Sold SHALL sit under the product's name, with its count beneath.

#### Scenario: Unticking one
- **WHEN** Jack Lewis unticks one of [Supplier]'s two lines
- **THEN** the group says "1 ticked", and its download and Add to an order use only the other

### Requirement: Download for a supplier's basket
Download for [Supplier]’s basket SHALL download a CSV file, one row per ticked line: Supplier code, Quantity, Product, Barcode. The screen SHALL say what the file holds, to be checked against each supplier's basket upload. A line with no supplier code SHALL still be in the file, with its code blank.

#### Scenario: The pads' file
- **WHEN** Jack Lewis downloads [Supplier]'s basket with the pads ticked at 5
- **THEN** the file has a row "B05S-RX, 5, Shimano brake pads, [barcode]"

### Requirement: Add to an order
Add to an order SHALL put the group's ticked lines on that supplier's draft order, making one if there isn't one, and open the order. A product already on the draft SHALL go up by the count. A line for a job SHALL keep its job on the order's line, shown as "for job WH-1042" on the order. A group whose supplier name isn't in the suppliers list SHALL have no Add to an order, and say "[Name] isn’t in your suppliers yet", with the download still there.

#### Scenario: The pads for Maya
- **WHEN** Jack Lewis presses Add to an order on [Supplier]'s For customers group
- **THEN** [Supplier]'s draft order has the pads, 1, "for job WH-1042", and it opens

### Requirement: The restock list is for people who can order stock
Only the Owner SHALL open the restock list, download it or add from it, until roles (receiving decision 4: "Can order stock"). Anyone else SHALL be refused with "Only the shop's owner can order stock".

#### Scenario: Jo tries
- **WHEN** Jo Taylor asks for the restock list
- **THEN** she is told "Only the shop's owner can order stock"

### Requirement: Deliveries and orders shows the restock list's counts
For the Owner, Deliveries and orders SHALL show a Restock list section, after To return and before Orders, with "Running low · [n] products at or under their low-stock level", "Selling fast · [n] products sold more than usual in the last 28 days" and "For customers · [n] products a job is waiting for, or an online order is ordering in", each with See the list.

#### Scenario: Two running low
- **WHEN** two products are running low
- **THEN** the section says "2 products at or under their low-stock level", and See the list opens the list with Running low picked

### Requirement: A bike asks for its frame number before it counts
Scanning or picking a bike while receiving SHALL ask for its frame number ("Scan the sticker on the frame, or type it") before it counts, and SHALL count it when the number is scanned or "Count this bike" is pressed. A bike is a product whose category, or a category it sits in, is named as bikes (`rs-frame`).

#### Scenario: Scanning a bike's sticker
- **WHEN** Jo Taylor scans a bike in a delivery and then its frame sticker
- **THEN** the bike counts, and its line reads "Frame [frame number]"

#### Scenario: Cancel
- **WHEN** the frame number box is cancelled
- **THEN** the bike isn't counted

### Requirement: A frame number already in stock is caught
A frame number already in stock, or already in this delivery, SHALL NOT be counted, and SHALL say "This frame number is already in stock — booked in [date]. Check the sticker, or scan the next bike." (or "This frame number is already in this delivery.") (`rs-frame-dup`). Booking in SHALL refuse a frame already in stock, including one booked in by someone else at the same moment.

#### Scenario: The same frame twice
- **WHEN** a frame number booked in last week is scanned again
- **THEN** it says it's already in stock, booked in that day, and the bike isn't counted

### Requirement: Booking in records each bike's frame number
Booking in SHALL record each bike's frame number against the product, the shop, the delivery and who booked it in, in stock, and SHALL refuse a bike without one. Bikes set aside SHALL NOT be recorded in stock.

#### Scenario: Three bikes
- **WHEN** three bikes are booked in with their frame numbers
- **THEN** the bike's page lists the three frames, each In stock, booked in that day from the delivery's supplier

#### Scenario: A bike without its frame number
- **WHEN** booking in sends a bike without a frame number
- **THEN** it is refused and nothing is booked in
