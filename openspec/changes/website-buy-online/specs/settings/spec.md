## ADDED Requirements

### Requirement: Online orders settings say what the website sells
Settings › Front desk › Online orders SHALL show "What the website sells" with "Only what’s on the shelf — At the shop they collect from. Ready the same day." as the shop's setting, and "Stock is held for the customer as soon as they’ve paid, and checked again just before they pay." The other two drawn choices SHALL not be offered until stock transfers and supplier times exist (question 10, default taken, Jack can overrule).

#### Scenario: The fold
- **WHEN** the Owner opens What the website sells
- **THEN** it shows "Only what’s on the shelf" with its hint, and no other choice

### Requirement: Showing products is switched on each category
"Showing products" SHALL list each category with an On or Off switch ("Bearings On", "Drivetrain › Derailleurs On"). Switching a category SHALL set every product in it; a product's own "Show on website" switch can then differ. The fold SHALL say "[n] products are set differently from their category." with See them, and "New products follow their category."

#### Scenario: A category switched off
- **WHEN** the Owner switches [Category] off
- **THEN** every product in [Category] is off the website

#### Scenario: A product set differently
- **WHEN** two products in Bearings are switched off on their own pages in Stock
- **THEN** the fold says "2 products are set differently from their category." with See them, which opens Stock showing them

#### Scenario: A new product
- **WHEN** a product is added to a category that is On
- **THEN** it shows on the website

### Requirement: Showing products says how the website started
When the website's set-up chose to start with every product online, Showing products SHALL say "Started with every product online on [date]." with Change, which asks the same question as the set-up's third step.

#### Scenario: Started with everything
- **WHEN** the shop's set-up chose "Start with every product online"
- **THEN** Showing products says "Started with every product online on [date]." with the set-up's date

### Requirement: Paying online has switches for wallets and store credit
The Paying online fold SHALL keep WP-6.1's "Connected to [payment provider] by Jack Lewis on [date]" and add switches for "Apple Pay and Google Pay" and "Store credit (for signed-in customers)", each starting On. There SHALL be no Gift cards switch until gift cards are built (question 8, default taken, Jack can overrule).

#### Scenario: Store credit off online
- **WHEN** the Owner switches Store credit off here
- **THEN** checkout offers no store credit, and the till's own store credit setting is unchanged

### Requirement: Not collected sets the reminder and how long orders are kept
"Not collected" SHALL show "Reminder after [n] days · kept for [n] days", with "Remind the customer after" and "Keep orders for" and the drawn explanation. New shops SHALL start at 3 and 7 days (question 12, default taken, Jack can overrule). The reminder SHALL be 1–60 days and keeping 2–90 days, longer than the reminder, as for bikes.

#### Scenario: Starting values
- **WHEN** a shop opens Not collected for the first time
- **THEN** it reads "Reminder after 3 days · kept for 7 days"

#### Scenario: Keeping shorter than the reminder
- **WHEN** the Owner sets Keep orders for to fewer days than the reminder
- **THEN** it is refused with a message and nothing is saved

### Requirement: Where ready orders wait is one named shelf
"Where ready orders wait" SHALL hold one "Shelf or spot" name ("Set once. Ready orders show “Waiting at [Shelf name]” on Online orders, and the till’s hand-over says where to fetch them from."). Until it is set, the fold SHALL show the drawn placeholder and ready orders SHALL leave the "Waiting at" words out.

#### Scenario: Shelf named
- **WHEN** the Owner names the shelf
- **THEN** ready orders on Online orders say "Waiting at" that shelf

### Requirement: Online orders settings are the Owner's until roles exist
Every Online orders setting SHALL be changed by the Owner only until roles and switches are built, as WP-6.1's Buying online and Paying online are.

#### Scenario: Staff refused
- **WHEN** Jo Taylor (Staff) tries to save Not collected
- **THEN** it is refused
