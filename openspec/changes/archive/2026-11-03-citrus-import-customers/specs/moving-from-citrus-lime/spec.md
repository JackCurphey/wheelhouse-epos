## ADDED Requirements

### Requirement: Customers come across with their yes to offers
Each row of Top Customers SHALL become a customer with their contact details, whether they said yes to offers and when. Someone who has already come across SHALL be left as they are.

#### Scenario: A customer who said yes
- **WHEN** Top Customers has Maya with an email, a phone, GDPR Consent Yes and its date
- **THEN** she's a customer with those details, offers on, and that date kept

#### Scenario: Sent twice
- **WHEN** the same file is sent again after her phone was changed in Wheelhouse
- **THEN** there's still one Maya, with the new phone

### Requirement: A customer who doesn't fit waits for a look
A row with no name, or with the same email or phone as someone already here, SHALL wait for a look and SHALL NOT make a customer.

#### Scenario: The same person
- **WHEN** a row's phone is another customer's, written with +44
- **THEN** it needs a look: "Looks like the same person as [customer name]"

### Requirement: Bikes join their customers
Each row of Service Items Report SHALL become a bike on the customer it matches by email, phone or name, whichever file came first. A bike SHALL NOT be added to a customer whose details were deleted.

#### Scenario: Bikes before customers
- **WHEN** the bikes file comes across before Top Customers
- **THEN** once customers are in, the bikes join them and no longer need a look

#### Scenario: Can't tell whose
- **WHEN** a bike's only match is a name two customers share
- **THEN** it needs a look, and neither customer gets it

### Requirement: A deleted customer stays deleted
Deleting a customer's details SHALL hold against any file, SHALL remove a waiting row with their account number or with their exact name and their email or phone, and SHALL keep a waiting row with another name that only shares their email or phone, with no link to them.

#### Scenario: The file sent again
- **WHEN** a customer's details were deleted and Top Customers is sent again
- **THEN** they don't come back, and their record stays blank

#### Scenario: A row that shares their details
- **WHEN** a row with their email or phone is waiting for a look, and their details are deleted
- **THEN** the row stays as needs a look, "Shares contact details with a customer who was deleted", with no link to them, its own details kept, and the count unchanged

#### Scenario: A row with their exact name and their email or phone
- **WHEN** a row, waiting or needing a look, has their exact name and their email or phone, and their details are deleted
- **THEN** the row goes, and the count follows, even if it's someone with the same name and email; it's back as needs a look only if the file is sent again

#### Scenario: A row still waiting with another name
- **WHEN** a row still waiting has another name and their email or phone, and their details are deleted
- **THEN** it stays, and needs a look once it's looked at

#### Scenario: A file that can't be read after a store stopped part-way
- **WHEN** storing a file stopped part-way, and the file then can't be read
- **THEN** no row of it is left, and choosing another file clears it

#### Scenario: A row with their account number
- **WHEN** a row with their account number is waiting, and their details are deleted
- **THEN** the row goes, and the count follows
