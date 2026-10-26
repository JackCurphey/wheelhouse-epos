## ADDED Requirements

### Requirement: A signed-in customer changes how the shop contacts them

The account SHALL have "Change" beside "How we contact you", opening a box where job updates go by Text, WhatsApp or Email and Service reminders, Review requests and Offers and news switch on or off. Each change SHALL save at once and say what changed. Text or WhatsApp SHALL be refused with no mobile number on record. A change from another website SHALL be refused.

#### Scenario: switching off service reminders
- **WHEN** Maya switches Service reminders off
- **THEN** it saves at once, the box says "Service reminders are off", and her account shows Service reminders Off

#### Scenario: no mobile number
- **WHEN** a customer with no mobile number chooses Text
- **THEN** it is refused with "We don’t have a mobile number for you, so we can’t text you." and nothing changes

### Requirement: The stop page points to the account

Once something is stopped, the stop page SHALL say "Want to change anything else? Sign in to your account and go to “How we contact you”.", with "Sign in to your account" leading to the shop's sign-in, then the account.

#### Scenario: after stopping reminders
- **WHEN** Maya stops service reminders from a link
- **THEN** the page offers "Sign in to your account", which returns her to her account once signed in
