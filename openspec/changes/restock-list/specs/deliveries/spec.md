## ADDED Requirements

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
