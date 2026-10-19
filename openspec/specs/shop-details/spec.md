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
