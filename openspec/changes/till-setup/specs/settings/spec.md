# Spec Delta

## ADDED Requirements

### Requirement: Settings › Till › Tills offers "Make this computer a till"
For the Owner, Settings › Front desk › Till SHALL have a Tills section after Receipts, summarised by the shop's tills ("Till B1") or "None yet", with the drawn note and "Make this computer a till", which opens Set up this till (`set-till-tills-owner`; stage-1 gaps 4). The button SHALL not show on a computer that is already a till, nor for a business with no site yet.

#### Scenario: Jack sets up the first till
- **WHEN** Jack Lewis opens Settings › Till › Tills on the shop's counter computer
- **THEN** he sees "Make this computer a till", which opens Set up this till

#### Scenario: Already a till
- **WHEN** the computer is Till B1
- **THEN** Tills reads "Till B1" and there is no "Make this computer a till"
