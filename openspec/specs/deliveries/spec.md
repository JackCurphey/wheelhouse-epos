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
An order's page SHALL show its supplier, when it was ordered, its status, each line's ordered and arrived counts with "All arrived" or "[n] to come", and the total cost the server gives. While nothing has arrived, the Owner SHALL be able to close it after confirming, which cancels it.

#### Scenario: closing an order nothing has arrived from
- **WHEN** the Owner presses "Close the order" and then "Close the order" in the box
- **THEN** the order is cancelled and leaves the Orders list

#### Scenario: keeping it open
- **WHEN** the Owner presses "Close the order" and then "Keep it open"
- **THEN** nothing changes

### Requirement: A delivery is scanned in against an order
Receive a delivery SHALL let anyone signed in pick the supplier it's from, if they like, scan or search for each item (each scan adds one, a count can be typed or stepped), see each scanned line and what is still to come on that supplier's orders, and book the scanned items in, which adds them to stock and, for items on an order, to the order's arrived counts.

#### Scenario: Shimano brake pads arrive
- **WHEN** an order from [Supplier] has 1 Shimano brake pads B05S-RX to come, and a staff member scans B05S-RX and presses "Book in 1 items"
- **THEN** the pads' stock goes up by 1, the order's line says "arrived 1", and the page says "1 items booked in · stock updated"

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
