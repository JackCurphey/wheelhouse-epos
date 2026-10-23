## ADDED Requirements

### Requirement: The shop sets when an uncollected bike is chased

Settings › Workshop › Collection SHALL hold two day counts, counted from when
the bike is marked ready: when the customer is reminded, and when the bike
shows on Today. The Today count SHALL be longer than the reminder's. New shops
start at 3 and 7 days.

#### Scenario: saving the day counts
- **WHEN** the Owner sets "Remind the customer after" to 4 and "Show it on Today after" to 10
- **THEN** both are saved and read back as 4 and 10

#### Scenario: Today's count not longer than the reminder's
- **WHEN** the Owner saves a Today count of 3 with a reminder count of 3
- **THEN** the save is refused with a plain reason and nothing changes

### Requirement: One "Bike still waiting" reminder

When a job's work is marked ready, Wheelhouse SHALL queue one "Bike still
waiting" message for the customer, to go after the reminder's day count, in
the shop's wording (Wheelhouse's: "Hi [Customer’s first name], just a
reminder that your [Bike] is ready to collect from [Shop name]. [What’s left
to pay]. See what we did: [Link to the job]. Job [Job number]. We’re open
[Opening hours]."). When it's due it SHALL go only if the bike is still in
the shop, the work still finished, the order not paid, and the message still
switched on; otherwise it SHALL be dropped. Reopening the work SHALL stop it.

#### Scenario: the reminder goes after the days set
- **WHEN** a job is marked ready and the bike is still in the shop after the reminder's days
- **THEN** the customer is sent "Bike still waiting" once, saying what's left to pay

#### Scenario: collected before it's due
- **WHEN** the bike is handed over before the reminder is due
- **THEN** the reminder is not sent

#### Scenario: the work reopened
- **WHEN** the work is reopened after it was marked ready
- **THEN** the waiting reminder is stopped

### Requirement: An uncollected bike on Today

Today's Needs attention SHALL list each bike ready and still in the shop for
longer than the Today day count, oldest first, with its job number, the
customer, when it was ready, the bike, when the reminder went and the
customer's phone. Contacted SHALL record who and when and take the line off;
the line SHALL go by itself when the bike is handed over. Only the Owner sees
it, until roles.

#### Scenario: a bike waiting longer than the Today count
- **WHEN** a bike has been ready for 8 days with a Today count of 7
- **THEN** Needs attention lists it with "ready since" its day and the customer's phone

#### Scenario: Contacted
- **WHEN** the Owner presses Contacted on the line
- **THEN** who and when are recorded and the line is no longer listed

#### Scenario: reopened and finished again
- **WHEN** a contacted bike's work is reopened and marked ready again
- **THEN** its days count from the new ready time and it can be listed again
