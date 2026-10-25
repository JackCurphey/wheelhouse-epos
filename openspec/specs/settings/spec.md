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
