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

### Requirement: Change what's shown on the reports that have it
Sales, Takings and cash-ups, and Workshop SHALL each have a "Change what's shown" button that opens one popup with the report and period under its title, and three groups of chips in the one chip look: Measure, Split by, and Only. It SHALL open on what the report already shows. "Show report" SHALL open the changed report; Cancel SHALL leave the report as it was. VAT SHALL NOT have the button (`rp-change`; decision 2).

#### Scenario: the Owner opens the panel from Sales
- **WHEN** Jack Lewis, the Owner, is on Sales for this week and chooses "Change what's shown"
- **THEN** the popup says "Sales · this week so far", with Takings and Day chosen

#### Scenario: opened from Takings and cash-ups or Workshop
- **WHEN** Jack opens the panel from Takings and cash-ups, then from Workshop
- **THEN** it opens on Takings by Payment type, then on Jobs by Day

#### Scenario: VAT has no button
- **WHEN** Jack opens VAT
- **THEN** there is no "Change what's shown"

### Requirement: Choices that don't fit are greyed, with why
A choice that doesn't fit the report it started from, or what else is chosen, SHALL be greyed, struck through, and not choosable, with its reason announced to a screen reader and written under its group ("Jobs: workshop only — choose it from the Workshop report · Hours: workshop only"). The server SHALL refuse a combination that doesn't fit, with the same reason, so a typed address can't show one (audit M1).

#### Scenario: Jobs from Sales
- **WHEN** Jack opens the panel from Sales
- **THEN** Jobs is greyed with "workshop only — choose it from the Workshop report"

#### Scenario: Payment type with Items sold
- **WHEN** Jack chooses Items sold
- **THEN** Payment type is greyed with "payments aren't split by item"

#### Scenario: Payment type with an Only
- **WHEN** Jack has Takings chosen and ticks Accessories under Only
- **THEN** Payment type is greyed with "payments aren't split by item"

#### Scenario: Shop with one shop
- **WHEN** the shop has one site
- **THEN** Shop is greyed with its reason

### Requirement: Margin only for those who can see costs
Margin SHALL be shown in Measure only to someone who can see costs and margin (the Owner, until roles), and SHALL be greyed with its reason until sale lines keep their cost (part 2). Anyone who can't see costs SHALL NOT see Margin at all (audit M2).

#### Scenario: before costs are kept
- **WHEN** Jack opens the panel before sale lines keep their cost
- **THEN** Margin is greyed with its reason

### Requirement: Only, by category and supplier
Only SHALL list the shop's top-level Stockroom categories and Labour as checkboxes, and Supplier as "Any supplier" (chosen) and each supplier typed on products sold in the period. Ticking a category SHALL count everything under it. A line's category and supplier SHALL be its product's as it is now. A line with no product SHALL count under Labour if it is labour, otherwise in a row of its own.

#### Scenario: a category with sub-categories
- **WHEN** Jack ticks Drivetrain and a sale this week had a chain from "Drivetrain › Chains"
- **THEN** the chain counts

#### Scenario: with Jobs, Only lists service categories
- **WHEN** Jack opens the panel from Workshop with Jobs chosen
- **THEN** Only lists the workshop's service categories and there is no Supplier

### Requirement: The changed report
The changed report SHALL have its own title from what's chosen, a line under it saying what it was changed from, what it's limited to, and the period; the bar "You've changed this report. Save it to come back to it." with "Save as my report" and "Back to [report]"; the period chips; a graph of what's chosen, following Your settings' "Show graphs"; and a table of the split, the measure, and Takings when the measure is Items sold (or Margin), with a total row (`rp-changed`; decisions 7 and 8).

#### Scenario: items sold by product, accessories only
- **WHEN** Jack chooses Items sold, Product and Accessories, and "Show report"
- **THEN** he sees "Sales: items sold by product", under it "Changed from Sales · Accessories only · So far: Mon 14 – Thu 17 September, against the same days last week", a table with Product, Items sold and Takings, and a last row "Total, Accessories only"

#### Scenario: back to Sales
- **WHEN** Jack chooses "Back to Sales"
- **THEN** Sales opens as it was, for the same period

#### Scenario: downloading it
- **WHEN** Jack chooses "Download as spreadsheet" on the changed report
- **THEN** the file has the table as shown, made as part 1's downloads are

### Requirement: A changed report adds up to the report it came from
Takings in a changed Sales report SHALL add up, across every row, to Takings in Sales for the same period: a discount on a whole sale SHALL be shared between its lines in proportion, and a Split payment SHALL count its cash under Cash and its card under Card.

#### Scenario: a discounted sale by category
- **WHEN** a sale had a £[£] chain and a £[£] bottle with £[£] off the whole sale
- **THEN** the chain's and the bottle's rows are each reduced in proportion, and the total equals Sales' Takings

#### Scenario: a Split payment by payment type
- **WHEN** a sale was paid £[£] cash and £[£] card
- **THEN** each half counts in its own row

### Requirement: Save as my report
"Save as my report" SHALL open a popup with what the report is under its title, "Name (needed)", "Who can see it" with "Just me" chosen, the note "It opens on the latest period each time, under 'Your reports'.", and Cancel and Save. A name the same person already has, or no name, SHALL be refused with a message saying so (`rp-save`, `rp-save-taken`; audit M5).

#### Scenario: saving a report
- **WHEN** Jack names it and chooses Save
- **THEN** it is in Your reports on the Reports page, marked "Just you"

#### Scenario: a name already used
- **WHEN** Jack already has a report with that name
- **THEN** the popup says "You already have a report with this name. Choose another name." and nothing is saved

#### Scenario: no name
- **WHEN** Jack chooses Save with the name empty
- **THEN** the popup says "Type its name" and nothing is saved

### Requirement: Sharing waits for managers
Until staff roles exist, "Me and the other managers" and "Share with managers" SHALL be greyed with their reason, and the server SHALL refuse to share a report. Who can see a report SHALL be kept with it from the start.

#### Scenario: no managers yet
- **WHEN** Jack opens "Save as my report"
- **THEN** "Me and the other managers" is greyed with its reason and "Just me" is chosen

### Requirement: Your reports
The Reports page SHALL show "Your reports": each of the person's saved reports with its name, what it is, a badge of who can see it, and a "More for [name]" menu. A saved report SHALL belong to the person who saved it, and no one else SHALL see or open it. Opening one SHALL show it on the latest period of the kind it was saved on; one saved on Pick dates SHALL open on its report's first period.

#### Scenario: no saved reports yet
- **WHEN** Jack has saved none
- **THEN** Your reports says "Start from any report, choose 'Change what's shown', then 'Save as my report'."

#### Scenario: opening a saved report next week
- **WHEN** Jack saved a report on This week, and opens it the week after
- **THEN** it shows the new week, with the choices he saved

#### Scenario: someone else's report
- **WHEN** someone signed in as another person asks for Jack's saved report by its address
- **THEN** it isn't there for them

### Requirement: Rename and delete with Undo
A saved report's menu SHALL have Rename, Share with managers, and Delete (in the danger colour). Rename SHALL ask for the new name with the same two name messages. Delete SHALL take the report from the list at once, with "'[Report name]' deleted." and Undo, which SHALL put it back as it was (`rp-report-menu`, `rp-report-deleted`; audit M6).

#### Scenario: deleting and undoing
- **WHEN** Jack deletes a saved report and chooses Undo
- **THEN** it is back in Your reports with its name and choices

#### Scenario: undo after the name is used again
- **WHEN** Jack deleted a report, saved another with the same name, then chose Undo
- **THEN** he is told "You already have a report with this name. Choose another name." and asked for a new name

### Requirement: Reopen this day
A closed day's report SHALL have "Reopen this day" for the Owner, until roles. It SHALL ask "Why are you reopening it? (needed)" with a box, say "Saved with your name and the time. The day goes back to Needs attention, and what was sent to Xero is corrected when it's closed again.", and offer "Keep it closed" and "Reopen the day", which SHALL stay off until a reason is typed. Only the latest closed day SHALL offer it. The reason, the person and the time SHALL be saved with the day, and the first close SHALL be kept.

#### Scenario: reopening Wednesday
- **WHEN** Jack opens Wednesday 16 September's report, chooses Reopen this day, types "a card payment was counted as cash" and chooses Reopen the day
- **THEN** the day is reopened, with his name, the time and his reason saved, and its report no longer counts it

#### Scenario: no reason
- **WHEN** the reason box is empty
- **THEN** "Reopen the day" is off

#### Scenario: an earlier day
- **WHEN** Tuesday's report is opened while Wednesday is closed
- **THEN** it has no Reopen this day

### Requirement: A reopened day keeps its row and is left out of the totals, and said so
A reopened day's row in Takings and cash-ups SHALL keep the figures it was closed with, say it is reopened, open its report as it was saved, and keep its Online row; its figures SHALL be left out of the headline figures, the graph and the monthly totals until it is closed again. Takings and cash-ups SHALL say so above its table: "Wed 16 Sep is reopened — its figures are left out until it's closed again" with "Close the day" (Jack, 12 Nov, following the drawing `rp-takings-reopened`).

#### Scenario: the reopened bar
- **WHEN** Wednesday is reopened and Jack opens Takings and cash-ups
- **THEN** the bar says Wednesday is reopened and left out, with "Close the day", and the headline figures are without Wednesday

#### Scenario: the reopened day's row
- **WHEN** Wednesday is reopened
- **THEN** its row still shows the takings, cash banked and cash difference it was closed with and who closed it, marked Reopened, with its Online row beneath, and opening it shows its report as it was saved without "Reopen this day"

### Requirement: The Sent to Xero column
While accounts software is connected or has been lost, the closed days table SHALL have a "Sent to Xero" column: Sent for a day sent, Not closed yet for today, Reopened for a reopened day, Not sent for a day that couldn't go, and Waiting for a day waiting to be sent. Without accounts software the column SHALL not be shown. The Online rows SHALL show the same as the day they belong to.

#### Scenario: a mixed week
- **WHEN** Monday and Tuesday were sent, Wednesday couldn't go and Thursday is open
- **THEN** the column reads Sent, Sent, Not sent and Not closed yet

#### Scenario: no accounts software
- **WHEN** the shop has never connected accounts software
- **THEN** the table has no Sent to Xero column
