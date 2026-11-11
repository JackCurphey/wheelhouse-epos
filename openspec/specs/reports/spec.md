# reports Specification

## Purpose
Reports let a shop's owner see how the business is doing and take the figures away: sales over any period compared with the period before, each closed day's takings and cash, and a spreadsheet of any report.

## Requirements

### Requirement: Reports are the Owner's until roles exist
Reports and their downloads SHALL open for the shop's Owner only, until roles are built (WP-1.1). Anyone else signed in SHALL be refused with "Only the shop's owner can see reports", and the Reports item SHALL not show in their sidebar. Each report SHALL show only the signed-in shop's sales and closes.

#### Scenario: the Owner opens Reports
- **WHEN** Jack Lewis, the Owner, chooses Reports in the sidebar
- **THEN** the Reports page opens

#### Scenario: someone else is refused
- **WHEN** Jo Taylor, Staff, opens the Reports address or asks for a report's figures
- **THEN** she is told "Only the shop's owner can see reports" and no figures are sent

#### Scenario: another shop's sales never appear
- **WHEN** another shop has sales on the same days
- **THEN** none of them count in this shop's reports or downloads

### Requirement: The Reports page
The Reports page SHALL show today's date and the shop's name ("Thursday 17 September · North Street Cycles, Bolton"), then the figures strip, then "Ready-made reports" with a card for each report that is built, each with its name and line as drawn (`rp-home`). A card SHALL open its report.

#### Scenario: the built reports are listed
- **WHEN** Jack opens Reports
- **THEN** he sees the cards "Sales" ("Takings, number of sales and the average sale") and "Takings and cash-ups" ("Each closed day, and any cash difference"; the drawing's "and till" is left out while closes are per shop, Jack's answer 4), and no card for a report not yet built

### Requirement: The figures strip shows this week's takings so far
The strip SHALL be headed with this week so far ("So far: Mon 14 – Thu 17 September"), weeks starting on Monday, and SHALL show this week's Takings and a link with the shop's name that opens the Sales report on This week.

#### Scenario: Thursday's strip
- **WHEN** Jack opens Reports on Thursday 17 September
- **THEN** the strip reads "So far: Mon 14 – Thu 17 September" with Takings for Monday to now, and "North Street Cycles, Bolton", which opens Sales

### Requirement: Takings means one thing everywhere
In Reports, Takings SHALL be all money for sales made in the period, with VAT, with refunds taken off, counting online sales, and counting today so far. Sales SHALL be counted from both sales records, each sale once, on the shop's day it was made in the shop's own time zone; a deposit paid online SHALL count when its sale is made.

#### Scenario: a sale in each record
- **WHEN** one sale was recorded by the old record and one by the till's record on Tuesday
- **THEN** both count in Tuesday's Takings and Number of sales, once each

#### Scenario: an offline till sale
- **WHEN** a till made a sale offline at 17:55 on Tuesday and sent it on Wednesday
- **THEN** it counts on Tuesday

### Requirement: The report periods
Sales SHALL open on This week and offer Today, This week, This month, Last month, Last 12 months and Pick dates, one chosen at a time, the chosen one marked. A period that hasn't ended SHALL say "So far", and days not reached yet SHALL show "—" in the table and "Not yet" in the graph.

#### Scenario: this week on a Thursday
- **WHEN** Jack opens Sales on Thursday 17 September
- **THEN** it reads "North Street Cycles, Bolton · So far: Mon 14 – Thu 17 September, against the same days last week", and Friday to Sunday show "—"

#### Scenario: the last 12 months
- **WHEN** he chooses Last 12 months
- **THEN** it reads "October 2025 – September 2026, against the 12 months before"

### Requirement: Pick dates
Pick dates SHALL open a box headed "Pick dates" with From and To and the note "Compared with the same number of days just before.", Cancel and Show report. To before From, or a day after today, SHALL be refused with a message beside the field.

#### Scenario: a chosen range
- **WHEN** Jack picks 1 to 17 September and chooses Show report
- **THEN** Sales shows those 17 days against the 17 days just before

#### Scenario: dates the wrong way round
- **WHEN** To is before From
- **THEN** the report does not change and the box says what to fix

### Requirement: Comparison with the period before, in words
Each headline figure SHALL say how it compares with the period before, in words: up or down, and by how much ("Up £[£] on the same days last week"). This week so far SHALL compare with the same days last week, Last 12 months with the 12 months before, and picked dates with the same number of days just before.

#### Scenario: up on last week
- **WHEN** this week's Takings so far are more than Monday to Thursday last week
- **THEN** Takings says "Up £[the difference] on the same days last week"

### Requirement: The Sales report's figures
Sales SHALL show the headline figures Takings, Number of sales and Average sale (Refunds joins them once a sale's refund is recorded with its money, with step C), then a graph and a table: by day for a week or month (Day, Takings, Sales, Average), by month for 12 months (Month, Takings, Sales, Average), each with a total row ("So far", "12 months"). Below it SHALL say "Takings include VAT, take refunds off, and count online and Cycle to Work money; today counts so far."

#### Scenario: this week's table
- **WHEN** Jack opens Sales on Thursday
- **THEN** the table has a row for each day Monday to Sunday and a "So far" row whose Takings equal the Takings figure above

#### Scenario: average sale
- **WHEN** there were sales in the period
- **THEN** Average sale is Takings divided by Number of sales, to the penny

### Requirement: Nothing sold, or nothing to compare
When the period has no sales, Sales SHALL say "Nothing sold yet today" (or for the period chosen) with "Sales show here as soon as the first one goes through a till." When the shop has no sales before the period, it SHALL say "Nothing to compare with yet" with "The shop started on Wheelhouse on [date], so there's no period before this one. Comparisons start once there is." instead of comparisons.

#### Scenario: a new shop's first morning
- **WHEN** a shop with no sales yet opens Sales on Today
- **THEN** it shows "Nothing sold yet today" and "Nothing to compare with yet", and no figures that read as £0.00 comparisons

### Requirement: A graph above every report, the table below
Each report except a closed day's SHALL show a graph above its table: bars by day, with the period before as a dashed outline behind each bar, or a line by month for 12 months, with the 12 months before as a dashed line. It SHALL have a scale, a key, and a spoken description naming the busiest day or month and the change. The table SHALL always show.

#### Scenario: a screen reader
- **WHEN** a screen reader reaches the graph
- **THEN** it hears its title, the busiest day and the change on last week, and that the figures are in the table below

#### Scenario: graphs switched off
- **WHEN** Jack has turned off "Show graphs in reports"
- **THEN** each report shows its figures and table with no graph

### Requirement: Takings and cash-ups lists each closed day
Takings and cash-ups SHALL open on This week, with the same periods as Sales, and show Closed days' takings, Card, Cash, Other ("Gift cards, store credit and customer accounts"), Online ("Paid on the website · separate from the tills") and Cash differences, a graph of takings by closed day, and a table of days, newest first: Day, Takings, Cash banked, Cash difference, Closed by.

#### Scenario: the comparison while today is open
- **WHEN** Jack opens Takings and cash-ups on Thursday and Thursday isn't closed yet
- **THEN** each figure is compared with last Monday to Wednesday, not last Thursday's close against nothing

#### Scenario: a week with three closed days
- **WHEN** Jack opens Takings and cash-ups on Thursday and Monday to Wednesday were closed
- **THEN** the table has Thursday "Not closed yet", then Wednesday, Tuesday and Monday with their takings, cash banked, difference and who closed each

#### Scenario: a short day stands out
- **WHEN** a day's cash was short
- **THEN** its Cash difference shows with a minus sign, in the warning colour and in words for a screen reader

### Requirement: A past day nobody closed shows as Not closed
A past day in the period that nobody closed, and that Close the day can still close, SHALL be its own row in Takings and cash-ups (when it is shown by day, not by month) reading "Not closed", with its takings so far and a "Close it" link to Close the day for that day. It SHALL have no Online row and SHALL NOT be in the headline figures. Today, not yet closed, keeps its "Not closed yet" row.

#### Scenario: Saturday was never closed
- **WHEN** Jack opens Takings and cash-ups for a period that includes Saturday 12 September, which nobody closed
- **THEN** "Sat 12 Sep" reads "Not closed" with its takings so far ("£[£] so far") and "Close it", which opens Close the day for that day

### Requirement: Each day's online money is its own row
Each closed day, and today while it is open, SHALL have an "Online" row beside it, showing the online money that close kept apart from the tills, with "Not a till" and "—" in the cash columns; today, not yet closed, shows the online money so far ("[£] so far"). The page SHALL say "Online is what customers paid on the website, from your payment provider. It's separate from the tills: no till counts it, and it's in no till's close."

#### Scenario: Tuesday's online money
- **WHEN** Tuesday's close kept £[£] of online money apart
- **THEN** the row "Tue 15 Sep · Online" shows £[£] and "Not a till"

### Requirement: A closed day opens its end-of-day report
A closed day's row SHALL open that day's end-of-day report exactly as it was saved at the close (headed with the day, "Closed by [name] at [time]"), with the same figures and online line as when it was closed, Print and Download as spreadsheet. The figures SHALL not change afterwards.

#### Scenario: opening Wednesday
- **WHEN** Jack opens Wednesday 16 September's row
- **THEN** he sees Wednesday's end-of-day report with Takings, Card, Cash, the float, the difference and Banked as saved, and Print

#### Scenario: a sale counted later
- **WHEN** a sale made on Wednesday was saved after Wednesday's close
- **THEN** Wednesday's report is unchanged, and the sale counts in the next close

### Requirement: Download as spreadsheet
Each report SHALL have "Download as spreadsheet" beside its title ("Download" on a phone), and a closed day's report SHALL have it too. It SHALL download the report's table for the period shown, with its header and total rows, as a spreadsheet file that opens in Excel or Google Sheets with £ signs and names as shown, amounts in pounds and pence, and a file name saying the report, the shop and the dates.

#### Scenario: this week's Sales
- **WHEN** Jack chooses Download as spreadsheet on Sales for this week
- **THEN** he gets a file with Day, Takings, Sales and Average for Monday to Sunday and the "So far" row, the same figures as on screen

#### Scenario: a name that looks like a formula
- **WHEN** a closed day was closed by someone whose name starts with "="
- **THEN** the spreadsheet shows the name as text, not a formula
