# customers Specification

## Purpose
TBD - created by archiving change customers-list. Update Purpose after archive.

## Requirements

### Requirement: Recent customers

Customers SHALL list the shop's most recently seen customers (added, changed,
or with a job or a sale), each with their latest bike and phone, opening their
page, and point to the header search for anyone else.

#### Scenario: someone just booked
- **WHEN** a customer has a job made today
- **THEN** they are near the top of Recent customers

### Requirement: Add a customer, catching a match

Add a customer SHALL need a name and a phone number or an email, and SHALL
show, while typing, an existing customer with the same phone number or email,
with a way to use them instead. Address, postcode, group and note SHALL be
optional, and Happy to hear about offers SHALL start off.

#### Scenario: a match
- **WHEN** the phone typed is Maya Patel's
- **THEN** "Maya Patel already has this number" shows, with Use Maya Patel

#### Scenario: no way to reach them
- **WHEN** neither a phone nor an email is given
- **THEN** it says "A phone number or an email — at least one." and nothing is added

### Requirement: A customer's page with one history

A customer's page SHALL show their details, their bikes, whether they're happy
to hear about offers, and one history of their jobs, sales and messages: jobs
still under way first (a finished bike waiting to be collected included), then
everything else, newest first, filtered by Everything, Jobs, Sales or Messages.

#### Scenario: an open job and an old sale
- **WHEN** Maya has a job booked in and a sale from last month
- **THEN** the job is under "Open now" and the sale under "Earlier, newest first"

#### Scenario: someone new
- **WHEN** a customer has no jobs, sales or messages
- **THEN** History says "Nothing yet" with New job

### Requirement: Edit a customer's details

Edit SHALL change nothing until Save changes, and SHALL keep the rules of Add
a customer: a name, and a phone number or an email.

#### Scenario: saved
- **WHEN** staff change Maya's postcode and press Save changes
- **THEN** her page shows the new postcode

### Requirement: Possible duplicates are flagged, never merged by themselves

A customer's page SHALL say when another active customer has the same phone
number (however written) or email, unless staff have said they're different
people, and SHALL never merge them without staff choosing to.

#### Scenario: same phone
- **WHEN** Maya Patel and Maya P. both have 07700 900142
- **THEN** Maya Patel's page says "Might be the same person as Maya P. · same phone number" with Check

#### Scenario: different people
- **WHEN** staff press They're different people
- **THEN** neither page flags the other again

### Requirement: Merge into one, undoable for 30 days

Merge SHALL keep the chosen value of each field that differs, move every job,
sale, order, bike, message, till sale, group and online account of the other
record to this one, and hide the other record. For 30 days Undo the merge SHALL
put back everything that moved and the fields as they were; after 30 days the
hidden record SHALL be removed.

#### Scenario: merged
- **WHEN** staff merge Maya P. into Maya Patel, keeping Maya Patel's name
- **THEN** Maya P.'s jobs and sales are on Maya Patel's page and Maya P. is no longer listed or found

#### Scenario: undone
- **WHEN** staff undo the merge within 30 days
- **THEN** Maya P. is back with her own jobs and sales, and Maya Patel's fields are as they were

#### Scenario: removed after 30 days, with anything that arrived late
- **WHEN** 30 days have gone and a till sale synced late still names Maya P.
- **THEN** the sale moves to Maya Patel and Maya P. is removed

#### Scenario: undo after a later merge
- **WHEN** Maya Patel has since been merged into another record
- **THEN** undoing the first merge is refused, saying to undo the later one first

#### Scenario: a later merge into the same record
- **WHEN** Maya Patel has had a second record merged in since
- **THEN** undoing the first merge is refused until the second is undone

#### Scenario: a change made since
- **WHEN** staff correct Maya Patel's email after the merge, then undo it
- **THEN** the corrected email stays; only what the merge changed goes back

#### Scenario: a till that was offline
- **WHEN** a till sends a sale, or the customer itself, for Maya P. after the merge, before or after her record is removed
- **THEN** the sale is Maya Patel's, and Maya P. isn't made again

#### Scenario: both have online accounts
- **WHEN** both records have an online account
- **THEN** Merge is refused, saying so, and nothing moves

### Requirement: An old Customers link opens the new Customers page

The old app's Customers screen SHALL be gone. An old link to it SHALL open
the new Customers page, and an old link to a customer SHALL open that
customer's page.

#### Scenario: An old link to a customer
- **WHEN** someone opens the old app's link to customer 5
- **THEN** the new customer page for customer 5 opens

### Requirement: Merging two customers keeps a yes to reminders
When staff merge two customers, if either said yes to service reminders, or to review requests, the kept customer SHALL say yes to it, with when and where the yes was given. Undoing the merge SHALL put the kept customer's answers back, where nobody has changed them since.

#### Scenario: A guest's yes
- **WHEN** Maya ticked "Remind me…" as a guest, and staff merge that record into her main one
- **THEN** her main record says yes, from that booking

#### Scenario: Undo
- **WHEN** staff undo that merge
- **THEN** her main record's answers are as they were
