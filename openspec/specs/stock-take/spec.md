# stock-take Specification

## Purpose
TBD - created by archiving change stock-take. Update Purpose after archive.

## Requirements

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

### Requirement: The manager checks the differences
When counting is done, the Owner (anyone with "Can order stock", once roles exist) SHALL see each counted product that differs, largest value first, with what was expected, what was counted and by whom, and the difference over or under with its value at cost; how many products were counted, matched and differ; and the total at cost (decision 5; `tk-diff`). Products that match SHALL NOT be listed. Staff SHALL NOT see costs.

#### Scenario: Pads under
- **WHEN** Jo Taylor counted 2 and Alex Morgan 1 of the pads, and Wheelhouse expected 6
- **THEN** the pads read expected 6, counted 3 ("Jo Taylor 2 + Alex Morgan 1"), 3 under, with their value at cost

### Requirement: Stock that moves during the count is allowed for
Each product SHALL be measured at the moment of its last count: whatever was sold, booked in, used, sent or adjusted after it SHALL be allowed for, and named under the product ("[n] sold during the count, allowed for"); whatever moved before it is already in the count (decided here for Jack to overrule, 28 Oct).

#### Scenario: Sold after it was counted
- **WHEN** Jo Taylor counted 6 pads and one was sold afterwards
- **THEN** the pads match, and applying leaves 5

#### Scenario: Sold offline before the count, synced after
- **WHEN** a till sold a pad while offline, Jo Taylor then counted 5, and the sale reached Wheelhouse afterwards
- **THEN** the pads match: the sale was made before the count

### Requirement: Recount sends a line back to the counters
Recount SHALL take a product's counts away, show it on every counter's page as "Recount asked by [Name]" with no number, and put everyone back to counting. A line not counted again SHALL be left as it is when the count is applied.

#### Scenario: Recount asked
- **WHEN** Jack Lewis asks for the pads to be recounted
- **THEN** Jo Taylor's page shows the pads with "Recount asked by Jack Lewis", and the count reads Counting again on Stock take

### Requirement: Count them as none
Products the count covers that nobody counted SHALL be left as they are unless the manager presses Count them as none, which counts each as 0 (decision 11). An area count covers only what was scanned, so it SHALL have no such list.

#### Scenario: A category with something not counted
- **WHEN** nobody counted one product in the category and Jack Lewis presses Count them as none
- **THEN** it shows as counted 0, under by what was expected

### Requirement: Applying corrects stock, safely, with its history
Apply SHALL add each product's difference to its stock as it is then, and write a "Counted" line in its stock history with who counted it and who applied it, in one step that a sale at the same moment can't break: whichever goes first, the other waits and adds its own change on top. A count SHALL be applied once; counting after it is applied SHALL be refused.

#### Scenario: A sale while applying
- **WHEN** Jo Taylor counted 4 pads, 6 were expected, and a sale of one pad happens while Jack Lewis applies the count
- **THEN** the pads end at 3, whichever went first

### Requirement: Undo, Finished counts and Download the count
After applying, the manager SHALL see "Count applied" with Undo and Download the count (`tk-applied`). Undo SHALL take each change off again with its own history line and put the count back to counting. Stock take SHALL list Finished counts for the Owner: when, by whom, products changed and the value at cost. Download the count SHALL give a spreadsheet of every counted product.

#### Scenario: Undo
- **WHEN** Jack Lewis presses Undo after applying a count that added 3 pads
- **THEN** the 3 come off again, with "Undid the stock take of [Area]" in the pads' history

#### Scenario: A later count came first
- **WHEN** a later count has corrected the pads and Jack Lewis presses Undo on the earlier one
- **THEN** he's told "A later count has corrected Shimano brake pads; undo that one first." and nothing changes
