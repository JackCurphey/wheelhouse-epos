# Spec Delta

## ADDED Requirements

### Requirement: The Quick buttons fold lists the shop's buttons by group
Settings › Front desk › Till SHALL have a Quick buttons fold (`set-till-quick`). It SHALL show the shop's groups as pills with "+ Add a group", then the chosen group's buttons in the shop's order, each with its name, a line saying what it is and its price. Under the list SHALL be "+ Add a button" and "Buttons show on the till in this order." The fold's summary SHALL say how many buttons there are.

#### Scenario: The Workshop group
- **WHEN** Jack Lewis, the Owner, opens Quick buttons with Workshop chosen
- **THEN** he sees Standard service ("Labour · 60 min", £65.00), Fit & adjust brakes ("Labour · 30 min", £18.00) and Replace gear cable ("Labour", £12.00), in that order

### Requirement: Only the Owner changes quick buttons
Only the shop's Owner SHALL add, change, move or remove quick buttons and groups, until roles are built. Anyone signed in SHALL be able to read them, because the till shows them.

#### Scenario: Someone else is refused
- **WHEN** Jo Taylor, Staff, asks to add, change, move or remove a quick button
- **THEN** she is refused with the Owner-only message and nothing changes

### Requirement: Quick buttons are moved with a handle or the keyboard
Each button row SHALL have a 44px drag handle labelled "Move [name] — drag, or use the arrow keys" (owner setup decision 17). Dragging, or the up and down arrow keys on the handle, SHALL move the button and save at once, with "Saved" and Undo.

#### Scenario: Moving a button with the keyboard
- **WHEN** Jack moves to Replace gear cable's handle and presses the up arrow
- **THEN** it moves above Fit & adjust brakes, and "Saved" shows with Undo

### Requirement: The Owner adds a quick button from a product or service
"+ Add a button" SHALL open "Add a quick button", "To the [group] group" (`set-till-quick-add`). It SHALL have "Find a product or service", searching the shop's products on sale and active services; the picked item with its kind and price; "Name on the button", filled in with the item's name; the note "The price always comes from the product."; the group pills; Cancel; and "Add the button". The new button SHALL go last in its group.

#### Scenario: Adding brake pads
- **WHEN** Jack searches "brake pads", picks Shimano brake pads B05S-RX (Part, £28.00) and chooses "Add the button"
- **THEN** the box closes, "Saved · Shimano brake pads added to Workshop" shows with Undo, and the button is last in Workshop (`set-till-quick-saved`)

#### Scenario: Nothing picked
- **WHEN** Jack chooses "Add the button" without picking an item
- **THEN** the box stays open and says beside the search to pick a product or service

### Requirement: A quick button's price always comes from its item
A quick button SHALL never keep a price of its own. It SHALL always show, and the till SHALL always use, its product's or service's current price (owner setup decision 5).

#### Scenario: The price follows the product
- **WHEN** the brake pads' price is changed in Stockroom
- **THEN** their quick button shows the new price, with no change to the button

### Requirement: The Owner changes or removes a quick button
Hovering a row, right-clicking it or long-pressing it SHALL show Edit and an outlined Remove. Edit SHALL open the Add box filled in with the button's item, name and group, with "Save" in place of "Add the button". Remove SHALL take the button off at once, with "Saved" and Undo; Undo SHALL put it back where it was.

#### Scenario: Removing a button
- **WHEN** Jack chooses Remove on Fit & adjust brakes
- **THEN** it goes from the list, and Undo puts it back between Standard service and Replace gear cable

### Requirement: The Owner adds, renames and removes groups
"+ Add a group" SHALL ask for the group's name and add it as the last pill. A group's name SHALL be 1 to 20 characters and not the same as another of the shop's groups. A pill's menu SHALL offer Rename, Move and Remove. Removing a group that still has buttons SHALL say how many it has and ask first.

#### Scenario: A group name taken
- **WHEN** Jack adds a group called "Parts" and Parts already exists
- **THEN** it is refused beside the name, and no group is added

#### Scenario: Removing a group with buttons
- **WHEN** Jack removes Workshop, which has three buttons
- **THEN** he is asked first, told it has 3 buttons, and nothing is removed until he says yes

### Requirement: A button whose item is off sale
A product taken off sale or a service made inactive SHALL drop off the till. Its Settings row SHALL show "Not on sale" until it is removed or the item is back on sale.

#### Scenario: A service made inactive
- **WHEN** Fit & adjust brakes is made inactive in Workshop › Services
- **THEN** its row reads "Not on sale" and the till no longer shows it

### Requirement: Shops already using the app start with their services as quick buttons
When quick buttons arrive, each shop already using the app SHALL get a "Workshop" group holding its active workshop services, in their current order, so its till doesn't go blank (Jack's answer 1, `docs/decisions/2026-11-11-settings-rest-answers.md`).

#### Scenario: An existing shop
- **WHEN** a shop with active services Standard service and Fit & adjust brakes opens Quick buttons for the first time after the change
- **THEN** it sees a Workshop group with those two buttons, in the order the till showed them

### Requirement: A new shop has no quick buttons
A shop with no quick buttons SHALL see only "+ Add a group", "No quick buttons yet", "Add the things you sell most — they'll show on the till, one tap each." and "+ Add a button" (`set-till-empty`). The fold summary SHALL read "None yet".

#### Scenario: A new shop
- **WHEN** a newly signed-up shop's Owner opens Quick buttons
- **THEN** they see "No quick buttons yet" and "+ Add a button", and the summary reads "None yet"

### Requirement: The shop chooses when Close the day shows
Settings › Front desk › End of day SHALL have a Close the day fold (`set-eod-close`): "Show “Close the day” in the till bar" with At closing time, 30 minutes before and 1 hour before. It SHALL have the note "Owners and managers see it on every till from then on. Closing time comes from the opening hours." and "Change opening hours", which opens Office › Opening hours. The choice SHALL save at once, with "Saved" and Undo, and the summary SHALL name it.

#### Scenario: Choosing an hour before
- **WHEN** Jack chooses 1 hour before
- **THEN** "Saved" shows with Undo, the summary reads "1 hour before closing", and the till shows Close the day from an hour before today's closing time

### Requirement: Every shop starts on 30 minutes before closing
Every shop SHALL start on 30 minutes before closing: a new shop (owner setup decision 18), and each shop already using the app, which moves from the old fixed hour (Jack's answer 2, `docs/decisions/2026-11-11-settings-rest-answers.md`).

#### Scenario: A new shop
- **WHEN** a newly signed-up shop's Owner opens End of day
- **THEN** Close the day reads "30 minutes before closing"

#### Scenario: A shop already using the app
- **WHEN** a shop that had Close the day an hour before opens End of day after the change
- **THEN** Close the day reads "30 minutes before closing"

### Requirement: The shop chooses whether the cash is counted first
Settings › Front desk › End of day SHALL have a Counting the cash fold with one switch, "Count first", and the line "Count the cash before seeing what the till expects." It SHALL be on for a new shop (owner setup decision 6), and be one setting for the whole business, not per site (cash-up review, later change). Its summary SHALL read "Count first" when on and "Show the expected amount" when off. Only the Owner SHALL change it, until roles.

#### Scenario: Turning it off
- **WHEN** Jack turns Count first off
- **THEN** "Saved" shows with Undo, the summary reads "Show the expected amount", and the next Close the day shows the expected figure while counting

### Requirement: Ways to pay shows Cash as always on
The Ways to pay fold SHALL show a Cash card first, "Always on", with no switch (`set-pay-ways`). The fold summary SHALL name only the ways to pay that are built and on, Cash first, in the drawing's words ("Cash, card and 4 more"): "Cash", "Cash and store credit", "Cash, store credit and customer accounts". The Card, Gift cards and Deposits switches and Store credit's earn-back SHALL not show until the till pieces that use them are built (Jack's answer 3).

#### Scenario: Cash
- **WHEN** Jack opens Ways to pay
- **THEN** Cash shows first, reading "Always on", with nothing to switch

### Requirement: The shop lists its other ways to pay
Settings › Front desk › Payments SHALL have an Other ways to pay fold (`set-pay-other`) listing the shop's other ways to pay, each with its line and a borderless ✕ button named "Remove" and the way's name, as drawn (`setup.mjs` otherRow). Under the list SHALL be "Add another way to pay" with Add, and the note "These sit under “Other” at the bottom of Take payment, one tap away." Add and Remove SHALL save at once, with "Saved" and Undo. The summary SHALL name them as they are written, joined with commas, or read "None".

#### Scenario: Adding the shop's own
- **WHEN** Jack types "Bank transfer" and chooses Add
- **THEN** it is added at the end of the list, and "Saved" shows with Undo

#### Scenario: Removing one
- **WHEN** Jack chooses Remove on Payment link
- **THEN** it goes from the list, and Undo puts it back where it was

### Requirement: Other ways to pay changes nothing at the till yet
The Other ways to pay list SHALL be set up in Settings only. Take payment SHALL not change; it uses the list once Mark's Take payment work adds "Other" (Jack's answer 3, `docs/decisions/2026-11-11-settings-rest-answers.md`).

#### Scenario: Taking a payment after adding one
- **WHEN** Jack adds "Bank transfer" and then takes a payment at the till
- **THEN** Take payment offers the same ways to pay as before

### Requirement: A shop starts with the drawn other ways to pay
A shop SHALL start with Finance ("Recorded at the till; the finance company pays the shop"), Cycle to Work ("Recorded at the till against a Cycle to Work order") and Payment link ("Needs setting up with [payment provider] first"). A name SHALL be 1 to 30 characters and not the same as another on the list.

#### Scenario: The starting list
- **WHEN** Jack first opens Other ways to pay
- **THEN** he sees Finance, Cycle to Work and Payment link with their lines, and the summary reads "Finance, Cycle to Work, Payment link"
