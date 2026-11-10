# customers Specification

## Purpose
Front desk › Customers: finding and adding a shop's customers, a customer's page with one history and their bikes, merging duplicates, and the shop's privacy requests, including deleting someone's details.

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

### Requirement: Each bike has its own page
A bike's page SHALL show the bike's name with "[Customer]’s bike" and New job; its Details (Colour, Frame number, Note) with Edit; who it Belongs to, linking to their page; and "Jobs on this bike", with what's open now first and the rest newest first (`cs-bike`). Each bike on a customer's page SHALL link to it.

#### Scenario: Maya's Trek
- **WHEN** staff open the Trek Domane AL 3 from Maya's page
- **THEN** they see its colour, frame number and note, "Maya Patel’s bike", and every job on it

### Requirement: New job from a bike starts with that bike chosen
New job on a bike's page SHALL open New job with its owner and that bike already chosen.

#### Scenario: Booking the Trek in
- **WHEN** staff press New job on the Trek's page
- **THEN** New job opens with Maya and the Trek chosen

### Requirement: A sale in a customer's history opens
A customer's history SHALL list their sales from both sales records. Choosing one SHALL open it: "Sale" and its number, when it was made, who served and the customer, each line with its quantity and amount, the total and how it was paid. For a sale on the old record it SHALL offer "Print the receipt".

#### Scenario: Maya's inner tubes
- **WHEN** staff open Maya Patel's page and choose her sale of two inner tubes
- **THEN** it shows "Inner tube", "2", the amount, the total and how she paid, with "Print the receipt"

### Requirement: Staff add a bike from the customer's page

The customer page's Bikes SHALL have "+ Add", opening "Add a bike" with Make, Model, Colour and Serial number, Cancel and Add bike. Adding SHALL list the bike at once. A bike with neither a make nor a model SHALL be refused with "Enter a make or a model."

#### Scenario: adding a bike
- **WHEN** staff add a Specialized Allez in Red
- **THEN** it is listed under Bikes, opening its own page

#### Scenario: nothing typed
- **WHEN** staff press Add bike with no make or model
- **THEN** the box stays open and says "Enter a make or a model."

### Requirement: A customer can be a company or club

Add a customer and Edit SHALL ask "This is: A person / A company or club".
For a company or club they SHALL ask for the company or club name and a
contact name, and offer an optional VAT number and an optional "Send
invoices to" email address. The company's name SHALL be the name the shop
sees for that customer everywhere. A "Send invoices to" that isn't an email
address SHALL be refused, and a person SHALL keep no company details.

#### Scenario: adding a company
- **WHEN** staff choose "A company or club" and give [Company name], a contact name, a phone number, VAT number [Company VAT number] and "Send invoices to" [accounts email]
- **THEN** the customer is added as [Company name], a company, with those details

#### Scenario: no contact name
- **WHEN** staff add a company or club without a contact name
- **THEN** it says "Add the contact’s name." and nothing is added

#### Scenario: an invoice address that isn't one
- **WHEN** "Send invoices to" is "accounts@example"
- **THEN** it is refused, saying "That doesn’t look like an email address — check it"

#### Scenario: a company becomes a person
- **WHEN** staff edit a company and choose "A person"
- **THEN** its contact name, VAT number and "Send invoices to" are cleared

### Requirement: A customer's or a bike's details saved twice at once both stay
When two saves of different details of the same customer, or of the same bike, arrive at the same moment, each SHALL be kept: the second save SHALL start from what the first wrote, never from what was stored before it. The checks on what is sent, and which shop's customers and bikes a save can reach, SHALL be unchanged.

#### Scenario: A phone number and a note at once
- **WHEN** a customer's new phone number and a new note save at the same moment
- **THEN** both are stored

#### Scenario: A bike's colour and frame number at once
- **WHEN** a bike's new colour and its frame number save at the same moment
- **THEN** both are stored

#### Scenario: A refused save
- **WHEN** a customer save is refused because the name is empty
- **THEN** nothing it sent is stored, and the next save goes straight through

### Requirement: Privacy requests, dated, answered within a month
The Owner SHALL see the shop's privacy requests from "Privacy requests · [n] open" on Customers: each with who, what (a copy of their data, or deleting their details), where it came from, when it was asked and when an answer is due (one month on, in the shop's days), overdue ones marked, open ones first. A copy downloaded from the account SHALL show as done, and a done deletion by its reference, with no name. Nobody but the Owner SHALL see the list.

#### Scenario: Maya's request on the list
- **WHEN** Maya Patel has asked from her account to delete it
- **THEN** the list shows "Maya Patel · Delete their details", "From their account on the website · asked [date] · answer by [date]", and Customers shows "Privacy requests · 1 open"

#### Scenario: Not the Owner
- **WHEN** a staff member asks for the list or to delete
- **THEN** they are refused

### Requirement: A bike still in the workshop holds a deletion back
A deletion request whose customer has a bike still in the workshop SHALL say "Still in the way: bike in the workshop, [ref]" and hold Delete back until it is collected. A customer who owes on account SHALL likewise hold it back, with "Still in the way: owes on account [£ owed]", until it is paid (customer service decision 12(2)). Nothing else SHALL hold it back.

#### Scenario: Her bike is still in
- **WHEN** her bike is in the workshop as WH-1042
- **THEN** the row says "Still in the way: bike in the workshop, WH-1042", Delete is held back, and "Can be deleted once the bike is collected." shows

#### Scenario: Collected
- **WHEN** her bike is collected after she asked
- **THEN** Delete is no longer held back

#### Scenario: She owes on account
- **WHEN** Maya owes [£ owed] on account
- **THEN** the row says "Still in the way: owes on account [£ owed]", Delete is held back, and the server refuses a deletion until she owes nothing

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

### Requirement: A bike bought here shows each of its warranty lines
A customer's bike bought at the shop SHALL show "Bought here [date]" and each of its warranty lines with its own end, on the customer page's Bikes list and in the Warranty block of the bike's own page (`cs-page`, `cs-bike`; customer service decision 4; Jack, 9 Nov, answer 3). A running line SHALL read "until [date], [n] months left" or "lifetime"; an ended one "ended [date]". [Q 19] A bike not bought here SHALL show no warranty.

#### Scenario: Maya's Trek, under warranty
- **WHEN** Maya Patel's Trek Domane AL 3 was bought here on [date] and Trek's lines are Frame lifetime and Components 2 years
- **THEN** her Bikes list shows "bought here [date]" and "Under warranty · Frame: lifetime · Components: until [date], [n] months left", and the bike's page shows the same lines under "Warranty" with "Bought here [date]"

#### Scenario: A Trek e-bike
- **WHEN** the bike bought here is a Trek e-bike
- **THEN** it also shows "Electronics: until [date], [n] months left"

#### Scenario: Components ended, frame still running
- **WHEN** a Cube bought here has a 10-year frame and its 2 years of components have passed
- **THEN** it shows "Under warranty · Frame: until [date], [n] months left · Components: ended [date]"

#### Scenario: Every line ended
- **WHEN** every line has ended
- **THEN** it shows "Warranty ended [date]", the latest line's end

#### Scenario: Less than a month left on a line
- **WHEN** fewer than 31 days are left on a line
- **THEN** that line reads "until [date], less than a month left" [Q 15]

#### Scenario: A bike from elsewhere
- **WHEN** a bike was added by staff or by the customer and never bought here
- **THEN** its page has no Warranty block and its row no warranty line

#### Scenario: Bought here, but no lines for its brand
- **WHEN** a bike bought here has a brand with no warranty lines, or no brand
- **THEN** it shows "Bought here [date]" and no warranty line

### Requirement: A bike sold here joins its customer's bikes
When a bike with a recorded frame number is sold to a customer, it SHALL be added to that customer's Bikes (or the bike with that frame number they already have SHALL be used), marked bought here on the sale's day, with each warranty line's end worked out from that day and the lines of its product (its own, or its brand's), Electronics only for an e-bike. This SHALL happen only once a sale records a frame number, which comes with the till's half (Jack, 9 Nov, answer 1).

#### Scenario: Selling a Trek with its frame number
- **WHEN** a Trek Domane AL 3 is sold to Maya on [date] with frame number [frame number], and Trek's lines are Frame lifetime and Components 2 years
- **THEN** Maya's Bikes gains the Trek with that frame number, "bought here [date]", "Frame: lifetime" and "Components: until [date]" two years on

### Requirement: Staff record a bike bought here before Wheelhouse
A bike's Edit SHALL let staff record "Bought here on" for a bike sold before the shop used Wheelhouse, with its brand (from Bike warranties, starting at the one matching its Make) and, if wanted, its model (a product of that brand, for a model's own lines), and whether it is an e-bike (starting from the model's). Its warranty lines' ends SHALL follow from that date and those lines, worked out when saved. Clearing "Bought here on" SHALL remove its warranty (Jack, 9 Nov, answer 4).

#### Scenario: A Trek sold in the Citrus Lime years
- **WHEN** Jo records that Maya's Trek was bought here on [date], brand Trek, no model
- **THEN** the bike shows "Bought here [date]" and Trek's lines with their ends from that date

#### Scenario: A brand not in the list
- **WHEN** the bike's Make isn't one of Bike warranties' brands
- **THEN** the brand starts empty, staff can pick one, and with none picked it shows "Bought here [date]" and no warranty

#### Scenario: Not a sensible date
- **WHEN** "Bought here on" is after today
- **THEN** it isn't saved and says the date can't be in the future

### Requirement: Logging a privacy request by hand
The Owner SHALL be able to log a privacy request with "+ Log a request" (`cs-privacy`): the customer (found as the header search finds them), what they asked for (a copy of their data, or deleting their details), how they asked [Q 7] and the day they asked (today or earlier, never later). The answer is due one month from the day they asked. Nobody but the Owner SHALL log one.

#### Scenario: Maya asks at the counter
- **WHEN** Jack Lewis logs that Maya Patel asked in person on [date] for a copy of her data
- **THEN** the list shows "Maya Patel · Copy of their data", how she asked, "Asked [date] · answer by [date]", with Send the copy

#### Scenario: A letter that arrived last week
- **WHEN** Jack logs a request asked on a day more than a month ago
- **THEN** it shows Overdue at once

#### Scenario: Not the Owner
- **WHEN** a staff member tries to log a request
- **THEN** they are refused

### Requirement: Sending the copy
On an open copy-of-their-data request, "Send the copy" SHALL give the Owner the customer's full copy, the account's copy with the shop's own notes about them and their bikes added (Jack's 30 Oct answer 1), to download, and to email when the customer has an email (Jack, 9 Nov, answer 6). Sending SHALL mark the request done with the day.

#### Scenario: Sending Maya her copy
- **WHEN** Jack Lewis presses Send the copy on Maya's request and chooses Email it
- **THEN** one email with her copy is queued to maya@example.test, and the row shows "Asked [date] · done [date]" and Done

#### Scenario: No email
- **WHEN** the customer has no email
- **THEN** only Download it is offered, and downloading marks the request done

#### Scenario: Not the Owner
- **WHEN** a staff member asks for the copy
- **THEN** they are refused and nothing is sent

### Requirement: Store credit is lost on deletion, and the loss is kept
Deleting someone's details SHALL set their store credit to zero with an entry "Lost when their details were deleted", kept without their name for the shop's books. A deletion request whose customer holds store credit SHALL show it on its row, without holding the deletion back (account and reminders audit M12).

#### Scenario: Maya holds credit when deleted
- **WHEN** Maya Patel, holding [£] store credit, has her details deleted
- **THEN** her request row had shown "Store credit [£] will be lost", and after deleting the books keep an entry of [£] lost with no name
