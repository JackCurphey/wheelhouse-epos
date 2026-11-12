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
A row with no name, no account number, or the same email or phone as someone already here, SHALL wait for a look and SHALL NOT make a customer.

#### Scenario: The same person
- **WHEN** a row's phone is another customer's, written with +44
- **THEN** it needs a look: "Looks like the same person as [customer name]"

### Requirement: Bikes join their customers
Each row of Service Items Report SHALL become a bike on the customer it matches by email, phone or name, whichever file came first. A bike SHALL NOT be added to a customer whose details were deleted.

#### Scenario: Bikes before customers
- **WHEN** the bikes file comes across before Top Customers
- **THEN** once customers are in, the bikes join them and no longer need a look

#### Scenario: Can't tell whose
- **WHEN** a bike's only match is a name two customers share, its email and phone fit two people, or its name disagrees with the person they fit
- **THEN** it needs a look, and nobody gets it

#### Scenario: A corrected bike
- **WHEN** a bike was corrected in Wheelhouse and the file is sent again
- **THEN** it isn't added again

### Requirement: A deleted customer stays deleted
Deleting a customer's details SHALL hold against any file, SHALL remove a waiting row with their account number or with their exact name and their email or phone, and SHALL keep a waiting row with another name that only shares their email or phone, with no link to them.

#### Scenario: The file sent again
- **WHEN** a customer's details were deleted and Top Customers is sent again
- **THEN** they don't come back, their record stays blank, and the row is counted as left out

#### Scenario: Only codes are kept
- **WHEN** a customer's details are deleted
- **THEN** only one-way codes of their account number, email and phone stay, unique to the shop, linked to nothing, used only to spot them on import

#### Scenario: Added by hand, deleted before any file
- **WHEN** someone added by hand and deleted is in the first file sent, by email or phone
- **THEN** they aren't created, and the row needs a look

#### Scenario: Someone sharing a deleted customer's email
- **WHEN** a row has a deleted customer's email or phone, and its own account number
- **THEN** it needs a look, "Shares contact details with a customer who was deleted", with no name and no customer, and nothing creates them

#### Scenario: A deleted customer's own account number
- **WHEN** a row has a deleted customer's account number
- **THEN** it's left out, counted, and its row emptied

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
#### Scenario: Sent again
- **WHEN** a file is sent again
- **THEN** the summary says how many were already here, and the number brought across doesn't grow

#### Scenario: Stock that didn't come across
- **WHEN** a row with stock needs a look
- **THEN** Stock levels says how many need a look, not All in

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
- **THEN** nothing is made, and Products and Stock levels each need one fewer look, and Stock levels says how many were left out, not All in

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

#### Scenario: An account number in another case
- **WHEN** a deleted customer's account number comes in another case, or with spaces around it, typed or in a file
- **THEN** it's left out in the same way; A1 and a1 are one account

### Requirement: A person decides about a row that looks like someone already here
A customer row that "Looks like the same person as [customer name]" SHALL come across only if the email or phone is corrected, or the person fixing that row ticks that this is someone else. It SHALL then be a new customer; nothing SHALL merge them.

#### Scenario: A son sharing his mum's email
- **WHEN** the owner ticks that the row isn't [customer name], and saves
- **THEN** a new customer is made, and [customer name] is unchanged

#### Scenario: A row like two people
- **WHEN** a row's email is one customer's and its phone another's, and the owner ticks that it isn't the first
- **THEN** it asks about the second, naming them, and makes nobody until each has their own tick

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

#### Scenario: A row about someone merged, then the kept record deleted
- **WHEN** a row left out or needing a look has their exact name and a link to them, they're merged into another record, whether or not the 30 days have gone, and that record's details are deleted
- **THEN** the row goes, and the count follows

#### Scenario: A merge undone
- **WHEN** that merge is undone
- **THEN** the row's link goes back to them

#### Scenario: A row left out, then they changed their details, then were deleted
- **WHEN** a row with their exact name was flagged as the same person and left out, they changed their email and phone in Wheelhouse, and their details are deleted
- **THEN** it goes, as a row needing a look does

### Requirement: Who sorted a row is recorded
A fix or leave-out SHALL record who did it: the person checked in where someone is, otherwise the person signed in. On a till or workshop computer with nobody checked in it SHALL be refused. Only the Owner SHALL do it.

#### Scenario: A till with nobody checked in
- **WHEN** the owner's sign-in saves a fix on a till with nobody checked in
- **THEN** it says to check in first, and nothing changes

#### Scenario: A staff record removed
- **WHEN** someone who sorted a row or asked for help has their staff record removed
- **THEN** it's removed, and the row stays, naming nobody

### Requirement: Everything's sorted
When every row that needed a look has been fixed or left out, the page SHALL say "Everything’s sorted", with how many rows were left out.

#### Scenario: The last row left out
- **WHEN** the last row is dealt with
- **THEN** it shows "Everything’s sorted" and Left out with its count, says what happened to that row, and the focus goes there

#### Scenario: Another file afterwards
- **WHEN** the owner sends another file from "Everything’s sorted"
- **THEN** the summary shows, and once that file's rows are sorted, "Everything’s sorted" again

### Requirement: Ask us to help
Each card on the page SHALL have Ask us to help, top right, opening a short form: "What looks wrong?", and a line saying the team sees which card it was asked from and who's asking. Send SHALL pass it to the Wheelhouse team and say "Thanks — we’ve got it. Any reply comes to your email." Sending waits until something is written. The form SHALL ask people not to include customers' details. Nothing from a move's rows SHALL go with it. Until a real inbox is connected, it SHALL work only on the test copy, in local development and in tests; anywhere else, or if it can't be told, the page SHALL NOT offer it and the server SHALL refuse it.

#### Scenario: Sent
- **WHEN** the owner writes what looks wrong and sends it from Here’s what came across
- **THEN** it's recorded once with that card, their name and the shop, and the thanks shows

#### Scenario: It couldn't be sent
- **WHEN** the send fails
- **THEN** what they wrote stays in the box, to try again, and it says why; changing what they wrote sends it as new

#### Scenario: Production with no inbox
- **WHEN** the server is production, and not the test copy, with no real inbox
- **THEN** Ask us to help isn't on the page, and a request is refused and not kept

#### Scenario: A customer named in a request, then deleted
- **WHEN** a request holds a customer's exact email, phone in a usual form, or name, in any case, and their details are deleted
- **THEN** the request goes, and one with a misspelt name or about someone else stays

#### Scenario: Words and numbers that only look like them
- **WHEN** a customer called Will is deleted and a request says "The import will not finish for Sam Patel", or a customer's phone is 555 1234 and a request quotes barcode 5012345551234
- **THEN** the request stays: a name must be at least two words and a phone the whole number

### Requirement: See them opens the rows left out
When "Everything’s sorted" shows rows left out, its Left out line SHALL offer See them, opening Settings › Office › Your data with Download everything unfolded (`mockup/links/j09.mjs:46`), and its sentence SHALL read "Everything that fitted is in. The ones you left out are listed under Settings › Office › Your data, to add by hand when you like." (`moving.mjs:127`).

#### Scenario: Two rows left out, See them
- **WHEN** the Owner left out two rows and presses See them on Everything's sorted
- **THEN** Settings › Office › Your data opens with Download everything unfolded, showing "Left out from Citrus Lime · 2 rows", and the download holds both rows with why each needed a look

#### Scenario: Nothing left out
- **WHEN** every row was fixed and none left out
- **THEN** Everything's sorted shows no See them, and Your data shows no fifth row and the zip no fifth file

#### Scenario: A left-out row whose customer was then deleted
- **WHEN** a row left out holds a customer's own details and that customer's details are then deleted
- **THEN** the row goes at the deletion, so it is not in "Left out from Citrus Lime.csv"; a row only sharing their email or phone stays, with its reason, and is listed

### Requirement: The left-out rows come in the download
While any rows are left out, the download SHALL hold "Left out from Citrus Lime.csv", one row per row left out with the file it came from, why it needed a look and Citrus Lime's own columns in Citrus Lime's order, and the fold SHALL show a fifth row "Left out from Citrus Lime · [n] rows" (answer 1). A row that went when its customer's details were deleted SHALL NOT appear.

#### Scenario: Rows left out in the download
- **WHEN** two rows were left out and the Owner downloads everything
- **THEN** "Left out from Citrus Lime.csv" holds both, each with why it needed a look

### Requirement: Files are taken one at a time, the next as soon as the last is answered
A shop SHALL send one Citrus Lime file at a time. A second send while one is still being taken SHALL be told "Wheelhouse is still taking in another of your files. Try again in a moment." A send made once the last one has been answered, whatever the answer, SHALL NOT be turned away as busy.

#### Scenario: Files sent one after another
- **WHEN** the Owner drops several files and the page sends each as soon as the last was taken
- **THEN** each is taken, up to ten waiting to be read, with none refused as busy

#### Scenario: Two at once
- **WHEN** a send is still coming in and the shop sends another
- **THEN** the second is told Wheelhouse is still taking in another of its files, to try again in a moment
