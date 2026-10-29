# settings Specification

## Purpose
How the Owner finds and changes the shop's settings: rooms down the left (Front desk, Workshop, Office, and Stockroom once anything in it is built), each room's areas with Jump to, and each setting in a fold with a one-line summary of what is set up; on a phone, a list of rooms first. Owner only until roles are built.

## Requirements

### Requirement: Settings is arranged in rooms with folding sections
Settings SHALL show the rooms that have something built down the left (Front desk, Workshop, Office), each room's page with its areas and, for more than one area, Jump to; each setting SHALL sit in a fold with a one-line summary of what is set up; on a phone Settings SHALL open on the list of rooms, each room its own page with "‹ Settings" back (drawn in settings-frame.mjs).

#### Scenario: Opening Settings on a computer
- **WHEN** the Owner opens Settings
- **THEN** Front desk shows, with Jump to Till and Messages, and the Receipts fold open

#### Scenario: A fold's summary
- **WHEN** the shop is closed on Sundays
- **THEN** Office's Opening hours fold reads "Closed Sundays" while closed

### Requirement: The shop writes its own checklists in Settings
Settings › Workshop SHALL have a Checklists section, under Services, listing each checklist with its number of items and the services that use it (`set-workshop-checklists`; Jack, 22 Oct). The Owner SHALL be able to add one, blank or from the full service template, change its name and items, and remove it (`set-workshop-checklist-edit`). A checklist SHALL have a name and 1 to 50 items. Only the Owner SHALL change them, as other Settings.

#### Scenario: Starting from the template
- **WHEN** a shop with no checklists presses Use the full service template
- **THEN** it has a "Full service checklist" of ten items, from Frame & fork to Bolts torqued, used for no service yet

#### Scenario: Staff can't change them
- **WHEN** someone who isn't the Owner tries to change a checklist
- **THEN** it is refused, as other Settings are

### Requirement: The Owner chooses which services have each checklist
Each checklist SHALL have a "Used for" choice of the shop's services. A service SHALL have one checklist at most: choosing it for another checklist moves it there.

#### Scenario: A service moves to another checklist
- **WHEN** Standard service uses the Full service checklist and the Owner chooses it for a Safety checklist
- **THEN** Standard service uses the Safety checklist, and the Full service checklist no longer lists it

### Requirement: The shop chooses what a diary block shows first and second
Settings › Workshop SHALL have a Diary blocks section with a First line and a Second line, each one of Bike, Job title, Customer or Job number, saved as soon as chosen, with a preview and the note "The status always shows too, whatever the two lines above are set to." (`set-workshop-diary`; Workshop day 17, 29). Bike, then job title, SHALL be the default. The two lines SHALL never be the same: choosing the other line's choice SHALL swap them.

#### Scenario: Customer first
- **WHEN** the Owner chooses Customer for the first line
- **THEN** it saves, and the preview reads "Maya Patel", then "Standard service", then "Expected"

#### Scenario: Swapping the lines
- **WHEN** the lines are Bike then Job title and the Owner chooses Bike for the second line
- **THEN** they become Job title then Bike

### Requirement: The shop keeps its own storage slots
Settings › Workshop SHALL have a Storage slots section: a switch, off to start, with the note "On for this shop. Staff can note where a bike is kept, and the diary block shows the slot where there’s room.", the shop's slots as chips each with Remove, and "+ Add a slot" (`set-workshop-diary`; Workshop day 27). A slot's name SHALL be 1 to 40 letters and not used twice. Only the Owner SHALL change them.

#### Scenario: Adding a hook
- **WHEN** the Owner switches Storage slots on and adds "Hook 1"
- **THEN** Hook 1 is a chip in the list, and the section's summary reads "On · 1 slot"

#### Scenario: Removing a slot in use
- **WHEN** the Owner removes Hook 3 while a bike is kept on it
- **THEN** Hook 3 goes, and that bike is no longer shown on a slot

### Requirement: The shop sets when the quote reminder goes
Settings › Messages SHALL show, under Quote to approve, "Reminder if there’s no answer, after [n] hours" with the hours (1 to 168, 24 to start) and Edit for the Quote reminder's wording.

#### Scenario: Two days
- **WHEN** the owner sets the hours to 48
- **THEN** quotes sent from then on are reminded 48 hours after sending

### Requirement: The shop sets whether it takes a deposit when booking, and how much

Settings › Workshop › Online booking SHALL have the Deposits part drawn in
`bk-settings-deposits`: "Take a deposit when booking"; when on, "Deposit" (A
fixed amount or A percentage of the price), "How much", "If the price isn't
known" and "Free to cancel until" (hours before). The fold's summary SHALL
say the deposit or "no deposit". Deposits SHALL be off for every shop to
start, and SHALL only switch on while a payment provider is connected.

#### Scenario: Switched on before How much
- **WHEN** the Owner switches deposits on and hasn't filled in How much
- **THEN** deposits are on, no deposit is taken until it is filled in, and the fold says "no deposit"

#### Scenario: The fold says the deposit
- **WHEN** the shop takes 20%
- **THEN** the Online booking fold's summary includes "deposit 20%"

#### Scenario: Confirming by hand
- **WHEN** automatic confirming is off
- **THEN** the note "With automatic confirming off, the customer pays before the shop has said yes; if the shop declines, the deposit is refunded automatically." shows

#### Scenario: No payment provider
- **WHEN** no payment provider is connected and the Owner switches deposits on
- **THEN** it is refused, saying to connect one first, and deposits stay off

#### Scenario: Picking the kind and typing straight away
- **WHEN** the Owner picks "A fixed amount" and the answer hasn't come back yet
- **THEN** How much is greyed out until it comes back as the £ box, so what's typed is saved as pounds, never as a percentage

### Requirement: A booking's deposit is worked out from the price shown

A booking's deposit SHALL be that percentage
of the price shown when booking, several services' shown prices added first
and a "from" price used as it stands, rounded to the nearest penny, and
never more than that price; a fixed amount is that amount, also never more
than the price; a booking whose price isn't known takes the "If the price
isn't known" amount, or no deposit when that is empty.

#### Scenario: A percentage of two services
- **WHEN** the shop takes 20% and a customer books a £65.00 service and a £12.50 one
- **THEN** the deposit is £15.50

#### Scenario: Rounded to the penny
- **WHEN** the shop takes 15% and the price shown is £33.33
- **THEN** the deposit is £5.00 (15% is £4.9995)

#### Scenario: Price not known
- **WHEN** a customer books "Not sure what's wrong?" and the shop's amount for that is £10
- **THEN** the deposit is £10.00; with no amount set, there's no deposit

### Requirement: The shop lists its services in Settings, by group
Settings › Workshop SHALL have a Services fold, first, with the summary "Full service, Individual service". It SHALL show the pills "Full service" and "Individual service" and, for the one chosen, each of that group's services with its name, "[n] min in the diary" and its price, and Edit and Remove; then "+ Add a service" and "Groups and services show as pills, in this order, when a job is booked." (`set-workshop-services`). Removed services SHALL NOT be listed.

#### Scenario: Individual services
- **WHEN** the Owner chooses Individual service
- **THEN** Safety check, Gear adjustment and Brake service are listed, each with its time in the diary and its price

### Requirement: The Owner changes a service in its box
Edit SHALL open the service's box (`ac-service-edit`): its name as the title, with "[Group] · [n] min in the diary · [£ price]"; Name; Group, Full service or Individual service; Time in the diary in minutes; Price; "Customers can book this online"; Cancel and Save. Save SHALL write the service, keeping anything the box doesn't show, and a refusal SHALL show the shop's words in the box.

#### Scenario: A new price
- **WHEN** the Owner changes Standard service's time to 90 minutes and saves
- **THEN** the list shows "90 min in the diary"

### Requirement: The Owner adds a service
"+ Add a service" SHALL open the same box empty, titled "New service", in the group chosen, with "Customers can book this online" on.

#### Scenario: Adding a service
- **WHEN** the Owner adds a service under Individual service
- **THEN** it is listed under Individual service and customers can book it online

### Requirement: The Owner removes a service
Remove SHALL take a service out of the list and out of booking, keeping it on past jobs.

#### Scenario: Removing a service
- **WHEN** the Owner removes Brake service
- **THEN** it leaves the list, and new bookings can't choose it

### Requirement: A service says when its reminder is due
The service box SHALL have "Remind customers it’s due after [n] months", with "Counted from when the bike is collected. Only customers who said yes get it. Leave empty for no reminder — for a puncture, say." (`ac-service-edit`). Months SHALL be a whole number from 1 to 60, or empty for no reminder; anything else SHALL be refused with "Remind after a whole number of months, from 1 to 60". A service with a reminder SHALL say " · reminder after [n] months" in the list (`ac-services`).

#### Scenario: Standard service every year
- **WHEN** the Owner sets Standard service to remind after [n] months
- **THEN** its row reads "60 min in the diary · reminder after [n] months"

#### Scenario: A puncture
- **WHEN** the Owner leaves the months empty
- **THEN** the service has no reminder

### Requirement: The shop sets up review requests in their own box
The review request's Edit in Settings › Messages SHALL open its box: "Send review requests", "Your review page", "Send it [n] days after collection", the wording with the fixed "Stop these" line and a preview, and "Everyone gets the same link — Google doesn’t allow asking only happy customers. Only customers who said yes get it." Save SHALL write the page and days, then the switch and wording.

#### Scenario: Switching it on
- **WHEN** the Owner pastes their Google page, chooses [n] days, switches it on and saves
- **THEN** review requests are on, going [n] days after collection

### Requirement: Review requests can't be switched on without a review page
The box's switch SHALL stay off, with "Add your review page first, then switch this on.", until there is a review page.

#### Scenario: The first time
- **WHEN** the Owner opens it with no review page yet
- **THEN** the switch can't be turned on, and says to add the review page first

### Requirement: Customer groups
Settings › Front desk › Payments SHALL have a Customer groups fold listing each group with its name, how many current customers are in it, its discount and Edit, the note "The till gives the discount by itself when a group member is added to a sale, with the group as the reason.", and "+ Add a group". A group's box SHALL take a name and a percentage off between 0 and 100, save them, and remove the group.

#### Scenario: the club's members
- **WHEN** the owner opens Settings › Front desk › Payments with a group "Club members" at 10% off and three customers in it
- **THEN** it shows "Club members", "3 customers" and "10% off"

#### Scenario: a new group
- **WHEN** the owner adds a group "Blue Light" at 15% off
- **THEN** it is listed with "0 customers" and "15% off"

### Requirement: Settings › Messages lists the shop's own messages

Settings › Messages SHALL show "Your own messages" under the automatic messages, each with its name, when it goes and how, Edit, and On or Off, followed by "+ Add your own message".

#### Scenario: a spring check
- **WHEN** the shop has "Spring check", 6 months after a job is collected, by email
- **THEN** its row reads "Spring check" and "6 months after a job is collected · by email", with Edit and On

### Requirement: The Owner adds and changes them in the drawn box

"+ Add your own message" SHALL open the box drawn as `set-msg-new`: Name, "Send it", "How long after" (or "before") with Days or Months, "Send by" Text and Email, the Wording with its put-in buttons, the drawn note, Cancel and "Add the message". Edit SHALL open the same box with Remove, Cancel and Save.

#### Scenario: something missing
- **WHEN** the Owner presses "Add the message" with no name
- **THEN** the box stays open and says "Give the message a name."

#### Scenario: removing one
- **WHEN** the Owner opens Edit on a message and presses Remove
- **THEN** its row goes

### Requirement: Two settings saved at the same moment both stay
When two saves of different settings for the same shop arrive at the same moment, each SHALL be kept: the second save SHALL start from what the first wrote, never from what was stored before it. This covers Settings › Workshop (opening hours, booking rules, deposits and the rest of the workshop settings), the sticker label size, and the website settings. The checks on what is sent, and which shop's settings a save can reach, SHALL be unchanged.

#### Scenario: Deposits switched on while How much saves
- **WHEN** the Owner switches "Take a deposit when booking" on and, at the same moment, a new "How much" saves
- **THEN** deposits are on and the new amount is stored

#### Scenario: Label width and height at once
- **WHEN** a new label width and a new label height save at the same moment
- **THEN** both are stored

#### Scenario: Website tagline and description at once
- **WHEN** a new tagline and a new description save at the same moment
- **THEN** both are stored

#### Scenario: A shop's first two website saves at once
- **WHEN** a shop that has never saved its website settings saves two of them at the same moment
- **THEN** both saves work and both are stored

#### Scenario: A refused save
- **WHEN** a save is refused because something sent isn't allowed
- **THEN** nothing it sent is stored, and the next save goes straight through

### Requirement: The Owner's workshop and team details saved twice at once both stay
When two saves of different details of the same workshop service, service group, mechanic's time off or person on the team arrive at the same moment, each SHALL be kept: the second save SHALL start from what the first wrote, never from what was stored before it. The checks on what is sent, and which shop's records a save can reach, SHALL be unchanged.

#### Scenario: A service's reminder and its place at once
- **WHEN** a service's reminder months and its place in the list save at the same moment
- **THEN** both are stored

#### Scenario: A group's name and its place at once
- **WHEN** a service group's new name and its new place save at the same moment
- **THEN** both are stored

#### Scenario: Time off's reason and end time at once
- **WHEN** a mechanic's time off gets a new reason and a new end time at the same moment
- **THEN** both are stored

#### Scenario: A person's name and working days at once
- **WHEN** a person's new name and new working days save at the same moment
- **THEN** both are stored

#### Scenario: A refused save
- **WHEN** a service save is refused because it has no name
- **THEN** nothing it sent is stored, and the next save goes straight through

### Requirement: The shop sets its float
Settings › Front desk › End of day SHALL have a Float fold: "Leave this much in the drawer each night", in pounds and pence, and "Close the day works out the rest to bank, so every day starts with the same float." (cash-up decision 4; `set-eod`). Only the Owner SHALL change it, until roles. The float SHALL be kept in whole pence, from £0.00 to £100,000.00; until it is set the fold says it isn't set yet and there is no float check.

#### Scenario: Setting the float
- **WHEN** Jack Lewis types a float and saves
- **THEN** the fold shows it, and the next morning's float check asks for that amount

### Requirement: Settings › Till › Tills offers "Make this computer a till"
For the Owner, Settings › Front desk › Till SHALL have a Tills section after Receipts, summarised by the shop's tills ("Till B1") or "None yet". It SHALL list the tills that are on, in number order, then the workshop computers that are on, each with Rename and Remove (`set-till-tills-owner`), then the drawn note and "Make this computer a till", which opens Set up this till (stage-1 gaps 4). The button SHALL not show on a computer that is already a till, nor for a business with no site yet.

#### Scenario: Jack sets up the first till
- **WHEN** Jack Lewis opens Settings › Till › Tills on the shop's counter computer
- **THEN** he sees "Make this computer a till", which opens Set up this till

#### Scenario: Already a till
- **WHEN** the computer is Till B1
- **THEN** Tills reads "Till B1" and there is no "Make this computer a till"

#### Scenario: The list
- **WHEN** Jack Lewis registered Till B1 at Bolton on 1 September and opens Tills
- **THEN** he sees "Till B1" over "Bolton · registered Tue 1 Sep by Jack Lewis", with Rename and Remove

### Requirement: The shop sets when a stock adjustment shows on Today
Settings SHALL have a Stockroom room whose Stockroom area has a Stock adjustments fold: "Show on Today when an adjustment is worth more than", "At cost · for owners and managers", an amount in pounds and pence, and "Every adjustment is in its product’s stock history, whatever its value." (stock control decision 6; `st-setting-adjust`). Its summary SHALL read "Show on Today over £[amount]", or "Not set yet" until it is set. Only the Owner SHALL change it, until roles. The amount SHALL be kept in whole pence, from £0.00 to £100,000.00, and two saves at once SHALL each be written whole.

#### Scenario: Setting the amount
- **WHEN** Jack Lewis types an amount in Stock adjustments and leaves the box
- **THEN** it is saved, the fold's summary shows it, and adjustments worth more than it from then on show on Today

#### Scenario: Clearing the amount
- **WHEN** Jack Lewis empties the box and leaves it
- **THEN** the amount is cleared and the fold says "Not set yet"

### Requirement: The Owner renames a till or a workshop computer
Rename SHALL open a box with the till's or workshop computer's "Name (optional)", up to 60 characters, saved with Save; a blank name SHALL leave it with none. A named till's row SHALL read "Till B1 · [name]". Only the Owner SHALL rename, and not while someone else is checked in by PIN on the computer making the change.

#### Scenario: Naming a till
- **WHEN** Jack Lewis renames Till B1 "Front counter"
- **THEN** the row reads "Till B1 · Front counter"

#### Scenario: Clearing a name
- **WHEN** he empties the name and saves
- **THEN** the row reads "Till B1"

### Requirement: Removing a till or a workshop computer asks first
Remove SHALL ask first (`set-till-remove`): "Remove Till B1?", "Bolton", "This computer stops working as a till. Sales already taken stay in the reports.", "Keep the till" and "Remove the till". Removing SHALL switch it off: that computer stops being the till at once, its number stays in use, and what was done on it stays. A workshop computer SHALL be removed the same way. Only the Owner SHALL remove, and not while someone else is checked in by PIN on the computer making the change.

#### Scenario: Keeping the till
- **WHEN** Jack Lewis presses Remove on Till B1, then Keep the till
- **THEN** nothing changes

#### Scenario: Removing the till
- **WHEN** he presses Remove the till
- **THEN** Till B1 leaves the list, that computer is no longer Till B1, and B1 is still "In use" when setting up a till

#### Scenario: Removing a workshop computer
- **WHEN** he presses Remove on the workshop computer
- **THEN** he is asked "Remove the workshop computer?", "This computer stops working as a workshop computer."
- **WHEN** he presses Remove the workshop computer
- **THEN** it leaves the list and that computer goes back to being an ordinary signed-in browser

#### Scenario: A removed workshop computer still signed in as the Owner
- **WHEN** the workshop computer Jack Lewis removed is still signed in as him
- **THEN** it gets no Owner pages, even after signing in again there, until he signs out there and signs back in
