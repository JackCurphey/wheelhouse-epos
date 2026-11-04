## ADDED Requirements

### Requirement: The owner sees the rows that need a look
Look at the [n] SHALL open a list of the rows that need a look, under Products and Customers, each with its reason, Leave it out and Fix, each named after its row, then Done for now.

#### Scenario: Two customers and a product
- **WHEN** the summary says rows need a look and the owner chooses Look at the [n]
- **THEN** each row shows with its reason, and its buttons say which row they're for

#### Scenario: Done for now
- **WHEN** rows remain and the owner chooses Done for now
- **THEN** the summary shows, still saying how many need a look

### Requirement: Fix corrects one row
Fix SHALL open a pop-up for that one row, with its details to correct. Saving SHALL check them by the same rules as a row in a file. A row that fits SHALL come across, once, with the file's counts following. A row that still doesn't fit SHALL stay as it was, and say why.

#### Scenario: A price added
- **WHEN** a product row with 6 on hand has no price, and the owner adds £28.00 as 28.00
- **THEN** the product exists with 6 in stock, its history has one line of 6, and the file counts it in, not as needing a look

#### Scenario: Still doesn't fit
- **WHEN** the price typed reads £12.50
- **THEN** the pop-up says the price isn't a number Wheelhouse can use, nothing is made, and the row still needs a look

#### Scenario: Save pressed twice, or sent again with no answer
- **WHEN** the same save arrives twice
- **THEN** one product and one stock line are made, and both get the same answer

#### Scenario: A bike whose customer was fixed
- **WHEN** a customer row is fixed and a bike needing a look fits them
- **THEN** the bike joins them

### Requirement: Leave it out sets a row aside
Leave it out SHALL keep the row, counted as left out, and it SHALL no longer need a look. Stock in that row SHALL no longer count as needing a look.

#### Scenario: A row left out
- **WHEN** the owner leaves out a row with stock
- **THEN** nothing is made, and Products and Stock levels each need one fewer look

### Requirement: A person decides about a row sharing a deleted customer's details
A row with the reason "Shares contact details with a customer who was deleted", or one whose corrected email or phone is a deleted customer's, SHALL NOT come across unless the person fixing that row ticks that this is someone else. Nothing SHALL do this for more than one row at a time. It SHALL NOT link to, merge with or restore the deleted customer.

#### Scenario: Saved with no tick
- **WHEN** the owner saves such a row without ticking
- **THEN** no customer is made, and the pop-up asks

#### Scenario: Ticked
- **WHEN** the owner ticks and saves
- **THEN** one new customer is made from the row, with nothing of the deleted customer, whose record stays blank

#### Scenario: The fix types in a deleted customer's email
- **WHEN** a row with another reason is fixed to a deleted customer's email or phone
- **THEN** it asks in the same way

#### Scenario: The fix types in a deleted customer's account number
- **WHEN** a row is fixed to a deleted customer's account number, ticked or not
- **THEN** it's left out as they asked, counted, and its row emptied

### Requirement: A person decides about a row that looks like someone already here
A customer row that "Looks like the same person as [customer name]" SHALL come across only if the email or phone is corrected, or the person fixing that row ticks that this is someone else. It SHALL then be a new customer; nothing SHALL merge them.

#### Scenario: A son sharing his mum's email
- **WHEN** the owner ticks that the row isn't [customer name], and saves
- **THEN** a new customer is made, and [customer name] is unchanged

### Requirement: A deletion isn't undone by a row left open
A save or leave-out SHALL be refused if the row has gone or changed since it was shown. Deleting someone's details SHALL treat rows left out as it treats rows needing a look.

#### Scenario: Deleted while the pop-up is open
- **WHEN** a customer's details are deleted while the owner has open a row sharing their email, and the owner saves
- **THEN** it's refused, nothing is made, and the row shows its new reason

#### Scenario: Their own row, gone while open
- **WHEN** the row went at the deletion, and the owner saves
- **THEN** it's refused, and it isn't put back

#### Scenario: A row left out, then its customer deleted
- **WHEN** a left-out row has their account number, or their exact name and their email or phone
- **THEN** it goes, and the count follows

### Requirement: Who sorted a row is recorded
A fix or leave-out SHALL record who did it: the person checked in where someone is, otherwise the person signed in. On a till or workshop computer with nobody checked in it SHALL be refused. Only the Owner SHALL do it.

#### Scenario: A till with nobody checked in
- **WHEN** the owner's sign-in saves a fix on a till with nobody checked in
- **THEN** it says to check in first, and nothing changes

### Requirement: Everything's sorted
When every row that needed a look has been fixed or left out, the page SHALL say "Everything’s sorted", with how many rows were left out.

#### Scenario: The last row left out
- **WHEN** the last row is dealt with
- **THEN** it shows "Everything’s sorted" and Left out with its count

### Requirement: Ask us to help
Each card on the page SHALL have Ask us to help, top right, opening a short form: "What looks wrong?", and a line saying the team sees which card it was asked from and who's asking. Send SHALL pass it to the Wheelhouse team and say "Thanks — we’ve got it. Any reply comes to your email." Sending waits until something is written. Nothing from a move's rows SHALL go with it.

#### Scenario: Sent
- **WHEN** the owner writes what looks wrong and sends it from Here’s what came across
- **THEN** it's recorded once with that card, their name and the shop, and the thanks shows

#### Scenario: It couldn't be sent
- **WHEN** the send fails
- **THEN** what they wrote stays in the box, to try again
