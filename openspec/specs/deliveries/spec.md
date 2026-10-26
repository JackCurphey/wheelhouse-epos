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
