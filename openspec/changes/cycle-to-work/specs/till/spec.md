## ADDED Requirements

### Requirement: The till lists Cycle to Work orders ready to collect
The till's Cycle to Work button SHALL list "Orders ready to collect at [site]", each as "[Customer] · [Bike] · [Size]" with "Quote [quote number] · [Provider] · ready since [date]" and "Open". With none, it SHALL say "Start from Front desk › Cycle to Work".

#### Scenario: Opening an order puts it in the basket
- **WHEN** the cashier opens Maya Patel's order
- **THEN** the basket holds "[Bike] · [Size]" with "Frame [frame number] · the one held · on the order" and the order's accessories

### Requirement: The provider's share is the first way to pay
For a Cycle to Work order, the pay step SHALL show "Cycle to Work · [Provider] · £[£]" first, with "The certificate · owed by [Provider], not in the drawer · certificate [certificate number]", then the usual ways to pay for anything the customer pays.

#### Scenario: Accessories added at the counter
- **WHEN** an accessory is added at the counter
- **THEN** it is marked "added at the counter" and is paid by the customer, not the provider

### Requirement: The server sets the provider's share itself
The server SHALL work out the provider's share from the order and add the "Cycle to Work · [Provider]" payment itself. It SHALL refuse a sale whose provider share differs from the order's, and SHALL never count that share as money in the drawer.

#### Scenario: A tampered share is refused
- **WHEN** a sale for the order claims a larger provider share than the certificate
- **THEN** the server refuses the sale and the order stays at "Ready to collect"

### Requirement: Paying hands the bike over
A completed Cycle to Work sale SHALL mark the held frame sold, move the order to "Collected" with the sale in "What's happened", and start the provider's expected payment.

#### Scenario: The paid box for a certificate-only sale
- **WHEN** the provider pays the whole order
- **THEN** the paid box says it is paid by Cycle to Work · [Provider], with nothing from the customer (the exact wording waits for Jack: the 3 Oct decision's one line or the drawing's two)

#### Scenario: The customer paid a difference
- **WHEN** the customer paid the rest by card
- **THEN** the paid box shows "Cycle to Work · [Provider] and card"

### Requirement: A Cycle to Work deposit is taken at the till
"Take the deposit at the till" SHALL put "Deposit · [Customer]'s Cycle to Work order" in the basket, with "Quote [quote number] · goes on the order when paid", and paying it SHALL record the deposit on the order.

#### Scenario: The deposit reaches the order
- **WHEN** the deposit is paid at the till
- **THEN** the order shows the deposit paid and offers "Order from [supplier]"
