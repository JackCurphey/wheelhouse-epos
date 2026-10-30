## ADDED Requirements

### Requirement: Privacy requests, dated, answered within a month
The Owner SHALL see the shop's privacy requests from "Privacy requests · [n] open" on Customers: each with who, what (a copy of their data, or deleting their details), where it came from, when it was asked and when an answer is due (one month on, in the shop's days), overdue ones marked, open ones first. A copy downloaded from the account SHALL show as done, and a done deletion by its reference, with no name. Nobody but the Owner SHALL see the list.

#### Scenario: Maya's request on the list
- **WHEN** Maya Patel has asked from her account to delete it
- **THEN** the list shows "Maya Patel · Delete their details", "From their account on the website · asked [date] · answer by [date]", and Customers shows "Privacy requests · 1 open"

#### Scenario: Not the Owner
- **WHEN** a staff member asks for the list or to delete
- **THEN** they are refused

### Requirement: A bike still in the workshop holds a deletion back
A deletion request whose customer has a bike still in the workshop SHALL say "Still in the way: bike in the workshop, [ref]" and hold Delete back until it is collected. Nothing else SHALL hold it back.

#### Scenario: Her bike is still in
- **WHEN** her bike is in the workshop as WH-1042
- **THEN** the row says "Still in the way: bike in the workshop, WH-1042", Delete is held back, and "Can be deleted once the bike is collected." shows

#### Scenario: Collected
- **WHEN** her bike is collected after she asked
- **THEN** Delete is no longer held back

### Requirement: Deleting someone's details
The Owner SHALL be able to delete a customer's details from their open deletion request, after "Delete [name]'s details?". Their details and answers SHALL be cleared and the record marked deleted; their bikes SHALL stay as bare rows; their messages, booking photos, the messages the shop sent them, their merges and their online account SHALL be removed. Their sales, orders, payments and jobs SHALL be kept whole, without their name. The request SHALL be marked done.

#### Scenario: Jack Lewis deletes Maya's details
- **WHEN** Jack Lewis presses "Delete their details" on Maya Patel's request and confirms
- **THEN** her details, bikes' details, messages and account are gone, her sales and jobs stay with their totals, and the request shows as done with its reference

### Requirement: A deletion happens at once or not at all
Deleting someone's details SHALL happen in one step: a sale, merge or booking for them at the same moment SHALL wait for it, and nothing SHALL be left half-cleared.

#### Scenario: A sale at the same moment
- **WHEN** a sale for Maya is being made while her details are deleted
- **THEN** one waits for the other, and the sale is recorded whole

### Requirement: A deletion request on the customer page
A customer's page SHALL show their open deletion request: when they asked, where from, when the answer is due, and anything in the way.

#### Scenario: Maya's page
- **WHEN** staff open Maya Patel's page while her request is open
- **THEN** it says "Asked to delete their account on [date] · from their account on the website · answer by [date]. Still in the way: bike in the workshop, WH-1042."

### Requirement: Deleted details stay deleted
Once a customer's details are deleted, no staff save SHALL bring any back: saving the customer, switching them on, adding a bike for them or editing one of their bikes SHALL be refused. A booking from their account already under way SHALL be refused, and their booking links SHALL stop working.

#### Scenario: A stale Edit
- **WHEN** an Edit pop-up opened before the deletion is saved after it
- **THEN** it is refused with "This customer’s details were deleted at their request, so they can’t be changed." and nothing comes back

#### Scenario: Her booking link
- **WHEN** her private booking link is opened after the deletion
- **THEN** it no longer opens her booking

### Requirement: Their own words on kept jobs are removed
Deleting someone's details SHALL replace what they wrote when booking, on each kept job and the order made with it, with "[removed]": their description, their bike note, their answers, the lines the booking added to the notes, and their description in the title. What staff typed, the work and the money SHALL stay (answer 4).

#### Scenario: A phone number in her words
- **WHEN** her description and bike note include her phone number
- **THEN** after the deletion neither the job nor its order holds it, and the staff's own note is still there
