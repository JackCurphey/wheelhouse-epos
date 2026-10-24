## ADDED Requirements

### Requirement: A held Bike ready waits for Send now on the job page

When Bike ready is held (the person marking the job ready has Don't close
things by themselves on), the job page SHALL say "[name] marked it ready at
[time]. “Bike ready” to [first name] by [way] is waiting until you press Send
now." with Send now and Undo, and nothing on a timer (`job-finished-wait`).
Send now SHALL send it and the strip SHALL then say "“Bike ready” sent to
[first name] by [way] · [time]" with no buttons (`job-finished-sent`). Undo
SHALL stop it, as it does in its minute. The strip SHALL show again whenever
the job is opened while Bike ready is held.

#### Scenario: Send now
- **WHEN** Jo, with the switch on, marks Maya's job ready and presses Send now
- **THEN** the strip says "“Bike ready” sent to Maya by text · [time]" and has no buttons

#### Scenario: Reopened later
- **WHEN** Jo closes the job before pressing either and opens it again
- **THEN** the waiting strip, with Send now and Undo, is still there

#### Scenario: The Messages list
- **WHEN** Jo opens the job's Messages while Bike ready is held
- **THEN** it says Bike ready is waiting until Send now
