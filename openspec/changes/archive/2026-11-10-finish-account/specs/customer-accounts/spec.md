# Spec Delta

Follows Jack's answers of 9 Nov (`docs/decisions/2026-11-09-account-answers.md`). Lines marked **[Q n]** follow a small default in `design.md` § Open questions, question n, for Jack to overrule.

## ADDED Requirements

### Requirement: A receipt opens from the account's history
A purchase with a receipt number SHALL open "Your receipt" from the account's history, with "[number] · [date] · [shop name]" under the title, and the receipt: the shop's details, the receipt's number, date and time, its lines, total, VAT and how it was paid (`ac-receipt`; account and reminders decision 1, audit L1). Such a row SHALL read "[date] · in the shop · receipt". A company customer's receipt SHALL be headed "Invoice".

#### Scenario: Maya opens a purchase
- **WHEN** Maya, signed in, chooses her purchase B1-0042 in her history
- **THEN** "Your receipt" opens with B1-0042, its date, North Street Cycles' details, the lines, the total and how she paid

#### Scenario: someone else's receipt
- **WHEN** a signed-in customer asks for a receipt that belongs to another customer or another shop
- **THEN** they are told "We can’t find that receipt" and see nothing of it

### Requirement: A sale without a receipt number doesn't open a receipt yet
A sale recorded without a receipt number, including the sale that paid for a repair, SHALL stay a row that opens no receipt, as today, until sales recorded that way are given receipt numbers (Jack, 9 Nov, answer 1). A repair's row SHALL still open its job's page.

#### Scenario: an older in-shop sale
- **WHEN** Maya's history has an in-shop sale recorded without a receipt number
- **THEN** its row shows what she bought and the total, and opens nothing

#### Scenario: a collected repair
- **WHEN** Maya's repair WH-1042 was collected and paid for
- **THEN** its row opens the repair's page, not a receipt

### Requirement: A repair's payment shows once
A sale that paid for a repair SHALL show on the repair's row only, not again as a purchase. [Q 8]

#### Scenario: WH-1042 paid at collection
- **WHEN** WH-1042 was paid for at collection
- **THEN** the history has one row for it, the repair

### Requirement: The receipt shows what was paid whatever the shop shows online
A receipt SHALL show its prices even when the shop has "Show prices online" off (Jack, 9 Nov, answer 5).

#### Scenario: prices hidden online
- **WHEN** North Street Cycles has Show prices online off and Maya opens a receipt
- **THEN** the receipt shows each line's price and the total

### Requirement: Email it to me
The receipt SHALL have one button, "Email it to me", with no download (answer 6). It SHALL send the receipt to the email on the customer's account, never to another address, then show "Sent to [email]" in place of the note "“Email it to me” sends it to [email]." (`ac-receipt-sent`). It SHALL send at most 5 receipts an hour for one customer, and refuse a request from another website. [Q 9]

#### Scenario: Maya emails her receipt
- **WHEN** Maya presses "Email it to me"
- **THEN** the receipt is emailed to maya@example.test and the pop-up says "Sent to maya@example.test"

#### Scenario: too many
- **WHEN** a customer has emailed 5 receipts in the last hour
- **THEN** the sixth is refused and nothing is sent

### Requirement: A receipt's address opens the account with that receipt
Opening the account at a receipt's own address SHALL open the account with that receipt in front, after the sign-in code when the customer isn't signed in (third walk answer 9).

#### Scenario: signed out
- **WHEN** Maya opens her receipt's address while signed out
- **THEN** she signs in with a code and her account opens with that receipt in front

### Requirement: The customer changes their name and mobile from the account
"Edit" beside Your details SHALL open a box with Name, Mobile and Email, Cancel and Save. A changed name or mobile SHALL save at once and show on the account and the shop's customer page. A badly formed mobile SHALL be refused as the booking refuses it; clearing the mobile SHALL be refused while job updates go by text or WhatsApp; a change from another website SHALL be refused (Jack, 9 Nov, answer 3).

#### Scenario: a new mobile
- **WHEN** Maya changes her mobile and saves
- **THEN** Your details shows the new number, and the shop's customer page shows it too

### Requirement: A new email is confirmed with a code before it replaces the old one
A changed email SHALL NOT be saved straight away: a six-digit code SHALL be sent to the new address, as for signing in, and the box SHALL ask for it. Only the right code SHALL make the new address the one she signs in with and gets messages at; until then the old address SHALL keep working. The box SHALL then say "Your email is now [new email]. Use it to sign in from now on." (answer 3).

#### Scenario: Maya changes her email
- **WHEN** Maya types a new email, saves, and enters the code sent to it
- **THEN** her account shows the new email, she signs in with it from then on, and the old one no longer signs in

#### Scenario: the code is never entered
- **WHEN** Maya asks for the change but never enters the code
- **THEN** her email stays as it was and still signs in

#### Scenario: a wrong code
- **WHEN** she enters a wrong code
- **THEN** she is told, as signing in tells her, and nothing changes

### Requirement: An email used by someone else can't be taken
A new email that already signs in to another account at the shop, or is another customer's own email there, SHALL be refused before any code is sent, with "That email is already used for another account at [shop]. Ask [shop] to help."

#### Scenario: another customer's address
- **WHEN** Maya types an email that another customer of North Street Cycles signs in with
- **THEN** she is refused with that line and no code is sent

### Requirement: The old address is told when the email changes
Once a new email is confirmed, the old address SHALL get one email saying the account's email is now the new one, with its middle hidden, and to call the shop if they didn't make the change. Devices already signed in SHALL stay signed in.

#### Scenario: Maya's old address
- **WHEN** Maya confirms her new email
- **THEN** her old address gets "Your email address has changed — North Street Cycles", naming the new one with its middle hidden and the shop's phone

### Requirement: The account links to the shop's privacy notice
When the shop has added a privacy notice, Your data SHALL show "Privacy notice", opening the shop's notice on its own page; with none, there SHALL be no link (Jack, 9 Nov, answer 2).

#### Scenario: the shop has a notice
- **WHEN** North Street Cycles has added its privacy notice and Maya chooses "Privacy notice"
- **THEN** a page shows the shop's words as written

#### Scenario: no notice yet
- **WHEN** the shop hasn't added one
- **THEN** Your data has no "Privacy notice" link
