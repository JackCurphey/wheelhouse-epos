# moving-from-citrus-lime Specification

## Purpose
How a shop brings its data across from Citrus Lime's exports (journey 9, WP-2.4 and WP-8.1).

## Requirements

### Requirement: Wheelhouse recognises a Citrus Lime export from its columns
The owner SHALL send a file with no column matching. Wheelhouse SHALL work out which report it is from its column names, and refuse a file it can't read without keeping anything from it.

#### Scenario: A price list with a title above the table
- **WHEN** the owner sends an Excel file with Price List - Store Level's columns under a title row
- **THEN** it is taken as the products file and its rows wait to come across

#### Scenario: A file Wheelhouse can't read
- **WHEN** the owner sends a file that isn't a spreadsheet, one with no report's columns, or one far too large once unpacked
- **THEN** it says "can't read", nothing from it is kept, and the server keeps answering for every other shop while it's read

#### Scenario: Only the Owner
- **WHEN** anyone else sends a file or asks how the files are getting on
- **THEN** they are refused

### Requirement: Products and stock come across by themselves
Each row of a price list SHALL become a product with its price, cost, VAT rate, supplier, reorder level and stock, carrying on in the background without the owner staying on the page, and picking up after a restart. Non-zero stock SHALL have a history line saying it came from Citrus Lime. Nothing SHALL show online because of it.

#### Scenario: Shimano brake pads
- **WHEN** a price list has Shimano brake pads, code B05S-RX, £28.00, cost £14.00, 6 on hand
- **THEN** the product exists with those figures and its history has one line of 6, "Brought across from Citrus Lime"

#### Scenario: Sent twice
- **WHEN** the same send is retried, or the same file is sent again
- **THEN** the stock and the counts are not doubled, and what was changed in Wheelhouse since stays

### Requirement: A row that doesn't fit waits for a look
A row Wheelhouse can't use SHALL be kept with the reason, counted as needing a look, and SHALL NOT stop the rest of the file.

#### Scenario: No price
- **WHEN** one row in a price list has no price
- **THEN** it needs a look, with the reason, and the other rows come across

#### Scenario: Stock at another shop
- **WHEN** a price list, this one or a later one, holds rows for a store other than the first this shop sent
- **THEN** those rows need a look, the first store's stock stands, and Stock levels doesn't say All in

#### Scenario: Not a plain number
- **WHEN** a price reads £12.50, 12,50, 0x10 or 1e3
- **THEN** that row needs a look, and no price is made from it

### Requirement: Barcodes join their products
Each row of a Barcode/Alias List SHALL give its product that barcode, whichever file was sent first.

#### Scenario: Barcode file first
- **WHEN** the barcode file comes across before the price list
- **THEN** once the price list is in, the barcodes join their products and no longer need a look

#### Scenario: A barcode already taken
- **WHEN** a barcode belongs to another product, or the product already has a different one
- **THEN** that row needs a look, and neither product changes

### Requirement: The owner brings their data across from one page
Office › Moving from Citrus Lime SHALL show the three stages, the files to download and one place to drop them, for the Owner only. Dropping files SHALL start bringing them across, with no Import button.

#### Scenario: Nothing sent yet
- **WHEN** the Owner opens the page with nothing sent
- **THEN** it shows "Bring your data from Citrus Lime", each kind "Not added yet", and "Drop all the files here"

#### Scenario: Anyone else
- **WHEN** someone other than the Owner opens the page
- **THEN** they're told it's for the shop's owner, and it isn't in their sidebar

### Requirement: Progress shows and the owner can leave
While files come across the page SHALL show each kind's state, announced to screen readers, and say the owner can leave. A file Wheelhouse can't read SHALL say so and offer another.

#### Scenario: Coming across
- **WHEN** a price list is part-way across
- **THEN** Products shows its file name and how many of how many, with "You can leave this page"

#### Scenario: Can't read it
- **WHEN** a file is refused as unreadable
- **THEN** its row says "Wheelhouse couldn’t read this file" and "Couldn’t read it", with Choose another file

#### Scenario: No answer
- **WHEN** a send gets no answer
- **THEN** it's sent once more with the same key, so it can't count twice

### Requirement: A plain summary of what came across
When everything sent is in, the page SHALL say how many came across for each kind, All in or how many need a look.

#### Scenario: Some need a look
- **WHEN** a price list and barcode file finished with rows needing a look
- **THEN** Products says how many came across and how many, in all, need a look

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
Deleting a customer's details SHALL hold against any file, and SHALL remove rows about them still waiting in one.

#### Scenario: The file sent again
- **WHEN** a customer's details were deleted and Top Customers is sent again
- **THEN** they don't come back, and their record stays blank

#### Scenario: A row waiting for a look
- **WHEN** a row with their email is waiting for a look, and their details are deleted
- **THEN** the row goes, and the count follows
#### Scenario: Sent again
- **WHEN** a file is sent again
- **THEN** the summary says how many were already here, and the number brought across doesn't grow

#### Scenario: Stock that didn't come across
- **WHEN** a row with stock needs a look
- **THEN** Stock levels says how many need a look, not All in
