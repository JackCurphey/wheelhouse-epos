# Spec Delta

## Purpose

Accounts software lets a shop's owner have each closed day go to Xero or QuickBooks as one summary, choose once which account each line goes to, see what was sent, and be told when a day couldn't go. Built behind an adapter with a pretend service until Jack says yes to a real account.

## ADDED Requirements

### Requirement: Accounts software is the Owner's
Settings › Your data › Accounts software SHALL be shown to the shop's Owner only, and its routes SHALL refuse anyone else with "Only the shop's owner can connect accounts software" until roles are built (WP-1.1). It SHALL show only the signed-in shop's connection, choices and sends.

#### Scenario: the Owner opens it
- **WHEN** Jack Lewis, the Owner, opens Settings › Your data
- **THEN** he sees an "Accounts software" fold, with "Not connected" while nothing is connected

#### Scenario: someone else is refused
- **WHEN** Jo Taylor, Staff, asks for the connection or its choices
- **THEN** she is told "Only the shop's owner can connect accounts software" and nothing is sent

### Requirement: Connecting, with a pretend service
The fold SHALL offer "Connect Xero" and "Connect QuickBooks" with the note "Each closed day goes across as one summary per shop: sales by account, the VAT, the money taken by how it was paid. Only the owner can connect." and "Not using either? "Download everything" above has the same daily figures to import." Until Jack says yes to a real account, connecting SHALL be made with a pretend service that keeps what it is sent in Wheelhouse's own records and makes no outside call. Once connected it SHALL show "Connected to Xero", "by Jack Lewis on [date]" and "Disconnect Xero".

#### Scenario: connecting Xero
- **WHEN** Jack chooses Connect Xero
- **THEN** the fold reads "Connected to Xero · by Jack Lewis on [date]", with the account choices below it

#### Scenario: no real account is touched
- **WHEN** a shop connects
- **THEN** no request leaves Wheelhouse and the pretend service holds what is sent

### Requirement: Which account each line goes to
Once connected, the fold SHALL list, each with a choice of account, "Sales go to" (each category), "Money taken goes to" (Cash, Card, Customer accounts, Gift cards, and "Online sales (paid on the website)") and "Everything else goes to" (Cash differences, Refunds, Discounts given, VAT on sales), with the note "VAT on sales goes to one Xero account for every rate. Check these choices with your accountant before the first day is sent." A line with no account chosen SHALL be marked "No Xero account chosen — days with [line] sales can't be sent" beside its choice, in words as well as the warning colour. Choices SHALL be kept when disconnecting.

#### Scenario: choosing an account
- **WHEN** Jack chooses an account for Cash
- **THEN** it is saved at once and the next day with Cash sales uses it

#### Scenario: a line with no account
- **WHEN** Accessories has no account chosen
- **THEN** its choice shows "No Xero account chosen — days with Accessories sales can't be sent" with the choice bordered in the warning colour

### Requirement: Each closed day is sent once, as one summary
When a day is closed and the shop is connected, Wheelhouse SHALL send one summary for the shop: the day's sales by category before VAT, the VAT, the money taken by how it was paid, and the cash difference, refunds and discounts given where they are recorded, each to the account chosen for it. The summary SHALL be worked out from the sales that close counted, SHALL balance, and SHALL be kept as it was sent. A day SHALL never be sent twice.

#### Scenario: Tuesday's close
- **WHEN** Tuesday 15 September is closed and every line it uses has an account
- **THEN** one summary for Tuesday goes across and the log shows "Sent at [time] · £[£]" with a Sent badge

#### Scenario: online sales go to their own account
- **WHEN** a day had £[£] paid on the website
- **THEN** it goes to the account chosen for "Online sales (paid on the website)", apart from Card

#### Scenario: a line Wheelhouse doesn't record yet
- **WHEN** a day has refunds, discounts given, or sales from the old record whose VAT isn't recorded
- **THEN** the day is sent with what is recorded, and its entry in the log says each missing line is "not recorded" for the accountant to fill in

#### Scenario: a summary that doesn't balance
- **WHEN** a day's lines don't add up
- **THEN** it is not sent and shows as Not sent with what is wrong

### Requirement: What was sent
The fold SHALL list each closed day, newest first: "Sent at [time] · £[£]" with a Sent badge; "Closed at [time] · [Category] has no Xero account chosen" with "Choose an account for [Category]"; "Not closed yet" with its badge; and, when disconnected, "Closed at [time] · sends when Xero is reconnected" with a Waiting badge, and, on a day sent with lines Wheelhouse doesn't record yet, "not recorded" beside each such line (refunds, discounts given, VAT of old-record sales), under the note "Each day goes once all that shop's tills are closed. A day that's reopened is corrected when it closes again."

#### Scenario: a day that can't go
- **WHEN** Wednesday 16 September was closed with Accessories sales and Accessories has no account
- **THEN** the list shows "Wed 16 Sep · Bolton", "Closed at [time] · Accessories has no Xero account chosen" and "Choose an account for Accessories"

#### Scenario: choosing the missing account sends the day
- **WHEN** Jack chooses the account for Accessories
- **THEN** Wednesday goes across and its row reads "Sent at [time] · £[£]"

### Requirement: When the connection is lost
When Xero stops answering Wheelhouse (a refused or expired connection), the fold SHALL say "Xero disconnected on [date]. Nothing has been sent since. Reconnect and the waiting days go across." with Reconnect, and SHALL keep each day closed since as Waiting. Reconnecting SHALL send the waiting days, oldest first, each once.

#### Scenario: reconnecting
- **WHEN** Jack chooses Reconnect Xero after two days have waited
- **THEN** both days go across, oldest first, and their rows read Sent

### Requirement: Disconnecting
"Disconnect Xero" SHALL open a box headed "Disconnect Xero?" ("North Street Cycles, every shop") saying "Days already sent stay in Xero. Nothing more is sent until you connect again — the daily figures are still in "Download everything"." and "Your account choices are kept in case you reconnect.", with "Keep connected" and "Disconnect". Disconnecting SHALL send nothing and SHALL keep the choices.

#### Scenario: disconnecting
- **WHEN** Jack chooses Disconnect
- **THEN** the fold reads "Not connected", the days already sent stay in the log, and his choices are still there if he connects again

### Requirement: A reopened day is corrected, not added to
When a reopened day is closed again, Wheelhouse SHALL replace the summary it sent for that day with the new one, so the accounts software never holds both. While a day is reopened nothing SHALL be sent for it.

#### Scenario: Wednesday reopened and closed again
- **WHEN** Wednesday was sent, then reopened, then closed again with a different count
- **THEN** Wednesday's summary in the accounts software is replaced by the new one, once
