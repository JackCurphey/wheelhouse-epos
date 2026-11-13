# Spec Delta

## Purpose

An online order from the moment the customer pays to the moment it is handed over or refunded: its stages, its number, what staff see and do in Front desk › Online orders, refunds the way it was paid, reminders for orders not collected, and the customer's own view of it.

## ADDED Requirements

### Requirement: An online order has stages, from paid to collected or cancelled
An online order SHALL be in one stage at a time: To get ready (paid), Ready to collect, Collected, or Cancelled. Each order SHALL record how it reaches the customer; "Collect from a shop" is the only way for now. Each step SHALL be kept with who took it and when, and nothing SHALL edit or remove a kept step.

#### Scenario: A paid order waits to be got ready
- **WHEN** Maya Patel pays for Shimano brake pads B05S-RX for collection from Bolton
- **THEN** her order is in To get ready, recorded as "Collect · Bolton"

#### Scenario: A step not allowed from the stage changes nothing
- **WHEN** staff press Hand over on an order still in To get ready
- **THEN** the step is refused and the order is unchanged

### Requirement: Each order gets the shop's next order number
Each shop SHALL count its own online orders, one up per order, never reused, and SHALL show the number with a prefix, as workshop jobs (WH-) and Cycle to Work quotes (CW-) do. Two orders paid at once SHALL never share a number.

#### Scenario: Two orders at once
- **WHEN** two customers pay at the same moment
- **THEN** their orders get different numbers

#### Scenario: The number is shown everywhere the order is
- **WHEN** an order is paid
- **THEN** the confirmation, the emails, the order page and the staff list all show the same [order number]

### Requirement: Online orders list orders in three groups
Front desk › Online orders SHALL list the shop's orders in three groups: "To get ready" ("Mark ready when everything’s on the shelf for collection — the customer is told straight away."), "Ready to collect" ("Hand over opens the till’s hand-over for that order — it’s already paid.") and "Collected" ("The last 7 days. Older orders are on each customer’s page."), each row showing the customer, the order, its items and How.

#### Scenario: The list
- **WHEN** staff open Online orders with three orders to get ready and two ready
- **THEN** they see "To get ready · 3" and "Ready to collect · 2", with rows such as "Maya Patel · Order [order number] · paid [time]" and "Collect · Bolton"

#### Scenario: A ready order not collected
- **WHEN** a ready order has passed its reminder day
- **THEN** its row says "Not collected · [n] days"

#### Scenario: A collected order
- **WHEN** Jo Taylor handed an order over today
- **THEN** it shows under Collected with "by Jo Taylor"

### Requirement: The sidebar shows how many orders are to get ready
The Online orders entry in the staff sidebar SHALL show the number of orders in To get ready.

#### Scenario: The count
- **WHEN** three orders are in To get ready
- **THEN** the sidebar's Online orders shows 3

### Requirement: The staff order page shows items, how it was paid and the customer
One order's page SHALL show the order number and customer, each item with where it is ("On the shelf", "Waiting at [Shelf name]"), How ("Collect from Bolton"), how it was paid with each part ("Store credit £[£]", "Card £[£]"), and the customer's email and phone, with the steps its stage allows.

#### Scenario: An order to get ready
- **WHEN** staff open an order in To get ready
- **THEN** they see "Can’t supply an item", "Cancel and refund", Close and Mark ready

#### Scenario: A ready order
- **WHEN** staff open a ready order
- **THEN** they see "Ready since [time] · emailed · waiting at [Shelf name]", "Not ready after all", "Cancel and refund", Close and Hand over

### Requirement: Mark ready tells the customer, after a few seconds' Undo
Mark ready SHALL move the order to Ready to collect in one press and queue "Order ready to collect", which SHALL wait a few seconds before it goes (Buy online decision 9, H4); Undo in those seconds SHALL put the order back and stop the email.

#### Scenario: Marked ready
- **WHEN** staff press Mark ready on [Customer]'s order
- **THEN** the order moves to Ready to collect and the message reads "Ready. The email goes to [Customer] in [n] seconds" with Undo

#### Scenario: Undo
- **WHEN** staff press Undo before those seconds are up
- **THEN** the order is back in To get ready and no email goes

### Requirement: An item sold at the till anyway shows as not on the shelf
When the collecting shop's stock of an item falls below what open orders there are waiting for, the newest such order's line SHALL say "Not on the shelf any more", and Mark ready SHALL be off with "Sold at the till. Open the order to sort it."

#### Scenario: The pads were sold at the till
- **WHEN** the last Shimano brake pads B05S-RX at Bolton, paid for by Maya online, are sold at the till
- **THEN** Maya's order says "Not on the shelf any more" and its Mark ready is off with "Sold at the till. Open the order to sort it."

### Requirement: Not ready after all moves an order back, with a sorry message
On a ready order, "Not ready after all" SHALL ask "Not ready after all?", say "Order [order number] · Maya Patel was told it’s ready at [time]" and "It goes back to “To get ready”", with "Send Maya “Sorry, not ready yet”" ticked. Move it back SHALL return the order to To get ready and, when ticked, queue "Order not ready after all".

#### Scenario: Moved back with the sorry message
- **WHEN** staff press Move it back with the tick left on
- **THEN** the order is in To get ready and Maya is sent "Order not ready after all"

#### Scenario: Kept ready
- **WHEN** staff press Keep it ready
- **THEN** nothing changes

### Requirement: Hand over closes a ready order with nothing to pay
Hand over SHALL be a step on the staff order page for a ready order (question 11, waiting for Jack). It SHALL move the order to Collected with who and when, take no money ("Already paid online — nothing to take at the till") and change no stock. The till's hand-over SHALL use the same step when it is built.

#### Scenario: Handed over from the order page
- **WHEN** Jo Taylor presses Hand over on Maya's ready order
- **THEN** the order is Collected "by Jo Taylor" and no payment is asked for

#### Scenario: Pressed twice
- **WHEN** Hand over is sent twice for the same order
- **THEN** the order is collected once

### Requirement: Can't supply an item refunds that item, with a reason the customer sees
"Can’t supply an item" SHALL ask which item and "Tell Maya why (needed)", saying "[£ price] goes back to Maya’s card, the way it was paid, and she’s emailed your reason. The rest of the order carries on." Refund this item SHALL refund that item the way it was paid, mark it "Couldn’t supply · refunded" and queue "Item we couldn’t supply" with the reason.

#### Scenario: One item refunded
- **WHEN** staff choose [Product], type a reason and press Refund this item
- **THEN** [£ price] goes back the way it was paid, the item says "Couldn’t supply · refunded", and Maya is emailed the reason

#### Scenario: No reason
- **WHEN** staff press Refund this item with no reason
- **THEN** it is refused and nothing is refunded

### Requirement: Cancel and refund cancels the whole order the way it was paid
"Cancel and refund" SHALL ask "Cancel and refund this order?", say how much goes back each way ("£[£] to her store credit, £[£] to her card") and "The items go back on sale", and need a reason ("Why are you cancelling? (needed — Maya sees this)"). It SHALL refund each part the way it was paid, put the items back in stock and queue "Order cancelled" with the reason.

#### Scenario: Cancelled by the shop
- **WHEN** staff type a reason and press Cancel and refund
- **THEN** the order is Cancelled, £[£] goes back to Maya's store credit and £[£] to her card, the items are back in stock, and Maya gets "Order cancelled" with the reason

#### Scenario: Kept
- **WHEN** staff press Keep the order
- **THEN** nothing changes

### Requirement: A refund goes back the way the order was paid
Every refund SHALL go back the way the order was paid: the card part through the payment provider's refund, the store credit part back to the customer's store credit as a refund entry. A card refund the provider can't make at once SHALL be kept as owed and tried again until it is made, and SHALL never be made twice.

#### Scenario: Paid by store credit and card
- **WHEN** an order paid £[£] by store credit and £[£] by card is cancelled
- **THEN** £[£] is added back to the customer's store credit and £[£] is refunded to the card

#### Scenario: The provider is busy
- **WHEN** the card refund can't be made at that moment
- **THEN** it is kept as owed and made on a later try, once

### Requirement: The customer can cancel until the order is ready
The customer's order page SHALL offer "Cancel this order" ("Full refund, the way you paid, until it’s ready.") while the order is in To get ready. Cancelling SHALL refund it in full the way it was paid, put the items back on sale and queue "Order cancelled". Once the order is ready, the customer SHALL not be able to cancel it online.

#### Scenario: Cancelled by the customer
- **WHEN** Maya presses Cancel the order on an order still being got ready
- **THEN** the page says "Order cancelled" with "Your refund" and the money goes back the way she paid

#### Scenario: Marked ready a moment before
- **WHEN** Maya presses Cancel the order just after staff marked it ready
- **THEN** nothing is cancelled and she sees "Sorry — your order has just been marked ready, so it can’t be cancelled here. To cancel, call [shop phone]."

### Requirement: An order not collected gets one reminder, then shows on Today
When a ready order hasn't been collected after the shop's reminder days, the customer SHALL be sent "Order still waiting" once. When it reaches the shop's keep days it SHALL show on Today as not collected. New shops SHALL start at 3 days for the reminder and 7 for keeping, as for bikes (question 12, default taken, Jack can overrule).

#### Scenario: The reminder
- **WHEN** a ready order is still not collected 3 days after it was marked ready
- **THEN** the customer is sent "Order still waiting", once

#### Scenario: Kept until today
- **WHEN** it is still not collected 7 days after it was marked ready
- **THEN** Today shows "Order [order number] · Maya Patel — not collected"

### Requirement: An order cancelled because it wasn't collected says so
When staff cancel an order that has passed its keep date, the customer's order page SHALL say "We cancelled this order because it wasn’t collected by [date], after we reminded you on [date]." with how the money goes back.

#### Scenario: Cancelled after the keep date
- **WHEN** staff cancel and refund an order not collected by its keep date
- **THEN** Maya's order page says it was cancelled because it wasn't collected by [date], after the reminder on [date], and shows her refund

### Requirement: The customer's order page shows where the order has got to
The customer's order page SHALL show "Order [order number] · placed [date]", the steps "Ordered / Getting it ready / Ready to collect / Collected" with the current one, what was bought, "Paid on [date]", how it was paid, and where to collect it. A ready order SHALL show "Collect it — Give your name or order number at the counter. It’s paid — nothing more to pay." and Receipt.

#### Scenario: Being got ready
- **WHEN** Maya opens her order while it is in To get ready
- **THEN** she sees "We’re getting your order ready" with Cancel this order

#### Scenario: Ready
- **WHEN** her order is ready
- **THEN** she sees "Your order is ready to collect", the order number large, the Collect it box and Receipt, and no Cancel

#### Scenario: Collected
- **WHEN** her order has been handed over
- **THEN** she sees "Collected — thank you" and "Collected on [date] from Bolton." with Receipt

#### Scenario: An item couldn't be supplied
- **WHEN** one item was refunded as couldn't supply
- **THEN** the page says "Sorry — we couldn’t supply [Product]." with the shop's reason, how it went back, and "The rest of your order is on its way."

### Requirement: A guest reaches their order through a private link
The confirmation email SHALL carry a private link to the order that needs no sign-in. A link that doesn't work SHALL show nothing about any order, attempts SHALL be limited, and the page SHALL carry only the customer's own order details, never staff names, costs or other customers.

#### Scenario: The link from the email
- **WHEN** Maya opens "See your order" from her confirmation email
- **THEN** she sees her order's page without signing in

#### Scenario: A wrong link
- **WHEN** someone opens an order link with a made-up code
- **THEN** they see the same page as any link that doesn't work, with nothing about any order

### Requirement: Who may take each step, until roles exist
Until roles and switches (WP-1.1) are built, anyone signed in SHALL be able to see Online orders and take every order step, refunds included, since Staff may refund. Online orders settings SHALL be the Owner's only, as the rest of WP-6.1's Online orders settings are.

#### Scenario: Staff refund
- **WHEN** Jo Taylor (Staff) cancels and refunds an order with a reason
- **THEN** it is allowed and kept with her name

#### Scenario: Staff can't change the settings
- **WHEN** Jo Taylor tries to change "Keep orders for"
- **THEN** it is refused
