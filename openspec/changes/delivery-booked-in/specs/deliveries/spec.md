## MODIFIED Requirements

### Requirement: A delivery is scanned in against an order
Receive a delivery SHALL let anyone signed in pick the supplier it's from, if they like, scan or search for each item (each scan adds one, a count can be typed or stepped), see each scanned line and what is still to come on that supplier's orders, and book the scanned items in, which adds them to stock and, for items on an order, to the order's arrived counts. Booking in SHALL then show Delivery booked in.

#### Scenario: Shimano brake pads arrive
- **WHEN** an order from [Supplier] has 1 Shimano brake pads B05S-RX to come, and a staff member scans B05S-RX and presses "Book in 1 items"
- **THEN** the pads' stock goes up by 1, the order's line says "arrived 1", and the page says "1 item booked in · stock updated"

#### Scenario: more than is still to come
- **WHEN** the scanned count would be more than is still to come on the line
- **THEN** the count stops at what is to come and nothing extra is booked in

## ADDED Requirements

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
