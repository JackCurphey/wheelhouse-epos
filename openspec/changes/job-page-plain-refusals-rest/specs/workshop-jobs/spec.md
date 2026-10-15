## MODIFIED Requirements

### Requirement: The job page lists and changes the job's work and parts
The job page SHALL list the lines on the job's order, labour above parts. Staff SHALL be able to add a product or service by searching or scanning a barcode, change a part's quantity, and remove a line. An order that is no longer open (paid or cancelled) SHALL be read-only here, and a job with no order SHALL say "This job has no order to add work and parts to." If the shop refuses a change, the page SHALL say why in plain words: "This job has been paid for, so its work and parts can't change." for a paid order, "This job's order was cancelled, so its work and parts can't change." for a cancelled one, "That service is no longer offered. Choose another." for a service that has gone, and the shop's own words for any other reason (Jack, 15 Oct).

#### Scenario: Labour first
- **WHEN** a job's order has brake pads and a Standard service
- **THEN** Standard service is listed above Brake pads (pair)

#### Scenario: Adding by search or scan
- **WHEN** staff search "brake" and pick Brake pads (pair), or scan its barcode
- **THEN** the product is added to the job's order with quantity 1

#### Scenario: An order no longer open
- **WHEN** the job's order is no longer open
- **THEN** there is no Add item or Remove button

#### Scenario: A refused change
- **WHEN** the shop refuses a change to the job's order because it has been paid
- **THEN** the page says "This job has been paid for, so its work and parts can't change."

### Requirement: The job page lists the days and can add or remove one
A one-day job's page SHALL show "[day], [times]" or "[day], no set time". A job with more than one day SHALL list its days as "Day [n]: [date], [times], [mechanic]", with a "Remove" button (named "Remove day [n]") on every day except day 1. "Ready by" SHALL be the last day. "Add another day" SHALL be offered unless the bike has been collected. A refused add or remove SHALL say "This job changed while you were looking at it." when someone else changed the job first, "That day has already been removed." for a day that has gone, "This job no longer exists." for a deleted job, and otherwise the shop's words in plain English (Jack, 15 Oct).

#### Scenario: A collected bike
- **WHEN** a job's bike has been collected
- **THEN** there is no "Add another day" button

#### Scenario: A two-day job
- **WHEN** staff open a Frame rebuild job on Mon 5 Oct and Tue 6 Oct, 10:00–12:00, with Alex Morgan
- **THEN** the page lists "Day 1: Mon 5 Oct, 10:00–12:00, Alex Morgan" and "Day 2: Tue 6 Oct, 10:00–12:00, Alex Morgan", and shows "Ready by Tue 6 Oct"

#### Scenario: Removing a day
- **WHEN** staff look for a way to remove day 1, and press "Remove day 2"
- **THEN** there is no "Remove day 1", and day 2 is removed with the version the page saw

#### Scenario: Removing a day someone else removed
- **WHEN** staff press "Remove day 2" and the shop refuses because that day has gone
- **THEN** the page says "That day has already been removed."
