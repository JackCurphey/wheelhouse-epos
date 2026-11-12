# Spec Delta

## ADDED Requirements

### Requirement: Online orders settings hold Buying online and Paying online

Settings › Front desk › Online orders SHALL show Buying online and Paying online. Not connected, Paying online SHALL say "Not connected. Customers can't buy online, "Pay now" for repairs is hidden and booking deposits are off, until you connect [payment provider].", with Connect [payment provider] and "Opens [payment provider]'s own page to sign up or sign in, then brings you back here. Your shop has its own account with them: card details, payouts and fees ([fees]) are between you and [payment provider]."

#### Scenario: Nothing connected

- **WHEN** the Owner opens Settings › Front desk › Online orders before connecting payments
- **THEN** Buying online says "Off until you connect [payment provider]", and Paying online says "Not connected" with Connect [payment provider]

### Requirement: Buying online can't be On until payments are connected

Buying online SHALL stay Off, and can't be switched On, while payments aren't connected; the customer website SHALL then let customers look at products but say "Not taking online orders right now". Connecting payments SHALL switch Buying online On.

#### Scenario: Trying to switch it on early

- **WHEN** payments aren't connected
- **THEN** the Buying online switch can't be turned On, and says "Off until you connect [payment provider]"

#### Scenario: Connecting turns it on

- **WHEN** the Owner connects [payment provider]
- **THEN** Buying online is On

### Requirement: The shop connects its payment provider, and makes a £1 test payment

Connect [payment provider] SHALL open the provider's own page and come back. Connected, Paying online SHALL say "Connected to [payment provider] by [person] just now", "Make a test payment before customers use it", "Pay £1.00 with your own card to check everything works. It's refunded; [what the provider charges on a refund].", and show Apple Pay and Google Pay, Gift cards, and Store credit (for signed-in customers), each On. A test payment that works SHALL say "Test payment worked. £1.00 taken and refunded. Payouts go to the account ending [last 4 digits], [payout timing]." If connecting doesn't finish, it SHALL say "Not connected. [payment provider] didn't finish connecting, so nothing has changed. Try again — if it keeps happening, [payment provider]'s support can see why." with Try again. Connected, "Pay now" for repairs and booking deposits SHALL become available.

#### Scenario: Connecting

- **WHEN** Jack Lewis presses Connect [payment provider] and finishes on the provider's page
- **THEN** Paying online says "Connected to [payment provider] by Jack Lewis just now", with "Make a test payment before customers use it"

#### Scenario: The test payment

- **WHEN** the Owner pays £1.00 with their own card
- **THEN** it is taken and refunded, and Paying online says "Test payment worked. £1.00 taken and refunded."

#### Scenario: Connecting doesn't finish

- **WHEN** the Owner comes back from the provider's page without finishing
- **THEN** it says "Not connected. [payment provider] didn't finish connecting, so nothing has changed." with Try again

#### Scenario: Deposits wait for payments

- **WHEN** payments aren't connected
- **THEN** booking deposits are off and "Pay now" for repairs is hidden

### Requirement: The provider needing more details shows in Settings, on Today and on the Website page

When the payment provider says it needs more details, Paying online SHALL say "[payment provider] needs more details from you by [date], or online payments will stop. It's usually [what they need]. This also shows on Today and the Website page." with "Add the details at [payment provider]".

#### Scenario: More details needed

- **WHEN** the provider asks for more details by a date
- **THEN** Paying online shows the warning with "Add the details at [payment provider]", and Today and the Website page show it too

### Requirement: With Shopify, Wheelhouse's payments are only for repairs

When the website is the shop's Shopify shop, Paying online SHALL say "Shopify for website orders · [Payment provider] for repairs" and "Shopify takes the payment for orders on your Shopify shop. Wheelhouse's payments are only for "Pay now" on repairs.", with "Gift cards and store credit on repairs".

#### Scenario: A Shopify shop's payments

- **WHEN** the shop has connected Shopify and [payment provider]
- **THEN** Paying online says "Shopify for website orders · [Payment provider] for repairs"
