# your-data Specification

## Purpose
The shop's own copy of everything it keeps in Wheelhouse, taken from Settings › Office › Your data as spreadsheets that open in Excel or Google Sheets, so the shop can keep it whatever happens (programme rule 5; `set-data-export`).

## Requirements

### Requirement: Your data shows what the download holds
Settings › Office SHALL have a Your data area, intro "Take a copy of everything, and see who changed what in Settings.", with a fold Download everything summarised "Customers, sales, stock, jobs". Open, it SHALL show four ticked rows (Customers, Sales and refunds, Stock, Workshop jobs), the drawn note and the button Download everything (`setup.mjs:463-465`). Every download holds all four (answer 2).

#### Scenario: Opening Your data
- **WHEN** the Owner opens Settings › Office and unfolds Download everything
- **THEN** they see Customers, Sales and refunds, Stock and Workshop jobs ticked, the note, and Download everything

#### Scenario: No Settings changes yet
- **WHEN** the Owner opens Your data before the activity log exists (WP-1.2)
- **THEN** there is no Settings changes fold

#### Scenario: Jumping to Your data
- **WHEN** the Owner uses Jump to on the Office room
- **THEN** Your data is offered after Shop and sites, and choosing it scrolls to it

### Requirement: Download everything gives one zip of spreadsheets
Pressing Download everything SHALL download one zip named "[shop name] data [YYYY-MM-DD].zip" (the shop's day) holding "Customers.csv", "Sales and refunds.csv", "Stock.csv" and "Workshop jobs.csv". A list with nothing in it SHALL still come, with only its header row.

#### Scenario: A shop with customers, sales, stock and jobs
- **WHEN** the Owner of North Street Cycles presses Download everything on 1 Sep 2026
- **THEN** a file "North Street Cycles data 2026-09-01.zip" downloads, holding the four spreadsheets

#### Scenario: A new shop with no sales yet
- **WHEN** a shop with no sales presses Download everything
- **THEN** "Sales and refunds.csv" is in the zip with its header row only

### Requirement: The spreadsheets open cleanly in Excel and Google Sheets
Each spreadsheet SHALL have a header row, show £ and ’ correctly in Excel, and write any cell a spreadsheet would read as a formula as text. Money SHALL be in pounds with two decimals; times SHALL be in the shop's time zone.

#### Scenario: A name that looks like a formula
- **WHEN** a customer's name starts with "="
- **THEN** the cell is written as text, so the spreadsheet doesn't run it

### Requirement: The Customers spreadsheet
"Customers.csv" SHALL hold one row per customer of the shop who has not been deleted and has not been merged into another record, with their name, email, mobile, address, postcode, whether they are a company (with contact name, VAT number and where invoices go), their customer groups, how they hear about job updates, their yes or no to service reminders, review requests and offers with when and where a yes was given, and when the record was made.

#### Scenario: A deleted customer
- **WHEN** a customer's details were deleted at their request
- **THEN** they have no row in Customers.csv

#### Scenario: Two merged records
- **WHEN** two records were merged into one
- **THEN** only the kept record has a row

### Requirement: The Sales and refunds spreadsheet
"Sales and refunds.csv" SHALL hold every sale from both sales records, oldest first, one row per item sold (answer 3): date and time, receipt number, shop and till where known, who served, customer, item, quantity, price each, line total, VAT where recorded, the sale's total and how it was paid.

#### Scenario: A sale of two items
- **WHEN** a till sale had Shimano brake pads B05S-RX and one other item, [product name]
- **THEN** it has two rows, sharing its date, receipt number and total

#### Scenario: An older sale with no VAT recorded
- **WHEN** a sale is from the older record, which never recorded VAT or a receipt number
- **THEN** its VAT and receipt number cells are empty, not 0

### Requirement: Refunds are in the same spreadsheet
The refunds Wheelhouse records today SHALL be rows in "Sales and refunds.csv" with negative amounts and "Refund" in a Kind column, saying what each refunded: online deposit refunds and Shopify refunds now, till refunds once the till records them (answer 4).

#### Scenario: An online deposit refunded
- **WHEN** a job's online deposit was refunded
- **THEN** a Refund row shows the deposit's amount as negative, with its job

### Requirement: The Stock spreadsheet
"Stock.csv" SHALL hold one row per product at each of the shop's sites (small one 9), with its name, size and colour where it has them, SKU, barcodes, category, supplier, selling price, cost price, VAT rate, the quantity at that site, and its reorder level where set.

#### Scenario: A product stocked at two sites
- **WHEN** a product is kept at Bolton and at a second site, [site name]
- **THEN** it has two rows, each with that site's quantity

### Requirement: The Workshop jobs spreadsheet
"Workshop jobs.csv" SHALL hold one row per workshop job, with its job number, the customer's name, the bike, the services, the date booked in and the date due, where it is up to, the mechanic, the quoted and final amounts, any deposit, and when it was collected. Its staff notes SHALL be included, since this is the shop's own copy (answer 6).

#### Scenario: A job collected and paid
- **WHEN** a job was collected
- **THEN** its row shows "Collected", the date collected and its final amount

### Requirement: Only the Owner can download the shop's data
Until roles are built (WP-1.1) only the Owner SHALL see the Download everything button and take the download; anyone else asking SHALL be refused with "Only the shop's owner can download the shop's data". A request with nobody signed in SHALL be refused. The download SHALL only ever hold the signed-in shop's own data.

#### Scenario: A staff member
- **WHEN** a staff member opens Settings
- **THEN** they are refused as for every other setting, and the download route refuses them too

#### Scenario: Two shops
- **WHEN** the Owner of one shop downloads
- **THEN** nothing from another shop is in any spreadsheet

### Requirement: The download says while it is being made and if it fails
While the zip is being made the button SHALL read "Preparing your download…" and be disabled, announced to screen readers. If it fails the fold SHALL say "The download didn’t start." with Try again, in the drawn warning bar (small one 8, the pattern of the customer's copy on their account).

#### Scenario: A failure
- **WHEN** the server can't make the zip
- **THEN** the fold shows "The download didn’t start." and Try again, and the button works again

### Requirement: The daily figures are in Download everything
Download everything SHALL include a "Daily figures" list: one row per closed day, newest first, with the day, who closed it, the takings by how they were paid, the sales by category before VAT, the VAT where it is recorded, the cash difference, and whether the day was sent to accounts software, as plain numbers in pounds and pence. It SHALL be available whether or not accounts software is connected, and SHALL leave out a reopened day until it is closed again.

#### Scenario: a shop with no accounts software
- **WHEN** Jack downloads everything
- **THEN** the file has Daily figures with a row for each closed day, ready to import into accounts software

#### Scenario: a reopened day
- **WHEN** Wednesday is reopened
- **THEN** Daily figures has no row for Wednesday until it is closed again
