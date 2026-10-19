# shop-details Specification

## Purpose
The shop's own details (name, address, phone, email, VAT number), kept in Settings › Shop and sites and printed on receipts. For now one set covers the whole business; when shops have sites, the address and phone move onto each site and the VAT number stays with the business.

## Requirements

### Requirement: A shop keeps its details in Settings
Settings › Shop and sites › Shop details SHALL hold the shop's name, address, phone, email and VAT number, each saved when its box is left (`set-shop-details`; Jack, 18 Oct). They are one set for the whole business until shops have sites (decision answer 1). The name SHALL NOT be blank.

#### Scenario: Entering the address
- **WHEN** the owner types the address into Shop details and moves on
- **THEN** it is saved, and the next receipt prints it

#### Scenario: Leaving the VAT number blank
- **WHEN** a shop that isn't VAT-registered leaves the VAT number empty
- **THEN** it stays empty and receipts print no VAT number

### Requirement: A shop keeps the words for the bottom of its receipts
Settings › Till › Receipts SHALL hold "Words at the bottom", such as a returns policy or a thank-you, saved when the box is left (`set-till-receipts`; Jack, 19 Oct). Blank means none.

#### Scenario: A returns policy
- **WHEN** the owner types the shop's returns policy into Words at the bottom and moves on
- **THEN** it is saved, and the next receipt prints it

### Requirement: A shop sets its opening hours in Settings
Settings › Shop and sites › Opening hours SHALL show Monday to Sunday, each Open or Closed, an open day with its opening and closing times on the hour (`set-shop-hours`; Jack, 19 Oct). Each change SHALL save at once; a refusal SHALL be shown in plain words and the hours left as they were. They are one set for the whole business until shops have sites.

#### Scenario: Closing on Sundays
- **WHEN** the owner switches Sunday to Closed
- **THEN** it saves, and the diary and online booking treat Sunday as closed

#### Scenario: A shorter Saturday
- **WHEN** the owner sets Saturday to close at 16:00
- **THEN** it saves Saturday's own hours and leaves the other days as they were

### Requirement: Only the Owner changes settings, until roles are built
Until Managers and the "Can change settings" switch exist (WP-1.1), only the shop's Owner SHALL change the settings the Settings page saves (Jack, 19 Oct). Anyone else SHALL see "Settings aren’t part of your role" on the Settings page, and the server SHALL refuse their changes. Anyone signed in SHALL still read them, as the diary, till and booking need.

#### Scenario: A staff member types the Settings address
- **WHEN** Jo Taylor, who isn't the Owner, opens Settings
- **THEN** she sees "Settings aren’t part of your role" and no settings

#### Scenario: A change sent straight to the server
- **WHEN** a login that isn't the Owner sends a change to the workshop settings or shop details
- **THEN** the server refuses it and nothing changes

### Requirement: The time kept free each day is set in Settings
Settings › Workshop › Online booking SHALL hold "Time kept free each day" in hours, from 0 to 8 in half hours, saved when the box is left (`bk-settings-reserve`; Jack, 4 Sep and 19 Oct). Online booking SHALL treat a day as full once less than this is left.

#### Scenario: Three hours for a busy day
- **WHEN** the owner sets Time kept free each day to 3 and moves on
- **THEN** it saves as 180 minutes, and online booking treats a day with less than 3 hours free as full

### Requirement: The old app's Edit workshop screen is gone
The old app SHALL NOT have its own Edit shop › Workshop screen or menu item; Edit shop SHALL open on Front desk.

#### Scenario: The old menu item
- **WHEN** someone opens Edit shop in the old app, or an old link to its Workshop page
- **THEN** Front desk opens, and there's no Workshop item

### Requirement: The shop sets how long before a booking bikes come in
Settings › Workshop › Online booking SHALL hold "Drop off before the booking", in minutes, while bikes are booked in for a set time (Jack, 19 Oct). It SHALL save when the box is left.

#### Scenario: An hour before
- **WHEN** the owner sets Drop off before the booking to 60
- **THEN** a customer booked at 11:30 is told to drop off by 10:30, an hour before

### Requirement: The shop sets its notice in hours or days
Settings › Workshop › Online booking SHALL hold "Notice" as a number with hours or days (`bk-settings-notice-days`; Jack, 19 Oct), saved when changed.

#### Scenario: Switching to days
- **WHEN** the owner sets Notice to 1 and chooses days
- **THEN** it saves one day's notice, and the note says 1 day lets a customer book any time tomorrow

### Requirement: The shop changes how bikes are booked in from a day it chooses
Settings › Workshop › Online booking SHALL show whether bikes are booked in for a set time or the whole day. Choosing the other SHALL ask "Starting on" which day, tomorrow at the earliest, and save it as a coming change; bookings already made keep their shape (Jack, 24 Sep and 19 Oct). A coming change SHALL show with "Cancel the change".

#### Scenario: Changing to the whole day
- **WHEN** the owner chooses The whole day and picks Thursday 5 November
- **THEN** the section says "Changing to the whole day from Thu 5 Nov. Bookings already made keep their set times." with Cancel the change

#### Scenario: Changing their mind
- **WHEN** the owner presses Cancel the change
- **THEN** the coming change is removed and bikes stay booked in for a set time

### Requirement: The shop sets its drop-off window
While bikes are booked in for the whole day, Settings SHALL show the "Drop-off window", from and to, saved when changed (`bk-settings-whole-day`).

#### Scenario: An earlier window
- **WHEN** the owner sets the window to 08:30 to 10:00
- **THEN** it saves, and whole-day customers are told to drop off between 08:30 and 10:00
