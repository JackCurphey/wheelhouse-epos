## ADDED Requirements

### Requirement: A shop keeps the words for the bottom of its receipts
Settings › Till › Receipts SHALL hold "Words at the bottom", such as a returns policy or a thank-you, saved when the box is left (`set-till-receipts`; Jack, 19 Oct). Blank means none.

#### Scenario: A returns policy
- **WHEN** the owner types the shop's returns policy into Words at the bottom and moves on
- **THEN** it is saved, and the next receipt prints it
