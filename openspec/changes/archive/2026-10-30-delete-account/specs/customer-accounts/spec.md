## ADDED Requirements

### Requirement: A customer asks the shop to delete their account
A signed-in customer SHALL be able to ask the shop to delete their account from Your data, after a pop-up saying what goes and what stays. The request SHALL be recorded once, from their account, and show on the account with when they asked and when it will be done by (one month on), with "Cancel my request". A bike still in the workshop SHALL NOT stop them asking; the pop-up SHALL say the deletion waits until it has been collected.

#### Scenario: Maya asks
- **WHEN** Maya Patel presses "Ask us to delete your account" and then "Ask to delete"
- **THEN** "Request sent" says North Street Cycles will delete her account by [date] at the latest, and her account shows "You asked us to delete your account on [date]. We’ll finish by [date]." with "Cancel my request"

#### Scenario: Her bike is still in the workshop
- **WHEN** her Trek Domane AL 3 is in the workshop as WH-1042 and she asks
- **THEN** the pop-up says "We’ll delete your account once your bike has been collected." and she can still ask

#### Scenario: Asking twice
- **WHEN** she asks again, or two asks arrive at once
- **THEN** there is still one request

### Requirement: Cancel my request
While the shop hasn't yet deleted their details, the customer SHALL be able to cancel their request from the account, which then says "Request cancelled — your account stays as it is." Once the shop has deleted their details, there is no account left to cancel from.

#### Scenario: Maya changes her mind
- **WHEN** Maya presses "Cancel my request"
- **THEN** the request is cancelled, leaves the shop's list, and her account says "Request cancelled — your account stays as it is."
