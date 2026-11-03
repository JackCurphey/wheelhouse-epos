## ADDED Requirements

### Requirement: Wheelhouse recognises a Citrus Lime export from its columns
The owner SHALL send a file with no column matching. Wheelhouse SHALL work out which report it is from its column names, and refuse a file it can't read without keeping anything from it.

#### Scenario: A price list with a title above the table
- **WHEN** the owner sends an Excel file with Price List - Store Level's columns under a title row
- **THEN** it is taken as the products file and its rows wait to come across

#### Scenario: A file Wheelhouse can't read
- **WHEN** the owner sends a file that isn't a spreadsheet, or one with no report's columns
- **THEN** it is refused as "can't read" and nothing is stored

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
- **THEN** the stock is not doubled, and what was changed in Wheelhouse since stays

### Requirement: A row that doesn't fit waits for a look
A row Wheelhouse can't use SHALL be kept with the reason, counted as needing a look, and SHALL NOT stop the rest of the file.

#### Scenario: No price
- **WHEN** one row in a price list has no price
- **THEN** it needs a look, with the reason, and the other rows come across

#### Scenario: Stock at another shop
- **WHEN** a price list holds a second store's rows
- **THEN** those rows need a look, and the first store's stock stands

### Requirement: Barcodes join their products
Each row of a Barcode/Alias List SHALL give its product that barcode, whichever file was sent first.

#### Scenario: Barcode file first
- **WHEN** the barcode file comes across before the price list
- **THEN** once the price list is in, the barcodes join their products and no longer need a look

#### Scenario: A barcode already taken
- **WHEN** a barcode belongs to another product, or the product already has a different one
- **THEN** that row needs a look, and neither product changes
