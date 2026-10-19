## ADDED Requirements

### Requirement: Only the Owner changes settings, until roles are built
Until Managers and the "Can change settings" switch exist (WP-1.1), only the shop's Owner SHALL change the settings the Settings page saves (Jack, 19 Oct). Anyone else SHALL see "Settings aren’t part of your role" on the Settings page, and the server SHALL refuse their changes. Anyone signed in SHALL still read them, as the diary, till and booking need.

#### Scenario: A staff member types the Settings address
- **WHEN** Jo Taylor, who isn't the Owner, opens Settings
- **THEN** she sees "Settings aren’t part of your role" and no settings

#### Scenario: A change sent straight to the server
- **WHEN** a login that isn't the Owner sends a change to the workshop settings or shop details
- **THEN** the server refuses it and nothing changes
