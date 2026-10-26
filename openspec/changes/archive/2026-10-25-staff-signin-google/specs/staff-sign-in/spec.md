# Spec Delta

## MODIFIED Requirements

### Requirement: Opening the staff app signed out goes straight to sign-in
Opening any staff app page while not signed in, with no session that has run out and no message to show, SHALL show Wheelhouse's own sign-in screen, "Sign in to Wheelhouse", with "Continue with Google" and "Sign in with email". After signing in either way, the person SHALL be on the page they opened.

#### Scenario: a bookmark to the diary
- **WHEN** someone not signed in opens a bookmark to the diary
- **THEN** they see "Sign in to Wheelhouse", and after signing in they are on the diary

## ADDED Requirements

### Requirement: Continue with Google goes straight to Google
"Continue with Google" on Wheelhouse's sign-in screen SHALL go straight to Google's account chooser, without WorkOS's sign-in page in between. "Sign in with email" SHALL go to WorkOS's page for email and password. Either way, the same staff-list and checked-email rules decide who is let in.

#### Scenario: Jo signs in with Google
- **WHEN** Jo presses "Continue with Google" and chooses her Google account, whose email North Street Cycles has for her
- **THEN** she is back in Wheelhouse, signed in to North Street Cycles, without having seen WorkOS's page

### Requirement: Sign in again leads to Wheelhouse's sign-in screen
"Sign in again" on "You've signed out" and "Please sign in again", and the button on a failed sign-in's message, SHALL lead to Wheelhouse's sign-in screen. From "Please sign in again", the person SHALL still come back to the page they were on.

#### Scenario: after signing out
- **WHEN** Jo presses "Sign in again" on "You've signed out"
- **THEN** she sees "Sign in to Wheelhouse"
