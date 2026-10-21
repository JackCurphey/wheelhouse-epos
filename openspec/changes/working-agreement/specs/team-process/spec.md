## ADDED Requirements

### Requirement: Whoever starts a piece of work finishes it
A piece of work SHALL be owned from drawing to server to screen by the person who starts it, and either person SHALL be able to pick up or fix any file.

#### Scenario: Picking up a piece
- **WHEN** Jack needs a server change for a screen he is building
- **THEN** he makes it himself, in the same change, without waiting for the other person

### Requirement: Risky areas get a second look after merging
Changes to migrations, money and stock, sign-in, customer accounts and public routes, and `server.js` and the messaging core SHALL be reviewed with `/review` by the author and listed in the weekly digest issue; the other person comments there, and merging SHALL NOT wait for it.

#### Scenario: A migration merges
- **WHEN** the author's `/review` is clean and CI is green
- **THEN** the pull request merges and appears in that week's digest

### Requirement: Checks guard the known gaps
CI SHALL fail when a settings route is missing its Owner-only check, when two payments of one order or two sales of one unit both succeed, and when a new screen has no browser test against the real server.

#### Scenario: A new settings route without the Owner check
- **WHEN** a pull request adds a settings route that any staff login can call
- **THEN** the Owner-only route list test fails
