# Spec Delta

## Purpose

The shop's customer website: what customers see and do there, from finding a product to buying it for collection.

## ADDED Requirements

### Requirement: The product page offers Add to basket for what's on the chosen shop's shelf
With buying online on, a product in stock at the chosen shop SHALL show "Ready today at Bolton · [n] in stock", a quantity box with "One fewer …" and "One more …" buttons, and Add to basket. Adding SHALL say "Added 2 × Shimano brake pads" with View basket, and the header's basket count SHALL go up.

#### Scenario: Adding two
- **WHEN** Maya sets the quantity to 2 on Shimano brake pads B05S-RX and presses Add to basket, with one other product already in her basket
- **THEN** she sees "Added 2 × Shimano brake pads" with View basket, and the header says "Basket · 3"

#### Scenario: Only what's on the shelf is sold
- **WHEN** the shop sells only what's on the shelf (the only choice for now)
- **THEN** no product page offers Add to basket for an item that isn't on the chosen shop's shelf

### Requirement: A product sold out at the chosen shop can't be added, and says how to ask
A product with none on the chosen shop's shelf SHALL say "Sold out at Bolton" (Jack's WP-6.2 answer 2), offer no Add to basket, and show "Ask the shop about it" with the shop's phone and email. When another of the business's shops has it, the line SHALL name that shop and offer "Collect from [Second site] instead", which changes the chosen shop.

#### Scenario: Sold out everywhere
- **WHEN** Bolton has none and no other shop has any
- **THEN** the page says "Sold out at Bolton", shows "Ask the shop about it" with "Call [shop phone]" and "or email [shop email]", and has no Add to basket

#### Scenario: In stock at the other shop
- **WHEN** Bolton has none and [Second site] has some
- **THEN** the page says "Sold out at Bolton — in stock at our [Second site] shop" with "Collect from [Second site] instead"

### Requirement: Add to basket asks which shop first when none is chosen
With two or more shops and none chosen, the product page SHALL say "Choose a shop to see when it’s ready" and "Add to basket asks which shop first, then adds it." Add to basket SHALL open "Which shop will you collect from?" ("We’ll add it to your basket, remember the shop, and show when things are ready there"), and one tap on a shop SHALL choose it, remember it and add the item.

#### Scenario: Choosing while adding
- **WHEN** Maya presses Add to basket with no shop chosen and taps Bolton
- **THEN** Bolton is remembered as her shop and the item is in her basket

#### Scenario: Cancel
- **WHEN** she presses Cancel on the chooser
- **THEN** nothing is added and no shop is chosen

### Requirement: With buying online off, product pages ask customers to call
When buying online is off, or online payments aren't connected, product pages SHALL say "Not taking online orders right now. Ask in the shop, or call us, to buy this", with "Ask the shop about it", and SHALL offer no Add to basket. The basket and checkout SHALL take no order.

#### Scenario: Switched off
- **WHEN** the Owner switches Buying online off
- **THEN** every product page shows "Not taking online orders right now. Ask in the shop, or call us, to buy this" and no Add to basket

#### Scenario: A checkout sent anyway
- **WHEN** a checkout reaches the server while buying online is off
- **THEN** no order is made and nothing is taken

### Requirement: The basket is kept in the visitor's browser and priced by the shop
The basket SHALL be kept in a cookie that is needed for the site to work, listed on the Cookies page with the other cookies. It SHALL hold only which products and how many; every price, total and stock line SHALL be worked out again by the shop's server, never taken from the browser.

#### Scenario: The basket on the Cookies page
- **WHEN** a customer opens the Cookies page
- **THEN** the basket cookie is listed with its name and how long it lasts

#### Scenario: A changed price in the cookie
- **WHEN** a basket cookie is altered to claim a lower price
- **THEN** the basket and checkout show the shop's real price

### Requirement: The basket shows each line, the total and Go to checkout
The basket SHALL show "Your basket" with each line's name, part code, stock line, quantity buttons, Remove and price, then "Your order" with the item count, "Collect from Bolton · Free", "Total (includes VAT) £[total]" and Go to checkout.

#### Scenario: The basket
- **WHEN** Maya opens her basket with 2 × Shimano brake pads B05S-RX
- **THEN** she sees the line at £28.00 each with "Ready today at Bolton", Remove, "Collect from Bolton · Free", the total and Go to checkout

### Requirement: The basket says when something in it changed
Stock SHALL be checked when the basket opens. A line with fewer left SHALL say "Only 1 left at Bolton — we’ve changed it to 1"; a line no longer in stock SHALL say "No longer in stock at Bolton or [Second site] — remove it to carry on". The basket SHALL say "Something in your basket changed. Sort the lines marked below before checking out." and Go to checkout SHALL be off until it is sorted.

#### Scenario: One left
- **WHEN** Maya's basket has 2 and Bolton now has 1
- **THEN** the line is changed to 1 and says "Only 1 left at Bolton — we’ve changed it to 1"

#### Scenario: Gone
- **WHEN** a line is no longer in stock at any shop
- **THEN** Go to checkout is off with "Remove the item that’s no longer in stock first."

### Requirement: Removing the last item leaves an empty basket with Undo
Removing an item SHALL say "Removed Shimano brake pads." with Undo. With nothing left, the basket SHALL say "Your basket is empty." with "Carry on shopping".

#### Scenario: Undo
- **WHEN** Maya removes her only line and presses Undo
- **THEN** the line is back in her basket

### Requirement: Checkout is one page: how you'll get it, your details, pay
Checkout SHALL show "How you’ll get it" as a choice with one option, "Collect from North Street Cycles, Bolton", then "Your details" (Name, Phone, Email, "For your receipt and to tell you when it’s ready.", "Bought here before? Sign in to fill this in."), then Pay, with "Your order" and the total. No account SHALL be needed.

#### Scenario: A guest checks out
- **WHEN** Maya, not signed in, fills in her name, phone and email
- **THEN** she can pay without making an account

#### Scenario: Signed in
- **WHEN** Maya is signed in
- **THEN** her details show filled in as "Maya Patel maya@example.test · 07700 900 142" with "Signed in · Not you? · Change"

### Requirement: Checkout says which details to check
Pay SHALL check the details first. With mistakes, checkout SHALL say "Check the 2 boxes marked below." (with the real number), and each box its own message, such as "Enter your name" and "Check your email address — it needs an @ and a dot, like name@example.com". Nothing SHALL be taken.

#### Scenario: Name missing, email wrong
- **WHEN** Maya presses Pay with no name and an email with no @
- **THEN** she sees "Check the 2 boxes marked below.", "Enter your name" and the email message, and nothing is taken

### Requirement: A signed-in customer's store credit is used first
For a signed-in customer with store credit, when the shop allows store credit online, checkout SHALL show "Use my store credit · £[credit]" ticked ("Ticked for you. The rest goes on your card."), with "Store credit −£[credit]" and "Left to pay £[£]". When credit covers it all, there SHALL be no card form and the button SHALL read "Place order". Credit SHALL only be used once the order is paid.

#### Scenario: Part paid by credit
- **WHEN** Maya has less credit than the total
- **THEN** checkout shows "Left to pay £[£]" and "Pay £[£]"

#### Scenario: Credit covers it all
- **WHEN** her credit covers the whole order
- **THEN** she sees "Your store credit covers the whole order — nothing to pay by card." and "Place order"

#### Scenario: Not paid, not spent
- **WHEN** her card is declined
- **THEN** her store credit is unchanged

### Requirement: Checkout offers card, Apple Pay and Google Pay
Pay SHALL offer "Pay with Apple Pay" and "Pay with Google Pay" when the shop's switch for them is on, then "or pay by card" with "Card details go straight to [payment provider]", Card number, Expiry and Security code. Card details SHALL never pass through or be kept by the shop's server. There SHALL be no gift card box until gift cards are built (question 8, default taken, Jack can overrule).

#### Scenario: Wallets switched off
- **WHEN** the shop has switched Apple Pay and Google Pay off
- **THEN** checkout shows only the card form

#### Scenario: No gift card box
- **WHEN** a customer opens checkout
- **THEN** there is no "Have a gift card? Add it"

### Requirement: Paying shows that it's paying, and nothing is paid twice
While a payment is going through, the Pay button SHALL be greyed with "Paying — please don’t close this page". A Pay pressed twice, or sent again after a dropped connection, SHALL take the money once.

#### Scenario: Pressed twice
- **WHEN** Maya presses Pay twice quickly
- **THEN** one payment is taken and one order is made

### Requirement: The bank's check is shown over checkout
When the payment provider asks the bank to check, checkout SHALL show "Your bank wants to check it’s you" ("From [payment provider], for £[total] to North Street Cycles", "Nothing is taken until your bank says yes. Then you’ll come straight back here.", "Cancel and go back"). The payment provider SHALL never be named on screen.

#### Scenario: The bank says yes
- **WHEN** the bank's check is approved
- **THEN** Maya comes back to checkout and her order is paid

#### Scenario: Cancel and go back
- **WHEN** she presses Cancel and go back
- **THEN** she is back at checkout and nothing is taken

### Requirement: A declined card takes nothing
A declined payment SHALL show the card box in red with "Your card was declined — nothing has been taken. Try another card, or Apple Pay or Google Pay." and the customer SHALL be able to try again.

#### Scenario: Declined, then another card
- **WHEN** Maya's card is declined and she tries a card that works
- **THEN** her order is paid once

### Requirement: A payment that can't be confirmed tells the customer not to pay again
When the payment's result doesn't arrive, checkout SHALL show no Pay button and "We couldn’t confirm your payment. Don’t pay again — we’ll email maya@example.test within [n] minutes to say whether it went through." The shop SHALL keep asking the provider, and SHALL email the customer either way.

#### Scenario: It went through after all
- **WHEN** the provider later says the payment went through
- **THEN** the order is made as if paid at once and Maya gets "Order confirmation"

#### Scenario: It didn't go through
- **WHEN** the provider later says it didn't go through
- **THEN** no order is made, nothing is taken, and Maya is emailed that it didn't go through

### Requirement: Stock is checked again just before paying
Just before the money is taken, the stock at the collecting shop SHALL be checked again. If an item has sold out, nothing SHALL be taken and checkout SHALL say "[Product] has just sold out at Bolton. Nothing has been taken. Remove it from your order to carry on." with Pay greyed.

#### Scenario: Sold out a moment before
- **WHEN** the last Shimano brake pads at Bolton are sold while Maya is paying
- **THEN** nothing is taken from her card or store credit and she sees the sold-out message

### Requirement: The confirmation gives the order number, what happens next and how it was paid
After paying, the page SHALL say "Paid · £[total]", "Thanks, Maya — your order is in", "Your order number [order number]", "We’ve emailed a copy to maya@example.test · Not right? Change email", "What happens next" in three steps, the shop's address and hours, "How you paid", "See your order" and "Your confirmation email has a link back to this order."

#### Scenario: Paid by card
- **WHEN** Maya's card payment goes through
- **THEN** she sees the confirmation with "How you paid · Card · £[total]"

#### Scenario: Change email
- **WHEN** she changes a mistyped email on the confirmation
- **THEN** the order's email is changed and the confirmation is sent to the new address

### Requirement: Save your details makes an account with an emailed code
The confirmation SHALL offer "Save your details for next time" ("Then you won’t type them again, and this order shows in your account. No password — we’ll email you a code."). Save my details SHALL send a code ("We’ve sent a code to maya@example.test.", "Code from the email", "Send a new code"); the right code SHALL sign the customer in, with this order in their account.

#### Scenario: Saved
- **WHEN** Maya types the code from the email
- **THEN** she is signed in and the order shows in her account

### Requirement: Checkout links to the shop's terms
"By paying you agree to our terms. You can cancel for a full refund until your order is ready." SHALL link "our terms" to the shop's published Collection and returns words, opened over the page as the booking site opens its terms.

#### Scenario: Reading the terms
- **WHEN** Maya presses "our terms"
- **THEN** the shop's Collection and returns words open over checkout, and closing them keeps what she typed
