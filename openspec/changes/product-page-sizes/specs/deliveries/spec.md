## ADDED Requirements

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
