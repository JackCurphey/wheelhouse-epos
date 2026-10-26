# Spec Delta

## MODIFIED Requirements

### Requirement: A delivery is scanned in against an order
Receive a delivery SHALL let anyone signed in pick the supplier it's from, if they like, scan or search for each item (each scan adds one, a count can be typed or stepped), see each scanned line and what is still to come on that supplier's orders, and book the scanned items in, which adds them to stock and, for items on an order, to the order's arrived counts.

#### Scenario: Shimano brake pads arrive
- **WHEN** an order from [Supplier] has 1 Shimano brake pads B05S-RX to come, and a staff member scans B05S-RX and presses "Book in 1 items"
- **THEN** the pads' stock goes up by 1, the order's line says "arrived 1", and the page says "1 items booked in · stock updated"

#### Scenario: more than is still to come
- **WHEN** the scanned count would be more than is still to come on the line
- **THEN** the count stops at what is to come and nothing extra is booked in

### Requirement: An order that is all in is said, not swapped
When the order asked for is not waiting for a delivery, Receive a delivery SHALL say "This order is all in." and pick no supplier until the person chooses one; a delivery not on an order can still be scanned. After booking in, the supplier SHALL stay picked, and another supplier's orders SHALL NOT be picked in its place.

#### Scenario: the last of an order booked in
- **WHEN** the last items still to come on [Supplier 2]'s order are booked in, and [Supplier] has an order waiting
- **THEN** [Supplier 2] stays picked, nothing is listed as still to come, and [Supplier] is not picked

## ADDED Requirements

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
