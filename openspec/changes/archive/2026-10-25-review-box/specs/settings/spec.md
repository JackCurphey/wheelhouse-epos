# Spec Delta

## ADDED Requirements

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
