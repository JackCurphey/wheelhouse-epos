## ADDED Requirements

### Requirement: Part 2's reports have their cards
The Reports page SHALL show, under "Ready-made reports", a card for each report this part builds (Workshop, Returning customers, Margin and stock value, VAT), in the drawing's order and with its line as drawn (`rp-home`). A report not yet built SHALL have no card.

#### Scenario: the Owner sees the new cards
- **WHEN** Jack Lewis, the Owner, opens Reports after Workshop is built
- **THEN** he sees the Workshop card with "Jobs, labour and parts, how full each mechanic was", and it opens the Workshop report

#### Scenario: Discounts and refunds isn't built
- **WHEN** Jack opens Reports
- **THEN** there is no Discounts and refunds card

### Requirement: The Workshop report's figures
Workshop SHALL open on This week, with the same periods as Sales, and show Jobs booked in (bikes booked in at the shop), Finished (signed off by a mechanic), Collected, and Booked in to ready (the average in days, from booked in to signed off), each compared in words with the period before ("[Up or down] [n] on the same days last week"), then a graph of jobs finished by day, as drawn (`rp-workshop`).

#### Scenario: a job finished this week
- **WHEN** a bike booked in on Monday 14 September was signed off by Alex Morgan on Wednesday 16 September
- **THEN** it counts in Finished, in Wednesday's bar, and in Booked in to ready, as the days between the two

#### Scenario: a reopened job
- **WHEN** a job signed off on Tuesday was reopened and signed off again on Thursday
- **THEN** it counts once in Finished, on Thursday

### Requirement: Workshop takings split into labour and parts
Workshop SHALL show Workshop takings for jobs paid in the period, as Labour, Parts and Total, each against the period before; Labour and Parts SHALL add up to Total, a discount on the sale being shared between them in proportion.

#### Scenario: a job paid with a discount
- **WHEN** a job's sale had labour and parts lines and £[£] off the whole sale
- **THEN** Labour and Parts are each reduced in proportion and add up to what was taken for the job

### Requirement: Workshop quotes by how they stand
Workshop SHALL show the quotes sent in the period as Approved (including partly approved), Declined and No answer (still waiting or expired), each against the period before.

#### Scenario: a quote with no answer
- **WHEN** a quote sent on Tuesday has had no answer
- **THEN** it counts in No answer for this week

### Requirement: How full each mechanic was
Workshop SHALL show, for each mechanic, the hours booked in the diary against the hours they are in from their working days and the workshop's hours, less their time away ("[n] of [n] hours booked · [n]% full"), and the Shared queue's hours booked with "no set hours", with the note "Hours booked in the diary against the hours each mechanic is in, from their working days."

#### Scenario: Jo Taylor's week
- **WHEN** Jo Taylor works Monday to Wednesday and has jobs booked in the diary on those days
- **THEN** her row shows the hours of those jobs against the workshop's hours on Monday to Wednesday, and how full that is

#### Scenario: a job with no mechanic
- **WHEN** a job is in the diary with no mechanic
- **THEN** its hours count in the Shared queue's row, which says "no set hours"

### Requirement: Returning customers' figures
Returning customers SHALL open on Last 12 months, with Last 24 months and Pick dates, and show Customers, New and Came back within 12 months, each compared in words with the period before, then a graph of new and returning customers by month, as two parts of one bar, and a table by month with a total row (`rp-returning`).

#### Scenario: the last 12 months
- **WHEN** Jack opens Returning customers
- **THEN** he sees the three figures, the graph, and the table with a row for each month and "All 12 months"

### Requirement: Who counts as a customer visiting
A customer SHALL count when they buy something or a repair is collected, and the report SHALL say "A customer counts when they buy something or a repair is collected — in the shop or online. Sales with no customer on them are not counted."

#### Scenario: a first visit
- **WHEN** a customer's first ever sale was in March
- **THEN** they count as New in March, and as Returning in any later month they come back

#### Scenario: a sale with no customer
- **WHEN** a walk-in sale has no customer on it
- **THEN** it counts in no figure on Returning customers

### Requirement: Customers not seen lately
Returning customers SHALL list the customers not seen for [n] months, most recently seen first, with Customer, Last bought or collected, Spent in the period shown, and Happy to hear about offers (Yes or No, from what the customer said). The number of months SHALL start at 6 and be changeable in the box beside the title. Each customer SHALL open their customer page. A deleted customer SHALL not be listed.

#### Scenario: changing the months
- **WHEN** Jack changes "Not seen for" to 12 months
- **THEN** the list shows only customers whose last visit was more than 12 months ago

#### Scenario: a customer who said no to offers
- **WHEN** a customer said no to hearing about offers
- **THEN** their row says "No"

### Requirement: The VAT quarter is asked once
The first time the Owner opens VAT, and while the shop hasn't said, a box SHALL ask "When does your VAT quarter start?" with the choices "January, April, July, October", "February, May, August, November" and "March, June, September, December", the line "It's on your VAT registration, or ask your accountant.", Not now and Save (`rp-vat-first`). Save SHALL keep it on the shop and not ask again. Not now SHALL show calendar quarters for that visit, say so, and ask again next time.

#### Scenario: saving the quarter
- **WHEN** Jack chooses "March, June, September, December" and Save
- **THEN** the VAT report shows the quarter starting in the latest of those months, and the box isn't shown again

#### Scenario: not now
- **WHEN** Jack chooses Not now
- **THEN** the report shows the calendar quarter, says it is using calendar quarters, and asks again next time he opens VAT

### Requirement: VAT on sales by rate
VAT SHALL open on This VAT quarter, with Last VAT quarter and Pick dates, and show, for sales made in the period, Sales before VAT and VAT charged by rate ("Standard 20%", "Reduced rate 5%", "Zero rate 0%", and any other rate on its own row), each against the quarter before, with a Total row, and no graph and no "Change what's shown" (`rp-vat`). Refunds SHALL join it once they are recorded with their money.

#### Scenario: a till sale at two rates
- **WHEN** a till sale had a line at 20% and a line at 0%
- **THEN** each line's sales before VAT and VAT count on its own rate's row

### Requirement: Sales without their VAT are shown apart
Sales whose VAT was not recorded SHALL be one row of their own, "VAT not recorded", giving their takings including VAT, with a line saying to take their VAT from the accounts software or the accountant.

#### Scenario: a sale from before VAT was kept
- **WHEN** a sale in the quarter was saved without its VAT
- **THEN** its takings count in "VAT not recorded", and in no rate's row

### Requirement: Stock purchases are not counted
VAT SHALL show the Stock purchases box with "Stock purchases only — not your full VAT reclaim. Rent, bills and other costs don't go through Wheelhouse." and "Supplier invoices are checked in your accounts software — take this figure from there.", and no figure, until the supplier invoice check is built.

#### Scenario: the stock purchases box
- **WHEN** Jack opens VAT
- **THEN** the Stock purchases box gives no figure and says to take it from the accounts software

### Requirement: Stock value on the shelves today
Margin and stock value SHALL show "On the shelves today": the stock value at what it cost, for every product with stock, by Stockroom category (Items and What it cost you, with an All row), using each product's cost today, and say how many products with stock have no cost and so aren't in it.

#### Scenario: stock in two categories
- **WHEN** the Stockroom has bearings and drivetrain parts in stock with their costs
- **THEN** Bearings and Drivetrain each show their items and value at cost, and All adds them up

### Requirement: Stock written off in the period
Margin and stock value SHALL show "Stock written off": stock takes counted under and over, and each adjustment reason (Damaged, Lost or stolen, Used in the workshop, Faulty — to return to supplier, Found, Other), with Items and At cost as it was when each happened, and an All row; each row SHALL open the counts or the products behind it.

#### Scenario: a damaged adjustment
- **WHEN** a product was adjusted down as damaged this week
- **THEN** "Adjusted · Damaged" counts its items and its value at cost when adjusted, shown with a minus sign

### Requirement: Each sale line keeps its cost when sold
When a sale is saved, the server SHALL keep on each line the product's cost at that moment, and on an old-record line its VAT rate too. A line with no product, or a product with no cost, SHALL keep none. Past sales SHALL not be given a cost. The till SHALL send nothing new.

#### Scenario: a cost changed after the sale
- **WHEN** brake pads were sold at a cost of £[£] and their cost was changed the next day
- **THEN** the sale's line keeps the cost it had when sold, and its margin doesn't change

### Requirement: Margin on goods, from kept costs
Margin and stock value SHALL show, for sale lines with a kept cost in the period, Sales before VAT, What it cost you, Margin (sales less cost) and Margin %, by Stockroom category with an All row and a graph, each compared with the period before, and "[n] products sold without a cost" with a way to see them and add a cost. A period starting before costs were kept SHALL say from which day margin counts. Nothing SHALL work margin out from today's costs.

#### Scenario: a product sold without a cost
- **WHEN** a product with no cost was sold this week
- **THEN** it is left out of margin and counted in "[n] products sold without a cost"

### Requirement: Labour is shown beside margin, not in it
Margin and stock value SHALL show "Labour £[£] · not in margin" and "Margin is on goods only."

#### Scenario: labour beside margin
- **WHEN** a job's labour was paid this week
- **THEN** it shows in "Labour £[£] · not in margin" and in no margin figure

### Requirement: Margin on the Reports page's strip
Once margin can be worked out, the Reports page's strip SHALL show Margin ("£[£] · [n]%") for this week so far beside Takings, for people who can see costs.

#### Scenario: the Owner's strip
- **WHEN** Jack opens Reports on Thursday 17 September
- **THEN** the strip shows Takings and Margin for Monday to now

### Requirement: Costs, margin and VAT only for people who can see costs
Margin and stock value and VAT, and the strip's Margin, SHALL be shown only to people who can see costs and margin, which is the Owner until roles are built; every report in this part SHALL be the Owner's only until then, as part 1's are.

#### Scenario: Staff are refused
- **WHEN** Jo Taylor, Staff, asks for the Margin figures
- **THEN** she is told "Only the shop's owner can see reports" and no figures are sent

### Requirement: Each report downloads as a spreadsheet
Workshop, Returning customers, VAT, and Margin and stock value SHALL each have "Download as spreadsheet" ("Download" on a phone), giving each of the report's tables as shown, one after another under its title, with the same figures as on screen and a file name saying the report, the shop and the dates.

#### Scenario: the VAT download
- **WHEN** Jack downloads VAT for this VAT quarter
- **THEN** the file has the Sales table by rate with its Total row, as on screen
