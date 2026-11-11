## ADDED Requirements

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
The changed report SHALL have its own title from what's chosen, a line under it saying what it was changed from, what it's limited to, and the period; the bar "You've changed this report. Save it to come back to it." with "Save as my report" and "Back to [report]"; the period chips; a graph of what's chosen, following Your settings' "Show graphs"; and a table of the split, the measure, and Takings when the measure isn't Takings, with a total row (`rp-changed`; decisions 7 and 8).

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
