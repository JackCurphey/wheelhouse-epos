# Spec Delta

## ADDED Requirements

### Requirement: A delivery is scanned in against an order
Receive a delivery SHALL let anyone signed in pick an order that is still to come, scan or search for each item (each scan adds one, a count can be typed or stepped), see each scanned line and what is still to come on the order, and book the scanned items in, which adds them to stock and to the order's arrived counts.

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
When the order asked for is not waiting for a delivery, Receive a delivery SHALL say "This order is all in." and pick no order until the person chooses one.

#### Scenario: the last of an order booked in
- **WHEN** the last items still to come on the picked order are booked in, and another order is waiting
- **THEN** the page says "This order is all in." and the other order is not picked
