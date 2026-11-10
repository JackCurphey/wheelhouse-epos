# Spec Delta

## Purpose

Store credit and pay-later accounts on a customer's page: what a customer holds or owes, every change to it with who and why, the account's limit and statement, bank transfers that pay it off outside the till, and the Ways to pay switches that turn each on.

Jack answered the main questions on 9 Nov (`docs/decisions/2026-11-09-answers.md`). Lines marked **[Q n]** follow a small default in `design.md` § Open questions, question n, for Jack to overrule.

## ADDED Requirements

### Requirement: Ways to pay switches store credit and customer accounts on or off
Settings › Front desk › Payments SHALL have a "Ways to pay" section with a Store credit row ("Earned back on sales, and given on refunds without a receipt") and a Customer accounts row ("Pay later, settled from the customer's page") with "Most a customer can owe" ("For everyone. Change it for one customer on their page."). Only the Owner SHALL change them; a new shop starts with both off. [Q 11]

#### Scenario: The Owner turns customer accounts on
- **WHEN** Jack Lewis switches Customer accounts on and types [£ limit] as Most a customer can owe
- **THEN** both save as he goes, the section's summary counts it, and every customer page shows "Owes on account"

#### Scenario: Not the Owner
- **WHEN** Jo Taylor (Staff) opens Ways to pay
- **THEN** she sees the settings but cannot change them, and the server refuses a change from her

### Requirement: The customer page shows only the money the shop has switched on
With Store credit off, the customer page SHALL show no Store credit line, no store credit history rows and no way to add or take credit; with Customer accounts off, no "Owes" chip, no "Owes on account" line and no Account pop-up (`cs-page-off`). Money already held or owed SHALL be kept and SHALL show again when switched back on.

#### Scenario: Customer accounts switched off
- **WHEN** Customer accounts is off and Store credit is on
- **THEN** Maya Patel's At a glance shows "Store credit [£]" and "Happy to hear about offers", with no "Owes on account"

#### Scenario: Customer accounts can't be switched off while money is owed
- **WHEN** the Owner switches Customer accounts off while any customer owes on account
- **THEN** it stays on and says how many customers still owe and how much in all [Q 11]

### Requirement: Store credit on the customer page
With Store credit on, At a glance SHALL show "Store credit [£]", the customer's balance in pounds and pence, opening the store credit pop-up. A customer who has never had any SHALL show £0.00.

#### Scenario: Maya holds store credit
- **WHEN** Maya Patel holds store credit
- **THEN** her At a glance shows "Store credit" with the amount, and the whole row opens "Maya Patel's store credit"

### Requirement: Staff add or take away store credit with a reason
The store credit pop-up (`cs-credit`) SHALL show "Has [£] now", Add credit or Take some away, an Amount and a Reason ("Other…" to type one, and the shop's reasons as pills once Till › Reasons has a Store credit list) [Q 9], "The change and its reason show in her history and in the reports.", Cancel and "Add the credit" (or "Take it away" [Q 8]). Any staff member SHALL be able to do it (customer service decision 10: "like a discount").

#### Scenario: Jo adds credit
- **WHEN** Jo Taylor adds [£] with a reason
- **THEN** Maya's balance goes up by that amount and her history shows "Store credit added · [reason] · by Jo Taylor" with "+[£]"

#### Scenario: Taking away more than she has
- **WHEN** Jo tries to take away more than Maya holds
- **THEN** nothing changes and the pop-up says she has only [£]

#### Scenario: No reason
- **WHEN** Jo presses Add the credit without a reason
- **THEN** nothing changes and the pop-up asks for one

#### Scenario: Not a sensible amount
- **WHEN** the amount is empty, zero, negative or more than two decimal places
- **THEN** nothing changes and the pop-up says "Pounds and pence, like 5.00"

### Requirement: Every store credit change is kept
Every change to a customer's store credit SHALL be kept as its own entry, with the amount in whole pence, what kind of change it was, its reason, who made it and when; a balance SHALL be the sum of its entries and SHALL never go below zero. Entries SHALL never be edited or removed, so the history and the reports can show them.

#### Scenario: Two changes at the same moment
- **WHEN** two tills take away store credit from Maya at the same moment and together it is more than she holds
- **THEN** one goes through and the other is refused, and her balance never goes below zero

### Requirement: Store credit follows a merge
When two customer records are merged, the store credit and money owed of the record merged away SHALL move to the one kept, and SHALL move back if the merge is undone. [Q 13]

#### Scenario: Merging Maya P. into Maya Patel
- **WHEN** "Maya P." holding [£] store credit is merged into Maya Patel
- **THEN** Maya Patel's balance includes it, and undoing the merge gives it back to Maya P.

### Requirement: What a customer owes on account
With Customer accounts on, At a glance SHALL show "Owes on account [£ owed]" opening the Account pop-up, and an "Owes [£]" chip SHALL sit beside the customer's name whenever they owe anything. Over their limit, the chip SHALL be in the warning colour and read "Over her limit by [£]" (`cs-page-over`).

#### Scenario: Maya owes on account
- **WHEN** Maya owes on account within her limit
- **THEN** her page shows the "Owes [£ owed]" chip and "Owes on account [£ owed]"

#### Scenario: Over her limit
- **WHEN** what Maya owes is more than her limit
- **THEN** the chip reads "Over her limit by [£]" in the warning colour

#### Scenario: Owes nothing
- **WHEN** Maya owes nothing
- **THEN** there is no chip, and At a glance shows "Owes on account £0.00"

### Requirement: Who can pay later
Only a customer the Owner has given an account SHALL be able to owe on account; the Account pop-up of someone without one SHALL offer the Owner "Give [name] an account" at the shop's limit (Jack, 9 Nov, answer 2).

#### Scenario: Giving Maya an account
- **WHEN** Jack Lewis gives Maya Patel an account
- **THEN** her Account pop-up shows Owes now £0.00 and Most Maya can owe at the shop's limit

#### Scenario: Staff can't give one
- **WHEN** Jo Taylor opens the Account pop-up of a customer without an account
- **THEN** she sees that only the shop's owner can give someone an account

### Requirement: Money owed from before Wheelhouse
The Owner SHALL be able to enter, once per customer, what they already owed on account when the shop started using Wheelhouse; it SHALL show on the statement as "Owed from before Wheelhouse · [date]" with +[£] (Jack, 9 Nov, answer 5).

#### Scenario: A club's balance carried over
- **WHEN** Jack Lewis enters [£ owed] as what [Club name] owed before Wheelhouse
- **THEN** they owe that much, the statement starts with that line, and the Owner can't enter a second one

### Requirement: The Account pop-up
The Account pop-up (`cs-account`) SHALL show "[name]'s account · Pay later, settled from here", Owes now, "Most [name] can owe" with "A manager can change it · the shop's is [£ limit]", the Statement, "Email the statement", "Record a bank transfer" and Close. "Take a payment at the till" SHALL come with the till's half, not here (Jack, 9 Nov, answer 1). [Q 20]

#### Scenario: Maya's account
- **WHEN** Jo opens Maya's account
- **THEN** she sees what Maya owes, her limit, and the statement newest first

### Requirement: One customer's own limit
A customer SHALL owe up to the shop's "Most a customer can owe" unless given their own limit; only the Owner SHALL change a customer's own limit (the drawing's "a manager", until there are Managers), and SHALL be able to put it back to the shop's. Staff SHALL see it read-only.

#### Scenario: A club's higher limit
- **WHEN** Jack Lewis gives [Club name] a limit of [£ limit] on their account
- **THEN** their pop-up shows it and the shop's limit underneath, and changing the shop's limit later doesn't change theirs

#### Scenario: Staff see it only
- **WHEN** Jo opens the pop-up
- **THEN** the limit is shown without a way to change it, and the server refuses a change from her

### Requirement: The statement
The statement SHALL list every entry on the account, newest first: "Sale on account · [receipt]" with +[£], "Paid by bank transfer · [reference]" with −[£], "Owed from before Wheelhouse" with +[£], and undoings, each with its date, and SHALL end with what is owed now. [Q 12]

#### Scenario: A transfer on the statement
- **WHEN** a bank transfer has been recorded for Maya
- **THEN** her statement shows "Paid by bank transfer · [reference]" on the day it arrived with −[£], and Owes now is that much less

### Requirement: Emailing the statement
"Email the statement" SHALL email the customer their statement and what they owe, to the "Send invoices to" address for a company when it has one, otherwise their email. With no email it SHALL say so instead of sending. It SHALL go through the shop's email sender, pretend until the shop's real email is connected.

#### Scenario: Maya's statement emailed
- **WHEN** Jo presses Email the statement on Maya's account
- **THEN** one email is queued to maya@example.test with her statement, and the pop-up says it was sent

#### Scenario: No email
- **WHEN** the customer has no email
- **THEN** nothing is sent and the pop-up says there's no email to send it to

### Requirement: Recording a bank transfer
"Record a bank transfer" (`cs-transfer`) SHALL show "For money that didn't come through the till", Amount filled with everything owed ("Everything she owes — change it if she paid part."), "Date it arrived" (today, never in the future), Reference, "It comes off what Maya owes. It isn't counted in the till's takings, so cash-up isn't affected.", Cancel and "Record it". Any staff member SHALL be able to record one.

#### Scenario: A club pays by transfer
- **WHEN** Jo records a transfer of what Maya owes, arrived today, with a reference
- **THEN** Maya owes £0.00, the statement shows "Paid by bank transfer · [reference]", and the pop-up closes

#### Scenario: Paying part
- **WHEN** Jo changes the amount to less than Maya owes
- **THEN** Maya owes the rest

#### Scenario: More than she owes
- **WHEN** the amount is more than Maya owes
- **THEN** nothing is recorded and the pop-up says she owes only [£] [Q 14]

### Requirement: A bank transfer never reaches the till's takings
A recorded bank transfer SHALL never count in a till's takings, the day's close, the cash count or the float, on the day it is recorded or the day it arrived.

#### Scenario: Closing the day after a transfer
- **WHEN** a transfer of [£] is recorded on Till B1's day and the day is closed
- **THEN** the close's takings, card, cash and other are what they would have been without it

### Requirement: Putting a mistaken entry right
The Owner SHALL be able to undo a bank transfer or a store credit change from the statement or the history, with a reason; the undo SHALL be its own entry, and both SHALL stay visible. [Q 14]

#### Scenario: A transfer recorded twice
- **WHEN** Jack Lewis undoes the second of two identical transfers with the reason "Recorded twice"
- **THEN** Maya owes what she did before it, and the statement shows both the transfer and its undoing
