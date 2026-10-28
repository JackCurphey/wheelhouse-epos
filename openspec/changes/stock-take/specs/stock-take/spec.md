# Spec Delta

## ADDED Requirements

### Requirement: A manager starts a count of a section
Stockroom › Stock take SHALL let the Owner (anyone with "Can order stock", once roles exist) start a count of the whole shop, a category, an area, or the products below zero (stock control decisions 5 and 9; `tk-hub`, `tk-start`, `tk-start-category`). An area is named when the count starts, and areas used before SHALL be offered (decision 11). A category SHALL be one the shop's products use.

#### Scenario: An area
- **WHEN** Jack Lewis starts a count of "[Area]"
- **THEN** it shows under Counts in progress, "Started [time] by Jack Lewis", and "[Area]" is offered under "Used before" next time

#### Scenario: Staff can't start one
- **WHEN** Jo Taylor, Staff, opens Stock take
- **THEN** she sees the counts in progress with Join, no Start a count, and a line saying starting, checking and applying a count are for the shop’s owner for now

### Requirement: A below-zero count is of the products below zero when it starts
A below-zero count SHALL be of the products below zero when it started, and SHALL be refused when none are (decision 9).

#### Scenario: Nothing below zero
- **WHEN** no product is below zero and Jack Lewis starts a below-zero count
- **THEN** he's told "Nothing is below zero" and no count starts

### Requirement: Anyone can join and count, blind
Anyone signed in SHALL be able to join a count in progress and count on any device. Each scan SHALL add one, and a number MAY be typed instead. Nothing on the counting page SHALL show how many Wheelhouse expects (decision 5; `tk-count`).

#### Scenario: Scanning
- **WHEN** Jo Taylor scans Shimano brake pads B05S-RX twice
- **THEN** her line for the pads reads 2, the page says "Added Shimano brake pads · 1", and nothing shows the pads' stock

#### Scenario: Two counters
- **WHEN** Jo Taylor and Alex Morgan both count the same product
- **THEN** each has their own count, and each page says the other is counting too

### Requirement: Counting is safe when it happens at once
Two scans of the same product at the same moment SHALL both count. Counting SHALL NOT change stock or the product's stock history.

#### Scenario: Twenty scans at once
- **WHEN** twenty scans of the pads arrive at the same moment
- **THEN** the count reads 20 and the pads' stock is unchanged

### Requirement: A count takes only its own products
A category count SHALL take only products in that category, and a below-zero count only the products on its list; anything else SHALL be refused with a message naming the product.

#### Scenario: The wrong category
- **WHEN** Jo Taylor scans a product from another category during a count of Drivetrain › Derailleurs
- **THEN** it isn't counted and she's told it isn't in Drivetrain › Derailleurs

### Requirement: The below-zero count shows what's still to find
A below-zero count SHALL list the products still to find by name, without numbers, until someone counts them (decision 11; `tk-count-below`).

#### Scenario: Found one
- **WHEN** Jack Lewis counts one of the below-zero products
- **THEN** it moves from "Still to find" to the counted list

### Requirement: I've finished my part
Each counter SHALL be able to say they have finished their part. When everyone who joined has finished, the count SHALL read "Ready to check" on Stock take (`tk-hub`). Counting again SHALL put the person back to counting.

#### Scenario: Everyone finished
- **WHEN** Jo Taylor and Alex Morgan have both pressed I’ve finished my part
- **THEN** Stock take shows the count as "everyone has finished" and "Ready to check"
