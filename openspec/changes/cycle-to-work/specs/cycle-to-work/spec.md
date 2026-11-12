## ADDED Requirements

### Requirement: A Cycle to Work order moves through six stages
A Cycle to Work order SHALL be its own kind of order, with one of six stages in this order: "Quote given", "Waiting for the certificate", "Certificate received", "Ready to collect", "Collected", "Paid by the provider". It SHALL move forward only through the steps this spec names, and SHALL also be able to end cancelled or closed with a reason.

#### Scenario: A new order starts at Quote given
- **WHEN** staff press "Make the quote" on a new order
- **THEN** the order is at "Quote given" and its quote has a quote number

#### Scenario: A stage can't be skipped
- **WHEN** a request asks to mark an order at "Waiting for the certificate" as Collected
- **THEN** the server refuses it and the order's stage is unchanged

### Requirement: Every step is kept in What's happened
Each order SHALL keep one growing list, "What's happened", of every step taken on it: what happened, who did it and when, and the reason for any step that needs one. Nothing in the list SHALL be edited or removed.

#### Scenario: A step adds a line
- **WHEN** Jo Taylor adds the certificate to Maya Patel's order
- **THEN** "What's happened" gains a line saying the certificate was added, by Jo Taylor, with the time

### Requirement: The Cycle to Work list is grouped by stage
Front desk › Cycle to Work SHALL list the open orders grouped under "Waiting for the certificate", "Certificate received", "Ready to collect", "Collected · waiting for payment" and "Paid · last 30 days", each row with the button for its next step: "Add the certificate", "Order from [supplier]", "Hand over", "Mark paid" or "Choose".

#### Scenario: An order shows under its stage
- **WHEN** Maya Patel's order is at "Ready to collect"
- **THEN** it is listed under "Ready to collect" with "Hand over"

### Requirement: The list's top line says what needs doing
The list SHALL start with a line naming what needs acting on, in the drawn words: "[n] hold ending soon" or "[n] hold ended — choose", "[n] bike ready to order", "[n] payment late", and the quotes with no certificate after the days set in Settings (decision M3). For someone who can see costs it SHALL also say "Owed by providers £[£] · [n] late" (decision M6).

#### Scenario: Staff don't see the owed total
- **WHEN** Jo Taylor, who can't see costs and margin, opens the list
- **THEN** the top line has no "Owed by providers" total

### Requirement: The sidebar shows how many orders need acting on
Cycle to Work in the Front desk sidebar SHALL show a count of the orders that need someone to act: holds ending, bikes ready to order, quotes with no certificate after the days set, and payments late (decision M3), each order counted once.

#### Scenario: A hold ending adds to the count
- **WHEN** one hold ends within the reminder days and nothing else needs acting on
- **THEN** the sidebar shows 1 beside Cycle to Work

### Requirement: The first use asks for providers before the first quote
With no orders and no scheme providers, the list SHALL show "No Cycle to Work orders yet" and "No scheme providers yet. Add the providers your customers use, with their terms, before the first quote." with "Add providers" and "Set how bikes are held and ordered".

#### Scenario: A quote can't be made without a provider
- **WHEN** the shop has no scheme providers
- **THEN** "+ New Cycle to Work order" leads to adding providers first

### Requirement: A new order makes the quote
"+ New Cycle to Work order" SHALL ask for Customer, Scheme provider, Bike and Accessories (optional), with "Hold the bike until [date]" ticked by default from Settings and "Email the quote to [email] now". "Make the quote" SHALL create the order and its quote; a new customer can be added from here.

#### Scenario: The bike line says what's free
- **WHEN** a bike is picked with one free at Bolton
- **THEN** the Bike field says "1 free at Bolton · none held"

#### Scenario: A bike nowhere in stock
- **WHEN** a bike is picked that no site has
- **THEN** the Bike field says "None at Bolton or [Second site] · from [supplier], about [n] days" and no hold tick is shown

### Requirement: The quote is a printable and emailable document
The quote SHALL show the shop's logo placeholder, name, address, phone and VAT number; "Cycle to Work quote", the quote number, "Given [date]" or "Revised [date]", "Valid until [date]", the customer and scheme provider; the items with prices and "Total (includes VAT)"; a closing paragraph built from the order; and "How to apply:" with the shop's own words from Settings.

#### Scenario: The closing paragraph follows the order
- **WHEN** the bike is held until a date
- **THEN** the quote says "We're holding your bike until [date]. This quote is valid until [date]. Once your certificate reaches us, it's yours to collect."

#### Scenario: The quote is never invented
- **WHEN** the shop has no logo file
- **THEN** the quote shows the logo placeholder and no made-up mark

### Requirement: The order page shows Who pays what and the next step
The order page SHALL show "[Customer] · Cycle to Work", "Quote [quote number] · [shop]", "Email the quote again", "Print the quote" and "More…"; the Who pays what rows ("Order total", "[Provider] pays (the certificate)", "[Customer] pays at collection"); the buttons for its stage's next step; and "What's happened".

#### Scenario: A held order offers the hold steps
- **WHEN** an order at "Quote given" has a held bike
- **THEN** its page offers "Add the certificate", "Hold longer" and "Release the bike"

### Requirement: A bike in stock is held from the quote
With "Hold the bike until [date]" ticked, making the quote SHALL hold one frame of that bike for the order until that date. From the certificate on, the hold SHALL be firm, with no end date. "Don't hold this one" (unticking) SHALL make the order without a hold.

#### Scenario: The held frame is linked to the order
- **WHEN** the quote is made with the hold ticked
- **THEN** one frame of that bike is held for Maya Patel's order until the date shown

### Requirement: A hold is never released without someone choosing
When a hold reaches its reminder day, the order SHALL show "[Customer]'s hold ends on [date]" with "Hold longer" and "Release the bike". When the date passes, the bike SHALL stay held and the order SHALL say "hold ended [date] — choose" until someone chooses.

#### Scenario: A hold passes its end date
- **WHEN** the hold's end date passes and nobody has chosen
- **THEN** the frame is still held and the list shows "1 hold ended — choose"

#### Scenario: Releasing the bike
- **WHEN** staff press "Release the bike"
- **THEN** the frame is free to sell, the order stays open at its stage, and "What's happened" says who released it

### Requirement: Marking the order as applied
"Mark as applied" SHALL move an order at "Quote given" to "Waiting for the certificate".

#### Scenario: The customer has applied
- **WHEN** staff press "Mark as applied"
- **THEN** the order is at "Waiting for the certificate"

### Requirement: A bike not in stock is ordered by the shop's rule
For a bike not in stock, the order SHALL show "Order from [supplier]" once the shop's ordering rule allows it: "Once the certificate arrives" or "Once the customer has applied". Ordering SHALL add the bike to a supplier order in Deliveries, linked to this order, with Undo.

#### Scenario: Ordering once the certificate arrives
- **WHEN** the rule is "Once the certificate arrives" and the certificate is added
- **THEN** the order offers "Order from [supplier]" and the list counts "1 bike ready to order"

### Requirement: Order now anyway needs a reason
"Order now anyway…" SHALL order the bike before the rule allows it, only with a reason typed in, and SHALL record the reason and who did it in "What's happened".

#### Scenario: No reason, no order
- **WHEN** "Order now anyway…" is sent with an empty reason
- **THEN** the server refuses it and nothing is ordered

### Requirement: Adding the certificate
"Add the certificate" SHALL ask for Certificate number, Amount on the certificate and Received, and SHALL move the order to "Certificate received". A tick, "The bike is ready — tell [Customer] she can collect it", SHALL move it straight on to "Ready to collect".

#### Scenario: The certificate matches the order
- **WHEN** the amount on the certificate equals what the provider pays
- **THEN** the order is at "Certificate received" and its hold is firm

### Requirement: A certificate for a different amount offers the drawn choices
When the amount on the certificate is less than the order, the box SHALL offer "Change the order to match" or "Keep the order; [Customer] pays the £[£] difference". When it is more, it SHALL offer "Keep the order as quoted" or "Change the order to match".

#### Scenario: Less than the order
- **WHEN** the certificate is for less and staff choose "Keep the order; Maya pays the £[£] difference"
- **THEN** Who pays what shows Maya paying that difference at collection

### Requirement: A late certificate warns about the price
When the certificate arrives after the quote's "Valid until" date, the box SHALL say "Quote ran out on [date] — check the price."

#### Scenario: After the quote ran out
- **WHEN** the certificate is added after the valid-until date
- **THEN** the box shows "Quote ran out on [date] — check the price."

### Requirement: A certificate after the bike was released
When the certificate arrives for an order whose bike was released, the box SHALL say so and the order SHALL hold a free frame if there is one, or follow the ordering rule if not.

#### Scenario: A free frame is held again
- **WHEN** the certificate is added to a released order and a frame is free
- **THEN** that frame is held for the order

### Requirement: Marking ready to collect
"Mark ready to collect" SHALL move an order at "Certificate received" to "Ready to collect".

#### Scenario: The bike is ready
- **WHEN** staff press "Mark ready to collect"
- **THEN** the order is at "Ready to collect" and appears on the till's Cycle to Work list

### Requirement: Hand-over checks come from the provider's note
"Hand over" SHALL open "Hand over to [Customer]" with a tick for each line of the shop's "Checks at hand-over" note for that provider, and "Hand over at the till". Wheelhouse SHALL never state a provider's process as fact.

#### Scenario: A provider with no note lines
- **WHEN** the provider's note is empty
- **THEN** the box has no ticks and still offers "Hand over at the till"

### Requirement: The provider's expected payment
A collected order SHALL show "Expected: £[£] by [date]": what the provider pays less its commission, by the collection date plus the provider's days to pay. Someone who can't see costs and margin SHALL not see the commission, but still sees what's expected (decision H3).

#### Scenario: The date comes from the provider's terms
- **WHEN** the provider pays in about [n] days and the bike is collected
- **THEN** the expected date is [n] days after collection

### Requirement: Mark paid flags any difference
"Mark paid" SHALL ask for Amount received, Received on and Provider's reference (optional) and SHALL move the order to "Paid by the provider". When the amount differs from what was expected, it SHALL show the difference and offer "Close with a reason…" and "Save as part paid" instead.

#### Scenario: Short payment saved as part paid
- **WHEN** less than expected is received and "Save as part paid" is pressed
- **THEN** the order stays at "Collected" showing part paid, and "Mark the rest paid" is offered

### Requirement: One payment can cover several bikes
"Record a payment" for a provider SHALL let staff tick which collected bikes a payment covers, showing "Expected for the ticked bikes", "Received" and "Difference", and offer Save and "Save as paid".

#### Scenario: A payment covering two bikes
- **WHEN** a payment equal to the expected total of two ticked bikes is saved as paid
- **THEN** both orders are at "Paid by the provider"

### Requirement: The Owed lists
"Owed by Cycle to Work providers" SHALL list each provider with Bikes, Owed, Late and a total, and "Download as spreadsheet". Each provider SHALL open "[Provider] · [n] bikes owed", listing Customer, Collected, Certificate, Expected and Late, with "Mark paid" on each and "Record a payment".

#### Scenario: A late payment
- **WHEN** a collected order is past its expected date
- **THEN** it shows as late on both lists and counts in the list's "payment late" line

### Requirement: Cancelling an order
"Cancel the order" (from More) SHALL ask "[Customer] isn't going ahead?" with "Keep the order" and "Cancel the order", and a tick "Tell [Customer] the order is cancelled". Cancelling SHALL free any held frame and keep the order, cancelled, with "What's happened".

#### Scenario: Cancelling frees the bike
- **WHEN** an order with a held frame is cancelled
- **THEN** the frame is free to sell

### Requirement: Money steps are for the people allowed to take them
Mark paid, Save as part paid, Close with a reason, Order now anyway and cancelling an order with a deposit SHALL be refused for anyone without permission; until roles are built, only Owners may take them. Each SHALL be recorded in "What's happened" with who took it and, where asked, why.

#### Scenario: Staff can't mark paid
- **WHEN** Jo Taylor, Staff, sends Mark paid
- **THEN** the server refuses it and nothing changes

### Requirement: Staff can cancel an order without a deposit
Anyone signed in SHALL be able to cancel an order with no deposit. For an order with a deposit, someone not allowed SHALL see "A deposit is held: ask a manager to cancel" instead of "Cancel the order".

#### Scenario: Staff cancel an order with no deposit
- **WHEN** Jo Taylor cancels an order with no deposit
- **THEN** the order is cancelled

### Requirement: Costs and commission are hidden without permission
Someone without "Can see costs and margin" SHALL see no cost price, commission or owed totals anywhere in Cycle to Work, and the server SHALL leave them out of its replies. They still see what each provider is expected to pay for an order (decision H3).

#### Scenario: The order reply leaves out commission
- **WHEN** Jo Taylor opens an order
- **THEN** the reply carries no commission, and does carry the expected amount and date

### Requirement: The customer can see their order through a private link
Each order SHALL have a private "See your order" link that opens "Your Cycle to Work bike" without signing in, showing the quote number, shop, provider, the line for its state, Bike, Accessories and "Total (includes VAT)", with "See your quote" and "Ask the shop a question". It SHALL never show commission or staff names.

#### Scenario: A wrong code shows nothing
- **WHEN** the link is opened with a code that doesn't match an order
- **THEN** nothing about any order is shown

#### Scenario: A cancelled order
- **WHEN** the order is cancelled
- **THEN** the page says "This order is cancelled."

### Requirement: The shop sets how Cycle to Work works
Settings › Front desk › Cycle to Work SHALL hold: "Hold a bike in stock from the quote for [n] days"; "Remind the shop before the hold ends [n] days before"; "Quotes are valid for [n] days"; the rule for bikes not in stock; the deposit rules; the shop's "How to apply" words; the scheme providers; and the Today lines.

#### Scenario: The hold days set the quote's default
- **WHEN** the hold is set to [n] days
- **THEN** a new order's "Hold the bike until [date]" is [n] days from today

### Requirement: Scheme providers and their terms
Each scheme provider SHALL have a Name, Commission (% or £), "Pays in about [n] days" after collection, whether accessories are "Inside what the provider pays" or paid by the customer at collection, and "Checks at hand-over" lines. A provider SHALL be retired, never deleted, while orders use it.

#### Scenario: A retired provider
- **WHEN** a provider is retired
- **THEN** it can't be picked for a new order and its existing orders keep it

### Requirement: A deposit when the bike is ordered straight away
With the rule "Straight away, with a deposit", the order SHALL ask for a deposit (£ or % of the order, from Settings), taken at the till against the order, and SHALL offer "Order from [supplier]" once it is paid. The quote SHALL then add "If you decide not to go ahead after we've ordered the bike, [the shop's rule for the deposit]."

#### Scenario: Ordering waits for the deposit
- **WHEN** the rule is "Straight away, with a deposit" and the deposit isn't paid
- **THEN** the order offers "Take the deposit at the till" and not "Order from [supplier]"

### Requirement: The deposit when the certificate arrives or the customer pulls out
When the certificate arrives, a paid deposit SHALL be refunded the way it was paid, or counted toward the price, as Settings says. When the customer pulls out after the bike was ordered, it SHALL be refunded or kept, as Settings says. A deposit to refund SHALL show "Refund the deposit" on the order, the list and Today.

#### Scenario: Counted toward the price
- **WHEN** the setting is "Count it toward the price" and the certificate arrives
- **THEN** Who pays what shows "Deposit [Customer] has paid" taken off what the customer pays at collection
